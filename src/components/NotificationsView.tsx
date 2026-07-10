/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interni notifikacioni sistem (Sprint 09) — grupe primalaca, zakazani
 * dnevni izvještaji, ručno slanje, evidencija. SUPER_ADMIN-only (gated i
 * server-side i na nivou prikaza u sidebar-u).
 */

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import {
  Bell, Users, Calendar, Send, History, Plus, Trash2, Edit, X,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { NotificationGroup, NotificationSchedule, NotificationLogEntry, UserSummary } from '../types';
import {
  fetchNotificationGroups, createNotificationGroup, updateNotificationGroup, deleteNotificationGroup,
  fetchNotificationSchedules, createNotificationSchedule, updateNotificationSchedule, deleteNotificationSchedule,
  sendManualNotification, fetchNotificationLog, fetchUsers,
} from '../lib/api-client';

type Tab = 'GRUPE' | 'RASPOREDI' | 'SLANJE' | 'EVIDENCIJA';

export default function NotificationsView() {
  const [activeTab, setActiveTab] = useState<Tab>('GRUPE');
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  // Only the very first load shows the full-screen spinner (which unmounts
  // the active tab). Refreshes triggered after a save/send (onChanged/onSent)
  // fetch silently in the background instead — otherwise a successful manual
  // send's confirmation screen gets unmounted before the user ever sees it,
  // since the refresh that follows it would tear down the whole tab tree.
  const loadAll = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [g, s, l, u] = await Promise.all([
        fetchNotificationGroups(), fetchNotificationSchedules(), fetchNotificationLog(), fetchUsers(),
      ]);
      setGroups(g);
      setSchedules(s);
      setLog(l);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri učitavanju podataka.');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'GRUPE', label: 'Grupe', icon: Users },
    { id: 'RASPOREDI', label: 'Rasporedi', icon: Calendar },
    { id: 'SLANJE', label: 'Ručno slanje', icon: Send },
    { id: 'EVIDENCIJA', label: 'Evidencija', icon: History },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Bell className="w-5.5 h-5.5 text-amber-500" />
              Interne obavijesti
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Grupe primalaca, zakazani dnevni izvještaji, ručno slanje i evidencija.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            title="Osvježi"
          >
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

        {!loading && !error && activeTab === 'GRUPE' && (
          <GroupsTab groups={groups} users={users} onChanged={loadAll} />
        )}
        {!loading && !error && activeTab === 'RASPOREDI' && (
          <SchedulesTab schedules={schedules} groups={groups} onChanged={loadAll} />
        )}
        {!loading && !error && activeTab === 'SLANJE' && (
          <ManualSendTab groups={groups} users={users} onSent={loadAll} />
        )}
        {!loading && !error && activeTab === 'EVIDENCIJA' && (
          <LogTab log={log} />
        )}
      </div>
    </div>
  );
}

// ============ Grupe ============

function GroupsTab({ groups, users, onChanged }: { groups: NotificationGroup[]; users: UserSummary[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<NotificationGroup | 'NEW' | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing('NEW')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-full transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-500" />
          Nova grupa
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Users} text="Nema kreiranih grupa primalaca." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{g.name}</h4>
                  <p className="text-[11px] text-slate-500">{g.member_ids.length} član(ova)</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditing(g)} className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer" title="Uredi">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Obrisati grupu "${g.name}"?`)) {
                        await deleteNotificationGroup(g.id);
                        onChanged();
                      }
                    }}
                    className="p-1.5 hover:bg-red-100 text-[#E30613] rounded-lg cursor-pointer"
                    title="Obriši"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {g.member_names.length > 0 && (
                <p className="text-[11px] text-slate-400 truncate">{g.member_names.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <GroupEditorModal
          group={editing === 'NEW' ? null : editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function GroupEditorModal({ group, users, onClose, onSaved }: {
  group: NotificationGroup | null; users: UserSummary[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(group?.member_ids ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Naziv grupe mora imati najmanje 2 karaktera.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      if (group) {
        await updateNotificationGroup(group.id, { name: name.trim(), member_ids: memberIds });
      } else {
        await createNotificationGroup({ name: name.trim(), member_ids: memberIds });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri čuvanju grupe.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            {group ? 'Izmjena grupe' : 'Nova grupa'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Naziv grupe</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="npr. Uprava, Nastavnici IDSS..."
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none text-xs bg-slate-50/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Članovi</label>
            <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={() => setMemberIds((prev) => prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id])}
                    className="rounded text-slate-900 focus:ring-slate-900 h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-slate-700">{u.fullName}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">
              Odustani
            </button>
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

// ============ Rasporedi ============

function SchedulesTab({ schedules, groups, onChanged }: { schedules: NotificationSchedule[]; groups: NotificationGroup[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<NotificationSchedule | 'NEW' | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleEnabled = async (schedule: NotificationSchedule) => {
    setTogglingId(schedule.id);
    try {
      await updateNotificationSchedule(schedule.id, { enabled: !schedule.enabled });
      onChanged();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing('NEW')}
          disabled={groups.length === 0}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-full transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={groups.length === 0 ? 'Prvo kreirajte barem jednu grupu' : undefined}
        >
          <Plus className="w-4 h-4 text-amber-500" />
          Novi raspored
        </button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState icon={Calendar} text="Nema zakazanih izvještaja." />
      ) : (
        <div className="space-y-2.5">
          {schedules.map((s) => (
            <div key={s.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 truncate">{s.name}</h4>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#035EA1] border border-blue-100 shrink-0">
                    {s.send_time}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Grupa: {s.group_name} · Dnevni pregled obaveza</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEnabled(s)}
                  disabled={togglingId === s.id}
                  className="relative inline-flex items-center cursor-pointer disabled:opacity-50"
                  title={s.enabled ? 'Isključi' : 'Uključi'}
                >
                  <div className={`w-11 h-6 rounded-full transition-colors ${s.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`h-5 w-5 bg-white rounded-full shadow mt-0.5 transition-transform ${s.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button onClick={() => setEditing(s)} className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer" title="Uredi">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Obrisati raspored "${s.name}"?`)) {
                      await deleteNotificationSchedule(s.id);
                      onChanged();
                    }
                  }}
                  className="p-1.5 hover:bg-red-100 text-[#E30613] rounded-lg cursor-pointer"
                  title="Obriši"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ScheduleEditorModal
          schedule={editing === 'NEW' ? null : editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function ScheduleEditorModal({ schedule, groups, onClose, onSaved }: {
  schedule: NotificationSchedule | null; groups: NotificationGroup[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? '');
  const [groupId, setGroupId] = useState(schedule?.group_id ?? groups[0]?.id ?? '');
  const [sendTime, setSendTime] = useState(schedule?.send_time ?? '08:00');
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !groupId) {
      setError('Naziv i grupa su obavezni.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      if (schedule) {
        await updateNotificationSchedule(schedule.id, { name: name.trim(), group_id: groupId, send_time: sendTime, enabled });
      } else {
        await createNotificationSchedule({ name: name.trim(), report_type: 'DNEVNI_PREGLED', group_id: groupId, send_time: sendTime, enabled });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri čuvanju rasporeda.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            {schedule ? 'Izmjena rasporeda' : 'Novi raspored'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Naziv rasporeda</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="npr. Jutarnji izvještaj — Uprava"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none text-xs bg-slate-50/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Grupa</label>
              <select
                value={groupId} onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Vrijeme</label>
              <input
                type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
          <label className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3.5 cursor-pointer">
            <span className="text-xs font-bold text-slate-700">Raspored uključen</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
            <div onClick={() => setEnabled((v) => !v)} className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`h-5 w-5 bg-white rounded-full shadow mt-0.5 transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">
              Odustani
            </button>
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

// ============ Ručno slanje ============

function ManualSendTab({ groups, users, onSent }: { groups: NotificationGroup[]; users: UserSummary[]; onSent: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [step, setStep] = useState<'COMPOSE' | 'CONFIRM'>('COMPOSE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);

  const resolvedRecipients = new Set<string>(userIds);
  groups.filter((g) => groupIds.includes(g.id)).forEach((g) => g.member_ids.forEach((id) => resolvedRecipients.add(id)));
  const resolvedNames = [...resolvedRecipients].map((id) => users.find((u) => u.id === id)?.fullName ?? id);

  const handleContinue = () => {
    setError('');
    if (subject.trim().length < 3) { setError('Naslov mora imati najmanje 3 karaktera.'); return; }
    if (body.trim().length < 1) { setError('Poruka ne smije biti prazna.'); return; }
    if (resolvedRecipients.size === 0) { setError('Odaberite barem jednu grupu ili korisnika.'); return; }
    setStep('CONFIRM');
  };

  const handleSend = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await sendManualNotification({ subject: subject.trim(), body: body.trim(), group_ids: groupIds, user_ids: userIds });
      setResult(res);
      setSubject(''); setBody(''); setGroupIds([]); setUserIds([]);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri slanju.');
    } finally {
      setIsSubmitting(false);
      setStep('COMPOSE');
    }
  };

  if (result) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
        <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
        <p className="text-sm font-bold text-emerald-800">Obavijest uspješno poslana na {result.recipientCount} primalaca.</p>
        <button onClick={() => setResult(null)} className="text-xs font-bold text-emerald-700 underline cursor-pointer">Pošalji novu</button>
      </div>
    );
  }

  if (step === 'CONFIRM') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Potvrda slanja</p>
          <p className="text-sm text-slate-700"><strong>Naslov:</strong> {subject}</p>
          <p className="text-xs text-slate-600">
            <strong>Primaoci ({resolvedRecipients.size}):</strong> {resolvedNames.join(', ')}
          </p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
        <div className="flex justify-end gap-3">
          <button onClick={() => setStep('COMPOSE')} disabled={isSubmitting} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase rounded-full cursor-pointer disabled:opacity-50">
            Nazad
          </button>
          <button onClick={handleSend} disabled={isSubmitting} className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer disabled:opacity-60 flex items-center gap-2">
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {isSubmitting ? 'Slanje...' : `Pošalji na ${resolvedRecipients.size} primalaca`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-[#E30613] p-3 rounded-xl text-xs font-semibold">{error}</div>}
      <div>
        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Naslov</label>
        <input
          type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="npr. Sastanak kolegija u petak"
          className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none text-xs bg-slate-50/40"
        />
      </div>
      <div>
        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Poruka</label>
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={6}
          placeholder="Tekst obavijesti..."
          className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none text-xs bg-slate-50/40"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Grupe primalaca</label>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => setGroupIds((prev) => prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id])} className="rounded text-slate-900 h-3.5 w-3.5" />
                <span className="text-xs font-medium text-slate-700">{g.name} ({g.member_ids.length})</span>
              </label>
            ))}
            {groups.length === 0 && <p className="text-[11px] text-slate-400 italic">Nema kreiranih grupa.</p>}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Pojedinačni korisnici</label>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer">
                <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => setUserIds((prev) => prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id])} className="rounded text-slate-900 h-3.5 w-3.5" />
                <span className="text-xs font-medium text-slate-700">{u.fullName}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={handleContinue} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase rounded-full cursor-pointer flex items-center gap-2">
          <Send className="w-3.5 h-3.5" />
          Nastavi na potvrdu
        </button>
      </div>
    </div>
  );
}

// ============ Evidencija ============

function LogTab({ log }: { log: NotificationLogEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (log.length === 0) return <EmptyState icon={History} text="Nema evidentiranih slanja." />;

  const statusBadge = (status: string) => {
    const styles = status === 'SUCCESS' ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${styles}`}>{status}</span>;
  };

  return (
    <div className="space-y-2.5">
      {log.map((entry) => (
        <div key={entry.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-800 truncate">{entry.subject}</h4>
                {statusBadge(entry.status)}
              </div>
              <p className="text-[11px] text-slate-500">
                {entry.schedule_name ? `Raspored: ${entry.schedule_name}` : `Ručno — ${entry.sent_by_name ?? 'nepoznato'}`}
                {' · '}{entry.recipient_count} primalaca · {new Date(entry.sent_at).toLocaleString('bs-BA')}
              </p>
            </div>
            {expandedId === entry.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
          {expandedId === entry.id && (
            <div className="px-4 pb-4 space-y-1.5 border-t border-slate-200 pt-3">
              {entry.recipients.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-600 font-mono">{r.email}</span>
                  <span className={`font-bold ${r.status === 'SENT' ? 'text-emerald-600' : 'text-[#E30613]'}`}>
                    {r.status}{r.error_message ? ` — ${r.error_message}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ Shared ============

function EmptyState({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
      <Icon className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-bold text-slate-700">{text}</p>
    </div>
  );
}
