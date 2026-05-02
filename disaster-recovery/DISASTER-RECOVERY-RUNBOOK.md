# 4D NDT Intelligence Platform — Disaster Recovery Runbook

**Owner:** Richard Johnston  
**Last Updated:** 2026-05-01  
**Platform Version:** FORGED-NDT/3.1.0  
**Engine Count:** 144 registered engines, 190 Netlify functions

---

## What This Document Covers

Step-by-step instructions to rebuild the entire 4D NDT Intelligence Platform from scratch if any or all of the following services become unavailable:

- **GitHub** (source code)
- **Supabase** (database, auth, storage)
- **Netlify** (hosting, serverless functions, DNS)

---

## Critical Assets Inventory

| Asset | Current Location | Backed Up In Repo? |
|-------|-----------------|-------------------|
| Application source code | GitHub repo | YES — git clone |
| 190 Netlify serverless functions | `netlify/functions/` | YES |
| React frontend | `src/` | YES |
| Static pages (landing, system-check) | `public/` | YES |
| Build config | `netlify.toml`, `package.json`, `tsconfig.json` | YES |
| SQL schema (154 tables) | `disaster-recovery/MASTER-SCHEMA.sql` | YES |
| Individual migrations | `supabase/migrations/` + root `*.sql` | YES |
| CFI seed data | `CFI-SCHEMA-SEED.sql` | YES |
| Environment variable template | `disaster-recovery/ENV-TEMPLATE.env` | YES |
| Actual secret values | Netlify dashboard + Supabase dashboard | **NO — store in password manager** |
| Supabase row data (cases, outcomes, learning) | Supabase database | **NO — see Backup Schedule below** |
| DNS records | Domain registrar + Netlify | **NO — document below** |
| SSL certificates | Netlify (auto-provisioned) | N/A (auto-regenerated) |

---

## IMMEDIATE ACTION: Secure Your Secrets Now

Before anything else, copy these values into a password manager:

1. Log into **Supabase Dashboard** → Settings → API
   - Copy: Project URL, anon key, service_role key
   - Copy: Database connection string (Settings → Database → Connection string)

2. Log into **Netlify Dashboard** → Site Settings → Environment Variables
   - Screenshot or copy ALL environment variables

3. Log into **OpenAI Platform** → API Keys
   - Copy your API key (or note that you can regenerate)

4. Log into **Anthropic Console** → API Keys
   - Copy your API key (or note that you can regenerate)

5. Log into your **domain registrar** (wherever 4dndt.com is registered)
   - Screenshot DNS records (nameservers, CNAME, A records)

6. **Clone the repo locally** if you haven't:
   ```bash
   git clone https://github.com/YOUR_USERNAME/NDT-Platform.git
   cd NDT-Platform
   ```

---

## Scenario 1: GitHub Goes Down

**Impact:** Cannot push code, cannot trigger deploys  
**Recovery time:** Minutes (you have local code)

### What to do:
1. Your local git clone has the FULL history. Nothing is lost.
2. To move to a new host (GitLab, Bitbucket, Codeberg):
   ```bash
   git remote add neworigin https://gitlab.com/YOUR_USERNAME/NDT-Platform.git
   git push neworigin main --all
   git push neworigin --tags
   ```
3. Update Netlify to pull from the new git remote:
   - Netlify Dashboard → Site Settings → Build & Deploy → Link to a different repository

### Prevention:
- Keep a local clone on your computer (updated weekly)
- Optionally mirror to a second git host:
  ```bash
  git remote add mirror https://gitlab.com/YOUR_USERNAME/NDT-Platform-mirror.git
  git push mirror main
  ```

---

## Scenario 2: Supabase Goes Down

**Impact:** Database unavailable, auth broken, no case data  
**Recovery time:** 1-2 hours for schema, depends on data volume

### What to do:

#### Option A: Wait for Supabase recovery
- Supabase has its own backups and SLA. Most outages resolve in hours.
- Your app will show errors but no data is lost on their end.

#### Option B: Stand up a new Supabase project
1. Create new project at https://supabase.com/dashboard
2. Run the master schema:
   ```bash
   psql "postgresql://postgres:YOUR_PASSWORD@db.NEW_PROJECT_ID.supabase.co:5432/postgres" \
     -f disaster-recovery/MASTER-SCHEMA.sql
   ```
3. Run validation queries:
   ```bash
   psql "CONNECTION_STRING" -f disaster-recovery/VALIDATION-QUERIES.sql
   ```
4. Run CFI seed data:
   ```bash
   psql "CONNECTION_STRING" -f CFI-SCHEMA-SEED.sql
   ```
5. Update environment variables in Netlify with new project URL and keys
6. Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and redeploy

#### Option C: Move to raw PostgreSQL (no Supabase)
1. Provision a PostgreSQL 15+ database (AWS RDS, DigitalOcean, Railway, Render)
2. Run `MASTER-SCHEMA.sql` against it
3. Replace `@supabase/supabase-js` client calls in functions with direct `pg` client
4. Set up your own auth (or use Clerk, Auth0, etc.)
5. This is a bigger migration but means zero vendor dependency

### Data Recovery:
- **If you have database backups** (see Backup Schedule): restore from latest
- **If no backups exist**: schema rebuilds clean, but case data / learning history is lost
- **Supabase Pro plan** includes daily backups with point-in-time recovery

### Prevention:
- **Set up weekly database exports** (see Backup Schedule section below)
- Consider Supabase Pro plan for automated daily backups

---

## Scenario 3: Netlify Goes Down

**Impact:** Site unreachable, functions unavailable  
**Recovery time:** 30-60 minutes on alternative host

### What to do:

#### Option A: Wait for Netlify recovery
- Netlify has strong uptime. Most outages are brief.

#### Option B: Deploy to alternative host

**Vercel (closest to Netlify):**
1. Install Vercel CLI: `npm install -g vercel`
2. Adapt `netlify.toml` to `vercel.json`:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "functions": { "runtime": "nodejs18.x" }
   }
   ```
3. Netlify functions need minor adaptation (different handler signature)
4. Set environment variables in Vercel dashboard
5. `vercel --prod`

**Render / Railway / Fly.io:**
1. These run as Node.js servers, not serverless
2. You'd wrap functions in an Express server
3. More work but fully vendor-independent

**Self-hosted (VPS):**
1. Provision Ubuntu 22 VPS (DigitalOcean, Hetzner, etc.)
2. Install Node 18, Nginx, Certbot
3. `npm install && npm run build`
4. Serve `dist/` via Nginx
5. Run functions as Express API server
6. Set up SSL with Certbot

### DNS Recovery:
1. Point your domain's DNS to the new host's IP/CNAME
2. TTL propagation takes 5-60 minutes depending on registrar

### Prevention:
- Keep deployment notes (this runbook)
- Consider a secondary deploy on Vercel as a warm standby

---

## Scenario 4: Total Loss (All Three Services Down)

**Recovery time:** 2-4 hours

1. **Code:** Restore from local git clone
2. **Database:** Stand up new PostgreSQL, run `MASTER-SCHEMA.sql`
3. **Hosting:** Deploy to Vercel, Render, or VPS
4. **Auth:** Reconfigure Supabase auth or switch to Clerk/Auth0
5. **DNS:** Point domain to new host
6. **Secrets:** Restore from password manager
7. **Verify:** Run system-check.html — expect 150 PASS / 0 FAIL

---

## Backup Schedule (SET THIS UP)

### Weekly: Database Export
```bash
# Export all data from Supabase
pg_dump "postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres" \
  --format=custom \
  --file="backups/ndt-platform-$(date +%Y%m%d).dump"
```

### Weekly: Git Mirror
```bash
cd NDT-Platform
git pull origin main
git push mirror main  # if you set up a mirror
```

### Monthly: Full Snapshot
1. Database export (as above)
2. Screenshot Netlify environment variables
3. Screenshot Supabase dashboard settings
4. Export Supabase auth users:
   ```sql
   SELECT id, email, created_at, last_sign_in_at
   FROM auth.users
   ORDER BY created_at;
   ```
5. Store everything in a dated folder in your password manager or encrypted drive

### Recommended: Supabase Pro Plan
- Includes daily automated backups
- Point-in-time recovery (up to 7 days)
- Worth the cost for production data

---

## DNS Records Reference

Document your current DNS setup here:

| Record | Type | Value | TTL |
|--------|------|-------|-----|
| 4dndt.com | CNAME or A | (your Netlify value) | 300 |
| www.4dndt.com | CNAME | (your Netlify value) | 300 |

To find current values:
- Netlify Dashboard → Domains → DNS settings
- Or: `dig 4dndt.com` from terminal

---

## Platform Architecture Quick Reference

```
User Browser
    ↓
Netlify CDN (static files from dist/)
    ↓
    ├── landing.html     → Marketing page
    ├── index.html       → React SPA (dashboard, case submission)
    └── system-check.html → Health monitoring
    ↓
Netlify Functions (190 serverless endpoints)
    ↓
    ├── /api/health                    → System health + engine registry
    ├── /api/comprehensive-assessment  → Main assessment orchestrator
    ├── /api/tri-model-reasoning-background → Superbrain AI pipeline
    ├── /api/decision-spine            → Classification engine
    └── /api/[144 engine endpoints]    → Individual engines
    ↓
Supabase PostgreSQL (154 tables)
    ↓
    ├── Cases, assessments, outcomes
    ├── Learning memory, POD updates
    ├── Authority locks, audit trails
    └── User auth (Supabase Auth)
    ↓
External AI APIs
    ├── OpenAI (GPT models for tri-model reasoning)
    └── Anthropic (Claude models for tri-model reasoning)
```

---

## Emergency Contacts

| Service | Support URL | Account Email |
|---------|------------|---------------|
| GitHub | github.com/support | (your email) |
| Supabase | supabase.com/support | (your email) |
| Netlify | netlify.com/support | (your email) |
| Domain Registrar | (your registrar) | (your email) |
| OpenAI | platform.openai.com | (your email) |
| Anthropic | console.anthropic.com | (your email) |

---

## Version History

| Date | Change |
|------|--------|
| 2026-05-01 | Initial disaster recovery package created |
