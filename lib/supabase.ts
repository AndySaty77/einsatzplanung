import { createClient } from '@supabase/supabase-js';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit } from '@/types';

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
