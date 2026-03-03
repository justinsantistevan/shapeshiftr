

## Add Thumbs Up/Down Feedback UI to Progress Analysis

### Scope
Front-end only. No edge function or logging changes.

### Changes

**File: `src/components/ProgressAnalysis.tsx`**

- Add state: `analysisMessageId` (string), `analysisFeedback` ('positive' | 'negative' | 'none')
- Generate a new `analysisMessageId` via `crypto.randomUUID()` each time `fetchAnalysis` completes successfully
- Initialize `analysisFeedback` to `'none'` on each new fetch
- Add `handleAnalysisFeedback` handler that updates local state only (no DB calls for now)
- Render `<ChatFeedback>` below the analysis `ReactMarkdown` block, before the `<Separator>`:

```
<ChatFeedback
  messageId={analysisMessageId}
  currentFeedback={analysisFeedback}
  onFeedbackChange={handleAnalysisFeedback}
  isDisabled={isLoading}
/>
```

That's it — the feedback buttons will appear and toggle visually. You can wire up persistence and edge function metadata later.

