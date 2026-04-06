// FORGED NDT INTELLIGENCE OS — HardeningResultsPanel v1.2
// File: src/components/HardeningResultsPanel.tsx
// Build 2: Failure Mode Dominance + Disposition Pathway cards added

import React from 'react';

import TrustedFactsCard from '../TrustedFactsCard';
import RealityChallengeCard from '../RealityChallengeCard';
import UnknownStateCard from '../UnknownStateCard';
import MinimumDataRequiredCard from '../hardening/MinimumDataRequiredCard';
import AuthorityLockCard from '../AuthorityLockCard';
import RemainingStrengthCard from '../RemainingStrengthCard';
import FailureModeDominanceCard from '../FailureModeDominanceCard';
import DispositionPathwayCard from '../DispositionPathwayCard';

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
}

export default function HardeningResultsPanel({
  challengeResult,
  unknownStateResult,
  trustedFacts,
  visible,
  authorityLockResult,
  remainingStrengthResult,
  failureModeDominanceResult,
  dispositionPathwayResult
}: HardeningResultsPanelProps) {
  if (!visible) return null;

  var hasChallenge = challengeResult !== null;
  var hasUnknown = unknownStateResult !== null;
  var hasFacts = trustedFacts && trustedFacts.length > 0;
  var hasMinData = unknownStateResult &&
    unknownStateResult.minimum_data_required &&
    unknownStateResult.minimum_data_required.length > 0;
  var hasAuthority = authorityLockResult !== null && authorityLockResult !== undefined;
  var hasStrength = remainingStrengthResult !== null && remainingStrengthResult !== undefined;
  var hasFailureMode = failureModeDominanceResult !== null && failureModeDominanceResult !== undefined;
  var hasDisposition = dispositionPathwayResult !== null && dispositionPathwayResult !== undefined;

  if (!hasChallenge && !hasUnknown && !hasFacts && !hasAuthority && !hasStrength && !hasFailureMode && !hasDisposition) return null;

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
          v1.2
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

      {/* Build 2: Disposition Pathway */}
      {hasDisposition && (
        <DispositionPathwayCard result={dispositionPathwayResult} />
      )}

      {hasUnknown && unknownStateResult!.unknown_triggered && (
        <UnknownStateCard
          realityState={unknownStateResult!.reality_state}
          unknownTriggered={unknownStateResult!.unknown_triggered}
          reasonCodes={unknownStateResult!.unknown_reason_codes}
          unresolvedQuestions={unknownStateResult!.unresolved_questions}
          blockedQuestions={unknownStateResult!.blocked_questions}
          blocksDisposition={unknownStateResult!.unknown_blocks_final_disposition}
        />
      )}

      {hasChallenge && (
        <RealityChallengeCard
          challengeTriggered={challengeResult!.challenge_triggered}
          ambiguityScore={challengeResult!.ambiguity_score}
          ambiguityFlags={challengeResult!.ambiguity_flags}
          alternateHypotheses={challengeResult!.alternate_hypotheses}
          highestRiskHypothesis={challengeResult!.highest_risk_plausible_hypothesis}
          recommendation={challengeResult!.reality_lock_recommendation}
          primaryConfidence={challengeResult!.primary_reality_hypothesis.confidence}
          trace={challengeResult!.challenge_reasoning_trace}
        />
      )}

      {hasMinData && (
        <MinimumDataRequiredCard
          minimumData={unknownStateResult!.minimum_data_required}
          inspectionActions={unknownStateResult!.next_best_inspection_actions}
        />
      )}

      {hasFacts && (
        <TrustedFactsCard
          facts={trustedFacts}
          showProvenance={true}
        />
      )}

      {hasUnknown && !unknownStateResult!.unknown_triggered && (
        <UnknownStateCard
          realityState={unknownStateResult!.reality_state}
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
