# patch-arch-materials.ps1
# DEPLOY105 - Architecture + Materials UI Cards
# Run from Git Bash: powershell -ExecutionPolicy Bypass -File patch-arch-materials.ps1
# Adds architecture-core and materials-core calls + UI cards to VoiceInspectionPage.tsx

$filePath = "src\pages\VoiceInspectionPage.tsx"

if (-not (Test-Path $filePath)) {
    Write-Error "ERROR: File not found: $filePath"
    exit 1
}

$content = Get-Content $filePath -Raw -Encoding UTF8
$originalLines = ($content -split "`n").Count
Write-Host "File loaded: $originalLines lines"

# =====================================================================
# PATCH 1: Add architecture + materials state vars
# =====================================================================
$P1_FIND = 'var [showExpertMode, setShowExpertMode] = useState(false);'
if ($content.IndexOf($P1_FIND) -eq -1) {
    Write-Error "PATCH 1 FAILED - anchor not found"
    exit 1
}
$P1_INSERT = $P1_FIND + "`r`n  var [architectureResult, setArchitectureResult] = useState<any>(null);" + "`r`n  var [architectureLoading, setArchitectureLoading] = useState(false);" + "`r`n  var [materialsResult, setMaterialsResult] = useState<any>(null);" + "`r`n  var [materialsLoading, setMaterialsLoading] = useState(false);" + "`r`n  var [showLayer3, setShowLayer3] = useState(false);"
$content = $content.Replace($P1_FIND, $P1_INSERT)
Write-Host "PATCH 1 OK: architecture + materials state vars added"

# =====================================================================
# PATCH 2: Add architecture + materials calls after engineering call
# =====================================================================
$P2_FIND = "    callEngineeringCore(coreResult, txRef);"
if ($content.IndexOf($P2_FIND) -eq -1) {
    Write-Error "PATCH 2 FAILED - anchor not found"
    exit 1
}
$P2_INSERT = $P2_FIND + "`r`n            callArchitectureCore(coreResult, txRef);" + "`r`n            callMaterialsCore(coreResult, txRef);"
$content = $content.Replace($P2_FIND, $P2_INSERT)
Write-Host "PATCH 2 OK: callArchitectureCore + callMaterialsCore calls added"

# =====================================================================
# PATCH 3: Add callArchitectureCore + callMaterialsCore functions
# =====================================================================
$P3_FIND = '  var callEngineeringCore = async function'
if ($content.IndexOf($P3_FIND) -eq -1) {
    Write-Error "PATCH 3 FAILED - anchor not found"
    exit 1
}

$archFunc = "  var callArchitectureCore = async function(decResult: any, narrativeText: string) {`r`n" +
"    setArchitectureLoading(true);`r`n" +
"    var archInput: Record<string, any> = {`r`n" +
"      caseId: 'ARCH-' + String(Date.now()),`r`n" +
"      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),`r`n" +
"      consequenceTier: (decResult.consequence_reality || 'MODERATE'),`r`n" +
"      engineeringSignificance: (decResult.engineering_significance || 'MODERATE'),`r`n" +
"      ndtVerdict: (decResult.disposition || 'INDETERMINATE'),`r`n" +
"      riskRanking: (decResult.risk_ranking || 'MEDIUM'),`r`n" +
"      incidentNarrative: narrativeText`r`n" +
"    };`r`n" +
"    try {`r`n" +
"      var archRes = await fetch('/.netlify/functions/architecture-core', {`r`n" +
"        method: 'POST',`r`n" +
"        headers: { 'Content-Type': 'application/json' },`r`n" +
"        body: JSON.stringify(archInput)`r`n" +
"      });`r`n" +
"      if (archRes.ok) { var archData = await archRes.json(); setArchitectureResult(archData); }`r`n" +
"    } catch(e) { /* architecture layer optional */ } finally { setArchitectureLoading(false); }`r`n" +
"  };`r`n`r`n" +
"  var callMaterialsCore = async function(decResult: any, narrativeText: string) {`r`n" +
"    setMaterialsLoading(true);`r`n" +
"    var matInput: Record<string, any> = {`r`n" +
"      caseId: 'MAT-' + String(Date.now()),`r`n" +
"      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),`r`n" +
"      consequenceTier: (decResult.consequence_reality || 'MODERATE'),`r`n" +
"      incidentNarrative: narrativeText`r`n" +
"    };`r`n" +
"    var narr = narrativeText.toLowerCase();`r`n" +
"    if (narr.indexOf('stainless') !== -1 || narr.indexOf('316') !== -1) { matInput.materialClass = 'austenitic_ss'; }`r`n" +
"    else if (narr.indexOf('duplex') !== -1) { matInput.materialClass = 'duplex_ss'; }`r`n" +
"    else if (narr.indexOf('carbon steel') !== -1 || narr.indexOf('a36') !== -1) { matInput.materialClass = 'carbon_steel'; }`r`n" +
"    else if (narr.indexOf('low alloy') !== -1 || narr.indexOf('p91') !== -1) { matInput.materialClass = 'low_alloy'; }`r`n" +
"    if (narr.indexOf('pwht') !== -1 || narr.indexOf('post weld heat') !== -1) { matInput.pwhtApplied = true; }`r`n" +
"    if (narr.indexOf('h2s') !== -1 || narr.indexOf('sour') !== -1) { matInput.h2sPartialPressureMPa = 0.001; }`r`n" +
"    if (narr.indexOf('chloride') !== -1 || narr.indexOf('seawater') !== -1) { matInput.chloridePPM = 1000; }`r`n" +
"    if (narr.indexOf('cyclic') !== -1 || narr.indexOf('fatigue') !== -1) { matInput.isCyclicService = true; }`r`n" +
"    try {`r`n" +
"      var matRes = await fetch('/.netlify/functions/materials-core', {`r`n" +
"        method: 'POST',`r`n" +
"        headers: { 'Content-Type': 'application/json' },`r`n" +
"        body: JSON.stringify(matInput)`r`n" +
"      });`r`n" +
"      if (matRes.ok) { var matData = await matRes.json(); setMaterialsResult(matData); }`r`n" +
"    } catch(e) { /* materials layer optional */ } finally { setMaterialsLoading(false); }`r`n" +
"  };`r`n`r`n" +
"  " + $P3_FIND

$content = $content.Replace("  " + $P3_FIND, $archFunc)
Write-Host "PATCH 3 OK: callArchitectureCore + callMaterialsCore functions added"

# =====================================================================
# PATCH 4: Add Layer 3 toggle button and cards before Decision Trace
# =====================================================================
$P4_FIND = '{/* DECISION TRACE (audit) */}'
if ($content.IndexOf($P4_FIND) -eq -1) {
    Write-Error "PATCH 4 FAILED - anchor not found"
    exit 1
}

$layer3Cards = "        {(architectureLoading || materialsLoading) && (" + "`r`n" +
"          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(170,68,255,0.05)', border: '1px solid rgba(170,68,255,0.2)', borderRadius: '8px', margin: '8px 0' }}>`r`n" +
"            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(170,68,255,0.2)', borderTopColor: '#aa44ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />`r`n" +
"            <div style={{ fontSize: '12px', color: '#aa44ff' }}>{'Layer 3 Analysis Running — Architecture + Materials Intelligence...'}</div>`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        {(architectureResult || materialsResult) && (" + "`r`n" +
"          <div style={{ marginTop: '4px' }}>`r`n" +
"`r`n" +
"            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>`r`n" +
"              <button onClick={function() { setShowLayer3(!showLayer3); }} style={{ background: 'transparent', border: '1px solid ' + (showLayer3 ? '#aa44ff' : '#555'), color: showLayer3 ? '#aa44ff' : '#888', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>`r`n" +
"                {showLayer3 ? 'Hide Layer 3: Architecture + Materials' : 'Show Layer 3: Architecture + Materials Intelligence'}`r`n" +
"              </button>`r`n" +
"            </div>`r`n" +
"`r`n" +
"            {showLayer3 && architectureResult && (`r`n" +
"              <div>`r`n" +
"`r`n" +
"                {architectureResult.architectureOverrideFlag && (`r`n" +
"                  <div style={{ background: '#1a001a', border: '2px solid #aa44ff', borderRadius: '8px', padding: '14px 16px', margin: '10px 0', boxShadow: '0 0 12px rgba(170,68,255,0.25)' }}>`r`n" +
"                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>`r`n" +
"                      <span style={{ fontSize: '18px' }}>{'!!'}</span>`r`n" +
"                      <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: '#cc66ff', textTransform: 'uppercase' as const }}>{'ARCHITECTURE OVERRIDE ACTIVE'}</span>`r`n" +
"                    </div>`r`n" +
"                    <div style={{ fontSize: '12px', color: '#ddaaff', lineHeight: 1.5 }}>{architectureResult.simpleNarrative}</div>`r`n" +
"                    {architectureResult.engineeringRecomputeRequired && (`r`n" +
"                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#cc88ff', fontWeight: 600, textTransform: 'uppercase' as const }}>{'System consequence exceeds component-only engineering — re-assessment required'}</div>`r`n" +
"                    )}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"`r`n" +
"                <div style={{ background: '#0f0a1a', border: '1px solid #2a1a4a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#8855cc', textTransform: 'uppercase' as const, marginBottom: '8px', letterSpacing: '0.08em' }}>{'SYSTEM ARCHITECTURE'}</div>`r`n" +
"                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'FACILITY TYPE'}</div>`r`n" +
"                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#aa88ff' }}>{(architectureResult.facilityType || '').replace(/_/g, ' ').toUpperCase()}</div>`r`n" +
"                    </div>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'SYSTEM ROLE'}</div>`r`n" +
"                      <div style={{ fontSize: '13px', fontWeight: 700, color: architectureResult.criticalityClass === 'CRITICAL' ? '#ff4444' : architectureResult.criticalityClass === 'HIGH' ? '#ff8c00' : '#aa88ff' }}>{(architectureResult.criticalityClass || '')}</div>`r`n" +
"                    </div>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'REDUNDANCY'}</div>`r`n" +
"                      <div style={{ fontSize: '12px', fontWeight: 600, color: architectureResult.spofFlag ? '#ff4444' : '#aa88ff' }}>{(architectureResult.redundancyState || '').replace(/_/g, ' ')}</div>`r`n" +
"                    </div>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'FACILITY RISK'}</div>`r`n" +
"                      <div style={{ fontSize: '13px', fontWeight: 700, color: architectureResult.facilityRiskRanking === 'CRITICAL' ? '#ff4444' : architectureResult.facilityRiskRanking === 'HIGH' ? '#ff8c00' : '#44ff88' }}>{architectureResult.facilityRiskRanking}</div>`r`n" +
"                    </div>`r`n" +
"                  </div>`r`n" +
"                  {architectureResult.spofFlag && (`r`n" +
"                    <div style={{ marginTop: '10px', background: 'rgba(255,50,50,0.12)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#ff8888', fontWeight: 600 }}>{'SINGLE POINT OF FAILURE — No backup capacity at this location'}</div>`r`n" +
"                  )}`r`n" +
"                </div>`r`n" +
"`r`n" +
"                {architectureResult.combinedRiskScenarios && architectureResult.combinedRiskScenarios.length > 0 && (`r`n" +
"                  <div style={{ background: '#100a1a', border: '1px solid #3a1a5a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#8855cc', textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '0.08em' }}>{'CASCADE RISK'}</div>`r`n" +
"                    <div style={{ fontSize: '12px', color: '#cc88ff', marginBottom: '6px' }}>{'Probability: ' + ((architectureResult.cascadeProbability || 0) * 100).toFixed(0) + '%'}</div>`r`n" +
"                    {architectureResult.combinedRiskScenarios.map(function(s: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#aa66ee', padding: '2px 0' }}>{'> ' + s}</div>; })}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"`r`n" +
"                {architectureResult.regulatoryOverrideFlag && (`r`n" +
"                  <div style={{ background: '#0a0a1a', border: '1px solid #334', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#6688cc', textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '0.08em' }}>{'REGULATORY OVERRIDE'}</div>`r`n" +
"                    <div style={{ fontSize: '12px', color: '#8899dd', lineHeight: 1.5 }}>{architectureResult.regulatoryNarrative}</div>`r`n" +
"                    {architectureResult.requiredDocumentation && architectureResult.requiredDocumentation.slice(0,3).map(function(d: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#6677bb', padding: '2px 0', marginTop: '4px' }}>{'- ' + d}</div>; })}`r`n" +
"                  </div>`r`n" +
"                )}`r`n" +
"`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{'REPAIR PRIORITY'}</div>`r`n" +
"                  <div style={{ fontSize: '14px', fontWeight: 700, color: architectureResult.repairPriority === 'IMMEDIATE' ? '#ff4444' : architectureResult.repairPriority === 'URGENT' ? '#ff8c00' : '#aaa' }}>{(architectureResult.repairPriority || '').replace(/_/g, ' ')}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{'Trend: ' + (architectureResult.trendState || '').replace(/_/g, ' ')}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{'Governing: ' + (architectureResult.regulatoryBody || '—')}</div>`r`n" +
"                </div>`r`n" +
"`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"`r`n" +
"            {showLayer3 && materialsResult && (`r`n" +
"              <div>`r`n" +
"`r`n" +
"                <div style={{ background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#44bb44', textTransform: 'uppercase' as const, marginBottom: '8px', letterSpacing: '0.08em' }}>{'MATERIALS INTELLIGENCE'}</div>`r`n" +
"                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'HAZ HARDNESS'}</div>`r`n" +
"                      <div style={{ fontSize: '13px', fontWeight: 700, color: materialsResult.hardnessStatus === 'ACCEPTABLE' ? '#44ff88' : materialsResult.hardnessStatus === 'NEAR_LIMIT' ? '#ffd700' : '#ff4444' }}>{String(materialsResult.hvHAZPeak || 0) + ' HV — ' + (materialsResult.hardnessStatus || '').replace(/_/g, ' ')}</div>`r`n" +
"                    </div>`r`n" +
"                    <div>`r`n" +
"                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{'MATERIALS RISK'}</div>`r`n" +
"                      <div style={{ fontSize: '13px', fontWeight: 700, color: materialsResult.materialsRiskLevel === 'CRITICAL' ? '#ff4444' : materialsResult.materialsRiskLevel === 'HIGH' ? '#ff8c00' : '#44ff88' }}>{materialsResult.materialsRiskLevel}</div>`r`n" +
"                    </div>`r`n" +
"                  </div>`r`n" +
"                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#557755' }}>{'Dominant mechanism: ' + (materialsResult.dominantDamageMechanism || '').replace(/_/g, ' ')}</div>`r`n" +
"                </div>`r`n" +
"`r`n" +
"                <div style={{ background: '#1a0a00', border: '1px solid #3a2200', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#dd8822', textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '0.08em' }}>{'PRE-FLAW PREDICTION — WHERE NEXT FLAW WILL FORM'}</div>`r`n" +
"                  {materialsResult.likelyInitiationZones && materialsResult.likelyInitiationZones.map(function(z: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#ffaa44', padding: '3px 0' }}>{'[' + String(i + 1) + '] ' + z}</div>; })}`r`n" +
"                  {materialsResult.timeToInitiationMonths !== null && materialsResult.timeToInitiationMonths !== undefined && (`r`n" +
"                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff8844', fontWeight: 600 }}>{'Time to initiation: ' + materialsResult.timeToInitiationMonths.toFixed(0) + ' months'}</div>`r`n" +
"                  )}`r`n" +
"                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#886644', fontStyle: 'italic' }}>{materialsResult.expectedFlawMorphology}</div>`r`n" +
"                </div>`r`n" +
"`r`n" +
"                <div style={{ background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: '8px', padding: '14px', margin: '8px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#44bb44', textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '0.08em' }}>{'INSPECTION DIRECTIVES FROM MATERIALS'}</div>`r`n" +
"                  {materialsResult.inspectionPriority && materialsResult.inspectionPriority.map(function(p: string, i: number) { return <div key={i} style={{ fontSize: '11px', color: '#88cc88', padding: '3px 0' }}>{'> ' + p}</div>; })}`r`n" +
"                </div>`r`n" +
"`r`n" +
"                <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px', margin: '6px 0' }}>`r`n" +
"                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{'MATERIALS SUMMARY'}</div>`r`n" +
"                  <div style={{ fontSize: '11px', color: '#777', lineHeight: 1.6 }}>{materialsResult.simpleNarrative}</div>`r`n" +
"                </div>`r`n" +
"`r`n" +
"              </div>`r`n" +
"            )}`r`n" +
"`r`n" +
"          </div>`r`n" +
"        )}`r`n" +
"`r`n" +
"        " + $P4_FIND

$content = $content.Replace("        " + $P4_FIND, $layer3Cards)
Write-Host "PATCH 4 OK: Layer 3 architecture + materials cards added"

# =====================================================================
# Write file
# =====================================================================
[System.IO.File]::WriteAllText((Resolve-Path $filePath), $content, [System.Text.Encoding]::UTF8)
$finalLines = ($content -split "`n").Count
Write-Host ""
Write-Host "SUCCESS: File written. Final line count: $finalLines"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  git add src/pages/VoiceInspectionPage.tsx"
Write-Host "  git commit -m 'DEPLOY105 architecture + materials intelligence UI'"
Write-Host "  git push"
