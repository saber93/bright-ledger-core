import { createClient } from "@supabase/supabase-js";
import { getRegressionEnv } from "./support/env";
import {
  type ControlFixtureReference,
  type ControlPaymentReference,
  writeControlManifest,
} from "./support/control-manifest";

type ProofUserCompany = {
  id: string;
  name: string;
  currency: string | null;
};

type AuthenticatedClient = ReturnType<typeof createClient>;

type BasicRow = { id: string };

const num = (value: unknown): number => {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const todayInput = () => new Date().toISOString().slice(0, 10);

const periodStartInput = (dateInput: string) => `${dateInput.slice(0, 7)}-01`;

const periodLabel = (periodStart: string) =>
  new Date(`${periodStart}T00:00:00.000Z`).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const runStamp = () =>
  `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

const errorMessage = (error: { message?: string; details?: string } | null, fallback: string) => {
  if (!error) return fallback;
  return [error.message?.trim(), error.details?.trim()].filter(Boolean).join(" ") || fallback;
};

async function signInProofClient(): Promise<{
  client: AuthenticatedClient;
  userId: string;
}> {
  const env = getRegressionEnv();
  const client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: env.proofEmail,
    password: env.proofPassword,
  });

  if (error) {
    throw new Error(`Could not authenticate the proof user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Proof authentication succeeded but did not return a user.");
  }

  return {
    client,
    userId: data.user.id,
  };
}

async function resolveCompany(client: AuthenticatedClient, userId: string): Promise<ProofUserCompany> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("default_company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not resolve proof profile: ${profileError.message}`);
  }

  let companyId = profile?.default_company_id ?? null;

  if (!companyId) {
    const { data: members, error: memberError } = await client
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1);
    if (memberError) {
      throw new Error(`Could not resolve company membership: ${memberError.message}`);
    }
    companyId = members?.[0]?.company_id ?? null;
  }

  if (!companyId) {
    throw new Error("Could not resolve a company for the proof user.");
  }

  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id, name, currency")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    throw new Error(`Could not load proof company: ${companyError.message}`);
  }
  if (!company) {
    throw new Error(`Resolved company ${companyId} but could not load its details.`);
  }

  return {
    id: company.id,
    name: company.name ?? company.id,
    currency: company.currency ?? "USD",
  };
}

async function resolveCurrentPeriod(client: AuthenticatedClient, companyId: string) {
  const today = todayInput();
  const { data, error } = await client.rpc("accounting_period_state", {
    _company_id: companyId,
    _effective_date: today,
  });

  if (error) {
    throw new Error(
      `Finance controls are unavailable because accounting_period_state failed: ${errorMessage(error, "RPC failed")}`,
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        period_start: string;
        label: string;
        is_locked: boolean;
      }
    | null;

  if (!row) {
    throw new Error("Finance controls returned no current accounting period state.");
  }

  if (row.is_locked) {
    const reopen = await client.rpc("accounting_reopen_period", {
      _company_id: companyId,
      _period_start: row.period_start,
      _reason: "Regression harness bootstrap reset",
    });
    if (reopen.error) {
      throw new Error(
        `Could not reopen the current proof period before seeding control fixtures: ${errorMessage(
          reopen.error,
          "RPC failed",
        )}`,
      );
    }
  }

  return {
    periodStart: row.period_start,
    label: row.label,
    today,
  };
}

async function pickId(
  client: AuthenticatedClient,
  table: "customers" | "suppliers",
  companyId: string,
) {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load ${table}: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(`No ${table} rows exist in the proof tenant.`);
  }
  return data.id as string;
}

async function pickAccountId(
  client: AuthenticatedClient,
  companyId: string,
  code: "4100" | "5500",
) {
  const { data, error } = await client
    .from("chart_of_accounts")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", code)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load chart account ${code}: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(`Chart account ${code} is missing from the proof tenant.`);
  }
  return data.id as string;
}

async function createInvoice(
  client: AuthenticatedClient,
  input: {
    companyId: string;
    userId: string;
    customerId: string;
    invoiceNumber: string;
    issueDate: string;
    amount: number;
    accountId: string;
  },
): Promise<ControlFixtureReference> {
  const { data: invoice, error: invoiceError } = await client
    .from("customer_invoices")
    .insert({
      company_id: input.companyId,
      customer_id: input.customerId,
      invoice_number: input.invoiceNumber,
      issue_date: input.issueDate,
      due_date: input.issueDate,
      status: "draft",
      subtotal: input.amount,
      tax_total: 0,
      total: input.amount,
      amount_paid: 0,
      notes: "Group 9 control regression fixture",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice?.id) {
    throw new Error(
      `Could not create invoice fixture ${input.invoiceNumber}: ${errorMessage(
        invoiceError,
        "Insert failed",
      )}`,
    );
  }

  const { error: lineError } = await client.from("invoice_lines").insert({
    invoice_id: invoice.id,
    position: 0,
    description: "Group 9 control regression invoice line",
    quantity: 1,
    unit_price: input.amount,
    tax_rate: 0,
    account_id: input.accountId,
    line_total: input.amount,
  });

  if (lineError) {
    throw new Error(
      `Could not create invoice line for ${input.invoiceNumber}: ${lineError.message}`,
    );
  }

  const { error: statusError } = await client
    .from("customer_invoices")
    .update({ status: "sent" })
    .eq("id", invoice.id);
  if (statusError) {
    throw new Error(
      `Could not post invoice fixture ${input.invoiceNumber}: ${statusError.message}`,
    );
  }

  return {
    id: invoice.id,
    number: input.invoiceNumber,
  };
}

async function createInvoicePayment(
  client: AuthenticatedClient,
  input: {
    companyId: string;
    userId: string;
    customerId: string;
    invoiceId: string;
    amount: number;
    paidAt: string;
    reference: string;
  },
): Promise<ControlPaymentReference> {
  const { data, error } = await client
    .from("payments")
    .insert({
      company_id: input.companyId,
      invoice_id: input.invoiceId,
      party_type: "customer",
      party_id: input.customerId,
      direction: "in",
      method: "bank_transfer",
      amount: input.amount,
      paid_at: `${input.paidAt}T09:00:00.000Z`,
      reference: input.reference,
      status: "completed",
      notes: "Group 9 control regression payment",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not create invoice payment ${input.reference}: ${errorMessage(error, "Insert failed")}`,
    );
  }

  const update = await client
    .from("customer_invoices")
    .update({ amount_paid: input.amount, status: "paid" })
    .eq("id", input.invoiceId);

  if (update.error) {
    throw new Error(
      `Could not settle invoice for payment ${input.reference}: ${update.error.message}`,
    );
  }

  return {
    id: data.id as string,
    reference: input.reference,
  };
}

async function createBill(
  client: AuthenticatedClient,
  input: {
    companyId: string;
    userId: string;
    supplierId: string;
    billNumber: string;
    issueDate: string;
    amount: number;
    accountId: string;
  },
): Promise<ControlFixtureReference> {
  const { data: bill, error: billError } = await client
    .from("supplier_bills")
    .insert({
      company_id: input.companyId,
      supplier_id: input.supplierId,
      bill_number: input.billNumber,
      issue_date: input.issueDate,
      due_date: input.issueDate,
      status: "draft",
      subtotal: input.amount,
      tax_total: 0,
      total: input.amount,
      amount_paid: 0,
      notes: "Group 9 control regression fixture",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (billError || !bill?.id) {
    throw new Error(
      `Could not create bill fixture ${input.billNumber}: ${errorMessage(
        billError,
        "Insert failed",
      )}`,
    );
  }

  const { error: lineError } = await client.from("bill_lines").insert({
    bill_id: bill.id,
    position: 0,
    description: "Group 9 control regression bill line",
    quantity: 1,
    unit_price: input.amount,
    tax_rate: 0,
    account_id: input.accountId,
    line_total: input.amount,
  });

  if (lineError) {
    throw new Error(
      `Could not create bill line for ${input.billNumber}: ${lineError.message}`,
    );
  }

  const { error: statusError } = await client
    .from("supplier_bills")
    .update({ status: "received" })
    .eq("id", bill.id);
  if (statusError) {
    throw new Error(
      `Could not post bill fixture ${input.billNumber}: ${statusError.message}`,
    );
  }

  return {
    id: bill.id,
    number: input.billNumber,
  };
}

async function createBillPayment(
  client: AuthenticatedClient,
  input: {
    companyId: string;
    userId: string;
    supplierId: string;
    billId: string;
    amount: number;
    paidAt: string;
    reference: string;
  },
): Promise<ControlPaymentReference> {
  const { data, error } = await client
    .from("payments")
    .insert({
      company_id: input.companyId,
      bill_id: input.billId,
      party_type: "supplier",
      party_id: input.supplierId,
      direction: "out",
      method: "bank_transfer",
      amount: input.amount,
      paid_at: `${input.paidAt}T10:00:00.000Z`,
      reference: input.reference,
      status: "completed",
      notes: "Group 9 control regression supplier payment",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not create supplier payment ${input.reference}: ${errorMessage(error, "Insert failed")}`,
    );
  }

  const update = await client
    .from("supplier_bills")
    .update({ amount_paid: input.amount, status: "paid" })
    .eq("id", input.billId);

  if (update.error) {
    throw new Error(
      `Could not settle bill for payment ${input.reference}: ${update.error.message}`,
    );
  }

  return {
    id: data.id as string,
    reference: input.reference,
  };
}

async function createCreditNote(
  client: AuthenticatedClient,
  input: {
    companyId: string;
    userId: string;
    customerId: string;
    creditNoteNumber: string;
    issueDate: string;
    amount: number;
    currency: string | null;
  },
): Promise<ControlFixtureReference> {
  const { data: note, error: noteError } = await client
    .from("credit_notes")
    .insert({
      company_id: input.companyId,
      credit_note_number: input.creditNoteNumber,
      customer_id: input.customerId,
      source_type: "manual",
      reason: "Group 9 control regression fixture",
      status: "draft",
      subtotal: input.amount,
      tax_total: 0,
      total: input.amount,
      amount_allocated: 0,
      currency: input.currency ?? "USD",
      restock: false,
      issue_date: input.issueDate,
      notes: "Voidable regression fixture",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (noteError || !note?.id) {
    throw new Error(
      `Could not create credit note fixture ${input.creditNoteNumber}: ${errorMessage(
        noteError,
        "Insert failed",
      )}`,
    );
  }

  const { error: lineError } = await client.from("credit_note_lines").insert({
    credit_note_id: note.id,
    position: 0,
    source_line_type: null,
    source_line_id: null,
    product_id: null,
    description: "Group 9 control regression credit note line",
    quantity: 1,
    unit_price: input.amount,
    tax_rate_id: null,
    tax_rate: 0,
    tax_amount: 0,
    line_total: input.amount,
  });

  if (lineError) {
    throw new Error(
      `Could not create credit note line for ${input.creditNoteNumber}: ${lineError.message}`,
    );
  }

  const { error: statusError } = await client
    .from("credit_notes")
    .update({ status: "issued" })
    .eq("id", note.id);
  if (statusError) {
    throw new Error(
      `Could not issue credit note fixture ${input.creditNoteNumber}: ${statusError.message}`,
    );
  }

  return {
    id: note.id,
    number: input.creditNoteNumber,
  };
}

async function main() {
  const { client, userId } = await signInProofClient();

  try {
    const company = await resolveCompany(client, userId);
    const currentPeriod = await resolveCurrentPeriod(client, company.id);
    const customerId = await pickId(client, "customers", company.id);
    const supplierId = await pickId(client, "suppliers", company.id);
    const salesAccountId = await pickAccountId(client, company.id, "4100");
    const expenseAccountId = await pickAccountId(client, company.id, "5500");
    const stamp = runStamp();

    const invoiceBlocked = await createInvoice(client, {
      companyId: company.id,
      userId,
      customerId,
      invoiceNumber: `INV-G9-BLOCK-${stamp}`,
      issueDate: currentPeriod.today,
      amount: 145,
      accountId: salesAccountId,
    });

    const invoicePaymentReverse = await createInvoice(client, {
      companyId: company.id,
      userId,
      customerId,
      invoiceNumber: `INV-G9-REV-${stamp}`,
      issueDate: currentPeriod.today,
      amount: 210,
      accountId: salesAccountId,
    });
    const invoicePayment = await createInvoicePayment(client, {
      companyId: company.id,
      userId,
      customerId,
      invoiceId: invoicePaymentReverse.id,
      amount: 210,
      paidAt: currentPeriod.today,
      reference: `G9-INV-PAY-${stamp}`,
    });

    const billVoid = await createBill(client, {
      companyId: company.id,
      userId,
      supplierId,
      billNumber: `BILL-G9-VOID-${stamp}`,
      issueDate: currentPeriod.today,
      amount: 95,
      accountId: expenseAccountId,
    });

    const billPaymentReverse = await createBill(client, {
      companyId: company.id,
      userId,
      supplierId,
      billNumber: `BILL-G9-REV-${stamp}`,
      issueDate: currentPeriod.today,
      amount: 180,
      accountId: expenseAccountId,
    });
    const billPayment = await createBillPayment(client, {
      companyId: company.id,
      userId,
      supplierId,
      billId: billPaymentReverse.id,
      amount: 180,
      paidAt: currentPeriod.today,
      reference: `G9-BILL-PAY-${stamp}`,
    });

    const creditNoteVoid = await createCreditNote(client, {
      companyId: company.id,
      userId,
      customerId,
      creditNoteNumber: `CN-G9-VOID-${stamp}`,
      issueDate: currentPeriod.today,
      amount: 66,
      currency: company.currency,
    });

    writeControlManifest({
      generatedAt: new Date().toISOString(),
      companyId: company.id,
      periodStart: currentPeriod.periodStart,
      periodLabel: currentPeriod.label || periodLabel(currentPeriod.periodStart),
      invoiceBlocked,
      invoicePaymentReverse: {
        ...invoicePaymentReverse,
        payment: invoicePayment,
      },
      billVoid,
      billPaymentReverse: {
        ...billPaymentReverse,
        payment: billPayment,
      },
      creditNoteVoid,
    });

    console.log(`Prepared control regression fixtures for ${company.name} (${company.id})`);
    console.log(`  - blocked invoice: ${invoiceBlocked.number}`);
    console.log(
      `  - invoice payment reversal: ${invoicePaymentReverse.number} via ${invoicePayment.reference}`,
    );
    console.log(`  - voidable bill: ${billVoid.number}`);
    console.log(
      `  - bill payment reversal: ${billPaymentReverse.number} via ${billPayment.reference}`,
    );
    console.log(`  - voidable credit note: ${creditNoteVoid.number}`);
  } finally {
    await client.auth.signOut();
  }
}

void main().catch((error) => {
  console.error("[fail] Control proof fixture preparation failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
