// ============================================================================
// FORGED NDT INTELLIGENCE OS — UnknownStateCard v1.0
// Sprint 1 UI Component
// ============================================================================

import React from 'react';

interface UnknownStateCardProps {
  realityState: string;
  unknownTriggered: boolean;
  reasonCodes: string[];
  unresolvedQuestions: string[];
  blockedQuestions: string[];
  blocksDisposition: boolean;
}

function getStateStyle(state: string): { color: string; bg: string; border: string; icon: string } {
  switch (state) {
    case 'CONFIRMED':
      return { color: '#166534', bg: '#dcfce7', border: '#86efac', icon: '\u2713' };
    case 'PROBABLE':
      return { color: '#166534', bg: '#ecfdf5', border: '#a7f3d0', icon: '\u2713' };
    case 'POSSIBLE':
      return { color: '#854d0e', bg: '#fef9c3', border: '#fde047', icon: '?' };
    case 'UNVERIFIED':
      return { color: '#9a3412', bg: '#ffedd5', border: '#fdba74', icon: '!' };
    case 'UNKNOWN':
      return { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: '\u26A0' };
    case 'UNRESOLVABLE_WITH_CURRENT_DATA':
      return { color: '#ffffff', bg: '#991b1b', border: '#7f1d1d', icon: '\u2716' };
    default:
      return { color: '#374151', bg: '#f3f4f6', border: '#d1d5db', icon: '?' };
  }
}

function formatReasonCode(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

export default function UnknownStateCard({
  realityState,
  unknownTriggered,
  reasonCodes,
  unresolvedQuestions,
  blockedQuestions,
  blocksDisposition
}: UnknownStateCardProps) {
  var stateStyle = getStateStyle(realityState);

  if (!unknownTriggered) {
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
          <span style={{ fontSize: '16px' }}>{stateStyle.icon}</span>
          Reality State: {realityState}
        </div>
        <div style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
          All required data present. No unresolved conditions detected.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '2px solid ' + stateStyle.border,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      background: '#ffffff'
    }}>
      {/* State Banner */}
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
          <span style={{ fontSize: '18px', color: stateStyle.color }}>{stateStyle.icon}</span>
          Reality State
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: stateStyle.color,
          background: stateStyle.bg,
          padding: '4px 12px',
          borderRadius: '4px',
          letterSpacing: '0.5px'
        }}>
          {realityState.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Disposition Block Warning */}
      {blocksDisposition && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>&#9888;</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
              BLOCKS FINAL DISPOSITION
            </div>
            <div style={{ fontSize: '11px', color: '#7f1d1d' }}>
              GO and CONDITIONAL GO decisions are blocked until unresolved conditions are addressed.
            </div>
          </div>
        </div>
      )}

      {/* Reason Codes */}
      {reasonCodes.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Reason Codes ({reasonCodes.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px' }}>
            {reasonCodes.map(function(code, i) {
              return (
                <span key={i} style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fffbeb',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #fde68a'
                }}>
                  {formatReasonCode(code)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Unresolved Questions */}
      {unresolvedQuestions.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Unresolved Questions ({unresolvedQuestions.length})
          </div>
          {unresolvedQuestions.map(function(q, i) {
            return (
              <div key={i} style={{
                fontSize: '12px',
                color: '#1f2937',
                padding: '6px 8px',
                background: '#fefce8',
                borderRadius: '4px',
                marginBottom: '3px',
                borderLeft: '3px solid #eab308'
              }}>
                {q}
              </div>
            );
          })}
        </div>
      )}

      {/* Blocked Questions */}
      {blockedQuestions.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>
            Blocked ({blockedQuestions.length})
          </div>
          {blockedQuestions.map(function(q, i) {
            return (
              <div key={i} style={{
                fontSize: '12px',
                color: '#7f1d1d',
                padding: '6px 8px',
                background: '#fef2f2',
                borderRadius: '4px',
                marginBottom: '3px',
                borderLeft: '3px solid #ef4444'
              }}>
                {q}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
