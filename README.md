# IT Helpdesk Pro

A modern, AI-powered IT ticketing system with a Faveo-style agent console,
backed by a real Supabase (Postgres) database: persistent sidebar navigation,
multi-staff accounts, departments, internal notes, and SLA-tracked tickets.
Two sides, one app:

- **Employee portal** (no login) — submit a request as an internal employee
  or external contact, with department, email/phone, and AI-suggested fixes
  before you even send it.
- **Agent console** (login) — sidebar workspace with a Dashboard, Tickets
  queue, Reports, Knowledge Base, and (for admins) Departments + Staff
  account management.

Data is stored in your own Supabase project, so it's shared across every
device and browser, not just whoever submitted the ticket.

---

## Set up Supabase (one time)

### 1. Create or open a Supabase project
Go to [supabase.com](https://supabase.com) and create a free project (or use
an existing one).

### 2. Run the schema
In your Supabase project: **SQL Editor -> New query**, paste the entire
contents of `supabase_schema.sql` (included in this folder), and click **Run**.
This creates the `tickets`, `comments`, `departments`, and `agents` tables,
sets up access policies, and seeds default departments plus the admin login.

### 3. Add your project keys
In Supabase: **Settings -> API**, copy the **Project URL** and the
**anon / publishable key**. Copy `.env.example` to a new file named `.env`
in this folder and fill both in:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```
`.env` is gitignored — never commit it or share it publicly.

---

## Run it

### 1. Open the folder in VS Code
File -> Open Folder -> select `it-helpdesk-pro`.

### 2. Open the terminal
Terminal -> New Terminal.

### 3. Install and start
```bash
npm install
npm run dev
```
Open the link it prints (usually http://localhost:5173). You'll see the employee portal.

---

## Logging in as IT
Click **"IT staff"** (top right), then sign in with the default admin account:
- **Username:** `admin`
- **Password:** `admin123`

Once signed in as admin, go to **Administration -> Staff Accounts** to create
IT staff logins for your team (see below).

---

## What's new in Pro

### Employee request form
- **Department picker** — internal employees choose their own department
  (IT, HR, Finance, Operations, Sales, etc.) from a list the admin manages.
- **Internal vs. external requester** — a clear toggle for whether the person
  filing the ticket is an employee or someone outside the company (a vendor,
  contractor, or visitor), with a free-text field for their company/role.
- **Email or phone** — either works as a contact method; the form only
  requires at least one.

### Admin-managed staff accounts (up to 3 IT staff + the admin)
Go to **Administration -> Staff Accounts**. The plan ships with room for the
founding admin account plus **3 IT staff seats**. For each staff account you
set a name, email, username, temporary password, and role (Agent or Admin).
Staff can be deactivated (kept on record, blocked from logging in) or removed
entirely. The login screen authenticates against these real accounts instead
of one hardcoded password.

### Departments admin
**Administration -> Departments** lets you add, rename, or remove the
departments employees pick from on the request form.

### Faveo-style agent console
- Persistent sidebar with **Dashboard, Tickets, Reports, Knowledge Base**, and
  admin-only **Departments / Staff Accounts** sections — modeled after Faveo's
  agent panel layout.
- **Dashboard widgets**: My Tickets, Unassigned, Overdue, Due Today — click
  any widget to jump straight into a filtered ticket list, the same pattern
  Faveo uses on its agent dashboard.
- **Ticket assignment** now pulls from your real staff list, and new tickets
  auto-route to whichever active agent currently has the lightest open load.
- **Internal notes vs. public replies** — toggle "Internal note" on a reply to
  keep it visible to agents only, separate from messages meant for the
  requester (mirrors Faveo's internal-notes feature).
- **Reports** tab adds tickets-by-department and tickets-by-agent breakdowns
  alongside the existing category/priority/SLA/automation metrics.
- Ticket detail now shows a full requester contact card (name, internal/
  external badge, department, email, phone) and supports deleting a ticket.

---

## The AI features (all free, on-device)

**On the employee portal**
- **Self-service deflection** — as someone describes the problem, matching
  knowledge-base articles appear ("You might fix this now") with step-by-step fixes.
- **Auto-triage on submit** — AI sets the category, priority, tags, and detects
  urgency/sentiment from the wording, so tickets arrive already sorted and
  routed to the least-loaded agent.

**In the agent console**
- **AI summary** on every ticket — a one-line TL;DR plus tags and a sentiment read.
- **Suggested replies** — click "Suggest a reply" and AI drafts a contextual response
  built from the ticket and the knowledge base. Edit it, then send.
- **SLA tracking** — each priority has a response target (Critical 2h, High 8h,
  Medium 24h, Low 72h). Tickets show "Due in Xh", "Due <1h", or "Overdue".
- **Reports tab** — automation rate, average first reply, SLA-met %, tickets by
  category/priority/department/agent, and the full knowledge base.

**How the AI works:** a rule-based engine in `src/ai.js` (keyword + knowledge-base
matching). It's genuinely free, instant, private (nothing leaves the browser), and
needs zero setup.

### Want fully generative AI (real LLM)?
`src/ai.js` is built as clean seams. In `generateReply()` there's a marked spot —
replace its body with a call to Claude, OpenAI, Groq, or Gemini and you get
fully generative replies. Everything else stays the same. (That step needs an
API key from the provider.)

### Edit the knowledge base
Open `src/ai.js` and edit the `KB` array — add your own articles, keywords, and
steps. The portal suggestions, agent suggestions, and AI replies all use it.

---

## Good to know
- **Data lives in your Supabase project**, so it's shared across every device
  and browser — a ticket submitted from a phone shows up instantly for an
  agent on a laptop.
- **Passwords are stored in plain text** in the `agents` table for simplicity
  in this demo (see `supabase_schema.sql`). Anyone with your anon key can read
  that table. Before real staff rely on this, migrate to Supabase Auth
  (`supabase.auth.signInWithPassword`) and drop the password column — see the
  notes at the bottom of `supabase_schema.sql`.
- **Row Level Security is wide open** right now (`using (true)` on every
  table) so the public ticket form can work without a login. Tighten these
  policies once you add real authentication.
- **Never commit your `.env` file or share your keys in chat/screenshots.**
  The anon/publishable key is meant to be used in client-side code, but
  treat it like any other credential — rotate it in Supabase if you think
  it's been exposed (Settings -> API -> regenerate).

## Deploy it free online (optional)
Push the folder to GitHub -> import at https://vercel.com. Add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in
the Vercel project settings (not in the repo) -> you get a live URL.
