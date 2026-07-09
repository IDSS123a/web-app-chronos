/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Obligation, CATEGORY_STYLE_MAP } from '../types';
import { formatDateLocal } from '../lib/date-utils';

interface PrintTemplateProps {
  obligations: Obligation[];
  institutionFilter: 'BOTH' | 'IDSS' | 'MONTESSORI';
  dateRange: { startDate: string; endDate: string };
}

export default function PrintTemplate({ obligations, institutionFilter, dateRange }: PrintTemplateProps) {
  const getInstitutionLabel = () => {
    if (institutionFilter === 'IDSS') return 'Internationale Deutsche Schule Sarajevo (IDSS)';
    if (institutionFilter === 'MONTESSORI') return 'International Montessori House Sarajevo (IMH)';
    return 'IDSS i IMH - Zajednička administracija';
  };

  const getPriorityLabel = (priority: string) => {
    return priority;
  };

  const formatDateBosnian = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}.`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="print-section" className="hidden print:block p-8 bg-white text-black font-serif max-w-[21cm] mx-auto">
      {/* Unified Memorandum Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 font-sans">
              CHRONOS • REGISTAR ROKOVA I OBAVEZA
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-1">
              Internationale Deutsche Schule Sarajevo & International Montessori House
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-sans">
            <div>Datum izvještaja: {formatDateLocal(new Date()).split('-').reverse().join('.')}.</div>
            <div>Centralni sistem: idsssarajevo@gmail.com</div>
          </div>
        </div>
      </div>

      {/* Report Info */}
      <div className="mb-6 font-sans">
        <h2 className="text-base font-bold text-slate-800">
          ZVANIČNI IZVJEŠTAJ O ROKOVIMA I OBAVEZAMA
        </h2>
        <div className="mt-2 text-sm grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
          <div>
            <span className="text-slate-500 text-xs block">Odabrana ustanova:</span>
            <span className="font-semibold text-slate-800">{getInstitutionLabel()}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs block">Vremenski period:</span>
            <span className="font-semibold text-slate-800">
              {dateRange.startDate ? formatDateBosnian(dateRange.startDate) : 'Sve'} -{' '}
              {dateRange.endDate ? formatDateBosnian(dateRange.endDate) : 'Sve'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabela obaveza */}
      <table className="w-full text-left border-collapse text-xs mb-10 font-sans">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-300">
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 text-center w-8">R.b.</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800">Naziv obaveze / Rok</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-24">Ustanova</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-28">Kategorija</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-24">Rok dospijeća</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-28">Odgovorna osoba</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-16 text-center">Prioritet</th>
            <th className="py-2.5 px-2 border border-slate-300 font-bold text-slate-800 w-16 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {obligations.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400 border border-slate-300">
                Nema evidentiranih obaveza za zadane kriterije.
              </td>
            </tr>
          ) : (
            obligations.map((obl, idx) => {
              const catInfo = CATEGORY_STYLE_MAP[obl.category] || { label: obl.category };
              const isExpired = new Date(obl.due_date) < new Date() && obl.status !== 'ZAVRŠENO';
              return (
                <tr key={obl.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-2 px-2 border border-slate-200 text-center text-slate-600">{idx + 1}</td>
                  <td className="py-2 px-2 border border-slate-200 font-medium">
                    <div>{obl.title}</div>
                    {obl.checklist_items.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Kontrolna lista:{' '}
                        {obl.checklist_items.filter((c) => c.done).length}/
                        {obl.checklist_items.length} stavki završeno
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 border border-slate-200">
                    <span className="font-semibold text-[10px]">
                      {obl.institution === 'IDSS' ? 'IDSS Škola' : 'IMH Vrtić'}
                    </span>
                  </td>
                  <td className="py-2 px-2 border border-slate-200 text-[11px]">
                    {catInfo.label}
                  </td>
                  <td className={`py-2 px-2 border border-slate-200 font-medium ${isExpired ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                    {formatDateBosnian(obl.due_date)}
                    {isExpired && <span className="block text-[8px] uppercase tracking-wide text-red-600">ISTEKLO!</span>}
                  </td>
                  <td className="py-2 px-2 border border-slate-200">{obl.responsible_person}</td>
                  <td className="py-2 px-2 border border-slate-200 text-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      obl.priority === 'VISOK' ? 'bg-red-100 text-red-800' :
                      obl.priority === 'SREDNJI' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {getPriorityLabel(obl.priority)}
                    </span>
                  </td>
                  <td className="py-2 px-2 border border-slate-200 text-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      obl.status === 'ZAVRŠENO' ? 'bg-green-100 text-green-800' :
                      obl.status === 'U_TOKU' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {obl.status}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Signature Box Section */}
      <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between font-sans">
        <div className="text-center w-48">
          <div className="border-b border-black h-10 w-full mb-2"></div>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Potpis odgovorne osobe</p>
          <p className="text-[9px] text-slate-400">Sekretarijat / Računovodstvo</p>
        </div>
        
        <div className="text-center w-48">
          <div className="border-b border-black h-10 w-full mb-2"></div>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Direktor / Upravitelj</p>
          <p className="text-[9px] text-slate-400">Internationale Deutsche Schule</p>
        </div>
      </div>

      <div className="mt-12 text-center text-[9px] text-slate-400 font-sans">
        Dokument je generisan automatski kroz zaštićenu sesiju sistema Chronos.
      </div>
    </div>
  );
}
