-- ============================================================
-- Einsatzplanung – Supabase Schema
-- Ausführen in: Supabase > SQL Editor
-- ============================================================

-- Mitarbeiter (nur Monteure, keine KD-Techniker)
CREATE TABLE IF NOT EXISTS mitarbeiter (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  rolle        TEXT NOT NULL CHECK (rolle IN ('Obermonteur','Monteur','Azubi','Helfer','Lager')),
  aktiv        BOOLEAN NOT NULL DEFAULT true,
  email        TEXT,
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projekte (ep_ Präfix wegen gleichnamiger Tabelle im DB-Rechner)
CREATE TABLE IF NOT EXISTS ep_projekte (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  auftraggeber          TEXT,
  volumen               NUMERIC(12,2),
  stunden_geplant       INTEGER,
  fertigstellung_prozent INTEGER NOT NULL DEFAULT 0 CHECK (fertigstellung_prozent BETWEEN 0 AND 100),
  startdatum            DATE,
  enddatum              DATE,
  status                TEXT NOT NULL DEFAULT 'geplant'
                          CHECK (status IN ('geplant','aktiv','abgeschlossen','pausiert')),
  farbe                 TEXT NOT NULL DEFAULT '#3b82f6',
  notizen               TEXT,
  erstellt_am           TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Einplanungen: 1 Mitarbeiter → 1 Projekt → 1 KW-Block (Montag als Referenz)
CREATE TABLE IF NOT EXISTS einplanungen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id  UUID NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  projekt_id      UUID NOT NULL REFERENCES ep_projekte(id) ON DELETE CASCADE,
  woche_start     DATE NOT NULL,  -- immer der Montag der KW
  bestaetigt      BOOLEAN NOT NULL DEFAULT false,
  notiz           TEXT,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mitarbeiter_id, woche_start)   -- 1 Techniker = 1 Projekt pro Woche
);

-- Abwesenheiten (Urlaub, Elternzeit, Schule, ...)
CREATE TABLE IF NOT EXISTS abwesenheiten (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id  UUID NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  typ             TEXT NOT NULL
                    CHECK (typ IN ('Urlaub','Elternzeit','Schule','Krank','Ausgeschieden','Sonstiges')),
  woche_start     DATE NOT NULL,
  woche_ende      DATE,           -- NULL = nur diese eine Woche
  notiz           TEXT
);

-- ── Indizes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_einplanungen_woche   ON einplanungen(woche_start);
CREATE INDEX IF NOT EXISTS idx_einplanungen_ma      ON einplanungen(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_ep_einplanungen_proj ON einplanungen(projekt_id);
CREATE INDEX IF NOT EXISTS idx_abwesenheiten_ma     ON abwesenheiten(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_abwesenheiten_woche  ON abwesenheiten(woche_start);

-- ── Row Level Security (RLS) ──────────────────────────────────
ALTER TABLE mitarbeiter   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ep_projekte   ENABLE ROW LEVEL SECURITY;
ALTER TABLE einplanungen  ENABLE ROW LEVEL SECURITY;
ALTER TABLE abwesenheiten ENABLE ROW LEVEL SECURITY;

-- Temporär: anon darf alles lesen + schreiben (Auth später ergänzen)
CREATE POLICY "anon_all_mitarbeiter"   ON mitarbeiter   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_ep_projekte"   ON ep_projekte   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_einplanungen"  ON einplanungen  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_abwesenheiten" ON abwesenheiten FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Beispieldaten (aus Excel-Datei) ──────────────────────────
INSERT INTO mitarbeiter (name, rolle) VALUES
  ('Mirco Mattmüller',    'Obermonteur'),
  ('Jan Schubert',        'Monteur'),
  ('Roland Poock',        'Obermonteur'),
  ('Torbjörn Heinsinger', 'Obermonteur'),
  ('Uwe Hampe',           'Monteur'),
  ('Jean C. Wenck',       'Obermonteur'),
  ('Agron Gacaferi',      'Monteur'),
  ('Eduard Zakarov',      'Obermonteur'),
  ('Tomaz Zawicki',       'Monteur'),
  ('Nicolai Payursin',    'Monteur'),
  ('Pascal Sohm',         'Lager'),
  ('Udo Scharr',          'Lager'),
  ('Saleh',               'Azubi'),
  ('Luka',                'Helfer'),
  ('Leiharbeiter',        'Helfer');
