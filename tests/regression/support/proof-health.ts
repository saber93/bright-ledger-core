import { createClient } from "@supabase/supabase-js";
import { getRegressionEnv } from "./env";
import { proofExpectations } from "./proof-manifest";

interface ProofCheck {
  name: string;
  ok: boolean;
  details: string[];
}

interface ProofCompany {
  id: string;
  name: string;
}

export interface ProofHealthReport {
  ok: boolean;
  company: ProofCompany;
  checks: ProofCheck[];
}

type PosOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  invoice_id: string | null;
  session_id: string | null;
  completed_at: string | null;
  created_at: string;
};

type PosPaymentRow = {
  order_id: string;
  method: string;
  amount: number | string;
  reference: string | null;
};

type QuickExpenseRow = {
  expense_number: string;
  paid: boolean;
  payment_method: string;
  amount: number | string;
  tax_amount: number | string;
  date: string;
};

type CreditNoteRow = {
  id: string;
  credit_note_number: string;
  source_type: string;
  status: string;
  total: number | string;
  amount_allocated: number | string;
  restock: boolean;
  issue_date: string;
};

type CreditAllocationRow = {
  credit_note_id: string;
  target_type: string;
  amount: number | string;
  note: string | null;
};

type CashRefundRow = {
  credit_note_id: string;
  amount: number | string;
  method: string;
  session_id: string | null;
  reference: string | null;
  paid_at: string;
};

type CashSessionRow = {
  id: string;
  status: string;
  opening_cash: number | string;
  expected_cash: number | string;
  opened_at: string;
};

type CashSessionEventRow = {
  session_id: string;
  type: string;
  reference: string | null;
  amount: number | string;
  note: string | null;
  created_at: string;
};

type LedgerLineRow = {
  document_number: string;
  reference: string | null;
  debit: number | string;
  credit: number | string;
};

type TrialBalanceRpcRow = {
  closing_debit: number | string;
  closing_credit: number | string;
  period_debit: number | string;
  period_credit: number | string;
};

type AccountBalanceRpcRow = {
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  balance_net: number | string;
};

type PeriodStateRpcRow = {
  period_start: string;
  period_end: string;
  status: string;
  reason: string | null;
  is_locked: boolean;
  label: string;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const cents = (value: unknown): number => Math.round(num(value) * 100);

const sameMoney = (left: unknown, right: unknown): boolean => cents(left) === cents(right);

const fmtMoney = (value: unknown): string => num(value).toFixed(2);

const isoDate = (value: string | null | undefined): string => value?.slice(0, 10) ?? "";

const monthKey = (value: string | null | undefined): string => value?.slice(0, 7) ?? "";

const todayInput = (): string => new Date().toISOString().slice(0, 10);

const currentMonthKey = (): string => todayInput().slice(0, 7);

const monthStartInput = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};

function buildCheck(name: string, issues: string[], success: string): ProofCheck {
  return {
    name,
    ok: issues.length === 0,
    details: issues.length === 0 ? [success] : issues,
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(key(row)) ?? [];
    bucket.push(row);
    grouped.set(key(row), bucket);
  }
  return grouped;
}

async function resolveCompany(
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<ProofCompany> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("default_company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  let companyId = profile?.default_company_id ?? null;

  if (!companyId) {
    const { data: members, error: memberError } = await client
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1);

    if (memberError) throw memberError;
    companyId = members?.[0]?.company_id ?? null;
  }

  if (!companyId) {
    throw new Error("Could not resolve a company for the proof user.");
  }

  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) throw companyError;
  if (!company) {
    throw new Error(`Resolved company ${companyId} but could not load its name.`);
  }

  return {
    id: company.id,
    name: company.name ?? company.id,
  };
}

function computeBalanceSheetTotals(rows: AccountBalanceRpcRow[]) {
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let currentEarnings = 0;

  for (const row of rows) {
    const balance = num(row.balance_net);
    if (row.account_type === "asset") assets += balance;
    if (row.account_type === "liability") liabilities += -balance;
    if (row.account_type === "equity") equity += -balance;
    if (row.account_type === "income" || row.account_type === "expense") {
      currentEarnings += -balance;
    }
  }

  const totalAssets = roundMoney(assets);
  const totalLiabilitiesAndEquity = roundMoney(liabilities + equity + currentEarnings);
  return {
    totalAssets,
    totalLiabilitiesAndEquity,
    difference: roundMoney(totalAssets - totalLiabilitiesAndEquity),
  };
}

export async function verifyProofHealth(): Promise<ProofHealthReport> {
  const env = getRegressionEnv();
  const client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const checks: ProofCheck[] = [];

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: env.proofEmail,
    password: env.proofPassword,
  });

  if (authError) {
    throw new Error(`Proof auth failed: ${authError.message}`);
  }

  const user = authData.user;
  if (!user) {
    throw new Error("Proof auth succeeded but no user was returned.");
  }

  checks.push(
    buildCheck(
      "Proof user authentication",
      [],
      `Signed in as ${user.email ?? env.proofEmail}.`,
    ),
  );

  const company = await resolveCompany(client, user.id);

  checks.push(
    buildCheck(
      "Proof tenant access",
      [],
      `Resolved company ${company.name} (${company.id}).`,
    ),
  );

  const posOrderNumbers = Object.keys(proofExpectations.posOrders);
  const quickExpenseNumbers = Object.keys(proofExpectations.quickExpenses);
  const refundNumbers = Object.keys(proofExpectations.refunds);
  const requiredDocumentNumbers = proofExpectations.ledger.requiredDocumentNumbers;
  const requiredReferences = proofExpectations.ledger.requiredReferences;
  const sessionId = proofExpectations.cashSession.sessionId;

  const [
    periodListResult,
    periodStateResult,
    financeWarningsResult,
    posOrdersResult,
    quickExpensesResult,
    creditNotesResult,
    cashSessionResult,
    cashSessionEventsResult,
    documentLedgerResult,
    referenceLedgerResult,
    trialBalanceResult,
    balanceSheetResult,
  ] = await Promise.all([
    client.rpc("accounting_list_periods", {
      _company_id: company.id,
      _months_back: 1,
      _months_forward: 0,
    }),
    client.rpc("accounting_period_state", {
      _company_id: company.id,
      _effective_date: todayInput(),
    }),
    client.rpc("finance_integrity_warnings", {
      _company_id: company.id,
    }),
    client
      .from("pos_orders")
      .select("id, order_number, status, total, invoice_id, session_id, completed_at, created_at")
      .eq("company_id", company.id)
      .in("order_number", posOrderNumbers),
    client
      .from("quick_expenses")
      .select("expense_number, paid, payment_method, amount, tax_amount, date")
      .eq("company_id", company.id)
      .in("expense_number", quickExpenseNumbers),
    client
      .from("credit_notes")
      .select(
        "id, credit_note_number, source_type, status, total, amount_allocated, restock, issue_date",
      )
      .eq("company_id", company.id)
      .in("credit_note_number", refundNumbers),
    client
      .from("cash_sessions")
      .select("id, status, opening_cash, expected_cash, opened_at")
      .eq("company_id", company.id)
      .eq("id", sessionId)
      .maybeSingle(),
    client
      .from("cash_session_events")
      .select("session_id, type, reference, amount, note, created_at")
      .eq("session_id", sessionId),
    client
      .from("accounting_ledger_lines")
      .select("document_number, reference, debit, credit")
      .eq("company_id", company.id)
      .in("document_number", requiredDocumentNumbers),
    client
      .from("accounting_ledger_lines")
      .select("document_number, reference, debit, credit")
      .eq("company_id", company.id)
      .in("reference", requiredReferences),
    client.rpc("accounting_trial_balance", {
      _company_id: company.id,
      _from: monthStartInput(),
      _to: todayInput(),
      _branch_id: null,
    }),
    client.rpc("accounting_account_balances", {
      _company_id: company.id,
      _as_of: todayInput(),
      _branch_id: null,
    }),
  ]);

  const financeControlIssues: string[] = [];
  if (periodListResult.error) {
    financeControlIssues.push(
      `accounting_list_periods RPC failed: ${periodListResult.error.message}`,
    );
  }
  if (periodStateResult.error) {
    financeControlIssues.push(
      `accounting_period_state RPC failed: ${periodStateResult.error.message}`,
    );
  }
  if (financeWarningsResult.error) {
    financeControlIssues.push(
      `finance_integrity_warnings RPC failed: ${financeWarningsResult.error.message}`,
    );
  }

  const periodListRows = (periodListResult.data ?? []) as Array<Record<string, unknown>>;
  const periodStateRow = (Array.isArray(periodStateResult.data)
    ? periodStateResult.data[0]
    : periodStateResult.data) as PeriodStateRpcRow | null;

  if (!periodListResult.error && periodListRows.length === 0) {
    financeControlIssues.push("accounting_list_periods returned no rows.");
  }
  if (!periodStateResult.error && !periodStateRow) {
    financeControlIssues.push("accounting_period_state returned no current period.");
  }

  checks.push(
    buildCheck(
      "Finance control RPCs",
      financeControlIssues,
      `Finance control RPCs responded for ${periodStateRow?.label ?? todayInput()} with ${periodListRows.length} visible period rows.`,
    ),
  );

  if (posOrdersResult.error) throw posOrdersResult.error;
  if (quickExpensesResult.error) throw quickExpensesResult.error;
  if (creditNotesResult.error) throw creditNotesResult.error;
  if (cashSessionResult.error) throw cashSessionResult.error;
  if (cashSessionEventsResult.error) throw cashSessionEventsResult.error;
  if (documentLedgerResult.error) throw documentLedgerResult.error;
  if (referenceLedgerResult.error) throw referenceLedgerResult.error;
  if (trialBalanceResult.error) throw trialBalanceResult.error;
  if (balanceSheetResult.error) throw balanceSheetResult.error;

  const posOrders = (posOrdersResult.data ?? []) as PosOrderRow[];
  const quickExpenses = (quickExpensesResult.data ?? []) as QuickExpenseRow[];
  const creditNotes = (creditNotesResult.data ?? []) as CreditNoteRow[];
  const cashSession = cashSessionResult.data as CashSessionRow | null;
  const cashSessionEvents = (cashSessionEventsResult.data ?? []) as CashSessionEventRow[];
  const documentLedgerLines = (documentLedgerResult.data ?? []) as LedgerLineRow[];
  const referenceLedgerLines = (referenceLedgerResult.data ?? []) as LedgerLineRow[];
  const trialBalanceRows = (trialBalanceResult.data ?? []) as TrialBalanceRpcRow[];
  const balanceSheetRows = (balanceSheetResult.data ?? []) as AccountBalanceRpcRow[];

  const posOrderIds = posOrders.map((row) => row.id);
  const creditNoteIds = creditNotes.map((row) => row.id);

  const [posPaymentsResult, creditAllocationsResult, cashRefundsResult] = await Promise.all([
    posOrderIds.length > 0
      ? client
          .from("pos_payments")
          .select("order_id, method, amount, reference")
          .in("order_id", posOrderIds)
      : Promise.resolve({ data: [], error: null }),
    creditNoteIds.length > 0
      ? client
          .from("credit_note_allocations")
          .select("credit_note_id, target_type, amount, note")
          .in("credit_note_id", creditNoteIds)
      : Promise.resolve({ data: [], error: null }),
    creditNoteIds.length > 0
      ? client
          .from("cash_refunds")
          .select("credit_note_id, amount, method, session_id, reference, paid_at")
          .in("credit_note_id", creditNoteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (posPaymentsResult.error) throw posPaymentsResult.error;
  if (creditAllocationsResult.error) throw creditAllocationsResult.error;
  if (cashRefundsResult.error) throw cashRefundsResult.error;

  const posPayments = (posPaymentsResult.data ?? []) as PosPaymentRow[];
  const creditAllocations = (creditAllocationsResult.data ?? []) as CreditAllocationRow[];
  const cashRefunds = (cashRefundsResult.data ?? []) as CashRefundRow[];

  const posByNumber = new Map(posOrders.map((row) => [row.order_number, row]));
  const quickExpenseByNumber = new Map(quickExpenses.map((row) => [row.expense_number, row]));
  const creditNoteByNumber = new Map(creditNotes.map((row) => [row.credit_note_number, row]));
  const posPaymentsByOrderId = groupBy(posPayments, (row) => row.order_id);
  const allocationsByCreditNoteId = groupBy(creditAllocations, (row) => row.credit_note_id);
  const cashRefundsByCreditNoteId = groupBy(cashRefunds, (row) => row.credit_note_id);
  const documentLedgerByNumber = groupBy(documentLedgerLines, (row) => row.document_number);
  const referenceLedgerByReference = groupBy(
    referenceLedgerLines.filter((row) => row.reference),
    (row) => String(row.reference),
  );

  const freshnessIssues: string[] = [];
  const freshnessDates: Array<{ label: string; date: string }> = [
    ...posOrders.map((row) => ({
      label: `POS ${row.order_number}`,
      date: isoDate(row.completed_at ?? row.created_at),
    })),
    ...quickExpenses.map((row) => ({
      label: `Quick expense ${row.expense_number}`,
      date: row.date,
    })),
    ...creditNotes.map((row) => ({
      label: `Credit note ${row.credit_note_number}`,
      date: row.issue_date,
    })),
    ...(cashSession
      ? [{ label: `Cash session ${cashSession.id}`, date: isoDate(cashSession.opened_at) }]
      : []),
    ...cashSessionEvents.map((row) => ({
      label: `Cash event ${row.reference ?? row.type}`,
      date: isoDate(row.created_at),
    })),
  ];

  if (proofExpectations.freshness.requireCurrentMonth) {
    const expectedMonth = currentMonthKey();
    for (const row of freshnessDates) {
      if (!row.date) {
        freshnessIssues.push(`${row.label} has no date value.`);
        continue;
      }
      if (monthKey(row.date) !== expectedMonth) {
        freshnessIssues.push(
          `${row.label} is stale at ${row.date}; expected current month ${expectedMonth}.`,
        );
      }
    }
  }

  checks.push(
    buildCheck(
      "Proof dataset freshness",
      freshnessIssues,
      `All ${freshnessDates.length} proof records are in ${currentMonthKey()}.`,
    ),
  );

  const posIssues: string[] = [];
  for (const [orderNumber, expectation] of Object.entries(proofExpectations.posOrders)) {
    const row = posByNumber.get(orderNumber);
    if (!row) {
      posIssues.push(`${orderNumber} is missing from pos_orders.`);
      continue;
    }

    if (row.status !== expectation.status) {
      posIssues.push(`${orderNumber} status is ${row.status}; expected ${expectation.status}.`);
    }
    if (!sameMoney(row.total, expectation.total)) {
      posIssues.push(
        `${orderNumber} total is ${fmtMoney(row.total)}; expected ${fmtMoney(expectation.total)}.`,
      );
    }
    if (expectation.requiresInvoice && !row.invoice_id) {
      posIssues.push(`${orderNumber} is missing its linked invoice_id.`);
    }
    if (row.session_id !== expectation.sessionId) {
      posIssues.push(
        `${orderNumber} session is ${row.session_id ?? "null"}; expected ${expectation.sessionId}.`,
      );
    }

    const actualPayments = [...(posPaymentsByOrderId.get(row.id) ?? [])].sort((left, right) =>
      `${left.method}:${left.reference ?? ""}`.localeCompare(
        `${right.method}:${right.reference ?? ""}`,
      ),
    );
    const expectedPayments = [...expectation.payments].sort((left, right) =>
      `${left.method}:${left.reference ?? ""}`.localeCompare(
        `${right.method}:${right.reference ?? ""}`,
      ),
    );

    if (actualPayments.length !== expectedPayments.length) {
      posIssues.push(
        `${orderNumber} has ${actualPayments.length} payment rows; expected ${expectedPayments.length}.`,
      );
      continue;
    }

    actualPayments.forEach((payment, index) => {
      const expectedPayment = expectedPayments[index];
      if (!expectedPayment) return;

      if (payment.method !== expectedPayment.method) {
        posIssues.push(
          `${orderNumber} payment ${index + 1} method is ${payment.method}; expected ${expectedPayment.method}.`,
        );
      }
      if (!sameMoney(payment.amount, expectedPayment.amount)) {
        posIssues.push(
          `${orderNumber} payment ${index + 1} amount is ${fmtMoney(payment.amount)}; expected ${fmtMoney(expectedPayment.amount)}.`,
        );
      }
      if ((payment.reference ?? "") !== (expectedPayment.reference ?? "")) {
        posIssues.push(
          `${orderNumber} payment ${index + 1} reference is ${payment.reference ?? "null"}; expected ${expectedPayment.reference ?? "null"}.`,
        );
      }
    });
  }

  checks.push(
    buildCheck(
      "POS proof records",
      posIssues,
      `Verified ${posOrderNumbers.length} POS proof orders and their payment patterns.`,
    ),
  );

  const quickExpenseIssues: string[] = [];
  for (const [expenseNumber, expectation] of Object.entries(proofExpectations.quickExpenses)) {
    const row = quickExpenseByNumber.get(expenseNumber);
    if (!row) {
      quickExpenseIssues.push(`${expenseNumber} is missing from quick_expenses.`);
      continue;
    }

    if (row.paid !== expectation.paid) {
      quickExpenseIssues.push(
        `${expenseNumber} paid is ${String(row.paid)}; expected ${String(expectation.paid)}.`,
      );
    }
    if (row.payment_method !== expectation.paymentMethod) {
      quickExpenseIssues.push(
        `${expenseNumber} payment method is ${row.payment_method}; expected ${expectation.paymentMethod}.`,
      );
    }
    if (!sameMoney(row.amount, expectation.amount)) {
      quickExpenseIssues.push(
        `${expenseNumber} amount is ${fmtMoney(row.amount)}; expected ${fmtMoney(expectation.amount)}.`,
      );
    }
    if (!sameMoney(row.tax_amount, expectation.taxAmount)) {
      quickExpenseIssues.push(
        `${expenseNumber} tax is ${fmtMoney(row.tax_amount)}; expected ${fmtMoney(expectation.taxAmount)}.`,
      );
    }
  }

  checks.push(
    buildCheck(
      "Quick expense proof records",
      quickExpenseIssues,
      `Verified ${quickExpenseNumbers.length} quick-expense proof records.`,
    ),
  );

  const refundIssues: string[] = [];
  for (const [creditNoteNumber, expectation] of Object.entries(proofExpectations.refunds)) {
    const note = creditNoteByNumber.get(creditNoteNumber);
    if (!note) {
      refundIssues.push(`${creditNoteNumber} is missing from credit_notes.`);
      continue;
    }

    if (note.source_type !== expectation.sourceType) {
      refundIssues.push(
        `${creditNoteNumber} source type is ${note.source_type}; expected ${expectation.sourceType}.`,
      );
    }
    if (note.status !== expectation.status) {
      refundIssues.push(
        `${creditNoteNumber} status is ${note.status}; expected ${expectation.status}.`,
      );
    }
    if (!sameMoney(note.total, expectation.total)) {
      refundIssues.push(
        `${creditNoteNumber} total is ${fmtMoney(note.total)}; expected ${fmtMoney(expectation.total)}.`,
      );
    }
    if (!sameMoney(note.amount_allocated, expectation.amountAllocated)) {
      refundIssues.push(
        `${creditNoteNumber} amount_allocated is ${fmtMoney(note.amount_allocated)}; expected ${fmtMoney(expectation.amountAllocated)}.`,
      );
    }
    if (note.restock !== expectation.restock) {
      refundIssues.push(
        `${creditNoteNumber} restock is ${String(note.restock)}; expected ${String(expectation.restock)}.`,
      );
    }

    const allocations = allocationsByCreditNoteId.get(note.id) ?? [];
    const allocation = allocations[0];
    if (!allocation) {
      refundIssues.push(`${creditNoteNumber} is missing its credit allocation row.`);
    } else {
      if (allocation.target_type !== expectation.allocation.targetType) {
        refundIssues.push(
          `${creditNoteNumber} allocation target is ${allocation.target_type}; expected ${expectation.allocation.targetType}.`,
        );
      }
      if (!sameMoney(allocation.amount, expectation.allocation.amount)) {
        refundIssues.push(
          `${creditNoteNumber} allocation amount is ${fmtMoney(allocation.amount)}; expected ${fmtMoney(expectation.allocation.amount)}.`,
        );
      }
      if ((allocation.note ?? "") !== expectation.allocation.note) {
        refundIssues.push(
          `${creditNoteNumber} allocation note is ${allocation.note ?? "null"}; expected ${expectation.allocation.note}.`,
        );
      }
    }

    const refunds = cashRefundsByCreditNoteId.get(note.id) ?? [];
    const cashRefund = refunds[0];
    if (expectation.cashRefund) {
      if (!cashRefund) {
        refundIssues.push(`${creditNoteNumber} is missing its cash_refunds row.`);
      } else {
        if (!sameMoney(cashRefund.amount, expectation.cashRefund.amount)) {
          refundIssues.push(
            `${creditNoteNumber} cash refund amount is ${fmtMoney(cashRefund.amount)}; expected ${fmtMoney(expectation.cashRefund.amount)}.`,
          );
        }
        if (cashRefund.method !== expectation.cashRefund.method) {
          refundIssues.push(
            `${creditNoteNumber} cash refund method is ${cashRefund.method}; expected ${expectation.cashRefund.method}.`,
          );
        }
        if (cashRefund.session_id !== expectation.cashRefund.sessionId) {
          refundIssues.push(
            `${creditNoteNumber} cash refund session is ${cashRefund.session_id ?? "null"}; expected ${expectation.cashRefund.sessionId}.`,
          );
        }
        if ((cashRefund.reference ?? "") !== expectation.cashRefund.reference) {
          refundIssues.push(
            `${creditNoteNumber} cash refund reference is ${cashRefund.reference ?? "null"}; expected ${expectation.cashRefund.reference}.`,
          );
        }
      }
    } else if (cashRefund) {
      refundIssues.push(`${creditNoteNumber} has an unexpected cash_refunds row.`);
    }
  }

  checks.push(
    buildCheck(
      "Refund proof records",
      refundIssues,
      `Verified ${refundNumbers.length} refund proof records, allocations, and cash-refund state.`,
    ),
  );

  const cashSessionIssues: string[] = [];
  if (!cashSession) {
    cashSessionIssues.push(`${sessionId} is missing from cash_sessions.`);
  } else {
    if (cashSession.status !== proofExpectations.cashSession.status) {
      cashSessionIssues.push(
        `${sessionId} status is ${cashSession.status}; expected ${proofExpectations.cashSession.status}.`,
      );
    }
    if (!sameMoney(cashSession.opening_cash, proofExpectations.cashSession.openingCash)) {
      cashSessionIssues.push(
        `${sessionId} opening cash is ${fmtMoney(cashSession.opening_cash)}; expected ${fmtMoney(proofExpectations.cashSession.openingCash)}.`,
      );
    }
    if (!sameMoney(cashSession.expected_cash, proofExpectations.cashSession.expectedCash)) {
      cashSessionIssues.push(
        `${sessionId} expected cash is ${fmtMoney(cashSession.expected_cash)}; expected ${fmtMoney(proofExpectations.cashSession.expectedCash)}.`,
      );
    }
  }

  const actualEventMap = new Map(
    cashSessionEvents.map((row) => [
      `${row.type}:${row.reference ?? ""}:${row.note ?? ""}`,
      row,
    ]),
  );

  for (const expectedEvent of proofExpectations.cashSession.events) {
    const key = `${expectedEvent.type}:${expectedEvent.reference}:${expectedEvent.note}`;
    const actual = actualEventMap.get(key);
    if (!actual) {
      cashSessionIssues.push(
        `Missing cash-session event ${expectedEvent.type}/${expectedEvent.reference}.`,
      );
      continue;
    }
    if (!sameMoney(actual.amount, expectedEvent.amount)) {
      cashSessionIssues.push(
        `Cash-session event ${expectedEvent.reference} amount is ${fmtMoney(actual.amount)}; expected ${fmtMoney(expectedEvent.amount)}.`,
      );
    }
  }

  if (cashSessionEvents.length !== proofExpectations.cashSession.events.length) {
    cashSessionIssues.push(
      `${sessionId} has ${cashSessionEvents.length} proof events; expected ${proofExpectations.cashSession.events.length}.`,
    );
  }

  checks.push(
    buildCheck(
      "Cash-session proof records",
      cashSessionIssues,
      `Verified cash session ${sessionId} and ${proofExpectations.cashSession.events.length} expected proof events.`,
    ),
  );

  const ledgerIssues: string[] = [];
  for (const documentNumber of requiredDocumentNumbers) {
    const rows = documentLedgerByNumber.get(documentNumber) ?? [];
    if (rows.length === 0) {
      ledgerIssues.push(`No ledger lines found for document ${documentNumber}.`);
      continue;
    }

    const debit = roundMoney(rows.reduce((sum, row) => sum + num(row.debit), 0));
    const credit = roundMoney(rows.reduce((sum, row) => sum + num(row.credit), 0));
    if (!sameMoney(debit, credit)) {
      ledgerIssues.push(
        `Document ${documentNumber} is out of balance at ${fmtMoney(debit)} debit vs ${fmtMoney(credit)} credit.`,
      );
    }
  }

  for (const reference of requiredReferences) {
    const rows = referenceLedgerByReference.get(reference) ?? [];
    if (rows.length === 0) {
      ledgerIssues.push(`No ledger lines found for reference ${reference}.`);
      continue;
    }

    const debit = roundMoney(rows.reduce((sum, row) => sum + num(row.debit), 0));
    const credit = roundMoney(rows.reduce((sum, row) => sum + num(row.credit), 0));
    if (!sameMoney(debit, credit)) {
      ledgerIssues.push(
        `Reference ${reference} is out of balance at ${fmtMoney(debit)} debit vs ${fmtMoney(credit)} credit.`,
      );
    }
  }

  checks.push(
    buildCheck(
      "Ledger trace coverage",
      ledgerIssues,
      `Verified ${requiredDocumentNumbers.length} document traces and ${requiredReferences.length} reference traces.`,
    ),
  );

  const trialBalanceIssues: string[] = [];
  const closingDebit = roundMoney(
    trialBalanceRows.reduce((sum, row) => sum + num(row.closing_debit), 0),
  );
  const closingCredit = roundMoney(
    trialBalanceRows.reduce((sum, row) => sum + num(row.closing_credit), 0),
  );
  const periodDebit = roundMoney(
    trialBalanceRows.reduce((sum, row) => sum + num(row.period_debit), 0),
  );
  const periodCredit = roundMoney(
    trialBalanceRows.reduce((sum, row) => sum + num(row.period_credit), 0),
  );
  const trialBalanceDifference = roundMoney(closingDebit - closingCredit);

  if (trialBalanceRows.length === 0) {
    trialBalanceIssues.push("Trial balance returned no rows.");
  }
  if (!sameMoney(trialBalanceDifference, 0)) {
    trialBalanceIssues.push(
      `Trial balance difference is ${fmtMoney(trialBalanceDifference)} (${fmtMoney(closingDebit)} debit vs ${fmtMoney(closingCredit)} credit).`,
    );
  }

  checks.push(
    buildCheck(
      "Trial balance health",
      trialBalanceIssues,
      `Current-month trial balance balances at ${fmtMoney(closingDebit)} / ${fmtMoney(closingCredit)} with period movement ${fmtMoney(periodDebit)} / ${fmtMoney(periodCredit)}.`,
    ),
  );

  const balanceSheetIssues: string[] = [];
  const balanceSheetTotals = computeBalanceSheetTotals(balanceSheetRows);
  if (balanceSheetRows.length === 0) {
    balanceSheetIssues.push("Balance sheet returned no account balances.");
  }
  if (!sameMoney(balanceSheetTotals.difference, 0)) {
    balanceSheetIssues.push(
      `Balance sheet difference is ${fmtMoney(balanceSheetTotals.difference)} (${fmtMoney(balanceSheetTotals.totalAssets)} assets vs ${fmtMoney(balanceSheetTotals.totalLiabilitiesAndEquity)} liabilities + equity).`,
    );
  }

  checks.push(
    buildCheck(
      "Balance sheet health",
      balanceSheetIssues,
      `Balance sheet balances at ${fmtMoney(balanceSheetTotals.totalAssets)} assets and ${fmtMoney(balanceSheetTotals.totalLiabilitiesAndEquity)} liabilities + equity.`,
    ),
  );

  await client.auth.signOut();

  return {
    ok: checks.every((check) => check.ok),
    company,
    checks,
  };
}

export function printProofHealthReport(report: ProofHealthReport) {
  console.log(`Proof tenant health for ${report.company.name} (${report.company.id})`);
  for (const check of report.checks) {
    console.log(`${check.ok ? "[ok]" : "[fail]"} ${check.name}`);
    for (const detail of check.details) {
      console.log(`  - ${detail}`);
    }
  }
}
