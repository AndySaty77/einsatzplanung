import { createClient } from '@supabase/supabase-js';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, Meister } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Mitarbeiter ──────────────────────────────────────────────

export async function getMitarbeiter(): Promise<Mitarbeiter[]> {
  const { data, error } = await supabase
    .from('mitarbeiter')
    .select('*')
    .eq('aktiv', true)
    .order('rolle')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createMitarbeiter(
  m: Omit<Mitarbeiter, 'id' | 'erstellt_am'>
): Promise<Mitarbeiter> {
  const { data, error } = await supabase.from('mitarbeiter').insert(m).select().single();
  if (error) throw error;
  return data;
}

export async function updateMitarbeiter(
  id: string,
  m: Partial<Omit<Mitarbeiter, 'id' | 'erstellt_am'>>
): Promise<Mitarbeiter> {
  const { data, error } = await supabase.from('mitarbeiter').update(m).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMitarbeiter(id: string): Promise<void> {
  const { error } = await supabase.from('mitarbeiter').update({ aktiv: false }).eq('id', id);
  if (error) throw error;
}

// ── Projekte ─────────────────────────────────────────────────

export async function getProjekte(): Promise<Projekt[]> {
  const { data, error } = await supabase
    .from('ep_projekte')
    .select('*')
    .order('startdatum', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProjekt(
  p: Omit<Projekt, 'id' | 'erstellt_am' | 'aktualisiert_am'>
): Promise<Projekt> {
  const { data, error } = await supabase.from('ep_projekte').insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updateProjekt(
  id: string,
  p: Partial<Omit<Projekt, 'id' | 'erstellt_am' | 'aktualisiert_am'>>
): Promise<Projekt> {
  const { data, error } = await supabase
    .from('ep_projekte')
    .update({ ...p, aktualisiert_am: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjekt(id: string): Promise<void> {
  const { error } = await supabase.from('ep_projekte').delete().eq('id', id);
  if (error) throw error;
}

// ── Einplanungen ─────────────────────────────────────────────

export async function getEinplanungen(
  vonDatum: string,
  bisDatum: string
): Promise<Einplanung[]> {
  const { data, error } = await supabase
    .from('einplanungen')
    .select('*, projekt:ep_projekte!projekt_id(*), mitarbeiter:mitarbeiter!mitarbeiter_id(*)')
    .gte('woche_start', vonDatum)
    .lte('woche_start', bisDatum);
  if (error) throw error;
  return data ?? [];
}

export async function upsertEinplanung(
  e: Omit<Einplanung, 'id' | 'erstellt_am' | 'projekt' | 'mitarbeiter'>
): Promise<Einplanung> {
  const { data, error } = await supabase
    .from('einplanungen')
    .upsert(e, { onConflict: 'mitarbeiter_id,woche_start' })
    .select('*, projekt:ep_projekte!projekt_id(*), mitarbeiter:mitarbeiter!mitarbeiter_id(*)')
    .single();
  if (error) throw error;
  return data;
}

// Bulk-Einplanung: mehrere Mitarbeiter × mehrere KWs auf einmal
export async function bulkUpsertEinplanungen(
  entries: Omit<Einplanung, 'id' | 'erstellt_am' | 'projekt' | 'mitarbeiter'>[]
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase
    .from('einplanungen')
    .upsert(entries, { onConflict: 'mitarbeiter_id,woche_start' });
  if (error) throw error;
}

export async function deleteEinplanung(id: string): Promise<void> {
  const { error } = await supabase.from('einplanungen').delete().eq('id', id);
  if (error) throw error;
}

export async function moveEinplanung(
  id: string,
  newMitarbeiterId: string,
  newWocheStart: string
): Promise<void> {
  const { error } = await supabase
    .from('einplanungen')
    .update({ mitarbeiter_id: newMitarbeiterId, woche_start: newWocheStart })
    .eq('id', id);
  if (error) throw error;
}

// ── Abwesenheiten ─────────────────────────────────────────────

export async function getAbwesenheiten(
  vonDatum: string,
  bisDatum: string
): Promise<Abwesenheit[]> {
  const { data, error } = await supabase
    .from('abwesenheiten')
    .select('*, mitarbeiter:mitarbeiter(*)')
    .gte('woche_start', vonDatum)
    .lte('woche_start', bisDatum);
  if (error) throw error;
  return data ?? [];
}

export async function createAbwesenheit(
  a: Omit<Abwesenheit, 'id' | 'mitarbeiter'>
): Promise<Abwesenheit> {
  const { data, error } = await supabase.from('abwesenheiten').insert(a).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAbwesenheit(id: string): Promise<void> {
  const { error } = await supabase.from('abwesenheiten').delete().eq('id', id);
  if (error) throw error;
}

// ── Meister ──────────────────────────────────────────────────

export async function getMeister(): Promise<Meister[]> {
  const { data, error } = await supabase
    .from('meister')
    .select('*')
    .eq('aktiv', true)
    .order('name');
  if (error) throw error;
  // Deduplicate by ID (safety net for DB duplicates)
  const seen = new Set<string>();
  return (data ?? []).filter(m => seen.has(m.id) ? false : (seen.add(m.id), true));
}

export async function getMeisterFuerProjekt(projektId: string): Promise<Meister[]> {
  const { data, error } = await supabase
    .from('ep_projekt_meister')
    .select('meister:meister(*)')
    .eq('projekt_id', projektId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.meister as unknown as Meister).filter(Boolean);
}

export async function setMeisterFuerProjekt(
  projektId: string,
  meisterIds: string[]
): Promise<void> {
  // Alle bisherigen löschen, dann neu setzen
  const { error: delErr } = await supabase
    .from('ep_projekt_meister')
    .delete()
    .eq('projekt_id', projektId);
  if (delErr) throw delErr;

  if (meisterIds.length === 0) return;
  const { error: insErr } = await supabase
    .from('ep_projekt_meister')
    .insert(meisterIds.map(meister_id => ({ projekt_id: projektId, meister_id })));
  if (insErr) throw insErr;
}

export async function getAlleProjektMeister(): Promise<Record<string, Meister[]>> {
  const { data, error } = await supabase
    .from('ep_projekt_meister')
    .select('projekt_id, meister:meister(*)');
  if (error) throw error;
  const result: Record<string, Meister[]> = {};
  for (const row of data ?? []) {
    if (!result[row.projekt_id]) result[row.projekt_id] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = row.meister as unknown as Meister;
    if (m && !result[row.projekt_id].some(x => x.id === m.id))
      result[row.projekt_id].push(m);
  }
  return result;
}
