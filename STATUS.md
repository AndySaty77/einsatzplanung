# Einsatzplanung – Projektstatus

**Letzter Stand:** 2026-05-06
**Aktuelle Phase:** Phase 1 abgeschlossen ✅ – Build grün, Supabase-Verbindung ausstehend

---

## Projektbeschreibung

Web-Tool zur Monteur-Einsatzplanung für Herbstritt Haustechnik GmbH.  
Ersatz der Excel-Datei `import/Einsatzplanung_V1.xlsx`.  
Fokus: Monteure (keine KD-Techniker).

**Stack:** Next.js 16 (Turbopack) + TypeScript + Supabase + Vercel

---

## Nächste Schritte (vor erstem Start)

### 1. Neues Supabase-Projekt anlegen
- Auf https://supabase.com → New Project
- Name: `einsatzplanung`
- SQL-Schema ausführen: `supabase_schema.sql` (im Projektordner)

### 2. .env.local befüllen
```
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=XXXX
```

### 3. GitHub + Vercel
- Neues GitHub-Repo anlegen: `einsatzplanung`
- Vercel importieren → Env-Vars setzen → Deploy

---

## Fertige Features (Phase 1)

### Planungsboard (`/planung`)
- KW-Blockansicht (horizontal: KW, vertikal: Mitarbeiter)
- Monatsgruppen-Header + KW-Nummer-Zeile
- Auslastungszeile (Ampel grün/orange/rot)
- Sticky Name- und Rollenspalten beim horizontalen Scrollen
- Farbige Projekt-Zellen (bestätigt = voll, Platzhalter = transparent + gestrichelt)
- Abwesenheiten farbig dargestellt (Urlaub, Elternzeit, Schule, ...)
- Klick auf Zelle → Modal zum Einplanen/Ändern/Entfernen
- Jahresnavigation (‹ Jahr ›)
- Mitarbeiter sortiert nach Rolle (Obermonteur → Monteur → Azubi → Helfer → Lager)

### Projekte (`/projekte`)
- Karten-Ansicht mit Farbstreifen
- Filter nach Status (Geplant / Aktiv / Abgeschlossen / Pausiert)
- Fortschrittsbalken (Fertigstellung %)
- Vollständiges CRUD-Modal:
  - Name, Auftraggeber, Volumen (€), geplante Stunden
  - Start-/Enddatum
  - Status-Auswahl
  - Farbwähler (10 Farben)
  - Notizen
- Löschen mit Bestätigungsdialog

### Mitarbeiter (`/mitarbeiter`)
- Gruppiert nach Rolle
- CRUD-Modal (Name, Rolle, E-Mail für spätere Outlook-Integration)
- Abwesenheits-Verwaltung direkt je Mitarbeiter (+ Anzeige im Board)
- Deaktivieren statt hartes Löschen

---

## Offene Punkte (Phase 2+)

- **Auto-Platzhalter:** Projekt anlegen mit Start/End/Techniker-Anzahl → KW-Blöcke automatisch erzeugen
- **Abwesenheits-Verwaltung im Board:** Direkt aus Planungsboard heraus Urlaub eintragen
- **Outlook-Integration:** Microsoft Graph API → direkt in Kalender der Techniker schreiben
- **Dashboard:** Auslastungsübersicht, offene Projekte, freie Kapazitäten
- **GitHub-Repo:** Noch nicht erstellt
- **Vercel-Deployment:** Noch nicht eingerichtet

---

## Dateistruktur

```
/
├── app/
│   ├── layout.tsx              ← Root-Layout + Sidebar
│   ├── page.tsx                ← Redirect → /planung
│   ├── globals.css             ← Dark-Theme CSS-Variablen
│   ├── planung/page.tsx        ← Planungsboard (Hauptansicht)
│   ├── projekte/page.tsx       ← Projektverwaltung
│   └── mitarbeiter/page.tsx   ← Mitarbeiterverwaltung
├── components/
│   ├── layout/Sidebar.tsx      ← Navigation
│   └── planung/
│       ├── PlanungsBoard.tsx   ← Board-Tabelle
│       └── EinplanungsModal.tsx← Einplanungs-Dialog
├── lib/
│   ├── supabase.ts             ← Supabase-Client + alle CRUD-Funktionen
│   └── kalender.ts             ← KW-Berechnung, Datum-Hilfsfunktionen
├── types/index.ts              ← TypeScript-Interfaces
├── supabase_schema.sql         ← Komplettes DB-Schema + Beispieldaten
└── .env.local                  ← Supabase-Keys (nicht in Git!)
```

---

## Datenbankschema (Supabase)

```
mitarbeiter:    id, name, rolle, aktiv, email
projekte:       id, name, auftraggeber, volumen, stunden_geplant,
                fertigstellung_prozent, startdatum, enddatum,
                status, farbe, notizen
einplanungen:   id, mitarbeiter_id, projekt_id, woche_start, bestaetigt, notiz
                UNIQUE(mitarbeiter_id, woche_start)
abwesenheiten:  id, mitarbeiter_id, typ, woche_start, woche_ende, notiz
```

---

## Arbeitsweise

- STATUS.md zu Beginn jeder Session lesen
- Build vor Push: `npm run build`
- KD-Techniker (Kundendienst) werden NICHT in diesem Tool verwaltet
- Excel-Quelle: `/root/import/Einsatzplanung_V1.xlsx`
