'use client';

import { useState, useEffect, useCallback } from 'react';
import PlanungsBoard from '@/components/planung/PlanungsBoard';
import SchnellEinplanungModal from '@/components/planung/SchnellEinplanungModal';
import { getMitarbeiter, getProjekte, getEinplanungen, getAbwesenheiten } from '@/lib/supabase';
import { generiereKalenderwochen, toISODate, getMontag } from '@/lib/kalender';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche } from '@/types';

export default function PlanungPage() {
  const currentYear = new Date().getFullYear();
  const [jahr, setJahr] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schnellModal, setSchnellModal] = useState(false);

  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [projekte, setProjekte] = useState<Projekt[]>([]);
  const [einplanungen, setEinplanungen] = useState<Einplanung[]>([]);
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
  const [wochen, setWochen] = useState<KalenderWoche[]>([]);

  const lade = useCallback(async (selectedJahr: number) => {
    setLoading(true);
    setError(null);
    try {
      const von = new Date(selectedJahr, 0, 1);
      const bis = new Date(selectedJahr, 11, 31);
      const montagVon = getMontag(von);
      const montagBis = getMontag(bis);
      const vonStr = toISODate(montagVon);
      const bisStr = toISODate(montagBis);
      const kws = generiereKalenderwochen(von, bis);

      const [ma, proj, einpl, abw] = await Promise.all([
        getMitarbeiter(),
        getProjekte(),
        getEinplanungen(vonStr, bisStr),
        getAbwesenheiten(vonStr, bisStr),
      ]);

      setMitarbeiter(ma);
      setProjekte(proj);
      setEinplanungen(einpl);
      setAbwesenheiten(abw);
      setWochen(kws);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { lade(jahr); }, [jahr, lade]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        background: 'var(--bg-card)',
      }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Einsatzplanung</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 10px' }}
            onClick={() => setJahr(j => j - 1)}
          >‹</button>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 50, textAlign: 'center' }}>{jahr}</span>
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 10px' }}
            onClick={() => setJahr(j => j + 1)}
          >›</button>
        </div>

        <button
          className="btn btn-primary"
          style={{ fontSize: 13 }}
          onClick={() => setSchnellModal(true)}
          disabled={loading}
        >
          ⚡ Schnell-Einplanung
        </button>

        {/* Legende */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, background: '#3b82f6', borderRadius: 3, display: 'inline-block' }} />
            Bestätigt
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, background: '#3b82f655', border: '2px dashed #3b82f6', borderRadius: 3, display: 'inline-block' }} />
            Platzhalter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, background: '#78350f', borderRadius: 3, display: 'inline-block' }} />
            Urlaub/Abwesenheit
          </span>
        </div>

        <button
          className="btn btn-ghost"
          style={{ padding: '5px 10px', fontSize: 12 }}
          onClick={() => lade(jahr)}
          disabled={loading}
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Lade Daten…
          </div>
        )}
        {error && (
          <div style={{ padding: 20, color: '#fca5a5', background: '#450a0a', margin: 20, borderRadius: 8 }}>
            Fehler: {error}
          </div>
        )}
        {!loading && !error && (
          <PlanungsBoard
            mitarbeiter={mitarbeiter}
            projekte={projekte}
            einplanungen={einplanungen}
            abwesenheiten={abwesenheiten}
            wochen={wochen}
            onRefresh={() => lade(jahr)}
          />
        )}
      </div>

      {schnellModal && (
        <SchnellEinplanungModal
          mitarbeiter={mitarbeiter}
          projekte={projekte}
          einplanungen={einplanungen}
          onSave={() => lade(jahr)}
          onClose={() => setSchnellModal(false)}
        />
      )}
    </div>
  );
}
