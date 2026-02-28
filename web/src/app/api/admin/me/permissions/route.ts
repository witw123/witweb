import { getAuthIdentity } from "@/lib/http";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import {
  getPermissionLabel,
  getRoleLabel,
  hasAdminAccess,
  listRolePermissions,
  ROLE_DESCRIPTIONS,
} from "@/lib/rbac";

export const GET = withErrorHandler(async () => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminAccess(auth.role), "Admin access required");

  const permissions = listRolePermissions(auth.role);
  return successResponse({
    username: auth.username,
    role: auth.role,
    role_label: getRoleLabel(auth.role),
    role_description: ROLE_DESCRIPTIONS[auth.role],
    can_access_admin: hasAdminAccess(auth.role),
    permissions,
    permission_details: permissions.map((permission) => ({
      code: permission,
      label: getPermissionLabel(permission),
    })),
  });
});
