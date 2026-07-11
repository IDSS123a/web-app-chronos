/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Super Admin panel (Sprint 10) — upravljanje korisnicima, sistemske
 * statistike, bulk uvoz kalendara. SUPER_ADMIN-only (CONSTITUTION.md §5.9).
 */

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import {
  ShieldCheck, Users, BarChart3, UploadCloud, Plus, Trash2, Edit, X,
  RefreshCw, AlertTriangle, CheckCircle, Ban, Lock, Unlock, ChevronDown, ChevronUp, Copy,
} from 'lucide-react';
import type { AdminUserSummary, AdminUserActivity, AdminSystemStats, CalendarImportResult } from '../types';
import {
  fetchAdminUsers, createAdminUser, updateAdminUser, banAdminUser, unbanAdminUser, deleteAdminUser,
  fetchAdminUserActivity, fetchAdminStats, importCalendar, type CalendarImportPayload,
} from '../lib/api-client';

type Tab = 'KORISNICI' | 'STATISTIKE' | 'UVOZ';

export default function AdminPanelView({ currentUserId }: { currentUserId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('KORISNICI');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminSystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const loadAll = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [u, s] = await Promise.all([fetchAdminUsers(), fetchAdminStats()]);
      setUsers(u);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri učitavanju podataka.');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'KORISNICI', label: 'Korisnici', icon: Users },
    { id: 'STATISTIKE', label: 'Statistike', icon: BarChart3 },
    { id: 'UVOZ', label: 'Uvoz kalendara', icon: UploadCloud },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5.5 h-5.5 text-amber-500" />
              Super Admin panel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upravljanje korisnicima, sistemske statistike, bulk uvoz kalendara.
            </p>
          </div>
          <button onClick={loadAll} disabled={loading} className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50" title="Osvježi">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                activeTab === t.id ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Učitavanje...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-[#E30613] p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && activeTab === 'KORISNICI' && (
          <UsersTab users={users} currentUserId={currentUserId} onChanged={loadAll} />
        )}
        {!loading && !error && activeTab === 'STATISTIKE' && stats && (
          <StatsTab stats={stats} />
        )}
        {!loading && !error && activeTab === 'UVOZ' && (
          <CalendarImportTab onImported={loadAll} />
        )}
      </div>
    </div>
  );
}

// ============ Korisnici ============

function UsersTab({ users, currentUserId, onChanged }: { users: AdminUserSummary[]; currentUserId: string; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ user: AdminUserSummary; blockers: Record<string, number> } | null>(null);

  const roleBadge = (role: string) => (
    <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider border ${
      role === 'SUPER_ADMIN' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
    }`}>
      {role === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
    </span>
  );

  const handleBanToggle = async (u: AdminUserSummary) => {
    setBusyId(u.id);
    try {
      if (u.is_banned) await unbanAdminUser(u.id); else await banAdminUser(u.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Greška.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (u: AdminUserSummary) => {
    if (!confirm(`Trajno obrisati nalog "${u.full_name}" (${u.email})? Ova radnja se ne može opozvati.`)) return;
    setBusyId(u.id);
    try {
      const result = await deleteAdminUser(u.id);
      if (result.deleted === false) {
        setBlockedInfo({ user: u, blockers: result.blockers as unknown as Record<string, number> });
      } else {
        onChanged();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Greška.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-full transition-all shadow-sm cursor-pointer">
          <Plus className="w-4 h-4 text-amber-500" />
          Novi korisnik
        </button>
      </div>

      <div className="space-y-2.5">
        {users.map((u) => (
          <div key={u.id} className={`bg-slate-50 border rounded-2xl overflow-hidden ${u.is_banned ? 'border-red-200' : 'border-slate-200'}`}>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-800">{u.full_name}</h4>
                  {roleBadge(u.role)}
                  {u.is_banned && <span className="text-[9px] px-2 py-0.5 rounded font-extrabold uppercase bg-red-100 text-[#E30613] border border-red-200">Blokiran</span>}
                  {u.id === currentUserId && <span className="text-[9px] px-2 py-0.5 rounded font-extrabold uppercase bg-blue-50 text-[#035EA1] border border-blue-100">Vi</span>}
                </div>
                <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                <p className="text-[10px] text-slate-400">
                  {u.institution ?? '—'} · Zadnja prijava: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('bs-BA') : 'nikad'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setExpandedId(expandedId === u.id ? null : u.id)} className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer" title="Aktivnost">
                  {expandedId === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditingUser(u)} className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer" title="Uredi">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleBanToggle(u)}
                  disabled={busyId === u.id || u.id === currentUserId}
                  className="p-1.5 hover:bg-amber-100 text-amber-700 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title={u.is_banned ? 'Deblokiraj' : 'Blokiraj'}
                >
                  {busyId === u.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : u.is_banned ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={busyId === u.id || u.id === currentUserId}
                  className="p-1.5 hover:bg-red-100 text-[#E30613] rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Obriši"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {expandedId === u.id && <UserActivityPanel userId={u.id} />}
          </div>
        ))}
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); onChanged(); }} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={() => { setEditingUser(null); onChanged(); }} />}
      {blockedInfo && <DeletionBlockedModal info={blockedInfo} onClose={() => setBlockedInfo(null)} />}
    </div>
  );
}

function UserActivityPanel({ userId }: { userId: string }) {
  const [activity, setActivity] = useState<AdminUserActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminUserActivity(userId).then(setActivity).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="px-4 pb-4 text-[11px] text-slate-400">Učitavanje aktivnosti...</div>;
  if (!activity) return null;

  return (
    <div className="px-4 pb-4 border-t border-slate-200 pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <span className="block text-lg font-mono font-bold text-slate-900">{activity.obligationsCreated}</span>
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Kreirano obaveza</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <span className="block text-lg font-mono font-bold text-emerald-600">{activity.obligationsCompleted}</span>
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Završeno</span>
        </div>
      </div>
      {activity.recentActivity.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {activity.recentActivity.map((a, i) => (
            <div key={i} className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
              <span className="font-mono text-slate-400">{new Date(a.timestamp).toLocaleString('bs-BA')}</span> — {a.changes}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'STANDARD_USER'>('STANDARD_USER');
  const [institution, setInstitution] = useState<'IDSS' | 'MONTESSORI' | 'BOTH'>('IDSS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) { setError('Ime mora imati najmanje 2 karaktera.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await createAdminUser({ full_name: fullName.trim(), email: email.trim(), role, institution });
      setResult({ email: email.trim(), password: res.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri kreiranju korisnika.');
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wider">Nalog kreiran</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
              <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest">Lozinka se prikazuje samo jednom — sačuvajte je odmah</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 bg-white px-3 py-2 rounded-xl border border-amber-200 text-sm font-mono">{result.password}</code>
                <button onClick={() => navigator.clipboard.writeText(result.password)} className="p-2 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100" title="Kopiraj">
                  <Copy className="w-4 h-4 text-amber-700" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Proslijedite ove podatke korisniku <strong>{result.email}</strong> sigurnim putem (lično, telefonom) — ne ostaje sačuvano nigdje u sistemu.
            </p>
            <button onClick={onCreated} className="w-full py-3 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer">
              Gotovo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Novi korisnik</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ime i prezime</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="npr. Jasmina Hodžić (Pedagog IDSS)" className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime.prezime@idss.ba" className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Uloga</label>
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option value="STANDARD_USER">User</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ustanova</label>
              <select value={institution} onChange={(e) => setInstitution(e.target.value as typeof institution)} className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option value="IDSS">IDSS</option>
                <option value="MONTESSORI">IMH</option>
                <option value="BOTH">Oboje</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">Odustani</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer disabled:opacity-60 flex items-center gap-2">
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? 'Kreiranje...' : 'Kreiraj nalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: AdminUserSummary; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [institution, setInstitution] = useState(user.institution ?? 'IDSS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await updateAdminUser(user.id, { full_name: fullName.trim(), role, institution });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri izmjeni.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Izmjena korisnika</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ime i prezime</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">{user.email} (email se ne može mijenjati ovdje)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Uloga</label>
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option value="STANDARD_USER">User</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ustanova</label>
              <select value={institution ?? 'IDSS'} onChange={(e) => setInstitution(e.target.value as typeof institution)} className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option value="IDSS">IDSS</option>
                <option value="MONTESSORI">IMH</option>
                <option value="BOTH">Oboje</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">Odustani</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer disabled:opacity-60 flex items-center gap-2">
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeletionBlockedModal({ info, onClose }: { info: { user: AdminUserSummary; blockers: Record<string, number> }; onClose: () => void }) {
  const labels: Record<string, string> = {
    obligations: 'kreiranih obaveza',
    auditLogs: 'zapisa u dnevniku aktivnosti',
    notificationGroups: 'kreiranih grupa primalaca',
    notificationSchedules: 'kreiranih rasporeda',
    notificationSends: 'poslanih obavijesti',
  };
  const nonZero = Object.entries(info.blockers).filter(([, v]) => v > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-700" />
          <h3 className="text-sm font-extrabold text-amber-800 uppercase tracking-wider">Brisanje nije moguće</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Nalog <strong>{info.user.full_name}</strong> ima institucionalni trag koji se ne smije izgubiti:
          </p>
          <ul className="text-xs text-slate-700 space-y-1 bg-slate-50 rounded-2xl p-4 border border-slate-200">
            {nonZero.map(([key, count]) => (
              <li key={key}>• <strong>{count}</strong> {labels[key] ?? key}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-600">
            Preporuka: <strong>blokirajte</strong> nalog umjesto brisanja — spriječava prijavu, a čuva sve podatke i dnevnik aktivnosti.
          </p>
          <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer">Razumijem</button>
        </div>
      </div>
    </div>
  );
}

// ============ Statistike ============

function StatsTab({ stats }: { stats: AdminSystemStats }) {
  const Card = ({ label, value, accent }: { label: string; value: number | string; accent?: string }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
      <span className={`block text-2xl font-mono font-bold ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );

  const Breakdown = ({ title, data }: { title: string; data: Record<string, number> }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">{title}</h4>
      <div className="space-y-1.5">
        {Object.entries(data).length === 0 && <p className="text-[11px] text-slate-400 italic">Nema podataka.</p>}
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{key}</span>
            <span className="font-mono font-bold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="Ukupno korisnika" value={stats.totalUsers} />
        <Card label="Ukupno obaveza" value={stats.totalObligations} accent="text-amber-600" />
        <Card label="Super Admin" value={stats.usersByRole.SUPER_ADMIN ?? 0} accent="text-[#035EA1]" />
        <Card label="User" value={stats.usersByRole.STANDARD_USER ?? 0} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Breakdown title="Obaveze po statusu" data={stats.obligationsByStatus} />
        <Breakdown title="Obaveze po ustanovi" data={stats.obligationsByInstitution} />
        <Breakdown title="Obaveze po kategoriji" data={stats.obligationsByCategory} />
        <Breakdown title="Notifikacije po statusu" data={stats.notificationSendsByStatus} />
      </div>
    </div>
  );
}

// ============ Uvoz kalendara ============

interface ParsedEntry {
  title: string;
  category: string;
  due_date: string;
  responsible_person?: string;
  priority?: 'NIZAK' | 'SREDNJI' | 'VISOK';
}

const VALID_CATEGORIES = ['NERADNI_DAN', 'DOGAĐAJ', 'RASPUST', 'NENASTAVNI_DAN', 'PROJEKT', 'ADMINISTRACIJA'];

function CalendarImportTab({ onImported }: { onImported: () => void }) {
  const [institution, setInstitution] = useState<'IDSS' | 'MONTESSORI'>('IDSS');
  const [entries, setEntries] = useState<ParsedEntry[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CalendarImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParseError('');
    setEntries(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!Array.isArray(json.entries)) throw new Error('Fajl mora imati polje "entries" (niz).');
        const parsed: ParsedEntry[] = json.entries.map((e: Record<string, unknown>, idx: number) => {
          if (typeof e.title !== 'string' || e.title.trim().length < 3) throw new Error(`Unos #${idx + 1}: "title" nedostaje ili je prekratak.`);
          if (typeof e.category !== 'string' || !VALID_CATEGORIES.includes(e.category)) throw new Error(`Unos #${idx + 1}: "category" mora biti jedna od: ${VALID_CATEGORIES.join(', ')}.`);
          if (typeof e.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.due_date)) throw new Error(`Unos #${idx + 1}: "due_date" mora biti u formatu YYYY-MM-DD.`);
          return {
            title: e.title, category: e.category, due_date: e.due_date,
            responsible_person: typeof e.responsible_person === 'string' ? e.responsible_person : undefined,
            priority: typeof e.priority === 'string' ? (e.priority as ParsedEntry['priority']) : undefined,
          };
        });
        if (typeof json.institution === 'string' && (json.institution === 'IDSS' || json.institution === 'MONTESSORI')) {
          setInstitution(json.institution);
        }
        setEntries(parsed);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Fajl nije ispravan JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    if (!entries) return;
    setIsSubmitting(true);
    try {
      const payload: CalendarImportPayload = { institution, entries };
      const res = await importCalendar(payload);
      setResult(res);
      setEntries(null);
      onImported();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Greška pri uvozu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
        <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
        <p className="text-sm font-bold text-emerald-800">Uvezeno {result.created} obaveza.</p>
        {result.errors.length > 0 && (
          <div className="text-left bg-white rounded-xl p-3 mt-2 text-xs text-[#E30613]">
            {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
          </div>
        )}
        <button onClick={() => setResult(null)} className="text-xs font-bold text-emerald-700 underline cursor-pointer">Uvezi novi fajl</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2">
        <p className="font-bold text-[#035EA1] uppercase tracking-wide text-[10px]">Očekivani format fajla</p>
        <pre className="bg-white rounded-xl p-3 overflow-x-auto text-[10px] font-mono border border-blue-100">{`{
  "institution": "IDSS",
  "entries": [
    { "title": "...", "category": "RASPUST", "due_date": "2026-10-19" }
  ]
}`}</pre>
        <p>Dozvoljene kategorije: {VALID_CATEGORIES.join(', ')}. <code>responsible_person</code> i <code>priority</code> su opcioni (podrazumijevano "Uprava [ustanova]" / SREDNJI).</p>
      </div>

      {!entries && (
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ustanova (ako fajl ne navodi)</label>
          <select value={institution} onChange={(e) => setInstitution(e.target.value as typeof institution)} className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 mb-3">
            <option value="IDSS">IDSS</option>
            <option value="MONTESSORI">IMH</option>
          </select>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-slate-900 transition-all cursor-pointer"
          >
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Prevucite JSON fajl ovdje ili kliknite da izaberete</p>
          </div>
        </div>
      )}

      {parseError && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{parseError}</div>}

      {entries && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700">Pregled — {entries.length} unosa za <strong>{institution}</strong>:</p>
          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr><th className="p-2">Naziv</th><th className="p-2">Kategorija</th><th className="p-2">Datum</th></tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-2">{e.title}</td>
                    <td className="p-2">{e.category}</td>
                    <td className="p-2 font-mono">{e.due_date.split('-').reverse().join('.')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEntries(null)} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">Odustani</button>
            <button onClick={handleConfirm} disabled={isSubmitting} className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer disabled:opacity-60 flex items-center gap-2">
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? 'Uvoženje...' : `Potvrdi uvoz (${entries.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
