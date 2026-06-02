"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatWithFile, extractPredefinedFields, getDefaultExtractionFields } from "@/lib/api";
import type {
  ExtractionProfileField,
  FileChatMessage,
  FileChatResult,
  PredefinedField,
  PredefinedExtractionResult,
  UploadedFile
} from "@/types/api";

const formatValue = (value: string | number | boolean | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

type ConfiguredExtractionField = Pick<ExtractionProfileField, "key" | "label" | "description" | "mandatory" | "aliases">;
type ExtractedField = PredefinedExtractionResult["fields"][number];

const toConfiguredField = (field: PredefinedField | ExtractionProfileField): ConfiguredExtractionField => ({
  key: field.key,
  label: field.label ?? field.key,
  ...(field.description ? { description: field.description } : {}),
  mandatory: "mandatory" in field ? field.mandatory : false,
  aliases: "aliases" in field ? field.aliases : []
});

const toExtractionRequestField = (field: ConfiguredExtractionField): PredefinedField => ({
  key: field.key,
  label: field.label,
  ...(field.description ? { description: field.description } : {})
});

const normalizeMatchText = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const hasValue = (value: ExtractedField["value"] | undefined) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const processingStatuses = new Set(["UPLOADED", "QUEUED", "PROCESSING", "OCR_COMPLETED", "EXTRACTED"]);
const hasOcrText = (file: UploadedFile | undefined) => Boolean(file?.ocrText?.trim());
const isProcessingFile = (file: UploadedFile | undefined) => Boolean(file?.status && processingStatuses.has(file.status));

const findExtractedField = (profileField: ConfiguredExtractionField, extractedFields: ExtractedField[]) => {
  const exact = extractedFields.find((field) => field.key === profileField.key);
  if (exact && hasValue(exact.value)) return exact;

  const matchKeys = new Set([
    normalizeMatchText(profileField.key),
    normalizeMatchText(profileField.label),
    ...profileField.aliases.map(normalizeMatchText)
  ]);

  const aliasMatch = extractedFields.find((field) => {
    const returnedKey = normalizeMatchText(field.key);
    const returnedLabel = normalizeMatchText(field.label);
    return hasValue(field.value) && (matchKeys.has(returnedKey) || matchKeys.has(returnedLabel));
  });

  return aliasMatch ?? exact ?? null;
};

export function FileAiPanel({ file }: { file?: UploadedFile | undefined }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<FileChatMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [result, setResult] = useState<PredefinedExtractionResult | null>(file?.customExtractions ?? null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const defaults = useQuery({
    queryKey: ["default-extraction-fields"],
    queryFn: getDefaultExtractionFields
  });

  const configuredFields =
    file?.extractionProfile?.fields.length
      ? file.extractionProfile.fields.map(toConfiguredField)
      : (defaults.data?.items ?? []).map(toConfiguredField);

  const displayFields = configuredFields.map((field) => {
    const extracted = findExtractedField(field, result?.fields ?? []);
    const present = extracted?.present ?? hasValue(extracted?.value);

    return {
      key: field.key,
      label: field.label,
      mandatory: extracted?.mandatory ?? field.mandatory,
      present,
      value: extracted?.value ?? null,
      confidence: extracted?.confidence,
      evidence: extracted?.evidence ?? null
    };
  });
  const missingMandatoryFields = displayFields
    .filter((field) => field.mandatory && !field.present)
    .map((field) => field.label);
  const ocrTextReady = hasOcrText(file);
  const processingFile = isProcessingFile(file);

  useEffect(() => {
    setMessages(file?.chatMessages ?? []);
    setResult(file?.customExtractions ?? null);
  }, [file?.chatMessages, file?.customExtractions]);

  const extraction = useMutation({
    mutationFn: () => extractPredefinedFields(file?.id as string, configuredFields.map(toExtractionRequestField)),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["certificate"] });
      void queryClient.invalidateQueries({ queryKey: ["file", file?.id] });
    }
  });

  const chat = useMutation({
    mutationFn: (message: string) => chatWithFile(file?.id as string, message),
    onMutate: (message) => {
      const createdAt = new Date().toISOString();
      setPendingQuestion(message);
      setMessages((current) => [
        ...current,
        {
          id: `pending-user-${createdAt}`,
          role: "user",
          content: message,
          createdAt
        }
      ]);
      setQuestion("");
    },
    onSuccess: (data: FileChatResult) => {
      setMessages((current) => [
        ...current,
        {
          id: data.messageId,
          role: "assistant",
          content: data.answer,
          evidence: data.evidence,
          confidence: data.confidence,
          createdAt: data.createdAt
        }
      ]);
      setPendingQuestion("");
      void queryClient.invalidateQueries({ queryKey: ["certificate"] });
      void queryClient.invalidateQueries({ queryKey: ["file", file?.id] });
    },
    onError: (_error, message) => {
      setQuestion(message);
      setPendingQuestion("");
    }
  });
  const canFetchFields = Boolean(file?.id && configuredFields.length && ocrTextReady && !extraction.isPending);
  const canAskFile = Boolean(file?.id && ocrTextReady && !chat.isPending);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chat.isPending]);

  const sendQuestion = () => {
    const message = question.trim();
    if (!message || !canAskFile) return;
    chat.mutate(message);
  };

  if (!file) {
    return <div className="text-sm text-slate-500">File unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {file.extractionProfile?.label ? `${file.extractionProfile.label} fields` : "Configured fields"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {configuredFields.length ? `${configuredFields.length} fields configured for extraction.` : "No fields configured yet."}
            </p>
          </div>
          <button
            type="button"
            disabled={!canFetchFields}
            aria-busy={extraction.isPending}
            onClick={() => extraction.mutate()}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {extraction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {extraction.isPending ? "Fetching" : ocrTextReady ? "Fetch values" : "Waiting for OCR"}
          </button>
        </div>
        {!ocrTextReady ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            OCR text is being extracted. Field fetching will be enabled when text is available.
          </div>
        ) : processingFile && !result ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting configured fields from OCR text.
          </div>
        ) : null}
        {extraction.error ? <p className="text-sm text-red-600">{extraction.error.message}</p> : null}
        {result && missingMandatoryFields.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Missing mandatory fields: {missingMandatoryFields.join(", ")}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayFields.map((field) => {
                const isMissingMandatory = Boolean(result) && Boolean(field.mandatory) && !field.present;
                return (
                  <tr key={field.key} className={isMissingMandatory ? "bg-amber-50/60" : undefined}>
                    <td className="px-3 py-2 font-medium text-ink">{field.label ?? field.key}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          field.mandatory ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {field.mandatory ? "Mandatory" : "Optional"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatValue(field.value)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {typeof field.confidence === "number" ? `${Math.round(field.confidence * 100)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
              {!displayFields.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No fields configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {result?.checkpoints?.length ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Checkpoints</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {result.checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.key}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    checkpoint.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <div className="font-medium">
                    {checkpoint.label}
                    {checkpoint.mandatory ? " *" : ""}
                  </div>
                  <div className="mt-1 text-xs">{checkpoint.reason ?? (checkpoint.passed ? "Passed" : "Needs review")}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-ink">Ask this file</h3>
        <div
          aria-busy={chat.isPending}
          aria-live="polite"
          className="max-h-80 space-y-3 overflow-auto rounded-md bg-slate-50 p-3"
        >
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] rounded-md px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-brand-600 text-white" : "bg-white text-slate-700"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {chat.isPending ? (
            <div className="text-left">
              <div className="inline-flex max-w-[85%] items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                <span>Finding answer from the uploaded file</span>
              </div>
            </div>
          ) : null}
          {!messages.length && !chat.isPending ? (
            <p className="py-6 text-center text-sm text-slate-500">No messages yet.</p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendQuestion();
              }
            }}
            disabled={!canAskFile}
            className="focus-ring min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={
              !ocrTextReady ? "Waiting for OCR text..." : chat.isPending ? "Processing uploaded file..." : "Ask a question from this file"
            }
          />
          <button
            type="button"
            disabled={!question.trim() || !canAskFile}
            aria-busy={chat.isPending}
            onClick={sendQuestion}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {chat.isPending ? "Processing" : "Send"}
          </button>
        </div>
        {pendingQuestion && chat.isPending ? (
          <p className="text-xs text-slate-500">Message uploaded. Waiting for the answer from this file.</p>
        ) : null}
        {chat.error ? <p className="text-sm text-red-600">{chat.error.message}</p> : null}
      </section>
    </div>
  );
}
