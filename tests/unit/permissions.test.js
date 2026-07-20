import { describe, it, expect } from 'vitest';
import { hasPermission, isAdminRole, isSuperAdmin, getPermissions } from '@/lib/permissions';

const superAdminSession = { user: { role: 'superAdmin' } };
const adminSession = { user: { role: 'admin' } };
const editorWithProductsView = {
  user: { role: 'editor', permissions: { products: { view: true, create: false } } },
};
const editorWithNothing = { user: { role: 'editor' } };
const buyerSession = { user: { role: 'localBuyer' } };

describe('hasPermission', () => {
  it('denies access when there is no session', () => {
    expect(hasPermission(null, 'products', 'view')).toBe(false);
    expect(hasPermission(undefined, 'products', 'view')).toBe(false);
  });

  it('always grants superAdmin, regardless of module/action', () => {
    expect(hasPermission(superAdminSession, 'roles', 'delete')).toBe(true);
    expect(hasPermission(superAdminSession, 'anything', 'whatever')).toBe(true);
  });

  it('always grants admin (the full-access manager role)', () => {
    expect(hasPermission(adminSession, 'settings', 'edit')).toBe(true);
  });

  it('grants an editor only the specific module.action they were given', () => {
    expect(hasPermission(editorWithProductsView, 'products', 'view')).toBe(true);
  });

  it('denies an editor an action they were not explicitly granted', () => {
    expect(hasPermission(editorWithProductsView, 'products', 'create')).toBe(false);
    expect(hasPermission(editorWithProductsView, 'orders', 'update')).toBe(false);
  });

  it('denies an editor with no permissions object at all', () => {
    expect(hasPermission(editorWithNothing, 'products', 'view')).toBe(false);
  });

  it('denies non-admin-area roles entirely (e.g. a buyer account)', () => {
    expect(hasPermission(buyerSession, 'products', 'view')).toBe(false);
  });
});

describe('isAdminRole', () => {
  it('is true for superAdmin, admin, and editor', () => {
    expect(isAdminRole(superAdminSession)).toBe(true);
    expect(isAdminRole(adminSession)).toBe(true);
    expect(isAdminRole(editorWithNothing)).toBe(true);
  });

  it('is false for buyer roles or no session', () => {
    expect(isAdminRole(buyerSession)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe('isSuperAdmin', () => {
  it('is true only for the superAdmin role', () => {
    expect(isSuperAdmin(superAdminSession)).toBe(true);
    expect(isSuperAdmin(adminSession)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe('getPermissions', () => {
  it('returns null for superAdmin/admin to signal "all permissions"', () => {
    expect(getPermissions(superAdminSession)).toBeNull();
    expect(getPermissions(adminSession)).toBeNull();
  });

  it("returns the editor's stored permission matrix", () => {
    expect(getPermissions(editorWithProductsView)).toEqual({ products: { view: true, create: false } });
  });

  it('returns an empty object for an editor with no permissions set, or no session', () => {
    expect(getPermissions(editorWithNothing)).toEqual({});
    expect(getPermissions(null)).toEqual({});
  });
});
