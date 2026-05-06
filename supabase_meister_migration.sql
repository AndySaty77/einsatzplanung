-- ============================================================
-- Migration: Meister-Tabellen
-- Ausführen in: Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS meister (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  aktiv   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ep_projekt_meister (
  projekt_id  UUID NOT NULL REFERENCES ep_projekte(id) ON DELETE CASCADE,
  meister_id  UUID NOT NULL REFERENCES meister(id) ON DELETE CASCADE,
  PRIMARY KEY (projekt_id, meister_id)
);

-- RLS
ALTER TABLE meister           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ep_projekt_meister ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_meister"            ON meister            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_ep_projekt_meister" ON ep_projekt_meister FOR ALL TO anon USING (true) WITH CHECK (true);

-- Meister-Stammdaten
INSERT INTO meister (name) VALUES
  ('Mike Kempf'),
  ('Thomas Teiz'),
  ('Muharrem Yapar'),
  ('Pascal Kaliska'),
  ('Lukas Bothor');
