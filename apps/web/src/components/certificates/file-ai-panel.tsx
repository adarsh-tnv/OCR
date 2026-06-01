"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chatWithFile, extractPredefinedFields, getDefaultExtractionFields } from "@/lib/api";
import type {
  FileChatMessage,
  FileChatResult,
  PredefinedExtractionResult,
  UploadedFile
} from "@/types/api";

const formatValue = (value: string | number | boolean | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const defaultFieldsText = (fields: Array<{ label?: string; key: string; description?: string }>) =>
  fields
    .map((field) => {
      const label = field.label ?? field.key;
      return field.description ? `${label}: ${field.description}` : label;
    })
    .join("\n");

const parseFieldsText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export function FileAiPanel({ file }: { file?: UploadedFile | undefined }) {
  const [fieldsText, setFieldsText] = useState("");
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

  useEffect(() => {
    if (!fieldsText && defaults.data?.items.length) {
      setFieldsText(defaultFieldsText(defaults.data.items));
    }
  }, [defaults.data?.items, fieldsText]);

  useEffect(() => {
    setMessages(file?.chatMessages ?? []);
    setResult(file?.customExtractions ?? null);
  }, [file?.chatMessages, file?.customExtractions]);

  const fieldLines = useMemo(() => parseFieldsText(fieldsText), [fieldsText]);

  const extraction = useMutation({
    mutationFn: () => extractPredefinedFields(file?.id as string, fieldLines),
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chat.isPending]);

  const sendQuestion = () => {
    const message = question.trim();
    if (!message || chat.isPending) return;
    chat.mutate(message);
  };

  if (!file) {
    return <div className="text-sm text-slate-500">File unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Default fields</h3>
          <button
            type="button"
            disabled={!fieldLines.length || extraction.isPending}
            aria-busy={extraction.isPending}
            onClick={() => extraction.mutate()}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
          >
            {extraction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {extraction.isPending ? "Fetching" : "Fetch values"}
          </button>
        </div>
        <textarea
          value={fieldsText}
          onChange={(event) => setFieldsText(event.target.value)}
          rows={5}
          className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {extraction.error ? <p className="text-sm text-red-600">{extraction.error.message}</p> : null}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-ink">Fetched values</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(result?.fields ?? []).map((field) => (
                <tr key={field.key}>
                  <td className="px-3 py-2 font-medium text-ink">{field.label ?? field.key}</td>
                  <td className="px-3 py-2 text-slate-700">{formatValue(field.value)}</td>
                  <td className="px-3 py-2 text-slate-600">{Math.round(field.confidence * 100)}%</td>
                  <td className="max-w-md px-3 py-2 text-slate-500">{field.evidence ?? "-"}</td>
                </tr>
              ))}
              {!result?.fields?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No fetched values yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
            disabled={chat.isPending}
            className="focus-ring min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={chat.isPending ? "Processing uploaded file..." : "Ask a question from this file"}
          />
          <button
            type="button"
            disabled={!question.trim() || chat.isPending}
            aria-busy={chat.isPending}
            onClick={sendQuestion}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
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
