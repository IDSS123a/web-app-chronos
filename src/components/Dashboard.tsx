/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Obligation, CATEGORY_STYLE_MAP, PriorityType, ObligationStatus } from '../types';
import { formatDateLocal, getTodayDateString, getCurrentSchoolYearRange, getBosnianMonthName } from '../lib/date-utils';
import {
  Search, Plus, Printer, AlertTriangle, CheckCircle,
  Clock, CheckSquare, Eye, Edit, Trash2, Calendar,
  ArrowUpDown, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, ArrowRight, ShieldCheck,
  RefreshCw, RotateCcw
} from 'lucide-react';

interface DashboardProps {
  obligations: Obligation[];
  onAddClick: () => void;
  onEditClick: (obligation: Obligation) => void;
  onDeleteClick: (id: string) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
  onToggleChecklistItem: (oblId: string, itemIdx: number) => void;
  onTriggerPrint: () => void;
  currentUserRole: string;
  currentUserId: string;
  /** Reports the currently-visible (filtered+sorted) list up to App.tsx so
   * "Printaj izvještaj" prints exactly what the user is looking at, instead
   * of always printing every obligation regardless of active filters. */
  onVisibleObligationsChange?: (state: {
    obligations: Obligation[];
    institutionFilter: 'BOTH' | 'IDSS' | 'MONTESSORI';
    dateRange: { startDate: string; endDate: string };
  }) => void;
}

export default function Dashboard({
  obligations,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  onToggleChecklistItem,
  onTriggerPrint,
  currentUserRole,
  currentUserId,
  onVisibleObligationsChange
}: DashboardProps) {

  // Mirrors server/features/obligations/domain.ts canEditObligation — UI-only
  // convenience so STANDARD_USER doesn't see edit/complete controls on
  // obligations they don't own (the server is the real enforcement point).
  const canEditObligation = (obl: Obligation) =>
    currentUserRole === 'SUPER_ADMIN' || obl.created_by === currentUserId;

  // States
  const [institutionFilter, setInstitutionFilter] = useState<'BOTH' | 'IDSS' | 'MONTESSORI'>('BOTH');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<'DANAS' | 'SEDAM_DANA' | 'TRIDESET_DANA' | 'ISTEKLO' | 'SVE'>('SVE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Accordion state to show checklist items inline
  const [expandedObligationId, setExpandedObligationId] = useState<string | null>(null);

  // Tracks obligation IDs with an in-flight toggle-status/delete request so
  // the row's action buttons can show a spinner and disable themselves —
  // without this, a slow connection made rapid double-clicks (e.g. two
  // DELETE calls) possible with no visual feedback in between.
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const runWithProcessing = async (id: string, action: (id: string) => Promise<void>) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await action(id);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Sorting
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'title'>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const todayStr = getTodayDateString();
  const today = new Date(todayStr);
  const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM
  const currentMonthNameCapitalized = getBosnianMonthName(today.getMonth(), true);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastDayOfMonthLabel = `${formatDateLocal(lastDayOfMonth).split('-').reverse().join('.')}.`;

  // "Školska godina" quick period is navigable — the current school year is
  // just the default (offset 0), not the only option. Without this, a user
  // couldn't filter to next year's obligations (e.g. September enrollment)
  // while browsing earlier in the current school year.
  const [schoolYearOffset, setSchoolYearOffset] = useState(0);
  const currentSchoolYearStartYear = parseInt(getCurrentSchoolYearRange().startDate.slice(0, 4), 10);
  const selectedSchoolYearStartYear = currentSchoolYearStartYear + schoolYearOffset;
  const selectedSchoolYear = {
    startDate: `${selectedSchoolYearStartYear}-09-01`,
    endDate: `${selectedSchoolYearStartYear + 1}-08-31`,
    label: `${selectedSchoolYearStartYear}/${selectedSchoolYearStartYear + 1}`,
  };

  // Date Presets Handler
  const applyPreset = (preset: 'WEEK' | 'MONTH' | 'SCHOOL_YEAR', schoolYearRange?: { startDate: string; endDate: string }) => {
    const now = new Date();
    if (preset === 'WEEK') {
      const dayOfWeek = now.getDay(); // 0 = Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDateLocal(monday));
      setEndDate(formatDateLocal(sunday));
    } else if (preset === 'MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatDateLocal(first));
      setEndDate(formatDateLocal(last));
    } else if (preset === 'SCHOOL_YEAR') {
      const range = schoolYearRange ?? selectedSchoolYear;
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  // Filtering Logic
  // Memoized: without this, filteredObligations/sortedObligations were new
  // array references on every render (even unrelated ones, e.g. expanding a
  // checklist), which fed into the useEffect below and caused an infinite
  // setPrintView -> re-render loop (found via live console-error checking,
  // 2026-07-11 stress test).
  const filteredObligations = useMemo(() => obligations.filter((obl) => {
    // 1. Institution
    if (institutionFilter !== 'BOTH' && obl.institution !== institutionFilter) {
      return false;
    }

    // 2. Search query (Title, Category label, or Responsible person)
    const catLabel = CATEGORY_STYLE_MAP[obl.category]?.label || '';
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      obl.title.toLowerCase().includes(searchLower) ||
      catLabel.toLowerCase().includes(searchLower) ||
      obl.responsible_person.toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;

    // 3. Status Tabs
    const oblDate = new Date(obl.due_date);
    const diffTime = oblDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isCompleted = obl.status === 'ZAVRŠENO';

    if (statusTab === 'DANAS') {
      // Due today and not completed
      if (obl.due_date !== todayStr || isCompleted) return false;
    } else if (statusTab === 'SEDAM_DANA') {
      // Due in next 7 days and not completed
      if (diffDays < 0 || diffDays > 7 || isCompleted) return false;
    } else if (statusTab === 'TRIDESET_DANA') {
      // Due in next 30 days and not completed
      if (diffDays < 0 || diffDays > 30 || isCompleted) return false;
    } else if (statusTab === 'ISTEKLO') {
      // Expired (due date in past) and not completed
      if (diffDays >= 0 || isCompleted) return false;
    }

    // 4. Custom Date Range inputs
    if (startDate && obl.due_date < startDate) return false;
    if (endDate && obl.due_date > endDate) return false;

    return true;
  }), [obligations, institutionFilter, searchQuery, statusTab, startDate, endDate, todayStr]);

  // Sorting Logic
  const sortedObligations = useMemo(() => [...filteredObligations].sort((a, b) => {
    let valA: any = a[sortBy];
    let valB: any = b[sortBy];

    // Priority sorting mapping
    if (sortBy === 'priority') {
      const priorityWeight = { 'VISOK': 3, 'SREDNJI': 2, 'NIZAK': 1 };
      valA = priorityWeight[a.priority as PriorityType] || 0;
      valB = priorityWeight[b.priority as PriorityType] || 0;
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }), [filteredObligations, sortBy, sortDirection]);

  // Keep App.tsx's PrintTemplate in sync with exactly what's currently visible.
  useEffect(() => {
    onVisibleObligationsChange?.({
      obligations: sortedObligations,
      institutionFilter,
      dateRange: { startDate, endDate },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedObligations, institutionFilter, startDate, endDate]);

  const handleSort = (field: 'due_date' | 'priority' | 'title') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Counts / Indicators Calculations
  const expiredCount = obligations.filter(o => new Date(o.due_date) < today && o.status !== 'ZAVRŠENO').length;
  const inProgressCount = obligations.filter(o => o.status === 'U_TOKU').length;
  const newCount = obligations.filter(o => o.status === 'NOVO').length;
  const completedCount = obligations.filter(o => o.status === 'ZAVRŠENO').length;

  const getPriorityBadgeColor = (p: PriorityType) => {
    switch (p) {
      case 'VISOK':
        return 'bg-red-100 text-[#E30613] border-red-200';
      case 'SREDNJI':
        return 'bg-yellow-100 text-amber-800 border-yellow-200';
      case 'NIZAK':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadgeColor = (s: ObligationStatus) => {
    switch (s) {
      case 'ZAVRŠENO':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'U_TOKU':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'NOVO':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Statistics Cards Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Expired alert card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Kritično / Isteklo</span>
            <span id="stat-expired-count" className="text-3xl font-mono font-bold text-[#E30613] block mt-1.5">{expiredCount}</span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              Hitan administrativni angažman!
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-[#E30613] shrink-0">
            <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
          </div>
        </div>

        {/* In progress card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">U radu / Aktivno</span>
            <span id="stat-progress-count" className="text-3xl font-mono font-bold text-slate-900 block mt-1.5">{inProgressCount}</span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              {newCount} novih obaveza čeka akciju.
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <Clock className="w-5.5 h-5.5 text-amber-500" />
          </div>
        </div>

        {/* Due in July 2026 count */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Ovaj mjesec ({currentMonthNameCapitalized})</span>
            <span id="stat-july-count" className="text-3xl font-mono font-bold text-amber-600 block mt-1.5">
              {obligations.filter(o => o.due_date.startsWith(currentMonthPrefix) && o.status !== 'ZAVRŠENO').length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              Rokovi do {lastDayOfMonthLabel}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50/60 border border-amber-100/50 flex items-center justify-center text-amber-600 shrink-0">
            <Calendar className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* Completed card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Arhivirano / Završeno</span>
            <span id="stat-completed-count" className="text-3xl font-mono font-bold text-emerald-600 block mt-1.5">{completedCount}</span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              Uspješno arhivirani rokovi.
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-5.5 h-5.5" />
          </div>
        </div>

      </div>

      {/* 2. Primary Institution Selector Bar */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
        
        <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setInstitutionFilter('BOTH')}
            className={`flex-1 md:flex-initial text-[11px] uppercase tracking-wider font-extrabold py-2.5 px-5 rounded-xl transition-all cursor-pointer ${
              institutionFilter === 'BOTH'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Svi rokovi (Zajednički)
          </button>
          
          <button
            onClick={() => setInstitutionFilter('IDSS')}
            className={`flex-1 md:flex-initial text-[11px] uppercase tracking-wider font-extrabold py-2.5 px-5 rounded-xl transition-all cursor-pointer ${
              institutionFilter === 'IDSS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Samo IDSS Škola
          </button>

          <button
            onClick={() => setInstitutionFilter('MONTESSORI')}
            className={`flex-1 md:flex-initial text-[11px] uppercase tracking-wider font-extrabold py-2.5 px-5 rounded-xl transition-all cursor-pointer ${
              institutionFilter === 'MONTESSORI'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Samo IMH Vrtić
          </button>
        </div>

        {/* Fast Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onTriggerPrint}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Printaj izvještaj
          </button>
          
          <button
            id="add-obligation-btn"
            onClick={onAddClick}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-full transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-500" />
            Unos obaveze
          </button>
        </div>

      </div>

      {/* 3. Search and Date Filtering Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        
        {/* Row 1: Quick Status Tabs */}
        <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mr-3">Filtar stanja:</span>
          {[
            { id: 'SVE', label: 'Sve obaveze' },
            { id: 'DANAS', label: 'Danas dospijeva' },
            { id: 'SEDAM_DANA', label: 'Dospijeva u 7 dana' },
            { id: 'TRIDESET_DANA', label: 'Dospijeva u 30 dana' },
            { id: 'ISTEKLO', label: 'Kritično / Isteklo' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                statusTab === tab.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Live Search Bar & Date Period selectors */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Search bar */}
          <div className="relative lg:col-span-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pretraži (ugovor o radu, ljekarski, Jasmina)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm placeholder-slate-400 bg-slate-50/50"
            />
          </div>

          {/* Custom Date Inputs */}
          <div className="lg:col-span-6 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Od:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none bg-slate-50/50"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Do:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none bg-slate-50/50"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={clearDateRange}
                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2.5 rounded-2xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Poništi
              </button>
            )}
          </div>

        </div>

        {/* Row 3: Preset fast shortcuts */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-50 pt-3">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mr-2">Brzi period:</span>
          <button
            onClick={() => applyPreset('WEEK')}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Ova sedmica
          </button>
          <button
            onClick={() => applyPreset('MONTH')}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Ovaj mjesec
          </button>
          <div className="inline-flex items-center bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
            <button
              onClick={() => {
                const nextOffset = schoolYearOffset - 1;
                setSchoolYearOffset(nextOffset);
                const startYear = currentSchoolYearStartYear + nextOffset;
                applyPreset('SCHOOL_YEAR', { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-08-31` });
              }}
              className="px-2 py-1.5 text-amber-800 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Prethodna školska godina"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyPreset('SCHOOL_YEAR')}
              className="px-2 py-1.5 text-amber-800 text-xs font-bold hover:bg-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              Školska godina {selectedSchoolYear.label}
            </button>
            <button
              onClick={() => {
                const nextOffset = schoolYearOffset + 1;
                setSchoolYearOffset(nextOffset);
                const startYear = currentSchoolYearStartYear + nextOffset;
                applyPreset('SCHOOL_YEAR', { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-08-31` });
              }}
              className="px-2 py-1.5 text-amber-800 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Sljedeća školska godina"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 4. Obligations Database List Grid & Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Head Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="py-4.5 px-4 text-center w-12">R.b.</th>
                <th className="py-4.5 px-4 cursor-pointer hover:text-[#035EA1] w-72" onClick={() => handleSort('title')}>
                  <span className="flex items-center gap-1">
                    Naziv obaveze / Rok
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </th>
                <th className="py-4.5 px-4 w-28">Ustanova</th>
                <th className="py-4.5 px-4 w-32">Kategorija</th>
                <th className="py-4.5 px-4 cursor-pointer hover:text-[#035EA1] w-36" onClick={() => handleSort('due_date')}>
                  <span className="flex items-center gap-1">
                    Rok dospijeća
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </th>
                <th className="py-4.5 px-4 w-36">Odgovorna osoba</th>
                <th className="py-4.5 px-4 text-center w-28" onClick={() => handleSort('priority')}>
                  <span className="inline-flex items-center gap-1 cursor-pointer hover:text-[#035EA1]">
                    Prioritet
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </th>
                <th className="py-4.5 px-4 text-center w-24">Status</th>
                <th className="py-4.5 px-4 text-right w-40 sticky right-0 bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedObligations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-10 h-10 text-slate-300" />
                      <span className="font-bold text-slate-700 text-base">Nema evidentiranih obaveza</span>
                      <span className="text-xs text-slate-400">Pokušajte prilagoditi filtere ili dodajte novu obavezu.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedObligations.map((obl, idx) => {
                  const isExpanded = expandedObligationId === obl.id;
                  const isPast = new Date(obl.due_date) < today && obl.status !== 'ZAVRŠENO';
                  const catStyle = CATEGORY_STYLE_MAP[obl.category] || { bgClass: 'bg-slate-100', dotClass: 'bg-slate-400', label: obl.category };
                  const finishedSubtasks = obl.checklist_items.filter(c => c.done).length;
                  const totalSubtasks = obl.checklist_items.length;

                  return (
                    <Fragment key={obl.id}>
                      <tr
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isPast ? 'bg-red-50/20' : ''
                        }`}
                      >
                        {/* Row number */}
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        
                        {/* Title and subtask quick toggle */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800 text-xs sm:text-sm">{obl.title}</div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                            {obl.is_recurring && (
                              <span className="text-[#035EA1] bg-blue-50 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">
                                Ponavljajuće ({obl.recurring_interval})
                              </span>
                            )}
                            
                            {totalSubtasks > 0 && (
                              <button
                                onClick={() => setExpandedObligationId(isExpanded ? null : obl.id)}
                                className="text-slate-500 hover:text-[#035EA1] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                Kontrolna lista ({finishedSubtasks}/{totalSubtasks})
                              </button>
                            )}

                            {obl.attachment_url && (
                              <a
                                href={obl.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#035EA1] hover:underline font-bold"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {obl.attachment_name || 'Prilog'}
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Institution */}
                        <td className="py-4 px-4">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase border ${
                            obl.institution === 'IDSS' 
                              ? 'bg-blue-50 text-[#035EA1] border-blue-200' 
                              : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          }`}>
                            {obl.institution === 'IDSS' ? 'IDSS Škola' : 'IMH Vrtić'}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${catStyle.bgClass} border`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dotClass}`} />
                            {catStyle.label}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-4 px-4">
                          <div className={`font-mono text-xs font-bold ${isPast ? 'text-[#E30613] bg-red-50 px-2 py-1 rounded border border-red-200 inline-block' : 'text-slate-700'}`}>
                            {obl.due_date.split('-').reverse().join('.')}
                          </div>
                          {isPast && (
                            <span className="block text-[8px] font-extrabold uppercase tracking-wide text-[#E30613] mt-0.5 animate-pulse">
                              ISTEKLO!
                            </span>
                          )}
                        </td>

                        {/* Responsible Person */}
                        <td className="py-4 px-4 font-semibold text-slate-700 text-xs">
                          {obl.responsible_person}
                        </td>

                        {/* Priority */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getPriorityBadgeColor(obl.priority)}`}>
                            {obl.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getStatusBadgeColor(obl.status)}`}>
                            {obl.status}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className={`py-4 px-4 text-right sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] ${isPast ? 'bg-red-50' : 'bg-white'}`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Complete / reactivate toggle */}
                            {canEditObligation(obl) && (
                              <button
                                onClick={() => runWithProcessing(obl.id, onToggleStatus)}
                                disabled={processingIds.has(obl.id)}
                                className={
                                  obl.status === 'ZAVRŠENO'
                                    ? 'p-1.5 hover:bg-amber-50 text-amber-600 hover:text-amber-700 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                                    : 'p-1.5 hover:bg-green-50 text-emerald-600 hover:text-emerald-700 rounded-lg border border-slate-200 hover:border-green-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                                }
                                title={obl.status === 'ZAVRŠENO' ? 'Ponovo aktiviraj obavezu' : 'Završi obavezu'}
                              >
                                {processingIds.has(obl.id) ? (
                                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                                ) : obl.status === 'ZAVRŠENO' ? (
                                  <RotateCcw className="w-4.5 h-4.5" />
                                ) : (
                                  <CheckSquare className="w-4.5 h-4.5" />
                                )}
                              </button>
                            )}

                            {canEditObligation(obl) && (
                              <button
                                onClick={() => onEditClick(obl)}
                                disabled={processingIds.has(obl.id)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Uredi"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}

                            {currentUserRole === 'SUPER_ADMIN' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Jeste li sigurni da želite trajno obrisati obavezu "${obl.title}"?`)) {
                                    runWithProcessing(obl.id, onDeleteClick);
                                  }
                                }}
                                disabled={processingIds.has(obl.id)}
                                className="p-1.5 hover:bg-red-50 text-[#E30613] hover:text-red-700 rounded-lg border border-slate-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Obriši"
                              >
                                {processingIds.has(obl.id) ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded checklist subsection */}
                      {isExpanded && totalSubtasks > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={9} className="py-3 px-12 border-b border-slate-100">
                            <div className="max-w-2xl bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Kontrolna lista zadatka:
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {obl.checklist_items.map((item, itemIdx) => (
                                  <div 
                                    key={itemIdx} 
                                    className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100/60"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.done}
                                      disabled={!canEditObligation(obl)}
                                      onChange={() => onToggleChecklistItem(obl.id, itemIdx)}
                                      className="rounded text-[#035EA1] focus:ring-[#035EA1] h-3.5 w-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className={`text-xs font-medium ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                      {item.task}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Vertical Cards for Mobile (< 768px) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {sortedObligations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-700">Nema evidentiranih obaveza</p>
            </div>
          ) : (
            sortedObligations.map((obl) => {
              const catStyle = CATEGORY_STYLE_MAP[obl.category] || { bgClass: 'bg-slate-100', dotClass: 'bg-slate-400', label: obl.category };
              const isPast = new Date(obl.due_date) < today && obl.status !== 'ZAVRŠENO';
              const finishedSubtasks = obl.checklist_items.filter(c => c.done).length;
              const totalSubtasks = obl.checklist_items.length;

              return (
                <div key={obl.id} className={`p-4 space-y-3.5 ${isPast ? 'bg-red-50/20' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      obl.institution === 'IDSS' ? 'bg-blue-50 text-[#035EA1] border border-blue-100' : 'bg-yellow-50 text-yellow-800 border border-yellow-100'
                    }`}>
                      {obl.institution === 'IDSS' ? 'IDSS Škola' : 'IMH Vrtić'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${getPriorityBadgeColor(obl.priority)}`}>
                        {obl.priority}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${getStatusBadgeColor(obl.status)}`}>
                        {obl.status}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800">{obl.title}</h4>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Dospijeva:</span>
                      <span className={`font-mono font-bold ${isPast ? 'text-[#E30613]' : 'text-slate-700'}`}>
                        {obl.due_date.split('-').reverse().join('.')}
                      </span>
                      {isPast && <span className="text-[8px] font-extrabold text-[#E30613] block uppercase tracking-wide">ISTEKLO!</span>}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Odgovoran:</span>
                      <span className="font-semibold text-slate-700">{obl.responsible_person}</span>
                    </div>
                  </div>

                  {/* Checklist Subtask summaries on Mobile */}
                  {totalSubtasks > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 mb-1.5">
                        <span>Kontrolna lista:</span>
                        <span>{finishedSubtasks}/{totalSubtasks} završeno</span>
                      </div>
                      <div className="space-y-1.5">
                        {obl.checklist_items.map((item, idx) => (
                          <label key={idx} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.done}
                              disabled={!canEditObligation(obl)}
                              onChange={() => onToggleChecklistItem(obl.id, idx)}
                              className="rounded text-[#035EA1] focus:ring-[#035EA1] h-3.5 w-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className={`text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                              {item.task}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachment */}
                  {obl.attachment_url && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[#035EA1]" />
                        {obl.attachment_name || 'Ugovor prilog'}
                      </span>
                      <a
                        href={obl.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#035EA1] font-bold"
                      >
                        Otvori
                      </a>
                    </div>
                  )}

                  {/* Mobile Actions Drawer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {canEditObligation(obl) && (
                      <button
                        onClick={() => runWithProcessing(obl.id, onToggleStatus)}
                        disabled={processingIds.has(obl.id)}
                        className={
                          obl.status === 'ZAVRŠENO'
                            ? 'flex-1 inline-flex items-center justify-center gap-1.5 py-2 border border-amber-200 text-amber-700 font-bold text-xs rounded-xl bg-amber-50/50 hover:bg-amber-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                            : 'flex-1 inline-flex items-center justify-center gap-1.5 py-2 border border-green-200 text-emerald-700 font-bold text-xs rounded-xl bg-green-50/50 hover:bg-green-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                        }
                      >
                        {processingIds.has(obl.id) ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : obl.status === 'ZAVRŠENO' ? (
                          <RotateCcw className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        {obl.status === 'ZAVRŠENO' ? 'Aktiviraj' : 'Završi'}
                      </button>
                    )}

                    {canEditObligation(obl) && (
                      <button
                        onClick={() => onEditClick(obl)}
                        disabled={processingIds.has(obl.id)}
                        className="inline-flex items-center justify-center p-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUserRole === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => {
                          if (confirm(`Jeste li sigurni da želite trajno obrisati obavezu "${obl.title}"?`)) {
                            runWithProcessing(obl.id, onDeleteClick);
                          }
                        }}
                        disabled={processingIds.has(obl.id)}
                        className="inline-flex items-center justify-center p-2 border border-red-200 text-[#E30613] rounded-xl hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {processingIds.has(obl.id) ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
