/**
 * DEPLOY17_units.ts
 * Deploy to: src/lib/units.ts
 *
 * Unit conversion utility for NDT measurements
 * Imperial (US default) with metric option
 */

export type UnitSystem = "imperial" | "metric";

export interface MeasurementField {
  key: string;
  label: string;
  imperialUnit: string;
  metricUnit: string;
  imperialStep: number;
  metricStep: number;
  imperialMin: number;
  metricMin: number;
  imperialMax: number;
  metricMax: number;
}

// Conversion factors
const IN_TO_MM = 25.4;
const MM_TO_IN = 1 / 25.4;

export function inchesToMm(inches: number): number {
  return Math.round(inches * IN_TO_MM * 100) / 100;
}

export function mmToInches(mm: number): number {
  return Math.round(mm * MM_TO_IN * 10000) / 10000;
}

export function formatImperial(value: number, unit: string): string {
  if (unit === "in") {
    // Show as fraction if close to common fractions
    var frac = toFraction(value);
    if (frac) return frac + '"';
    return value.toFixed(4) + '"';
  }
  return value + " " + unit;
}

export function formatMetric(value: number, unit: string): string {
  if (unit === "mm") return value.toFixed(2) + " mm";
  return value + " " + unit;
}

export function formatValue(value: number, unit: string, system: UnitSystem): string {
  if (system === "imperial") return formatImperial(value, unit);
  return formatMetric(value, unit);
}

// Convert common fractions for display
function toFraction(decimal: number): string | null {
  var fractions: Array<[number, string]> = [
    [0.0625, "1/16"],
    [0.03125, "1/32"],
    [0.125, "1/8"],
    [0.1875, "3/16"],
    [0.25, "1/4"],
    [0.3125, "5/16"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.75, "3/4"],
    [0.875, "7/8"],
    [1.0, "1"],
  ];
  for (var i = 0; i < fractions.length; i++) {
    if (Math.abs(decimal - fractions[i][0]) < 0.0001) {
      return fractions[i][1];
    }
  }
  return null;
}

// Measurement field definitions per finding type
export function getMeasurementFields(findingType: string): MeasurementField[] {
  var fields: Record<string, MeasurementField[]> = {
    undercut: [
      {
        key: "depth",
        label: "Undercut Depth",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.005,
        metricStep: 0.1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 0.25,
        metricMax: 6.35,
      },
      {
        key: "length",
        label: "Undercut Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
    porosity: [
      {
        key: "diameter",
        label: "Max Pore Diameter",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.01,
        metricStep: 0.25,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 0.5,
        metricMax: 12.7,
      },
      {
        key: "spacing",
        label: "Pore Spacing",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 6,
        metricMax: 152,
      },
      {
        key: "cluster_diameter",
        label: "Cluster Diameter",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 3,
        metricMax: 76,
      },
    ],
    slag_inclusion: [
      {
        key: "length",
        label: "Indication Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
      {
        key: "width",
        label: "Indication Width",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.01,
        metricStep: 0.25,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 1,
        metricMax: 25.4,
      },
    ],
    incomplete_fusion: [
      {
        key: "length",
        label: "Indication Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
    incomplete_penetration: [
      {
        key: "length",
        label: "Indication Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
    crack: [
      {
        key: "length",
        label: "Crack Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
    burn_through: [
      {
        key: "diameter",
        label: "Burn-Through Diameter",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 1,
        metricMax: 25.4,
      },
    ],
    reinforcement: [
      {
        key: "height",
        label: "Reinforcement Height",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.01,
        metricStep: 0.25,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 0.5,
        metricMax: 12.7,
      },
    ],
    overlap: [
      {
        key: "length",
        label: "Overlap Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
    hydrogen_cracking: [
      {
        key: "length",
        label: "Indication Length",
        imperialUnit: "in",
        metricUnit: "mm",
        imperialStep: 0.0625,
        metricStep: 1,
        imperialMin: 0,
        metricMin: 0,
        imperialMax: 12,
        metricMax: 305,
      },
    ],
  };

  return fields[findingType] || [
    {
      key: "length",
      label: "Indication Length",
      imperialUnit: "in",
      metricUnit: "mm",
      imperialStep: 0.0625,
      metricStep: 1,
      imperialMin: 0,
      metricMin: 0,
      imperialMax: 12,
      metricMax: 305,
    },
  ];
}

// Code limits for display (imperial stored, metric computed)
export interface CodeLimit {
  code: string;
  rule: string;
  limitImperial: number;
  unitImperial: string;
  limitMetric: number;
  unitMetric: string;
  condition: string;
}

export function getCodeLimits(findingType: string, measurementKey: string): CodeLimit[] {
  if (findingType === "undercut" && measurementKey === "depth") {
    return [
      {
        code: "AWS D1.1",
        rule: "Static Loading",
        limitImperial: 0.03125,
        unitImperial: "in",
        limitMetric: 0.8,
        unitMetric: "mm",
        condition: "Max depth for statically loaded structures",
      },
      {
        code: "AWS D1.1",
        rule: "Dynamic/Cyclic Loading",
        limitImperial: 0.01,
        unitImperial: "in",
        limitMetric: 0.25,
        unitMetric: "mm",
        condition: "Max depth for cyclically loaded structures",
      },
    ];
  }
  if (findingType === "burn_through" && measurementKey === "diameter") {
    return [
      {
        code: "API 1104",
        rule: "Burn-Through Limit",
        limitImperial: 0.25,
        unitImperial: "in",
        limitMetric: 6.4,
        unitMetric: "mm",
        condition: "Max dimension for pipeline burn-through",
      },
    ];
  }
  if (findingType === "reinforcement" && measurementKey === "height") {
    return [
      {
        code: "AWS D1.1",
        rule: "Reinforcement Limit",
        limitImperial: 0.125,
        unitImperial: "in",
        limitMetric: 3.0,
        unitMetric: "mm",
        condition: "Max reinforcement height for butt joints",
      },
    ];
  }
  return [];
}
