'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const MODULES = ['products','categories','orders','customers','analytics','banners','flashSales','coupons','settings','inventory','sections','pages','marketing','reviews'];
const MODULE_ACTIONS = { products: ['view','create','edit','delete'], categories: ['view','create','edit','delete'], orders: ['view','update','cancel'], customers: ['view','export'], analytics: ['view'], banners: ['view','create','edit','delete'], flashSales: ['view','create','edit','delete'], coupons: ['view','create','edit','delete'], settings: ['view','edit'], inventory: ['view','edit'], sections: ['view','create','edit','delete'], pages: ['view','create','edit','delete'], marketing: ['view','send'], reviews: ['view','moderate'] };
const EMPTY_PERMS = Object.fromEntries(MODULES.map(m => [m, Object.fromEntries(MODULE_ACTIONS[m].map(a => [a, false]))]));

export default function AdminRolesPage() {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: EMPTY_PERMS });
  const [assignModal, setAssignModal] = useState(false);
  const [assignUser, setAssignUser] = useState('');
  const [assignRole, setAssignRole] = useState('');

  const fetch_ = async () => {
    setLoading(true);
    const [rr, ur] = await Promise.all([fetch('/api/roles'), fetch('/api/users?limit=100')]);
    const [rd, ud] = await Promise.all([rr.json(), ur.json()]);
    setRoles(rd.roles || []); setUsers(ud.users?.filter(u => u.role !== 'localBuyer' && u.role !== 'internationalBuyer') || []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: '', description: '', permissions: JSON.parse(JSON.stringify(EMPTY_PERMS)) }); setModal(true); };
  const openEdit = (r) => { setEdit(r); setForm({ name: r.name, description: r.description || '', permissions: { ...JSON.parse(JSON.stringify(EMPTY_PERMS)), ...r.permissions } }); setModal(true); };
  const togglePerm = (module, action) => setForm(p => ({ ...p, permissions: { ...p.permissions, [module]: { ...p.permissions[module], [action]: !p.permissions[module]?.[action] } } }));
  const toggleAll = (module) => { const allOn = MODULE_ACTIONS[module].every(a => form.permissions[module]?.[a]); setForm(p => ({ ...p, permissions: { ...p.permissions, [module]: Object.fromEntries(MODULE_ACTIONS[module].map(a => [a, !allOn])) } })); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Role name required'); return; }
    setSaving(true);
    const url = edit ? `/api/roles/${edit._id}` : '/api/roles';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Role saved!'); setModal(false); fetch_(); } else toast.error(d.message);
  };

  const handleAssign = async () => {
    if (!assignUser || !assignRole) { toast.error('Select user and role'); return; }
    const r = await fetch(`/api/users/${assignUser}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'editor', adminRoleId: assignRole }) });
    const d = await r.json();
    if (d.success) { toast.success('Role assigned!'); setAssignModal(false); fetch_(); } else toast.error(d.message);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1><p className="text-sm text-gray-500">Super Admin only</p></div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setAssignModal(true)}>Assign Role to User</Button>
          <Button variant="primary" icon={Plus} onClick={openNew}>New Role</Button>
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {roles.map(r => (
            <div key={r._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Shield className="w-5 h-5 text-purple-600" /></div>
                  <div><p className="font-bold text-gray-900 dark:text-white">{r.name}</p>{r.description && <p className="text-xs text-gray-400">{r.description}</p>}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { if (!confirm('Delete this role?')) return; await fetch(`/api/roles/${r._id}`, { method: 'DELETE' }); fetch_(); toast.success('Deleted'); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(r.permissions || {}).map(([mod, actions]) =>
                  Object.entries(actions || {}).filter(([, v]) => v).map(([act]) => (
                    <span key={`${mod}.${act}`} className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">{mod}.{act}</span>
                  ))
                )}
              </div>
            </div>
          ))}
          {roles.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">No custom roles yet</div>}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Role' : 'New Role'} size="xl"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Role</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Role Name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Content Editor" />
            <Input label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What this role can do" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Permissions</p>
            <div className="space-y-3">
              {MODULES.map(module => (
                <div key={module} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => toggleAll(module)} className="w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center transition-all" style={MODULE_ACTIONS[module].every(a => form.permissions[module]?.[a]) ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}>
                      {MODULE_ACTIONS[module].every(a => form.permissions[module]?.[a]) && <span className="text-white text-xs">✓</span>}
                    </button>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">{module}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-7">
                    {MODULE_ACTIONS[module].map(action => (
                      <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!form.permissions[module]?.[action]} onChange={() => togglePerm(module, action)} className="w-3.5 h-3.5 accent-green-600" />
                        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{action}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title="Assign Role to User" size="sm"
        footer={<div className="flex gap-3"><Button onClick={handleAssign} variant="primary">Assign</Button><Button onClick={() => setAssignModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select User</label>
            <select value={assignUser} onChange={e => setAssignUser(e.target.value)} className="input-field"><option value="">Choose user...</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Role</label>
            <select value={assignRole} onChange={e => setAssignRole(e.target.value)} className="input-field"><option value="">Choose role...</option>
              {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}</select></div>
        </div>
      </Modal>
    </div>
  );
}
