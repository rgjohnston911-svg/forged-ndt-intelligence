# DecisionPackage Contract — v1.0

**Status:** Authoritative. The Assembler implements this exactly.
**Patent alignment:** Supports Claims 1, 2, 3, 5, 7, 8, 11–14, 19 of the FORGED 4D NDT Provisional Patent Disclosure, and the three continuation-in-part claims for replay verification, Reality Integrity Score, and chain-of-custody event log.
**Consumers:** `netlify/functions/perspective-projection.js` (Perspective Intelligence Layer), `netlify/functions/package-store.js` (persistence), `netlify/functions/replay-audit.js` (replay verifier), `netlify/functions/sign-export.js` (signing), `netlify/functions/coherence-log.js` (audit log).

---

## 0. Purpose

The DecisionPackage is the **frozen, hashable, replayable artifact** produced at the end of the deterministic decision pipeline. Once produced, it is treated as immutable. Every downstream consumer — the PIL, the audit layer, the Superbrain synthesis prompt, the multi-LLM adversarial validator — operates on this single canonical object.

It is the boundary between *computed* and *narrated*. Everything before it is engineering. Everything after it (LLM synthesis, role projection, narration, signing) operates on the frozen package and cannot alter engineering, safety, code, or contradiction truth.

The DecisionPackage does not replace the existing `decision_core` response shape that today's frontend consumes. It is produced **additively** alongside it. Existing frontend code continues to work unchanged.

---

## 1. Top-level shape

```json
{
  "schemaVersion": "1.0",
  "packageId": "<string>",
  "packageHash": "<sha256 hex string>",
  "decisionTimestamp": "<ISO 8601>",
  "packageTimestamp": "<ISO 8601>",
  "projectionTimestamp": null,
  "disposition": "<DispositionEnum>",
  "confidence": <number 0-1>,
  "recommendedMethod": "<string|null>",
  "fmd": { ... },
  "timeline": { ... },
  "hardLocks": [ ... ],
  "bindingClauses": [ ... ],
  "contradictions": [ ... ],
  "consequence": { ... },
  "provenance": { ... },
  "remainingStrength": { ... },
  "resolved": { ... },
  "requiredInspections": [ ... ],
  "mustNotConclude": [ ... ]
}
```

`projectionTimestamp` is reserved for the PIL to populate when it projects the package. The Assembler sets it to `null`.

---

## 2. Field-by-field specification

### 2.1 Root-level scalars

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | yes | Always `"1.0"` for this contract. Bump on schema change. |
| `packageId` | string | yes | Stable case identifier. Sourced from `case_id` (decision-spine) or fallback to `caseId` from input. Used for log correlation; NOT used in `packageHash`. |
| `packageHash` | string (64-char hex) | yes | SHA-256 over the canonical-JSON of the package WITH `packageHash` field omitted. See §5. |
| `decisionTimestamp` | ISO 8601 string | yes | When the deterministic pipeline made the decision. Sourced from `decision_core.elapsed_ms` end time or `decision-spine.signed_at`. |
| `packageTimestamp` | ISO 8601 string | yes | When the Assembler froze this package. Always `=== decisionTimestamp` for v1.0. |
| `projectionTimestamp` | ISO 8601 string \| null | yes | Always `null` from the Assembler. The PIL populates this when projecting. |
| `disposition` | string enum | yes | The canonical disposition. See §3.1 for vocabulary and translation. |
| `confidence` | number, 0–1 | yes | The unified confidence in this disposition. Sourced from `decision_core.reality_confidence.overall` OR `decision-spine.unified_confidence`. |
| `recommendedMethod` | string \| null | no | The single most appropriate next inspection method. Derived from `inspection_reality.required_methods[0]` if singular and unambiguous; otherwise `null`. |

### 2.2 `fmd` — Failure Mode Dominance

```json
"fmd": {
  "dominant": "<string mechanism name>",
  "margin": <number 0-1>,
  "candidates": [
    { "mechanism": "<string>", "score": <number>, "reasoning": "<string>" },
    ...
  ],
  "governingFailureMode": "<CORROSION|CRACKING|COMPOUND|STRUCTURAL_INSTABILITY|SCREENING_REQUIRED>",
  "governingSeverity": "<CRITICAL|SEVERE|HIGH|MODERATE|LOW>"
}
```

- `dominant`: specific mechanism name (e.g., `"sulfidation"`, `"high_temp_h2_attack"`). Sourced from `decision_core.damage_reality.primary_mechanism`.
- `margin`: continuous score in [0, 1] representing distance from the rank-2 candidate. **Derived** by the Assembler (production doesn't emit this directly). See §4.1.
- `candidates`: ordered list of considered mechanisms. Sourced from `decision_core.damage_reality.validated_mechanisms` or `failure_mode_dominance.corrosion_path` / `cracking_path` / `structural_path` arrays, merged and re-ranked.
- `governingFailureMode`: the category from production FMD (`governing_failure_mode`).
- `governingSeverity`: the category from production FMD (`governing_severity`).

### 2.3 `timeline`

```json
"timeline": {
  "timeToActionDays": <number>,
  "rateControllingMechanism": "<string|null>",
  "compound": <boolean>,
  "governingTimeYears": <number>,
  "recommendedInspectionIntervalYears": <number>,
  "urgency": "<string>",
  "progressionState": "<string>"
}
```

- `timeToActionDays`: derived as `governing_time_years × 365`, rounded to integer. See §4.2.
- `rateControllingMechanism`: name of mechanism whose time-to-action is < 0.6 × next-fastest mechanism's time-to-action (per Patent Claim 4). Computed by the Assembler from `failure_timeline.corrosion_timeline` and `crack_timeline`. `null` if no single mechanism dominates the rate (compound envelope governs). See §4.3.
- `compound`: `true` if `failure_mode_dominance.governing_failure_mode === "COMPOUND"`. Otherwise `false`.
- `governingTimeYears`, `recommendedInspectionIntervalYears`, `urgency`, `progressionState`: passed through verbatim from `failure_timeline` response.

### 2.4 `hardLocks` — array

```json
"hardLocks": [
  {
    "trigger": "<HardLockTriggerEnum>",
    "code": "<HL_* production code>",
    "safeStateOutput": "<string>",
    "severity": "<CRITICAL|HIGH|MEDIUM>",
    "reason": "<string>",
    "physicsBasis": "<string>"
  },
  ...
]
```

Sourced from `decision_core.decision_reality.hard_locks[]`. Each production hard_lock item is translated to a DecisionPackage hard_lock entry using §3.2 (production `HL_*` code → canonical `trigger` enum).

- `trigger`: canonical enum value (see §3.2). What the PIL's Escalation Trigger Engine reads.
- `code`: the original production code (`HL_THROUGH_WALL_LEAK`, etc.). Preserved for audit traceability.
- `safeStateOutput`: derived from production `disposition` field on the hard_lock (e.g., `"NO GO"` → `"REJECT_FROM_SERVICE"`). See §4.4.
- `severity`: derived from production `code` (CRITICAL/HIGH/MEDIUM categorization). See §4.5.
- `reason`: passed through verbatim from production.
- `physicsBasis`: passed through verbatim from production.

### 2.5 `bindingClauses` — array

```json
"bindingClauses": [
  {
    "code": "<string>",
    "clause": "<string>",
    "requirement": "<string>"
  },
  ...
]
```

Constructed by the Assembler from `authority_lock.authority_chain[]` plus optional enrichment from `code-authority-resolution` registry. See §4.6.

- `code`: e.g., `"API 510"`, `"ASME B31.3"`, `"NACE MR0175"`.
- `clause`: e.g., `"Section 7.4.2"`, `"Table 3-2"`. Pulled from `authority_chain` items where present. If only a code-level citation is available, set to `"<unspecified>"`.
- `requirement`: the human-readable text of the requirement. Pulled from `code-authority-resolution` registry by `(code, clause)` lookup. Fallback to authority_chain item's free-text `reason` field if registry has no entry.

### 2.6 `contradictions` — array

```json
"contradictions": [
  {
    "resolved": <boolean>,
    "type": "<ContradictionTypeEnum>",
    "category": "<production category>",
    "description": "<string>",
    "severity": "<CRITICAL|MAJOR|MINOR|INFORMATIONAL>"
  },
  ...
]
```

Sourced from `contradiction-engine.check_contradictions` response items (the `result.found` array). Each production category is mapped to a canonical `type` enum (see §3.3).

- `resolved`: for freshly-detected contradictions emitted by `check_contradictions`, default to `false`. For contradictions retrieved via `get_detected` action, pass through actual stored value.
- `type`: canonical enum (see §3.3).
- `category`: original production category (`claim_vs_image`, etc.). Preserved for audit.
- `description`: from production `contradiction_description`.
- `severity`: from production `severity`.

### 2.7 `consequence`

```json
"consequence": {
  "tier": "<LOW|MODERATE|HIGH|CRITICAL>",
  "humanImpact": "<string|null>",
  "enforcementRequirements": [ ... ]
}
```

- `tier`: from `decision_core.consequence_reality.consequence_tier`. Vocabulary aligns directly (no translation needed).
- `humanImpact`, `enforcementRequirements`: passed through verbatim from `consequence_reality`.

### 2.8 `provenance`

```json
"provenance": {
  "lowestProvenance": "<ProvenanceEnum>",
  "dominantSource": "<production dominant_source>",
  "trustBand": "<string>",
  "measuredFraction": <number 0-1>
}
```

- `lowestProvenance`: canonical enum value (see §3.4). Computed by the Assembler from `evidence-provenance.provenance_summary.dominant_source` and `provenance_summary.counts`. Specifically, scan all derived data in the package for the **weakest provenance** along the derivation chain. See §4.7.
- `dominantSource`: original value from `provenance_summary.dominant_source`. Preserved for audit.
- `trustBand`, `measuredFraction`: passed through verbatim.

### 2.9 `remainingStrength`

```json
"remainingStrength": {
  "rsf": <number|null>,
  "mawp": <number|null>,
  "governingMaop": <number|null>,
  "governingMethod": "<string|null>",
  "severityTier": "<string|null>",
  "pressureReductionRequired": <boolean>
}
```

- `rsf`: from `remaining_strength.calculations.modified_rsf` if present, else `calculations.b31g_rsf`. `null` if neither computed.
- `mawp`: from `remaining_strength.governing_maop` (note: production calls it MAOP, the pipeline-industry term; we expose it as `mawp` for PIL compatibility but also retain the original name).
- `governingMaop`: original production value, preserved.
- `governingMethod`, `severityTier`, `pressureReductionRequired`: passed through verbatim.

### 2.10 `resolved.environment`

```json
"resolved": {
  "environment": {
    "hazards": [ "<string>", ... ],
    "phasesPresent": [ "<string>", ... ],
    "atmosphereClass": "<string|null>"
  },
  "material": { ... }
}
```

- `hazards`: derived array of canonical hazard tags. The Assembler scans `decision_core.physical_reality.environment` plus `decision_core.consequence_reality.enforcement_requirements` and produces a canonical list (e.g., `["wet_h2s", "hydrocarbon_service", "elevated_temperature"]`). See §4.8.
- `phasesPresent`, `atmosphereClass`: passed through verbatim from production.
- `material`: passed through verbatim if present.

### 2.11 `requiredInspections`

```json
"requiredInspections": [
  {
    "method": "<string>",
    "description": "<string>",
    "coverage": "<string|null>",
    "rationale": "<string|null>"
  },
  ...
]
```

Sourced from `disposition_pathway.required_inspection_plan[]` and `decision_core.inspection_reality.required_methods[]`, merged and deduplicated by `method`.

- `description`: human-readable text from production items. If production item lacks a description field, synthesize from `method` + `rationale`.

### 2.12 `mustNotConclude` — array of strings

```json
"mustNotConclude": [ "<string>", ... ]
```

**Derived** by the Assembler. Not sourced directly from any production field. See §4.9 for derivation rules.

Each item is a short, specific guidance line:
- `"Do not conclude root cause until additional UT data is captured at the suspect locations."`
- `"Do not finalize remaining-life calculation until wall thickness measurements are upgraded from ASSUMED to MEASURED."`

---

## 3. Translation tables (production → DecisionPackage)

These are the four critical vocabulary mappings the Assembler must enforce. The Assembler holds them as `const` lookup tables. They are versioned with `schemaVersion`.

### 3.1 Disposition vocabulary

| Production field | Source path | Production value | DecisionPackage `disposition` |
|---|---|---|---|
| decision_core | `decision_core.decision_reality.disposition` | `no_go` | `REJECT_FROM_SERVICE` |
| decision_core | same | `repair_before_restart` | `REPAIR` |
| decision_core | same | `hold_for_review` | `HOLD_FOR_INPUT` |
| decision_core | same | `engineering_review_required` | `FFS_LEVEL_2_REQUIRED` |
| decision_core | same | `conditional_go` | `ACCEPT_WITH_MONITORING` |
| decision_core | same | `go` | `ACCEPT_FOR_CONTINUED_SERVICE` |
| disposition_pathway | `disposition_pathway.disposition` | `IMMEDIATE_ACTION` | `REJECT_FROM_SERVICE` |
| disposition_pathway | same | `IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW` | `HALT_AND_ESCALATE` |
| disposition_pathway | same | `HOLD_FOR_INPUT_ENFORCEMENT` | `HOLD_FOR_INPUT` |
| disposition_pathway | same | `HOLD_FOR_DATA` | `HOLD_FOR_INPUT` |
| disposition_pathway | same | `ENGINEERING_ASSESSMENT` | `FFS_LEVEL_2_REQUIRED` |
| disposition_pathway | same | `MONITOR` | `ACCEPT_WITH_MONITORING` |
| disposition_pathway | same | `CONTINUE_SERVICE` | `ACCEPT_FOR_CONTINUED_SERVICE` |
| disposition_pathway | same | `domain_not_supported` | `HOLD_FOR_INPUT` |

**Precedence rule:** when both `decision_core` and `disposition_pathway` emit a disposition for the same case (which they typically do), use `decision_core.decision_reality.disposition` as the primary source. `disposition_pathway` is the disambiguator only when decision_core is missing (degraded pipeline state).

**Conflict rule:** if both are present and they map to different DecisionPackage values, that's a CONTRADICTION — the Assembler emits a `contradictions[]` entry of type `DISPOSITION_DIVERGENCE` and uses the more conservative (toward earlier action) of the two values. Conservative ordering, most-to-least-conservative: `HALT_AND_ESCALATE` > `REJECT_FROM_SERVICE` > `REPORT_TO_JURISDICTIONAL_AUTHORITY` > `REPAIR` > `HOLD_FOR_INPUT` > `FFS_LEVEL_3_REQUIRED` > `FFS_LEVEL_2_REQUIRED` > `REINSPECT_BY_METHOD` > `ACCEPT_WITH_MONITORING` > `ACCEPT_FOR_CONTINUED_SERVICE`.

### 3.2 Hard-lock trigger codes

| Production code | DecisionPackage `trigger` |
|---|---|
| `HL_THROUGH_WALL_LEAK` | `LOSS_OF_CONTAINMENT_IMMINENT` |
| `HL_PRIMARY_CRACK` | `CODE_ALLOWABLE_EXCEEDED` |
| `HL_SUPPORT_COLLAPSE` | `STRUCTURAL_INTEGRITY_LOST` |
| `HL_FIRE_NO_VALIDATION` | `FIRE_DAMAGE_UNVALIDATED` |
| `HL_MAJOR_DEFORMATION` | `STRUCTURAL_INTEGRITY_LOST` |
| `HL_CRITICAL_WALL_LOSS` | `CODE_ALLOWABLE_EXCEEDED` |
| _(production does not currently have)_ | `NACE_HARDNESS_EXCEEDED` |

**Note:** `NACE_HARDNESS_EXCEEDED` is referenced in the PIL's escalation rules (FILE 1 line 140) but no current production hard lock corresponds to it. Either: (a) a new hard lock is added to the production engines for NACE wet-H2S hardness > 22 HRC (per Patent Hard Lock 1), or (b) the PIL rule fires from an authority_chain match instead. Recommend option (a) — implementing the NACE hardness lock as a new production hard lock is consistent with the patent disclosure's enumerated hard lock list.

### 3.3 Contradiction type mapping

| Production category | DecisionPackage `type` |
|---|---|
| `claim_vs_image` | `EVIDENCE_OBSERVATION_MISMATCH` |
| `claim_vs_measurement` | `EVIDENCE_OBSERVATION_MISMATCH` |
| `claim_vs_code` | `CODE_COMPLIANCE_VIOLATION` |
| `mechanism_vs_environment` | `MECHANISM_ENVIRONMENT_MISMATCH` |
| `mechanism_vs_material` | `MECHANISM_MATERIAL_MISMATCH` |
| `method_vs_mechanism` | `METHOD_MECHANISM_MISMATCH` |
| `disposition_vs_authority` | `DISPOSITION_AUTHORITY_CONFLICT` |
| `disposition_vs_evidence` | `DISPOSITION_EVIDENCE_CONFLICT` |
| `physics_violation` | `PHYSICS_VIOLATION` |
| `compound_mechanism_unresolved` | `COMPOUND_MECHANISM_AMBIGUITY` |

**Note:** The PIL specifically tests for `METHOD_MECHANISM_MISMATCH` (FILE 1 line 158). That mapping is critical — when production emits `method_vs_mechanism`, the Assembler MUST emit `METHOD_MECHANISM_MISMATCH` so the PIL's escalation rule fires.

### 3.4 Provenance values

| Production value (`dominant_source`) | DecisionPackage `lowestProvenance` |
|---|---|
| `MEASURED` | `MEASURED` |
| `OBSERVED` | `OBSERVED` |
| `REPORTED` | `REPORTED` |
| `INFERRED` | `INFERRED` |
| `COMPUTED` | `COMPUTED` |
| `UNVERIFIED` | `ASSUMED` |
| `CONTRADICTED` | `ASSUMED` |
| _(absent)_ | `ASSUMED` (defensive default) |

**Note:** The PIL specifically tests for `lowestProvenance === 'ASSUMED'` (FILE 1 line 112). Production's `UNVERIFIED` and `CONTRADICTED` both semantically equal "the system cannot trust this datum" — both map to `ASSUMED` for PIL consumption. This is the conservative direction.

### 3.5 Time units

| Production field | DecisionPackage field | Conversion |
|---|---|---|
| `failure_timeline.governing_time_years` | `timeline.timeToActionDays` | `Math.round(years × 365)` |
| `failure_timeline.recommended_inspection_interval_years` | `timeline.recommendedInspectionIntervalYears` | pass through |

---

## 4. Derivation rules

These are fields the Assembler computes from production data; production does not emit them directly.

### 4.1 `fmd.margin`

Continuous score in [0, 1] representing how clearly the dominant mechanism beats the second-ranked candidate.

**Algorithm:**

```
candidates = validated_mechanisms from decision_core.damage_reality, ordered by reality_score descending
if candidates.length < 2:
  margin = 1.0  (no competition, full confidence in dominance)
else:
  top = candidates[0].reality_score      // 0-1
  second = candidates[1].reality_score   // 0-1
  margin = clamp(top - second, 0, 1)
```

If `decision_core.damage_reality.validated_mechanisms` is absent or unscored, fall back to:

```
governing_severity_to_margin = {
  CRITICAL: 0.95,
  SEVERE:   0.75,
  HIGH:     0.55,
  MODERATE: 0.30,
  LOW:      0.10
}
margin = governing_severity_to_margin[failure_mode_dominance.governing_severity]
```

The PIL's blind-spot rule (FILE 1 line 110) fires when `margin < 0.15`. The fallback ensures we don't get a false-confident `1.0` when validated_mechanisms is missing.

### 4.2 `timeline.timeToActionDays`

```
days = Math.round(failure_timeline.governing_time_years × 365)
clamp to [1, 36500]  // never zero, never beyond 100 years
```

### 4.3 `timeline.rateControllingMechanism`

Per Patent Claim 4 — the 0.6-fraction rule:

```
sort active timelines (corrosion_timeline.time_to_action_years, crack_timeline.time_to_action_years, etc.) ascending
if length < 2: rateControllingMechanism = the only one's mechanism name, OR null if length === 0
else:
  fastest_time = timelines[0].time_to_action_years
  next_time = timelines[1].time_to_action_years
  if fastest_time < 0.6 × next_time:
    rateControllingMechanism = timelines[0].mechanism_name
  else:
    rateControllingMechanism = null  // joint envelope governs
```

### 4.4 `hardLocks[].safeStateOutput`

Map from production hard_lock `disposition` field:

| Production `disposition` | DecisionPackage `safeStateOutput` |
|---|---|
| `"NO GO"` | `REJECT_FROM_SERVICE` |
| `"REPAIR BEFORE RESTART"` | `REPAIR` |
| `"HOLD FOR REVIEW"` | `HOLD_FOR_INPUT` |
| _(other)_ | `HALT_AND_ESCALATE` (defensive — unknown safe state requires escalation) |

### 4.5 `hardLocks[].severity`

Map from production `code`:

| Production code | DecisionPackage `severity` |
|---|---|
| `HL_THROUGH_WALL_LEAK` | `CRITICAL` |
| `HL_FIRE_NO_VALIDATION` | `CRITICAL` |
| `HL_SUPPORT_COLLAPSE` | `CRITICAL` |
| `HL_MAJOR_DEFORMATION` | `HIGH` |
| `HL_PRIMARY_CRACK` | `HIGH` |
| `HL_CRITICAL_WALL_LOSS` | `HIGH` |
| _(future codes)_ | default `MEDIUM` |

### 4.6 `bindingClauses[]` construction

For each item in `authority_lock.authority_chain`:

```
code = item.code (e.g., "API 510", "ASME B31.3")
clause = item.clause || item.section || item.paragraph || "<unspecified>"
requirement = code-authority-resolution.lookup(code, clause)
              || item.reason
              || item.text
              || "<no text available>"
push to bindingClauses[]
```

Deduplicate by `(code, clause)` tuple. Order by ascending `code` then ascending `clause` so the resulting array has a stable sort for hashing.

### 4.7 `provenance.lowestProvenance`

Walk the entire DecisionPackage tree (after assembly) and find the lowest provenance label among any datum that has one. In practice:

```
sources_to_scan = [
  evidence-provenance.provenance_summary.dominant_source,
  evidence-provenance.evidence[].provenance for each evidence item,
  any nested provenance fields in remaining_strength, failure_timeline, etc.
]
provenance_rank = { MEASURED: 6, OBSERVED: 5, REPORTED: 4, INFERRED: 3, COMPUTED: 3, UNVERIFIED: 2, ASSUMED: 1 }
lowest = min over all observed provenance values, mapped via §3.4
```

Defensive: if no provenance is found at all, default to `ASSUMED`. This ensures the PIL's blind-spot rule (line 112) fires when provenance data is missing entirely.

### 4.8 `resolved.environment.hazards`

Canonical hazard tags derived from production environment + consequence data:

```
hazards = []
if physical_reality.environment.phases_present includes "H2S" → push "wet_h2s"
if physical_reality.environment.phases_present includes "HYDROCARBON" → push "hydrocarbon_service"
if physical_reality.environment.atmosphere_class === "MARINE" → push "marine_atmosphere"
if any failure_mode_dominance.cracking_path.mechanism === "HIC|SSC|SOHIC" → push "wet_h2s"
if consequence_reality.human_impact === "PERSONNEL_EXPOSURE" → push "personnel_exposure_risk"
if physical_reality.environment.process_temperature_C > 200 → push "elevated_temperature"
... (extend as new hazard categories are identified)
```

Deduplicate. Sort alphabetically for stable hashing.

### 4.9 `mustNotConclude[]` derivation rules

Each rule below, if its condition is met, appends a specific guidance string to `mustNotConclude[]`.

| Condition | Guidance string appended |
|---|---|
| `provenance.lowestProvenance === 'ASSUMED'` | `"Do not finalize disposition until all ASSUMED inputs are upgraded to MEASURED or OBSERVED via targeted re-inspection."` |
| `fmd.margin < 0.10` | `"Do not declare a single root cause until additional inspection data distinguishes between competing mechanisms."` |
| `confidence < 0.60` | `"Do not communicate this disposition with confidence — overall pipeline confidence is below 0.60. Treat as preliminary."` |
| `contradictions` has any item with `resolved === false` | `"Do not act on this disposition while contradictions remain unresolved. Review and resolve before proceeding."` |
| `timeline.compound === true AND timeline.rateControllingMechanism === null` | `"Do not assume a single mechanism governs — compound mechanisms with no rate-controller. Joint envelope analysis required."` |
| `requiredInspections` contains a method with `confidence < 0.70` (or equivalent flag) | `"Do not finalize remaining-life calculation until the recommended inspection methods are executed and results integrated."` |
| `remainingStrength.severityTier === 'TIER_4_REJECT'` or similar | `"Do not return to service. Pressure reduction or replacement required per remaining-strength assessment."` |
| `hardLocks.length > 0` | `"Do not override hard-lock conditions. These are not subject to operational judgment."` |

Multiple rules may fire — all strings appended. Order doesn't matter (the PIL displays them as a list).

---

## 5. packageHash computation

The `packageHash` is what gives the DecisionPackage its identity. It is:
- Deterministic — same package contents → same hash, always.
- Tamper-evident — any modification produces a different hash.
- Suitable for content-addressable storage in `package-store.js`.

**Algorithm:**

```javascript
function computePackageHash(pkg) {
  // Strip the packageHash field itself before hashing (otherwise circular)
  var copy = JSON.parse(JSON.stringify(pkg));
  delete copy.packageHash;
  // Strip projectionTimestamp (set later by PIL — not part of decision identity)
  delete copy.projectionTimestamp;
  var canonical = stableStringify(copy);  // deep recursive sort, same algo as FILE 1 module 13
  return sha256Hex(canonical);
}
```

**Properties:**
- Identical inputs → identical hash (deterministic, per Patent Claim 1(ii)).
- Re-ordering object keys → identical hash (canonical JSON normalizes).
- Adding a single byte of meaningful data → different hash (tamper-evident).
- PIL changing `projectionTimestamp` does NOT change `packageHash` (decision identity is stable across projections).

---

## 6. The Assembler — function contract

```javascript
// netlify/functions/decision-package-assembler.js
// Pure JS. var only. String concat only. module.exports. No template literals.
// No I/O, no time, no randomness, no external state. Deterministic.

function assembleDecisionPackage(inputs) {
  // inputs: {
  //   caseId,
  //   decisionCore,            // full decision_core response body
  //   failureModeDominance,    // failure-mode-dominance response body
  //   failureTimeline,         // failure-timeline response body
  //   authorityLock,           // authority-lock response body
  //   dispositionPathway,      // disposition-pathway response body
  //   remainingStrength,       // remaining-strength response body
  //   contradictionEngine,     // contradiction-engine check_contradictions response
  //   evidenceProvenance,      // evidence-provenance response body
  //   codeAuthorityRegistry,   // (optional) code-authority-resolution lookup table
  //   decisionTimestamp        // ISO string, frozen at decision time
  // }
  // returns: DecisionPackage object per this contract
}

module.exports = { assembleDecisionPackage: assembleDecisionPackage };
```

**Pure-function guarantees:**
- No `Date.now()`, `Math.random()`, network calls, file I/O, or external state access inside the function.
- All "current time" data comes from `inputs.decisionTimestamp`, which the caller (decision-core) freezes once at the moment of decision.
- The function operates only on its inputs. Same inputs always produce the same DecisionPackage.

**Idempotency:**
- Calling `assembleDecisionPackage(inputs)` twice with the same inputs produces two objects whose JSON serialization is byte-identical and whose `packageHash` is identical.

**Failure modes:**
- Missing required field on an input (e.g., no `disposition` from decision-core) → throw a structured error: `{ assemblerError: 'MISSING_INPUT_FIELD', field: 'decisionCore.decision_reality.disposition' }`.
- Unknown disposition value not in the translation table → throw `{ assemblerError: 'UNKNOWN_DISPOSITION', value: '<x>' }`. Calling code (decision-core) decides whether to bail out or fall back to safe defaults.
- Unknown hard-lock code → emit a hard_lock entry with `trigger: 'UNCLASSIFIED_HARD_LOCK'`, `severity: 'HIGH'`, and the original code preserved in `code`. Do NOT silently drop unknown hard locks.

---

## 7. Patent claim alignment

| Claim | How this contract supports it |
|---|---|
| 1(ii) Pure function + bitwise-identical output | The Assembler is a pure deterministic function. `packageHash` proves identical input → identical output. |
| 1(iv) Provenance non-increase | The Assembler computes `lowestProvenance` by scanning the derivation graph; never amplifies. |
| 1(v) Dominant mechanism with quantified margin | `fmd.dominant` + `fmd.margin` are explicit fields with a derivation rule. |
| 1(vi) Authority lock binding | `bindingClauses[]` is the binding citation set. |
| 1(vii) Contradiction detection | `contradictions[]` carries all unresolved logical contradictions. |
| 1(viii) Hard-lock evaluation | `hardLocks[]` is the canonical hard-lock set. |
| 2 Klein-bottle 6-state cyclic core | The Assembler runs at the end of pipeline convergence — implicitly bounded by it. |
| 3 Multi-LLM adversarial validation with deterministic arbiter | The DecisionPackage is the input both to the Superbrain (synthesis) and to the Challenger LLM. The deterministic arbiter compares synthesis output against this canonical package field-by-field. |
| 4 Compound-mechanism 0.6-fraction rule | `timeline.rateControllingMechanism` is computed via the 0.6-fraction rule (§4.3). |
| 5 Code ingestion without modifying decision core | `bindingClauses[]` consumes `code-authority-resolution.lookup` — a separate, ingestion-managed registry. |
| 7 Fourteen enumerated asset domains | The Assembler inherits the domain from upstream Reality Lock; doesn't add or modify the enumeration. |
| 8 Enumerated hard-lock triggers | The translation table (§3.2) explicitly enumerates the supported hard-lock triggers. |
| 19 Generalized authoritative-knowledge framework | The DecisionPackage is the generic-domain canonical form; the Educational Variant uses the same contract. |
| **CIP claim 1: Replay verification** | `packageHash` makes the DecisionPackage content-addressable; `replay-audit.js` re-projects and verifies. |
| **CIP claim 2: Reality Integrity Score** | The DecisionPackage's fields are the inputs to coherence/replay/hardLock/disposition/custody scoring. |
| **CIP claim 3: Chain-of-custody event log** | Every custody event records `packageHash` — a stable identifier provided by this contract. |

---

## 8. Versioning and evolution

- Current version: `schemaVersion: "1.0"`.
- **Breaking changes** bump the major (`2.0`): renaming a field, removing a field, changing a translation table that affects existing stored packages, changing the `packageHash` algorithm.
- **Additive changes** bump the minor (`1.1`): adding a new optional field, extending an enum with a new value.
- The `replay-audit.js` verifier MUST check `schemaVersion` and refuse to replay packages whose major version differs from the running Assembler. This is the "code version drift" detection case explicitly named in `replay-audit.js`'s replay-failure reasons.

---

## 9. Open items the Assembler may surface

These are decision points the Assembler will encounter and either resolve via defaults or surface to the caller:

1. **NACE hardness hard lock.** Production has no `HL_NACE_HARDNESS_EXCEEDED` today. The PIL references `NACE_HARDNESS_EXCEEDED` in its escalation rules. Decision: add a new production hard lock in a future deploy, OR have the Assembler synthesize this trigger by inspecting `authority_lock.trigger_sour_service` and asset hardness data. Recommend the former (add the hard lock to production) for cleaner provenance.

2. **codeAuthorityRegistry availability.** If `code-authority-resolution.lookup` doesn't return a `requirement` for a given (code, clause), the Assembler falls back to authority_chain item's free-text. Over time, the registry should expand to cover all citations the system commonly emits.

3. **Hazard taxonomy expansion.** §4.8 lists initial hazard categories. As new asset domains are reasoned about, new canonical hazard tags will be added.

4. **mustNotConclude expansion.** §4.9 lists initial rules. Additional rules can be added as field experience identifies new conclusion-avoidance categories.

---

## 10. Test cases for the Assembler

The Assembler must pass these regression tests before integration into decision-core:

1. **Identity test.** Feed any fixture twice; both calls produce byte-identical JSON serialization and identical `packageHash`.
2. **Empty pipeline test.** Feed minimal inputs (only `decisionCore` present, all engines missing). Assembler returns a valid package with default values; does not crash.
3. **Disposition translation test.** For each production disposition value in §3.1, verify the correct DecisionPackage disposition is emitted.
4. **Disposition conflict test.** Decision-core says `go`, disposition-pathway says `IMMEDIATE_ACTION`. Assembler emits the conservative direction (`REJECT_FROM_SERVICE`) plus a contradiction.
5. **Hard-lock translation test.** Production hard_locks with each known `HL_*` code → correct canonical trigger.
6. **Unknown hard-lock test.** Production emits `HL_NEW_UNKNOWN_LOCK` not in the table. Assembler emits `trigger: UNCLASSIFIED_HARD_LOCK`, preserves the original code, marks `severity: HIGH`.
7. **mustNotConclude rules test.** Six scenarios, each triggering one of the rules in §4.9. Verify the correct guidance string is appended.
8. **packageHash determinism test.** Mutate input arrays' order; verify packageHash unchanged (canonical sort handles reordering).
9. **packageHash tamper test.** Modify one byte of any field; verify packageHash changes.
10. **Provenance non-increase test.** Inputs include an ASSUMED evidence item used to derive an FMD ranking. Verify `lowestProvenance === 'ASSUMED'` regardless of any "higher" provenance elsewhere.

---

End of contract v1.0.
