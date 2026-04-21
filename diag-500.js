// DIAGNOSTIC: Get the actual error message from the decision-core 500 response
fetch("https://4dndt.netlify.app/.netlify/functions/decision-core", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transcript: "8 inch carbon steel pipe with wall loss",
    parsed: { raw_text: "8 inch carbon steel pipe with wall loss", events: [{ type: "wall_loss" }], numeric_values: { wall_thickness_mm: 6.0 } },
    asset: { asset_class: "piping" }
  })
}).then(function(r) {
  console.log("STATUS: " + r.status);
  return r.text();
}).then(function(t) {
  console.log("BODY: " + t);
}).catch(function(e) {
  console.log("FETCH ERROR: " + e.message);
});
