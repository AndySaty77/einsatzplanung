'use client';

import { useState, useEffect } from 'react';
import type { Mitarbeiter, Projekt, Einplanung } from '@/types';
import { generiereKalenderwochen } from '@/lib/kalender';
import { bulkUpsertEinplanungen } from '@/lib/supabase';

const STUNDEN_PRO_BLOCK = 40; // 40h/Woche pro Person
const ROLLEN_REIHENFOLGE = ['Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager'];

interface Props {
  mitarbeiter: Mitarbeiter[];
  projekte: Projekt[];
  einplanungen: Einplanung[];   // alle geladenen Einplanungen für Restblock-Berechnung
  onSave: () => void;
  onClose: () => void;
}

export default function SchnellEinplanungModal({
  mitarbeiter, projekte, einplanungen, onSave, onClose,
}: Props) {
  const [projektId, setProjektId] = useState('');
  const [selectedMA, setSelectedMA] = useState<Set<string>>(new Set());
  const [vonDatum, setVonDatum] = useState('');
  const [bisDatum, setBisDatum] = useState('');
  const [bestaetigt, setBestaetigt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const projekt = projekte.find(p => p.id === projektId);

  useEffect(() => {
    if (projekt?.startdatum) setVonDatum(projekt.startdatum);
    if (projekt?.enddatum) setBisDatum(projekt.enddatum);
    setSelectedMA(new Set());
  }, [projektId, projekt]);

  const toggleMA = (id: string) => {
    setSelectedMA(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Stunden-Berechnungen ─────────────────────────────
  const benoetigteBlöcke = projekt?.stunden_geplant
    ? Math.ceil(projekt.stunden_geplant / STUNDEN_PRO_BLOCK)
    : null;

  // Bereits eingeplante Blöcke für dieses Projekt
  const bereitsEingeplant = projektId
    ? einplanungen.filter(e => e.projekt_id === projektId).length
    : 0;

  const restBlöcke = benoetigteBlöcke !== null
    ? Math.max(0, benoetigteBlöcke - bereitsEingeplant)
    : null;

  // Blöcke die DIESER Schnell-Einplanung-Lauf anlegen würde
  const kwAnzahl = vonDatum && bisDatum
    ? generiereKalenderwochen(new Date(vonDatum), new Date(bisDatum)).length
    : 0;
  const neueBlöcke = kwAnzahl * selectedMA.size;

  // Empfehlung: wie viele MA sollten idealerweise eingeplant werden?
  const empfohleneMA = restBlöcke !== null && kwAnzahl > 0
    ? Math.ceil(restBlöcke / kwAnzahl)
    : null;

  const handleSave = async () => {
    if (!projektId || selectedMA.size === 0 || !vonDatum || !bisDatum) {
      setError('Bitte Projekt, Mitarbeiter und Zeitraum auswählen.');
      return;
    }
    if (new Date(vonDatum) > new Date(bisDatum)) {
      setError('Startdatum muss vor dem Enddatum liegen.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const wochen = generiereKalenderwochen(new Date(vonDatum), new Date(bisDatum));
      const entries = [...selectedMA].flatMap(mitarbeiterId =>
        wochen.map(w => ({
          mitarbeiter_id: mitarbeiterId,
          projekt_id: projektId,
          woche_start: w.wocheStart,
          bestaetigt,
          notiz: null,
        }))
      );
      await bulkUpsertEinplanungen(entries);
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const aktiveProjekte = projekte.filter(p => p.status !== 'abgeschlossen');
  const sortiertMA = [...mitarbeiter].sort((a, b) => {
    const ri = ROLLEN_REIHENFOLGE.indexOf(a.rolle) - ROLLEN_REIHENFOLGE.indexOf(b.rolle);
    return ri !== 0 ? ri : a.name.localeCompare(b.name);
  });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 540, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Schnell-Einplanung</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--text-muted)' }}>
          Alle gewählten Mitarbeiter werden für den gesamten Zeitraum als Platzhalter eingetragen.
        </p>

        {/* Projekt */}
        <div style={{ marginBottom: 14 }}>
          <label>Projekt *</label>
          <select value={projektId} onChange={e => setProjektId(e.target.value)}>
            <option value="">— Projekt auswählen —</option>
            {aktiveProjekte.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.auftraggeber ? ` (${p.auftraggeber})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Stunden-Statistik */}
        {projekt && (
          <div style={{
            background: 'var(--bg-input)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 14,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          }}>
            <StatBox
              label="Gesamt benötigt"
              value={benoetigteBlöcke !== null ? `${benoetigteBlöcke} Blöcke` : '—'}
              sub={projekt.stunden_geplant ? `${projekt.stunden_geplant} h ÷ 40 h` : 'Stunden nicht angegeben'}
              color="var(--text-primary)"
            />
            <StatBox
              label="Bereits eingeplant"
              value={`${bereitsEingeplant} Blöcke`}
              sub={`= ${bereitsEingeplant * STUNDEN_PRO_BLOCK} h`}
              color={bereitsEingeplant > 0 ? 'var(--success)' : 'var(--text-muted)'}
            />
            <StatBox
              label="Noch offen"
              value={restBlöcke !== null ? `${restBlöcke} Blöcke` : '—'}
              sub={restBlöcke !== null ? `= ${restBlöcke * STUNDEN_PRO_BLOCK} h fehlen noch` : ''}
              color={restBlöcke === 0 ? 'var(--success)' : 'var(--warning)'}
            />
          </div>
        )}

        {/* Empfehlung */}
        {empfohleneMA !== null && kwAnzahl > 0 && restBlöcke !== null && restBlöcke > 0 && (
          <div style={{
            background: '#1e3a5f22', border: '1px solid #3b82f655',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12,
            color: 'var(--accent)',
          }}>
            💡 Empfehlung: <strong>{empfohleneMA} Mitarbeiter</strong> für {kwAnzahl} KW decken die verbleibenden {restBlöcke} Blöcke ab
          </div>
        )}
        {restBlöcke === 0 && benoetigteBlöcke !== null && (
          <div style={{
            background: '#14532d22', border: '1px solid #22c55e55',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12,
            color: 'var(--success)',
          }}>
            ✅ Alle Stunden sind bereits eingeplant
          </div>
        )}

        {/* Zeitraum */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <label>Von (Start-KW)</label>
            <input type="date" value={vonDatum} onChange={e => setVonDatum(e.target.value)} />
          </div>
          <div>
            <label>Bis (End-KW)</label>
            <input type="date" value={bisDatum} onChange={e => setBisDatum(e.target.value)} />
          </div>
        </div>

        {/* Zeitraum + neue Blöcke Info */}
        {kwAnzahl > 0 && (
          <div style={{
            fontSize: 12, color: 'var(--text-muted)',
            background: 'var(--bg-input)', borderRadius: 6,
            padding: '6px 10px', marginBottom: 14,
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <span>{kwAnzahl} Kalenderwochen</span>
            {selectedMA.size > 0 && (
              <>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>{selectedMA.size} Mitarbeiter</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  {neueBlöcke} neue Blöcke ({neueBlöcke * STUNDEN_PRO_BLOCK} h)
                </span>
                {benoetigteBlöcke !== null && (
                  <>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span style={{
                      color: bereitsEingeplant + neueBlöcke >= benoetigteBlöcke
                        ? 'var(--success)' : 'var(--warning)',
                      fontWeight: 600,
                    }}>
                      danach: {bereitsEingeplant + neueBlöcke}/{benoetigteBlöcke} Blöcke
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Mitarbeiter */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ margin: 0 }}>Mitarbeiter *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setSelectedMA(new Set(mitarbeiter.map(m => m.id)))}>Alle</button>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setSelectedMA(new Set())}>Keine</button>
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
            {sortiertMA.map((m, i) => (
              <label key={m.id} htmlFor={`ma-${m.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', cursor: 'pointer',
                borderBottom: i < sortiertMA.length - 1 ? '1px solid var(--border)' : 'none',
                background: selectedMA.has(m.id) ? 'var(--bg-input)' : 'transparent',
              }}>
                <input id={`ma-${m.id}`} type="checkbox" checked={selectedMA.has(m.id)}
                  onChange={() => toggleMA(m.id)} style={{ width: 'auto', cursor: 'pointer' }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: selectedMA.has(m.id) ? 600 : 400 }}>{m.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.rolle}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input type="checkbox" id="bestaetigt-bulk" checked={bestaetigt}
            onChange={e => setBestaetigt(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
          <label htmlFor="bestaetigt-bulk" style={{ margin: 0, cursor: 'pointer', fontSize: 13 }}>
            Direkt als <strong>Bestätigt</strong> einplanen (nicht als Platzhalter)
          </label>
        </div>

        {error && (
          <div style={{ color: '#fca5a5', background: '#450a0a', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={saving || !projektId || selectedMA.size === 0 || !vonDatum || !bisDatum}>
            {saving ? `Lege ${neueBlöcke} Blöcke an…` : `${neueBlöcke || '?'} Blöcke einplanen`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
