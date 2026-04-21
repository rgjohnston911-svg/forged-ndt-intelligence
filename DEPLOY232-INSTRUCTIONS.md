# DEPLOY232 — Risk Scoring Engine

Calculates composite risk scores for every case. Weighs 8 factors: severity, confidence gap, damage type, override history, escalation status, finding density, case age, and compliance. Produces a ranked risk list and a 5x5 risk matrix.

## What it does

Three actions:

1. **score_case** — Detailed risk breakdown for one case. Returns score (0-1), risk level, all 8 factor scores, and weights used.

2. **score_all** — Scores every case, returns ranked list (highest risk first) with distribution stats (how many critical/high/medium/low/minimal).

3. **get_risk_matrix** — 5x5 likelihood-vs-consequence matrix showing where cases cluster. Likelihood = confidence gap, Consequence = severity.

### Risk levels:
- **critical** (0.75+) — Immediate attention required
- **high** (0.55-0.74) — Prioritize for review
- **medium** (0.35-0.54) — Standard monitoring
- **low** (0.15-0.34) — Routine
- **minimal** (below 0.15) — No concerns

### Risk factors and weights:
| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Severity | 25% | Case state/disposition severity |
| Confidence gap | 15% | System uncertainty (low confidence = high risk) |
| Damage type | 15% | Inherent danger of the damage mechanism |
| Override risk | 10% | Inspector disagreed with system |
| Escalation risk | 10% | Open escalations or multiple escalations |
| Finding density | 10% | Number of findings (more = complex) |
| Age risk | 10% | How long the case has been open |
| Compliance risk | 5% | Compliance gaps (placeholder for DEPLOY231 integration) |

## Deploy order

### 1. Paste function
File: `netlify/functions/risk-scoring.ts`
Endpoint: `POST /api/risk-scoring { action, case_id }`

No migration needed — reads existing tables.

### 2. Update health.ts ENGINE_REGISTRY
Add before closing `]`:
```
{ name: "risk-scoring", deploy: "DEPLOY232", mode: "deterministic", path: "/api/risk-scoring" }
```

---

## Smoke test

1. Score all cases:
```
POST /api/risk-scoring { "action": "score_all" }
```
Should return ranked list of all 23 cases with risk scores.

2. Score a specific case:
```
POST /api/risk-scoring { "action": "score_case", "case_id": "<real-case-id>" }
```

3. Get risk matrix:
```
POST /api/risk-scoring { "action": "get_risk_matrix" }
```

---

## Architecture

- **Weighted composite** — 8 factors with configurable weights summing to 1.0.
- **Damage type awareness** — Hydrogen damage and SCC score highest (0.95), cosmetic scores lowest (0.10).
- **Age penalty** — Open cases older than 90 days get high age risk score.
- **Override signal** — Active inspector override = disagreement = elevated risk.
- **Deterministic** — Same inputs always produce same score. No AI randomness.
- **Manager-ready** — score_all gives the ranked priority list managers need for resource allocation.
