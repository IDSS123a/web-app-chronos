/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Obligation, ChecklistItem, PriorityType, RecurringInterval, InstitutionType, UserSummary, CATEGORY_STYLE_MAP } from '../types';
import { fetchUsers } from '../lib/api-client';
import { getTodayDateString } from '../lib/date-utils';
import { X, Plus, Trash2, HelpCircle, FileText, UploadCloud, AlertTriangle, Eye } from 'lucide-react';

interface ObligationFormProps {
  obligation?: Obligation | null; // If passed, we are in EDIT mode
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Obligation>, attachmentFile?: File | null) => void;
  currentUserId: string;
}

export default function ObligationForm({ obligation, isOpen, onClose, onSubmit, currentUserId }: ObligationFormProps) {
  const isEditMode = !!obligation;

  // Form states
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState<InstitutionType>('IDSS');
  const [category, setCategory] = useState('ADMINISTRACIJA');
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [priority, setPriority] = useState<PriorityType>('SREDNJI');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval>('NONE');

  // Visibility ("watchers") — CONSTITUTION.md §5.7. Only the creator (or
  // SUPER_ADMIN editing) picks who besides themselves/Super Admin can see
  // this obligation — important for financially-sensitive entries.
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchUsers()
      .then(setAvailableUsers)
      .catch((err) => console.error('[ObligationForm] failed to load user list:', err));
  }, [isOpen]);

  // File upload state
  const [attachment, setAttachment] = useState<File | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fill data if in edit mode
  useEffect(() => {
    if (obligation) {
      setTitle(obligation.title);
      setInstitution(obligation.institution);
      setCategory(obligation.category);
      setDueDate(obligation.due_date);
      setResponsiblePerson(obligation.responsible_person);
      setPriority(obligation.priority);
      setChecklist([...obligation.checklist_items]);
      setIsRecurring(obligation.is_recurring);
      setRecurringInterval(obligation.recurring_interval);
      setExistingAttachmentName(obligation.attachment_name || '');
      setAttachment(null);
      setUploadError('');
      setWatcherIds([...obligation.watcher_ids]);
    } else {
      setTitle('');
      setInstitution('IDSS');
      setCategory('ADMINISTRACIJA');
      setDueDate(getTodayDateString());
      setResponsiblePerson('');
      setPriority('SREDNJI');
      setChecklist([]);
      setIsRecurring(false);
      setRecurringInterval('NONE');
      setExistingAttachmentName('');
      setAttachment(null);
      setUploadError('');
      setWatcherIds([]);
    }
    setErrors({});
  }, [obligation, isOpen]);

  if (!isOpen) return null;

  // Handle Checklist additions
  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChecklistItem.trim()) {
      setChecklist([...checklist, { task: newChecklistItem.trim(), done: false }]);
      setNewChecklistItem('');
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const handleToggleChecklistItem = (index: number) => {
    const updated = [...checklist];
    updated[index].done = !updated[index].done;
    setChecklist(updated);
  };

  // Handle File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxLimit = 10 * 1024 * 1024; // 10MB
      
      if (file.size > maxLimit) {
        setUploadError('Priložena datoteka premašuje maksimalni limit od 10MB.');
        return;
      }
      
      setAttachment(file);
      setExistingAttachmentName(''); // override existing if new upload
    }
  };

  // Drag and drop helper
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadError('');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const maxLimit = 10 * 1024 * 1024; // 10MB
      
      if (file.size > maxLimit) {
        setUploadError('Priložena datoteka premašuje maksimalni limit od 10MB.');
        return;
      }
      setAttachment(file);
      setExistingAttachmentName('');
    }
  };

  // Form Submit with built-in PRD validation rules (Section 6.2)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title || title.trim().length < 3) {
      newErrors.title = "Naziv obaveze mora imati najmanje 3 karaktera.";
    }
    if (!['IDSS', 'MONTESSORI'].includes(institution)) {
      newErrors.institution = "Morate odabrati ispravnu ustanovu (IDSS ili IMH).";
    }
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      newErrors.due_date = "Datum dospijeća nije u ispravnom formatu (YYYY-MM-DD).";
    } else {
      const selectedDate = new Date(dueDate);
      if (isNaN(selectedDate.getTime())) {
        newErrors.due_date = "Unijeli ste nepostojeći datum.";
      }
    }
    if (!responsiblePerson || responsiblePerson.trim().length < 2) {
      newErrors.responsible_person = "Morate navesti ime odgovorne osobe.";
    }
    if (!['NIZAK', 'SREDNJI', 'VISOK'].includes(priority)) {
      newErrors.priority = "Prioritet mora biti: NIZAK, SREDNJI ili VISOK.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Partial<Obligation> = {
      title: title.trim(),
      institution,
      category,
      due_date: dueDate,
      responsible_person: responsiblePerson.trim(),
      priority,
      checklist_items: checklist,
      is_recurring: isRecurring,
      recurring_interval: isRecurring ? recurringInterval : 'NONE',
      watcher_ids: watcherIds,
    };

    if (isEditMode && obligation) {
      payload.id = obligation.id;
      payload.status = obligation.status;
    } else {
      payload.status = 'NOVO';
    }

    onSubmit(payload, attachment);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex justify-between items-center">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider font-sans">
              {isEditMode ? 'Izmjena evidentirane obaveze' : 'Unos nove obaveze / roka'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Unesite podatke i osigurajte ispravan format kako bi sistem pokrenuo jutarnji podsjetnik.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* General Errors Alerts */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 text-[#E30613] p-4 rounded-2xl text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-[#E30613]" />
                Molimo ispravite greške u formi:
              </div>
              <ul className="list-disc list-inside mt-1 font-medium">
                {Object.values(errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Title row */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
              Naziv obaveze ili ugovornog roka <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="npr. Produženje ugovora o radu, Registracija vozila, Uplata rate..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-colors text-xs bg-slate-50/40"
            />
            {errors.title && <span className="text-[#E30613] text-[10px] font-bold uppercase mt-1.5 block">{errors.title}</span>}
          </div>

          {/* Institution and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Nadležna ustanova <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInstitution('IDSS')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                    institution === 'IDSS'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  IDSS Škola
                </button>
                <button
                  type="button"
                  onClick={() => setInstitution('MONTESSORI')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                    institution === 'MONTESSORI'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  IMH Vrtić (Montessori)
                </button>
              </div>
              {errors.institution && <span className="text-[#E30613] text-[10px] font-bold uppercase mt-1.5 block">{errors.institution}</span>}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Prioritet obaveze <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['NIZAK', 'SREDNJI', 'VISOK'] as PriorityType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2.5 text-[10px] font-bold rounded-xl border transition-all text-center cursor-pointer uppercase tracking-wider ${
                      priority === p
                        ? p === 'VISOK'
                          ? 'bg-red-600 text-white border-red-600'
                          : p === 'SREDNJI'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {errors.priority && <span className="text-[#E30613] text-[10px] font-bold uppercase mt-1.5 block">{errors.priority}</span>}
            </div>
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Kategorija (Školski kalendar) <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-2xl bg-slate-50/40 font-bold focus:ring-2 focus:ring-amber-500/20 focus:outline-none text-xs text-slate-700"
              >
                {Object.entries(CATEGORY_STYLE_MAP).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Krajnji rok dospijeća <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-colors text-xs bg-slate-50/40"
              />
              {errors.due_date && <span className="text-[#E30613] text-[10px] font-bold uppercase mt-1.5 block">{errors.due_date}</span>}
            </div>
          </div>

          {/* Responsible person */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
              Odgovorna osoba (Uposlenik) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ime i prezime (npr. Sekretar Jasmina, Pedagog Amra...)"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-colors text-xs bg-slate-50/40"
            />
            {errors.responsible_person && (
              <span className="text-[#E30613] text-[10px] font-bold uppercase mt-1.5 block">{errors.responsible_person}</span>
            )}
          </div>

          {/* Visibility / watchers (CONSTITUTION.md §5.7 — financial confidentiality) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ko može vidjeti ovu obavezu</h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Vi i Super Admin uvijek vidite ovu obavezu. Označite kolege koje treba da je prate — finansijski osjetljive obaveze ostavite neoznačene.
            </p>
            {availableUsers.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic">Učitavanje liste korisnika...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {availableUsers
                  .filter((u) => u.role !== 'SUPER_ADMIN' && u.id !== currentUserId)
                  .map((u) => (
                    <label key={u.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watcherIds.includes(u.id)}
                        onChange={() => {
                          setWatcherIds((prev) =>
                            prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className="rounded text-slate-900 focus:ring-slate-900 h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium text-slate-700">{u.fullName}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          {/* Recurring engine setup (Section 5.3) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Automatsko ponavljanje obaveze</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Ponavlja i stvara novu obavezu po završetku ciklusa.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    setIsRecurring(e.target.checked);
                    if (e.target.checked && recurringInterval === 'NONE') {
                      setRecurringInterval('YEARLY');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:width-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>

            {isRecurring && (
              <div className="pt-3 border-t border-slate-200 flex items-center gap-4">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">Interval obnavljanja:</span>
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value as RecurringInterval)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="MONTHLY">Svaki mjesec (Mjesečno)</option>
                  <option value="HALF_YEARLY">Svakih 6 mjeseci (Polugodišnje)</option>
                  <option value="YEARLY">Svake godine (Godišnje)</option>
                </select>
              </div>
            )}
          </div>

          {/* Dynamic Checklist builder (Section 5.3 checklist retention) */}
          <div className="border border-slate-200 rounded-2xl p-4.5 space-y-3 bg-white">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Kontrolna lista pod-zadataka (Checklist)
              <span className="text-[10px] text-slate-400 font-normal normal-case">(Opcionalno)</span>
            </h4>
            
            {/* Checklist items list */}
            {checklist.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklistItem(idx)}
                        className="rounded text-slate-900 focus:ring-slate-900 h-4 w-4"
                      />
                      <span className={`text-xs font-semibold ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {item.task}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Checklist insert row */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Dodaj novu stavku u kontrolnu listu..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newChecklistItem.trim()) {
                      setChecklist([...checklist, { task: newChecklistItem.trim(), done: false }]);
                      setNewChecklistItem('');
                    }
                  }
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (newChecklistItem.trim()) {
                    setChecklist([...checklist, { task: newChecklistItem.trim(), done: false }]);
                    setNewChecklistItem('');
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj
              </button>
            </div>
          </div>

          {/* File attachment box (Accept PDF, DOCX, JPEG up to 10MB) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Prilog dokumenta (Ugovori, polise, rješenja)
            </label>
            
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-slate-900 hover:bg-slate-50/20 transition-all cursor-pointer relative"
            >
              <input
                type="file"
                id="file-upload-input"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Prevucite fajl ovdje ili <span className="text-amber-600 underline hover:text-amber-700">izaberite sa računara</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Podržani formati: PDF, DOCX, JPEG (Maksimalno do 10MB)
              </p>
            </div>

            {/* Display Selected / Existing File */}
            {attachment && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl">
                <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate font-mono">{attachment.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{(attachment.size / (1024 * 1024)).toFixed(2)} MB • Novo za učitavanje</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {existingAttachmentName && !attachment && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate font-mono">{existingAttachmentName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">Postojeći dokument na Google Drive-u</p>
                </div>
                <p className="text-[10px] font-extrabold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">DRIVE LINK</p>
              </div>
            )}

            {uploadError && (
              <span className="text-[#E30613] text-xs font-semibold mt-1 block font-mono uppercase">{uploadError}</span>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="border-t border-slate-100 pt-5 flex justify-end gap-3 font-sans">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest rounded-full transition-all cursor-pointer"
            >
              Odustani
            </button>
            <button
              id="form-submit-button"
              type="submit"
              className="px-8 py-3 bg-slate-900 text-white hover:bg-slate-800 font-extrabold text-xs uppercase tracking-widest rounded-full transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              {isEditMode ? 'Sačuvaj izmjene' : 'Zavedi obavezu'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
