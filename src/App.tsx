/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Obligation, AuditLog, User, RecurringInterval } from './types';
import { INITIAL_OBLIGATIONS } from './data/initialData';
import { supabase } from './lib/supabase-browser';
import { fetchCurrentUser } from './lib/api-client';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import AuditLogsView from './components/AuditLogsView';
import ObligationForm from './components/ObligationForm';
import PrintTemplate from './components/PrintTemplate';
import { 
  Clock, LogOut, CheckSquare, History, Calendar as CalendarIcon, 
  HelpCircle, Menu, X, Shield, RefreshCw, Send, CheckCircle, Mail, AlertTriangle
} from 'lucide-react';

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

  // 2. Database Obligations State (persisted in localStorage)
  const [obligations, setObligations] = useState<Obligation[]>(() => {
    const saved = localStorage.getItem('chronos_obligations');
    return saved ? JSON.parse(saved) : INITIAL_OBLIGATIONS;
  });

  // 3. System Audit Logs State (persisted in localStorage)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('chronos_audit_logs');
    if (saved) return JSON.parse(saved);

    // Initial default logs for seed presentation
    return [
      {
        id: 'log_seed_1',
        timestamp: '2026-07-02T08:15:00Z',
        username: 'direktor@idss.ba',
        action_type: 'KREIRANJE',
        target_table: 'Obligations',
        target_id: 'obl_test_001',
        changes: 'Uspješno inicijalizovan registar rokova i školske godine 2026/2027.'
      },
      {
        id: 'log_seed_2',
        timestamp: '2026-07-02T08:20:00Z',
        username: 'sekretar@idss.ba',
        action_type: 'IZMJENA',
        target_table: 'Obligations',
        target_id: 'obl_test_003',
        changes: 'Dodane kontrolne stavke za licence odgajateljica vrtića.'
      },
      {
        id: 'log_seed_3',
        timestamp: '2026-07-02T08:30:00Z',
        username: 'racunovodstvo@idss.ba',
        action_type: 'KREIRANJE',
        target_table: 'Obligations',
        target_id: 'obl_test_006',
        changes: 'Kreirana mjesečna obaveza plaćanja najma prostora IMH.'
      }
    ];
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('chronos_obligations', JSON.stringify(obligations));
  }, [obligations]);

  useEffect(() => {
    localStorage.setItem('chronos_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // 4. View and UI States
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'CALENDAR' | 'AUDIT_LOGS'>('DASHBOARD');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  
  // Mobile sidebar menu toggler
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 5. Action History / Undo State (PRD story 1)
  const [lastActionState, setLastActionState] = useState<Obligation[] | null>(null);
  const [undoToast, setUndoToast] = useState<{ visible: boolean; message: string; actionId: string } | null>(null);

  // 6. Cron simulator modal popup
  const [isCronSimulatorOpen, setIsCronSimulatorOpen] = useState(false);
  const [cronLogs, setCronLogs] = useState<string[]>([]);
  const [simulatedEmails, setSimulatedEmails] = useState<{ to: string; subject: string; body: string }[]>([]);

  // 7. Called by Login.tsx after a successful Supabase Auth sign-in
  const handleLogin = (user: User) => {
    setCurrentUser(user);

    // Log login action
    const newLog: AuditLog = {
      id: `log_login_${Date.now()}`,
      timestamp: new Date().toISOString(),
      username: user.username,
      action_type: 'IZMJENA',
      target_table: 'Users',
      target_id: user.id,
      changes: `Korisnik ${user.fullName} se uspješno prijavio na sistem.`
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleLogout = async () => {
    if (currentUser) {
      const newLog: AuditLog = {
        id: `log_logout_${Date.now()}`,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        action_type: 'IZMJENA',
        target_table: 'Users',
        target_id: currentUser.id,
        changes: `Korisnik ${currentUser.fullName} se odjavio sa sistema.`
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  // Toast Notification and Auto-fade
  const triggerUndoToast = (message: string, obligationsBefore: Obligation[]) => {
    setLastActionState(obligationsBefore);
    const id = `action_${Date.now()}`;
    setUndoToast({
      visible: true,
      message,
      actionId: id
    });

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

  // Trigger Action Undo (PRD story 1)
  const handleUndoAction = () => {
    if (lastActionState && currentUser) {
      setObligations(lastActionState);
      setLastActionState(null);
      setUndoToast(null);

      const newLog: AuditLog = {
        id: `log_undo_${Date.now()}`,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        action_type: 'UNDO',
        target_table: 'Obligations',
        target_id: 'SISTEM',
        changes: 'Korisnik je opozvao posljednju izmjenu (Undo) i vratio stanje registra.'
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    }
  };

  // Calculation of next recurring due date (PRD Section 5.3)
  const calculateNextDueDate = (currentDueDate: string, interval: RecurringInterval) => {
    const date = new Date(currentDueDate);
    switch (interval) {
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'HALF_YEARLY':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'YEARLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }
    return date.toISOString().split('T')[0];
  };

  // 8. Create or Edit Obligation Save Handler (incorporates Mock Drive URL creation)
  const handleFormSubmit = (data: Partial<Obligation>, attachmentFile?: File | null) => {
    if (!currentUser) return;

    // Cache current state for Undo
    const obligationsBefore = [...obligations];

    if (selectedObligation) {
      // EDIT MODE
      const updatedList = obligations.map((item) => {
        if (item.id === selectedObligation.id) {
          const updated: Obligation = {
            ...item,
            ...data,
            updated_at: new Date().toISOString()
          } as Obligation;

          if (attachmentFile) {
            updated.attachment_url = `https://drive.google.com/open?id=${Date.now()}_drive_mock`;
            updated.attachment_name = attachmentFile.name;
          }

          return updated;
        }
        return item;
      });

      setObligations(updatedList);
      setSelectedObligation(null);

      // Log audit
      const newLog: AuditLog = {
        id: `log_edit_${Date.now()}`,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        action_type: 'IZMJENA',
        target_table: 'Obligations',
        target_id: selectedObligation.id,
        changes: `Ažurirani detalji obaveze "${data.title}".`
      };
      setAuditLogs((prev) => [newLog, ...prev]);

    } else {
      // CREATE MODE (User Story 1)
      const newId = `obl_${Date.now()}`;
      
      const newObligation: Obligation = {
        id: newId,
        title: data.title || '',
        institution: data.institution || 'IDSS',
        category: data.category || 'ADMINISTRACIJA',
        due_date: data.due_date || '2026-07-02',
        responsible_person: data.responsible_person || '',
        priority: data.priority || 'SREDNJI',
        status: 'NOVO',
        checklist_items: data.checklist_items || [],
        attachment_url: attachmentFile ? `https://drive.google.com/open?id=${Date.now()}_drive_mock` : '',
        attachment_name: attachmentFile ? attachmentFile.name : '',
        is_recurring: data.is_recurring || false,
        recurring_interval: data.recurring_interval || 'NONE',
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setObligations([newObligation, ...obligations]);

      // Log audit
      const newLog: AuditLog = {
        id: `log_create_${Date.now()}`,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        action_type: 'KREIRANJE',
        target_table: 'Obligations',
        target_id: newId,
        changes: `Zavedena nova obaveza "${newObligation.title}" za ustanovu ${newObligation.institution === 'IDSS' ? 'IDSS' : 'IMH'}.`
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      // Trigger temporary 5-second Undo toast
      triggerUndoToast(`Obaveza "${newObligation.title}" je uspješno kreirana.`, obligationsBefore);
    }
  };

  // Toggle checklist subtask items
  const handleToggleChecklistItem = (oblId: string, itemIdx: number) => {
    if (!currentUser) return;
    const updated = obligations.map((item) => {
      if (item.id === oblId) {
        const checkItems = [...item.checklist_items];
        checkItems[itemIdx] = {
          ...checkItems[itemIdx],
          done: !checkItems[itemIdx].done
        };
        return {
          ...item,
          checklist_items: checkItems,
          updated_at: new Date().toISOString()
        };
      }
      return item;
    });

    setObligations(updated);
  };

  // Toggle active/completed status + Recurring engine trigger (PRD Section 5.3)
  const handleToggleStatus = (id: string) => {
    if (!currentUser) return;

    const obligationsBefore = [...obligations];
    const target = obligations.find((o) => o.id === id);
    if (!target) return;

    if (target.status !== 'ZAVRŠENO') {
      // Transitioning to completed
      const nextDue = calculateNextDueDate(target.due_date, target.recurring_interval);
      
      const updatedList = obligations.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: 'ZAVRŠENO' as const,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });

      // If it is a recurring task, automatically create a new cycle (Section 5.3 rules)
      if (target.is_recurring && nextDue) {
        const nextCycleId = `obl_rec_${Date.now()}`;
        
        // Reset checklist items 'done' to 'false'
        const resetChecklist = target.checklist_items.map((c) => ({
          ...c,
          done: false
        }));

        const newCycle: Obligation = {
          ...target,
          id: nextCycleId,
          status: 'NOVO',
          due_date: nextDue,
          checklist_items: resetChecklist,
          attachment_url: '', // Prompt user to upload a fresh file for the new year/cycle
          attachment_name: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Prepend new cycle, save current as completed
        setObligations([newCycle, ...updatedList]);

        // Audit Logs entry
        const newLog: AuditLog = {
          id: `log_complete_rec_${Date.now()}`,
          timestamp: new Date().toISOString(),
          username: currentUser.username,
          action_type: 'ZAVRŠETAK',
          target_table: 'Obligations',
          target_id: id,
          changes: `Završena ponavljajuća obaveza "${target.title}". Sistem je automatski kreirao novi ciklus (rok: ${nextDue.split('-').reverse().join('.')}) sa resetovanom kontrolnom listom.`
        };
        setAuditLogs((prev) => [newLog, ...prev]);

        triggerUndoToast(`Obaveza "${target.title}" označena kao završena. Pokrenut sljedeći ciklus za ${nextDue.split('-').reverse().join('.')}.`, obligationsBefore);
      } else {
        // Standard non-recurring completion
        setObligations(updatedList);

        const newLog: AuditLog = {
          id: `log_complete_std_${Date.now()}`,
          timestamp: new Date().toISOString(),
          username: currentUser.username,
          action_type: 'ZAVRŠETAK',
          target_table: 'Obligations',
          target_id: id,
          changes: `Obaveza "${target.title}" uspješno ispunjena i arhivirana.`
        };
        setAuditLogs((prev) => [newLog, ...prev]);

        triggerUndoToast(`Obaveza "${target.title}" označena kao završena.`, obligationsBefore);
      }
    } else {
      // Toggle back to active (U_TOKU)
      const updatedList = obligations.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: 'U_TOKU' as const,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });
      setObligations(updatedList);

      const newLog: AuditLog = {
        id: `log_reopen_${Date.now()}`,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        action_type: 'IZMJENA',
        target_table: 'Obligations',
        target_id: id,
        changes: `Ponovno aktiviran rok "${target.title}" (status promijenjen u U TOKU).`
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    }
  };

  // Delete Obligation
  const handleDeleteObligation = (id: string) => {
    if (!currentUser) return;
    const target = obligations.find((o) => o.id === id);
    if (!target) return;

    const obligationsBefore = [...obligations];
    const updated = obligations.filter((o) => o.id !== id);
    setObligations(updated);

    const newLog: AuditLog = {
      id: `log_delete_${Date.now()}`,
      timestamp: new Date().toISOString(),
      username: currentUser.username,
      action_type: 'BRISANJE',
      target_table: 'Obligations',
      target_id: id,
      changes: `Trajno obrisana obaveza "${target.title}" iz registra.`
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    triggerUndoToast(`Obaveza "${target.title}" je obrisana.`, obligationsBefore);
  };

  // Print Action Trigger
  const handleTriggerPrint = () => {
    window.print();
  };

  // 9. Morning Cron Simulator (Section 6.3 08:00 AM Engine Simulator)
  const runCronSimulation = () => {
    setCronLogs([]);
    setSimulatedEmails([]);
    setIsCronSimulatorOpen(true);

    const logsBuffer: string[] = [];
    logsBuffer.push('08:00:00 AM - Pokrećem jutarnju Chronos provjeru...');
    logsBuffer.push('08:00:01 AM - Čitam aktivne rokove iz registra (Obligations)...');

    // Filter obligations not completed
    const activeObligations = obligations.filter((o) => o.status !== 'ZAVRŠENO');
    logsBuffer.push(`08:00:02 AM - Pronađeno ${activeObligations.length} aktivnih/nezavršenih rokova.`);

    const todayLocal = new Date('2026-07-02'); // Simulated today date
    const targetEmails: { to: string; subject: string; body: string }[] = [];

    activeObligations.forEach((obl) => {
      const oblDate = new Date(obl.due_date);
      const diffTime = oblDate.getTime() - todayLocal.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Section 6.3 rules: "Ako je due_date tačno za 3 dana od današnjeg datuma, generiše se HTML e-mail poruka"
      // Since today is July 2nd, 2026, exact 3 days is July 5th, 2026.
      if (diffDays === 3) {
        logsBuffer.push(`08:00:03 AM - [OKIDAČ PRONAĐEN] Rok "${obl.title}" ističe za 3 dana (${obl.due_date.split('-').reverse().join('.')})!`);
        
        const emailBody = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
            <div style="background-color: #035EA1; padding: 15px; border-radius: 8px 8px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 18px; text-transform: uppercase;">[CHRONOS] Obaveštenje o roku dospijeća</h1>
            </div>
            <div style="padding: 20px; color: #1f2937;">
              <p>Poštovani,</p>
              <p>Ovo je automatski podsjetnik da administrativni rok za stavku dospijeva za tačno <strong>3 dana</strong>:</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #E30613;">
                <p style="margin: 0 0 5px 0;"><strong>Obaveza:</strong> ${obl.title}</p>
                <p style="margin: 0 0 5px 0;"><strong>Ustanova:</strong> ${obl.institution === 'IDSS' ? 'Internationale Deutsche Schule (IDSS)' : 'IMH Montessori House'}</p>
                <p style="margin: 0 0 5px 0;"><strong>Rok dospijeća:</strong> ${obl.due_date.split('-').reverse().join('.')}</p>
                <p style="margin: 0;"><strong>Odgovorna osoba:</strong> ${obl.responsible_person}</p>
              </div>

              <p>Molimo Vas da blagovremeno poduzmete akcije, ažurirate kontrolne stavke u aplikaciji Chronos i priložite relevantne dokumente.</p>
              <p style="margin-top: 25px; font-size: 11px; color: #94a3b8;">Odgovori na ovaj e-mail biće proslijeđeni na: <a href="mailto:direktor@idss.ba">direktor@idss.ba</a></p>
            </div>
          </div>
        `;

        targetEmails.push({
          to: 'direktor@idss.ba, sekretar@idss.ba',
          subject: `[CHRONOS] Obaveza ističe za 3 dana: ${obl.title}`,
          body: emailBody
        });
      }
    });

    if (targetEmails.length === 0) {
      logsBuffer.push('08:00:04 AM - Nema aktivnih obaveza koje ističu za tačno 3 dana od danas (05.07.2026.).');
      logsBuffer.push('08:00:05 AM - Jutarnji podsjetnik završen bez slanja e-mailova.');
    } else {
      logsBuffer.push(`08:00:04 AM - Generisano ${targetEmails.length} podsjetnika. Šaljem HTTP POST zahtjev prema Google Apps Script Web App servisu...`);
      logsBuffer.push('08:00:05 AM - [AUTORIZACIJA OK] GAS Web App API je uspješno poslao podsjetnike sa centralnog računa idsssarajevo@gmail.com.');
    }

    setCronLogs(logsBuffer);
    setSimulatedEmails(targetEmails);
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
            <div className="w-9 h-9 border-2 border-amber-500 rounded-lg flex items-center justify-center font-extrabold text-amber-500 text-lg tracking-tighter shrink-0 font-mono">
              C
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
              Četvrtak, 2. juli 2026.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xl font-mono font-bold text-slate-900 tracking-tight">08:00:00</span>
              <span className="text-[9px] uppercase tracking-widest text-amber-600 font-bold">Lokalno Vrijeme (CEST)</span>
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
          
          {currentView === 'DASHBOARD' && (
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
            />
          )}

          {currentView === 'CALENDAR' && (
            <CalendarView
              obligations={obligations}
              onSelectObligation={(obl) => {
                setSelectedObligation(obl);
                setIsFormOpen(true);
              }}
            />
          )}

          {currentView === 'AUDIT_LOGS' && (
            <AuditLogsView
              logs={auditLogs}
              onClearLogs={() => setAuditLogs([])}
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
            <p className="text-[10px] text-slate-400 mt-0.5">Imate 5 sekundi za opoziv radnje.</p>
          </div>
          <button
            onClick={handleUndoAction}
            className="px-3 py-1.5 bg-[#FFCB29] text-[#1F2937] hover:bg-[#ffe284] font-extrabold text-xs rounded-lg transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0 uppercase"
          >
            Opozovi (Undo)
          </button>
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
                  Simulacija jutarnjeg servisa podsjetnika (08:00 AM Engine)
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
              
              {/* Simulator Info */}
              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200 text-xs space-y-1.5">
                <p className="font-bold text-slate-800 uppercase tracking-wide">Kako radi slanje podsjetnika?</p>
                <p className="text-slate-500 leading-relaxed">
                  Svakog jutra u <strong>08:00 AM</strong>, pozadinski servis se pokreće i skenira sve nezavršene rokove. Za one koji ističu za <strong>tačno 3 dana</strong> (za simulaciju: dospijeće <strong>05.07.2026.</strong> jer je danas 02.07.2026.), generiše se HTML email i šalje preko centralnog računa <code className="bg-slate-200 px-1 rounded font-mono">idsssarajevo@gmail.com</code>.
                </p>
              </div>

              {/* Console Logs Simulator Output */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Konzolni izlaz simulatora (Server Logs)
                </h4>
                <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-2xl space-y-1 max-h-40 overflow-y-auto border border-slate-800">
                  {cronLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>

              {/* Simulated Email Previews HTML list */}
              {simulatedEmails.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Generisani HTML e-mailovi spremni za slanje ({simulatedEmails.length})
                  </h4>
                  <div className="space-y-4">
                    {simulatedEmails.map((email, i) => (
                      <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        {/* Meta */}
                        <div className="bg-slate-100 p-3.5 border-b border-slate-200 text-xs space-y-1 font-mono text-slate-600">
                          <div><strong className="text-slate-700">Kome:</strong> {email.to}</div>
                          <div><strong className="text-slate-700">Predmet:</strong> {email.subject}</div>
                          <div><strong className="text-slate-700">Pošiljalac:</strong> Chronos - IDSS & IMH &lt;idsssarajevo@gmail.com&gt;</div>
                        </div>
                        {/* Body Rendered safely */}
                        <div 
                          className="p-5 bg-white overflow-x-auto text-xs font-sans"
                          dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                      </div>
                    ))}
                  </div>
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
