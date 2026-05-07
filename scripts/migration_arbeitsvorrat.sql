-- Migration: Arbeitsvorrat-Flag + Meister-Deduplizierung + Kundendienst-Rolle
-- Im Supabase SQL Editor ausführen

-- 0. Mitarbeiter-Rolle CHECK constraint erweitern (Kundendienst + Elektriker)
ALTER TABLE mitarbeiter DROP CONSTRAINT IF EXISTS mitarbeiter_rolle_check;
ALTER TABLE mitarbeiter ADD CONSTRAINT mitarbeiter_rolle_check
  CHECK (rolle IN ('Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager', 'Kundendienst', 'Elektriker'));

-- 1. Spalte hinzufügen (idempotent)
ALTER TABLE ep_projekte
  ADD COLUMN IF NOT EXISTS ist_arbeitsvorrat boolean NOT NULL DEFAULT false;

-- 2. Bestehende Backlog-Projekte markieren
UPDATE ep_projekte
  SET ist_arbeitsvorrat = true
  WHERE name IN ('Allgeier Mängel', 'JVA', 'Emminghaus', 'Psychiatrie', 'Rebland');

-- 3. Doppelte Meister-Referenzen in ep_projekt_meister entfernen
--    (zeigt auf doppelte meister-Einträge → erst diese Refs löschen)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
  FROM meister
)
DELETE FROM ep_projekt_meister
WHERE meister_id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4. Doppelte Meister-Zeilen löschen (jeweils niedrigste ID behalten)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
  FROM meister
)
DELETE FROM meister
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
