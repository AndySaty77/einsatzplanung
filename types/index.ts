export type MitarbeiterRolle = 'Obermonteur' | 'Monteur' | 'Azubi' | 'Helfer' | 'Lager' | 'Kundendienst' | 'Elektriker';

export type ProjektStatus = 'geplant' | 'aktiv' | 'abgeschlossen' | 'pausiert';

export type AbwesenheitTyp = 'Urlaub' | 'Elternzeit' | 'Schule' | 'Krank' | 'Ausgeschieden' | 'Sonstiges';

export interface Mitarbeiter {
  id: string;
  name: string;
  rolle: MitarbeiterRolle;
  aktiv: boolean;
  email: string | null;
  erstellt_am: string;
}

export interface Projekt {
  id: string;
  name: string;
  auftraggeber: string | null;
  volumen: number | null;
  stunden_geplant: number | null;
  fertigstellung_prozent: number;
  startdatum: string | null;
  enddatum: string | null;
  status: ProjektStatus;
  farbe: string;
  notizen: string | null;
  ist_arbeitsvorrat: boolean;
  erstellt_am: string;
  aktualisiert_am: string;
}

export interface Einplanung {
  id: string;
  mitarbeiter_id: string;
  projekt_id: string;
  woche_start: string; // ISO date string (Monday)
  bestaetigt: boolean;
  notiz: string | null;
  erstellt_am: string;
  // joined
  projekt?: Projekt;
  mitarbeiter?: Mitarbeiter;
}

export interface Abwesenheit {
  id: string;
  mitarbeiter_id: string;
  typ: AbwesenheitTyp;
  woche_start: string;
  woche_ende: string | null;
  notiz: string | null;
  // joined
  mitarbeiter?: Mitarbeiter;
}

export interface Meister {
  id: string;
  name: string;
  aktiv: boolean;
}

export interface ProjektMeister {
  projekt_id: string;
  meister_id: string;
  meister?: Meister;
}

// Planungsboard cell state per employee per week
export interface PlanungsZelle {
  mitarbeiter: Mitarbeiter;
  wocheStart: string;
  einplanung: Einplanung | null;
  abwesenheit: Abwesenheit | null;
}

// Week info for board header
export interface KalenderWoche {
  wocheStart: string; // Monday ISO
  kw: number;
  monat: string;
  jahr: number;
}
