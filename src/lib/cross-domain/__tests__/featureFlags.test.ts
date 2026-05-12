import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCrossDomainEnabled } from "../featureFlags";
import { makeMockSupabase } from "./fixtures";

const ORG_ON = "00000000-0000-0000-0000-000000000001";
const ORG_OFF = "00000000-0000-0000-0000-000000000002";
const ORG_MISSING = "00000000-0000-0000-0000-000000000003";

describe("isCrossDomainEnabled", () => {
  it("returns true when flag is set to true", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        { org_id: ORG_ON, feature_flags: { cross_domain_intelligence: true } },
      ],
    });
    const result = await isCrossDomainEnabled(ORG_ON, supabase as never);
    assert.equal(result, true);
  });

  it("returns false when flag is absent/false", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        { org_id: ORG_OFF, feature_flags: { cross_domain_intelligence: false } },
      ],
    });
    const result = await isCrossDomainEnabled(ORG_OFF, supabase as never);
    assert.equal(result, false);
  });

  it("returns false when the row does not exist", async () => {
    const supabase = makeMockSupabase({ org_feature_flags: [] });
    const result = await isCrossDomainEnabled(ORG_MISSING, supabase as never);
    assert.equal(result, false);
  });

  it("returns false for blank orgId", async () => {
    const supabase = makeMockSupabase({ org_feature_flags: [] });
    const result = await isCrossDomainEnabled("", supabase as never);
    assert.equal(result, false);
  });

  it("accepts string 'true' as enabled", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        { org_id: ORG_ON, feature_flags: { cross_domain_intelligence: "true" } },
      ],
    });
    const result = await isCrossDomainEnabled(ORG_ON, supabase as never);
    assert.equal(result, true);
  });
});
