// FORGED NDT INTELLIGENCE OS — HardeningResultsPanel v1.4
// File: src/components/HardeningResultsPanel.tsx
// v1.4: Null-safe guards on RealityChallengeCard prop pass
//       Fixes crash: "Cannot read properties of undefined (reading 'confidence')"
//       Root cause: challengeResult!.primary_reality_hypothesis.confidence was
//       blowing up when challengeResult existed but primary_reality_hypothesis
//       was undefined (e.g. when the hardening pipeline short-circuits).
//       Same fragility existed on UnknownStateCard prop pass — also guarded.

import React from 'react';

import TrustedFactsCard from '../TrustedFactsCard';
import RealityChallengeCard from '../RealityChallengeCard';
import UnknownStateCard from '../UnknownStateCard';
import MinimumDataRequiredCard from '../hardening/MinimumDataRequiredCard';
import AuthorityLockCard from '../AuthorityLockCard';
import RemainingStrengthCard from '../RemainingStrengthCard';
import FailureModeDominanceCard from '../FailureModeDominanceCard';
import DispositionPathwayCard from '../DispositionPathwayCard';
import FailureTimelineCard from '../FailureTimelineCard';

import type {
  RealityChallengeResult,
  UnknownStateResult,
  TrustedFact
} from '../hardening-types';

interface HardeningResultsPanelProps {
  challengeResult: RealityChallengeResult | null;
  unknownStateResult: UnknownStateResult | null;
  trustedFacts: TrustedFact[];
  visible: boolean;
  authorityLockResult?: any;
  remainingStrengthResult?: any;
  failureModeDominanceResult?: any;
  dispositionPathwayResult?: any;
  failureTimelineResult?: any;
}

export default function HardeningResultsPanel({
  challengeResult,
  unknownStateResult,
  trustedFacts,
  visible,
  authorityLockResult,
  remainingStrengthResult,
  failureModeDominanceResult,
  dispositionPathwayResult,
  failureTimelineResult
}: HardeningResultsPanelProps) {
  if (!visible) return null;

  // v1.4: stricter "has" checks — must be truthy AND have the nested shape
  // the child cards need. Avoids passing partial objects that crash on render.
  var hasChallenge = challengeResult !== null
    && challengeResult !== undefined
    && challengeResult.primary_reality_hypothesis !== null
    && challengeResult.primary_reality_hypothesis !== undefined;

  var hasUnknown = unknownStateResult !== null && unknownStateResult !== undefined;
  var hasFacts = trustedFacts && trustedFacts.length > 0;
  var hasMinData = unknownStateResult
    && unknownStateResult.minimum_data_required
    && unknownStateResult.minimum_data_required.length > 0;
  var hasAuthority = authorityLockResult !== null && authorityLockResult !== undefined;
  var hasStrength = remainingStrengthResult !== null && remainingStrengthResult !== undefined;
  var hasFailureMode = failureModeDominanceResult !== null && failureModeDominanceResult !== undefined;
  var hasDisposition = dispositionPathwayResult !== null && dispositionPathwayResult !== undefined;
  var hasTimeline = failureTimelineResult !== null && failureTimelineResult !== undefined;

  if (!hasChallenge && !hasUnknown && !hasFacts && !hasAuthority && !hasStrength && !hasFailureMode && !hasDisposition && !hasTimeline) return null;

  var isWarningState = (unknownStateResult && unknownStateResult.unknown_triggered) ||
    (challengeResult && challengeResult.challenge_triggered);

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px',
      borderTop: '2px solid ' + (isWarningState ? '#f59e0b' : '#e5e7eb'),
      paddingTop: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          color: isWarningState ? '#92400e' : '#374151',
          textTransform: 'uppercase' as const,
          letterSpacing: '1px'
        }}>
          {isWarningState ? '\u26A0 ' : '\u2713 '}
          System Hardening Analysis
        </span>
        <span style={{
          fontSize: '10px',
          color: '#9ca3af',
          fontWeight: 400,
          letterSpacing: '0.5px'
        }}>
          v1.4
        </span>
      </div>

      {/* Build 1: Authority Lock — renders FIRST */}
      {hasAuthority && (
        <AuthorityLockCard result={authorityLockResult} />
      )}

      {/* Build 1: Remaining Strength */}
      {hasStrength && (
        <RemainingStrengthCard result={remainingStrengthResult} />
      )}

      {/* Build 2: Failure Mode Dominance */}
      {hasFailureMode && (
        <FailureModeDominanceCard result={failureModeDominanceResult} />
      )}

      {/* Build 3: Failure Timeline */}
      {hasTimeline && (
        <FailureTimelineCard result={failureTimelineResult} />
      )}

      {/* Build 2: Disposition Pathway */}
      {hasDisposition && (
        <DispositionPathwayCard result={dispositionPathwayResult} />
      )}

      {/* v1.4: defensive — null-coalesce every field instead of using ! assertions */}
      {hasUnknown && unknownStateResult && unknownStateResult.unknown_triggered && (
        <UnknownStateCard
          realityState={unknownStateResult.reality_state || "unknown"}
          unknownTriggered={unknownStateResult.unknown_triggered || false}
          reasonCodes={unknownStateResult.unknown_reason_codes || []}
          unresolvedQuestions={unknownStateResult.unresolved_questions || []}
          blockedQuestions={unknownStateResult.blocked_questions || []}
          blocksDisposition={unknownStateResult.unknown_blocks_final_disposition || false}
        />
      )}

      {/* v1.4: THE FIX — primary_reality_hypothesis can be undefined even when
          challengeResult exists. Was crashing here on .confidence read. */}
      {hasChallenge && challengeResult && (
        <RealityChallengeCard
          challengeTriggered={challengeResult.challenge_triggered || false}
          ambiguityScore={challengeResult.ambiguity_score || 0}
          ambiguityFlags={challengeResult.ambiguity_flags || []}
          alternateHypotheses={challengeResult.alternate_hypotheses || []}
          highestRiskHypothesis={challengeResult.highest_risk_plausible_hypothesis || null}
          recommendation={challengeResult.reality_lock_recommendation || ""}
          primaryConfidence={
            challengeResult.primary_reality_hypothesis
              && typeof challengeResult.primary_reality_hypothesis.confidence === "number"
              ? challengeResult.primary_reality_hypothesis.confidence
              : 0
          }
          trace={challengeResult.challenge_reasoning_trace || []}
        />
      )}

      {hasMinData && unknownStateResult && (
        <MinimumDataRequiredCard
          minimumData={unknownStateResult.minimum_data_required || []}
          inspectionActions={unknownStateResult.next_best_inspection_actions || []}
        />
      )}

      {hasFacts && (
        <TrustedFactsCard
          facts={trustedFacts}
          showProvenance={true}
        />
      )}

      {hasUnknown && unknownStateResult && !unknownStateResult.unknown_triggered && (
        <UnknownStateCard
          realityState={unknownStateResult.reality_state || "unknown"}
          unknownTriggered={false}
          reasonCodes={[]}
          unresolvedQuestions={[]}
          blockedQuestions={[]}
          blocksDisposition={false}
        />
      )}
    </div>
  );
}
