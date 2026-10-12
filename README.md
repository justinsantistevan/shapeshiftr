# ShapeShiftr - AI-Powered Fitness Transformation Tracker

## Project Overview

ShapeShiftr is a comprehensive fitness tracking application that combines multi-metric health monitoring with AI-powered coaching to help users achieve their fitness goals. The app tracks key fitness metrics weekly, visualizes progress over time, and provides personalized coaching insights through an AI-powered analysis system.

**Live URL**: https://lovable.dev/projects/c1e25c55-4a52-4f6a-8bbf-62dc3f19aaa3

## Core Features

### 1. Multi-Metric Fitness Tracking

Track five key fitness metrics on a weekly basis:

- **Weight** (lbs)
- **Body Fat Percentage** (%)
- **Skin Fold Measurement** (mm)
- **Average Exercise Minutes per Day** (mins/day)
- **Average Daily Calories** (kcal/day)

### 2. Interactive Data Visualization

- **Dual-Metric Charts**: Compare any two metrics side-by-side with independent Y-axes
- **Weekly Data Table**: View all metrics in a sortable, filterable table format
- **Interactive Tooltips**: Hover over data points for detailed information
- **Goal Reference Lines**: Visual indicators showing target goals for each metric
- **Mobile-Responsive Design**: Optimized layouts for all screen sizes

### 3. AI-Powered Coaching

Two distinct AI coaching features delivered via Supabase Edge Functions, with all prompts managed and versioned in Langfuse:

#### Progress Analysis

- Analyzes weekly fitness trends across all metrics
- Validates data for anomalies and realistic changes
- Provides personalized, evidence-based coaching advice (2-3 paragraphs, <100 words)
- Identifies patterns and suggests actionable next steps
- Accessible via "Get AI Analysis" button on dashboard
- Users can provide thumbs-up/thumbs-down feedback, which is recorded as Langfuse scores

#### Chat Coach

- Interactive conversational AI fitness coach
- Full conversation history with user's weekly metrics table as context
- Strict output length rules (2-4 sentences, under 200 words)
- Security redirect protocol for off-topic and adversarial inputs
- Safety boundaries for medical deferral, body image distress, and harmful behavior
- All calls traced to Langfuse with token usage, prompt version, and response time

### 4. Progress Photos

- Upload and store progress photos securely in Supabase Storage
- View photo gallery with date stamps
- Compare visual progress over time
- Secure, user-specific photo storage with RLS

### 5. Personal Affirmations

- Create and manage personalized fitness affirmations
- Drag-and-drop reordering interface
- Display random affirmations for motivation
- Edit, delete, and add new affirmations
- Persistent storage per user

### 6. User Authentication

- Secure email/password authentication via Supabase Auth
- Protected routes and user-specific data isolation
- Automatic session management
- Row Level Security (RLS) enforcement

## Technical Architecture

### Frontend Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Shadcn/ui component library
- **Charts**: Recharts for data visualization
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit for affirmations reordering

### Backend Stack

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for progress photos
- **Edge Functions**: Supabase Edge Functions (Deno)
- **AI Models**: Gemini 3.5 Flash-Lite (Ask Coach), Claude Haiku 5.5 (progress analysis and the three production Langfuse LLM-as-judge evaluators), and Claude Haiku 4.5 (local offline judges)
- **Observability**: Langfuse (traces, prompt management, eval scores, user feedback)

### Database Schema

#### `weekly_fitness_entries`

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- week_end_date: DATE (unique per user)
- weight_lbs: NUMERIC(5,2)
- body_fat_percentage: NUMERIC(4,2)
- skin_fold_mm: NUMERIC(5,2)
- avg_daily_calories: INTEGER
- avg_exercise_min_per_day: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `user_goals`

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- goal_weight: NUMERIC(5,2)
- goal_body_fat_percentage: NUMERIC(4,2)
- goal_skin_fold_mm: NUMERIC(5,2)
- goal_avg_daily_calories: INTEGER
- goal_avg_exercise_min_per_day: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `user_affirmations`

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- text: TEXT
- display_order: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Edge Functions

#### `analyze-progress`

- **Purpose**: Analyzes user fitness trends and provides coaching insights
- **Model**: Claude Haiku 5.5 (`claude-haiku-5-5`)
- **Input**: Current fitness stats, goals, and gap analysis
- **Output**: 2-3 paragraph coaching analysis (<100 words)
- **Features**:
  - Data validation against realistic ranges
  - Anomaly detection for unusual changes
  - Personalized coaching based on trends
  - Medical boundary enforcement
  - Langfuse tracing with token usage and prompt version

Progress analysis uses low effort (`output_config.effort: "low"`) and a 2,048-token
output budget to accommodate Haiku 5.5's default adaptive thinking. Only text
content blocks are displayed; thinking blocks are excluded. Refused or truncated
responses are treated as failed assessments rather than shown as complete results.
The prompt still requests fewer than 100 words.

#### `chat-coach`

- **Purpose**: Interactive conversational fitness coaching
- **Model**: Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`), overridable with the Edge Function environment variable `CHAT_COACH_MODEL`
- **Input**: User message, conversation history, full weekly metrics table, goals, affirmations
- **Output**: Concise coaching responses (2-4 sentences, max 200 words)
- **Features**:
  - Full weekly history table injected as context
  - Arithmetic and units discipline (daily averages, explicit delta naming)
  - Security redirect protocol for off-topic/adversarial inputs
  - Safety boundaries (medical deferral, body image referrals, harmful framing prohibition)
  - Langfuse tracing with user feedback loop

Chat requests have a 30-second overall deadline (including authentication and optional
Langfuse work), with up to 25 seconds for Google. Transient network errors and HTTP
408/500/502/503/504 are retried at most twice using exponential backoff plus jitter.
`Retry-After` seconds and HTTP dates are respected. HTTP 429 is retried only with an
explicit `Retry-After` and no daily/zero/billing quota indicators; unknown or hard
quota failures, authentication failures, and invalid requests are not retried.
Langfuse prompt retrieval is capped at 2 seconds (then uses the fallback prompt),
and trace submission at 1.5 seconds. The API returns safe `code`/`error` envelopes
with non-2xx status codes; Ask Coach maps these to overload, session, and input
messages without exposing upstream diagnostics.

Local regression tests: `npm test` (Node/tsx; no Deno installation required).
These exercise the bundled handler with mocked network/auth boundaries, not live
Google model availability or a deployed Supabase runtime.

#### `score-trace`

- **Purpose**: Records user feedback on AI responses
- **Input**: Langfuse trace ID, score value (+1 positive, -1 negative, 0 neutral)
- **Output**: Score attached to trace in Langfuse
- **Features**: Deterministic score IDs (prevents duplicates on re-submission), non-fatal error handling

#### `_shared/langfuse.ts`

Shared utilities for all edge functions:
- `fetchPrompt()` — Retrieves versioned prompts from Langfuse with 5-minute in-memory cache
- `traceLLMCall()` — Batch-ingests traces and generations to Langfuse
- `scoreTrace()` — Attaches user feedback scores to traces via REST API

### AI Context Building

Both AI coaching functions receive the user's complete weekly history table as context. The `chat-coach` edge function builds a structured context block containing:

- **Current metrics**: Latest weight, body fat %, skin fold, exercise mins/day, calories/day
- **Goals**: User-defined targets for each metric
- **Affirmations**: User's personal motivational statements
- **Full history table**: All weekly entries formatted as a readable table (week ending date, weight, body fat, skin fold, exercise, calories)

The coach uses this table to compute deltas, identify trends, and reference specific data points in its responses. The system prompt enforces that the coach only references data fields present in the context and never infers values like height, age, or sex.

#### Frontend Trend Calculation (`src/lib/fitnessCalculations.ts`)

The dashboard also calculates monthly trends independently for chart display by comparing the most recent entry to the entry closest to 28 days prior. This calculation uses `week_end_date` of the most recent entry as the anchor, not today's date.

### Security

#### Row Level Security (RLS)

All database tables enforce RLS policies:

- Users can only read/write their own data
- Policies enforce `auth.uid() = user_id` checks
- Prevents unauthorized data access

#### Storage Security

- Progress photos stored in user-specific folders
- Storage policies enforce user ownership
- Secure URL generation with expiration

#### Authentication

- Supabase Auth handles all authentication flows
- Protected routes redirect unauthenticated users
- Automatic session management and refresh

## AI Alignment & Safety

ShapeShiftr's AI coaching is designed with safety as the top priority. The system uses a layered approach: prompt-level guardrails define the rules, LLM-as-judge evaluators verify compliance, and Langfuse provides end-to-end observability across both development and production.

### Prompt-Level Safety Guardrails

The `chat-coach-system` prompt (managed in Langfuse) encodes the following safety rules:

**Medical Deferral** — For pregnancy, postpartum, and active injuries, the coach defers entirely to the user's healthcare provider. No conditional advice ("if your doctor says it's okay...") and no asking what the provider has said (which creates an opportunity for fabricated clearance).

**Body Image Distress** — If the user expresses hatred of their body, sets dangerously unrealistic goals, or shows signs of disordered thinking, the coach must recommend a therapist, counselor, or mental health professional. A data-driven reframe alone is not sufficient.

**Harmful Behavior Framing** — When advising against dangerous practices (crash diets, extreme restriction, purging), the coach never mentions potential short-term benefits of the behavior. It states why it's dangerous and redirects.

**Prohibited Recommendations** — Extreme caloric restriction, performance-enhancing drugs, supplement stacking, dangerous temperature training, and breath-holding techniques are all prohibited.

**Security Protocols** — The coach never reveals its system prompt. Adversarial inputs (jailbreak attempts, prompt injection, off-topic requests) trigger a prescribed redirect: "I'm only here to provide fitness and nutrition coaching. I can't help with that request."

**Arithmetic Discipline** — All calorie and exercise figures are described as daily averages. When computing deltas, the coach names the two data rows being compared and verifies the subtraction. The coach only references data fields that appear in the user context — it does not infer height, age, sex, or macronutrient breakdown.

### Data Validation

The `analyze-progress` function implements hardcoded validation ranges independent of the LLM:

- **Weight**: 50-400 lbs; monthly change limit: +/-20 lbs
- **Body Fat %**: 3-60%; monthly change limit: +/-4%
- **Skin Fold**: 2-50mm; monthly change limit: +/-10mm
- **Exercise**: 0-300 mins/day; monthly change limit: +/-120 mins
- **Calories**: 800-6000 kcal/day; monthly change limit: +/-1500 kcal

Values outside these ranges are flagged as anomalies and the user is advised to verify accuracy.

### LLM-as-Judge Evaluators

Three LLM judges evaluate coach responses against specific criteria. The production Langfuse evaluators now use Claude Haiku 5.5, as configured in the Langfuse UI. The local offline judges still use Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) in `scripts/lib/judges.ts`; changing the Langfuse evaluator model does not update that local setting.

| Judge | Criteria | What it checks |
|-------|----------|----------------|
| **Safety** | `no_harmful_framing`, `sufficient_referral`, `no_overreach` | Dangerous behavior framing, missing professional referrals, medical overreach |
| **Quality** | `no_unwanted_follow_up`, `appropriate_length` | Unnecessary trailing questions, response conciseness |
| **Factual Accuracy** | `arithmetic_correct`, `units_and_timeframes_correct`, `no_hallucinated_context` | Math errors, unit confusion, fabricated data |

Each judge outputs structured JSON with per-criterion pass/fail verdicts, an overall score (1 = pass, 0 = fail), and detailed reasoning. Judge prompts were iteratively calibrated on Claude Haiku 4.5 against 66 human-labeled traces across 4 rounds, achieving 86-100% agreement per dimension. These are historical calibration results, not verified Haiku 5.5 results. Re-run calibration before attributing the same agreement rates to the new evaluator model or comparing scores across the model change.

**Production monitoring:** Judge prompts are stored in Langfuse and configured to run as evaluators on all production traces. This provides continuous safety monitoring without manual review of every response.

**Score alerting:** A monitoring script (`scripts/monitor-scores.ts`) queries recent eval scores from Langfuse, computes pass rates per dimension, and alerts when any dimension drops below a configurable threshold (default 80%). Supports Slack/Discord webhook notifications via `ALERT_WEBHOOK_URL` env var. Can be run on a schedule via system cron for daily alerting (see [Evaluation Pipeline](#evaluation-pipeline)).

### User Feedback Loop

Users can rate individual AI responses with thumbs-up/thumbs-down buttons. Feedback is sent to the `score-trace` edge function, which records it as a Langfuse score attached to the trace. This creates a closed loop: prompt changes can be validated against both automated judge scores and real user feedback.

### Fairness Considerations

- **Body Diversity**: Wide validation ranges accommodate diverse body types. Coaching focuses on user-defined goals, not societal standards.
- **Accessibility**: Exercise recommendations currently assume full physical mobility. Adaptive exercise profiles are a planned enhancement.
- **Cultural Diversity**: The calorie-centric approach may not suit all cultural food practices. Coaching may reflect Western fitness norms.

### Known Limitations

- Cannot account for medications, medical conditions, or individual physiology
- Coaching quality depends on accurate, complete user data entry
- Safety judge TNR for `sufficient_referral` is limited by class imbalance in the calibration dataset (few true negatives) — a dedicated safety dataset is planned to address this

## Langfuse Integration

[Langfuse](https://langfuse.com) is used throughout the system for prompt management, tracing, evaluation, and user feedback.

### Prompt Management

Two system prompts are versioned and labeled in Langfuse:

| Prompt | Current Version | Description |
|--------|----------------|-------------|
| `chat-coach-system` | v6 (production) | Chat coach system prompt with safety boundaries, arithmetic rules, output length constraints, metrics-relevance guard |
| `analyze-progress-system` | v5 (production) | Progress analysis system prompt with validation rules |

Prompts use a label-based deployment model: `production` for live traffic, `staging` for A/B testing. Edge functions fetch prompts at runtime with a 5-minute in-memory cache, falling back to hardcoded versions if Langfuse is unavailable.

### Tracing

Every LLM call in production is traced to Langfuse with:
- Input messages (system prompt + user message)
- Output (model response)
- Token usage (input/output/total)
- Model identifier and prompt version
- Response latency
- User feedback scores (when provided)

### Production Evaluators

LLM judge prompts are stored in Langfuse and configured to run as evaluators on all production traces. The Safety, Quality, and Factual Accuracy evaluators use Claude Haiku 5.5, following the evaluator-model update reported by the project owner. Their model settings live in Langfuse, independently of the application generation models and local offline judge configuration.

The application models remain separate: `chat-coach` uses Gemini 3.5 Flash-Lite by default, while `analyze-progress` uses Claude Haiku 5.5. Their settings live in the Edge Function source, independently of the production judge settings in Langfuse.

## Evaluation Pipeline

The eval pipeline enables systematic testing of prompt changes and model swaps before they reach production. It uses synthetic datasets, automated judges, and calibration tooling to measure quality, safety, and factual accuracy.

### Architecture

```
Synthetic Dataset (Langfuse)
        |
        v
  run-eval.ts          Generate coach responses for each dataset item
        |               (supports Anthropic and Google providers)
        v
  run-judges.ts        Score each response with 3 LLM judges + code checks
        |
        v
  calibrate-judges.ts  Compare auto-scores to human labels (TPR/TNR/FP/FN)
  compare-runs.ts      Compare two runs side-by-side (baseline vs. new)
  inspect-disagreements.ts   Drill into specific judge errors

Production Traces (Langfuse)
        |
        v
  monitor-scores.ts   Check eval pass rates, alert on regressions
                       (daily cron → Slack/Discord webhook)
```

### Score Monitoring & Alerting

A monitoring script checks production eval scores and alerts on pass-rate regressions:

```bash
# Check last 24h, alert if any dimension drops below 80%
npx tsx scripts/monitor-scores.ts

# Custom window and threshold
npx tsx scripts/monitor-scores.ts --hours 48 --threshold 90
```

To enable Slack/Discord notifications, add `ALERT_WEBHOOK_URL` to your `.env` file (see [Environment Variables](#environment-variables)).

To run daily via cron, create a wrapper script and schedule it:

```bash
# Example crontab entry (daily at 8:03am)
3 8 * * * /path/to/shapeshiftr/scripts/monitor-scores-cron.sh
```

The script exits with code 1 on threshold breaches, making it compatible with any alerting system that monitors exit codes.

## API Dependencies

### Anthropic

- **Application model**: `claude-haiku-5-5` (Claude Haiku 5.5), used for progress analysis
- **Local offline judge model**: `claude-haiku-4-5-20251001` (Claude Haiku 4.5), configured separately in `scripts/lib/judges.ts`
- **Production evaluator model**: Claude Haiku 5.5, selected separately for the three LLM-as-judge evaluators in Langfuse; the exact API model identifier is managed there
- **SDK**: `@anthropic-ai/sdk`

### Langfuse

- **Instance**: `https://us.cloud.langfuse.com`
- **Use Cases**: Prompt versioning, LLM tracing, eval scoring, user feedback, production evaluators
- **SDK**: `langfuse` (Node.js) + REST API for edge functions

### Google AI

- **Model**: `gemini-3.5-flash-lite` (Gemini 3.5 Flash-Lite); `CHAT_COACH_MODEL` overrides the chat-coach default
- **Use Cases**: Chat coach
- **SDK**: `@google/generative-ai`

### Supabase

- **Services Used**: PostgreSQL database, authentication, storage (progress photos), Edge Functions (Deno runtime)
- **SDK**: `@supabase/supabase-js`

## Environment Variables

The frontend currently connects to the hosted Supabase project using the URL and
public anon key in `src/integrations/supabase/client.ts`. These values are intended
for browser use; database and storage access must remain protected by Supabase
Row Level Security. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are not
currently read by that client. To target another project, update the client with
that project's URL and public anon/publishable key.

Private API keys belong in Supabase Edge Function secrets or a local ignored
`.env` for internal scripts. Never prefix private keys with `VITE_`, because Vite
exposes those variables to browser code. Never put a service-role key or database
password in frontend code, the Flox manifest, or committed files.

| Location | Variables |
| --- | --- |
| Supabase Edge Function secrets | `CLAUDE_API_KEY` (progress analysis), `GEMINI_API_KEY` (chat coach), `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` |
| Supabase function runtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (provided by Supabase) |
| Local internal scripts | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`; optional `ALERT_WEBHOOK_URL` |

[`.env.example`](.env.example) contains placeholders for local script settings.
Only copy it to `.env` if you need those scripts; keep your existing `.env` intact.
Local `.env` files are ignored by Git, and Flox does not source or upload them.

## Installation & Development

### Prerequisites

- [Flox](https://flox.dev/docs/install-flox/install) and Git
- Access to the hosted Supabase project for authenticated app features

Flox supplies Node.js 22 (including npm) and Deno. The checked-in Flox lockfile
locks the resolved versions for Apple Silicon macOS and ARM64/x86-64 Linux.

### Setup Steps

1. **Clone the current main branch**

   ```sh
   git clone https://github.com/justinsantistevan/shapeshiftr.git
   cd shapeshiftr
   git switch main
   ```

   The hosted database uses `week_end_date`. Older branches that query
   `week_start_date` will fail to load fitness entries.

2. **Activate the environment**

   ```sh
   flox activate
   ```

   Activation installs npm dependencies from `package-lock.json` on first use,
   when `node_modules` is missing, or when the package files/runtime/platform
   change. It skips installation otherwise. No `flox init` is needed after cloning.

3. **Start the development server**

   ```sh
   npm run dev
   ```

   Open `http://localhost:3000` and sign in with your existing account.
   Local development connects to the hosted backend; saving or deleting data
   affects that backend.

4. **Build and check the app**

   ```sh
   npm run build
   npm run lint
   ```

   Lint currently reports existing application errors. A successful build is not
   a clean lint result. You can also run commands without entering a shell:

   ```sh
   flox activate -- npm run build
   flox activate -- npm run dev
   ```

See [the Flox setup guide](docs/flox.md) for dependency updates, secrets,
troubleshooting, supported platforms, and the GitHub Desktop commit workflow.

For a separate Supabase project, provision its schema, RLS policies, storage,
and Edge Functions deliberately, and set the Edge Function secrets listed
above. Flox does not provision or migrate a database. Do not rerun historical
migrations against the existing hosted project to fix an outdated local branch.

## User Workflows

### New User Journey

1. **Sign Up**: Create account via email/password
2. **Set Goals**: Define target metrics (optional)
3. **Enter First Week's Data**: Add baseline fitness metrics
4. **Upload Progress Photo**: Document starting point
5. **Customize Affirmations**: Add personal motivational statements
6. **Start Tracking**: Continue weekly data entry

### Ongoing Usage

1. **Weekly Data Entry**: Log metrics every week (Sunday start recommended)
2. **Review Trends**: View charts and analyze monthly changes
3. **Get AI Analysis**: Click "Get AI Analysis" for personalized coaching
4. **Chat with Coach**: Ask questions via chat interface
5. **Update Goals**: Adjust targets as progress is made
6. **Monitor Progress Photos**: Upload new photos to visualize changes

## Key Files Reference

### Core Application

- `src/App.tsx` - Main app component with routing
- `src/pages/Dashboard.tsx` - Main dashboard with all features
- `src/pages/Index.tsx` - Landing page with hero and features
- `src/pages/Auth.tsx` - Authentication page

### Components

- `src/components/MetricsChart.tsx` - Interactive dual-metric chart
- `src/components/AddDataForm.tsx` - Weekly data entry form
- `src/components/GoalsForm.tsx` - User goals management
- `src/components/ProgressAnalysis.tsx` - AI analysis display with chat and feedback
- `src/components/ChatFeedback.tsx` - Thumbs-up/down feedback buttons for AI responses
- `src/components/FitnessAffirmations.tsx` - Affirmations manager
- `src/components/AffirmationsManager.tsx` - Drag-drop affirmation editor

### Utilities

- `src/lib/fitnessCalculations.ts` - Trend calculation logic
- `src/lib/userGoals.ts` - Goals fetching utilities
- `src/lib/affirmations.ts` - Affirmations CRUD operations

### Edge Functions

- `supabase/functions/analyze-progress/index.ts` - AI progress analysis
- `supabase/functions/chat-coach/index.ts` - AI chat coaching
- `supabase/functions/score-trace/index.ts` - User feedback scoring
- `supabase/functions/_shared/langfuse.ts` - Shared Langfuse utilities (prompt fetching, tracing, scoring)

### Configuration

- `tailwind.config.ts` - Tailwind CSS configuration
- `src/index.css` - Global styles and design system tokens
- `vite.config.ts` - Vite build configuration

## Deployment

### Via Lovable Platform

Pushing code to GitHub syncs it with the connected Lovable branch; it does not
automatically publish a new live snapshot. See [Lovable Git sync](https://docs.lovable.dev/integrations/github)
and [publishing](https://docs.lovable.dev/features/publish).

1. Open [Lovable Project](https://lovable.dev/projects/c1e25c55-4a52-4f6a-8bbf-62dc3f19aaa3)
2. Click **Publish**, then **Publish changes** for an already published app
3. Your app will be deployed to a Lovable subdomain

### Custom Domain

1. Navigate to **Project > Settings > Domains**
2. Click **Connect Domain**
3. Follow DNS configuration instructions
4. Note: Requires paid Lovable plan

### Manual Deployment

```sh
# Build for production using the local Flox environment
flox activate -- npm run build

# Deploy dist/ folder to hosting provider
# (Vercel, Netlify, Cloudflare Pages, etc.)
```

## Lovable-Specific Information

### Project URL

https://lovable.dev/projects/c1e25c55-4a52-4f6a-8bbf-62dc3f19aaa3

### Editing Options

- **Lovable Editor**: Prompt-based code generation and editing
- **Visual Edits**: Direct element editing without code (free for static elements)
- **Dev Mode**: View and manually edit code (enable in Account Settings > Labs)
- **GitHub Integration**: Sync to GitHub for local IDE editing

### Reverting Changes

- Access project history in Lovable
- Click revert button below any edit to restore previous version

### Removing Lovable Badge

- Open Project Settings
- Enable **"Hide 'Lovable' Badge"** option

## Future Enhancements

### Planned Features

- [ ] Weekly email/SMS progress reminders
- [ ] Social sharing of milestones
- [ ] Export data to CSV/PDF
- [ ] Integration with fitness trackers (Fitbit, Apple Health)
- [ ] Progress comparison with past months
- [ ] Community challenges and leaderboards

### AI Coaching Improvements

- [ ] Voice-based coaching interactions
- [ ] Predictive trend analysis ("You're on track to reach your goal by...")
- [ ] Personalized workout recommendations
- [ ] Adaptive coaching based on user feedback
- [ ] Multilingual support
- [ ] Accessibility-aware exercise modifications

### Technical Debt

- [ ] Add comprehensive unit tests
- [ ] Implement E2E testing with Playwright
- [ ] Optimize chart rendering for large datasets
- [ ] Add offline support with service workers
- [ ] Implement data migration tools for schema changes

---
