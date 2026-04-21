# DEPLOY256: Cross-Case Pattern Recognition Engine v1.0.0

## What This Does
Finds patterns across thousands of cases that no single inspector would see. "Every time we see fatigue cracking on pipeline attachment welds in marine environments, CUI follows within 18 months." Scans by asset type, method, environment, material class, vertical, finding type, and cross-dimension combos.

## 8 Capabilities
1. Scan Cases for Patterns (fingerprint + cluster by dimension)
2. Match New Case Against Known Patterns (with similarity scoring)
3. Extract Pattern Rules
4. Generate Pattern Alerts (auto-fires when match score > 60%)
5. Compute Pattern Statistics
6. Get Emerging Trends (elevated rejection rates vs baseline)
7. Get Pattern History for a Case
8. Pattern Audit Trail

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY256_cross_case_patterns.sql`
- Creates 6 tables: pattern_clusters, pattern_case_members, pattern_rules, pattern_alerts, pattern_statistics, pattern_audit_events
- All tables have RLS with org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/cross-case-patterns.ts`
- 10 actions: get_registry, scan_patterns, match_case, get_clusters, get_rules, get_alerts, acknowledge_alert, get_statistics, get_emerging_trends, get_case_patterns

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 49 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 49 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 49 PASS

## How It Works
- scan_patterns: Analyzes up to 1000 cases, groups by dimension, calculates rejection rates, discovers clusters
- match_case: Takes a new case, scores it against all known clusters, auto-generates alerts for matches > 60%
- get_emerging_trends: Looks at recent cases (configurable lookback), finds dimensions with rejection rates elevated vs baseline
- Severity grading: critical (3+ cases, 70%+ rejection), high (3+, 50%+), medium (5+, 30%+), low (10+, 10%+)
