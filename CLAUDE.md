# Claude Instructions for shapeshiftr

## Langfuse MCP Tools

Langfuse MCP is installed and available. Use these tools proactively when debugging AI behavior, inspecting traces, managing prompts, or working with datasets.

**Before calling any Langfuse tool, load it first with `ToolSearch`** (e.g., `select:mcp__langfuse__fetch_traces`).

| Category | Tools | When to use |
|---|---|---|
| Traces | `fetch_traces`, `fetch_trace` | Inspect LLM call history, inputs/outputs, latency |
| Observations | `fetch_observations`, `fetch_observation` | Drill into spans/generations within a trace |
| Sessions | `fetch_sessions`, `get_session_details`, `get_user_sessions` | Analyze multi-turn conversations or user sessions |
| Exceptions | `find_exceptions`, `find_exceptions_in_file`, `get_exception_details`, `get_error_count` | Debug errors, find recurring failures in AI calls |
| Prompts | `list_prompts`, `get_prompt`, `get_prompt_unresolved`, `create_text_prompt`, `create_chat_prompt`, `update_prompt_labels` | View, create, or version prompts in Langfuse |
| Datasets | `list_datasets`, `get_dataset`, `list_dataset_items`, `get_dataset_item`, `create_dataset`, `create_dataset_item`, `delete_dataset_item` | Manage evaluation datasets and test cases |
| Schema | `get_data_schema` | Understand the structure of Langfuse data |

### When to reach for Langfuse tools

- User asks about AI trace data, logs, or LLM call history → `fetch_traces` / `fetch_trace`
- User reports an error or unexpected AI behavior → `find_exceptions`, `get_error_count`
- User wants to inspect or manage prompts → `list_prompts`, `get_prompt`, `create_*_prompt`
- User mentions sessions or multi-turn conversations → `fetch_sessions`, `get_session_details`
- User wants to create or review eval datasets → `list_datasets`, `create_dataset`
