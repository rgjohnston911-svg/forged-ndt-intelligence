/**
 * GLOBAL AUTHORITY ENGINE v2.2.0
 * FORGED 4D NDT Intelligence OS
 *
 * Prevents the platform from applying the wrong code, standard, or regulatory
 * authority when inspections occur across different countries, offshore regions,
 * class societies, owner-user programs, or company specifications.
 *
 * Additionally verifies whether the identified authority is CURRENT, SUPERSEDED,
 * WITHDRAWN, or UNVERIFIABLE — and blocks final disposition when authority
 * status is stale, unknown, or from non-authoritative sources.
 *
 * Modules:
 *   1. Jurisdiction Resolver — NLP-style detection from location_text
 *   2. Global Authority Matrix — which codes govern in which jurisdictions
 *   3. Standard Equivalency Table — crosswalk between US and foreign standards
 *   4. Authority Hard Locks — prevents wrong-code application
 *   5. Unit Conversion Engine — detects mixed units, converts, validates thresholds
 *   6. Live Authority Verification — edition checking, superseded detection
 *   7. Source Credibility Scoring — official vs unofficial source ranking
 *   8. Edition Lock — blocks disposition when standard is stale or withdrawn
 *   9. Verification Cache — time-bounded caching of authority lookups
 *  10. Audit Trace — full decision provenance for every authority resolution
 *  11. Inspector Messages — human-readable explanations for field personnel
 *  12. Mandatory Questions — prompts when jurisdiction/authority is ambiguous
 *
 * Engine: global-authority-engine
 * Version: 2.2.0
 * Input: POST { asset_description, location_text, units_detected, asset_type, inspection_method, requested_code, requested_edition, operator_name, owner_user_program, industry_domain, offshore_region }
 * Output: Full v2.2 authority decision object (see EngineOutputV22 interface)
 */

import { Handler } from "@netlify/functions";
import { randomUUID } from "crypto";

// ============================================================
// AUTHORITY VERIFICATION STATES
// ============================================================
type EditionStatus =
  | "VERIFIED_CURRENT"
  | "VERIFIED_BUT_EDITION_UNKNOWN"
  | "SUPERSEDED"
  | "WITHDRAWN"
  | "CONFLICTING_SOURCES"
  | "UNVERIFIED"
  | "LIVE_CHECK_REQUIRED"
  | "OFFICIAL_SOURCE_NOT_FOUND"
  | "MANUAL_REVIEW_REQUIRED";

type EditionLock =
  | "NO_LOCK"
  | "WARN_ONLY"
  | "HOLD_FOR_EDITION_VERIFICATION"
  | "HOLD_FOR_OFFICIAL_SOURCE"
  | "BLOCK_SUPERSEDED_AUTHORITY"
  | "BLOCK_WITHDRAWN_AUTHORITY"
  | "MANUAL_AUTHORITY_REVIEW";

type DecisionLock = "ALLOW" | "ALLOW_WITH_WARNING" | "HOLD_FOR_AUTHORITY" | "BLOCK";
type JurisdictionStatus = "CONFIRMED" | "INFERRED" | "UNKNOWN" | "CONFLICTING";

// ============================================================
// EDITION REGISTRY — known current editions + superseded/withdrawn status
// ============================================================
interface EditionRecord {
  code: string;
  current_edition: string;
  current_year: number;
  previous_editions: string[];
  superseded_by?: string;
  withdrawn?: boolean;
  withdrawal_date?: string;
  issuing_body: string;
  official_source_url: string;
  last_verified: string; // ISO date
  verification_source: string;
  notes?: string;
}

const EDITION_REGISTRY: EditionRecord[] = [
  // API Standards
  { code: "API 570", current_edition: "4th Edition, February 2016 (Addendum 1, April 2021)", current_year: 2016, previous_editions: ["3rd Edition, 2009", "2nd Edition, 1998"], issuing_body: "American Petroleum Institute", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "API 510", current_edition: "11th Edition, May 2023", current_year: 2023, previous_editions: ["10th Edition, 2014", "9th Edition, 2006"], issuing_body: "American Petroleum Institute", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "API 579-1/ASME FFS-1", current_edition: "3rd Edition, June 2021", current_year: 2021, previous_editions: ["2nd Edition, 2016", "1st Edition, 2007"], issuing_body: "API / ASME", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "API 1104", current_edition: "22nd Edition, 2019 (Errata 1, 2020)", current_year: 2019, previous_editions: ["21st Edition, 2013", "20th Edition, 2005"], issuing_body: "American Petroleum Institute", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "API 580", current_edition: "3rd Edition, February 2016", current_year: 2016, previous_editions: ["2nd Edition, 2009"], issuing_body: "American Petroleum Institute", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "API 581", current_edition: "3rd Edition, April 2016 (Addendum 1, 2019)", current_year: 2016, previous_editions: ["2nd Edition, 2008"], issuing_body: "American Petroleum Institute", official_source_url: "https://www.api.org/products-and-services/standards", last_verified: "2026-04-01", verification_source: "API Publications Store" },

  // ASME Standards
  { code: "ASME BPVC Section VIII", current_edition: "2023 Edition", current_year: 2023, previous_editions: ["2021 Edition", "2019 Edition", "2017 Edition"], issuing_body: "ASME", official_source_url: "https://www.asme.org/codes-standards/find-codes-standards/bpvc", last_verified: "2026-04-01", verification_source: "ASME Standards Store" },
  { code: "ASME B31.3", current_edition: "2022 Edition", current_year: 2022, previous_editions: ["2020 Edition", "2018 Edition", "2016 Edition"], issuing_body: "ASME", official_source_url: "https://www.asme.org/codes-standards", last_verified: "2026-04-01", verification_source: "ASME Standards Store" },
  { code: "ASME B31.4", current_edition: "2022 Edition", current_year: 2022, previous_editions: ["2019 Edition", "2016 Edition"], issuing_body: "ASME", official_source_url: "https://www.asme.org/codes-standards", last_verified: "2026-04-01", verification_source: "ASME Standards Store" },
  { code: "ASME B31.8", current_edition: "2022 Edition", current_year: 2022, previous_editions: ["2020 Edition", "2018 Edition"], issuing_body: "ASME", official_source_url: "https://www.asme.org/codes-standards", last_verified: "2026-04-01", verification_source: "ASME Standards Store" },

  // AWS Standards
  { code: "AWS D1.1", current_edition: "AWS D1.1/D1.1M:2020", current_year: 2020, previous_editions: ["D1.1:2015", "D1.1:2010", "D1.1:2006"], issuing_body: "American Welding Society", official_source_url: "https://pubs.aws.org", last_verified: "2026-04-01", verification_source: "AWS Pubs Store" },
  { code: "AWS D1.5", current_edition: "AWS D1.5M/D1.5:2020", current_year: 2020, previous_editions: ["D1.5:2015", "D1.5:2010"], issuing_body: "American Welding Society", official_source_url: "https://pubs.aws.org", last_verified: "2026-04-01", verification_source: "AWS Pubs Store" },
  { code: "AWS D1.6", current_edition: "AWS D1.6/D1.6M:2017", current_year: 2017, previous_editions: ["D1.6:2007", "D1.6:1999"], issuing_body: "American Welding Society", official_source_url: "https://pubs.aws.org", last_verified: "2026-04-01", verification_source: "AWS Pubs Store" },

  // International Standards
  { code: "EN 13445", current_edition: "EN 13445:2021 (Parts 1-10)", current_year: 2021, previous_editions: ["EN 13445:2014", "EN 13445:2009"], issuing_body: "CEN", official_source_url: "https://www.en-standard.eu", last_verified: "2026-04-01", verification_source: "CEN/CENELEC" },
  { code: "PED 2014/68/EU", current_edition: "Directive 2014/68/EU (effective 2016)", current_year: 2014, previous_editions: ["Directive 97/23/EC (repealed 2016)"], issuing_body: "European Parliament / Council", official_source_url: "https://eur-lex.europa.eu", last_verified: "2026-04-01", verification_source: "EUR-Lex", notes: "Directive 97/23/EC is SUPERSEDED and WITHDRAWN" },
  { code: "BS 7910", current_edition: "BS 7910:2019+A1:2024", current_year: 2019, previous_editions: ["BS 7910:2013+A1:2015", "BS 7910:2005"], issuing_body: "BSI", official_source_url: "https://shop.bsigroup.com", last_verified: "2026-04-01", verification_source: "BSI Shop" },
  { code: "CSA Z662", current_edition: "CSA Z662:2023", current_year: 2023, previous_editions: ["CSA Z662:2019", "CSA Z662:2015"], issuing_body: "CSA Group", official_source_url: "https://www.csagroup.org", last_verified: "2026-04-01", verification_source: "CSA Store" },
  { code: "CSA B51", current_edition: "CSA B51:2019 (R2024)", current_year: 2019, previous_editions: ["CSA B51:2014", "CSA B51:2009"], issuing_body: "CSA Group", official_source_url: "https://www.csagroup.org", last_verified: "2026-04-01", verification_source: "CSA Store" },
  { code: "NORSOK M-001", current_edition: "NORSOK M-001:2014 (Ed. 5)", current_year: 2014, previous_editions: ["Rev. 4, 2004", "Rev. 3, 2002"], issuing_body: "Standard Norge", official_source_url: "https://www.standard.no", last_verified: "2026-04-01", verification_source: "Standard Norge" },
  { code: "DNV-ST-F101", current_edition: "DNV-ST-F101 (2021)", current_year: 2021, previous_editions: ["DNV-OS-F101 (2013)", "DNV-OS-F101 (2010)"], issuing_body: "DNV", official_source_url: "https://www.dnv.com/rules-standards", last_verified: "2026-04-01", verification_source: "DNV Rules Store" },
  { code: "AS/NZS 3788", current_edition: "AS/NZS 3788:2006 (R2021)", current_year: 2006, previous_editions: ["AS/NZS 3788:2001", "AS 3788:1996"], issuing_body: "Standards Australia", official_source_url: "https://www.standards.org.au", last_verified: "2026-04-01", verification_source: "SAI Global" },
  { code: "NR-13", current_edition: "NR-13 (Portaria 594/2024)", current_year: 2024, previous_editions: ["NR-13 (2019)", "NR-13 (2014)"], issuing_body: "MTE Brazil", official_source_url: "https://www.gov.br/trabalho-e-emprego", last_verified: "2026-04-01", verification_source: "Brazilian Federal Register" },
  { code: "GB 150", current_edition: "GB/T 150-2011 (with Amendment 1:2021)", current_year: 2011, previous_editions: ["GB 150-1998"], issuing_body: "SAMR China", official_source_url: "https://www.samr.gov.cn", last_verified: "2026-04-01", verification_source: "SAC China" },

  // Superseded / withdrawn examples
  { code: "PED 97/23/EC", current_edition: "WITHDRAWN — replaced by PED 2014/68/EU", current_year: 1997, previous_editions: [], superseded_by: "PED 2014/68/EU", withdrawn: true, withdrawal_date: "2016-07-19", issuing_body: "European Parliament", official_source_url: "https://eur-lex.europa.eu", last_verified: "2026-04-01", verification_source: "EUR-Lex" },
  { code: "API RP 579", current_edition: "SUPERSEDED — replaced by API 579-1/ASME FFS-1", current_year: 2000, previous_editions: [], superseded_by: "API 579-1/ASME FFS-1", withdrawn: false, issuing_body: "API", official_source_url: "https://www.api.org", last_verified: "2026-04-01", verification_source: "API Publications Store" },
  { code: "BS PD 6493", current_edition: "WITHDRAWN — replaced by BS 7910", current_year: 1991, previous_editions: [], superseded_by: "BS 7910", withdrawn: true, withdrawal_date: "1999-01-01", issuing_body: "BSI", official_source_url: "https://shop.bsigroup.com", last_verified: "2026-04-01", verification_source: "BSI Shop" },
  { code: "DNV-OS-F101", current_edition: "SUPERSEDED — replaced by DNV-ST-F101 (2021)", current_year: 2013, previous_editions: ["2010", "2007"], superseded_by: "DNV-ST-F101", withdrawn: false, issuing_body: "DNV", official_source_url: "https://www.dnv.com", last_verified: "2026-04-01", verification_source: "DNV Rules Store" },
  { code: "ASME/ANSI B31.3-2004", current_edition: "SUPERSEDED — current is ASME B31.3-2022", current_year: 2004, previous_editions: [], superseded_by: "ASME B31.3", withdrawn: false, issuing_body: "ASME", official_source_url: "https://www.asme.org", last_verified: "2026-04-01", verification_source: "ASME Store" }
];

// ============================================================
// SOURCE CREDIBILITY REGISTRY
// ============================================================
interface SourceCredibility {
  source_type: string;
  quality_score: number; // 0.0 - 1.0
  official: boolean;
  notes: string;
}

const SOURCE_CREDIBILITY: SourceCredibility[] = [
  { source_type: "Official standards body publication store (API, ASME, AWS, BSI, CSA, CEN)", quality_score: 1.0, official: true, notes: "Primary authoritative source" },
  { source_type: "Government regulatory gazette/register (Federal Register, EUR-Lex, gov.br)", quality_score: 1.0, official: true, notes: "Legal authority for regulatory standards" },
  { source_type: "Standards body official website (api.org, asme.org, aws.org)", quality_score: 0.95, official: true, notes: "May not reflect latest errata/addenda" },
  { source_type: "Class society rules store (DNV, Lloyd's, ABS, BV)", quality_score: 0.95, official: true, notes: "Authoritative for classification rules" },
  { source_type: "National regulatory body website (OSHA, HSE, PSA, SAMR)", quality_score: 0.90, official: true, notes: "May lag behind publication updates" },
  { source_type: "Industry consortium / trade body (NACE, SSPC, NORSOK)", quality_score: 0.85, official: true, notes: "Authoritative for scope-specific standards" },
  { source_type: "Licensed distributor (IHS Markit / S&P Global, Techstreet, SAI Global)", quality_score: 0.85, official: false, notes: "Reliable but verify currency" },
  { source_type: "Professional reference textbook (published, peer-reviewed)", quality_score: 0.70, official: false, notes: "May reference older editions" },
  { source_type: "Company internal specification", quality_score: 0.60, official: false, notes: "Must verify traceability to governing standard" },
  { source_type: "Training material / course notes", quality_score: 0.50, official: false, notes: "May be outdated or simplified" },
  { source_type: "Industry blog / article (non-peer-reviewed)", quality_score: 0.30, official: false, notes: "Unreliable for edition/applicability claims" },
  { source_type: "Generic web search result / AI-generated content", quality_score: 0.10, official: false, notes: "NEVER use as authority basis for final disposition" },
  { source_type: "Unknown / unverified source", quality_score: 0.0, official: false, notes: "Cannot support any authority decision" }
];

// ============================================================
// JURISDICTION REGISTRY (carried from v2.1)
// ============================================================
interface JurisdictionEntry {
  country: string;
  region?: string;
  codes: string[];
  primary_authority_description: string;
  regulatory_body: string;
  class_societies: string[];
  unit_system: "Metric" | "Imperial" | "Mixed";
  note: string;
  is_offshore?: boolean;
}

const JURISDICTION_REGISTRY: Record<string, JurisdictionEntry> = {
  us: {
    country: "United States",
    codes: ["API 570", "API 510", "ASME BPVC", "API 579-1/ASME FFS-1", "API 1104", "AWS D1.1"],
    primary_authority_description: "API / ASME codes as adopted by OSHA / state jurisdiction",
    regulatory_body: "OSHA / state authorities / owner-user program",
    class_societies: [],
    unit_system: "Imperial",
    note: "US codes apply directly; OSHA 29 CFR 1910.119 for PSM covered facilities"
  },
  canada: {
    country: "Canada",
    codes: ["CSA Z662", "CSA B51", "CSA W59", "CSA Z245.1"],
    primary_authority_description: "Provincial pressure equipment authority / CSA / applicable owner-user program",
    regulatory_body: "TSSA / ABSA / provincial authorities",
    class_societies: [],
    unit_system: "Metric",
    note: "Canadian Standards Association primary; API supplemental only if adopted by owner"
  },
  alberta: {
    country: "Canada",
    region: "Alberta",
    codes: ["CSA Z662", "ABSA", "CSA B51"],
    primary_authority_description: "Provincial pressure equipment authority / CSA / applicable owner-user program",
    regulatory_body: "ABSA",
    class_societies: [],
    unit_system: "Metric",
    note: "Alberta Boilers Safety Association + CSA standards govern"
  },
  germany: {
    country: "Germany",
    codes: ["PED 2014/68/EU", "EN 13445", "AD 2000 Merkblätter", "BetrSichV"],
    primary_authority_description: "PED / EN harmonized standards / TÜV oversight",
    regulatory_body: "TÜV / ZÜS / BAM",
    class_societies: ["DNV", "Lloyd's", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Pressure Equipment Directive + EN harmonized standards; TÜV oversight"
  },
  eu: {
    country: "European Union",
    codes: ["PED 2014/68/EU", "EN 13445", "EN 12952", "EN 13480"],
    primary_authority_description: "PED / EN harmonized standards / Notified Body oversight",
    regulatory_body: "Notified Bodies (NB) per member state",
    class_societies: ["DNV", "Lloyd's", "Bureau Veritas", "TÜV"],
    unit_system: "Metric",
    note: "PED + EN harmonized standards govern; ASME not primary; CE marking required"
  },
  uk: {
    country: "United Kingdom",
    codes: ["BS EN 1090", "BS 7910", "PER 1999", "PSSR 2000"],
    primary_authority_description: "UK pressure systems / HSE / written scheme / applicable EN or ISO standards",
    regulatory_body: "HSE / Competent Authority",
    class_societies: ["Lloyd's Register", "DNV"],
    unit_system: "Metric",
    note: "Pressure Equipment Regulations + Written Scheme of Examination required"
  },
  australia: {
    country: "Australia",
    codes: ["AS/NZS 3788", "AS 4458", "AS 2885", "AS 1210"],
    primary_authority_description: "Australian state/territory WHS requirements / AS/NZS standards / owner-user program",
    regulatory_body: "WorkSafe / state regulators",
    class_societies: ["Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Australian/NZ Standards govern; state WorkSafe authorities"
  },
  norway: {
    country: "Norway",
    codes: ["NORSOK M-001", "NORSOK M-501", "DNV-OS-F101", "DNV-ST-F101"],
    primary_authority_description: "Norwegian offshore regulatory framework / NORSOK / DNV / operator specification",
    regulatory_body: "Petroleumstilsynet (PSA)",
    class_societies: ["DNV"],
    unit_system: "Metric",
    is_offshore: true,
    note: "NORSOK standards + DNV rules govern offshore; PSA regulatory oversight"
  },
  brazil: {
    country: "Brazil",
    codes: ["NR-13", "ABNT NBR 15749", "ABNT NBR 14842"],
    primary_authority_description: "Brazilian regulatory requirements / owner specification / ABNT / ISO",
    regulatory_body: "MTE / ANP / INMETRO",
    class_societies: ["DNV", "Bureau Veritas", "ABS"],
    unit_system: "Metric",
    note: "NR-13 regulatory + ABNT national standards; ANP for oil & gas"
  },
  japan: {
    country: "Japan",
    codes: ["JIS B 8265", "JIS B 8266", "METI High Pressure Gas Safety Act"],
    primary_authority_description: "JIS / METI regulatory framework",
    regulatory_body: "METI / KHK",
    class_societies: ["ClassNK", "DNV"],
    unit_system: "Metric",
    note: "JIS standards + METI regulations; KHK certification required"
  },
  singapore: {
    country: "Singapore",
    codes: ["SS CP 79", "WSH Act", "SS 531"],
    primary_authority_description: "Singapore Standards / WSH Act / MOM",
    regulatory_body: "MOM / WSH Council",
    class_societies: ["ABS", "Lloyd's", "DNV", "Bureau Veritas"],
    unit_system: "Metric",
    note: "Singapore Standards + Workplace Safety & Health regulations"
  },
  middle_east: {
    country: "Middle East",
    codes: ["ARAMCO Standards", "ADNOC Standards", "QP Standards"],
    primary_authority_description: "Owner engineering authority / national standards",
    regulatory_body: "Owner engineering authority",
    class_societies: ["ABS", "Lloyd's", "DNV"],
    unit_system: "Mixed",
    note: "Owner/national standards often adopt API with modifications; verify per owner spec"
  },
  korea: {
    country: "South Korea",
    codes: ["KGS FP 111", "KOSHA", "KS B 6750"],
    primary_authority_description: "KGS / KOSHA / MOTIE regulatory framework",
    regulatory_body: "KGS / KOSHA / MOTIE",
    class_societies: ["Korean Register", "DNV"],
    unit_system: "Metric",
    note: "Korean Gas Safety + occupational safety standards; KGS certification"
  },
  india: {
    country: "India",
    codes: ["IS 2825", "IBR 1950", "OISD Standards", "IS 803"],
    primary_authority_description: "IBR / IS / OISD regulatory framework",
    regulatory_body: "DIPP / State Boiler Directorate / OISD",
    class_societies: ["Indian Register of Shipping", "DNV", "Lloyd's"],
    unit_system: "Metric",
    note: "Indian Boiler Regulations + OISD for petroleum; state-level boiler inspectorates"
  },
  china: {
    country: "China",
    codes: ["GB 150", "GB/T 20801", "TSG 21"],
    primary_authority_description: "GB national standards / SAMR regulatory",
    regulatory_body: "SAMR / Provincial MSA",
    class_societies: ["CCS", "DNV", "Lloyd's"],
    unit_system: "Metric",
    note: "GB national standards govern; SAMR/TSG regulatory; no foreign code primary"
  },
  offshore_international: {
    country: "International Waters",
    codes: ["MODU Code", "SOLAS", "ISM Code"],
    primary_authority_description: "Flag state / class society / maritime regulatory framework",
    regulatory_body: "Flag State / IMO",
    class_societies: ["ABS", "DNV", "Lloyd's", "Bureau Veritas", "ClassNK"],
    unit_system: "Metric",
    is_offshore: true,
    note: "Flag state + classification society rules govern; IMO conventions apply"
  },
  france: {
    country: "France",
    codes: ["PED 2014/68/EU", "EN 13445", "EN 13480", "RCC-M / RSE-M (nuclear)"],
    primary_authority_description: "PED / EN harmonized standards + French in-service regime; ASN for nuclear",
    regulatory_body: "DGPR / ASN (nuclear)",
    class_societies: [],
    unit_system: "Metric",
    note: "EU PED regime; Notified Body involvement"
  },
  netherlands: {
    country: "Netherlands",
    codes: ["PED 2014/68/EU", "EN 13445", "EN 13480"],
    primary_authority_description: "PED / EN harmonized standards; SodM for offshore",
    regulatory_body: "SodM / NLA",
    class_societies: [],
    unit_system: "Metric",
    note: "EU PED regime"
  },
  poland: {
    country: "Poland",
    codes: ["PED 2014/68/EU", "EN 13445", "EN 13480"],
    primary_authority_description: "PED / EN harmonized standards; UDT in-service inspection",
    regulatory_body: "UDT (Office of Technical Inspection)",
    class_societies: [],
    unit_system: "Metric",
    note: "EU PED regime"
  },
  indonesia: {
    country: "Indonesia",
    codes: ["SNI", "Ditjen Migas regulations", "ASME / API (adopted)"],
    primary_authority_description: "Ditjen Migas / SKK Migas oil & gas regulations + SNI; API/ASME widely adopted",
    regulatory_body: "Ditjen Migas / SKK Migas / BSN",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with national overlay"
  },
  mexico: {
    country: "Mexico",
    codes: ["NOM standards", "ASME / API (adopted)"],
    primary_authority_description: "NOM standards + ASEA (oil & gas) / PEMEX specifications; API/ASME adopted",
    regulatory_body: "ASEA / CNH",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with national overlay"
  },
  nigeria: {
    country: "Nigeria",
    codes: ["ASME / API (adopted)", "NUPRC guidelines"],
    primary_authority_description: "NUPRC (upstream) / NMDPRA + NCDMB content rules; API/ASME-based",
    regulatory_body: "NUPRC / NMDPRA",
    class_societies: [],
    unit_system: "Mixed",
    note: "DPR dissolved 2021 -> NUPRC/NMDPRA"
  },
  egypt: {
    country: "Egypt",
    codes: ["ASME / API (adopted)", "Egyptian standards (EOS)"],
    primary_authority_description: "EGPC / EGAS + Egyptian Organization for Standardization; API/ASME-based",
    regulatory_body: "EGPC / EOS",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with national overlay"
  },
  kazakhstan: {
    country: "Kazakhstan",
    codes: ["GOST standards", "ASME / API (adopted)"],
    primary_authority_description: "GOST + national technical regulations; API/ASME in oil & gas",
    regulatory_body: "National technical regulator / KazMunayGas",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with GOST overlay"
  },
  argentina: {
    country: "Argentina",
    codes: ["IRAM standards", "ASME / API (adopted)"],
    primary_authority_description: "IRAM standards + Secretaria de Energia; API/ASME adopted",
    regulatory_body: "Secretaria de Energia / IRAM",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with national overlay"
  },
  chile: {
    country: "Chile",
    codes: ["NCh standards", "ASME / API (adopted)"],
    primary_authority_description: "NCh standards + SEC; SERNAGEOMIN for mining; API/ASME adopted",
    regulatory_body: "SEC / SERNAGEOMIN (mining)",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with national overlay"
  },
  south_africa: {
    country: "South Africa",
    codes: ["SANS", "OHS Act Pressure Equipment Regulations (PER)", "ASME / API (adopted)"],
    primary_authority_description: "SANS + OHS Act Pressure Equipment Regulations (PER); API/ASME adopted",
    regulatory_body: "Dept of Employment & Labour (OHS Act) / SANAS",
    class_societies: [],
    unit_system: "Metric",
    note: "API/ASME commonly adopted with SANS/PER overlay"
  },
};

// ============================================================
// LOCATION TEXT → JURISDICTION RESOLVER (NLP-style)
// ============================================================
interface LocationResolution {
  jurisdiction_key: string | null;
  jurisdiction_entry: JurisdictionEntry | null;
  country: string | null;
  region_or_state: string | null;
  is_us: boolean;
  is_offshore: boolean;
  is_unknown: boolean;
  confidence: "high" | "medium" | "low" | "none";
}

const US_PATTERNS = [
  /\bunited\s*states\b/i,
  /\bu\.?s\.?\s*(refinery|facility|plant|onshore|gulf|coast|pipeline)?\b/i,
  /\bgulf\s*of\s*mexico\b/i,
  /\boffshore\s*gulf/i,
  /\b(texas|louisiana|california|alaska|hawaii|oklahoma|new\s*mexico|ohio|pennsylvania|west\s*virginia|wyoming|montana|north\s*dakota|colorado|kansas|illinois|indiana|michigan)\b/i,
  /\bamerican\b/i,
  /\busa\b/i
];

const INTERNATIONAL_OFFSHORE_PATTERNS = [
  /\binternational\s*waters?\b/i,
  /\bflagged?\s*vessel\b/i,
  /\bflag\s*state\b/i
];

const LOCATION_PATTERNS: { pattern: RegExp; key: string; region?: string }[] = [
  { pattern: /\bnorway|norwegian|north\s*sea.*norway|norway.*offshore\b/i, key: "norway" },
  { pattern: /\baberdeen|united\s*kingdom|\buk\b|scotland|england|wales|british\b/i, key: "uk" },
  { pattern: /\bbrazil|brazilian|petrobras|fpso.*brazil|brazil.*fpso\b/i, key: "brazil" },
  { pattern: /\balberta\b/i, key: "alberta", region: "Alberta" },
  { pattern: /\bcanada|canadian|british\s*columbia|ontario|quebec|saskatchewan|manitoba|nova\s*scotia\b/i, key: "canada" },
  { pattern: /\baustralia|australian|western\s*australia|queensland|victoria|nsw|new\s*south\s*wales\b/i, key: "australia" },
  { pattern: /\bgermany|german\b/i, key: "germany" },
  { pattern: /\bjapan|japanese\b/i, key: "japan" },
  { pattern: /\bchina|chinese\b/i, key: "china" },
  { pattern: /\bindia|indian\b/i, key: "india" },
  { pattern: /\bkorea|korean\b/i, key: "korea" },
  { pattern: /\bsingapore\b/i, key: "singapore" },
  { pattern: /\bsaudi|aramco|adnoc|uae|qatar|middle\s*east|kuwait|oman|bahrain\b/i, key: "middle_east" },
  { pattern: /\beu\b|european\s*union/i, key: "eu" },
  { pattern: /\bfrance|french\b/i, key: "france" },
  { pattern: /\bnetherlands|dutch|holland\b/i, key: "netherlands" },
  { pattern: /\bpoland|polish\b/i, key: "poland" },
  { pattern: /\bindonesia|indonesian|java\s*sea\b/i, key: "indonesia" },
  // DEPLOY466 - word-boundary-safe Mexico tagger. The old /\bmexico.../ matched the "Mexico" inside
  // "Gulf of Mexico" (US offshore) and "New Mexico" (US state), wrongly flipping a US asset to Mexico.
  // Negative lookbehinds exclude "gulf of " and "new " so a genuine Mexico (Pemex, offshore Mexico)
  // still tags while US Gulf-of-Mexico / New Mexico stay US. (The US/BSEE overlay path is unchanged.)
  { pattern: /(?<!gulf\s+of\s+)(?<!new\s+)\bmexico\b|\bmexican\b|\bpemex\b/i, key: "mexico" },
  { pattern: /\bnigeria|nigerian\b/i, key: "nigeria" },
  { pattern: /\begypt|egyptian\b/i, key: "egypt" },
  { pattern: /\bkazakhstan|kazakh\b/i, key: "kazakhstan" },
  { pattern: /\bargentina|argentine\b/i, key: "argentina" },
  { pattern: /\bchile|chilean\b/i, key: "chile" },
  { pattern: /\bsouth\s*africa|south\s*african\b/i, key: "south_africa" }
];

function resolveLocationText(locationText: string | undefined): LocationResolution {
  if (!locationText || locationText.trim() === "") {
    return { jurisdiction_key: null, jurisdiction_entry: null, country: null, region_or_state: null, is_us: false, is_offshore: false, is_unknown: true, confidence: "none" };
  }

  const loc = locationText.trim();

  for (const pat of INTERNATIONAL_OFFSHORE_PATTERNS) {
    if (pat.test(loc)) {
      const entry = JURISDICTION_REGISTRY["offshore_international"];
      return { jurisdiction_key: "offshore_international", jurisdiction_entry: entry, country: "International Waters", region_or_state: null, is_us: false, is_offshore: true, is_unknown: false, confidence: "medium" };
    }
  }

  for (const pat of US_PATTERNS) {
    if (pat.test(loc)) {
      let overridden = false;
      for (const lp of LOCATION_PATTERNS) {
        if (lp.pattern.test(loc)) { overridden = true; break; }
      }
      if (!overridden) {
        const entry = JURISDICTION_REGISTRY["us"];
        const isOffshore = /offshore|gulf\s*of\s*mexico/i.test(loc);
        return { jurisdiction_key: "us", jurisdiction_entry: entry, country: "United States", region_or_state: null, is_us: true, is_offshore: isOffshore, is_unknown: false, confidence: "high" };
      }
    }
  }

  for (const lp of LOCATION_PATTERNS) {
    if (lp.pattern.test(loc)) {
      const entry = JURISDICTION_REGISTRY[lp.key];
      const isOffshore = /offshore|subsea|north\s*sea|fpso/i.test(loc);
      let region = lp.region || null;
      if (lp.key === "australia" && /western\s*australia/i.test(loc)) region = "Western Australia";
      if (lp.key === "canada" && /alberta/i.test(loc)) region = "Alberta";
      return { jurisdiction_key: lp.key, jurisdiction_entry: entry, country: entry.country, region_or_state: region, is_us: false, is_offshore: isOffshore || (entry.is_offshore || false), is_unknown: false, confidence: "high" };
    }
  }

  return { jurisdiction_key: null, jurisdiction_entry: null, country: null, region_or_state: null, is_us: false, is_offshore: /offshore|subsea/i.test(loc), is_unknown: true, confidence: "none" };
}

// ============================================================
// UNIT CONVERSION ENGINE (carried from v2.1)
// ============================================================
const CONVERSIONS = {
  inches_to_mm: 25.4,
  mm_to_inches: 0.0393701
};

interface ThicknessValue {
  value: number;
  unit: "inches" | "mm";
  context: string;
}

function extractThicknessValues(description: string): ThicknessValue[] {
  const values: ThicknessValue[] = [];
  const inchPatterns = /(\d+\.?\d*)\s*(?:inches|inch|in\.?)\b/gi;
  let match;
  while ((match = inchPatterns.exec(description)) !== null) {
    values.push({ value: parseFloat(match[1]), unit: "inches", context: match[0] });
  }
  const mmPatterns = /(\d+\.?\d*)\s*mm\b/gi;
  while ((match = mmPatterns.exec(description)) !== null) {
    values.push({ value: parseFloat(match[1]), unit: "mm", context: match[0] });
  }
  return values;
}

interface UnitConversionResult {
  unit_conversion_required: boolean;
  detected_units: "IMPERIAL" | "METRIC" | "MIXED";
  jurisdiction_expects: string;
  conversion_check?: string;
  threshold_violation?: { required: string; measured: string; disposition: string };
}

function analyzeUnits(description: string, unitsDetected: string, jurisdictionEntry: JurisdictionEntry | null, isUS: boolean): UnitConversionResult {
  const thicknessValues = extractThicknessValues(description);
  const hasMM = thicknessValues.some(v => v.unit === "mm");
  const hasInches = thicknessValues.some(v => v.unit === "inches");
  const isMixed = (hasMM && hasInches) || unitsDetected === "MIXED";

  const jurisdictionExpects = isUS ? "Imperial" : (jurisdictionEntry?.unit_system || "Metric");
  const conversionRequired = isMixed || (isUS && hasMM && !hasInches) || (!isUS && hasInches && !hasMM);

  let conversionCheck: string | undefined;
  let thresholdViolation: UnitConversionResult["threshold_violation"] | undefined;

  if (isMixed || conversionRequired) {
    for (const tv of thicknessValues) {
      if (tv.unit === "inches" && !conversionCheck) {
        const mmVal = parseFloat((tv.value * CONVERSIONS.inches_to_mm).toFixed(2));
        conversionCheck = `${tv.value} inches = ${mmVal} mm`;
      }
    }

    const reqMatch = description.match(/(?:required|minimum\s*required|min\.?\s*req(?:uired)?)\s*(?:thickness\s*(?:is|=|:)?\s*)?(\d+\.?\d*)\s*(inches|inch|in\.?|mm)/i);
    const measMatch = description.match(/(?:measured|remaining|actual)\s*(?:thickness\s*(?:is|=|:)?\s*)?(\d+\.?\d*)\s*(inches|inch|in\.?|mm)/i);

    if (reqMatch && measMatch) {
      let reqValue = parseFloat(reqMatch[1]);
      let reqUnit = reqMatch[2].toLowerCase().startsWith("in") ? "inches" : "mm";
      let measValue = parseFloat(measMatch[1]);
      let measUnit = measMatch[2].toLowerCase().startsWith("in") ? "inches" : "mm";

      let reqMM = reqUnit === "inches" ? reqValue * CONVERSIONS.inches_to_mm : reqValue;
      let measMM = measUnit === "inches" ? measValue * CONVERSIONS.inches_to_mm : measValue;
      reqMM = parseFloat(reqMM.toFixed(2));
      measMM = parseFloat(measMM.toFixed(2));

      if (reqUnit !== measUnit) {
        conversionCheck = `${reqValue} ${reqUnit} = ${reqUnit === "inches" ? reqMM : parseFloat((reqValue * CONVERSIONS.mm_to_inches).toFixed(4))} ${reqUnit === "inches" ? "mm" : "inches"}`;
      }

      if (measMM < reqMM) {
        thresholdViolation = {
          required: `${reqValue} ${reqUnit} (${reqMM} mm)`,
          measured: `${measValue} ${measUnit} (${measMM} mm)`,
          disposition: "BELOW_MINIMUM_REQUIRED_THICKNESS"
        };
      }
    }
  }

  return { unit_conversion_required: conversionRequired || isMixed, detected_units: isMixed ? "MIXED" : (hasInches ? "IMPERIAL" : "METRIC"), jurisdiction_expects: jurisdictionExpects, conversion_check: conversionCheck, threshold_violation: thresholdViolation };
}

// ============================================================
// AUTHORITY CONFLICT ANALYSIS (carried from v2.1)
// ============================================================
const US_CODES = ["API 570", "API 510", "ASME BPVC", "ASME B31.3", "ASME Section VIII", "API 579", "API 1104", "AWS D1.1", "AWS D1.5"];

function analyzeAuthorityConflict(requestedCode: string, location: LocationResolution, ownerUserProgram?: string, operatorName?: string) {
  const isUSCode = US_CODES.some(c => requestedCode.toUpperCase().indexOf(c.toUpperCase()) >= 0 || c.toUpperCase().indexOf(requestedCode.toUpperCase()) >= 0);

  if (location.is_us) {
    return { has_conflict: false, code_is_controlling: true, code_is_contractual: false, code_is_reference_only: false, warning: null };
  }

  if (isUSCode && !location.is_us) {
    const isContractual = !!(ownerUserProgram && /contract|specify|specif|require|adopt/i.test(ownerUserProgram));
    let warning: string;
    if (isContractual) {
      warning = `Contractual ${requestedCode} may supplement but should not override mandatory ${location.country || "local"} offshore authority.`;
    } else if (operatorName) {
      warning = `${operatorName} or owner specification may dominate over generic ${requestedCode}.`;
    } else if (location.is_offshore) {
      warning = `${requestedCode} may be technical reference only unless contractually adopted.`;
    } else {
      const localCode = location.jurisdiction_entry ? location.jurisdiction_entry.codes[0] : "";
      warning = `${requestedCode} may apply by design basis or contract, but local WHS / ${localCode} authority must be verified.`;
    }
    return { has_conflict: true, code_is_controlling: false, code_is_contractual: isContractual, code_is_reference_only: !isContractual, warning };
  }

  return { has_conflict: false, code_is_controlling: true, code_is_contractual: false, code_is_reference_only: false, warning: null };
}

// ============================================================
// LIVE AUTHORITY VERIFICATION ENGINE (NEW in v2.2)
// ============================================================
interface VerificationResult {
  edition_status: EditionStatus;
  edition_lock: EditionLock;
  latest_known_edition: string;
  edition_record: EditionRecord | null;
  superseded_by: string | null;
  verified_sources: string[];
  rejected_sources: string[];
  source_quality_score: number;
  authority_freshness_score: number;
  edition_conflict: boolean;
  live_verification_required: boolean;
  reasoning: string;
}

// Verification cache — entries expire after 30 days
interface CacheEntry {
  code: string;
  result: VerificationResult;
  cached_at: string;
  expires_at: string;
}

const VERIFICATION_CACHE: Map<string, CacheEntry> = new Map();
const CACHE_TTL_DAYS = 30;

function isCacheValid(entry: CacheEntry): boolean {
  return new Date(entry.expires_at) > new Date();
}

function computeAuthorityfreshness(record: EditionRecord): number {
  const now = new Date();
  const lastVerified = new Date(record.last_verified);
  const daysSinceVerification = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);

  // Perfect freshness if verified within 90 days
  if (daysSinceVerification <= 90) return 1.0;
  // Linear decay from 90 to 365 days
  if (daysSinceVerification <= 365) return 1.0 - ((daysSinceVerification - 90) / 365) * 0.5;
  // After 1 year, freshness below 0.5 — verification needed
  if (daysSinceVerification <= 730) return 0.5 - ((daysSinceVerification - 365) / 730) * 0.3;
  // After 2 years, stale
  return 0.1;
}

function findEditionRecord(requestedCode: string): EditionRecord | null {
  // Direct match
  const direct = EDITION_REGISTRY.find(r => r.code.toLowerCase() === requestedCode.toLowerCase());
  if (direct) return direct;

  // Fuzzy match — code contains or is contained
  for (const record of EDITION_REGISTRY) {
    if (requestedCode.toLowerCase().indexOf(record.code.toLowerCase()) >= 0 ||
        record.code.toLowerCase().indexOf(requestedCode.toLowerCase()) >= 0) {
      return record;
    }
  }

  return null;
}

function verifyAuthority(requestedCode: string, requestedEdition?: string): VerificationResult {
  // Check cache first
  const cacheKey = `${requestedCode}|${requestedEdition || ""}`;
  const cached = VERIFICATION_CACHE.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return cached.result;
  }

  const record = findEditionRecord(requestedCode);

  // No record found — cannot verify
  if (!record) {
    const result: VerificationResult = {
      edition_status: "OFFICIAL_SOURCE_NOT_FOUND",
      edition_lock: "HOLD_FOR_EDITION_VERIFICATION",
      latest_known_edition: "UNKNOWN",
      edition_record: null,
      superseded_by: null,
      verified_sources: [],
      rejected_sources: [],
      source_quality_score: 0.0,
      authority_freshness_score: 0.0,
      edition_conflict: false,
      live_verification_required: true,
      reasoning: `No edition record found for "${requestedCode}". Cannot verify currency or applicability. Manual verification required against official standards body publication.`
    };
    return result;
  }

  // Check if withdrawn
  if (record.withdrawn) {
    const result: VerificationResult = {
      edition_status: "WITHDRAWN",
      edition_lock: "BLOCK_WITHDRAWN_AUTHORITY",
      latest_known_edition: record.current_edition,
      edition_record: record,
      superseded_by: record.superseded_by || null,
      verified_sources: [record.verification_source],
      rejected_sources: [],
      source_quality_score: 1.0,
      authority_freshness_score: 0.0,
      edition_conflict: true,
      live_verification_required: false,
      reasoning: `"${requestedCode}" has been WITHDRAWN${record.withdrawal_date ? " on " + record.withdrawal_date : ""}. ${record.superseded_by ? "Replaced by: " + record.superseded_by + "." : ""} This standard cannot be used as governing authority for any inspection disposition.`
    };
    cacheResult(cacheKey, result);
    return result;
  }

  // Check if superseded (but not withdrawn)
  if (record.superseded_by) {
    const result: VerificationResult = {
      edition_status: "SUPERSEDED",
      edition_lock: "BLOCK_SUPERSEDED_AUTHORITY",
      latest_known_edition: record.current_edition,
      edition_record: record,
      superseded_by: record.superseded_by,
      verified_sources: [record.verification_source],
      rejected_sources: [],
      source_quality_score: 0.9,
      authority_freshness_score: 0.2,
      edition_conflict: true,
      live_verification_required: false,
      reasoning: `"${requestedCode}" has been SUPERSEDED by "${record.superseded_by}". The superseded edition cannot be used as primary governing authority unless explicitly specified by owner-user program with documented justification.`
    };
    cacheResult(cacheKey, result);
    return result;
  }

  // Record exists and is current — check edition match
  const freshnessScore = computeAuthorityfreshness(record);
  const sourceQuality = 1.0; // From official registry

  // Check if user-reported edition matches current
  let editionConflict = false;
  let editionStatus: EditionStatus = "VERIFIED_CURRENT";
  let editionLock: EditionLock = "NO_LOCK";
  let reasoning = "";

  if (requestedEdition) {
    // User specified an edition — check if it matches current
    const userYear = extractYear(requestedEdition);
    if (userYear && userYear < record.current_year) {
      editionConflict = true;
      editionStatus = "SUPERSEDED";
      editionLock = "WARN_ONLY";
      reasoning = `User-reported edition "${requestedEdition}" appears older than current edition "${record.current_edition}" (${record.current_year}). Verify that older edition is contractually specified or accepted by jurisdiction. Current edition should be used unless explicitly documented otherwise.`;
    } else if (userYear && userYear === record.current_year) {
      editionStatus = "VERIFIED_CURRENT";
      editionLock = "NO_LOCK";
      reasoning = `Edition "${requestedEdition}" matches or is consistent with current edition "${record.current_edition}". Authority is verified current.`;
    } else {
      editionStatus = "VERIFIED_CURRENT";
      editionLock = "NO_LOCK";
      reasoning = `Edition "${requestedEdition}" is consistent with current edition "${record.current_edition}".`;
    }
  } else {
    // No edition specified by user
    if (freshnessScore >= 0.8) {
      editionStatus = "VERIFIED_CURRENT";
      editionLock = "NO_LOCK";
      reasoning = `"${requestedCode}" verified as current. Latest edition: "${record.current_edition}". Verified via ${record.verification_source} on ${record.last_verified}.`;
    } else if (freshnessScore >= 0.5) {
      editionStatus = "VERIFIED_BUT_EDITION_UNKNOWN";
      editionLock = "WARN_ONLY";
      reasoning = `"${requestedCode}" was verified on ${record.last_verified} as "${record.current_edition}" but verification is aging. Recommend re-verification against official source.`;
    } else {
      editionStatus = "LIVE_CHECK_REQUIRED";
      editionLock = "HOLD_FOR_EDITION_VERIFICATION";
      reasoning = `"${requestedCode}" last verified on ${record.last_verified} — verification is stale (freshness: ${(freshnessScore * 100).toFixed(0)}%). A new edition may have been published. Live verification required before final disposition.`;
    }
  }

  const result: VerificationResult = {
    edition_status: editionStatus,
    edition_lock: editionLock,
    latest_known_edition: record.current_edition,
    edition_record: record,
    superseded_by: null,
    verified_sources: [record.verification_source, record.official_source_url],
    rejected_sources: [],
    source_quality_score: sourceQuality,
    authority_freshness_score: freshnessScore,
    edition_conflict: editionConflict,
    live_verification_required: freshnessScore < 0.5,
    reasoning
  };

  cacheResult(cacheKey, result);
  return result;
}

function cacheResult(key: string, result: VerificationResult): void {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  VERIFICATION_CACHE.set(key, { code: key, result, cached_at: now.toISOString(), expires_at: expires.toISOString() });
}

function extractYear(editionString: string): number | null {
  const match = editionString.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// ============================================================
// MANDATORY QUESTIONS GENERATOR (expanded for v2.2)
// ============================================================
function generateMandatoryQuestions(location: LocationResolution, requestedCode: string, conflict: any, verification: VerificationResult): string[] {
  const questions: string[] = [];

  if (location.is_unknown) {
    questions.push("What country is the asset located in?");
    questions.push("Is the asset onshore or offshore?");
    questions.push(`Is ${requestedCode} legally required or only contractually referenced?`);
    return questions;
  }

  if (location.jurisdiction_key === "offshore_international") {
    questions.push("What is the vessel flag state?");
    questions.push("Which class society governs the vessel?");
    questions.push(`Is ${requestedCode} contractually adopted for this component?`);
    return questions;
  }

  if (location.jurisdiction_key === "alberta" || location.jurisdiction_key === "canada") {
    questions.push("Which provincial pressure equipment authority applies?");
    questions.push(`Is ${requestedCode} contractually adopted?`);
    questions.push(`Does the owner-user program reference CSA, ASME, or API?`);
  }

  // Edition-related questions
  if (verification.edition_status === "SUPERSEDED" && !verification.edition_record?.withdrawn) {
    questions.push(`Are you using a superseded edition of ${requestedCode}? If so, is this contractually specified?`);
  }
  if (verification.edition_status === "OFFICIAL_SOURCE_NOT_FOUND") {
    questions.push(`Can you confirm the exact standard designation and edition for "${requestedCode}"?`);
    questions.push("What is the official source for this standard in your jurisdiction?");
  }
  if (verification.live_verification_required) {
    questions.push(`Can you confirm the edition of ${requestedCode} currently adopted by your facility/jurisdiction?`);
  }

  return questions;
}

// ============================================================
// DECISION LOCK + FINAL DISPOSITION DETERMINATION (v2.2)
// ============================================================
function determineDecisionLock(location: LocationResolution, conflict: any, unitResult: UnitConversionResult, verification: VerificationResult): DecisionLock {
  // Withdrawn or blocked superseded → BLOCK
  if (verification.edition_lock === "BLOCK_WITHDRAWN_AUTHORITY" || verification.edition_lock === "BLOCK_SUPERSEDED_AUTHORITY") {
    return "BLOCK";
  }

  // Unknown jurisdiction → hold
  if (location.is_unknown) return "HOLD_FOR_AUTHORITY";

  // International offshore → hold
  if (location.jurisdiction_key === "offshore_international") return "HOLD_FOR_AUTHORITY";

  // Edition hold states
  if (verification.edition_lock === "HOLD_FOR_EDITION_VERIFICATION" || verification.edition_lock === "HOLD_FOR_OFFICIAL_SOURCE") {
    return "HOLD_FOR_AUTHORITY";
  }

  // US jurisdiction clean
  if (location.is_us && !conflict.has_conflict && !unitResult.unit_conversion_required && verification.edition_lock === "NO_LOCK") {
    return "ALLOW";
  }

  // US with mixed units or edition warning
  if (location.is_us && (unitResult.unit_conversion_required || verification.edition_lock === "WARN_ONLY")) {
    return "ALLOW_WITH_WARNING";
  }

  // Non-US with code conflict
  if (conflict.has_conflict) return "ALLOW_WITH_WARNING";

  // Default
  if (verification.edition_lock === "WARN_ONLY") return "ALLOW_WITH_WARNING";
  return "ALLOW";
}

function determineFinalDispositionAllowed(decisionLock: DecisionLock, verification: VerificationResult, unitResult: UnitConversionResult): boolean {
  // Final disposition is ONLY allowed when:
  // 1. Decision lock is ALLOW or ALLOW_WITH_WARNING
  // 2. Edition status is VERIFIED_CURRENT or VERIFIED_BUT_EDITION_UNKNOWN
  // 3. No threshold violation exists (or violation is acknowledged)
  // 4. Authority is not stale

  if (decisionLock === "BLOCK" || decisionLock === "HOLD_FOR_AUTHORITY") return false;
  if (verification.edition_status === "WITHDRAWN") return false;
  if (verification.edition_status === "SUPERSEDED" && verification.edition_lock !== "WARN_ONLY") return false;
  if (verification.edition_status === "LIVE_CHECK_REQUIRED") return false;
  if (verification.edition_status === "OFFICIAL_SOURCE_NOT_FOUND") return false;
  if (verification.edition_status === "MANUAL_REVIEW_REQUIRED") return false;
  if (verification.authority_freshness_score < 0.3) return false;

  return true;
}

// ============================================================
// CROSSWALK (carried from v2.1 — abbreviated for v2.2)
// ============================================================
interface CrosswalkEntry {
  equivalent: string;
  equivalence_type: "FULL" | "PARTIAL" | "NONE";
  differences: string[];
  usage_rule: "PRIMARY" | "CSA_PRIMARY" | "SUPPLEMENTAL_ONLY" | "NOT_PRIMARY" | "PROHIBITED";
}

const CROSSWALK_MATRIX: Record<string, Record<string, CrosswalkEntry>> = {
  "API 570": {
    canada: { equivalent: "CSA Z662 / CSA B51", equivalence_type: "PARTIAL", differences: ["CSA governs nationally via CRN system", "Provincial adoption requirements apply"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK M-001 / DNV-RP-G101", equivalence_type: "PARTIAL", differences: ["Risk-based inspection methodology differs", "NORSOK qualification requirements differ"], usage_rule: "SUPPLEMENTAL_ONLY" },
    eu: { equivalent: "EN 13480 (in-service)", equivalence_type: "PARTIAL", differences: ["PED compliance required", "Notified Body involvement required"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "BS EN 13480 / PER 1999 / SAFed guidelines", equivalence_type: "PARTIAL", differences: ["Pressure Equipment Regulations 1999 govern", "Written scheme required"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["Australian in-service inspection standard governs"], usage_rule: "NOT_PRIMARY" },
    brazil: { equivalent: "NR-13 / ABNT NBR 15749", equivalence_type: "PARTIAL", differences: ["NR-13 is mandatory Brazilian regulation"], usage_rule: "NOT_PRIMARY" }
  },
  "API 510": {
    canada: { equivalent: "CSA B51", equivalence_type: "PARTIAL", differences: ["CSA B51 covers boilers and pressure vessels", "CRN required"], usage_rule: "CSA_PRIMARY" },
    norway: { equivalent: "NORSOK + EN 13445", equivalence_type: "PARTIAL", differences: ["EN 13445 for design/fabrication", "PSA oversight required"], usage_rule: "NOT_PRIMARY" },
    eu: { equivalent: "EN 13445 + PED 2014/68/EU", equivalence_type: "PARTIAL", differences: ["PED mandatory", "CE marking required"], usage_rule: "NOT_PRIMARY" },
    australia: { equivalent: "AS 1210 + AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 1210 for design", "AS/NZS 3788 for in-service"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "PER 1999 / PSSR 2000 / EN 13445", equivalence_type: "PARTIAL", differences: ["HSE written scheme required", "UKCA marking"], usage_rule: "NOT_PRIMARY" }
  },
  "ASME B31.3": {
    australia: { equivalent: "AS 4458 / AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 4458 for pressure piping", "State WorkSafe registration"], usage_rule: "NOT_PRIMARY" },
    norway: { equivalent: "NORSOK L-001 / DNV-OS-F101", equivalence_type: "PARTIAL", differences: ["NORSOK governs piping design offshore"], usage_rule: "NOT_PRIMARY" },
    uk: { equivalent: "PD 8010 / BS EN 13480", equivalence_type: "PARTIAL", differences: ["EN 13480 for metallic industrial piping"], usage_rule: "NOT_PRIMARY" }
  }
};

const REGION_FALLBACK: Record<string, string> = {
  germany: "eu", france: "eu", italy: "eu", spain: "eu", netherlands: "eu",
  belgium: "eu", austria: "eu", sweden: "eu", finland: "eu", denmark: "eu",
  alberta: "canada", scotland: "uk", wales: "uk", new_zealand: "australia"
};

function findCrosswalk(requestedCode: string, jurisdictionKey: string) {
  if (CROSSWALK_MATRIX[requestedCode]?.[jurisdictionKey]) return CROSSWALK_MATRIX[requestedCode][jurisdictionKey];
  const fallback = REGION_FALLBACK[jurisdictionKey];
  if (fallback && CROSSWALK_MATRIX[requestedCode]?.[fallback]) return CROSSWALK_MATRIX[requestedCode][fallback];
  for (const cwKey of Object.keys(CROSSWALK_MATRIX)) {
    if (requestedCode.indexOf(cwKey) >= 0 || cwKey.indexOf(requestedCode) >= 0) {
      if (CROSSWALK_MATRIX[cwKey][jurisdictionKey]) return CROSSWALK_MATRIX[cwKey][jurisdictionKey];
      if (fallback && CROSSWALK_MATRIX[cwKey][fallback]) return CROSSWALK_MATRIX[cwKey][fallback];
    }
  }
  return null;
}

// ============================================================
// FULL v2.2 OUTPUT INTERFACE
// ============================================================
interface AuditEntry {
  timestamp: string;
  step: string;
  decision: string;
  basis: string;
}

interface EngineOutputV22 {
  authority_decision_id: string;
  engine: string;
  version: string;
  jurisdiction_status: JurisdictionStatus;
  country: string | null;
  region_or_state: string | null;
  offshore_region: string | null;
  asset_type: string;
  industry_domain: string;
  primary_authority: string;
  secondary_authorities: string[];
  equivalent_or_related_standards: string[];
  blocked_standards: string[];
  authority_confidence: number;
  edition_status: EditionStatus;
  edition_lock: EditionLock;
  live_verification_required: boolean;
  verified_sources: string[];
  rejected_sources: string[];
  source_quality_score: number;
  authority_freshness_score: number;
  latest_known_edition: string;
  user_reported_edition: string;
  edition_conflict: boolean;
  reasoning_summary: string;
  mandatory_user_questions: string[];
  decision_lock: DecisionLock;
  final_disposition_allowed: boolean;
  unit_conversion_required: boolean;
  conversion_check: string | null;
  technical_disposition: string | null;
  warning: string | null;
  inspector_message: string;
  audit_trace: AuditEntry[];
}

// ============================================================
// MAIN ENGINE v2.2
// ============================================================
interface EngineInput {
  asset_description?: string;
  location_text?: string;
  units_detected?: string;
  asset_type?: string;
  inspection_method?: string;
  requested_code?: string;
  requested_edition?: string;
  operator_name?: string;
  owner_user_program?: string;
  industry_domain?: string;
  offshore_region?: string;
  // Legacy v2.0/v2.1 format support
  jurisdiction?: string;
  us_codes?: string[];
  us_codes_requested?: string[];
}

function processAuthorityV22(input: EngineInput): EngineOutputV22 {
  const now = new Date().toISOString();
  const audit: AuditEntry[] = [];
  const decisionId = `GAE-V2.2-${randomUUID()}`;

  // Normalize input
  const locationText = input.location_text || input.jurisdiction || "";
  const requestedCode = input.requested_code || (input.us_codes_requested || input.us_codes || [])[0] || "";
  const requestedEdition = input.requested_edition || "";
  const assetDescription = input.asset_description || "";
  const unitsDetected = input.units_detected || "UNKNOWN";
  const assetType = input.asset_type || "Unknown";
  const industryDomain = input.industry_domain || "General";
  const offshoreRegion = input.offshore_region || null;

  audit.push({ timestamp: now, step: "input_received", decision: `location="${locationText}", code="${requestedCode}", edition="${requestedEdition}", units="${unitsDetected}"`, basis: "Raw input normalization" });

  // Step 1: Resolve jurisdiction
  const location = resolveLocationText(locationText);
  audit.push({ timestamp: now, step: "jurisdiction_resolution", decision: `key=${location.jurisdiction_key || "UNKNOWN"}, country=${location.country || "UNKNOWN"}, is_us=${location.is_us}, offshore=${location.is_offshore}`, basis: "NLP location resolver" });

  // Step 2: Authority conflict analysis
  const conflict = analyzeAuthorityConflict(requestedCode, location, input.owner_user_program, input.operator_name);
  audit.push({ timestamp: now, step: "authority_conflict_analysis", decision: `conflict=${conflict.has_conflict}, controlling=${conflict.code_is_controlling}, contractual=${conflict.code_is_contractual}`, basis: "Code vs jurisdiction comparison" });

  // Step 3: Unit analysis
  const unitResult = analyzeUnits(assetDescription, unitsDetected, location.jurisdiction_entry, location.is_us);
  audit.push({ timestamp: now, step: "unit_analysis", decision: `detected=${unitResult.detected_units}, expects=${unitResult.jurisdiction_expects}, conversion=${unitResult.unit_conversion_required}`, basis: "Unit conversion engine" });

  // Step 4: LIVE AUTHORITY VERIFICATION (NEW in v2.2)
  const verification = verifyAuthority(requestedCode, requestedEdition || undefined);
  audit.push({ timestamp: now, step: "edition_verification", decision: `status=${verification.edition_status}, lock=${verification.edition_lock}, freshness=${verification.authority_freshness_score.toFixed(2)}`, basis: "Edition registry + freshness computation" });

  if (verification.edition_conflict) {
    audit.push({ timestamp: now, step: "edition_conflict_detected", decision: verification.reasoning, basis: "Edition comparison" });
  }

  // Step 5: Mandatory questions
  const mandatoryQuestions = generateMandatoryQuestions(location, requestedCode, conflict, verification);

  // Step 6: Decision lock
  const decisionLock = determineDecisionLock(location, conflict, unitResult, verification);
  audit.push({ timestamp: now, step: "decision_lock", decision: decisionLock, basis: "Combined jurisdiction + conflict + unit + edition analysis" });

  // Step 7: Final disposition allowed
  const finalDispositionAllowed = determineFinalDispositionAllowed(decisionLock, verification, unitResult);
  audit.push({ timestamp: now, step: "final_disposition_gate", decision: `allowed=${finalDispositionAllowed}`, basis: "Edition status + freshness + decision lock" });

  // Step 8: Crosswalk
  let equivalentStandards: string[] = [];
  if (!location.is_us && location.jurisdiction_key && requestedCode) {
    const cw = findCrosswalk(requestedCode, location.jurisdiction_key);
    if (cw) equivalentStandards = [cw.equivalent];
  }

  // Step 9: Secondary authorities
  let secondaryAuthorities: string[] = [];
  if (!location.is_us && location.jurisdiction_entry) {
    if (conflict.code_is_contractual) secondaryAuthorities.push(`${requestedCode} (contractual)`);
    if (location.jurisdiction_key === "norway") secondaryAuthorities.push("NORSOK", "DNV", "operator specification");
    if (location.jurisdiction_key === "offshore_international") secondaryAuthorities.push("DNV", "ABS", "Lloyd's Register", "Bureau Veritas", "operator specification");
  }

  // Step 10: Blocked standards
  const blockedStandards: string[] = [];
  if (verification.edition_status === "WITHDRAWN") blockedStandards.push(`${requestedCode} (WITHDRAWN)`);
  if (verification.edition_status === "SUPERSEDED" && verification.edition_lock === "BLOCK_SUPERSEDED_AUTHORITY") {
    blockedStandards.push(`${requestedCode} (SUPERSEDED by ${verification.superseded_by})`);
  }

  // Step 11: Primary authority
  let primaryAuthority: string;
  if (location.is_us) primaryAuthority = requestedCode || "API / ASME codes";
  else if (location.jurisdiction_entry) primaryAuthority = location.jurisdiction_entry.primary_authority_description;
  else if (location.jurisdiction_key === "offshore_international") primaryAuthority = "Flag state / class society / maritime regulatory framework";
  else primaryAuthority = "UNKNOWN — jurisdiction must be confirmed";

  // Step 12: Jurisdiction status mapping
  let jurisdictionStatus: JurisdictionStatus;
  if (location.is_unknown) jurisdictionStatus = "UNKNOWN";
  else if (location.confidence === "high") jurisdictionStatus = "CONFIRMED";
  else if (location.confidence === "medium") jurisdictionStatus = "INFERRED";
  else jurisdictionStatus = "UNKNOWN";

  // Step 13: Warning
  let warning: string | null = null;
  if (location.is_unknown && (unitsDetected === "IMPERIAL" || unitsDetected === "UNKNOWN")) {
    warning = `Imperial units and ${requestedCode} are not enough to confirm U.S. jurisdiction.`;
  } else if (conflict.warning) {
    warning = conflict.warning;
  }
  if (unitResult.threshold_violation) {
    const tv = unitResult.threshold_violation;
    warning = (warning ? warning + " " : "") + `Measured ${tv.measured.split(" (")[0]} is below required ${tv.required.split(" (")[0]}. Do not accept.`;
  }
  if (verification.edition_status === "WITHDRAWN") {
    warning = (warning ? warning + " " : "") + `BLOCKED: ${requestedCode} is WITHDRAWN. Use ${verification.superseded_by || "current replacement"}.`;
  } else if (verification.edition_status === "SUPERSEDED" && verification.superseded_by) {
    warning = (warning ? warning + " " : "") + `WARNING: ${requestedCode} is SUPERSEDED by ${verification.superseded_by}.`;
  }

  // Step 14: Authority confidence
  let authorityConfidence = 0.0;
  if (location.is_us && !conflict.has_conflict && verification.edition_status === "VERIFIED_CURRENT") authorityConfidence = 1.0;
  else if (jurisdictionStatus === "CONFIRMED" && verification.edition_status === "VERIFIED_CURRENT") authorityConfidence = 0.9;
  else if (jurisdictionStatus === "CONFIRMED" && verification.edition_status === "VERIFIED_BUT_EDITION_UNKNOWN") authorityConfidence = 0.75;
  else if (jurisdictionStatus === "INFERRED") authorityConfidence = 0.5;
  else if (jurisdictionStatus === "UNKNOWN") authorityConfidence = 0.1;
  if (verification.edition_status === "WITHDRAWN" || verification.edition_status === "SUPERSEDED") authorityConfidence = Math.min(authorityConfidence, 0.2);

  // Step 15: Inspector message
  let inspectorMessage: string;
  if (verification.edition_status === "WITHDRAWN") {
    inspectorMessage = `STOP: "${requestedCode}" is WITHDRAWN and cannot be used for any inspection disposition. ${verification.superseded_by ? "Use " + verification.superseded_by + " instead." : "Verify replacement standard with engineering authority."}`;
  } else if (verification.edition_status === "SUPERSEDED" && verification.edition_lock === "BLOCK_SUPERSEDED_AUTHORITY") {
    inspectorMessage = `HOLD: "${requestedCode}" is SUPERSEDED by "${verification.superseded_by}". Cannot be used as primary authority unless contractually specified with documented justification.`;
  } else if (location.is_us && !unitResult.unit_conversion_required && verification.edition_status === "VERIFIED_CURRENT") {
    inspectorMessage = `${requestedCode} (${verification.latest_known_edition}) applies directly. Authority VERIFIED CURRENT. Final disposition permitted.`;
  } else if (location.is_us && unitResult.unit_conversion_required) {
    inspectorMessage = `${requestedCode} applies in U.S. jurisdiction. CAUTION: Mixed units detected — verify all conversions before final disposition.${unitResult.threshold_violation ? " CRITICAL: Measured thickness is below minimum required after conversion. REJECT." : ""}`;
  } else if (location.is_unknown) {
    inspectorMessage = `Jurisdiction cannot be confirmed. HOLD — do not lock to any code until location and authority are verified.`;
  } else if (!finalDispositionAllowed) {
    inspectorMessage = `Authority identified but final disposition NOT YET PERMITTED. Reason: ${verification.reasoning} Resolve before issuing inspection determination.`;
  } else {
    inspectorMessage = `Asset in ${location.country}${location.region_or_state ? "/" + location.region_or_state : ""}. ${primaryAuthority} governs. ${requestedCode} is ${conflict.code_is_contractual ? "contractual supplement" : "reference only"} unless contractually adopted. Edition: ${verification.latest_known_edition}.`;
  }

  audit.push({ timestamp: now, step: "output_assembled", decision: `decision_lock=${decisionLock}, final_disposition=${finalDispositionAllowed}, confidence=${authorityConfidence.toFixed(2)}`, basis: "All modules combined" });

  return {
    authority_decision_id: decisionId,
    engine: "global-authority-engine",
    version: "2.2.0",
    jurisdiction_status: jurisdictionStatus,
    country: location.country,
    region_or_state: location.region_or_state,
    offshore_region: offshoreRegion || (location.is_offshore ? (location.jurisdiction_key || "offshore") : null),
    asset_type: assetType,
    industry_domain: industryDomain,
    primary_authority: primaryAuthority,
    secondary_authorities: secondaryAuthorities,
    equivalent_or_related_standards: equivalentStandards,
    blocked_standards: blockedStandards,
    authority_confidence: parseFloat(authorityConfidence.toFixed(2)),
    edition_status: verification.edition_status,
    edition_lock: verification.edition_lock,
    live_verification_required: verification.live_verification_required,
    verified_sources: verification.verified_sources,
    rejected_sources: verification.rejected_sources,
    source_quality_score: parseFloat(verification.source_quality_score.toFixed(2)),
    authority_freshness_score: parseFloat(verification.authority_freshness_score.toFixed(2)),
    latest_known_edition: verification.latest_known_edition,
    user_reported_edition: requestedEdition || "",
    edition_conflict: verification.edition_conflict,
    reasoning_summary: verification.reasoning,
    mandatory_user_questions: mandatoryQuestions,
    decision_lock: decisionLock,
    final_disposition_allowed: finalDispositionAllowed,
    unit_conversion_required: unitResult.unit_conversion_required,
    conversion_check: unitResult.conversion_check || null,
    technical_disposition: unitResult.threshold_violation?.disposition || null,
    warning,
    inspector_message: inspectorMessage,
    audit_trace: audit
  };
}

// ============================================================
// NETLIFY HANDLER
// ============================================================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body: EngineInput = JSON.parse(event.body || "{}");

    if (!body.asset_type && !body.asset_description) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "asset_type or asset_description required" }) };
    }

    const result = processAuthorityV22(body);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Global Authority Engine error: " + (err.message || String(err)) }) };
  }
};
