// @ts-nocheck
/**
 * DEPLOY234 - rbac.ts
 * netlify/functions/rbac.ts
 *
 * ROLE-BASED ACCESS CONTROL + MULTI-TENANT ISOLATION
 *
 * Manages organizations, roles, permissions, and tenant isolation.
 * Every user belongs to an organization. Every case belongs to an organization.
 * Users have roles that determine what they can see and do.
 *
 * ROLES:
 *   admin       — Full access. Manage org, users, roles. See everything.
 *   manager     — View all org cases, reports, analytics, trends. Assign reviewers.
 *                  Cannot manage org settings or user roles.
 *   reviewer    — Senior inspector. Can review escalations, adjudicate, view analytics.
 *   technician  — Field inspector. Create cases, submit findings, adjudicate own cases.
 *                  Cannot see org-wide analytics or other inspectors' overrides.
 *   viewer      — Read-only access to cases and reports. No create/edit.
 *
 * PERMISSIONS MATRIX:
 *   create_case:      admin, manager, reviewer, technician
 *   view_own_cases:    all roles
 *   view_all_cases:    admin, manager, reviewer
 *   submit_finding:    admin, manager, reviewer, technician
 *   adjudicate:        admin, manager, reviewer, technician
 *   view_adjudications: admin, manager, reviewer
 *   create_escalation: admin, manager, reviewer, technician
 *   resolve_escalation: admin, manager, reviewer
 *   assign_escalation: admin, manager
 *   view_analytics:    admin, manager, reviewer
 *   view_trends:       admin, manager
 *   view_risk_scores:  admin, manager, reviewer
 *   generate_reports:  admin, manager, reviewer
 *   manage_users:      admin
 *   manage_org:        admin
 *   view_audit_trail:  admin, manager
 *   export_data:       admin, manager
 *   manage_notifications: admin
 *
 * POST /api/rbac { action: "check_permission", user_id, permission }
 * POST /api/rbac { action: "get_user_role", user_id }
 * POST /api/rbac { action: "assign_role", user_id, role, assigned_by }
 * POST /api/rbac { action: "remove_role", user_id, removed_by }
 * POST /api/rbac { action: "create_org", org_name, admin_user_id }
 * POST /api/rbac { action: "get_org", org_id }
 * POST /api/rbac { action: "get_org_members", org_id }
 * POST /api/rbac { action: "add_member", org_id, user_id, role, added_by }
 * POST /api/rbac { action: "remove_member", org_id, user_id, removed_by }
 * POST /api/rbac { action: "get_permissions_matrix" }
 * POST /api/rbac { action: "get_user_context", user_id }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "rbac/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// ROLES AND PERMISSIONS
// ================================================================
var VALID_ROLES = ["admin", "manager", "reviewer", "technician", "viewer"];

var ROLE_HIERARCHY = {
  admin: 5,
  manager: 4,
  reviewer: 3,
  technician: 2,
  viewer: 1
};

var PERMISSIONS = {
  create_case:         ["admin", "manager", "reviewer", "technician"],
  view_own_cases:      ["admin", "manager", "reviewer", "technician", "viewer"],
  view_all_cases:      ["admin", "manager", "reviewer"],
  submit_finding:      ["admin", "manager", "reviewer", "technician"],
  adjudicate:          ["admin", "manager", "reviewer", "technician"],
  view_adjudications:  ["admin", "manager", "reviewer"],
  create_escalation:   ["admin", "manager", "reviewer", "technician"],
  resolve_escalation:  ["admin", "manager", "reviewer"],
  assign_escalation:   ["admin", "manager"],
  view_analytics:      ["admin", "manager", "reviewer"],
  view_trends:         ["admin", "manager"],
  view_risk_scores:    ["admin", "manager", "reviewer"],
  generate_reports:    ["admin", "manager", "reviewer"],
  manage_users:        ["admin"],
  manage_org:          ["admin"],
  view_audit_trail:    ["admin", "manager"],
  export_data:         ["admin", "manager"],
  manage_notifications: ["admin"]
};

function hasPermission(role, permission) {
  var allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.indexOf(role) >= 0;
}

function getRolePermissions(role) {
  var perms = [];
  var permKeys = Object.keys(PERMISSIONS);
  for (var i = 0; i < permKeys.length; i++) {
    if (PERMISSIONS[permKeys[i]].indexOf(role) >= 0) {
      perms.push(permKeys[i]);
    }
  }
  return perms;
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: get_permissions_matrix ──
    if (action === "get_permissions_matrix") {
      var matrix = {};
      for (var ri = 0; ri < VALID_ROLES.length; ri++) {
        matrix[VALID_ROLES[ri]] = {
          role: VALID_ROLES[ri],
          hierarchy_level: ROLE_HIERARCHY[VALID_ROLES[ri]],
          permissions: getRolePermissions(VALID_ROLES[ri]),
          permission_count: getRolePermissions(VALID_ROLES[ri]).length
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          roles: VALID_ROLES,
          permissions: Object.keys(PERMISSIONS),
          matrix: matrix,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: check_permission ──
    if (action === "check_permission") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };
      if (!body.permission) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "permission required" }) };

      // Look up user role
      var userRole = await sb.from("user_roles").select("*").eq("user_id", body.user_id).eq("is_active", true).single();
      if (userRole.error || !userRole.data) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            user_id: body.user_id,
            permission: body.permission,
            granted: false,
            reason: "No active role assignment found",
            response_ms: Date.now() - startTime
          }, null, 2)
        };
      }

      var granted = hasPermission(userRole.data.role, body.permission);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: body.user_id,
          permission: body.permission,
          granted: granted,
          role: userRole.data.role,
          org_id: userRole.data.org_id,
          reason: granted ? "Permission granted for role: " + userRole.data.role : "Permission denied for role: " + userRole.data.role,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_user_role ──
    if (action === "get_user_role") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };

      var roleResult = await sb.from("user_roles").select("*").eq("user_id", body.user_id).eq("is_active", true).single();
      if (roleResult.error || !roleResult.data) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            user_id: body.user_id,
            role: null,
            org_id: null,
            message: "No active role assignment",
            response_ms: Date.now() - startTime
          }, null, 2)
        };
      }

      var rd = roleResult.data;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: body.user_id,
          role: rd.role,
          org_id: rd.org_id,
          hierarchy_level: ROLE_HIERARCHY[rd.role] || 0,
          permissions: getRolePermissions(rd.role),
          assigned_at: rd.created_at,
          assigned_by: rd.assigned_by,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_user_context ──
    // Returns everything the frontend needs: role, permissions, org info, org members
    if (action === "get_user_context") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };

      var ctxRole = await sb.from("user_roles").select("*").eq("user_id", body.user_id).eq("is_active", true).single();
      if (ctxRole.error || !ctxRole.data) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            user_id: body.user_id,
            authenticated: true,
            has_role: false,
            message: "No role assigned. Contact your organization admin.",
            response_ms: Date.now() - startTime
          }, null, 2)
        };
      }

      var ctxData = ctxRole.data;
      var orgInfo = null;
      if (ctxData.org_id) {
        var orgResult = await sb.from("organizations").select("*").eq("id", ctxData.org_id).single();
        if (orgResult.data) orgInfo = { id: orgResult.data.id, name: orgResult.data.name, created_at: orgResult.data.created_at };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: body.user_id,
          authenticated: true,
          has_role: true,
          role: ctxData.role,
          org_id: ctxData.org_id,
          organization: orgInfo,
          hierarchy_level: ROLE_HIERARCHY[ctxData.role] || 0,
          permissions: getRolePermissions(ctxData.role),
          ui_config: {
            show_analytics: hasPermission(ctxData.role, "view_analytics"),
            show_trends: hasPermission(ctxData.role, "view_trends"),
            show_risk_scores: hasPermission(ctxData.role, "view_risk_scores"),
            show_all_cases: hasPermission(ctxData.role, "view_all_cases"),
            show_audit_trail: hasPermission(ctxData.role, "view_audit_trail"),
            show_reports: hasPermission(ctxData.role, "generate_reports"),
            show_user_management: hasPermission(ctxData.role, "manage_users"),
            show_org_settings: hasPermission(ctxData.role, "manage_org"),
            show_export: hasPermission(ctxData.role, "export_data"),
            can_create_case: hasPermission(ctxData.role, "create_case"),
            can_adjudicate: hasPermission(ctxData.role, "adjudicate"),
            can_escalate: hasPermission(ctxData.role, "create_escalation"),
            can_resolve_escalation: hasPermission(ctxData.role, "resolve_escalation"),
            can_assign_escalation: hasPermission(ctxData.role, "assign_escalation")
          },
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: create_org ──
    if (action === "create_org") {
      if (!body.org_name) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_name required" }) };
      if (!body.admin_user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "admin_user_id required" }) };

      // Create organization
      var orgInsert = await sb.from("organizations").insert({
        name: body.org_name,
        created_by: body.admin_user_id,
        settings: body.settings || {}
      }).select().single();

      if (orgInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to create org: " + orgInsert.error.message }) };
      }

      // Assign creator as admin
      var adminInsert = await sb.from("user_roles").insert({
        user_id: body.admin_user_id,
        org_id: orgInsert.data.id,
        role: "admin",
        assigned_by: body.admin_user_id,
        is_active: true
      }).select().single();

      if (adminInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Org created but failed to assign admin role: " + adminInsert.error.message }) };
      }

      // Log audit event
      await sb.from("audit_events").insert({
        event_type: "org_created",
        user_id: body.admin_user_id,
        detail: "Organization created: " + body.org_name,
        metadata: { org_id: orgInsert.data.id, org_name: body.org_name }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          org: orgInsert.data,
          admin_role: adminInsert.data,
          message: "Organization created. " + body.admin_user_id + " assigned as admin.",
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_org ──
    if (action === "get_org") {
      if (!body.org_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_id required" }) };

      var orgGet = await sb.from("organizations").select("*").eq("id", body.org_id).single();
      if (orgGet.error || !orgGet.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Organization not found" }) };

      var memberCount = await sb.from("user_roles").select("id", { count: "exact", head: true }).eq("org_id", body.org_id).eq("is_active", true);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          org: orgGet.data,
          member_count: memberCount.count || 0,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_org_members ──
    if (action === "get_org_members") {
      if (!body.org_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_id required" }) };

      var members = await sb.from("user_roles").select("*").eq("org_id", body.org_id).eq("is_active", true).order("role", { ascending: true });

      var memberList = [];
      if (members.data) {
        for (var mi = 0; mi < members.data.length; mi++) {
          var m = members.data[mi];
          memberList.push({
            user_id: m.user_id,
            role: m.role,
            hierarchy_level: ROLE_HIERARCHY[m.role] || 0,
            permissions: getRolePermissions(m.role),
            assigned_at: m.created_at,
            assigned_by: m.assigned_by
          });
        }
      }

      // Summary by role
      var roleSummary = {};
      for (var rs2 = 0; rs2 < VALID_ROLES.length; rs2++) {
        roleSummary[VALID_ROLES[rs2]] = memberList.filter(function(x) { return x.role === VALID_ROLES[rs2]; }).length;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          org_id: body.org_id,
          total_members: memberList.length,
          by_role: roleSummary,
          members: memberList,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: add_member ──
    if (action === "add_member") {
      if (!body.org_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_id required" }) };
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };
      if (!body.role || VALID_ROLES.indexOf(body.role) < 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "role must be one of: " + VALID_ROLES.join(", ") }) };
      }
      if (!body.added_by) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "added_by required" }) };

      // Check if user already has active role in this org
      var existingRole = await sb.from("user_roles").select("id, role").eq("user_id", body.user_id).eq("org_id", body.org_id).eq("is_active", true).single();
      if (existingRole.data) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "User already has active role in this org: " + existingRole.data.role + ". Remove existing role first." }) };
      }

      // Check if user has role in another org (one org at a time)
      var otherOrg = await sb.from("user_roles").select("id, org_id").eq("user_id", body.user_id).eq("is_active", true).single();
      if (otherOrg.data) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "User already belongs to another organization. Remove from current org first." }) };
      }

      var addInsert = await sb.from("user_roles").insert({
        user_id: body.user_id,
        org_id: body.org_id,
        role: body.role,
        assigned_by: body.added_by,
        is_active: true
      }).select().single();

      if (addInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to add member: " + addInsert.error.message }) };
      }

      // Log audit event
      await sb.from("audit_events").insert({
        event_type: "member_added",
        user_id: body.added_by,
        detail: "Added " + body.user_id + " as " + body.role + " to org " + body.org_id,
        metadata: { target_user: body.user_id, role: body.role, org_id: body.org_id }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          member: addInsert.data,
          permissions: getRolePermissions(body.role),
          message: "User added as " + body.role,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: remove_member ──
    if (action === "remove_member") {
      if (!body.org_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_id required" }) };
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };
      if (!body.removed_by) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "removed_by required" }) };

      // Prevent removing last admin
      var adminCheck = await sb.from("user_roles").select("id").eq("org_id", body.org_id).eq("role", "admin").eq("is_active", true);
      var targetRole = await sb.from("user_roles").select("role").eq("user_id", body.user_id).eq("org_id", body.org_id).eq("is_active", true).single();

      if (targetRole.data && targetRole.data.role === "admin" && adminCheck.data && adminCheck.data.length <= 1) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Cannot remove the last admin from an organization" }) };
      }

      var deactivate = await sb.from("user_roles").update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: body.removed_by }).eq("user_id", body.user_id).eq("org_id", body.org_id).eq("is_active", true);

      if (deactivate.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to remove member: " + deactivate.error.message }) };
      }

      // Log audit event
      await sb.from("audit_events").insert({
        event_type: "member_removed",
        user_id: body.removed_by,
        detail: "Removed " + body.user_id + " from org " + body.org_id,
        metadata: { target_user: body.user_id, org_id: body.org_id }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: body.user_id,
          org_id: body.org_id,
          removed: true,
          message: "Member removed from organization",
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: assign_role ──
    if (action === "assign_role") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };
      if (!body.role || VALID_ROLES.indexOf(body.role) < 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "role must be one of: " + VALID_ROLES.join(", ") }) };
      }
      if (!body.assigned_by) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "assigned_by required" }) };

      // Deactivate current role
      await sb.from("user_roles").update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: body.assigned_by }).eq("user_id", body.user_id).eq("is_active", true);

      // Get the org from the old role, or use provided org_id
      var prevRole = await sb.from("user_roles").select("org_id").eq("user_id", body.user_id).order("created_at", { ascending: false }).limit(1).single();
      var orgId = body.org_id || (prevRole.data ? prevRole.data.org_id : null);

      if (!orgId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "org_id required (user has no previous org)" }) };

      var roleInsert = await sb.from("user_roles").insert({
        user_id: body.user_id,
        org_id: orgId,
        role: body.role,
        assigned_by: body.assigned_by,
        is_active: true
      }).select().single();

      if (roleInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to assign role: " + roleInsert.error.message }) };
      }

      // Log audit event
      await sb.from("audit_events").insert({
        event_type: "role_changed",
        user_id: body.assigned_by,
        detail: "Changed " + body.user_id + " role to " + body.role,
        metadata: { target_user: body.user_id, new_role: body.role, org_id: orgId }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: body.user_id,
          role: body.role,
          org_id: orgId,
          permissions: getRolePermissions(body.role),
          message: "Role updated to " + body.role,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: check_permission, get_user_role, get_user_context, assign_role, create_org, get_org, get_org_members, add_member, remove_member, get_permissions_matrix" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
