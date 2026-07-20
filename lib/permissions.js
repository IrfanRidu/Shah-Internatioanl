/**
 * Granular permission helper.
 *
 * - superAdmin & admin (legacy "Manager" role) always have full access.
 * - editor / custom-role staff only get the specific module.action permissions
 *   granted to them via a Role document (session.user.permissions, embedded
 *   into the JWT at sign-in — see lib/auth.js).
 *
 * Usage (server, inside an API route):
 *   const session = await getServerSession(authOptions);
 *   if (!hasPermission(session, 'products', 'create')) {
 *     return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
 *   }
 *
 * Usage (client, e.g. to hide a nav link or button):
 *   const { data: session } = useSession();
 *   if (!hasPermission(session, 'coupons', 'create')) return null;
 */
export function hasPermission(session, module, action) {
  if (!session?.user) return false;
  const role = session.user.role;

  // Super Admin and Admin (full-access manager role) bypass granular checks.
  if (role === 'superAdmin' || role === 'admin') return true;

  // Editors / custom-role staff are gated by their assigned Role's permission matrix.
  if (role === 'editor') {
    return !!session.user.permissions?.[module]?.[action];
  }

  return false;
}

/** True if the session belongs to any admin-area role (superAdmin/admin/editor). */
export function isAdminRole(session) {
  return ['superAdmin', 'admin', 'editor'].includes(session?.user?.role);
}

/** True only for the Super Admin (used for Roles management, full customer export, etc). */
export function isSuperAdmin(session) {
  return session?.user?.role === 'superAdmin';
}

/**
 * Returns the full permission matrix for the UI to filter nav items / buttons.
 * superAdmin/admin get `null` which callers should treat as "all true".
 */
export function getPermissions(session) {
  if (!session?.user) return {};
  if (['superAdmin', 'admin'].includes(session.user.role)) return null;
  return session.user.permissions || {};
}
