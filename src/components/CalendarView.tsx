/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Obligation, CATEGORY_STYLE_MAP, CategoryInfo } from '../types';
import { formatDateLocal, getTodayDateString, formatDateBosnianLong } from '../lib/date-utils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, AlertCircle } from 'lucide-react';

const DEFAULT_CATEGORY_INFO: CategoryInfo = {
  label: 'Administrativni / Zakonski rok',
  bgClass: 'bg-slate-50 text-slate-800 border-slate-200',
  dotClass: 'bg-slate-500',
  hex: '#7F8C8D',
  borderClass: 'border-slate-300',
  textClass: 'text-slate-800'
};

interface CalendarViewProps {
  obligations: Obligation[];
  onSelectObligation?: (obligation: Obligation) => void;
}

export default function CalendarView({ obligations, onSelectObligation }: CalendarViewProps) {
  const todayStr = getTodayDateString();

  // Current date viewing state — defaults to the real current month/year.
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [viewType, setViewType] = useState<'MONTH' | 'WEEK'>('MONTH');

  const monthNames = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];

  const dayNamesShort = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

  // Helper: Get number of days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper: Get day of week for first day (0-6, starting Monday)
  const getFirstDayOfMonthOffset = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    // JS days: 0 = Sun, 1 = Mon... We want 0 = Mon, 6 = Sun
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const offset = getFirstDayOfMonthOffset(currentYear, currentMonth);

  // Build grid arrays
  const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing cells
  const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonthIndex);

  for (let i = offset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    calendarCells.push({ dateStr, dayNum, isCurrentMonth: false });
  }

  // Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Next month leading cells to complete grid (multiples of 7)
  const totalCellsNeeded = Math.ceil(calendarCells.length / 7) * 7;
  const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  let nextMonthDay = 1;

  while (calendarCells.length < totalCellsNeeded) {
    const dateStr = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
    calendarCells.push({ dateStr, dayNum: nextMonthDay, isCurrentMonth: false });
    nextMonthDay++;
  }

  // Filter cells for WEEK view: the week containing today if the selected
  // month/year is the real current month, otherwise the first week of
  // whichever month is selected.
  const getWeekCells = () => {
    const now = new Date();
    const isViewingCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    const anchorDay = isViewingCurrentMonth ? now.getDate() : 1;
    const targetDate = new Date(currentYear, currentMonth, anchorDay);
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const week: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetDate);
      d.setDate(targetDate.getDate() + mondayOffset + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      week.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === currentMonth
      });
    }
    return week;
  };

  const displayedCells = viewType === 'MONTH' ? calendarCells : getWeekCells();

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Check if a cell date is "Danas"
  const isToday = (dateStr: string) => {
    return dateStr === todayStr;
  };

  // Get obligations matching a specific date
  const getObligationsForDate = (dateStr: string) => {
    return obligations.filter((obl) => obl.due_date === dateStr);
  };

  // Selected date for day details pane
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(todayStr);
  const selectedDayObligations = selectedDayDate ? getObligationsForDate(selectedDayDate) : [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row gap-6">
      
      {/* Left side: Calendar Grid */}
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5.5 h-5.5 text-amber-500" />
              Kalendarski pregled obaveza
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kliknite na dan da biste vidjeli detaljne rokove. Boje prate zvanični školski kalendar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Week / Month toggler */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewType('MONTH')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewType === 'MONTH' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mjesec
              </button>
              <button
                onClick={() => setViewType('WEEK')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewType === 'WEEK' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sedmica
              </button>
            </div>

            {/* Prev/Next switch */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 px-2 min-w-32 text-center select-none uppercase tracking-wider">
                {monthNames[currentMonth]} {currentYear}.
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Day Grid Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">
          {dayNamesShort.map((day) => (
            <div key={day} className="py-2">{day}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          {displayedCells.map((cell, idx) => {
            const cellObligations = getObligationsForDate(cell.dateStr);
            const isCellSelected = selectedDayDate === cell.dateStr;
            const isTodayCell = isToday(cell.dateStr);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDayDate(cell.dateStr)}
                className={`min-h-[90px] sm:min-h-[110px] bg-white p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative select-none ${
                  cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400 bg-slate-50/50'
                } ${
                  isTodayCell ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5' : 'border-slate-100 hover:border-slate-200'
                } ${
                  isCellSelected ? 'shadow-sm ring-2 ring-slate-900 border-slate-900' : ''
                }`}
              >
                {/* Cell Number and Today marker */}
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    isTodayCell ? 'bg-amber-500 text-slate-950 font-extrabold' : ''
                  }`}>
                    {cell.dayNum}
                  </span>
                  
                  {isTodayCell && (
                    <span className="text-[8px] font-extrabold text-amber-600 uppercase tracking-widest hidden sm:inline">
                      Danas
                    </span>
                  )}
                </div>

                {/* Event indicators */}
                <div className="mt-1 flex flex-col gap-1 overflow-hidden">
                  {cellObligations.slice(0, 3).map((obl) => {
                    const style = CATEGORY_STYLE_MAP[obl.category] || DEFAULT_CATEGORY_INFO;
                    const isDone = obl.status === 'ZAVRŠENO';
                    return (
                      <div
                        key={obl.id}
                        title={`${obl.title} [${obl.institution === 'IDSS' ? 'IDSS' : 'IMH'}]`}
                        className={`text-[9px] font-bold truncate px-1.5 py-0.5 rounded flex items-center gap-1 leading-normal ${
                          isDone ? 'bg-slate-100 text-slate-400 line-through decoration-slate-300 border border-slate-200' : `${style.bgClass} border`
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDone ? 'bg-slate-300' : style.dotClass}`} />
                        <span className="truncate">{obl.title}</span>
                      </div>
                    );
                  })}
                  {cellObligations.length > 3 && (
                    <div className="text-[8px] font-extrabold text-slate-500 text-center bg-slate-100 py-0.5 rounded border border-slate-200">
                      + {cellObligations.length - 3} obaveze
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side: Day Detail Panel */}
      <div className="w-full lg:w-80 bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Detaljan pregled za dan</span>
          <h3 className="text-base font-bold text-slate-800">
            {selectedDayDate ? formatDateBosnianLong(new Date(selectedDayDate), true) : 'Odaberite datum'}
          </h3>
          {selectedDayDate && isToday(selectedDayDate) && (
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-950 bg-amber-500 px-2 py-0.5 rounded mt-1.5 uppercase border border-amber-600/15">
              Tekući dan (Danas)
            </span>
          )}
        </div>

        {/* Detailed List */}
        <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[380px]">
          {selectedDayObligations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Info className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Nema zabilježenih rokova za ovaj datum.</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-normal">
                Koristite dugme "Unos obaveze" na dashboardu da dodate novi rok za ovaj dan.
              </p>
            </div>
          ) : (
            selectedDayObligations.map((obl) => {
              const style = CATEGORY_STYLE_MAP[obl.category] || DEFAULT_CATEGORY_INFO;
              const isPast = new Date(obl.due_date) < new Date(todayStr) && obl.status !== 'ZAVRŠENO';

              return (
                <div
                  key={obl.id}
                  onClick={() => onSelectObligation && onSelectObligation(obl)}
                  className={`bg-white rounded-2xl p-4 border hover:shadow-xs transition-all cursor-pointer relative group ${
                    isPast ? 'border-red-200 shadow-xs shadow-red-50/50' : 'border-slate-200/60'
                  }`}
                >
                  {/* Past due alert indicator */}
                  {isPast && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-[#E30613] text-[9px] font-bold text-white items-center justify-center">!</span>
                    </span>
                  )}

                  {/* Institution Badge */}
                  <div className="flex justify-between items-center mb-2.5">
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                      obl.institution === 'IDSS' ? 'bg-blue-50 text-slate-800 border-blue-200/50' : 'bg-yellow-50 text-amber-900 border-yellow-200/50'
                    }`}>
                      {obl.institution === 'IDSS' ? 'IDSS Škola' : 'IMH Vrtić'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                      {obl.priority}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-2">
                    {obl.title}
                  </h4>

                  {/* Category description label */}
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
                    <span>{style.label}</span>
                  </div>

                  {/* Responsible person */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-50 text-[10px] text-slate-400 flex justify-between items-center">
                    <span>Odgovoran: <strong className="text-slate-600 font-bold">{obl.responsible_person}</strong></span>
                    <span className={`font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                      obl.status === 'ZAVRŠENO' ? 'bg-green-50 text-green-700 border border-green-200/50' :
                      obl.status === 'U_TOKU' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                    }`}>
                      {obl.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend Panel */}
        <div className="mt-5 pt-4 border-t border-slate-200">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Tumač kategorija IDSS / IMH</h4>
          <div className="space-y-2">
            {Object.entries(CATEGORY_STYLE_MAP).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className={`w-2 h-2 rounded-full shrink-0 ${value.dotClass}`} />
                <span className="truncate">{value.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
