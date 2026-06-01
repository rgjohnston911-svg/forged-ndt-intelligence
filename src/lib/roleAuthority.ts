// ============================================================================
// roleAuthority.ts - FORGED ROLE AUTHORITY ENGINE (RAE), DEPLOY451.
// Replaces the human-factor "stakeholder" model (what_they_want / what_they_fear /
// bias / organizational-risk score). Roles are AUTHORITY DOMAINS, not people.
//
// Each role evaluates evidence ONLY within its authorized technical boundary using
// facts + codes + standards. It emits a code-anchored conclusion or OUTSIDE_AUTHORITY.
// It NEVER outputs wants, fears, opinions, motivation, bias, or a manufactured score.
//
// The falsifiable signal that replaces motivational tension is CROSS-DISCIPLINE
// CONFLICT DETECTION: a COUNT of conflicts where two in-authority roles point in
// incompatible disposition directions, each backed by a real code citation. No score.
// Pure module: no imports, no network. Facts only.
// ============================================================================

export type RoleId = "CWI" | "NDT" | "COATINGS" | "ENGINEER" | "SAFETY" | "OPERATIONS";

export interface RoleOutput {
  role: RoleId;
  conclusion: string;          // a permitted conclusion, or "OUTSIDE_AUTHORITY"
  code_cited: string | null;   // standard/clause backing the conclusion
  evidence_ref: string | null; // transcript phrase / datum the conclusion rests on
  within_authority: boolean;
  escalation: string;          // escalation path for this role
}

// Facts handed in from the deterministic pipeline (no inference here).
export interface RoleContext {
  transcript: string;
  confirmedMechanism?: string | null; // a CONFIRMED physical mechanism, if any
  hardLockCount?: number;
  consequenceTier?: string;           // LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN
  physical?: string;                  // ACCEPTABLE | SUSPECTED | CONFIRMED_DAMAGE | UNKNOWN
  authorityCodes?: string[];          // codes already resolved by authority-lock/derivation
}

var OUT = "OUTSIDE_AUTHORITY";

function has(t: string, re: RegExp): boolean { return re.test(t); }
function firstMatch(t: string, re: RegExp): string | null { var m = t.match(re); return m ? m[0] : null; }
function tierRank(tier: string): number {
  var m: { [k: string]: number } = { "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4 };
  return m[String(tier || "").toUpperCase()] || 0;
}

// ---- per-role authority evaluation (facts/codes only) ----
function evalCWI(t: string): RoleOutput {
  var weld = has(t, /\b(weld|welding|wps|pqr|fillet|groove weld|weld map|weld defect|undercut|porosity|lack of fusion|incomplete penetration)\b/i);
  if (!weld) { return { role: "CWI", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Engineer -> Asset Integrity -> Operations" }; }
  var rejected = has(t, /\b(weld (?:defect|reject|crack|nonconformance)|lack of fusion|incomplete penetration|undercut exceed|porosity exceed)\b/i) && !has(t, /\b(no |within|acceptable)\b/i);
  var concl = rejected ? "Rejectable" : (has(t, /\b(acceptable|passed|within (?:aws|code))\b/i) ? "Acceptable" : "Additional Examination Required");
  return { role: "CWI", conclusion: concl, code_cited: "AWS D1.1 / ASME IX", evidence_ref: firstMatch(t, /\b(weld[a-z ]*)\b/i), within_authority: true, escalation: "Engineer -> Asset Integrity -> Operations" };
}
function evalNDT(t: string): RoleOutput {
  var ndt = has(t, /\b(ut|paut|tofd|\brt\b|\bmt\b|\bpt\b|\bet\b|\bvt\b|radiograph|ultrasonic|thickness (?:reading|measurement)|borescope|inspection completed)\b/i);
  if (!ndt) { return { role: "NDT", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Engineer -> CWI -> Asset Integrity" }; }
  var indication = has(t, /\b(indication|crack indication|linear indication|recordable indication|flaw detected)\b/i) && !has(t, /\bno (?:crack |recordable )?indication/i);
  var concl = indication ? "Indication Present" : "Indication Absent";
  return { role: "NDT", conclusion: concl, code_cited: "ASME Section V / SNT-TC-1A", evidence_ref: firstMatch(t, /\b(ut|paut|tofd|borescope|ultrasonic|inspection)[a-z ]*/i), within_authority: true, escalation: "Engineer -> CWI -> Asset Integrity" };
}
function evalCoatings(t: string): RoleOutput {
  var coat = has(t, /\b(coating|dft|holiday test|surface prep|sspc|ampp|nace coat|recoat|coating breakdown)\b/i);
  if (!coat) { return { role: "COATINGS", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Corrosion Engineer -> Asset Integrity -> Operations" }; }
  var bad = has(t, /\b(coating (?:breakdown|failure)|holiday detected|disbond|recoat required)\b/i);
  var concl = bad ? "Recoat Required" : "Compliant";
  return { role: "COATINGS", conclusion: concl, code_cited: "AMPP/NACE / SSPC / ISO 12944", evidence_ref: firstMatch(t, /\b(coating[a-z ]*)\b/i), within_authority: true, escalation: "Corrosion Engineer -> Asset Integrity -> Operations" };
}
function evalEngineer(ctx: RoleContext, t: string): RoleOutput {
  var eng = has(t, /\b(fitness-for-service|ffs|stress|fatigue|corrosion|wall loss|remaining life|design|thickness|api 579|b31|asme)\b/i) || !!ctx.confirmedMechanism || (ctx.physical && ctx.physical !== "UNKNOWN");
  if (!eng) { return { role: "ENGINEER", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Operations -> Management -> Regulatory Authority" }; }
  var concl;
  if (ctx.confirmedMechanism && (ctx.hardLockCount || 0) > 0) { concl = "Not Fit For Service"; }
  else if (ctx.confirmedMechanism) { concl = "Repair Required"; }
  else if (ctx.physical === "SUSPECTED") { concl = "Engineering Evaluation Required"; }
  else if (ctx.physical === "ACCEPTABLE") { concl = "Fit For Service"; }
  else { concl = "Engineering Evaluation Required"; }
  var code = (ctx.authorityCodes && ctx.authorityCodes.length) ? ctx.authorityCodes[0] : "ASME / API 579";
  return { role: "ENGINEER", conclusion: concl, code_cited: code, evidence_ref: ctx.confirmedMechanism || (ctx.physical || null), within_authority: true, escalation: "Operations -> Management -> Regulatory Authority" };
}
function evalSafety(ctx: RoleContext, t: string): RoleOutput {
  // Safety is in-authority whenever there is a life-safety / consequence dimension.
  var safetyCtx = has(t, /\b(safety|hazard|loto|lockout|confined space|exposure|personnel|life safety|process safety|release|fatality|injury)\b/i) || tierRank(ctx.consequenceTier || "") >= 3 || (ctx.hardLockCount || 0) > 0;
  if (!safetyCtx) { return { role: "SAFETY", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Operations -> Engineering -> Management" }; }
  var concl;
  if ((ctx.hardLockCount || 0) > 0 || tierRank(ctx.consequenceTier || "") >= 4) { concl = "Immediate Hazard"; }
  else if (tierRank(ctx.consequenceTier || "") >= 3) { concl = "Restricted Operation"; }
  else { concl = "Safe"; }
  return { role: "SAFETY", conclusion: concl, code_cited: "OSHA 29 CFR 1910 / PSM", evidence_ref: "consequence tier " + (ctx.consequenceTier || "UNKNOWN") + (ctx.hardLockCount ? (", " + ctx.hardLockCount + " hard lock(s)") : ""), within_authority: true, escalation: "Operations -> Engineering -> Management" };
}
function evalOperations(t: string): RoleOutput {
  // PROVENANCE RULE: only a STATED operating constraint/envelope is usable. Inferred
  // production pressure / "leans CONTINUE" is FORBIDDEN.
  var statedEnvelope = firstMatch(t, /(?:operating envelope|operating limit|within (?:the )?envelope|outside (?:the )?envelope|process limit|must run (?:until|to)|permit condition|exceeds? (?:the )?operating)[^.]*/i);
  var outside = has(t, /\b(outside (?:the )?(?:operating )?envelope|exceeds? (?:the )?operating limit|beyond (?:the )?process limit)\b/i);
  if (!statedEnvelope) { return { role: "OPERATIONS", conclusion: OUT, code_cited: null, evidence_ref: null, within_authority: false, escalation: "Engineering -> Safety -> Executive Management" }; }
  var concl = outside ? "Outside Operating Envelope" : "Within Operating Envelope";
  return { role: "OPERATIONS", conclusion: concl, code_cited: "Operating procedures / OEM limits", evidence_ref: statedEnvelope, within_authority: true, escalation: "Engineering -> Safety -> Executive Management" };
}

export function deriveRoleOutputs(ctx: RoleContext): RoleOutput[] {
  var t = String(ctx.transcript || "");
  return [evalCWI(t), evalNDT(t), evalCoatings(t), evalEngineer(ctx, t), evalSafety(ctx, t), evalOperations(t)];
}

// ---- §4 conflict detection (count, never a score) ----
function directionOf(o: RoleOutput): string {
  var c = String(o.conclusion);
  if (/Immediate Hazard|Unsafe|Not Fit For Service|Rejectable|Non-Compliant/i.test(c)) { return "STOP"; }
  if (/Derated|Restricted Operation|Outside Operating Envelope/i.test(c)) { return "RESTRICT"; }
  if (/Fit For Service|Within Operating Envelope|Acceptable|Compliant|Safe|Indication Absent/i.test(c)) { return "CONTINUE"; }
  if (/Repair Required|Recoat Required|Additional Examination Required|Engineering Evaluation Required|Indication Present/i.test(c)) { return "REPAIR"; }
  return "NONE";
}
function incompatible(a: string, b: string): boolean {
  // STOP vs CONTINUE, and RESTRICT vs CONTINUE are the falsifiable conflicts.
  if (a === b) { return false; }
  var pair = [a, b].sort().join("|");
  return pair === "CONTINUE|STOP" || pair === "CONTINUE|RESTRICT";
}

export interface ConflictRecord { conflict_id: number; role_a: RoleId; conclusion_a: string; code_a: string | null; role_b: RoleId; conclusion_b: string; code_b: string | null; divergence: string; }
export interface RoleAuthorityResult {
  roles: RoleOutput[];
  conflict_count: number;
  conflict_list: ConflictRecord[];
  escalation_required: boolean;
  resolution: string;           // disposition-gating note (authority-kind based), never a score
}

export function analyzeRoleAuthority(ctx: RoleContext): RoleAuthorityResult {
  var roles = deriveRoleOutputs(ctx);
  var inAuth = roles.filter(function (r) { return r.within_authority && r.conclusion !== OUT; });
  var conflicts: ConflictRecord[] = []; var n = 0;
  for (var i = 0; i < inAuth.length; i++) {
    for (var j = i + 1; j < inAuth.length; j++) {
      var da = directionOf(inAuth[i]); var db = directionOf(inAuth[j]);
      if (incompatible(da, db)) {
        n++;
        conflicts.push({ conflict_id: n, role_a: inAuth[i].role, conclusion_a: inAuth[i].conclusion, code_a: inAuth[i].code_cited,
          role_b: inAuth[j].role, conclusion_b: inAuth[j].conclusion, code_b: inAuth[j].code_cited, divergence: da + " vs " + db });
      }
    }
  }
  // §4.5 resolution by authority KIND, not preference. A hard-authority STOP gates.
  var hardStop = inAuth.some(function (r) { return directionOf(r) === "STOP"; });
  var resolution;
  if (hardStop) { resolution = "A hard-authority STOP governs the disposition and escalates; it is not overridden by an operational/economic CONTINUE."; }
  else if (n > 0) { resolution = "Unresolved cross-discipline conflict; resolution requires escalation to the cited disciplines."; }
  else { resolution = "No cross-discipline authority conflict."; }
  return { roles: roles, conflict_count: n, conflict_list: conflicts, escalation_required: (n > 0 || hardStop), resolution: resolution };
}
