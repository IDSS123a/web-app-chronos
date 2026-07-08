/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Obligation } from '../types';

// NOTE: mock users were removed here — real accounts now live in Supabase
// Auth, seeded via `npm run seed` (scripts/seed-users.ts). See CONSTITUTION.md.

export const INITIAL_OBLIGATIONS: Obligation[] = [
  {
    id: 'obl_test_001',
    title: 'Prvi dan škole - Početak školske godine',
    institution: 'IDSS',
    category: 'DOGAĐAJ',
    due_date: '2026-09-01',
    responsible_person: 'Uprava škole',
    priority: 'SREDNJI',
    status: 'NOVO',
    checklist_items: [],
    attachment_url: '',
    is_recurring: false,
    recurring_interval: 'NONE',
    created_by: 'usr_001',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_002',
    title: 'Državni praznik - Dan državnosti BiH',
    institution: 'IDSS',
    category: 'NERADNI_DAN',
    due_date: '2026-11-25',
    responsible_person: 'Dežurno osoblje',
    priority: 'VISOK',
    status: 'NOVO',
    checklist_items: [],
    attachment_url: '',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_001',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_003',
    title: 'Obnova licenci za rad vaspitačica u vrtiću',
    institution: 'MONTESSORI',
    category: 'ADMINISTRACIJA',
    due_date: '2026-10-10',
    responsible_person: 'Sekretar Jasmina',
    priority: 'VISOK',
    status: 'U_TOKU',
    checklist_items: [
      { task: 'Prikupiti diplome uposlenika', done: true },
      { task: 'Predati zahtjev u ministarstvo obrazovanja', done: false }
    ],
    attachment_url: 'https://drive.google.com/open?id=1example_drive_link',
    attachment_name: 'licence_vaspitacica_2026.pdf',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_002',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_004',
    title: 'Godišnji ljekarski pregled osoblja IDSS & IMH',
    institution: 'IDSS',
    category: 'ADMINISTRACIJA',
    due_date: '2026-07-05',
    responsible_person: 'Pedagog Amra',
    priority: 'VISOK',
    status: 'U_TOKU',
    checklist_items: [
      { task: 'Ugovoriti termin u poliklinici', done: true },
      { task: 'Podijeliti uputnice zaposlenicima', done: true },
      { task: 'Prikupiti ljekarska uvjerenja', done: false }
    ],
    attachment_url: 'https://drive.google.com/open?id=2example_drive_link',
    attachment_name: 'ugovor_poliklinika_2026.pdf',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_002',
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_005',
    title: 'Registracija školskog kombija IDSS',
    institution: 'IDSS',
    category: 'ADMINISTRACIJA',
    due_date: '2026-07-15',
    responsible_person: 'Sekretar Jasmina',
    priority: 'VISOK',
    status: 'NOVO',
    checklist_items: [
      { task: 'Tehnički pregled vozila', done: false },
      { task: 'Uplata osiguranja', done: false },
      { task: 'Preuzimanje saobraćajne dozvole', done: false }
    ],
    attachment_url: '',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_002',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_006',
    title: 'Uplata rate zakupa za prostorije IMH',
    institution: 'MONTESSORI',
    category: 'ADMINISTRACIJA',
    due_date: '2026-07-10',
    responsible_person: 'Računovođa Edin',
    priority: 'VISOK',
    status: 'U_TOKU',
    checklist_items: [
      { task: 'Provjera fakture najmodavca', done: true },
      { task: 'Slanje naloga za plaćanje banci', done: false }
    ],
    attachment_url: '',
    is_recurring: true,
    recurring_interval: 'MONTHLY',
    created_by: 'usr_003',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_007',
    title: 'Roditeljski sastanak - Početak godine',
    institution: 'MONTESSORI',
    category: 'DOGAĐAJ',
    due_date: '2026-09-05',
    responsible_person: 'Vaspitačica Selma',
    priority: 'SREDNJI',
    status: 'NOVO',
    checklist_items: [],
    attachment_url: '',
    is_recurring: false,
    recurring_interval: 'NONE',
    created_by: 'usr_001',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_008',
    title: 'Projektna sedmica "Zelena planeta"',
    institution: 'IDSS',
    category: 'PROJEKT',
    due_date: '2026-10-15',
    responsible_person: 'Nastavnik Haris',
    priority: 'SREDNJI',
    status: 'NOVO',
    checklist_items: [
      { task: 'Priprema materijala za radionice', done: false },
      { task: 'Poziv gostujućim predavačima', done: false }
    ],
    attachment_url: '',
    is_recurring: false,
    recurring_interval: 'NONE',
    created_by: 'usr_001',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  },
  {
    id: 'obl_test_009',
    title: 'Istekla licenca PP zaštite objekta IMH',
    institution: 'MONTESSORI',
    category: 'ADMINISTRACIJA',
    due_date: '2026-06-15',
    responsible_person: 'Sekretar Jasmina',
    priority: 'VISOK',
    status: 'NOVO',
    checklist_items: [
      { task: 'Izlazak servisera na teren', done: false },
      { task: 'Izdavanje novog atesta', done: false }
    ],
    attachment_url: '',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_002',
    created_at: '2026-06-01T08:00:00Z',
    updated_at: '2026-06-01T08:00:00Z'
  },
  {
    id: 'obl_test_010',
    title: 'Godišnji izvještaj o radu za Ministarstvo',
    institution: 'IDSS',
    category: 'ADMINISTRACIJA',
    due_date: '2026-09-30',
    responsible_person: 'Direktor',
    priority: 'VISOK',
    status: 'NOVO',
    checklist_items: [
      { task: 'Prikupljanje izvještaja nastavnika', done: false },
      { task: 'Statistika uspjeha i vladanja', done: false },
      { task: 'Slanje u Ministarstvo za odgoj i obrazovanje', done: false }
    ],
    attachment_url: '',
    is_recurring: true,
    recurring_interval: 'YEARLY',
    created_by: 'usr_001',
    created_at: '2026-07-02T08:00:00Z',
    updated_at: '2026-07-02T08:00:00Z'
  }
];
