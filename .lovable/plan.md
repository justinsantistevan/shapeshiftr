

# Migrate Edge Functions from Lovable Gateway to Anthropic Claude API

## Problem
Both `analyze-progress` and `chat-coach` edge functions are still pointing to the Lovable AI Gateway (`ai.gateway.lovable.dev`) using `LOVABLE_API_KEY`. They need to be switched to call the Anthropic API directly using your `CLAUDE_API_KEY` (already configured in Supabase secrets).

## Changes Required

### 1. `supabase/functions/analyze-progress/index.ts`

- **API key**: Change from `LOVABLE_API_KEY` to `CLAUDE_API_KEY`
- **Model**: Set to `claude-haiku-4-5-20251001` (Claude Haiku 4.5)
- **Endpoint**: Change from `https://ai.gateway.lovable.dev/v1/chat/completions` to `https://api.anthropic.com/v1/messages`
- **Request format**: Switch from OpenAI format to Anthropic format:
  - Move system prompt to top-level `system` field
  - Use `max_tokens` parameter (required by Anthropic)
  - Set headers: `x-api-key`, `anthropic-version: 2023-06-01`
- **Response parsing**: Change from `data.choices[0].message.content` to `data.content[0].text`
- **Log messages**: Update "Lovable AI Gateway" references to "Anthropic API"

### 2. `supabase/functions/chat-coach/index.ts`

Same set of changes as above, plus:
- **Token usage mapping**: Update from OpenAI's `prompt_tokens`/`completion_tokens` to Anthropic's `input_tokens`/`output_tokens`
- **Conversation history format**: Anthropic requires alternating user/assistant roles and does not include system messages in the messages array -- the system prompt goes in the top-level `system` field

### Technical Details

Anthropic request structure:
```text
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <CLAUDE_API_KEY>
  anthropic-version: 2023-06-01
  Content-Type: application/json
Body:
  model: "claude-haiku-4-5-20251001"
  max_tokens: 1024
  system: "<system prompt>"
  messages: [{ role: "user", content: "..." }]
```

Anthropic response structure:
```text
{
  content: [{ type: "text", text: "..." }],
  usage: { input_tokens: N, output_tokens: N }
}
```

### 3. Deploy both functions

Both edge functions will be redeployed after the code changes.

