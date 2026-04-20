export type DeliveryTemplateKey =
  | "invoice_email"
  | "credit_note_email"
  | "reminder_friendly"
  | "reminder_overdue"
  | "reminder_final"
  | "customer_statement"
  | "pos_receipt_email"
  | "bill_email";

export interface DeliveryTemplateRecord {
  template_key: DeliveryTemplateKey;
  label: string;
  subject_template: string;
  body_template: string;
  payment_instructions: string | null;
}

export interface DeliveryTemplateVariables {
  company_name?: string | null;
  company_legal_name?: string | null;
  recipient_name?: string | null;
  customer_name?: string | null;
  supplier_name?: string | null;
  document_label?: string | null;
  document_number?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  document_total?: string | null;
  balance_due?: string | null;
  available_credit?: string | null;
  statement_total_due?: string | null;
  reminder_level?: string | null;
  payment_instructions?: string | null;
  document_url?: string | null;
}

type TemplateCatalog = Record<DeliveryTemplateKey, DeliveryTemplateRecord>;

const defaults: TemplateCatalog = {
  invoice_email: {
    template_key: "invoice_email",
    label: "Invoice email",
    subject_template: "{{company_name}} invoice {{document_number}}",
    body_template: `Hello {{recipient_name}},

Please find {{document_label}} {{document_number}} dated {{document_date}} for {{document_total}}.
The current balance due is {{balance_due}}{{due_date_block}}.

You can view and print the document here:
{{document_url}}

{{payment_instructions_block}}

Thank you,
{{company_name}}`,
    payment_instructions: "Please include the invoice number with your payment.",
  },
  credit_note_email: {
    template_key: "credit_note_email",
    label: "Credit note email",
    subject_template: "{{company_name}} credit note {{document_number}}",
    body_template: `Hello {{recipient_name}},

Please find credit note {{document_number}} dated {{document_date}} for {{document_total}}.
You can view and print it here:
{{document_url}}

If you have any questions about how this credit will be applied, please reply to this message.

Regards,
{{company_name}}`,
    payment_instructions: null,
  },
  reminder_friendly: {
    template_key: "reminder_friendly",
    label: "Friendly reminder",
    subject_template: "Friendly reminder: {{document_number}} from {{company_name}}",
    body_template: `Hello {{recipient_name}},

This is a friendly reminder that {{document_label}} {{document_number}} for {{document_total}} is still showing an open balance of {{balance_due}}{{due_date_block}}.

You can review the document here:
{{document_url}}

{{payment_instructions_block}}

Thank you,
{{company_name}}`,
    payment_instructions: "If payment has already been made, please reply with the payment reference so we can update our records.",
  },
  reminder_overdue: {
    template_key: "reminder_overdue",
    label: "Overdue reminder",
    subject_template: "Overdue reminder: {{document_number}} from {{company_name}}",
    body_template: `Hello {{recipient_name}},

Our records show that {{document_label}} {{document_number}} for {{document_total}} is overdue with an open balance of {{balance_due}}{{due_date_block}}.

Please review the document here:
{{document_url}}

{{payment_instructions_block}}

If you need a copy of the statement or would like to discuss the balance, please let us know.

Regards,
{{company_name}}`,
    payment_instructions: "Please arrange payment as soon as possible and quote the invoice number in your transfer reference.",
  },
  reminder_final: {
    template_key: "reminder_final",
    label: "Final reminder",
    subject_template: "Final reminder: {{document_number}} from {{company_name}}",
    body_template: `Hello {{recipient_name}},

This is a final reminder regarding {{document_label}} {{document_number}}. The amount of {{balance_due}} remains unpaid{{due_date_block}}.

Please review the document here:
{{document_url}}

{{payment_instructions_block}}

If there is a problem with this balance, please contact us promptly so we can resolve it.

Thank you,
{{company_name}}`,
    payment_instructions: "Please contact us immediately if you need to discuss a payment arrangement.",
  },
  customer_statement: {
    template_key: "customer_statement",
    label: "Customer statement",
    subject_template: "{{company_name}} account statement",
    body_template: `Hello {{recipient_name}},

Please find your current account statement from {{company_name}}.
Open invoices total {{statement_total_due}} and available credit is {{available_credit}}.

You can view and print the statement here:
{{document_url}}

{{payment_instructions_block}}

Regards,
{{company_name}}`,
    payment_instructions: "Please refer to the statement when remitting payment so we can allocate it correctly.",
  },
  pos_receipt_email: {
    template_key: "pos_receipt_email",
    label: "POS receipt email",
    subject_template: "{{company_name}} receipt {{document_number}}",
    body_template: `Hello {{recipient_name}},

Thank you for your purchase. Your receipt {{document_number}} dated {{document_date}} for {{document_total}} is available here:
{{document_url}}

We appreciate your business.

{{company_name}}`,
    payment_instructions: null,
  },
  bill_email: {
    template_key: "bill_email",
    label: "Supplier bill email",
    subject_template: "{{company_name}} bill {{document_number}}",
    body_template: `Hello {{recipient_name}},

Please find bill {{document_number}} dated {{document_date}} for {{document_total}}.
You can view and print the document here:
{{document_url}}

Please reply if anything on the bill needs to be corrected.

Regards,
{{company_name}}`,
    payment_instructions: null,
  },
};

function cleanBlock(value: string) {
  return value
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function applyVariables(template: string, variables: Record<string, string>) {
  return cleanBlock(
    Object.entries(variables).reduce(
      (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
      template,
    ),
  );
}

export function listDeliveryTemplateDefaults(): DeliveryTemplateRecord[] {
  return Object.values(defaults);
}

export function getDefaultDeliveryTemplate(templateKey: DeliveryTemplateKey): DeliveryTemplateRecord {
  return defaults[templateKey];
}

export function mergeDeliveryTemplates(
  overrides: Partial<DeliveryTemplateRecord>[] | null | undefined,
): TemplateCatalog {
  const merged = { ...defaults };
  for (const override of overrides ?? []) {
    const key = override.template_key;
    if (!key || !merged[key]) continue;
    merged[key] = {
      ...merged[key],
      ...override,
      template_key: key,
      label: override.label?.trim() || merged[key].label,
      subject_template: override.subject_template?.trim() || merged[key].subject_template,
      body_template: override.body_template?.trim() || merged[key].body_template,
      payment_instructions:
        override.payment_instructions === undefined
          ? merged[key].payment_instructions
          : override.payment_instructions,
    };
  }
  return merged;
}

export function renderDeliveryTemplate(
  templateKey: DeliveryTemplateKey,
  variables: DeliveryTemplateVariables,
  overrides?:
    | Partial<DeliveryTemplateRecord>[]
    | Record<DeliveryTemplateKey, DeliveryTemplateRecord>
    | null,
) {
  const catalog = Array.isArray(overrides) || !overrides ? mergeDeliveryTemplates(overrides) : overrides;
  const template = catalog[templateKey];
  const recipientName =
    variables.recipient_name?.trim() ||
    variables.customer_name?.trim() ||
    variables.supplier_name?.trim() ||
    "there";
  const dueDateBlock = variables.due_date ? ` and was due on ${variables.due_date}` : "";
  const paymentInstructions =
    variables.payment_instructions ?? template.payment_instructions ?? "";
  const paymentInstructionsBlock = paymentInstructions
    ? `Payment instructions:\n${paymentInstructions}`
    : "";

  const values: Record<string, string> = {
    company_name: variables.company_name?.trim() || "Your company",
    company_legal_name: variables.company_legal_name?.trim() || variables.company_name?.trim() || "",
    recipient_name: recipientName,
    customer_name: variables.customer_name?.trim() || recipientName,
    supplier_name: variables.supplier_name?.trim() || recipientName,
    document_label: variables.document_label?.trim() || "document",
    document_number: variables.document_number?.trim() || "—",
    document_date: variables.document_date?.trim() || "—",
    due_date: variables.due_date?.trim() || "",
    due_date_block: dueDateBlock,
    document_total: variables.document_total?.trim() || "0.00",
    balance_due: variables.balance_due?.trim() || variables.document_total?.trim() || "0.00",
    available_credit: variables.available_credit?.trim() || "0.00",
    statement_total_due: variables.statement_total_due?.trim() || variables.balance_due?.trim() || "0.00",
    reminder_level: variables.reminder_level?.trim() || "",
    payment_instructions: paymentInstructions,
    payment_instructions_block: paymentInstructionsBlock,
    document_url: variables.document_url?.trim() || "",
  };

  return {
    template,
    subject: applyVariables(template.subject_template, values),
    body: applyVariables(template.body_template, values),
    paymentInstructions,
  };
}
