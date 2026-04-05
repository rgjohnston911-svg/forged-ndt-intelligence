// ============================================================================
// SUPABASE REST API UTILITY — NO SDK
// String concatenation only (Git Bash paste corruption rule)
// ============================================================================

var SUPABASE_URL = "https://lrxwirjcuzultolomnos.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHdpcmpjdXp1bHRvbG9tbm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQ1NjcsImV4cCI6MjA5MDY1MDU2N30.oVGJybVpR2ktkHWMXsNeVFkBB7QFzfpp9QyIk00zwUU";

function sbHeaders(): Record<string, string> {
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
}

// INSERT — POST /rest/v1/{table}
export async function sbInsert(table: string, row: Record<string, any>): Promise<any> {
  var url = SUPABASE_URL + "/rest/v1/" + table;
  var res = await fetch(url, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    var errText = await res.text();
    throw new Error("sbInsert " + table + " failed: " + res.status + " " + errText);
  }
  var data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// UPDATE — PATCH /rest/v1/{table}?id=eq.{id}
export async function sbUpdate(table: string, id: string, patch: Record<string, any>): Promise<any> {
  var url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + id;
  var res = await fetch(url, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    var errText = await res.text();
    throw new Error("sbUpdate " + table + " failed: " + res.status + " " + errText);
  }
  var data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// SELECT — GET /rest/v1/{table}?{query}
// query is a PostgREST query string, e.g. "status=eq.active&order=created_at.desc&limit=50"
export async function sbSelect(table: string, query?: string): Promise<any[]> {
  var url = SUPABASE_URL + "/rest/v1/" + table;
  if (query) {
    url = url + "?" + query;
  }
  var res = await fetch(url, {
    method: "GET",
    headers: sbHeaders()
  });
  if (!res.ok) {
    var errText = await res.text();
    throw new Error("sbSelect " + table + " failed: " + res.status + " " + errText);
  }
  return await res.json();
}

// DELETE — DELETE /rest/v1/{table}?id=eq.{id}
export async function sbDelete(table: string, id: string): Promise<void> {
  var url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + id;
  var res = await fetch(url, {
    method: "DELETE",
    headers: sbHeaders()
  });
  if (!res.ok) {
    var errText = await res.text();
    throw new Error("sbDelete " + table + " failed: " + res.status + " " + errText);
  }
}

// CALL DECISION-CORE — POST to same-site Netlify function
export async function callDecisionCore(
  transcript: string,
  assetClass: string,
  events?: string[],
  numericValues?: Record<string, any>,
  confirmedFlags?: string[]
): Promise<any> {
  var url = "/.netlify/functions/decision-core";
  var body: Record<string, any> = {
    transcript: transcript,
    asset: { asset_class: assetClass },
    parsed: {
      events: events || [],
      numeric_values: numericValues || {}
    },
    confirmed_flags: confirmedFlags || []
  };
  var res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    var errText = await res.text();
    throw new Error("decision-core failed: " + res.status + " " + errText);
  }
  return await res.json();
}

// ASSET CLASS MAPPING — display label → engine key
export var ASSET_CLASS_MAP: Record<string, string> = {
  "Pressure Vessel": "pressure_vessel",
  "Piping": "piping",
  "Offshore Structure": "offshore_platform",
  "Saturation Diving System": "pressure_vessel",
  "Tank": "tank",
  "Bridge": "bridge",
  "Heat Exchanger": "pressure_vessel",
  "Boiler": "pressure_vessel",
  "Storage Sphere": "pressure_vessel",
  "Pipeline": "piping"
};

// UUID GENERATOR — simple v4-style
export function generateId(): string {
  var hex = "0123456789abcdef";
  var result = "";
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result = result + "-";
    } else if (i === 14) {
      result = result + "4";
    } else {
      result = result + hex[Math.floor(Math.random() * 16)];
    }
  }
  return result;
}
