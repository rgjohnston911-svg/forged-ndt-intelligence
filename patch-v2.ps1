# patch-all-layers.ps1
# DEPLOY102 + DEPLOY105 COMBINED - Engineering + Architecture + Materials UI
# Run from Git Bash: powershell -ExecutionPolicy Bypass -File patch-all-layers.ps1
# Uses only confirmed anchors from DEPLOY100 clean file

$filePath = "src\pages\VoiceInspectionPage.tsx"

if (-not (Test-Path $filePath)) {
    Write-Error "ERROR: File not found at $filePath"
    Write-Error "Run from NDT Platform project root"
    exit 1
}

$raw = [System.IO.File]::ReadAllText((Resolve-Path $filePath))
Write-Host ("File loaded: " + ($raw -split "`n").Count + " lines")

# Confirm all 3 required anchors exist before touching anything
$a1 = 'var [decisionCore, setDecisionCore] = useState<any>(null);'
$a2 = '// Refs for continuation'
$a3 = 'setDecisionCore(coreResult);'
$a4 = '{/* DECISION TRACE (audit) */}'

if ($raw.IndexOf($a1) -lt 0) { Write-Error "ABORT: anchor 1 not found: $a1"; exit 1 }
if ($raw.IndexOf($a2) -lt 0) { Write-Error "ABORT: anchor 2 not found: $a2"; exit 1 }
if ($raw.IndexOf($a3) -lt 0) { Write-Error "ABORT: anchor 3 not found: $a3"; exit 1 }
if ($raw.IndexOf($a4) -lt 0) { Write-Error "ABORT: anchor 4 not found: $a4"; exit 1 }
Write-Host "All 4 anchors confirmed present"

# =====================================================================
# PATCH 1 - Add all new state vars after decisionCore state
# =====================================================================
$newStateVars = (
    "`r`n  var [engineeringResult, setEngineeringResult] = useState<any>(null);" +
    "`r`n  var [engineeringLoading, setEngineeringLoading] = useState(false);" +
    "`r`n  var [engineeringError, setEngineeringError] = useState<string | null>(null);" +
    "`r`n  var [showExpertMode, setShowExpertMode] = useState(false);" +
    "`r`n  var [architectureResult, setArchitectureResult] = useState<any>(null);" +
    "`r`n  var [architectureLoading, setArchitectureLoading] = useState(false);" +
    "`r`n  var [materialsResult, setMaterialsResult] = useState<any>(null);" +
    "`r`n  var [materialsLoading, setMaterialsLoading] = useState(false);" +
    "`r`n  var [showLayer3, setShowLayer3] = useState(false);"
)
$raw = $raw.Replace($a1, ($a1 + $newStateVars))
Write-Host "PATCH 1 OK: state vars added"

# =====================================================================
# PATCH 2 - Add all three layer calls after setDecisionCore(coreResult)
# =====================================================================
$callsAfterCore = (
    "`r`n          if (coreResult) {" +
    "`r`n            var txVal = '';" +
    "`r`n            try { if (typeof transcriptRef !== 'undefined' && transcriptRef && transcriptRef.current) { txVal = String(transcriptRef.current); } } catch(ex) {}" +
    "`r`n            callEngineeringCore(coreResult, txVal);" +
    "`r`n            callArchitectureCore(coreResult, txVal);" +
    "`r`n            callMaterialsCore(coreResult, txVal);" +
    "`r`n          }"
)
$raw = $raw.Replace($a3, ($a3 + $callsAfterCore))
Write-Host "PATCH 2 OK: layer calls added after setDecisionCore"

# =====================================================================
# PATCH 3 - Add all three async functions before "// Refs for continuation"
# =====================================================================
$engFn = (
    "  var callEngineeringCore = async function(decResult: any, narrativeText: string) {`r`n" +
    "    setEngineeringLoading(true); setEngineeringError(null);`r`n" +
    "    var ei: Record<string, any> = {`r`n" +
    "      caseId: 'ENG-' + String(Date.now()),`r`n" +
    "      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),`r`n" +
    "      consequenceTier: (decResult.consequence_reality || decResult.consequence || 'MODERATE'),`r`n" +
    "      ndtVerdict: (decResult.disposition || 'INDETERMINATE'),`r`n" +
    "      ndtConfidence: (decResult.reality_confidence || 0.5),`r`n" +
    "      primaryMechanism: (decResult.primary_mechanism || ''),`r`n" +
    "      governingStandard: (decResult.authority_reality || ''),`r`n" +
    "      incidentNarrative: narrativeText, isCyclicService: false, materialClass: ''`r`n" +
    "    };`r`n" +
    "    var nr = narrativeText.toLowerCase();`r`n" +
    "    if (nr.indexOf('stainless') >= 0 || nr.indexOf('316') >= 0 || nr.indexOf('304') >= 0) { ei.materialClass = 'austenitic_ss'; }`r`n" +
    "    else if (nr.indexOf('duplex') >= 0 || nr.indexOf('2205') >= 0) { ei.materialClass = 'duplex_ss'; }`r`n" +
    "    else if (nr.indexOf('carbon steel') >= 0 || nr.indexOf('a36') >= 0) { ei.materialClass = 'carbon_steel'; }`r`n" +
    "    else if (nr.indexOf('low alloy') >= 0 || nr.indexOf('p91') >= 0) { ei.materialClass = 'low_alloy'; }`r`n" +
    "    ei.isCyclicService = (nr.indexOf('cyclic') >= 0 || nr.indexOf('fatigue') >= 0 || nr.indexOf('vibrat') >= 0);`r`n" +
    "    if (nr.indexOf('crack') >= 0) { ei.flawType = 'crack'; } else if (nr.indexOf('corrosion') >= 0 || nr.indexOf('thinning') >= 0) { ei.flawType = 'corrosion'; } else if (nr.indexOf('pitting') >= 0) { ei.flawType = 'pitting'; } else if (nr.indexOf('dent') >= 0) { ei.flawType = 'dent'; }`r`n" +
    "    if (nr.indexOf('h2s') >= 0 || nr.indexOf('sour') >= 0) { ei.h2sPartialPressureMPa = 0.001; }`r`n" +
    "    if (nr.indexOf('chloride') >= 0 || nr.indexOf('seawater') >= 0) { ei.chloridePPM = 1000; }`r`n" +
    "    if (nr.indexOf('creep') >= 0 || nr.indexOf('elevated temp') >= 0) { ei.operatingTempC = 400; }`r`n" +
    "    try {`r`n" +
    "      var er = await fetch('/.netlify/functions/engineering-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ei) });`r`n" +
    "      if (er.ok) { var ed = await er.json(); setEngineeringResult(ed); }`r`n" +
    "      else { setEngineeringError('Engineering core status ' + er.status); }`r`n" +
    "    } catch(ex: any) { setEngineeringError('Engineering layer: ' + (ex.message || String(ex))); }`r`n" +
    "    finally { setEngineeringLoading(false); }`r`n" +
    "  };`r`n`r`n" +
    "  var callArchitectureCore = async function(decResult: any, narrativeText: string) {`r`n" +
    "    setArchitectureLoading(true);`r`n" +
    "    var ai: Record<string, any> = {`r`n" +
    "      caseId: 'ARCH-' + String(Date.now()),`r`n" +
    "      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),`r`n" +
    "      consequenceTier: (decResult.consequence_reality || 'MODERATE'),`r`n" +
    "      engineeringSignificance: (decResult.engineering_significance || 'MODERATE'),`r`n" +
    "      ndtVerdict: (decResult.disposition || 'INDETERMINATE'),`r`n" +
    "      riskRanking: (decResult.risk_ranking || 'MEDIUM'),`r`n" +
    "      incidentNarrative: narrativeText`r`n" +
    "    };`r`n" +
    "    try {`r`n" +
    "      var ar = await fetch('/.netlify/functions/architecture-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ai) });`r`n" +
    "      if (ar.ok) { var ad = await ar.json(); setArchitectureResult(ad); }`r`n" +
    "    } catch(ex) {} finally { setArchitectureLoading(false); }`r`n" +
    "  };`r`n`r`n" +
    "  var callMaterialsCore = async function(decResult: any, narrativeText: string) {`r`n" +
    "    setMaterialsLoading(true);`r`n" +
    "    var mi: Record<string, any> = {`r`n" +
    "      caseId: 'MAT-' + String(Date.now()),`r`n" +
    "      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),`r`n" +
    "      incidentNarrative: narrativeText`r`n" +
    "    };`r`n" +
    "    var nr2 = narrativeText.toLowerCase();`r`n" +
    "    if (nr2.indexOf('stainless') >= 0 || nr2.indexOf('316') >= 0) { mi.materialClass = 'austenitic_ss'; } else if (nr2.indexOf('duplex') >= 0) { mi.materialClass = 'duplex_ss'; } else if (nr2.indexOf('carbon steel') >= 0) { mi.materialClass = 'carbon_steel'; } else if (nr2.indexOf('low alloy') >= 0) { mi.materialClass = 'low_alloy'; }`r`n" +
    "    if (nr2.indexOf('pwht') >= 0 || nr2.indexOf('post weld heat') >= 0) { mi.pwhtApplied = true; }`r`n" +
    "    if (nr2.indexOf('h2s') >= 0 || nr2.indexOf('sour') >= 0) { mi.h2sPartialPressureMPa = 0.001; }`r`n" +
    "    if (nr2.indexOf('chloride') >= 0 || nr2.indexOf('seawater') >= 0) { mi.chloridePPM = 1000; }`r`n" +
    "    if (nr2.indexOf('cyclic') >= 0 || nr2.indexOf('fatigue') >= 0) { mi.isCyclicService = true; }`r`n" +
    "    try {`r`n" +
    "      var mr = await fetch('/.netlify/functions/materials-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mi) });`r`n" +
    "      if (mr.ok) { var md = await mr.json(); setMaterialsResult(md); }`r`n" +
    "    } catch(ex) {} finally { setMaterialsLoading(false); }`r`n" +
    "  };`r`n`r`n" +
    "  " + $a2
)
$raw = $raw.Replace(("  " + $a2), $engFn)
Write-Host "PATCH 3 OK: all three layer functions added"

# =====================================================================
# PATCH 4 - Add all UI cards before {/* DECISION TRACE (audit) */}
# Build the full card block as a single string then insert
# =====================================================================

$cards = (
"        {engineeringLoading && (`r`n" +
"          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(68,170,255,0.05)', border: '1px solid rgba(68,170,255,0.2)', borderRadius: '8px', margin: '8px 0' }}>`r`n" +
"            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(68,170,255,0.2)', borderTopColor: '#44aaff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />`r`n" +
"            <div style={{ fontSize: '13px', color: '#44aaff' }}>Engineering Intelligence Layer analyzing...</div>`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        {engineeringError && (`r`n" +
"          <div style={{ padding: '10px 14px', background: 'rgba(255,150,0,0.08)', border: '1px solid rgba(255,150,0,0.3)', borderRadius: '6px', fontSize: '12px', color: '#ffaa44', margin: '8px 0' }}>{'Engineering layer: ' + (engineeringError || '')}</div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        {engineeringResult && (`r`n" +
"          <div style={{ marginTop: '4px' }}>`r`n" +
"            {engineeringResult.engineeringOverrideFlag && (`r`n" +
"              <div style={{ background: '#1a0000', border: '2px solid #ff3333', borderRadius: '8px', padding: '14px 16px', margin: '10px 0', boxShadow: '0 0 12px rgba(255,51,51,0.25)' }}>`r`n" +
"                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>`r`n" +
"                  <span style={{ fontSize: '18px' }}>{'!'}</span>`r`n" +
"                  <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: '#ff4444', textTransform: 'uppercase' as const }}>{'ENGINEERING OVERRIDE ACTIVE'}</span>`r`n" +
"                </div>`r`n" +
"                <div style={{ fontSize: '12px', color: '#ffaaaa', lineHeight: 1.5, marginBottom: '6px' }}>{engineeringResult.overrideReason}</div>`r`n" +
"                {engineeringResult.arbitration && engineeringResult.arbitration.disagreementSummary && (<div style={{ fontSize: '11px', color: '#ff8888', borderTop: '1px solid #440000', paddingTop: '8px', fontStyle: 'italic' }}>{engineeringResult.arbitration.disagreementSummary}</div>)}`r`n" +
"                <div style={{ marginTop: '8px', fontSize: '11px', color: '#ffcccc', fontWeight: 600, textTransform: 'uppercase' as const }}>{'Engineering sign-off required before return to service'}</div>`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"            <div style={{ background: '#0f1a2a', border: '1px solid #1e3a5a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#4488aa', textTransform: 'uppercase' as const, marginBottom: '10px' }}>{'DUAL-CORE VERDICT'}</div>`r`n" +
"              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', alignItems: 'center', gap: '8px' }}>`r`n" +
"                <div>`r`n" +
"                  <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{'NDT INSPECTOR'}</div>`r`n" +
"                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#4488ff' }}>{decisionCore ? (decisionCore.disposition || 'HOLD') : '-'}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#446' }}>{decisionCore ? (decisionCore.authority_reality || '-') : '-'}</div>`r`n" +
"                </div>`r`n" +
"                <div style={{ textAlign: 'center' as const, color: '#444', fontSize: '12px', fontWeight: 600 }}>{'vs'}</div>`r`n" +
"                <div>`r`n" +
"                  <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{'ENGINEER'}</div>`r`n" +
"                  <div style={{ fontSize: '13px', fontWeight: 700, color: engineeringResult.engineeringSignificance === 'CRITICAL' ? '#ff4444' : engineeringResult.engineeringSignificance === 'HIGH' ? '#ff8c00' : '#44ff88' }}>{(engineeringResult.engineeringVerdict || '').replace(/_/g, ' ')}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#446' }}>{engineeringResult.primaryAuthority || '-'}</div>`r`n" +
"                </div>`r`n" +
"              </div>`r`n" +
"              {engineeringResult.engineeringOverrideFlag && (<div style={{ textAlign: 'center' as const, marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #330000', fontSize: '11px', color: '#ff6666', fontWeight: 600, textTransform: 'uppercase' as const }}>{'Verdicts disagree - Engineering governs'}</div>)}`r`n" +
"            </div>`r`n" +
"            <div style={{ background: '#0f1a0f', border: '1px solid #2a4a2a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, color: '#44aa44', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'STRUCTURAL SAFETY MARGIN (FAD)'}</div>`r`n" +
"              <div style={{ fontSize: '16px', fontWeight: 700, color: engineeringResult.safetyMarginPct === null ? '#888' : engineeringResult.safetyMarginPct < 10 ? '#ff4444' : engineeringResult.safetyMarginPct < 30 ? '#ff8c00' : '#44ff88' }}>{engineeringResult.safetyMarginPct !== null ? (String(engineeringResult.safetyMarginPct) + '% from failure boundary') : 'Flaw dimensions required for FAD'}</div>`r`n" +
"              <div style={{ fontSize: '11px', color: '#557', marginTop: '4px' }}>{(engineeringResult.e3 && engineeringResult.e3.fadStatus || '').replace(/_/g, ' ')}</div>`r`n" +
"              {engineeringResult.e3 && engineeringResult.e3.kr !== null && (<div style={{ fontSize: '11px', color: '#668', marginTop: '4px', fontFamily: 'monospace' }}>{'K_r=' + (engineeringResult.e3.kr || 0).toFixed(3) + ' | L_r=' + (engineeringResult.e3.lr || 0).toFixed(3)}</div>)}`r`n" +
"              {engineeringResult.e3 && engineeringResult.e3.hardGate && (<div style={{ marginTop: '8px', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '4px', padding: '5px 8px', fontSize: '11px', color: '#ff8888', fontWeight: 600 }}>{'HARD GATE - Level 3 Engineering Review Required'}</div>)}`r`n" +
"            </div>`r`n" +
"            <div style={{ background: '#1a100a', border: '1px solid #3a2010', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, color: '#cc8844', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'FAILURE MODE'}</div>`r`n" +
"              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffaa55' }}>{(engineeringResult.dominantFailureMode || '').replace(/_/g, ' ')}</div>`r`n" +
"              <div style={{ fontSize: '11px', color: '#887766', marginTop: '4px' }}>{'Confidence: ' + String(engineeringResult.failureModeConfidencePct || 0) + '% | Env: ' + (engineeringResult.e2 && engineeringResult.e2.environmentSeverity || '-')}</div>`r`n" +
"              {engineeringResult.e2 && engineeringResult.e2.secondaryMode && (<div style={{ fontSize: '11px', color: '#aa7744', marginTop: '4px' }}>{'Secondary: ' + engineeringResult.e2.secondaryMode.replace(/_/g, ' ')}</div>)}`r`n" +
"              <div style={{ fontSize: '11px', color: '#668', marginTop: '4px' }}>{'Recommended NDT: ' + (engineeringResult.recommendedNDTMethod || '').replace(/_/g, '/')}</div>`r`n" +
"            </div>`r`n" +
"            <div style={{ background: '#0a0a1a', border: '1px solid #2244aa', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, color: '#4466cc', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'REMAINING LIFE ESTIMATE'}</div>`r`n" +
"              <div style={{ fontSize: '15px', fontWeight: 700, color: engineeringResult.e5 && engineeringResult.e5.calendarMonthsLow !== null && engineeringResult.e5.calendarMonthsLow < 12 ? '#ff4444' : '#6688ff' }}>{engineeringResult.remainingLifeSummary || 'Insufficient data for life estimate'}</div>`r`n" +
"              {engineeringResult.e5 && engineeringResult.e5.minerDamageFraction !== null && (<div style={{ fontSize: '11px', color: '#557', marginTop: '4px' }}>{'Fatigue damage: ' + ((engineeringResult.e5.minerDamageFraction || 0) * 100).toFixed(0) + '% (Miner Rule)'}</div>)}`r`n" +
"              {engineeringResult.e5 && engineeringResult.e5.criticalFlawSizeMM !== null && (<div style={{ fontSize: '11px', color: '#668', marginTop: '4px', fontFamily: 'monospace' }}>{'Critical flaw size a_c: ' + (engineeringResult.e5.criticalFlawSizeMM || 0).toFixed(1) + 'mm'}</div>)}`r`n" +
"              {engineeringResult.e5 && engineeringResult.e5.hardGate && (<div style={{ marginTop: '8px', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '4px', padding: '5px 8px', fontSize: '11px', color: '#ff8888', fontWeight: 600 }}>{'GATE: ' + (engineeringResult.e5.hardGateReason || 'Life below safe threshold')}</div>)}`r`n" +
"            </div>`r`n" +
"            <div style={{ background: '#0d0a00', border: '1px solid #443300', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, color: '#aaaa44', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'RISK RANKING (API 580/581 RBI)'}</div>`r`n" +
"              <div style={{ fontSize: '16px', fontWeight: 800, color: engineeringResult.riskRanking === 'CRITICAL' ? '#ff4444' : engineeringResult.riskRanking === 'HIGH' ? '#ff8c00' : engineeringResult.riskRanking === 'MEDIUM' ? '#ffd700' : '#44ff88' }}>{engineeringResult.riskRanking}</div>`r`n" +
"              {engineeringResult.e6 && (<div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{'PoF: ' + String(engineeringResult.e6.pofCategory) + '/5 x CoF: ' + String(engineeringResult.e6.cofCategory) + '/5 = ' + String(engineeringResult.e6.riskScore) + '/25'}</div>)}`r`n" +
"              <div style={{ fontSize: '11px', color: '#778', marginTop: '4px' }}>{'Next inspection: ' + (engineeringResult.inspectionIntervalMonths === 0 ? 'IMMEDIATE' : String(engineeringResult.inspectionIntervalMonths) + ' months')}</div>`r`n" +
"            </div>`r`n" +
"            {engineeringResult.engineeringRestrictions && engineeringResult.engineeringRestrictions.length > 0 && (`r`n" +
"              <div style={{ background: '#1a0d00', border: '1px solid #553300', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                <div style={{ fontSize: '10px', fontWeight: 700, color: '#cc6600', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'ENGINEERING RESTRICTIONS'}</div>`r`n" +
"                {engineeringResult.engineeringRestrictions.map(function(r: string, i: number) { return <div key={i} style={{ fontSize: '12px', color: '#ffaa66', padding: '3px 0' }}>{'+ ' + r}</div>; })}`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"            <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"              <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'ENGINEERING SUMMARY'}</div>`r`n" +
"              <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.6 }}>{engineeringResult.simpleNarrative}</div>`r`n" +
"            </div>`r`n" +
"            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>`r`n" +
"              <button onClick={function() { setShowExpertMode(!showExpertMode); }} style={{ background: 'transparent', border: '1px solid ' + (showExpertMode ? '#44aaff' : '#555'), color: showExpertMode ? '#44aaff' : '#888', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>{showExpertMode ? 'Hide Expert Detail' : 'Show Expert Detail (FAD / Audit / Assumptions)'}</button>`r`n" +
"            </div>`r`n" +
"            {showExpertMode && (`r`n" +
"              <div style={{ borderTop: '1px solid #222', paddingTop: '10px' }}>`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'EVIDENCE INTEGRITY'}</div>`r`n" +
"                  <div style={{ fontSize: '12px', color: '#777' }}>{String(engineeringResult.evidenceIntegrityScore || 0) + '% measured | ' + (engineeringResult.evidenceIntegrityLabel || '').replace(/_/g, ' ')}</div>`r`n" +
"                </div>`r`n" +
"                {engineeringResult.domainViolations && engineeringResult.domainViolations.length > 0 && (`r`n" +
"                  <div style={{ background: '#1a0000', border: '1px solid #550000', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#aa3333', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'DOMAIN VIOLATIONS'}</div>`r`n" +
"                    {engineeringResult.domainViolations.map(function(v: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#ff8888', padding: '3px 0' }}>{'!! ' + v}</div>; })}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'ASSUMPTIONS (' + String((engineeringResult.assumptionFlags && engineeringResult.assumptionFlags.length) || 0) + ')'}</div>`r`n" +
"                  {engineeringResult.assumptionFlags && engineeringResult.assumptionFlags.map(function(a: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#666', padding: '2px 0' }}>{'[' + String(i + 1) + '] ' + a}</div>; })}`r`n" +
"                </div>`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'ENGINE AUDIT TRAIL'}</div>`r`n" +
"                  {engineeringResult.auditTrail && engineeringResult.auditTrail.map(function(line: string, i: number) { return <div key={i} style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace', padding: '2px 0', borderBottom: '1px solid #181818' }}>{line}</div>; })}`r`n" +
"                </div>`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        {(architectureLoading || materialsLoading) && (`r`n" +
"          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(170,68,255,0.05)', border: '1px solid rgba(170,68,255,0.2)', borderRadius: '8px', margin: '8px 0' }}>`r`n" +
"            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(170,68,255,0.2)', borderTopColor: '#aa44ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />`r`n" +
"            <div style={{ fontSize: '12px', color: '#aa44ff' }}>{'Layer 3 - Architecture + Materials Intelligence analyzing...'}</div>`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        {(architectureResult || materialsResult) && (`r`n" +
"          <div>`r`n" +
"            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>`r`n" +
"              <button onClick={function() { setShowLayer3(!showLayer3); }} style={{ background: 'transparent', border: '1px solid ' + (showLayer3 ? '#aa44ff' : '#555'), color: showLayer3 ? '#aa44ff' : '#888', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>{showLayer3 ? 'Hide Layer 3' : 'Show Layer 3: Architecture + Materials Intelligence'}</button>`r`n" +
"            </div>`r`n" +
"            {showLayer3 && architectureResult && (`r`n" +
"              <div>`r`n" +
"                {architectureResult.architectureOverrideFlag && (`r`n" +
"                  <div style={{ background: '#1a001a', border: '2px solid #aa44ff', borderRadius: '8px', padding: '14px 16px', margin: '10px 0' }}>`r`n" +
"                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>`r`n" +
"                      <span style={{ fontSize: '18px' }}>{'!!'}</span>`r`n" +
"                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#cc66ff', textTransform: 'uppercase' as const }}>{'ARCHITECTURE OVERRIDE ACTIVE'}</span>`r`n" +
"                    </div>`r`n" +
"                    <div style={{ fontSize: '12px', color: '#ddaaff', lineHeight: 1.5 }}>{architectureResult.simpleNarrative}</div>`r`n" +
"                    {architectureResult.engineeringRecomputeRequired && (<div style={{ marginTop: '8px', fontSize: '11px', color: '#cc88ff', fontWeight: 600, textTransform: 'uppercase' as const }}>{'System consequence exceeds component-only engineering - re-assessment required'}</div>)}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"                <div style={{ background: '#0f0a1a', border: '1px solid #2a1a4a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#8855cc', textTransform: 'uppercase' as const, marginBottom: '8px', letterSpacing: '0.08em' }}>{'SYSTEM ARCHITECTURE'}</div>`r`n" +
"                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'FACILITY TYPE'}</div><div style={{ fontSize: '12px', fontWeight: 700, color: '#aa88ff' }}>{(architectureResult.facilityType || '').replace(/_/g, ' ').toUpperCase()}</div></div>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'SYSTEM ROLE'}</div><div style={{ fontSize: '12px', fontWeight: 700, color: architectureResult.criticalityClass === 'CRITICAL' ? '#ff4444' : '#aa88ff' }}>{architectureResult.criticalityClass || ''}</div></div>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'REDUNDANCY'}</div><div style={{ fontSize: '11px', fontWeight: 600, color: architectureResult.spofFlag ? '#ff4444' : '#aa88ff' }}>{(architectureResult.redundancyState || '').replace(/_/g, ' ')}</div></div>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'FACILITY RISK'}</div><div style={{ fontSize: '13px', fontWeight: 700, color: architectureResult.facilityRiskRanking === 'CRITICAL' ? '#ff4444' : architectureResult.facilityRiskRanking === 'HIGH' ? '#ff8c00' : '#44ff88' }}>{architectureResult.facilityRiskRanking}</div></div>`r`n" +
"                  </div>`r`n" +
"                  {architectureResult.spofFlag && (<div style={{ marginTop: '10px', background: 'rgba(255,50,50,0.12)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#ff8888', fontWeight: 600 }}>{'SINGLE POINT OF FAILURE - No backup capacity at this location'}</div>)}`r`n" +
"                </div>`r`n" +
"                {architectureResult.combinedRiskScenarios && architectureResult.combinedRiskScenarios.length > 0 && (`r`n" +
"                  <div style={{ background: '#100a1a', border: '1px solid #3a1a5a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#8855cc', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'CASCADE RISK - ' + ((architectureResult.cascadeProbability || 0) * 100).toFixed(0) + '%'}</div>`r`n" +
"                    {architectureResult.combinedRiskScenarios.map(function(s: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#aa66ee', padding: '2px 0' }}>{'> ' + s}</div>; })}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"                {architectureResult.regulatoryOverrideFlag && (`r`n" +
"                  <div style={{ background: '#0a0a1a', border: '1px solid #334', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#6688cc', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'REGULATORY OVERRIDE'}</div>`r`n" +
"                    <div style={{ fontSize: '12px', color: '#8899dd', lineHeight: 1.5 }}>{architectureResult.regulatoryNarrative}</div>`r`n" +
"                    {architectureResult.requiredDocumentation && architectureResult.requiredDocumentation.slice(0, 3).map(function(d: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#6677bb', padding: '2px 0', marginTop: '4px' }}>{'- ' + d}</div>; })}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'REPAIR PRIORITY'}</div>`r`n" +
"                  <div style={{ fontSize: '14px', fontWeight: 700, color: architectureResult.repairPriority === 'IMMEDIATE' ? '#ff4444' : architectureResult.repairPriority === 'URGENT' ? '#ff8c00' : '#aaa' }}>{(architectureResult.repairPriority || '').replace(/_/g, ' ')}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{'Trend: ' + (architectureResult.trendState || '').replace(/_/g, ' ') + ' | ' + (architectureResult.regulatoryBody || '-')}</div>`r`n" +
"                </div>`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"            {showLayer3 && materialsResult && (`r`n" +
"              <div>`r`n" +
"                <div style={{ background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#44bb44', textTransform: 'uppercase' as const, marginBottom: '8px', letterSpacing: '0.08em' }}>{'MATERIALS INTELLIGENCE'}</div>`r`n" +
"                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'HAZ HARDNESS'}</div><div style={{ fontSize: '12px', fontWeight: 700, color: materialsResult.hardnessStatus === 'ACCEPTABLE' ? '#44ff88' : materialsResult.hardnessStatus === 'NEAR_LIMIT' ? '#ffd700' : '#ff4444' }}>{String(materialsResult.hvHAZPeak || 0) + ' HV'}</div></div>`r`n" +
"                    <div><div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'MATERIALS RISK'}</div><div style={{ fontSize: '12px', fontWeight: 700, color: materialsResult.materialsRiskLevel === 'CRITICAL' ? '#ff4444' : materialsResult.materialsRiskLevel === 'HIGH' ? '#ff8c00' : '#44ff88' }}>{materialsResult.materialsRiskLevel}</div></div>`r`n" +
"                  </div>`r`n" +
"                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#557755' }}>{'Mechanism: ' + (materialsResult.dominantDamageMechanism || '').replace(/_/g, ' ')}</div>`r`n" +
"                </div>`r`n" +
"                <div style={{ background: '#1a0a00', border: '1px solid #3a2200', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#dd8822', textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '0.08em' }}>{'PRE-FLAW PREDICTION'}</div>`r`n" +
"                  {materialsResult.likelyInitiationZones && materialsResult.likelyInitiationZones.map(function(z: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#ffaa44', padding: '3px 0' }}>{'[' + String(i + 1) + '] ' + z}</div>; })}`r`n" +
"                  {materialsResult.timeToInitiationMonths !== null && materialsResult.timeToInitiationMonths !== undefined && (<div style={{ marginTop: '8px', fontSize: '12px', color: '#ff8844', fontWeight: 600 }}>{'Time to initiation: ' + materialsResult.timeToInitiationMonths.toFixed(0) + ' months'}</div>)}`r`n" +
"                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#886644', fontStyle: 'italic' }}>{materialsResult.expectedFlawMorphology}</div>`r`n" +
"                </div>`r`n" +
"                <div style={{ background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#44bb44', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'INSPECTION DIRECTIVES'}</div>`r`n" +
"                  {materialsResult.inspectionPriority && materialsResult.inspectionPriority.map(function(p: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#88cc88', padding: '3px 0' }}>{'> ' + p}</div>; })}`r`n" +
"                </div>`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{'MATERIALS SUMMARY'}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#777', lineHeight: 1.6 }}>{materialsResult.simpleNarrative}</div>`r`n" +
"                </div>`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        " + $a4
)

$raw = $raw.Replace(("        " + $a4), $cards)
Write-Host "PATCH 4 OK: all UI cards added before Decision Trace"

# =====================================================================
# Verify all patches actually applied
# =====================================================================
if ($raw.IndexOf("callEngineeringCore") -lt 0) { Write-Warning "WARNING: callEngineeringCore not found after patching - PATCH 3 may have failed" }
if ($raw.IndexOf("engineeringResult") -lt 0) { Write-Warning "WARNING: engineeringResult not found after patching - PATCH 1 may have failed" }
if ($raw.IndexOf("architectureResult") -lt 0) { Write-Warning "WARNING: architectureResult not found after patching - PATCH 1 may have failed" }
if ($raw.IndexOf("PRE-FLAW PREDICTION") -lt 0) { Write-Warning "WARNING: materials cards not found - PATCH 4 may have failed" }

# =====================================================================
# Write file
# =====================================================================
[System.IO.File]::WriteAllText((Resolve-Path $filePath), $raw, [System.Text.Encoding]::UTF8)
$finalLines = ($raw -split "`n").Count
Write-Host ""
Write-Host ("SUCCESS: File written. Final line count: " + $finalLines)
Write-Host "Verify with: grep -c 'callEngineeringCore' src/pages/VoiceInspectionPage.tsx"
Write-Host ""
Write-Host "Next: git add src/pages/VoiceInspectionPage.tsx"
Write-Host "      git commit -m 'DEPLOY102+105 full intelligence stack UI'"
Write-Host "      git push"
