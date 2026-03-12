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
- **AI Models**: Gemini 3.1 Flash-Lite (chat coach) and Claude Haiku 4.5 (progress analysis, LLM judges) via Anthropic and Google AI APIs
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
- **Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Input**: Current fitness stats, goals, and gap analysis
- **Output**: 2-3 paragraph coaching analysis (<100 words)
- **Features**:
  - Data validation against realistic ranges
  - Anomaly detection for unusual changes
  - Personalized coaching based on trends
  - Medical boundary enforcement
  - Langfuse tracing with token usage and prompt version

#### `chat-coach`

- **Purpose**: Interactive conversational fitness coaching
- **Model**: Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite-preview`)
- **Input**: User message, conversation history, full weekly metrics table, goals, affirmations
- **Output**: Concise coaching responses (2-4 sentences, max 200 words)
- **Features**:
  - Full weekly history table injected as context
  - Arithmetic and units discipline (daily averages, explicit delta naming)
  - Security redirect protocol for off-topic/adversarial inputs
  - Safety boundaries (medical deferral, body image referrals, harmful framing prohibition)
  - Langfuse tracing with user feedback loop

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

Three LLM judges (all running Claude Haiku 4.5, the model they were calibrated on) evaluate every coach response against specific criteria. These judges run both offline during eval development and in production via Langfuse evaluator prompts on live traces.

| Judge | Criteria | What it checks |
|-------|----------|----------------|
| **Safety** | `no_harmful_framing`, `sufficient_referral`, `no_overreach` | Dangerous behavior framing, missing professional referrals, medical overreach |
| **Quality** | `no_unwanted_follow_up`, `appropriate_length` | Unnecessary trailing questions, response conciseness |
| **Factual Accuracy** | `arithmetic_correct`, `units_and_timeframes_correct`, `no_hallucinated_context` | Math errors, unit confusion, fabricated data |

Each judge outputs structured JSON with per-criterion pass/fail verdicts, an overall score (1 = pass, 0 = fail), and detailed reasoning. Judge prompts were iteratively calibrated against 66 human-labeled traces across 4 rounds, achieving 86-100% agreement per dimension.

**Production monitoring:** Judge prompts are stored in Langfuse and configured to run as evaluators on all live production traces. This provides continuous safety monitoring without manual review of every response.

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

LLM judge prompts are stored in Langfuse and configured to run as evaluators on all production traces. This means every live coach response is automatically scored for safety, quality, and factual accuracy — providing continuous monitoring without manual review.

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
```
## API Dependencies

### Anthropic

- **Model**: `claude-haiku-4-5-20251001` (Claude Haiku 4.5)
- **Use Cases**: Progress analysis, LLM-as-judge evaluators
- **SDK**: `@anthropic-ai/sdk`

### Langfuse

- **Instance**: `https://us.cloud.langfuse.com`
- **Use Cases**: Prompt versioning, LLM tracing, eval scoring, user feedback, production evaluators
- **SDK**: `langfuse` (Node.js) + REST API for edge functions

### Google AI

- **Model**: `gemini-3.1-flash-lite-preview` (Gemini 3.1 Flash-Lite)
- **Use Cases**: Chat coach (primary model — better eval scores, 40% lower latency, ~4x lower cost vs Haiku)
- **SDK**: `@google/generative-ai`

### Supabase

- **Services Used**: PostgreSQL database, authentication, storage (progress photos), Edge Functions (Deno runtime)
- **SDK**: `@supabase/supabase-js`

## Environment Variables

### Required Variables

```env
# Anthropic API (Edge Functions + Eval Scripts)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Langfuse (Edge Functions + Eval Scripts)
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=your_supabase_db_connection_string

# Vite Environment Variables (Frontend)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Google AI (Chat Coach)
GOOGLE_API_KEY=your_google_api_key
```

## Installation & Development

### Prerequisites

- Node.js 18+ and npm
- Supabase account (or Lovable Cloud enabled)
- Git

### Setup Steps

1. **Clone the repository**

   ```sh
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the project root:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run database migrations from `supabase/migrations/`
   - Enable Row Level Security on all tables
   - Create storage bucket for progress photos
   - Configure Edge Functions with `ANTHROPIC_API_KEY` and Langfuse keys

5. **Start development server**

   ```sh
   npm run dev
   ```

6. **Access the app**
   Open `http://localhost:5173` in your browser

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

1. Open [Lovable Project](https://lovable.dev/projects/c1e25c55-4a52-4f6a-8bbf-62dc3f19aaa3)
2. Click **Share → Publish**
3. Your app will be deployed to a Lovable subdomain

### Custom Domain

1. Navigate to **Project > Settings > Domains**
2. Click **Connect Domain**
3. Follow DNS configuration instructions
4. Note: Requires paid Lovable plan

### Manual Deployment

```sh
# Build for production
npm run build

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
