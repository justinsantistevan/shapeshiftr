// Langfuse tracing + prompt management for Supabase Edge Functions
// Uses the Langfuse REST API directly (no npm dependencies needed):
// traces go through OTLP/HTTP (v4 ingestion), scores through POST /api/public/scores.

// @ts-ignore - Deno global is available in Deno runtime
const LANGFUSE_PUBLIC_KEY = Deno.env.get("LANGFUSE_PUBLIC_KEY");
// @ts-ignore - Deno global is available in Deno runtime
const LANGFUSE_SECRET_KEY = Deno.env.get("LANGFUSE_SECRET_KEY");
const LANGFUSE_HOST = "https://us.cloud.langfuse.com";

// --- Prompt fetching with 5-minute in-memory cache ---

interface CachedPrompt {
  text: string;
  version: number;
  fetchedAt: number;
}

const promptCache = new Map<string, CachedPrompt>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a versioned text prompt from Langfuse.
 * Returns the prompt text and version, or null on failure (caller falls back to hardcoded).
 */
export async function fetchPrompt(
  name: string,
  label = "production",
  signal?: AbortSignal,
): Promise<{ text: string; version: number } | null> {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log("[langfuse] No credentials set, skipping prompt fetch");
    return null;
  }

  // Check cache
  const cacheKey = `${name}:${label}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[langfuse] Using cached prompt: ${name} v${cached.version}`);
    return { text: cached.text, version: cached.version };
  }

  try {
    const auth = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);
    const url = `${LANGFUSE_HOST}/api/public/v2/prompts/${encodeURIComponent(name)}?label=${encodeURIComponent(label)}`;

    const resp = await fetch(url, {
      signal,
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[langfuse] Prompt fetch failed (${resp.status}):`, text);
      return null;
    }

    const data = await resp.json();
    const promptText = data.prompt;
    const version = data.version;

    // Update cache
    promptCache.set(cacheKey, {
      text: promptText,
      version,
      fetchedAt: Date.now(),
    });

    console.log(`[langfuse] Fetched prompt: ${name} v${version}`);
    return { text: promptText, version };
  } catch (e) {
    console.error("[langfuse] Prompt fetch error (non-fatal):", e);
    return null;
  }
}

// --- Tracing ---

export interface LLMTraceParams {
  name: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  output: string | null;
  startTime: number;
  endTime: number;
  promptName?: string;
  promptVersion?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: string;
  metadata?: Record<string, unknown>;
}

// --- OTLP/HTTP JSON helpers (Langfuse v4 ingestion) ---

type OtlpAttribute = {
  key: string;
  value: { stringValue?: string; intValue?: string; boolValue?: boolean };
};

const strAttr = (key: string, value: string): OtlpAttribute => ({
  key,
  value: { stringValue: value },
});

const jsonAttr = (key: string, value: unknown): OtlpAttribute =>
  strAttr(key, JSON.stringify(value));

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const toNanos = (ms: number): string => (BigInt(Math.trunc(ms)) * 1_000_000n).toString();

/** Metadata attributes: string values as-is, everything else JSON-encoded. */
function metadataAttrs(prefix: string, metadata: Record<string, unknown>): OtlpAttribute[] {
  return Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => strAttr(`${prefix}.${k}`, typeof v === "string" ? v : JSON.stringify(v)));
}

/**
 * Send a trace (root span + generation child) to Langfuse via OTLP/HTTP.
 * Returns the trace ID (32-char hex) so callers can store it and attach scores later.
 * Non-fatal: errors are logged but never thrown.
 *
 * Trace-level attributes (trace name, metadata) are set on BOTH observations so
 * they can be filtered/aggregated on either. Overall input/output live on the
 * root observation.
 */
export async function traceLLMCall(params: LLMTraceParams, signal?: AbortSignal): Promise<string | null> {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log("[langfuse] No credentials set, skipping trace");
    return null;
  }

  const traceId = randomHex(16);

  try {
    const rootSpanId = randomHex(8);
    const generationSpanId = randomHex(8);
    const fullMessages = [
      { role: "system", content: params.systemPrompt },
      ...params.messages,
    ];
    const metadata = { model: params.model, ...(params.metadata || {}) };

    const traceAttrs: OtlpAttribute[] = [
      strAttr("langfuse.trace.name", params.name),
      ...metadataAttrs("langfuse.trace.metadata", metadata),
    ];

    const rootInput = {
      user_message: params.messages[params.messages.length - 1]?.content ?? "",
      conversation_history: params.messages.length > 1
        ? params.messages.slice(0, -1).filter((m) => m.role !== "system")
        : [],
      messages: fullMessages,
    };

    const rootSpan = {
      traceId,
      spanId: rootSpanId,
      name: params.name,
      kind: 1,
      startTimeUnixNano: toNanos(params.startTime),
      endTimeUnixNano: toNanos(params.endTime),
      attributes: [
        strAttr("langfuse.observation.type", "span"),
        ...traceAttrs,
        jsonAttr("langfuse.observation.input", rootInput),
        ...(params.output
          ? [jsonAttr("langfuse.observation.output", { content: params.output })]
          : []),
        ...metadataAttrs("langfuse.observation.metadata", metadata),
        ...(params.error
          ? [
              strAttr("langfuse.observation.level", "ERROR"),
              strAttr("langfuse.observation.status_message", params.error),
            ]
          : []),
      ],
    };

    const generationSpan = {
      traceId,
      spanId: generationSpanId,
      parentSpanId: rootSpanId,
      name: `${params.name}-llm`,
      kind: 1,
      startTimeUnixNano: toNanos(params.startTime),
      endTimeUnixNano: toNanos(params.endTime),
      attributes: [
        strAttr("langfuse.observation.type", "generation"),
        ...traceAttrs,
        strAttr("langfuse.observation.model.name", params.model),
        jsonAttr("langfuse.observation.input", { messages: fullMessages }),
        ...(params.output
          ? [strAttr("langfuse.observation.output", params.output)]
          : []),
        ...metadataAttrs("langfuse.observation.metadata", {
          ...(params.metadata || {}),
          ...(params.promptName
            ? { promptName: params.promptName, promptVersion: params.promptVersion }
            : {}),
        }),
        ...(params.usage
          ? [
              jsonAttr("langfuse.observation.usage_details", {
                input: params.usage.input_tokens ?? 0,
                output: params.usage.output_tokens ?? 0,
                total:
                  (params.usage.input_tokens || 0) +
                  (params.usage.output_tokens || 0),
              }),
            ]
          : []),
        ...(params.promptName && params.promptVersion !== undefined
          ? [
              strAttr("langfuse.observation.prompt.name", params.promptName),
              {
                key: "langfuse.observation.prompt.version",
                value: { intValue: String(params.promptVersion) },
              },
            ]
          : []),
        ...(params.error
          ? [
              strAttr("langfuse.observation.level", "ERROR"),
              strAttr("langfuse.observation.status_message", params.error),
            ]
          : []),
      ],
    };

    const body = {
      resourceSpans: [
        {
          resource: { attributes: [strAttr("service.name", "shapeshiftr-edge")] },
          scopeSpans: [
            {
              scope: { name: "shapeshiftr.langfuse" },
              spans: [rootSpan, generationSpan],
            },
          ],
        },
      ],
    };

    const auth = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);
    const resp = await fetch(`${LANGFUSE_HOST}/api/public/otel/v1/traces`, {
      signal,
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "x-langfuse-ingestion-version": "4",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[langfuse] Trace failed (${resp.status}):`, text);
    } else {
      console.log(`[langfuse] Trace recorded: ${params.name} (${traceId})`);
    }
  } catch (e) {
    console.error("[langfuse] Trace error (non-fatal):", e);
  }

  return traceId;
}

/**
 * Attach a numeric score to an existing trace (e.g. user feedback).
 * value: 1 = positive, -1 = negative, 0 = neutral/removed
 * Non-fatal: errors are logged but never thrown.
 */
export async function scoreTrace(
  traceId: string,
  value: number,
  name = "user-feedback",
  comment?: string,
): Promise<void> {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log("[langfuse] No credentials set, skipping score");
    return;
  }

  try {
    const auth = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);

    // Deterministic score ID so repeated feedback calls upsert rather than
    // create new scores (which Langfuse would average, giving fractional values).
    const idBytes = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(`${traceId}:${name}`),
    );
    const idHex = Array.from(new Uint8Array(idBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const scoreId = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-4${idHex.slice(13, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20, 32)}`;

    const body: Record<string, unknown> = { id: scoreId, traceId, name, value };
    if (comment) body.comment = comment;

    const resp = await fetch(`${LANGFUSE_HOST}/api/public/scores`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[langfuse] Score failed (${resp.status}):`, text);
    } else {
      console.log(`[langfuse] Score posted: ${name}=${value} for trace ${traceId}`);
    }
  } catch (e) {
    console.error("[langfuse] Score error (non-fatal):", e);
  }
}
