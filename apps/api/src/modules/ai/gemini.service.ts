import { env } from "../../config/env.js";
import { badRequest } from "../../utils/api-error.js";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

const getResponseText = (response: GeminiResponse) =>
  response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join("")
    .trim() ?? "";

const stripJsonFence = (text: string) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

export class GeminiService {
  private get apiKey() {
    if (!env.GEMINI_API_KEY) {
      throw badRequest("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    }
    return env.GEMINI_API_KEY;
  }

  async generateText(input: {
    systemInstruction: string;
    prompt: string;
    responseMimeType?: "text/plain" | "application/json";
    maxOutputTokens?: number;
  }) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: input.systemInstruction }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: input.prompt }]
            }
          ],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: input.maxOutputTokens ?? env.GEMINI_MAX_OUTPUT_TOKENS,
            responseMimeType: input.responseMimeType ?? "text/plain"
          }
        })
      }
    );

    const body = (await response.json().catch(() => null)) as GeminiResponse | null;
    if (!response.ok) {
      throw badRequest(body?.error?.message ?? `Gemini request failed with status ${response.status}`);
    }

    const text = body ? getResponseText(body) : "";
    if (!text) {
      throw badRequest("Gemini returned an empty response");
    }
    return text;
  }

  async generateJson<T>(input: {
    systemInstruction: string;
    prompt: string;
    maxOutputTokens?: number;
  }): Promise<T> {
    const text = await this.generateText({
      ...input,
      responseMimeType: "application/json"
    });

    try {
      return JSON.parse(stripJsonFence(text)) as T;
    } catch {
      throw badRequest("Gemini returned invalid JSON");
    }
  }
}

export const geminiService = new GeminiService();
