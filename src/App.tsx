/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Obligation, User } from './types';
import { supabase } from './lib/supabase-browser';
import {
  fetchCurrentUser,
  logUserAction,
  fetchObligations,
  fetchAuditLogs,
  createObligation as createObligationApi,
  updateObligation as updateObligationApi,
  deleteObligation as deleteObligationApi,
  toggleObligationStatus as toggleObligationStatusApi,
  toggleChecklistItem as toggleChecklistItemApi,
  clearAuditLogs as clearAuditLogsApi,
  uploadObligationAttachment,
  runReminderScan,
  type ReminderScanResult,
} from './lib/api-client';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import AuditLogsView from './components/AuditLogsView';
import ObligationForm from './components/ObligationForm';
import PrintTemplate from './components/PrintTemplate';
import {
  Clock, LogOut, CheckSquare, History, Calendar as CalendarIcon,
  Menu, X, Shield, RefreshCw, AlertTriangle
} from 'lucide-react';
import idssLogo from './assets/logos/idss-logo.png';
import imhLogo from './assets/logos/imh-logo.png';
import { formatDateLocal, getTodayDateString, formatDateBosnianLong } from './lib/date-utils';

// Reverses the last "complete/reactivate" action via the same toggle-status
// endpoint. Create/delete are intentionally not undoable here: STANDARD_USER
// cannot delete (CONSTITUTION.md §5.1), so a generic "undo create" via DELETE
// would violate RBAC for that role; deleting is confirmed explicitly instead.
interface UndoAction {
  obligationId: string;
  nextCycleId: string | null;
}

export default function App() {

  // 1. Authentication State (Supabase session — persistence handled by supabase-js)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore session on load, and stay in sync with Supabase auth state changes.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const user = await fetchCurrentUser();
        if (isMounted) setCurrentUser(user);
      }
      if (isMounted) setAuthLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // 2. Obligations state — loaded from the backend API, not localStorage.
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // 3. Audit logs state — loaded from the backend API.
  const [auditLogs, setAuditLogs] = useState<import('./types').AuditLog[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    setDataLoading(true);
    setDataError(null);

    (async () => {
      try {
        const [obligationsData, auditLogsData] = await Promise.all([fetchObligations(), fetchAuditLogs()]);
        if (isMounted) {
          setObligations(obligationsData);
          setAuditLogs(auditLogsData);
        }
      } catch (err) {
        console.error('[App] failed to load data:', err);
        if (isMounted) setDataError(err instanceof Error ? err.message : 'Greška pri učitavanju podataka.');
      } finally {
        if (isMounted) setDataLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // 4. View and UI States
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'CALENDAR' | 'AUDIT_LOGS'>('DASHBOARD');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);

  // Mobile sidebar menu toggler
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Live clock — Sprint 05 replaced the hardcoded "Četvrtak, 2. juli 2026." /
  // "08:00:00" header display with the real current date/time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Undo toast state (see UndoAction note above)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [undoToast, setUndoToast] = useState<{ visible: boolean; message: string; actionId: string; undoable: boolean } | null>(null);

  // 6. Reminder scan modal popup (Sprint 06 — real Resend send, not a client-side simulation)
  const [isCronSimulatorOpen, setIsCronSimulatorOpen] = useState(false);
  const [reminderScanState, setReminderScanState] = useState<
    { status: 'RUNNING' } | { status: 'DONE'; result: ReminderScanResult } | { status: 'ERROR'; message: string } | null
  >(null);

  // 7. Called by Login.tsx after a successful Supabase Auth sign-in
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    logUserAction(user.id, `Korisnik ${user.fullName} se uspješno prijavio na sistem.`).catch((err) =>
      console.error('[App] failed to log login action:', err)
    );
  };

  const handleLogout = async () => {
    if (currentUser) {
      await logUserAction(currentUser.id, `Korisnik ${currentUser.fullName} se odjavio sa sistema.`).catch((err) =>
        console.error('[App] failed to log logout action:', err)
      );
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    setObligations([]);
    setAuditLogs([]);
  };

  // Toast Notification and Auto-fade
  const triggerToast = (message: string, action: UndoAction | null) => {
    setUndoAction(action);
    const id = `action_${Date.now()}`;
    setUndoToast({ visible: true, message, actionId: id, undoable: action !== null });

    // Auto fade after 5 seconds as requested in User Story 1
    setTimeout(() => {
      setUndoToast((current) => {
        if (current && current.actionId === id) {
          return { ...current, visible: false };
        }
        return current;
      });
    }, 5000);
  };

  // Reverses the last "complete/reactivate" toggle (see UndoAction note above)
  const handleUndoAction = async () => {
    if (!undoAction || !currentUser) return;

    try {
      const result = await toggleObligationStatusApi(undoAction.obligationId);
      setObligations((prev) => {
        let next = prev.map((o) => (o.id === result.obligation.id ? result.obligation : o));
        if (undoAction.nextCycleId) {
          next = next.filter((o) => o.id !== undoAction.nextCycleId);
        }
        return next;
      });

      if (undoAction.nextCycleId) {
        await deleteObligationApi(undoAction.nextCycleId);
      }

      const refreshedLogs = await fetchAuditLogs();
      setAuditLogs(refreshedLogs);
    } catch (err) {
      console.error('[App] undo failed:', err);
    } finally {
      setUndoAction(null);
      setUndoToast(null);
    }
  };

  // 8. Create or Edit Obligation Save Handler. Attachment upload is a
  // separate follow-up API call (Sprint 04) once the obligation id exists —
  // transparent to the user since ObligationForm still submits everything
  // from one form/button.
  const handleFormSubmit = async (data: Partial<Obligation>, attachmentFile?: File | null) => {
    if (!currentUser) return;

    try {
      let saved: Obligation;

      if (selectedObligation) {
        // EDIT MODE
        saved = await updateObligationApi(selectedObligation.id, {
          title: data.title,
          institution: data.institution,
          category: data.category,
          due_date: data.due_date,
          responsible_person: data.responsible_person,
          priority: data.priority,
          checklist_items: data.checklist_items,
          is_recurring: data.is_recurring,
          recurring_interval: data.recurring_interval,
          watcher_ids: data.watcher_ids,
        });
        setSelectedObligation(null);
      } else {
        // CREATE MODE
        saved = await createObligationApi({
          title: data.title || '',
          institution: data.institution || 'IDSS',
          category: data.category || 'ADMINISTRACIJA',
          due_date: data.due_date || new Date().toISOString().split('T')[0],
          responsible_person: data.responsible_person || '',
          priority: data.priority || 'SREDNJI',
          checklist_items: data.checklist_items || [],
          is_recurring: data.is_recurring || false,
          recurring_interval: data.recurring_interval || 'NONE',
          watcher_ids: data.watcher_ids || [],
        });
      }

      if (attachmentFile) {
        saved = await uploadObligationAttachment(saved.id, attachmentFile);
      }

      setObligations((prev) => {
        const exists = prev.some((o) => o.id === saved.id);
        return exists ? prev.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev];
      });

      if (!selectedObligation) {
        triggerToast(`Obaveza "${saved.title}" je uspješno kreirana.`, null);
      }

      const refreshedLogs = await fetchAuditLogs();
      setAuditLogs(refreshedLogs);
    } catch (err) {
      console.error('[App] failed to save obligation:', err);
      alert(err instanceof Error ? err.message : 'Greška pri čuvanju obaveze.');
    }
  };

  // Toggle checklist subtask items
  const handleToggleChecklistItem = async (oblId: string, itemIdx: number) => {
    if (!currentUser) return;
    try {
      const updated = await toggleChecklistItemApi(oblId, itemIdx);
      setObligations((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error('[App] failed to toggle checklist item:', err);
      alert(err instanceof Error ? err.message : 'Greška pri izmjeni kontrolne liste.');
    }
  };

  // Toggle active/completed status + Recurring engine trigger (PRD Section 5.3)
  const handleToggleStatus = async (id: string) => {
    if (!currentUser) return;
    const target = obligations.find((o) => o.id === id);
    if (!target) return;

    try {
      const result = await toggleObligationStatusApi(id);

      setObligations((prev) => {
        const next = prev.map((o) => (o.id === result.obligation.id ? result.obligation : o));
        return result.nextCycle ? [result.nextCycle, ...next] : next;
      });

      const refreshedLogs = await fetchAuditLogs();
      setAuditLogs(refreshedLogs);

      if (target.status !== 'ZAVRŠENO') {
        const message = result.nextCycle
          ? `Obaveza "${target.title}" označena kao završena. Pokrenut sljedeći ciklus za ${result.nextCycle.due_date.split('-').reverse().join('.')}.`
          : `Obaveza "${target.title}" označena kao završena.`;
        triggerToast(message, { obligationId: result.obligation.id, nextCycleId: result.nextCycle?.id ?? null });
      }
    } catch (err) {
      console.error('[App] failed to toggle status:', err);
      alert(err instanceof Error ? err.message : 'Greška pri promjeni statusa.');
    }
  };

  // Delete Obligation (SUPER_ADMIN only — enforced server-side too)
  const handleDeleteObligation = async (id: string) => {
    if (!currentUser) return;
    const target = obligations.find((o) => o.id === id);
    if (!target) return;

    try {
      await deleteObligationApi(id);
      setObligations((prev) => prev.filter((o) => o.id !== id));
      triggerToast(`Obaveza "${target.title}" je obrisana.`, null);

      const refreshedLogs = await fetchAuditLogs();
      setAuditLogs(refreshedLogs);
    } catch (err) {
      console.error('[App] failed to delete obligation:', err);
      alert(err instanceof Error ? err.message : 'Greška pri brisanju obaveze.');
    }
  };

  const handleClearAuditLogs = async () => {
    try {
      await clearAuditLogsApi();
      setAuditLogs([]);
    } catch (err) {
      console.error('[App] failed to clear audit logs:', err);
      alert(err instanceof Error ? err.message : 'Greška pri pražnjenju dnevnika aktivnosti.');
    }
  };

  // Print Action Trigger
  const handleTriggerPrint = () => {
    window.print();
  };

  // 9. Manual reminder scan trigger (SUPER_ADMIN only, mirrors CONSTITUTION.md
  // §5.5) — Sprint 06 replaced the client-side "cron simulator" with a real
  // call to the same scan the 08:00 Europe/Sarajevo node-cron job runs.
  const runCronSimulation = async () => {
    setReminderScanState({ status: 'RUNNING' });
    setIsCronSimulatorOpen(true);

    try {
      const result = await runReminderScan();
      setReminderScanState({ status: 'DONE', result });
      const refreshedLogs = await fetchAuditLogs();
      setAuditLogs(refreshedLogs);
    } catch (err) {
      console.error('[App] reminder scan failed:', err);
      setReminderScanState({
        status: 'ERROR',
        message: err instanceof Error ? err.message : 'Greška pri pokretanju podsjetnika.',
      });
    }
  };

  // While restoring an existing Supabase session, avoid flashing the Login screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F4F7] flex items-center justify-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Učitavanje...</span>
      </div>
    );
  }

  // If not authenticated, render Login Page
  if (!currentUser) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F7] flex flex-col md:flex-row font-sans text-slate-800">

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-slate-900 text-white flex flex-col shrink-0 md:sticky md:top-0 md:h-screen border-r border-slate-800 shadow-xl z-30 print:hidden font-sans">

        {/* Sidebar Header Brand */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-2 shrink-0">
              <img src={idssLogo} alt="IDSS" className="h-6 w-auto" />
              <img src={imhLogo} alt="IMH" className="h-6 w-auto" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest leading-none text-white font-sans uppercase">CHRONOS</h1>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-1 block font-semibold">IDSS & IMH SARAJEVO</span>
            </div>
          </div>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5.5 h-5.5" />}
          </button>
        </div>

        {/* Navigation menus - Collapsible on Mobile */}
        <div className={`flex-1 flex flex-col justify-between p-4 space-y-8 ${
          isMobileMenuOpen ? 'block' : 'hidden md:flex'
        }`}>

          <nav className="space-y-1.5">
            <span className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2.5">
              Glavni meni
            </span>

            <button
              onClick={() => {
                setCurrentView('DASHBOARD');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                currentView === 'DASHBOARD'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 border-transparent hover:bg-slate-800/40'
              }`}
            >
              <CheckSquare className={`w-4 h-4 ${currentView === 'DASHBOARD' ? 'text-amber-500' : 'text-slate-500'}`} />
              Dashboard i rokovi
            </button>

            <button
              onClick={() => {
                setCurrentView('CALENDAR');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                currentView === 'CALENDAR'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 border-transparent hover:bg-slate-800/40'
              }`}
            >
              <CalendarIcon className={`w-4 h-4 ${currentView === 'CALENDAR' ? 'text-amber-500' : 'text-slate-500'}`} />
              Kalendarski pregled
            </button>

            <button
              onClick={() => {
                setCurrentView('AUDIT_LOGS');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                currentView === 'AUDIT_LOGS'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 border-transparent hover:bg-slate-800/40'
              }`}
            >
              <History className={`w-4 h-4 ${currentView === 'AUDIT_LOGS' ? 'text-amber-500' : 'text-slate-500'}`} />
              AuditLogs (Dnevnik)
            </button>
          </nav>

          {/* Cron Simulation Section (Section 6.3 testing utility) */}
          <div className="bg-slate-950/40 rounded-2xl p-4.5 border border-slate-800/80 space-y-3">
            <h4 className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              Sistemski Servis
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Simulirajte jutarnji <strong className="text-slate-300 font-bold">08:00 AM Cron Job</strong> za skeniranje i slanje e-mailova.
            </p>
            <button
              id="run-cron-simulation-btn"
              onClick={runCronSimulation}
              className="w-full py-2.5 px-3 bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold text-[10px] rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-widest"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Pokreni Cron (08:00 AM)
            </button>
          </div>

          {/* User profile & Logout */}
          <div className="border-t border-slate-800 pt-4 space-y-3.5">
            <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
              <div className="font-extrabold text-xs text-slate-200 truncate">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-500 font-mono truncate">{currentUser.username}</div>
              <span className="inline-flex text-[8px] font-extrabold tracking-wider uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md mt-1.5 border border-amber-500/20 font-mono">
                {currentUser.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-amber-500" />
              Odjava sa sistema
            </button>
          </div>

        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 print:p-0">

        {/* Top Sticky Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20 print:hidden font-sans shadow-xs">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              {currentView === 'DASHBOARD' ? 'CHRONOS DASHBOARD' :
               currentView === 'CALENDAR' ? 'CHRONOS KALENDAR' : 'CHRONOS AUDIT LOGS'}
            </span>
            <p className="text-lg font-light text-slate-600 mt-0.5">
              {formatDateBosnianLong(now)}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xl font-mono font-bold text-slate-900 tracking-tight">
                {now.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-amber-600 font-bold">Lokalno Vrijeme</span>
            </div>
            <div className="h-10 w-[1px] bg-slate-200"></div>
            <div className="text-right text-[11px] text-slate-400 font-medium hidden sm:block">
              <div>Baza podataka: <strong className="text-slate-700 font-mono text-[10px]">idsssarajevo@gmail.com</strong></div>
              <div>Mrežni status: <span className="text-emerald-600 font-bold font-mono">● ONLINE</span></div>
            </div>
          </div>
        </header>

        {/* Core Content Container */}
        <div className="flex-1 p-6 max-w-7xl w-full mx-auto print:p-0">

          {dataLoading && (
            <div className="flex items-center justify-center py-24">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Učitavanje podataka...</span>
            </div>
          )}

          {!dataLoading && dataError && (
            <div className="bg-red-50 border border-red-200 text-[#E30613] p-6 rounded-3xl text-sm font-semibold flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Greška pri učitavanju podataka: {dataError}</span>
            </div>
          )}

          {!dataLoading && !dataError && currentView === 'DASHBOARD' && (
            <Dashboard
              obligations={obligations}
              onAddClick={() => {
                setSelectedObligation(null);
                setIsFormOpen(true);
              }}
              onEditClick={(obl) => {
                setSelectedObligation(obl);
                setIsFormOpen(true);
              }}
              onDeleteClick={handleDeleteObligation}
              onToggleStatus={handleToggleStatus}
              onToggleChecklistItem={handleToggleChecklistItem}
              onTriggerPrint={handleTriggerPrint}
              currentUserRole={currentUser.role}
              currentUserId={currentUser.id}
            />
          )}

          {!dataLoading && !dataError && currentView === 'CALENDAR' && (
            <CalendarView
              obligations={obligations}
              onSelectObligation={(obl) => {
                setSelectedObligation(obl);
                setIsFormOpen(true);
              }}
            />
          )}

          {!dataLoading && !dataError && currentView === 'AUDIT_LOGS' && (
            <AuditLogsView
              logs={auditLogs}
              onClearLogs={handleClearAuditLogs}
              currentUserRole={currentUser.role}
            />
          )}

        </div>

      </main>

      {/* 10. Creation and Editor slideover modal (PRD Section 6.2 validation included) */}
      <ObligationForm
        isOpen={isFormOpen}
        obligation={selectedObligation}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedObligation(null);
        }}
        onSubmit={handleFormSubmit}
        currentUserId={currentUser.id}
      />

      {/* 11. Printable Layout (Rendered in background, active for Print Engine via media queries) */}
      <PrintTemplate
        obligations={obligations}
        institutionFilter="BOTH"
        dateRange={{ startDate: '', endDate: '' }}
      />

      {/* 12. Floating Undo Toast Notification popup (PRD User Story 1 toast requirement) */}
      {undoToast && undoToast.visible && (
        <div className="fixed bottom-6 right-6 bg-[#1F2937] text-white p-4.5 rounded-2xl shadow-xl border border-slate-700 max-w-sm flex items-center justify-between gap-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 print:hidden">
          <div className="flex-1">
            <p className="text-xs font-semibold">{undoToast.message}</p>
            {undoToast.undoable && (
              <p className="text-[10px] text-slate-400 mt-0.5">Imate 5 sekundi za opoziv radnje.</p>
            )}
          </div>
          {undoToast.undoable && (
            <button
              onClick={handleUndoAction}
              className="px-3 py-1.5 bg-[#FFCB29] text-[#1F2937] hover:bg-[#ffe284] font-extrabold text-xs rounded-lg transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0 uppercase"
            >
              Opozovi (Undo)
            </button>
          )}
        </div>
      )}

      {/* 13. Interactive Cron Simulator Popup Drawer */}
      {isCronSimulatorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto font-sans">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Jutarnji servis podsjetnika (08:00 Europe/Sarajevo)
                </h3>
              </div>
              <button
                onClick={() => setIsCronSimulatorOpen(false)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200 text-xs space-y-1.5">
                <p className="font-bold text-slate-800 uppercase tracking-wide">Kako radi slanje podsjetnika?</p>
                <p className="text-slate-500 leading-relaxed">
                  Svakog jutra u <strong>08:00</strong> (Europe/Sarajevo), pozadinski servis skenira sve nezavršene rokove i za one koji ističu za <strong>tačno 3 dana</strong> šalje stvarni email preko Resend-a kreatoru obaveze, watcher-ima i Super Adminu (CONSTITUTION.md §5.7). Ovo dugme ručno pokreće isti scan, odmah, radi testiranja.
                </p>
              </div>

              {reminderScanState?.status === 'RUNNING' && (
                <div className="flex items-center justify-center py-10">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pokrećem scan i šaljem email(ove)...</span>
                </div>
              )}

              {reminderScanState?.status === 'ERROR' && (
                <div className="bg-red-50 border border-red-200 text-[#E30613] p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <span>{reminderScanState.message}</span>
                </div>
              )}

              {reminderScanState?.status === 'DONE' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                      <span className="block text-2xl font-mono font-bold text-slate-900">{reminderScanState.result.scannedCount}</span>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Skenirano</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                      <span className="block text-2xl font-mono font-bold text-amber-600">{reminderScanState.result.triggeredCount}</span>
                      <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-widest">Dospijeva za 3 dana</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                      <span className="block text-2xl font-mono font-bold text-emerald-600">{reminderScanState.result.emailsSent}</span>
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest">Email(ova) poslano</span>
                    </div>
                  </div>
                  {reminderScanState.result.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 text-[#E30613] p-4 rounded-2xl text-xs space-y-1">
                      <p className="font-bold uppercase tracking-wider">Greške pri slanju:</p>
                      <ul className="list-disc list-inside">
                        {reminderScanState.result.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4.5 flex justify-end">
              <button
                onClick={() => setIsCronSimulatorOpen(false)}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-full transition-all cursor-pointer shadow-sm"
              >
                Zatvori simulator
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
