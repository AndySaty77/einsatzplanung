'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Projekt, ProjektStatus, Meister } from '@/types';
import {
  getProjekte, createProjekt, updateProjekt, deleteProjekt,
  getMeister, getMeisterFuerProjekt, setMeisterFuerProjekt, getAlleProjektMeister,
} from '@/lib/supabase';
import { formatDatum } from '@/lib/kalender';

const STATUS_LABEL: Record<ProjektStatus, string> = {
  geplant:       'Geplant',
  aktiv:         'Aktiv',
  abgeschlossen: 'Abgeschlossen',
  pausiert:      'Pausiert',
};

const STATUS_COLOR: Record<ProjektStatus, string> = {
  geplant:       '#1e3a5f',
  aktiv:         '#14532d',
  abgeschlossen: '#374151',
  pausiert:      '#78350f',
};

const FARBEN = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16',
];

const LEER: Omit<Projekt, 'id' | 'erstellt_am' | 'aktualisiert_am'> = {
  name: '', auftraggeber: null, volumen: null, stunden_geplant: null,
  fertigstellung_prozent: 0, startdatum: null, enddatum: null,
  status: 'geplant', farbe: '#3b82f6', notizen: null,
};

export default function ProjektePage() {
  const [projekte, setProjekte] = useState<Projekt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'neu' | Projekt | null>(null);
  const [form, setForm] = useState({ ...LEER });
  const [saving, setSaving] = useState(false);
  const [loeschen, setLoeschen] = useState<Projekt | null>(null);
  const [filter, setFilter] = useState<ProjektStatus | 'alle'>('alle');
  const [alleMeister, setAlleMeister] = useState<Meister[]>([]);
  const [projektMeisterMap, setProjektMeisterMap] = useState<Record<string, Meister[]>>({});
  const [selectedMeister, setSelectedMeister] = useState<Set<string>>(new Set());

  const lade = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, meister, pm] = await Promise.all([
        getProjekte(),
        getMeister(),
        getAlleProjektMeister(),
      ]);
      setProjekte(proj);
      setAlleMeister(meister);
      setProjektMeisterMap(pm);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { lade(); }, [lade]);

  const openNeu = () => {
    setForm({ ...LEER });
    setSelectedMeister(new Set());
    setModal('neu');
  };

  const openBearbeiten = (p: Projekt) => {
    setForm({
      name: p.name, auftraggeber: p.auftraggeber,
      volumen: p.volumen, stunden_geplant: p.stunden_geplant,
      fertigstellung_prozent: p.fertigstellung_prozent,
      startdatum: p.startdatum, enddatum: p.enddatum,
      status: p.status, farbe: p.farbe, notizen: p.notizen,
    });
    setSelectedMeister(new Set((projektMeisterMap[p.id] ?? []).map(m => m.id)));
    setModal(p);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let projektId: string;
      if (modal === 'neu') {
        const neu = await createProjekt(form);
        projektId = neu.id;
      } else if (modal) {
        await updateProjekt(modal.id, form);
        projektId = modal.id;
      } else return;
      await setMeisterFuerProjekt(projektId, [...selectedMeister]);
      await lade();
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleLoeschen = async () => {
    if (!loeschen) return;
    setSaving(true);
    try {
      await deleteProjekt(loeschen.id);
      await lade();
      setLoeschen(null);
    } finally {
      setSaving(false);
    }
  };

  const angezeigt = projekte.filter(p => filter === 'alle' || p.status === filter);

  const set = (key: keyof typeof form, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Projekte</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['alle', 'geplant', 'aktiv', 'abgeschlossen', 'pausiert'] as const).map(s => (
            <button
              key={s}
              className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setFilter(s)}
            >
              {s === 'alle' ? 'Alle' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openNeu}>
          + Neues Projekt
        </button>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: 20 }}>Lade…</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {angezeigt.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg-card)',
              border: `1px solid var(--border)`,
              borderLeft: `4px solid ${p.farbe}`,
              borderRadius: 10,
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                  {p.auftraggeber && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.auftraggeber}</div>
                  )}
                  {(projektMeisterMap[p.id] ?? []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {(projektMeisterMap[p.id] ?? []).map(m => (
                        <span key={m.id} style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 10,
                          background: '#1e3a5f', color: '#93c5fd', fontWeight: 600,
                        }}>👷 {m.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: STATUS_COLOR[p.status], color: '#e2e8f0',
                }}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12, marginBottom: 10 }}>
                {p.volumen != null && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Volumen</span>
                    <span>{p.volumen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </>
                )}
                {p.stunden_geplant != null && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Std. geplant</span>
                    <span>{p.stunden_geplant} h</span>
                  </>
                )}
                {p.startdatum && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Start</span>
                    <span>{formatDatum(p.startdatum)}</span>
                  </>
                )}
                {p.enddatum && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Ende</span>
                    <span>{formatDatum(p.enddatum)}</span>
                  </>
                )}
              </div>

              {/* Fortschrittsbalken */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Fertigstellung</span>
                  <span>{p.fertigstellung_prozent}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.fertigstellung_prozent}%`, background: p.farbe, transition: 'width 0.3s' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '5px' }} onClick={() => openBearbeiten(p)}>
                  Bearbeiten
                </button>
                <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setLoeschen(p)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          {angezeigt.length === 0 && (
            <div style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
              Keine Projekte gefunden.
            </div>
          )}
        </div>
      )}

      {/* Projekt-Modal */}
      {modal !== null && (
        <div onClick={() => setModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>
              {modal === 'neu' ? 'Neues Projekt' : 'Projekt bearbeiten'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Projektname *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Rehaklinik Freiburg" />
              </div>
              <div>
                <label>Auftraggeber</label>
                <input value={form.auftraggeber ?? ''} onChange={e => set('auftraggeber', e.target.value || null)} placeholder="z.B. Gebäudedienstleistungen GmbH" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Volumen (€)</label>
                  <input type="number" value={form.volumen ?? ''} onChange={e => set('volumen', e.target.value ? +e.target.value : null)} />
                </div>
                <div>
                  <label>Geplante Stunden</label>
                  <input type="number" value={form.stunden_geplant ?? ''} onChange={e => set('stunden_geplant', e.target.value ? +e.target.value : null)} />
                </div>
                <div>
                  <label>Startdatum</label>
                  <input type="date" value={form.startdatum ?? ''} onChange={e => set('startdatum', e.target.value || null)} />
                </div>
                <div>
                  <label>Enddatum</label>
                  <input type="date" value={form.enddatum ?? ''} onChange={e => set('enddatum', e.target.value || null)} />
                </div>
              </div>
              <div>
                <label>Fertigstellung: {form.fertigstellung_prozent}%</label>
                <input type="range" min={0} max={100} value={form.fertigstellung_prozent}
                  onChange={e => set('fertigstellung_prozent', +e.target.value)}
                  style={{ background: 'transparent', border: 'none', padding: 0 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value as ProjektStatus)}>
                    {(Object.keys(STATUS_LABEL) as ProjektStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Farbe im Board</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {FARBEN.map(f => (
                      <div key={f} onClick={() => set('farbe', f)} style={{
                        width: 22, height: 22, borderRadius: '50%', background: f, cursor: 'pointer',
                        border: form.farbe === f ? '3px solid #fff' : '2px solid transparent',
                        transition: 'border 0.1s',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* Meister-Zuweisung */}
              {alleMeister.length > 0 && (
                <div>
                  <label>Verantwortlicher Meister</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {alleMeister.map(m => {
                      const aktiv = selectedMeister.has(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => {
                          setSelectedMeister(prev => {
                            const next = new Set(prev);
                            aktiv ? next.delete(m.id) : next.add(m.id);
                            return next;
                          });
                        }} style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                          background: aktiv ? '#1e3a5f' : 'var(--bg-input)',
                          color: aktiv ? '#93c5fd' : 'var(--text-muted)',
                          transition: 'all 0.15s',
                        }}>
                          {aktiv ? '✓ ' : ''}{m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label>Notizen</label>
                <textarea rows={2} value={form.notizen ?? ''} onChange={e => set('notizen', e.target.value || null)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {loeschen && (
        <div onClick={() => setLoeschen(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 360,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Projekt löschen?</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              „{loeschen.name}" wird samt allen Einplanungen unwiderruflich gelöscht.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setLoeschen(null)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={handleLoeschen} disabled={saving}>
                {saving ? 'Löschen…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
