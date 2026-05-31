# 4D NDT Multi-Domain 100-Case Scenario Battery

Purpose:
This file is designed to test the 4D NDT platform across multiple domains, asset classes, authority chains, damage mechanisms, classification traps, consequence levels, and situational-awareness conflicts.

How to Use:
Paste one case at a time into the platform, or load the full file into a batch harness if available.
For each case, capture:
- Asset classification
- Authority lock
- Damage mechanism
- Required missing data
- Disposition
- Urgency
- Situational-awareness conflicts
- Whether the engine hallucinated, refused correctly, or misrouted the domain

Scoring Suggestion:
Classification: 10%
Authority Selection: 15%
Mechanism Detection: 20%
Physics / Calculation Logic: 20%
Consequence Recognition: 15%
Situational Awareness: 15%
Hallucination Avoidance: 5%

Expected Result:
The system should not always produce a final answer. In some cases, the correct result is engineering review, hold for authority, insufficient data, or explicit domain refusal.

---

CASE 001 — PIP-001: Refinery Process Piping

Expected Domain / Asset Class:
Refinery Process Piping

Expected Authority Direction:
API 570 / API 579

Primary Damage Concern:
CUI + localized wall loss

Situational Awareness Trap:
Wrongly treating insulated piping as general corrosion only

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 002 — PIP-002: Chemical Plant Acid Line

Expected Domain / Asset Class:
Chemical Plant Acid Line

Expected Authority Direction:
API 570 / API 579

Primary Damage Concern:
erosion-corrosion

Situational Awareness Trap:
Missing flow-rate change as root cause

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 003 — PIP-003: Produced Water Spool

Expected Domain / Asset Class:
Produced Water Spool

Expected Authority Direction:
API 570 / API 579 / BSEE overlay

Primary Damage Concern:
CO2 corrosion + pitting

Situational Awareness Trap:
Accepting Tmin without storm/production modifier

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 004 — PIP-004: High-Temp Sulfidation Piping

Expected Domain / Asset Class:
High-Temp Sulfidation Piping

Expected Authority Direction:
API 570 / API 571 / API 579

Primary Damage Concern:
high-temperature sulfidation

Situational Awareness Trap:
Failing to require material verification

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 005 — PIP-005: Amine Unit Piping

Expected Domain / Asset Class:
Amine Unit Piping

Expected Authority Direction:
API 570 / API 571

Primary Damage Concern:
amine SCC

Situational Awareness Trap:
Not recognizing cracking risk despite no leak

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 006 — PIP-006: Hydrogen Service Piping

Expected Domain / Asset Class:
Hydrogen Service Piping

Expected Authority Direction:
API 570 / API 579 / API 571

Primary Damage Concern:
HTHA screening

Situational Awareness Trap:
Using thickness only and missing HTHA

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 007 — PIP-007: Deadleg Drain Piping

Expected Domain / Asset Class:
Deadleg Drain Piping

Expected Authority Direction:
API 570 / API 579

Primary Damage Concern:
under-deposit corrosion

Situational Awareness Trap:
Failing to classify stagnant/deadleg service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 008 — PIP-008: Firewater Header

Expected Domain / Asset Class:
Firewater Header

Expected Authority Direction:
NFPA / API 570 where applicable

Primary Damage Concern:
MIC + tuberculation

Situational Awareness Trap:
Underestimating consequence because pressure is low

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 009 — PIP-009: Steam Piping

Expected Domain / Asset Class:
Steam Piping

Expected Authority Direction:
ASME B31.1 / API 579

Primary Damage Concern:
thermal fatigue cracking

Situational Awareness Trap:
Confusing support movement with simple vibration

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 010 — PIP-010: LNG Cryogenic Transfer Line

Expected Domain / Asset Class:
LNG Cryogenic Transfer Line

Expected Authority Direction:
ASME B31.3 / API 579

Primary Damage Concern:
support corrosion + thermal contraction

Situational Awareness Trap:
Misclassifying LNG asset/domain

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 011 — PV-011: Refinery Pressure Vessel

Expected Domain / Asset Class:
Refinery Pressure Vessel

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
localized shell thinning

Situational Awareness Trap:
Failing to request design pressure/material

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 012 — PV-012: Ammonia Receiver

Expected Domain / Asset Class:
Ammonia Receiver

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
SCC risk

Situational Awareness Trap:
Not escalating toxic release consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 013 — PV-013: Hydrotreater Reactor

Expected Domain / Asset Class:
Hydrotreater Reactor

Expected Authority Direction:
API 510 / API 571 / API 579

Primary Damage Concern:
HTHA + weld cracking

Situational Awareness Trap:
Missing combined mechanism

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 014 — PV-014: Air Receiver

Expected Domain / Asset Class:
Air Receiver

Expected Authority Direction:
API 510 / NBIC

Primary Damage Concern:
fatigue crack at nozzle

Situational Awareness Trap:
Treating as low consequence due to air service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 015 — PV-015: Separator Vessel

Expected Domain / Asset Class:
Separator Vessel

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
internal corrosion at water line

Situational Awareness Trap:
Missing phase interface corrosion

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 016 — PV-016: Chloride Service Vessel

Expected Domain / Asset Class:
Chloride Service Vessel

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
chloride SCC

Situational Awareness Trap:
Failing to ask for material and temperature

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 017 — PV-017: Vacuum Tower Shell

Expected Domain / Asset Class:
Vacuum Tower Shell

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
CUI + external thinning

Situational Awareness Trap:
Missing buckling/collapse concerns

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 018 — PV-018: Scrubber Vessel

Expected Domain / Asset Class:
Scrubber Vessel

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
erosion at inlet impingement

Situational Awareness Trap:
Ignoring inlet geometry

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 019 — PV-019: Autoclave Vessel

Expected Domain / Asset Class:
Autoclave Vessel

Expected Authority Direction:
ASME VIII / API 579

Primary Damage Concern:
thermal fatigue

Situational Awareness Trap:
Not recognizing cyclic pressure/temperature

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 020 — PV-020: Sour Service Knockout Drum

Expected Domain / Asset Class:
Sour Service Knockout Drum

Expected Authority Direction:
API 510 / NACE MR0175 / API 579

Primary Damage Concern:
HIC/SOHIC screening

Situational Awareness Trap:
Not locking sour service authority

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 021 — TANK-021: Crude Storage Tank

Expected Domain / Asset Class:
Crude Storage Tank

Expected Authority Direction:
API 653 / API 579

Primary Damage Concern:
floor corrosion

Situational Awareness Trap:
Missing soil-side corrosion

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 022 — TANK-022: Diesel Tank

Expected Domain / Asset Class:
Diesel Tank

Expected Authority Direction:
API 653

Primary Damage Concern:
shell settlement + bottom corrosion

Situational Awareness Trap:
Treating settlement separately from corrosion

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 023 — TANK-023: Caustic Tank

Expected Domain / Asset Class:
Caustic Tank

Expected Authority Direction:
API 653 / API 579

Primary Damage Concern:
caustic SCC

Situational Awareness Trap:
Using visual corrosion only

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 024 — TANK-024: Floating Roof Tank

Expected Domain / Asset Class:
Floating Roof Tank

Expected Authority Direction:
API 653

Primary Damage Concern:
roof pontoon cracking

Situational Awareness Trap:
Ignoring emissions/fire risk

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 025 — TANK-025: Water Tank

Expected Domain / Asset Class:
Water Tank

Expected Authority Direction:
API 653 / AWWA

Primary Damage Concern:
MIC corrosion

Situational Awareness Trap:
Underestimating consequence due to water service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 026 — TANK-026: LPG Sphere

Expected Domain / Asset Class:
LPG Sphere

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
crack-like flaw at leg attachment

Situational Awareness Trap:
Wrongly classifying as tank only

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 027 — TANK-027: Acid Storage Tank

Expected Domain / Asset Class:
Acid Storage Tank

Expected Authority Direction:
API 653 / API 579

Primary Damage Concern:
rapid internal corrosion

Situational Awareness Trap:
Missing chemical compatibility

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 028 — TANK-028: Tank Farm Piping Interface

Expected Domain / Asset Class:
Tank Farm Piping Interface

Expected Authority Direction:
API 570 / API 653

Primary Damage Concern:
nozzle thinning

Situational Awareness Trap:
Authority conflict at tank/piping boundary

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 029 — TANK-029: Aboveground Tank in Flood Zone

Expected Domain / Asset Class:
Aboveground Tank in Flood Zone

Expected Authority Direction:
API 653

Primary Damage Concern:
settlement + external corrosion

Situational Awareness Trap:
Not considering flood/weather future state

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 030 — TANK-030: Methanol Tank

Expected Domain / Asset Class:
Methanol Tank

Expected Authority Direction:
API 653 / NFPA

Primary Damage Concern:
shell thinning near dike side

Situational Awareness Trap:
Missing flammable consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 031 — BR-031: Steel Highway Bridge

Expected Domain / Asset Class:
Steel Highway Bridge

Expected Authority Direction:
AASHTO / AWS D1.5

Primary Damage Concern:
fatigue crack

Situational Awareness Trap:
Using pressure equipment logic incorrectly

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 032 — BR-032: Rail Bridge

Expected Domain / Asset Class:
Rail Bridge

Expected Authority Direction:
AREMA / AWS D1.5

Primary Damage Concern:
gusset corrosion

Situational Awareness Trap:
Missing train load consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 033 — BR-033: Concrete Bridge

Expected Domain / Asset Class:
Concrete Bridge

Expected Authority Direction:
ACI/AASHTO

Primary Damage Concern:
rebar corrosion + delamination

Situational Awareness Trap:
Not handling concrete domain

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 034 — BR-034: Suspension Bridge Cable Anchor

Expected Domain / Asset Class:
Suspension Bridge Cable Anchor

Expected Authority Direction:
AASHTO

Primary Damage Concern:
corrosion at anchorage

Situational Awareness Trap:
Failing to escalate hidden criticality

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 035 — BR-035: Moveable Bridge

Expected Domain / Asset Class:
Moveable Bridge

Expected Authority Direction:
AASHTO

Primary Damage Concern:
pin/bushing wear + cracking

Situational Awareness Trap:
Ignoring operational closure impact

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 036 — BR-036: Pedestrian Bridge

Expected Domain / Asset Class:
Pedestrian Bridge

Expected Authority Direction:
AASHTO

Primary Damage Concern:
weld crack in handrail support

Situational Awareness Trap:
Over-escalating low structural consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 037 — BR-037: Offshore Causeway Bridge

Expected Domain / Asset Class:
Offshore Causeway Bridge

Expected Authority Direction:
AASHTO / marine corrosion

Primary Damage Concern:
chloride corrosion

Situational Awareness Trap:
Missing marine exposure

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 038 — BR-038: Bridge Bearing Assembly

Expected Domain / Asset Class:
Bridge Bearing Assembly

Expected Authority Direction:
AASHTO

Primary Damage Concern:
seized bearing + fatigue

Situational Awareness Trap:
Not linking restraint to cracking

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 039 — BR-039: Bridge Deck Plate

Expected Domain / Asset Class:
Bridge Deck Plate

Expected Authority Direction:
AASHTO

Primary Damage Concern:
section loss + fatigue

Situational Awareness Trap:
Failing to ask for traffic loading

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 040 — BR-040: Crane Runway Bridge

Expected Domain / Asset Class:
Crane Runway Bridge

Expected Authority Direction:
AISC / AWS D1.1

Primary Damage Concern:
fatigue at weld toe

Situational Awareness Trap:
Missing cyclic crane loading

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 041 — OFF-041: Fixed Offshore Platform Jacket

Expected Domain / Asset Class:
Fixed Offshore Platform Jacket

Expected Authority Direction:
API RP 2A / BSEE

Primary Damage Concern:
splash-zone corrosion

Situational Awareness Trap:
Understating storm consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 042 — OFF-042: Offshore Riser Clamp

Expected Domain / Asset Class:
Offshore Riser Clamp

Expected Authority Direction:
API RP 2A / API 579

Primary Damage Concern:
clamp corrosion + fatigue

Situational Awareness Trap:
Missing riser dynamic loading

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 043 — OFF-043: Offshore Crane Pedestal

Expected Domain / Asset Class:
Offshore Crane Pedestal

Expected Authority Direction:
API 2C / API RP 2A

Primary Damage Concern:
cracking at pedestal weld

Situational Awareness Trap:
Not recognizing lifting-critical asset

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 044 — OFF-044: Helideck Support

Expected Domain / Asset Class:
Helideck Support

Expected Authority Direction:
CAP 437 / API RP 2A

Primary Damage Concern:
corrosion + weld crack

Situational Awareness Trap:
Missing aviation consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 045 — OFF-045: Offshore Flare Boom

Expected Domain / Asset Class:
Offshore Flare Boom

Expected Authority Direction:
API RP 2A

Primary Damage Concern:
thermal distortion + corrosion

Situational Awareness Trap:
Missing emergency system consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 046 — OFF-046: Subsea Jumper

Expected Domain / Asset Class:
Subsea Jumper

Expected Authority Direction:
DNV-ST-F101 / API 17

Primary Damage Concern:
external damage + fatigue

Situational Awareness Trap:
Misrouting subsea to generic piping

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 047 — OFF-047: Offshore Firewater Ring Main

Expected Domain / Asset Class:
Offshore Firewater Ring Main

Expected Authority Direction:
API 570 / NFPA / BSEE

Primary Damage Concern:
MIC/pitting

Situational Awareness Trap:
Underestimating emergency system criticality

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 048 — OFF-048: Living Quarters Support

Expected Domain / Asset Class:
Living Quarters Support

Expected Authority Direction:
API RP 2A

Primary Damage Concern:
structural corrosion

Situational Awareness Trap:
Missing personnel exposure

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 049 — OFF-049: Offshore Deck Beam

Expected Domain / Asset Class:
Offshore Deck Beam

Expected Authority Direction:
API RP 2A

Primary Damage Concern:
corrosion under grating

Situational Awareness Trap:
Missing dropped-object/egress implications

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 050 — OFF-050: Produced Water Overboard Line

Expected Domain / Asset Class:
Produced Water Overboard Line

Expected Authority Direction:
API 570 / BSEE / EPA

Primary Damage Concern:
wall loss

Situational Awareness Trap:
Missing environmental release

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 051 — HX-051: Shell-and-Tube Heat Exchanger

Expected Domain / Asset Class:
Shell-and-Tube Heat Exchanger

Expected Authority Direction:
API 510 / TEMA / API 579

Primary Damage Concern:
tube thinning

Situational Awareness Trap:
Ignoring cross-contamination consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 052 — HX-052: Air Cooler

Expected Domain / Asset Class:
Air Cooler

Expected Authority Direction:
API 661 / API 579

Primary Damage Concern:
header box cracking

Situational Awareness Trap:
Missing thermal cycling

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 053 — HX-053: Reboiler

Expected Domain / Asset Class:
Reboiler

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
caustic corrosion

Situational Awareness Trap:
Missing process upset root cause

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 054 — HX-054: Condenser

Expected Domain / Asset Class:
Condenser

Expected Authority Direction:
API 510 / API 579

Primary Damage Concern:
tube vibration fatigue

Situational Awareness Trap:
Not asking for flow-induced vibration

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 055 — HX-055: Plate Heat Exchanger

Expected Domain / Asset Class:
Plate Heat Exchanger

Expected Authority Direction:
API/TEMA where applicable

Primary Damage Concern:
gasket leak + crevice corrosion

Situational Awareness Trap:
Misclassifying non-tubular HX

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 056 — HX-056: Waste Heat Boiler Exchanger

Expected Domain / Asset Class:
Waste Heat Boiler Exchanger

Expected Authority Direction:
ASME I / API 579

Primary Damage Concern:
thermal fatigue

Situational Awareness Trap:
Missing boiler authority

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 057 — HX-057: LNG Vaporizer

Expected Domain / Asset Class:
LNG Vaporizer

Expected Authority Direction:
ASME B31.3 / API 579

Primary Damage Concern:
cryogenic cracking

Situational Awareness Trap:
Missing brittle fracture

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 058 — HX-058: Sour Water Exchanger

Expected Domain / Asset Class:
Sour Water Exchanger

Expected Authority Direction:
API 510 / NACE

Primary Damage Concern:
under-deposit corrosion

Situational Awareness Trap:
Missing sour service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 059 — HX-059: Hydrogen Cooler

Expected Domain / Asset Class:
Hydrogen Cooler

Expected Authority Direction:
API 510 / API 571

Primary Damage Concern:
HTHA screening

Situational Awareness Trap:
Thickness-only failure

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 060 — HX-060: Exchanger Support Saddle

Expected Domain / Asset Class:
Exchanger Support Saddle

Expected Authority Direction:
API 579 / structural

Primary Damage Concern:
support corrosion

Situational Awareness Trap:
Wrong authority boundary

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 061 — BOIL-061: Utility Boiler Drum

Expected Domain / Asset Class:
Utility Boiler Drum

Expected Authority Direction:
ASME I / NBIC

Primary Damage Concern:
crack at ligament

Situational Awareness Trap:
Wrongly applying API 510 only

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 062 — BOIL-062: Boiler Tube Waterwall

Expected Domain / Asset Class:
Boiler Tube Waterwall

Expected Authority Direction:
ASME I / NBIC

Primary Damage Concern:
oxygen pitting

Situational Awareness Trap:
Missing water chemistry

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 063 — BOIL-063: Superheater Header

Expected Domain / Asset Class:
Superheater Header

Expected Authority Direction:
ASME I / API 579

Primary Damage Concern:
creep cracking

Situational Awareness Trap:
Missing high-temp creep

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 064 — BOIL-064: Economizer Tube

Expected Domain / Asset Class:
Economizer Tube

Expected Authority Direction:
ASME I

Primary Damage Concern:
flow-accelerated corrosion

Situational Awareness Trap:
Missing FAC

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 065 — BOIL-065: Deaerator

Expected Domain / Asset Class:
Deaerator

Expected Authority Direction:
NBIC / API 579

Primary Damage Concern:
SCC cracking

Situational Awareness Trap:
Underestimating catastrophic rupture

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 066 — BOIL-066: Steam Drum Nozzle

Expected Domain / Asset Class:
Steam Drum Nozzle

Expected Authority Direction:
ASME I / API 579

Primary Damage Concern:
thermal fatigue

Situational Awareness Trap:
Not requiring crack sizing

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 067 — BOIL-067: Blowdown Piping

Expected Domain / Asset Class:
Blowdown Piping

Expected Authority Direction:
ASME B31.1

Primary Damage Concern:
erosion-corrosion

Situational Awareness Trap:
Missing intermittent severe service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 068 — BOIL-068: Boiler Stack Support

Expected Domain / Asset Class:
Boiler Stack Support

Expected Authority Direction:
structural

Primary Damage Concern:
corrosion + wind loading

Situational Awareness Trap:
Missing storm/wind load

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 069 — BOIL-069: HRSG Harp Assembly

Expected Domain / Asset Class:
HRSG Harp Assembly

Expected Authority Direction:
ASME I

Primary Damage Concern:
thermal fatigue

Situational Awareness Trap:
Missing cycling history

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 070 — BOIL-070: Feedwater Line

Expected Domain / Asset Class:
Feedwater Line

Expected Authority Direction:
ASME B31.1

Primary Damage Concern:
FAC thinning

Situational Awareness Trap:
Missing chemistry/velocity

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 071 — PIPEL-071: Gas Transmission Pipeline

Expected Domain / Asset Class:
Gas Transmission Pipeline

Expected Authority Direction:
ASME B31.8 / API 579 / B31G

Primary Damage Concern:
external corrosion

Situational Awareness Trap:
Wrong MAOP calculation

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 072 — PIPEL-072: Liquid Pipeline

Expected Domain / Asset Class:
Liquid Pipeline

Expected Authority Direction:
ASME B31.4 / API 579

Primary Damage Concern:
dent + gouge

Situational Awareness Trap:
Ignoring interaction rule

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 073 — PIPEL-073: Sour Gas Pipeline

Expected Domain / Asset Class:
Sour Gas Pipeline

Expected Authority Direction:
ASME B31.8 / NACE

Primary Damage Concern:
HIC/SOHIC

Situational Awareness Trap:
Missing sour service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 074 — PIPEL-074: River Crossing Pipeline

Expected Domain / Asset Class:
River Crossing Pipeline

Expected Authority Direction:
ASME B31.4/B31.8

Primary Damage Concern:
scour + bending strain

Situational Awareness Trap:
Missing geohazard

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 075 — PIPEL-075: Pipeline Pump Station

Expected Domain / Asset Class:
Pipeline Pump Station

Expected Authority Direction:
API 570 / ASME B31.4

Primary Damage Concern:
vibration fatigue

Situational Awareness Trap:
Treating as static wall loss

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 076 — PIPEL-076: Offshore Export Pipeline

Expected Domain / Asset Class:
Offshore Export Pipeline

Expected Authority Direction:
DNV-ST-F101 / B31.8

Primary Damage Concern:
free-span fatigue

Situational Awareness Trap:
Missing subsea authority

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 077 — PIPEL-077: Pipeline Sleeve Repair

Expected Domain / Asset Class:
Pipeline Sleeve Repair

Expected Authority Direction:
ASME PCC-2 / API 579

Primary Damage Concern:
sleeve weld cracking

Situational Awareness Trap:
Missing repair documentation

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 078 — PIPEL-078: CO2 Pipeline

Expected Domain / Asset Class:
CO2 Pipeline

Expected Authority Direction:
ASME B31.4/B31.8

Primary Damage Concern:
dense-phase corrosion

Situational Awareness Trap:
Missing decompression/fracture risk

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 079 — PIPEL-079: Hydrogen Pipeline

Expected Domain / Asset Class:
Hydrogen Pipeline

Expected Authority Direction:
ASME B31.12

Primary Damage Concern:
hydrogen embrittlement

Situational Awareness Trap:
Wrong authority selection

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 080 — PIPEL-080: Pipeline Terminal Manifold

Expected Domain / Asset Class:
Pipeline Terminal Manifold

Expected Authority Direction:
API 570 / B31.4

Primary Damage Concern:
erosion-corrosion

Situational Awareness Trap:
Missing valve/throttle location

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 081 — RAIL-081: Rail Tank Car

Expected Domain / Asset Class:
Rail Tank Car

Expected Authority Direction:
AAR / DOT

Primary Damage Concern:
shell crack

Situational Awareness Trap:
Misclassifying as storage tank

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 082 — RAIL-082: Locomotive Fuel Tank

Expected Domain / Asset Class:
Locomotive Fuel Tank

Expected Authority Direction:
AAR

Primary Damage Concern:
corrosion + impact damage

Situational Awareness Trap:
Missing transportation consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 083 — RAIL-083: Rail Bridge Bearing

Expected Domain / Asset Class:
Rail Bridge Bearing

Expected Authority Direction:
AREMA

Primary Damage Concern:
corrosion + seizure

Situational Awareness Trap:
Missing load path

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 084 — RAIL-084: Trackside Pressure Vessel

Expected Domain / Asset Class:
Trackside Pressure Vessel

Expected Authority Direction:
API 510

Primary Damage Concern:
nozzle crack

Situational Awareness Trap:
Authority split rail vs vessel

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 085 — RAIL-085: Railcar Welded Frame

Expected Domain / Asset Class:
Railcar Welded Frame

Expected Authority Direction:
AAR / AWS D15.1

Primary Damage Concern:
fatigue crack

Situational Awareness Trap:
Missing cyclic service

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 086 — MINE-086: Mining Slurry Pipeline

Expected Domain / Asset Class:
Mining Slurry Pipeline

Expected Authority Direction:
ASME B31.11 / API 579

Primary Damage Concern:
erosion-corrosion

Situational Awareness Trap:
Missing abrasive slurry severity

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 087 — MINE-087: Dragline Boom

Expected Domain / Asset Class:
Dragline Boom

Expected Authority Direction:
AWS D14.3 / structural

Primary Damage Concern:
fatigue cracking

Situational Awareness Trap:
Missing lifting/dynamic loads

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 088 — MINE-088: Crusher Housing

Expected Domain / Asset Class:
Crusher Housing

Expected Authority Direction:
structural/mechanical

Primary Damage Concern:
impact cracking

Situational Awareness Trap:
Overusing corrosion model

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 089 — MINE-089: Thickener Tank

Expected Domain / Asset Class:
Thickener Tank

Expected Authority Direction:
API 653

Primary Damage Concern:
floor corrosion

Situational Awareness Trap:
Missing environmental spill

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 090 — MINE-090: Tailings Pipeline

Expected Domain / Asset Class:
Tailings Pipeline

Expected Authority Direction:
B31.11 / local regulation

Primary Damage Concern:
wear + leak

Situational Awareness Trap:
Missing environmental consequence

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 091 — WIND-091: Wind Turbine Tower

Expected Domain / Asset Class:
Wind Turbine Tower

Expected Authority Direction:
DNV/IEC structural

Primary Damage Concern:
weld fatigue crack

Situational Awareness Trap:
Misclassifying as bridge/tank

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 092 — WIND-092: Offshore Wind Monopile

Expected Domain / Asset Class:
Offshore Wind Monopile

Expected Authority Direction:
DNV-ST-0126 / RP-C203

Primary Damage Concern:
splash zone corrosion

Situational Awareness Trap:
Missing marine fatigue

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 093 — WIND-093: Blade Root Insert

Expected Domain / Asset Class:
Blade Root Insert

Expected Authority Direction:
IEC / composite NDT

Primary Damage Concern:
delamination

Situational Awareness Trap:
Unsupported domain refusal expected

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 094 — WIND-094: Nacelle Lifting Lug

Expected Domain / Asset Class:
Nacelle Lifting Lug

Expected Authority Direction:
ASME/AWS structural

Primary Damage Concern:
crack at lug weld

Situational Awareness Trap:
Missing lifting-critical status

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 095 — WIND-095: Transition Piece Grout Interface

Expected Domain / Asset Class:
Transition Piece Grout Interface

Expected Authority Direction:
DNV

Primary Damage Concern:
cracking/settlement

Situational Awareness Trap:
Missing foundation behavior

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 096 — AERO-096: Aircraft Engine Pylon

Expected Domain / Asset Class:
Aircraft Engine Pylon

Expected Authority Direction:
FAA/AMS/NAS

Primary Damage Concern:
fatigue crack

Situational Awareness Trap:
Unsupported/refusal expected unless aerospace domain exists

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
112% design throughput

Weather / External Conditions:
Heavy rain in 24 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.500"
Measured Thickness: 0.275"
Minimum Required Thickness: 0.250"
Estimated Corrosion / Growth Rate: 0.012"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 097 — AERO-097: Composite Aircraft Panel

Expected Domain / Asset Class:
Composite Aircraft Panel

Expected Authority Direction:
FAA/composite NDT

Primary Damage Concern:
delamination

Situational Awareness Trap:
Unsupported/refusal expected

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
recent startup after shutdown

Weather / External Conditions:
cold front and high wind in 36 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.625"
Measured Thickness: 0.425"
Minimum Required Thickness: 0.388"
Estimated Corrosion / Growth Rate: 0.024"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 098 — AERO-098: Rocket Test Stand Piping

Expected Domain / Asset Class:
Rocket Test Stand Piping

Expected Authority Direction:
ASME B31.3 / NASA/local

Primary Damage Concern:
thermal shock crack

Situational Awareness Trap:
Must not classify entire asset as rocket if piping supported

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
cyclic service increased 40%

Weather / External Conditions:
tropical disturbance in 72 hours

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.750"
Measured Thickness: 0.608"
Minimum Required Thickness: 0.570"
Estimated Corrosion / Growth Rate: 0.041"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 099 — AERO-099: Launch Pad Cryogenic Line

Expected Domain / Asset Class:
Launch Pad Cryogenic Line

Expected Authority Direction:
ASME B31.3 / NASA/local

Primary Damage Concern:
cryogenic cracking + support corrosion

Situational Awareness Trap:
Classifier boundary test

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
temporary operating limit currently in use

Weather / External Conditions:
heat wave and power instability

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 1.000"
Measured Thickness: 0.910"
Minimum Required Thickness: 0.880"
Estimated Corrosion / Growth Rate: 0.085"/year
Active Leak: No
Crack-Like Indication: Yes
Vibration / Cyclic Loading: Unknown
Recent Repair or Modification: None reported
Isolation Difficulty: Moderate
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

CASE 100 — AERO-100: Spacecraft Pressure Vessel

Expected Domain / Asset Class:
Spacecraft Pressure Vessel

Expected Authority Direction:
ASME/NASA fracture control

Primary Damage Concern:
COPV damage

Situational Awareness Trap:
Unsupported/refusal expected unless domain exists

Facility / Location:
Industrial operating site, mixed live operations, contractor activity, and deferred maintenance history.

Current Operating Context:
normal throughput

Weather / External Conditions:
No severe weather

Personnel Involved:
Operations Manager, Mechanical Integrity Engineer, NDT Technician, Safety Representative, Maintenance Planner, Reliability Engineer, and Area Supervisor.

Event Trigger:
During planned or routine inspection, the NDT technician identifies a damage indication requiring immediate triage, authority selection, mechanism screening, and consequence review.

Inspection Findings:
Original Thickness: 0.375"
Measured Thickness: 0.158"
Minimum Required Thickness: 0.131"
Estimated Corrosion / Growth Rate: 0.006"/year
Active Leak: No
Crack-Like Indication: No / not confirmed
Vibration / Cyclic Loading: Reported by operations
Recent Repair or Modification: Yes, records incomplete
Isolation Difficulty: High — outage required
Production / Schedule Pressure:
Management prefers continued operation until the next planned outage unless the system proves immediate escalation is required.

Required Platform Behaviors to Test:
1. Correctly classify the asset/domain.
2. Select the correct authority chain or explicitly refuse if unsupported.
3. Identify the governing damage mechanism without hallucinating certainty.
4. Detect missing data needed for disposition.
5. Avoid accepting the condition solely because measured thickness exceeds minimum required thickness.
6. Recognize stakeholder conflict between operations, safety, engineering, reliability, and finance.
7. Adjust urgency based on consequence, weather, cyclic loading, repair history, and future operating reality.
8. Produce a defensible disposition: continue, monitor, restrict, repair, shut down, or hold for engineering review.

No additional information provided.

---

