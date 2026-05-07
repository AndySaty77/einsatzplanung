'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Mitarbeiter, MitarbeiterRolle, AbwesenheitTyp } from '@/types';
import {
  getMitarbeiter, createMitarbeiter, updateMitarbeiter, deleteMitarbeiter,
  getAbwesenheiten, createAbwesenheit, deleteAbwesenheit,
} from '@/lib/supabase';
import type { Abwesenheit } from '@/types';
import { toISODate, getMontag } from '@/lib/kalender';

const ROLLEN: MitarbeiterRolle[] = ['Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager', 'Kundendienst', 'Elektriker'];
const ABW_TYPEN: AbwesenheitTyp[] = ['Urlaub', 'Elternzeit', 'Schule', 'Krank', 'Ausgeschieden', 'Sonstiges'];

const ROLLEN_FARBE: Record<MitarbeiterRolle, string> = {
  Obermonteur:  '#1e40af',
  Monteur:      '#065f46',
  Azubi:        '#4c1d95',
  Helfer:       '#78350f',
  Lager:        '#374151',
  Kundendienst: '#92400e',
  Elektriker:   '#1e3a5f',
};

const LEER_MA = { name: '', rolle: 'Monteur' as MitarbeiterRolle, aktiv: true, email: null as string | null };

export default function MitarbeiterPage() {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'neu' | Mitarbeiter | null>(null);
  const [form, setForm] = useState({ ...LEER_MA });
  const [saving, setSaving] = useState(false);
  const [abwModal, setAbwModal] = useState<Mitarbeiter | null>(null);
  const [abwForm, setAbwForm] = useState({ typ: 'Urlaub' as AbwesenheitTyp, woche_start: '', woche_ende: '', notiz: '' });

  const lade = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ma = await getMitarbeiter();
      setMitarbeiter(ma);
      const year = new Date().getFullYear();
      const von = toISODate(getMontag(new Date(year, 0, 1)));
      const bis = toISODate(getMontag(new Date(year + 1, 11, 31)));
      const abw = await getAbwesenheiten(von, bis);
      setAbwesenheiten(abw);
    } catch (e) {
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { lade(); }, [lade]);

  const openNeu = () => { setForm({ ...LEER_MA }); setModal('neu'); };
  const openEdit = (m: Mitarbeiter) => {
    setForm({ name: m.name, rolle: m.rolle, aktiv: m.aktiv, email: m.email });
    setModal(m);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'neu') await createMitarbeiter(form);
      else if (modal) await updateMitarbeiter(modal.id, form);
      await lade();
      setModal(null);
    } finally { setSaving(false); }
  };

  const handleDeaktivieren = async (m: Mitarbeiter) => {
    if (!confirm(`${m.name} wirklich deaktivieren?`)) return;
    await deleteMitarbeiter(m.id);
    await lade();
  };

  const handleAbwSave = async () => {
    if (!abwModal || !abwForm.woche_start) return;
    setSaving(true);
    try {
      await createAbwesenheit({
        mitarbeiter_id: abwModal.id,
        typ: abwForm.typ,
        woche_start: toISODate(getMontag(new Date(abwForm.woche_start))),
        woche_ende: abwForm.woche_ende
          ? toISODate(getMontag(new Date(abwForm.woche_ende)))
          : null,
        notiz: abwForm.notiz || null,
      });
      await lade();
      setAbwModal(null);
    } finally { setSaving(false); }
  };

  const handleAbwLoeschen = async (id: string) => {
    await deleteAbwesenheit(id);
    await lade();
  };

  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Group by role
  const grouped = ROLLEN.map(rolle => ({
    rolle,
    liste: mitarbeiter.filter(m => m.rolle === rolle),
  })).filter(g => g.liste.length > 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Mitarbeiter</h1>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openNeu}>
          + Neuer Mitarbeiter
        </button>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: 20 }}>Lade…</div>}
      {error && <div style={{ padding: 16, color: '#fca5a5', background: '#450a0a', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>Fehler: {error}</div>}

      {!loading && grouped.map(g => (
        <div key={g.rolle} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: ROLLEN_FARBE[g.rolle as MitarbeiterRolle], color: '#e2e8f0',
            }}>
              {g.rolle}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{g.liste.length} Personen</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {g.liste.map(m => {
              const maAbw = abwesenheiten.filter(a => a.mitarbeiter_id === m.id);
              return (
                <div key={m.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      {m.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.email}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEdit(m)}>✎</button>
                      <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setAbwModal(m); setAbwForm({ typ: 'Urlaub', woche_start: '', woche_ende: '', notiz: '' }); }}>📅</button>
                      <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleDeaktivieren(m)}>✕</button>
                    </div>
                  </div>
                  {maAbw.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {maAbw.slice(0, 3).map(a => (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: 11, background: 'var(--bg-input)', borderRadius: 4,
                          padding: '2px 6px', marginTop: 3,
                        }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {a.typ} · {a.woche_start}{a.woche_ende ? ` – ${a.woche_ende}` : ''}
                          </span>
                          <button onClick={() => handleAbwLoeschen(a.id)} style={{
                            background: 'none', border: 'none', color: '#ef4444',
                            cursor: 'pointer', fontSize: 11, padding: '0 2px',
                          }}>✕</button>
                        </div>
                      ))}
                      {maAbw.length > 3 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          +{maAbw.length - 3} weitere
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Mitarbeiter-Modal */}
      {modal !== null && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 380 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>
              {modal === 'neu' ? 'Neuer Mitarbeiter' : 'Mitarbeiter bearbeiten'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div>
                <label>Rolle</label>
                <select value={form.rolle} onChange={e => set('rolle', e.target.value as MitarbeiterRolle)}>
                  {ROLLEN.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label>E-Mail (für Outlook-Integration)</label><input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || null)} placeholder="vorname.nachname@herbstritt.de" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abwesenheits-Modal */}
      {abwModal && (
        <div onClick={() => setAbwModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 380 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Abwesenheit</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{abwModal.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Typ</label>
                <select value={abwForm.typ} onChange={e => setAbwForm(f => ({ ...f, typ: e.target.value as AbwesenheitTyp }))}>
                  {ABW_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Von (Woche)</label><input type="date" value={abwForm.woche_start} onChange={e => setAbwForm(f => ({ ...f, woche_start: e.target.value }))} /></div>
                <div><label>Bis (Woche, optional)</label><input type="date" value={abwForm.woche_ende} onChange={e => setAbwForm(f => ({ ...f, woche_ende: e.target.value }))} /></div>
              </div>
              <div><label>Notiz</label><input value={abwForm.notiz} onChange={e => setAbwForm(f => ({ ...f, notiz: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setAbwModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleAbwSave} disabled={saving || !abwForm.woche_start}>
                {saving ? 'Speichern…' : 'Eintragen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
