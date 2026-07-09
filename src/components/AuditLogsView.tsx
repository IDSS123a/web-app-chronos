/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuditLog } from '../types';
import { Search, Eye, History, Trash2, Edit3, PlusCircle, CheckCircle, ShieldAlert, RefreshCw } from 'lucide-react';

interface AuditLogsViewProps {
  logs: AuditLog[];
  onClearLogs?: () => Promise<void>;
  currentUserRole: string;
}

export default function AuditLogsView({ logs, onClearLogs, currentUserRole }: AuditLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [isClearing, setIsClearing] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.changes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || log.action_type === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'KREIRANJE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <PlusCircle className="w-3.5 h-3.5" />
            Kreiranje
          </span>
        );
      case 'IZMJENA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Edit3 className="w-3.5 h-3.5" />
            Izmjena
          </span>
        );
      case 'BRISANJE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
            <Trash2 className="w-3.5 h-3.5" />
            Brisanje
          </span>
        );
      case 'ZAVRŠETAK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Završetak
          </span>
        );
      case 'UNDO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <History className="w-3.5 h-3.5" />
            Opoziv (Undo)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-800 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('bs-BA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-5.5 h-5.5 text-amber-500" />
            AuditLogs (Registar aktivnosti)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Istorijski zapis svih operacija i izmjena unutar Chronos sistema.
          </p>
        </div>
        {currentUserRole === 'SUPER_ADMIN' && onClearLogs && (
          <button
            onClick={async () => {
              if (!confirm('Jeste li sigurni da želite očistiti cijeli dnevnik aktivnosti?')) return;
              setIsClearing(true);
              try {
                await onClearLogs();
              } finally {
                setIsClearing(false);
              }
            }}
            disabled={isClearing}
            className="px-5 py-2.5 text-xs font-bold bg-white text-[#E30613] hover:bg-red-50 rounded-full transition-all border border-red-200 cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {isClearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {isClearing ? 'Pražnjenje...' : 'Isprazni logove'}
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Search */}
        <div className="relative col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži logove po korisniku, detaljima promjene ili ID-u..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs bg-slate-50/30 font-medium"
          />
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">Filter:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold text-slate-700"
          >
            <option value="ALL">Sve akcije</option>
            <option value="KREIRANJE">Kreiranje obaveza</option>
            <option value="IZMJENA">Izmjena podataka</option>
            <option value="BRISANJE">Brisanje obaveza</option>
            <option value="ZAVRŠETAK">Završetak roka</option>
            <option value="UNDO">Opoziv akcija (Undo)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden border border-slate-200 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold text-[10px] uppercase tracking-widest">
                <th className="py-3.5 px-4 w-48">Vrijeme akcije</th>
                <th className="py-3.5 px-4 w-44">Korisnik</th>
                <th className="py-3.5 px-4 w-36">Tip operacije</th>
                <th className="py-3.5 px-4 w-40">Dokument / Tabela</th>
                <th className="py-3.5 px-4">Detalji promjene</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-slate-300" />
                      <span>Nema pronađenih zapisa o aktivnostima za zadane kriterije.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {log.username}
                    </td>
                    <td className="py-3.5 px-4">
                      {getActionBadge(log.action_type)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-mono bg-slate-100/80 border border-slate-200/50 px-2 py-0.5 rounded font-bold uppercase">
                        {log.target_table}
                      </span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-mono">
                        ID: {log.target_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-sans text-xs max-w-sm break-words leading-relaxed">
                      {log.changes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs count footer */}
      <div className="mt-4 text-right text-[10px] font-mono text-slate-400 uppercase tracking-widest">
        Prikazano <span className="font-extrabold text-slate-700">{filteredLogs.length}</span> od ukupno{' '}
        <span className="font-extrabold text-slate-700">{logs.length}</span> zapisa.
      </div>
    </div>
  );
}
