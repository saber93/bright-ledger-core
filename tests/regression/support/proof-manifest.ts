export const proofManifest = {
  posOrders: {
    cash: "POS-G6-CASH",
    card: "POS-G6-CARD",
    mixed: "POS-G6-MIX",
    onCredit: "POS-G6-CREDIT",
  },
  quickExpenses: {
    paid: "EXP-G6-001",
    unpaid: "EXP-G6-002",
    taxed: "EXP-G6-003",
  },
  refunds: {
    posFull: "CN-G6-POSFULL",
    customerCredit: "CN-G6-CREDIT",
  },
  cashSession: {
    sessionId: "d38bbaa5-e901-4ee6-ad26-a0937114f6b6",
    cashInNote: "Group 6 bank-to-drawer transfer",
    cashOutNote: "Group 6 safe drop",
    payoutNote: "Group 6 petty cash payout",
  },
  ledgerRefs: {
    cashReceipt: "G6-CASH",
    refund: "CN-G6-POSFULL",
    transfer: "G6-CASH-IN",
  },
} as const;

export const proofExpectations = {
  freshness: {
    requireCurrentMonth: true,
  },
  posOrders: {
    [proofManifest.posOrders.cash]: {
      status: "refunded",
      total: 183.27,
      requiresInvoice: true,
      sessionId: proofManifest.cashSession.sessionId,
      payments: [{ method: "cash", amount: 183.27, reference: proofManifest.ledgerRefs.cashReceipt }],
    },
    [proofManifest.posOrders.card]: {
      status: "completed",
      total: 183.27,
      requiresInvoice: true,
      sessionId: proofManifest.cashSession.sessionId,
      payments: [{ method: "card", amount: 183.27, reference: "G6-CARD" }],
    },
    [proofManifest.posOrders.mixed]: {
      status: "completed",
      total: 183.27,
      requiresInvoice: true,
      sessionId: proofManifest.cashSession.sessionId,
      payments: [
        { method: "cash", amount: 60, reference: "G6-MIX-CASH" },
        { method: "card", amount: 123.27, reference: "G6-MIX-CARD" },
      ],
    },
    [proofManifest.posOrders.onCredit]: {
      status: "completed",
      total: 183.27,
      requiresInvoice: true,
      sessionId: proofManifest.cashSession.sessionId,
      payments: [],
    },
  },
  quickExpenses: {
    [proofManifest.quickExpenses.paid]: {
      paid: true,
      paymentMethod: "cash",
      amount: 120,
      taxAmount: 0,
    },
    [proofManifest.quickExpenses.unpaid]: {
      paid: false,
      paymentMethod: "unpaid",
      amount: 300,
      taxAmount: 0,
    },
    [proofManifest.quickExpenses.taxed]: {
      paid: true,
      paymentMethod: "card",
      amount: 200,
      taxAmount: 46,
    },
  },
  refunds: {
    [proofManifest.refunds.posFull]: {
      sourceType: "pos",
      status: "issued",
      total: 183.27,
      amountAllocated: 183.27,
      restock: true,
      allocation: { targetType: "cash_refund", amount: 183.27, note: "Refunded from drawer" },
      cashRefund: {
        amount: 183.27,
        method: "cash",
        sessionId: proofManifest.cashSession.sessionId,
        reference: "G6-POS-CASH-REFUND",
      },
    },
    [proofManifest.refunds.customerCredit]: {
      sourceType: "invoice",
      status: "issued",
      total: 1700,
      amountAllocated: 1700,
      restock: false,
      allocation: { targetType: "customer_credit", amount: 1700, note: "Carry forward credit" },
      cashRefund: null,
    },
  },
  cashSession: {
    sessionId: proofManifest.cashSession.sessionId,
    status: "open",
    openingCash: 200,
    expectedCash: 260,
    events: [
      { type: "opening", reference: "G6-OPEN", amount: 200, note: "Group 6 proof opening float" },
      { type: "sale", reference: proofManifest.posOrders.cash, amount: 183.27, note: "Group 6 cash sale" },
      { type: "sale", reference: proofManifest.posOrders.mixed, amount: 60, note: "Group 6 mixed cash portion" },
      { type: "refund", reference: proofManifest.refunds.posFull, amount: 183.27, note: "Group 6 POS cash refund" },
      { type: "cash_in", reference: "G6-CASH-IN", amount: 50, note: proofManifest.cashSession.cashInNote },
      { type: "cash_out", reference: "G6-CASH-OUT", amount: 30, note: proofManifest.cashSession.cashOutNote },
      { type: "payout", reference: "G6-PAYOUT", amount: 20, note: proofManifest.cashSession.payoutNote },
    ],
  },
  ledger: {
    requiredDocumentNumbers: [
      proofManifest.posOrders.cash,
      proofManifest.posOrders.card,
      proofManifest.posOrders.mixed,
      proofManifest.posOrders.onCredit,
      proofManifest.quickExpenses.paid,
      proofManifest.quickExpenses.unpaid,
      proofManifest.quickExpenses.taxed,
      proofManifest.refunds.posFull,
      proofManifest.refunds.customerCredit,
    ],
    requiredReferences: [
      proofManifest.ledgerRefs.cashReceipt,
      proofManifest.ledgerRefs.refund,
      proofManifest.ledgerRefs.transfer,
      "G6-CASH-OUT",
      "G6-PAYOUT",
    ],
  },
} as const;
