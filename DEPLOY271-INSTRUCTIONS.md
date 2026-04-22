# DEPLOY271: Superbrain Report Query Engine (Engine #64)

**Date:** 2026-04-21
**Engine:** 64
**Platform Version:** FORGED-NDT/2.0.0

---

## Overview

AI-powered dynamic report generation from Superbrain v6 sessions. Users ask natural language questions and get structured, professional reports — no canned templates.

**Example queries:**
- "Executive summary for VP of Operations"
- "Trace the proof chain for the fatigue assessment"
- "What inspections close the proof gaps?"
- "Why did the governance lock fail?"
- "Risk assessment with cascade failure paths"

**6 built-in presets:** executive_summary, proof_chain, inspection_plan, risk_assessment, standards_compliance, full_technical

---

## Step 1: Run SQL Migration in Supabase

Go to **Supabase Dashboard → SQL Editor** and run:

`supabase/migrations/DEPLOY271_superbrain_report.sql`

Creates: `superbrain_reports` table with indexes.

---

## Step 2: Push to GitHub & Deploy

```bash
cd "NDT Platform"
git add .
git commit -m "DEPLOY271: Add Superbrain Report Query Engine (engine 64)"
git push origin main
```

Netlify auto-deploys on push.

### New Files

- `netlify/functions/superbrain-report.ts` — The engine
- `public/superbrain-report.html` — Frontend UI
- `supabase/migrations/DEPLOY271_superbrain_report.sql` — Database migration

### Updated Files

- `netlify/functions/health.ts` — ENGINE_REGISTRY now has 64 entries, CRITICAL_TABLES has superbrain_reports
- `public/system-check.html` — Tests all 64 endpoints

---

## Step 3: Verify

1. Go to `https://4dndt.netlify.app/system-check.html`
2. Click **Run Full System Check**
3. Confirm 64 endpoints respond (all PASS)

### Quick Smoke Test

```
POST /api/superbrain-report  →  { "action": "get_registry" }
```

### Generate a Report

1. Go to `https://4dndt.netlify.app/superbrain-report.html`
2. Click **Load Sessions** to see completed Superbrain v6 runs
3. Select a session
4. Choose a preset or type a custom question
5. Click **Generate Report**
6. Use **Print / PDF** button to save as PDF

---

## API Usage

### Query a Session
```json
POST /api/superbrain-report
{
  "action": "query_session",
  "session_id": "uuid-here",
  "query": "What are the top risks and how do we close the proof gaps?"
}
```

### Use a Preset
```json
POST /api/superbrain-report
{
  "action": "query_session",
  "session_id": "uuid-here",
  "preset": "executive_summary"
}
```

### Preset + Custom Query
```json
POST /api/superbrain-report
{
  "action": "query_session",
  "session_id": "uuid-here",
  "preset": "risk_assessment",
  "query": "Focus on the subsea riser components only"
}
```
