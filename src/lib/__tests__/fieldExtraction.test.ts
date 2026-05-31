import { test } from "node:test";
import assert from "node:assert";
import { extractFields, verifyVerbatim } from "../fieldExtraction";

// ---- The bug class this module exists to close --------------------------

test("comma-thousands: '2,850 psi' extracts 2850 not 850 (the TEST 10 bug)", () => {
  var r = extractFields("Design pressure 2,850 psi. Operating pressure 2,300 psi.");
  assert.equal(r.fields.operating_pressure.value, 2300);
  assert.equal(r.fields.design_pressure.value, 2850);
});

test("operating pressure is preferred over a bare/design psi appearing first", () => {
  // design line comes first in the text; labeled operating must still win.
  var r = extractFields("Rated to 2,850 psi design. Currently the operating pressure is 2,300 psi.");
  assert.equal(r.fields.operating_pressure.value, 2300);
  assert.equal(r.fields.operating_pressure.rule, "operating_pressure_labeled");
});

test("bare psi still extracted (comma-safe) when no label present", () => {
  var r = extractFields("Line holds 1,440 psi.");
  assert.equal(r.fields.operating_pressure.value, 1440);
  assert.equal(r.fields.operating_pressure.rule, "bare_psi");
});

test("bar and MPa convert to psi", () => {
  var bar = extractFields("operating pressure 100 barg");
  assert.ok(Math.abs(bar.fields.operating_pressure.value - 1450.38) < 0.5);
  var mpa = extractFields("operating pressure 10 MPa");
  assert.ok(Math.abs(mpa.fields.operating_pressure.value - 1450.38) < 0.5);
});

test("paragraph nominal wall: 'nominal wall: 0.500 in' -> 0.5", () => {
  var r = extractFields("Pipe spec — nominal wall: 0.500 in, schedule 80.");
  assert.equal(r.fields.nominal_wall.value, 0.5);
});

test("original / as-built / design thickness maps to nominal wall", () => {
  assert.equal(extractFields("Original thickness 0.500 in").fields.nominal_wall.value, 0.5);
  assert.equal(extractFields("As-built wall 0.375 inch").fields.nominal_wall.value, 0.375);
  assert.equal(extractFields("design wall thickness 0.625\"").fields.nominal_wall.value, 0.625);
});

test("measured / minimum wall forms", () => {
  assert.equal(extractFields("minimum wall: 0.262 in").fields.measured_min_wall.value, 0.262);
  assert.equal(extractFields("0.262 in minimum").fields.measured_min_wall.value, 0.262);
  assert.equal(extractFields("measured thickness 0.300 inch").fields.measured_min_wall.value, 0.3);
});

test("wall loss percent", () => {
  assert.equal(extractFields("42% wall loss observed").fields.wall_loss_percent.value, 42);
  assert.equal(extractFields("wall loss of 37 percent").fields.wall_loss_percent.value, 37);
});

test("out-of-bounds values are rejected (no nonsense readings)", () => {
  // 99999 psi exceeds the 20000 bound -> not accepted
  assert.equal(extractFields("operating pressure 99999 psi").fields.operating_pressure, undefined);
  // 50 in 'wall' exceeds the 5 in bound -> not accepted as nominal
  assert.equal(extractFields("nominal wall 50 in").fields.nominal_wall, undefined);
  // 250% wall loss is impossible -> rejected
  assert.equal(extractFields("250% wall loss").fields.wall_loss_percent, undefined);
});

test("run-on / packed input still parses the operating pressure", () => {
  var r = extractFields("8in line carbon steel a106 grade b 0.500in nominal wall 0.262 in minimum operating pressure 1,440 psi 30% wall loss");
  assert.equal(r.fields.operating_pressure.value, 1440);
  assert.equal(r.fields.nominal_wall.value, 0.5);
  assert.equal(r.fields.measured_min_wall.value, 0.262);
  assert.equal(r.fields.wall_loss_percent.value, 30);
});

test("every extracted field carries verbatim provenance", () => {
  var r = extractFields("operating pressure 2,300 psi");
  var f = r.fields.operating_pressure;
  assert.ok(f.source && f.source.length > 0);
  assert.ok(f.rule && f.rule.length > 0);
  // the source span is a real substring of the input (case-insensitive)
  assert.ok("operating pressure 2,300 psi".toLowerCase().indexOf(f.source.toLowerCase()) >= 0);
});

test("empty / junk input returns no fields, no throw", () => {
  assert.deepEqual(extractFields("").fields, {});
  assert.deepEqual(extractFields("the quick brown fox").fields, {});
});

// ---- verifyVerbatim: the hallucination guard for the future GPT pass ----

test("verifyVerbatim accepts a real value/span and rejects a fabricated one", () => {
  var text = "operating pressure 2,300 psi";
  assert.equal(verifyVerbatim(text, 2300, "operating pressure 2,300 psi"), true);
  // comma-insensitive
  assert.equal(verifyVerbatim(text, 2300, "2300 psi"), true);
  // fabricated value not in source -> rejected
  assert.equal(verifyVerbatim(text, 9999, "operating pressure 9999 psi"), false);
  // span not actually in the source -> rejected
  assert.equal(verifyVerbatim(text, 2300, "design pressure 2300 psi"), false);
});
