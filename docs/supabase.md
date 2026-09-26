# Supabase setup

Everything here is a one-time setup. After it, sign-up, sign-in, Google, and
GitHub all work, and every user's data lives in Postgres with row level
security switched on.

- [What changed](#what-changed)
- [1. Create the database tables](#1-create-the-database-tables)
- [2. Get your keys](#2-get-your-keys)
- [3. Configure the URL allowlist](#3-configure-the-url-allowlist)
- [4. Google sign-in](#4-google-sign-in)
- [5. GitHub sign-in](#5-github-sign-in)
- [6. Email confirmations and password reset](#6-email-confirmations-and-password-reset)
- [7. Wire up the local environment](#7-wire-up-the-local-environment)
- [8. Verify it works](#8-verify-it-works)
- [API keys for agents](#api-keys-for-agents)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## What changed

**Backend** (`webcrawler/supabase.py`, `webcrawler/auth.py`)

| Concern | Where | How |
| --- | --- | --- |
| Verify the session | `supabase.decode_token` | RS256 against Supabase's JWKS, checking `exp`, `aud`, `iss` |
| Read/write user rows | `supabase.SupabaseStore` | PostgREST with the service role key |
| Auth routes | `auth.build_auth_router` | `/api/auth/*` and `/api/me/*` |
| Search history | `/search` background task | mirrored to Postgres when a caller is signed in |
| Crawl history | `_sync_crawl_run` | finished crawls attributed via `crawl_jobs.user_id` |

**Frontend** (`frontend/src/lib/supabase.ts`, `frontend/src/lib/auth.ts`)

Sign-up, sign-in, OAuth, and session refresh all run through
`@supabase/supabase-js` in the browser. The API never sees a password. It
receives the resulting signed access token and verifies it.

---

## 1. Create the database tables

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and pick your
   project.
2. In the sidebar, go to **SQL Editor** and click **New query**.
3. Paste the whole contents of
   [`supabase/migrations/0001_auth_and_storage.sql`](../supabase/migrations/0001_auth_and_storage.sql).
4. Click **Run**.

You should see `Success. No rows returned`. The script is idempotent, so
running it twice is harmless.

It creates five tables, all with RLS:

| Table | Holds |
| --- | --- |
| `public.profiles` | display name, avatar, which provider signed you in |
| `public.search_history` | every query you run while signed in |
| `public.crawl_runs` | crawl jobs started by you, with status |
| `public.api_keys` | hashed developer keys |
| `public.user_credentials` | third-party secrets, encrypted by pgcrypto |

It also installs a trigger on `auth.users` that creates a `profiles` row the
moment anyone signs up — by email, Google, or GitHub — and backfills profiles
for anyone who already existed.

### Prefer the CLI?

If you use the Supabase CLI, link the project and push instead:

```bash
supabase login
supabase link --project-ref iobihxckllduufthmybi
supabase db push
```

---

## 2. Get your keys

**Project Settings → API Keys** (or the older **API** section).

| Key | Where it goes | Safe to expose? |
| --- | --- | --- |
| Project URL | both `.env` files | Yes |
| Publishable key (`sb_publishable_…`) | both `.env` files | **Yes.** RLS is what protects the data, not the key |
| Secret key (`sb_secret_…`) | root `.env` only | **No.** Bypasses RLS |

You already have the URL and the publishable key:

```
NEXT_PUBLIC_SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3
```

**You still need to create a secret key.** Click **Create new secret key**, give
it a name like `webcrawler-api`, and copy the `sb_secret_…` value. Without it
sign-in still works, but every write to Postgres is rejected by RLS — profiles
will not be created, API keys cannot be minted, and history will not save.

The backend refuses to treat a publishable key as a service role key on
purpose, so a misconfiguration fails loudly instead of silently losing writes.

---

## 3. Configure the URL allowlist

**Authentication → URL Configuration**.

Set **Site URL** to your production origin, then add every origin you develop
from. The app redirects to `<origin>/auth/callback`, so **that exact path** is
what you allowlist.

| Purpose | Value to add |
| --- | --- |
| Vite dev server | `http://localhost:3000/auth/callback` |
| Production (FastAPI serves the built bundle) | `https://your-domain.com/auth/callback` |
| Local backend serving the built bundle | `http://localhost:8000/auth/callback` |

Add both dev entries while developing. Supabase rejects any redirect target
that is not on this list, which is why a fresh install often lands on an
error page after clicking "Continue with Google".

Optionally relax it further for local work: set **Redirect URLs** to
`http://localhost:3000/**` to cover every path.

---

## 4. Google sign-in

### 4a. Create the OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) →
   **APIs & Services** → **Credentials**.
2. **Create credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Under **Authorized redirect URIs** add:
   ```
   https://iobihxckllduufthmybi.supabase.co/auth/v1/callback
   ```
   This is the Supabase callback, not yours — Supabase receives Google's
   response and forwards it to your app.
5. Under **Authorized JavaScript origins** add your app origins:
   ```
   http://localhost:3000
   https://your-domain.com
   ```
6. Save, then copy the **Client ID** and **Client secret**.

If you have not already, enable **Google+ APIs** (now called *Google Identity
Platform API*) for the project.

### 4b. Register it with Supabase

**Authentication → Sign In / Providers → Google**, then either paste the
client ID and secret manually, or toggle on **Use Google OAuth** and paste
them into the fields that appear.

- **Client ID**: from step 4a
- **Client Secret**: from step 4a
- Leave **Skip Nonce Check** off.

Click **Save**.

### 4c. Test it

Sign out, click **Continue with Google**, and confirm you land back on
`/account`.

<details>
<summary>Troubleshooting</summary>

**"Error 400: redirect_uri_mismatch"**
The URI in the Google console does not exactly match the one Supabase sent.
It must be `<project-ref>.supabase.co/auth/v1/callback` — note `/auth/v1/callback`,
not `/auth/callback`.

**Google says the app is unverified**
Expected for a brand-new OAuth client. Google shows a warning screen the first
time; the user can continue through it. To remove the warning you must submit
the app for verification, which needs a verified domain and a privacy policy
page.

**`access_denied` / consent screen issues**
If the Google Cloud project has an OAuth consent screen configured with a test
user list, only those accounts can sign in. Add your account under
**Google Auth Platform → Test users**, or publish the consent screen.

</details>

---

## 5. GitHub sign-in

### 5a. Create the OAuth app

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
   → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: `WebCrawler`
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**:
     ```
     https://iobihxckllduufthmybi.supabase.co/auth/v1/callback
     ```
3. **Register application**, then **Generate a new client secret**.

### 5b. Register it with Supabase

**Authentication → Sign In / Providers → GitHub**, enable it, and paste:

- **Client ID**: from step 5a
- **Client Secret**: the secret you just generated

Click **Save**.

### 5c. Test it

Sign out, click **Continue with GitHub**, authorize, and confirm you return to
`/account` with your GitHub display name.

<details>
<summary>Troubleshooting</summary>

**`redirect_uri_mismatch`**
Recheck the callback URL in the GitHub OAuth app. It is
`<project-ref>.supabase.co/auth/v1/callback` and must match byte for byte.

**Signed in but the name is the email prefix**
GitHub does not return a `full_name` unless the `read:user` scope is granted.
The app requests it; if a user previously denied consent, sign out, clear
cookies for the site, and try again.

**Email is null**
This happens for a GitHub account with no verified primary email. Add one in
your GitHub account settings, or link an email in the account page.

</details>

---

## 6. Email confirmations and password reset

**Authentication → Sign In / Providers → Email**.

| Setting | Recommendation |
| --- | --- |
| **Enable Email provider** | On (required for email/password) |
| **Confirm email** | On for anything public. Off is fine for local dev. |
| **Email OTP** | Optional; this app does not use it. |

Both email flows redirect to `<origin>/auth/callback`, which is already on the
allowlist. The app then shows either a confirmation notice or a new-password
form, depending on the link.

To customise the emails, edit the templates under **Authentication → Emails**.
Keep the `{{ .ConfirmationURL }}` variable; add a **Redirect To** of
`{{ .Site URL }}/auth/callback` if the template does not already include one.

With **Confirm email** off, sign-up returns a session immediately and the user
lands on `/account` with no round trip through email.

---

## 7. Wire up the local environment

### Backend — root `.env`

```bash
cp .env.example .env
```

Then fill in the secret key:

```ini
SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co
SUPABASE_ANON_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# Optional, only needed for the "Stored credentials" panel
WEBCRAWLER_CREDENTIAL_KEY=<python -c "import secrets; print(secrets.token_urlsafe(48))">
```

`.env` is gitignored. Never commit the secret key.

### Frontend — `frontend/.env`

```bash
cp frontend/.env.example frontend/.env
```

```ini
VITE_SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3
```

Only the publishable key goes here. Vite inlines every `VITE_*` value into the
JavaScript bundle, so a secret key in this file would be published to every
visitor.

### Run it

```bash
pip install -e ".[dev]"     # picks up pyjwt[crypto]
cd frontend && npm install
cd .. && webcrawler serve --data-dir data
```

Then open <http://localhost:3000> for the Vite dev server (which proxies
`/api` to the backend) or <http://localhost:8000> for the backend serving the
built bundle.

Restart the Vite dev server after any `.env` change — it reads them at startup
and does not hot-reload them.

### Docker

`docker build` needs the frontend keys as build arguments, since they are
compiled in:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3 \
  -t webcrawler .

docker run -p 8000:8000 \
  -e SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co \
  -e SUPABASE_ANON_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3 \
  -e SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
  webcrawler
```

---

## 8. Verify it works

```bash
# Is the backend configured, and is the secret key present?
curl -s http://localhost:8000/health | python -m json.tool
```

```json
{
  "status": "ok",
  "frontend": "react",
  "auth": {
    "configured": true,
    "missing": []
  }
}
```

`"storage_ready": true` from `/api/auth/config` is the check that the **secret
key** is wired up, not just the publishable one:

```bash
curl -s http://localhost:8000/api/auth/config | python -m json.tool
```

Then in the browser:

1. Sign up with an email and password → you should land on `/account`.
2. Sign out, sign in with **Continue with Google**.
3. Sign out, sign in with **Continue with GitHub**.
4. On `/account`, create an API key and confirm the plaintext appears exactly
   once.
5. Run a search while signed in, then reload `/account` — the query should be
   in **Recent search queries**, read back from Postgres.

Inspect the tables under **Table Editor** in the dashboard to confirm rows
landed in `public.profiles` and `public.search_history`.

---

## API keys for agents

The **Are you an AI agent?** link on the sign-in page points at the key
generator. Mint a key on `/account` and send it as a header:

```bash
curl -s "http://localhost:8000/search?q=vector+search&limit=5" \
  -H "X-API-Key: wck_your_key_here"
```

A valid key resolves to its owner, so the search is attributed to that account
and stored in their history. Keys carry scopes (`search`, `crawl`); a key
missing the required scope gets a 403, and a revoked or expired key gets a 401.

```bash
# Create one without a browser
curl -s -X POST http://localhost:8000/api/me/api-keys \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci","scopes":["search"]}'
```

Only a SHA-256 hash of the key is stored, so a lost key cannot be recovered —
create a new one. `GET /api/me/api-keys` returns the first few characters for
identification and never the secret.

---

## Security notes

- **Passwords never touch this app.** Supabase Auth hashes them with bcrypt.
  The frontend posts them straight to Supabase over TLS and keeps only the
  resulting JWT.
- **The publishable key is designed to be public.** RLS is the actual boundary:
  every policy is `auth.uid() = user_id`, so a signed-in browser can only read
  its own rows even with a stolen key.
- **The secret key bypasses RLS.** It exists only in the backend's environment.
- **API keys are hashed at rest.** The plaintext is returned once at creation.
- **Stored credentials are encrypted inside Postgres** by
  `pgp_sym_encrypt` with `WEBCRAWLER_CREDENTIAL_KEY`. The passphrase is never
  persisted, so losing it makes those rows permanently unreadable — by design.
- **Rate limiting is unchanged** at 10 crawl requests per hour per IP.

---

## Troubleshooting

**`"Supabase is not configured"` on the sign-in page**
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing from
`frontend/.env`, or the dev server has not been restarted since you added it.

**`{"configured": false, "missing": ["SUPABASE_SERVICE_ROLE_KEY"]}`**
`missing` lists the variables the backend cannot see. Check the root `.env`.

**Sign-in works but `/account` shows an error about the service role key**
`SUPABASE_SERVICE_ROLE_KEY` is unset, or set to a publishable key. The API
deliberately rejects that rather than letting RLS swallow the write.

**`404` on `relation "public.profiles" does not exist`**
The SQL from step 1 was not run, or was run in a different project than the one
in `.env`. Compare the project ref.

**Every table is empty even though sign-in worked**
The signup trigger is missing. Re-run the migration; it uses
`create or replace function` and `drop trigger if exists`, so it is safe to
re-apply.

**Google/GitHub loops back to the login page**
The redirect URL is not allowlisted. See [step 3](#3-configure-the-url-allowlist).
The URL must be exact, including `/auth/callback` and no trailing slash.

**`invalid claim: missing sub claim`**
An old-format token without a subject reached the API. Sign out and back in to
get a freshly issued token.
