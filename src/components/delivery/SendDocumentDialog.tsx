import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeliveryTemplates,
  useSendDocumentDelivery,
  type DeliveryEventType,
  type DocumentType,
} from "@/features/delivery/hooks";
import {
  renderDeliveryTemplate,
  type DeliveryTemplateKey,
  type DeliveryTemplateVariables,
} from "@/features/delivery/templates";

interface TemplateOption {
  key: DeliveryTemplateKey;
  label: string;
  description?: string;
}

export function SendDocumentDialog({
  open,
  onOpenChange,
  title,
  description,
  documentType,
  documentId,
  eventType = "send",
  templateOptions,
  defaultRecipient,
  defaultRecipientName,
  variables,
  submitLabel = "Send email",
  seed,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  documentType: DocumentType;
  documentId: string;
  eventType?: DeliveryEventType;
  templateOptions: TemplateOption[];
  defaultRecipient?: string | null;
  defaultRecipientName?: string | null;
  variables: DeliveryTemplateVariables;
  submitLabel?: string;
  seed?: {
    recipient?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    message?: string | null;
    templateKey?: DeliveryTemplateKey;
  } | null;
  onSent?: () => void;
}) {
  const templates = useDeliveryTemplates();
  const send = useSendDocumentDelivery();
  const [templateKey, setTemplateKey] = useState<DeliveryTemplateKey>(templateOptions[0].key);
  const [recipient, setRecipient] = useState(defaultRecipient ?? "");
  const [recipientName, setRecipientName] = useState(defaultRecipientName ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const rendered = useMemo(
    () => renderDeliveryTemplate(templateKey, variables, templates.data),
    [templateKey, templates.data, variables],
  );

  useEffect(() => {
    if (!open) return;
    const nextTemplateKey = seed?.templateKey ?? templateOptions[0].key;
    const preview = renderDeliveryTemplate(nextTemplateKey, variables, templates.data);
    setTemplateKey(nextTemplateKey);
    setRecipient(seed?.recipient ?? defaultRecipient ?? "");
    setRecipientName(seed?.recipientName ?? defaultRecipientName ?? "");
    setSubject(seed?.subject ?? preview.subject);
    setMessage(seed?.message ?? preview.body);
  }, [
    defaultRecipient,
    defaultRecipientName,
    open,
    seed?.message,
    seed?.recipient,
    seed?.recipientName,
    seed?.subject,
    seed?.templateKey,
    templateOptions,
    templates.data,
    variables,
  ]);

  useEffect(() => {
    if (!open) return;
    if (seed?.templateKey && seed.templateKey === templateKey && (seed.subject || seed.message)) return;
    setSubject(rendered.subject);
    setMessage(rendered.body);
  }, [open, rendered.body, rendered.subject, seed?.message, seed?.subject, seed?.templateKey, templateKey]);

  async function submit() {
    try {
      await send.mutateAsync({
        documentType,
        documentId,
        eventType,
        templateKey,
        recipient,
        recipientName: recipientName || null,
        subject,
        message,
      });
      toast.success("Email sent");
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {templateOptions.length > 1 && (
            <div>
              <Label>Preset</Label>
              <Select
                value={templateKey}
                onValueChange={(value) => setTemplateKey(value as DeliveryTemplateKey)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateOptions.find((option) => option.key === templateKey)?.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {templateOptions.find((option) => option.key === templateKey)?.description}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Recipient email</Label>
              <Input
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="customer@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Recipient name</Label>
              <Input
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Customer name"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={12}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={send.isPending || !recipient.trim() || !subject.trim() || !message.trim()}
          >
            {send.isPending ? "Sending…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
