// ============================================================================
// FORGED NDT INTELLIGENCE OS — MinimumDataRequiredCard v1.0
// Sprint 1 UI Component
// ============================================================================

import React from 'react';

interface MinimumDataItem {
  question: string;
  required_data: string;
  preferred_method: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
}

interface NextBestInspectionAction {
  action_id: string;
  method: string;
  target: string;
  purpose: string;
  release_condition: string;
}

interface MinimumDataRequiredCardProps {
  minimumData: MinimumDataItem[];
  inspectionActions: NextBestInspectionAction[];
}

function getPriorityStyle(priority: string): { label: string; color: string; bg: string; border: string } {
  switch (priority) {
    case 'critical':
      return { label: 'CRITICAL', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' };
    case 'high':
      return { label: 'HIGH', color: '#9a3412', bg: '#ffedd5', border: '#fdba74' };
    case 'medium':
      return { label: 'MEDIUM', color: '#854d0e', bg: '#fef9c3', border: '#fde047' };
    default:
      return { label: priority.toUpperCase(), color: '#374151', bg: '#f3f4f6', border: '#d1d5db' };
  }
}

export default function MinimumDataRequiredCard({
  minimumData,
  inspectionActions
}: MinimumDataRequiredCardProps) {
  if ((!minimumData || minimumData.length === 0) && (!inspectionActions || inspectionActions.length === 0)) {
    return null;
  }

  var criticalCount = minimumData.filter(function(d) { return d.priority === 'critical'; }).length;

  return (
    <div style={{
      border: criticalCount > 0 ? '2px solid #fca5a5' : '1px solid #d1d5db',
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
          <span style={{ fontSize: '16px', color: '#d97706' }}>&#9998;</span>
          Minimum Data Required
        </div>
        {criticalCount > 0 && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#991b1b',
            background: '#fee2e2',
            padding: '3px 10px',
            borderRadius: '4px'
          }}>
            {criticalCount} CRITICAL
          </span>
        )}
      </div>

      {/* Data Requirements */}
      {minimumData.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Data Gaps to Resolve
          </div>
          {minimumData.map(function(item, i) {
            var prioStyle = getPriorityStyle(item.priority);
            return (
              <div key={i} style={{
                border: '1px solid ' + prioStyle.border,
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '8px',
                background: '#fafafa'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: prioStyle.color,
                    background: prioStyle.bg,
                    padding: '2px 8px',
                    borderRadius: '3px',
                    letterSpacing: '0.5px'
                  }}>
                    {prioStyle.label}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1f2937'
                  }}>
                    {item.question}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                  <strong>Required:</strong> {item.required_data}
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                  <strong>Preferred Method:</strong> {item.preferred_method}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                  {item.reason}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Next Best Inspection Actions */}
      {inspectionActions.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Recommended Next Inspection Actions
          </div>
          {inspectionActions.map(function(action, i) {
            return (
              <div key={i} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '6px',
                background: '#f0f9ff',
                borderLeft: '3px solid #3b82f6'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#1e40af',
                    background: '#dbeafe',
                    padding: '2px 6px',
                    borderRadius: '3px'
                  }}>
                    {action.action_id}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                    {action.method}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>
                  <strong>Target:</strong> {action.target}
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>
                  <strong>Purpose:</strong> {action.purpose}
                </div>
                <div style={{ fontSize: '11px', color: '#1e40af' }}>
                  <strong>Release Condition:</strong> {action.release_condition}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
