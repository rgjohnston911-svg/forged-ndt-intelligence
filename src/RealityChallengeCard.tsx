// ============================================================================
// FORGED NDT INTELLIGENCE OS — RealityChallengeCard v1.0
// Sprint 1 UI Component
// ============================================================================

import React, { useState } from 'react';

interface AlternateHypothesis {
  hypothesis_id: string;
  finding_frame: string;
  mechanism_frame: string;
  confidence: number;
  risk_bias: 'lower' | 'equal' | 'higher';
  basis: string[];
}

interface HighestRiskHypothesis {
  hypothesis_id: string;
  reason: string;
  confidence: number;
}

interface RealityChallengeCardProps {
  challengeTriggered: boolean;
  ambiguityScore: number;
  ambiguityFlags: string[];
  alternateHypotheses: AlternateHypothesis[];
  highestRiskHypothesis: HighestRiskHypothesis | null;
  recommendation: string;
  primaryConfidence: number;
  trace: string[];
}

function getRecommendationStyle(rec: string): { label: string; color: string; bg: string; border: string } {
  switch (rec) {
    case 'accept_primary':
      return { label: 'ACCEPT PRIMARY', color: '#166534', bg: '#dcfce7', border: '#86efac' };
    case 'accept_with_guard':
      return { label: 'ACCEPT WITH GUARD', color: '#854d0e', bg: '#fef9c3', border: '#fde047' };
    case 'defer_to_unknown':
      return { label: 'DEFER TO UNKNOWN', color: '#9a3412', bg: '#ffedd5', border: '#fdba74' };
    case 'escalate_for_more_data':
      return { label: 'ESCALATE — MORE DATA NEEDED', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' };
    default:
      return { label: rec.toUpperCase(), color: '#374151', bg: '#f3f4f6', border: '#d1d5db' };
  }
}

function getRiskBiasStyle(bias: string): { label: string; color: string } {
  switch (bias) {
    case 'higher': return { label: 'HIGHER RISK', color: '#dc2626' };
    case 'equal': return { label: 'EQUAL RISK', color: '#d97706' };
    case 'lower': return { label: 'LOWER RISK', color: '#16a34a' };
    default: return { label: bias, color: '#6b7280' };
  }
}

export default function RealityChallengeCard({
  challengeTriggered,
  ambiguityScore,
  ambiguityFlags,
  alternateHypotheses,
  highestRiskHypothesis,
  recommendation,
  primaryConfidence,
  trace
}: RealityChallengeCardProps) {
  const [showTrace, setShowTrace] = useState(false);

  var recStyle = getRecommendationStyle(recommendation);
  var ambiguityPct = (ambiguityScore * 100).toFixed(0);

  if (!challengeTriggered) {
    return (
      <div style={{
        border: '1px solid #86efac',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
        background: '#f0fdf4'
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: '14px',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>&#10003;</span>
          Reality Challenge — Clear
        </div>
        <div style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
          Ambiguity score: {ambiguityPct}% — no significant ambiguity detected. Primary interpretation accepted.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid ' + recStyle.border,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: '14px',
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px', color: '#d97706' }}>&#9888;</span>
          Reality Challenge — Active
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: recStyle.color,
          background: recStyle.bg,
          padding: '3px 10px',
          borderRadius: '4px',
          letterSpacing: '0.5px'
        }}>
          {recStyle.label}
        </span>
      </div>

      {/* Ambiguity Score Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
          <span>Ambiguity Score</span>
          <span style={{ fontWeight: 600 }}>{ambiguityPct}%</span>
        </div>
        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: ambiguityPct + '%',
            background: ambiguityScore >= 0.65 ? '#dc2626' : ambiguityScore >= 0.35 ? '#d97706' : '#16a34a',
            borderRadius: '3px',
            transition: 'width 0.3s'
          }} />
        </div>
      </div>

      {/* Flags */}
      {ambiguityFlags.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Ambiguity Flags ({ambiguityFlags.length})
          </div>
          {ambiguityFlags.map(function(flag, i) {
            return (
              <div key={i} style={{
                fontSize: '12px',
                color: '#92400e',
                background: '#fffbeb',
                padding: '4px 8px',
                borderRadius: '4px',
                marginBottom: '3px',
                borderLeft: '3px solid #f59e0b'
              }}>
                {flag}
              </div>
            );
          })}
        </div>
      )}

      {/* Alternate Hypotheses */}
      {alternateHypotheses.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Alternate Hypotheses ({alternateHypotheses.length})
          </div>
          {alternateHypotheses.map(function(alt, i) {
            var riskStyle = getRiskBiasStyle(alt.risk_bias);
            var isHighest = highestRiskHypothesis && highestRiskHypothesis.hypothesis_id === alt.hypothesis_id;
            return (
              <div key={i} style={{
                border: isHighest ? '2px solid #dc2626' : '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '6px',
                background: isHighest ? '#fef2f2' : '#fafafa'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px', color: '#1f2937' }}>
                    {alt.hypothesis_id}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: riskStyle.color,
                    letterSpacing: '0.5px'
                  }}>
                    {riskStyle.label}
                  </span>
                  {isHighest && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#ffffff',
                      background: '#dc2626',
                      padding: '1px 6px',
                      borderRadius: '3px'
                    }}>
                      HIGHEST RISK
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto' }}>
                    Confidence: {(alt.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#374151' }}>
                  <strong>Finding:</strong> {alt.finding_frame.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '12px', color: '#374151' }}>
                  <strong>Mechanism:</strong> {alt.mechanism_frame.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Highest Risk Warning */}
      {highestRiskHypothesis && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
            Higher-Risk Interpretation Exists
          </div>
          <div style={{ fontSize: '12px', color: '#7f1d1d' }}>
            {highestRiskHypothesis.reason}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Primary confidence reduced to {(primaryConfidence * 100).toFixed(0)}% due to this alternate.
          </div>
        </div>
      )}

      {/* Trace Toggle */}
      <button
        onClick={function() { setShowTrace(!showTrace); }}
        style={{
          background: 'none',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '11px',
          color: '#6b7280',
          cursor: 'pointer'
        }}
      >
        {showTrace ? 'Hide' : 'Show'} Reasoning Trace ({trace.length} steps)
      </button>

      {showTrace && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
          {trace.map(function(t, i) {
            return <div key={i} style={{ padding: '2px 0' }}>{i + 1}. {t}</div>;
          })}
        </div>
      )}
    </div>
  );
}
