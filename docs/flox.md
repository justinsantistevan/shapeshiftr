# Developing ShapeShiftr with Flox

## Start from a fresh clone

Install [Flox](https://flox.dev/docs/install-flox/install), then:

```sh
git clone https://github.com/justinsantistevan/shapeshiftr.git
cd shapeshiftr
git switch main
flox activate
npm run dev
```

Open http://localhost:3000. The checked-in environment is ready to activate:
**do not run `flox init` or import the old bootstrap manifest**.

The frontend uses the hosted Supabase URL and public anon key in
`src/integrations/supabase/client.ts`; its current implementation does not read
`VITE_SUPABASE_*` variables. Use your existing account. Local app writes affect
that hosted project. Older branches using `week_start_date` do not match the
current database's `week_end_date` column.

## What Flox manages

- Node 22 with npm for Vite/React/TypeScript.
- Deno for Supabase Edge Function development.
- A dependency hook that runs `npm ci` on first activation or when package files,
  Node version, platform or architecture change, or `node_modules` is missing.
- A local dependency fingerprint under `.flox/cache`; subsequent activations
  skip installation when it matches.

The lockfile currently resolves Node 22.23.3 and Deno 2.9.7 for
`aarch64-darwin`, `aarch64-linux`, and `x86_64-linux`. macOS Apple Silicon has been
exercised locally; Linux resolutions are locked but have not been run here.
Windows users can use a Linux environment such as WSL. Intel macOS is outside
this environment's default platform set and has not been verified.

## Commands

```sh
flox activate -- node --version
flox activate -- deno --version
flox activate -- npm run build
flox activate -- npm run lint
flox activate -- npm run dev
```

Lint has existing application errors. `npm ci` and a production build have passed
using the installed Flox Node/npm toolchain. The dashboard has been checked for
metrics, photos and progress analysis against the hosted backend.

## Dependency updates

npm manages JavaScript dependencies; Flox manages system runtimes.

```sh
# In an activated environment, after intentionally changing package.json:
npm install
npm run build
# Commit package.json and package-lock.json together when both change.
```

Use `flox edit` to edit the active manifest and `flox upgrade` to intentionally
refresh runtime packages. Review and commit resulting manifest/lockfile changes.
Remove `node_modules` and activate again to force a clean dependency installation.
The first activation can replace an existing `node_modules` directory.

npm is the supported setup path here. Existing Bun and pnpm lockfiles are retained;
they are not synchronized by npm and should not be mixed into this workflow.

## Secrets and backend setup

Flox does not source `.env`, embed secrets in its manifest, apply migrations,
change RLS, provision a Supabase project, or deploy Edge Functions.

Private provider keys belong in Supabase Edge Function secrets. Their names in
the current source are `CLAUDE_API_KEY` and `GEMINI_API_KEY`, plus
`LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. Supabase provides the function's
`SUPABASE_URL` and `SUPABASE_ANON_KEY`. The local script example in `.env.example`
uses `ANTHROPIC_API_KEY` for scripts that expect that name.

Never put private credentials in frontend code or `VITE_` variables. Vite exposes
`VITE_` variables to browser code. The public Supabase anon key is expected to be
visible; RLS is what restricts access. Keep RLS enabled.

## Troubleshooting

- Missing column `week_start_date`: use the current `main` branch matching the
  backend schema; do not rename production columns to suit an old checkout.
- `npm ci` says the lockfile is out of sync: run `npm install` after reviewing
  the package changes, then commit the updated lockfile.
- Certificate errors: use your organization's trusted CA configuration. Do not
  disable TLS certificate validation.
- FloxHub authentication notices: local activation worked without login on the
  tested CLI; `flox auth login` is available if authentication is requested.
- Port 3000 already occupied: reuse the running server or stop it with Ctrl+C.

## Commit with GitHub Desktop

The expected changes for this environment migration are README.md, this guide,
.env.example, .gitignore, package-lock.json, and these five Flox files:

```text
.flox/.gitattributes
.flox/.gitignore
.flox/env.json
.flox/env/manifest.toml
.flox/env/manifest.lock
```

Select the prepared changes and use the summary **Add Flox development environment**.
Keep `.env`, local agent settings, `.flox/cache`, `.flox/run`, `.flox/log`,
`node_modules`, `dist`, and private internal docs/scripts out of the commit.

**Commit to main** records the commit locally. **Push origin** sends it to GitHub.
For Lovable hosting, the connected branch syncs into the editor; open the project
and choose **Publish → Publish changes** to update the live site. A separate
hosting provider may have its own automatic deployment rules. No deployment
workflow was added for this migration.

The commit changes development setup and fills missing entries in the npm
lockfile. It does not change frontend application source, package.json,
Supabase migrations, Edge Functions, permissions, or database records.
