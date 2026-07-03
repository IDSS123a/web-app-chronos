/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'SUPER_ADMIN' | 'STANDARD_USER';
export type InstitutionType = 'IDSS' | 'MONTESSORI';
export type PriorityType = 'NIZAK' | 'SREDNJI' | 'VISOK';
export type ObligationStatus = 'NOVO' | 'U_TOKU' | 'ZAVRŠENO';
export type RecurringInterval = 'NONE' | 'MONTHLY' | 'HALF_YEARLY' | 'YEARLY';

export interface User {
  id: string;
  username: string; // e.g., direktor@idss.ba, sekretar@idss.ba
  fullName: string;
  role: UserRole;
  institution: InstitutionType | 'BOTH';
}

export interface ChecklistItem {
  task: string;
  done: boolean;
}

export interface Obligation {
  id: string;
  title: string;
  institution: InstitutionType;
  category: string; // 'NERADNI_DAN' | 'DOGAĐAJ' | 'RASPUST' | 'NENASTAVNI_DAN' | 'PROJEKT' | 'ADMINISTRACIJA'
  due_date: string; // YYYY-MM-DD
  responsible_person: string;
  priority: PriorityType;
  status: ObligationStatus;
  checklist_items: ChecklistItem[];
  attachment_url: string;
  attachment_name?: string;
  is_recurring: boolean;
  recurring_interval: RecurringInterval;
  created_by: string; // User ID
  created_at: string; // ISO String
  updated_at: string; // ISO String
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO String
  username: string;
  action_type: 'KREIRANJE' | 'IZMJENA' | 'BRISANJE' | 'ZAVRŠETAK' | 'UNDO';
  target_table: 'Obligations' | 'Users';
  target_id: string;
  changes: string; // Describe what changed, or simple text
}

export interface CategoryInfo {
  label: string;
  bgClass: string;
  dotClass: string;
  hex: string;
  borderClass: string;
  textClass: string;
}

export const CATEGORY_STYLE_MAP: Record<string, CategoryInfo> = {
  'NERADNI_DAN': {
    label: 'Neradni dan (Praznik)',
    bgClass: 'bg-orange-50 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
    hex: '#FF8A00',
    borderClass: 'border-orange-300',
    textClass: 'text-orange-800'
  },
  'DOGAĐAJ': {
    label: 'Školski događaj / Priredba',
    bgClass: 'bg-yellow-50 text-yellow-950 border-yellow-200',
    dotClass: 'bg-yellow-500',
    hex: '#FFCB29',
    borderClass: 'border-yellow-300',
    textClass: 'text-yellow-950'
  },
  'RASPUST': {
    label: 'Školski raspust / Holidays',
    bgClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-400',
    hex: '#08ABE6',
    borderClass: 'border-sky-300',
    textClass: 'text-sky-800'
  },
  'NENASTAVNI_DAN': {
    label: 'Nenastavni dan / Priprema',
    bgClass: 'bg-blue-50 text-blue-900 border-blue-200',
    dotClass: 'bg-blue-700',
    hex: '#035EA1',
    borderClass: 'border-blue-300',
    textClass: 'text-blue-900'
  },
  'PROJEKT': {
    label: 'Projektna sedmica / Ljetna škola',
    bgClass: 'bg-red-50 text-red-800 border-red-200',
    dotClass: 'bg-red-600',
    hex: '#E30613',
    borderClass: 'border-red-300',
    textClass: 'text-red-800'
  },
  'ADMINISTRACIJA': {
    label: 'Administrativni / Zakonski rok',
    bgClass: 'bg-slate-50 text-slate-800 border-slate-200',
    dotClass: 'bg-slate-500',
    hex: '#7F8C8D',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-800'
  }
};
