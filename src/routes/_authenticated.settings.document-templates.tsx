import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFinancePermissions } from "@/features/accounting/permissions";
import {
  useDeliveryTemplates,
  useUpsertDeliveryTemplate,
} from "@/features/delivery/hooks";
import type { DeliveryTemplateKey } from "@/features/delivery/templates";

export const Route = createFileRoute("/_authenticated/settings/document-templates")({
  component: DocumentTemplatesPage,
});

const editableTemplates: Array<{ key: DeliveryTemplateKey; label: string; hint: string }> = [
  {
    key: "invoice_email",
    label: "Invoice email",
    hint: "Default wording for invoice sends from the invoice detail page.",
  },
  {
    key: "credit_note_email",
    label: "Credit note email",
    hint: "Default wording when sending credit notes and refunds.",
  },
  {
    key: "reminder_friendly",
    label: "Friendly reminder",
    hint: "Softer collections wording for recent unpaid invoices.",
  },
  {
    key: "reminder_overdue",
    label: "Overdue reminder",
    hint: "Standard overdue collections wording for unpaid invoices.",
  },
  {
    key: "reminder_final",
    label: "Final reminder",
    hint: "Firm wording for invoices that remain unpaid after prior reminders.",
  },
  {
    key: "customer_statement",
    label: "Customer statement",
    hint: "Default message used when sending account summaries from the customer page.",
  },
];

function DocumentTemplatesPage() {
  const finance = useFinancePermissions();
  const templates = useDeliveryTemplates();
  const save = useUpsertDeliveryTemplate();
  const [drafts, setDrafts] = useState<
    Record<
      DeliveryTemplateKey,
      {
        label: string;
        subject: string;
        body: string;
        paymentInstructions: string;
      }
    >
  >({} as never);

  useEffect(() => {
    if (!templates.data) return;
    const next = {} as Record<
      DeliveryTemplateKey,
      {
        label: string;
        subject: string;
        body: string;
        paymentInstructions: string;
      }
    >;
    for (const item of editableTemplates) {
      const template = templates.data[item.key];
      next[item.key] = {
        label: template.label,
        subject: template.subject_template,
        body: template.body_template,
        paymentInstructions: template.payment_instructions ?? "",
      };
    }
    setDrafts(next);
  }, [templates.data]);

  if (!templates.data) {
    return <div className="py-8 text-sm text-muted-foreground">Loading templates…</div>;
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Template placeholders</AlertTitle>
        <AlertDescription>
          Use placeholders like <code>{"{{company_name}}"}</code>, <code>{"{{document_number}}"}</code>, <code>{"{{document_total}}"}</code>, <code>{"{{balance_due}}"}</code>, <code>{"{{due_date_block}}"}</code>, <code>{"{{payment_instructions_block}}"}</code>, and <code>{"{{document_url}}"}</code>.
        </AlertDescription>
      </Alert>

      {!finance.canManageDocumentTemplates && (
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            Only owner and accountant roles can change document delivery templates.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {editableTemplates.map((item) => {
          const draft = drafts[item.key];
          if (!draft) return null;

          return (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle className="text-base">{item.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Template label</Label>
                  <Input
                    value={draft.label}
                    disabled={!finance.canManageDocumentTemplates}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          label: event.target.value,
                        },
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={draft.subject}
                    disabled={!finance.canManageDocumentTemplates}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          subject: event.target.value,
                        },
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea
                    rows={10}
                    value={draft.body}
                    disabled={!finance.canManageDocumentTemplates}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          body: event.target.value,
                        },
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Payment instructions</Label>
                  <Textarea
                    rows={3}
                    value={draft.paymentInstructions}
                    disabled={!finance.canManageDocumentTemplates}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          paymentInstructions: event.target.value,
                        },
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                {finance.canManageDocumentTemplates && (
                  <div className="flex justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          await save.mutateAsync({
                            templateKey: item.key,
                            label: draft.label,
                            subjectTemplate: draft.subject,
                            bodyTemplate: draft.body,
                            paymentInstructions: draft.paymentInstructions || null,
                          });
                          toast.success(`${item.label} saved`);
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Failed to save template",
                          );
                        }
                      }}
                      disabled={save.isPending}
                    >
                      {save.isPending ? "Saving…" : "Save template"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
