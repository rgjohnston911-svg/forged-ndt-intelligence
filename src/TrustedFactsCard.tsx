// ============================================================================
// FORGED NDT INTELLIGENCE OS — TrustedFactsCard v1.0
// Sprint 1 UI Component
// ============================================================================

import React from 'react';

interface TrustedFact {
  field: string;
  value: string;
  provenance: string;
  trust_weight: number;
}

interface TrustedFactsCardProps {
  facts: TrustedFact[];
  showProvenance?: boolean;
}

function getTrustBadge(weight: number): { label: string; color: string; bg: string } {
  if (weight >= 0.8) return { label: 'TRUSTED', color: '#166534', bg: '#dcfce7' };
  if (weight >= 0.5) return { label: 'MODERATE', color: '#854d0e', bg: '#fef9c3' };
  if (weight >= 0.3) return { label: 'DEWEIGHTED', color: '#9a3412', bg: '#ffedd5' };
  return { label: 'DISCARDED', color: '#991b1b', bg: '#fee2e2' };
}

function getProvenanceLabel(provenance: string): string {
  var map: Record<string, string> = {
    'measured': 'Direct Measurement',
    'observed': 'Direct Observation',
    'reported': 'Reported (Unverified)',
    'inferred': 'Inferred',
    'hearsay': 'Hearsay',
    'amended': 'Amended Value',
    'calculated': 'Calculated',
    'documented': 'Documented Record'
  };
  return map[provenance] || provenance;
}

export default function TrustedFactsCard({ facts, showProvenance = true }: TrustedFactsCardProps) {
  if (!facts || facts.length === 0) {
    return (
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
        background: '#f9fafb'
      }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
          Trusted Facts
        </div>
        <div style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>
          No trusted facts available for this analysis.
        </div>
      </div>
    );
  }

  var trusted = facts.filter(function(f) { return f.trust_weight >= 0.7; });
  var deweighted = facts.filter(function(f) { return f.trust_weight >= 0.3 && f.trust_weight < 0.7; });
  var discarded = facts.filter(function(f) { return f.trust_weight < 0.3; });

  return (
    <div style={{
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      background: '#ffffff'
    }}>
      <div style={{
        fontWeight: 700,
        fontSize: '14px',
        color: '#111827',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '16px' }}>&#9670;</span>
        Trusted Facts
        <span style={{
          fontSize: '11px',
          color: '#6b7280',
          fontWeight: 400,
          marginLeft: 'auto'
        }}>
          {trusted.length} trusted | {deweighted.length} deweighted | {discarded.length} discarded
        </span>
      </div>

      <div style={{ marginTop: '12px' }}>
        {facts.map(function(fact, index) {
          var badge = getTrustBadge(fact.trust_weight);
          return (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '8px 0',
              borderBottom: index < facts.length - 1 ? '1px solid #f3f4f6' : 'none',
              opacity: fact.trust_weight < 0.3 ? 0.5 : 1
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '2px'
                }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    {fact.field}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: badge.color,
                    background: badge.bg,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#1f2937' }}>
                  {fact.value}
                </div>
                {showProvenance && (
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Source: {getProvenanceLabel(fact.provenance)} | Trust: {(fact.trust_weight * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
