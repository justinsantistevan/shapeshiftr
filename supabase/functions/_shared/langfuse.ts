// Langfuse tracing + prompt management for Supabase Edge Functions
// Uses Langfuse REST API directly (no npm dependencies needed)

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

/**
 * Send a trace + generation to Langfuse's batch ingestion endpoint.
 * Returns the traceId so callers can store it and attach scores later.
 * Non-fatal: errors are logged but never thrown.
 */
export async function traceLLMCall(params: LLMTraceParams): Promise<string | null> {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log("[langfuse] No credentials set, skipping trace");
    return null;
  }

  const traceId = crypto.randomUUID();

  try {
    const generationId = crypto.randomUUID();

    const events = [
      {
        id: crypto.randomUUID(),
        type: "trace-create",
        timestamp: new Date(params.startTime).toISOString(),
        body: {
          id: traceId,
          name: params.name,
          input: {
            user_message: params.messages[params.messages.length - 1]?.content ?? "",
            messages: [
              { role: "system", content: params.systemPrompt },
              ...params.messages,
            ],
          },
          output: params.output ? { content: params.output } : undefined,
          metadata: {
            model: params.model,
            ...params.metadata,
          },
        },
      },
      {
        id: crypto.randomUUID(),
        type: "generation-create",
        timestamp: new Date(params.startTime).toISOString(),
        body: {
          id: generationId,
          traceId,
          name: `${params.name}-llm`,
          model: params.model,
          startTime: new Date(params.startTime).toISOString(),
          endTime: new Date(params.endTime).toISOString(),
          input: {
            messages: [
              { role: "system", content: params.systemPrompt },
              ...params.messages,
            ],
          },
          output: params.output || undefined,
          metadata: {
            ...(params.metadata || {}),
            ...(params.promptName
              ? { promptName: params.promptName, promptVersion: params.promptVersion }
              : {}),
          },
          usage: params.usage
            ? {
                input: params.usage.input_tokens,
                output: params.usage.output_tokens,
                total:
                  (params.usage.input_tokens || 0) +
                  (params.usage.output_tokens || 0),
              }
            : undefined,
          ...(params.promptName
            ? {
                promptName: params.promptName,
                promptVersion: params.promptVersion,
              }
            : {}),
          statusMessage: params.error || undefined,
          level: params.error ? "ERROR" : "DEFAULT",
        },
      },
    ];

    const auth = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);
    const resp = await fetch(`${LANGFUSE_HOST}/api/public/ingestion`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch: events }),
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
