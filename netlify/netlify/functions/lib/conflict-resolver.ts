/**
 * DEPLOY20_conflict-resolver.ts
 * Deploy to: netlify/functions/lib/conflict-resolver.ts
 *
 * Conflict Resolution Engine
 * When GPT-4o and Claude disagree on findings, this engine
 * applies deterministic rules to resolve the conflict.
 *
 * Conservative principle: if either AI flags a rejectable condition,
 * the system escalates rather than dismisses.
 */

interface AIFinding {
  finding_type: string;
  severity: string;
  confidence: number;
  source: string;
  location?: string;
  reasoning?: string;
}

interface ConflictResolution {
  finding_type: string;
  openai_assessment: string | null;
  openai_confidence: number;
  claude_assessment: string | null;
  claude_confidence: number;
  resolution_method: string;
  resolved_assessment: string;
  resolved_confidence: number;
  reasoning: string;
}

interface ConflictResult {
  resolutions: ConflictResolution[];
  merged_findings: AIFinding[];
  agreement_score: number;
  has_conflicts: boolean;
}

// Hard rejectable types - if EITHER AI finds these, escalate
var HARD_REJECTABLE = [
  "crack",
  "incomplete_fusion",
  "incomplete_penetration",
  "overlap"
];

// Threshold types - need measurement to decide
var THRESHOLD_TYPES = [
  "undercut",
  "porosity",
  "slag_inclusion",
  "burn_through",
  "reinforcement"
];

function resolveConflicts(
  openaiFindings: AIFinding[],
  claudeFindings: AIFinding[]
): ConflictResult {
  var resolutions: ConflictResolution[] = [];
  var mergedFindings: AIFinding[] = [];

  // Build lookup maps by finding_type
  var openaiMap: Record<string, AIFinding> = {};
  var claudeMap: Record<string, AIFinding> = {};

  for (var i = 0; i < openaiFindings.length; i++) {
    var key = openaiFindings[i].finding_type;
    if (!openaiMap[key] || openaiFindings[i].confidence > openaiMap[key].confidence) {
      openaiMap[key] = openaiFindings[i];
    }
  }

  for (var j = 0; j < claudeFindings.length; j++) {
    var cKey = claudeFindings[j].finding_type;
    if (!claudeMap[cKey] || claudeFindings[j].confidence > claudeMap[cKey].confidence) {
      claudeMap[cKey] = claudeFindings[j];
    }
  }

  // Get all unique finding types
  var allTypes: string[] = [];
  var typeSet: Record<string, boolean> = {};
  var allKeys = Object.keys(openaiMap).concat(Object.keys(claudeMap));
  for (var t = 0; t < allKeys.length; t++) {
    if (!typeSet[allKeys[t]]) {
      typeSet[allKeys[t]] = true;
      allTypes.push(allKeys[t]);
    }
  }

  var agreements = 0;
  var total = allTypes.length;

  for (var a = 0; a < allTypes.length; a++) {
    var findingType = allTypes[a];
    var oai = openaiMap[findingType] || null;
    var cld = claudeMap[findingType] || null;

    var oaiConf = oai ? oai.confidence : 0;
    var cldConf = cld ? cld.confidence : 0;
    var oaiSeverity = oai ? oai.severity : "none";
    var cldSeverity = cld ? cld.severity : "none";

    // CASE 1: Both agree the finding exists
    if (oai && cld) {
      agreements = agreements + 1;
      var avgConf = (oaiConf + cldConf) / 2;
      var boostConf = Math.min(avgConf * 1.15, 0.98); // Cross-validation boost

      var resolution: ConflictResolution = {
        finding_type: findingType,
        openai_assessment: oaiSeverity,
        openai_confidence: oaiConf,
        claude_assessment: cldSeverity,
        claude_confidence: cldConf,
        resolution_method: "DUAL_AGREEMENT",
        resolved_assessment: getHigherSeverity(oaiSeverity, cldSeverity),
        resolved_confidence: boostConf,
        reasoning: "Both AI engines identified " + findingType + ". Cross-validated confidence boosted from " + Math.round(avgConf * 100) + "% to " + Math.round(boostConf * 100) + "%."
      };

      resolutions.push(resolution);
      mergedFindings.push({
        finding_type: findingType,
        severity: resolution.resolved_assessment,
        confidence: boostConf,
        source: "merged",
        location: (oai ? oai.location : "") || (cld ? cld.location : ""),
        reasoning: "Dual AI agreement. " + resolution.reasoning
      });

      continue;
    }

    // CASE 2: Only OpenAI found it
    if (oai && !cld) {
      var isHardReject = HARD_REJECTABLE.indexOf(findingType) >= 0;

      if (isHardReject) {
        // Conservative: if either AI finds a hard-rejectable type, keep it
        resolutions.push({
          finding_type: findingType,
          openai_assessment: oaiSeverity,
          openai_confidence: oaiConf,
          claude_assessment: null,
          claude_confidence: 0,
          resolution_method: "CONSERVATIVE_ESCALATION",
          resolved_assessment: oaiSeverity,
          resolved_confidence: oaiConf * 0.85, // Penalize for single-source
          reasoning: findingType + " is a hard-rejectable condition. Conservative principle: single AI detection of a critical defect type is retained and flagged for verification. Confidence reduced 15% for single-source."
        });
        mergedFindings.push({
          finding_type: findingType,
          severity: oaiSeverity,
          confidence: oaiConf * 0.85,
          source: "openai_only_escalated",
          location: oai.location,
          reasoning: "Single AI detection of critical defect. Requires verification."
        });
      } else {
        // Non-critical: keep but flag as single-source
        resolutions.push({
          finding_type: findingType,
          openai_assessment: oaiSeverity,
          openai_confidence: oaiConf,
          claude_assessment: null,
          claude_confidence: 0,
          resolution_method: "SINGLE_SOURCE_RETAINED",
          resolved_assessment: oaiConf >= 0.7 ? oaiSeverity : "low",
          resolved_confidence: oaiConf * 0.8,
          reasoning: findingType + " detected by GPT-4o only. Claude physics reasoning did not identify this condition. Confidence reduced 20% for single-source detection."
        });
        mergedFindings.push({
          finding_type: findingType,
          severity: oaiConf >= 0.7 ? oaiSeverity : "low",
          confidence: oaiConf * 0.8,
          source: "openai_only",
          location: oai.location,
          reasoning: "Single AI detection. Measurement verification recommended."
        });
      }
      continue;
    }

    // CASE 3: Only Claude found it
    if (!oai && cld) {
      var isHardRejectC = HARD_REJECTABLE.indexOf(findingType) >= 0;

      if (isHardRejectC) {
        resolutions.push({
          finding_type: findingType,
          openai_assessment: null,
          openai_confidence: 0,
          claude_assessment: cldSeverity,
          claude_confidence: cldConf,
          resolution_method: "CONSERVATIVE_ESCALATION",
          resolved_assessment: cldSeverity,
          resolved_confidence: cldConf * 0.85,
          reasoning: findingType + " identified by Claude physics reasoning but not observed by GPT-4o vision. Conservative principle applied for critical defect type. May indicate subsurface condition not visible in photograph."
        });
        mergedFindings.push({
          finding_type: findingType,
          severity: cldSeverity,
          confidence: cldConf * 0.85,
          source: "claude_only_escalated",
          location: cld.location,
          reasoning: "Physics-based detection only. May require additional NDE method to confirm."
        });
      } else {
        resolutions.push({
          finding_type: findingType,
          openai_assessment: null,
          openai_confidence: 0,
          claude_assessment: cldSeverity,
          claude_confidence: cldConf,
          resolution_method: "SINGLE_SOURCE_RETAINED",
          resolved_assessment: cldConf >= 0.7 ? cldSeverity : "low",
          resolved_confidence: cldConf * 0.8,
          reasoning: findingType + " identified by Claude physics reasoning but not visually observed by GPT-4o. This may indicate a physics-based inference rather than visual detection."
        });
        mergedFindings.push({
          finding_type: findingType,
          severity: cldConf >= 0.7 ? cldSeverity : "low",
          confidence: cldConf * 0.8,
          source: "claude_only",
          location: cld.location,
          reasoning: "Physics inference only. Visual confirmation recommended."
        });
      }
    }
  }

  var agreementScore = total > 0 ? agreements / total : 0;

  return {
    resolutions: resolutions,
    merged_findings: mergedFindings,
    agreement_score: agreementScore,
    has_conflicts: agreements < total
  };
}

function getHigherSeverity(a: string, b: string): string {
  var order: Record<string, number> = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
    "none": 0
  };
  var aVal = order[a] || 0;
  var bVal = order[b] || 0;
  return aVal >= bVal ? a : b;
}

export { resolveConflicts, ConflictResolution, ConflictResult, AIFinding };
