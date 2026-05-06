'use client';

import { useState, useEffect } from 'react';
import type { Mitarbeiter, Projekt } from '@/types';
import { getMontag, toISODate, generiereKalenderwochen } from '@/lib/kalender';
import { bulkUpsertEinplanungen } from '@/lib/supabase';

interface Props {
  mitarbeiter: Mitarbeiter[];
  projekte: Projekt[];
  onSave: () => void;
  onClose: () => void;
}

const ROLLEN_REIHENFOLGE = ['Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager'];

export default function SchnellEinplanungModal({ mitarbeiter, projekte, onSave, onClose }: Props) {
  const [projektId, setProjektId] = useState('');
  const [selectedMA, setSelectedMA] = useState<Set<string>>(new Set());
  const [vonDatum, setVonDatum] = useState('');
  const [bisDatum, setBisDatum] = useState('');
  const [bestaetigt, setBestaetigt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const projekt = projekte.find(p => p.id === projektId);

  // Wenn Projekt gewählt: Datum automatisch aus Projekt übernehmen
  useEffect(() => {
    if (projekt?.startdatum) setVonDatum(projekt.startdatum);
    if (projekt?.enddatum) setBisDatum(projekt.enddatum);
  }, [projekt]);

  const toggleMA = (id: string) => {
    setSelectedMA(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Berechne Anzahl KW-Blöcke
  const kwAnzahl = vonDatum && bisDatum
    ? generiereKalenderwochen(new Date(vonDatum), new Date(bisDatum)).length
    : 0;
  const blockAnzahl = kwAnzahl * selectedMA.size;

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
        borderRadius: 12, padding: 24, width: 520, maxWidth: '95vw',
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
          {projekt && (
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              {projekt.stunden_geplant && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 4 }}>
                  {projekt.stunden_geplant} h geplant
                </span>
              )}
              {projekt.volumen && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 4 }}>
                  {projekt.volumen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              )}
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: projekt.farbe + '33', color: projekt.farbe }}>
                ● {projekt.status}
              </span>
            </div>
          )}
        </div>

        {/* Zeitraum */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label>Von (Start-KW)</label>
            <input type="date" value={vonDatum} onChange={e => setVonDatum(e.target.value)} />
          </div>
          <div>
            <label>Bis (End-KW)</label>
            <input type="date" value={bisDatum} onChange={e => setBisDatum(e.target.value)} />
          </div>
        </div>

        {kwAnzahl > 0 && (
          <div style={{
            fontSize: 12, color: 'var(--text-muted)',
            background: 'var(--bg-input)', borderRadius: 6,
            padding: '6px 10px', marginBottom: 14,
          }}>
            Zeitraum: <strong style={{ color: 'var(--text-primary)' }}>{kwAnzahl} Kalenderwochen</strong>
            {selectedMA.size > 0 && (
              <> · <strong style={{ color: 'var(--accent)' }}>{blockAnzahl} Blöcke</strong> werden angelegt</>
            )}
          </div>
        )}

        {/* Mitarbeiter */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ margin: 0 }}>Mitarbeiter auswählen *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setSelectedMA(new Set(mitarbeiter.map(m => m.id)))}>
                Alle
              </button>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setSelectedMA(new Set())}>
                Keine
              </button>
            </div>
          </div>
          <div style={{
            border: '1px solid var(--border)', borderRadius: 8,
            maxHeight: 220, overflowY: 'auto',
          }}>
            {sortiertMA.map((m, i) => (
              <label key={m.id} htmlFor={`ma-${m.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', cursor: 'pointer',
                borderBottom: i < sortiertMA.length - 1 ? '1px solid var(--border)' : 'none',
                background: selectedMA.has(m.id) ? 'var(--bg-input)' : 'transparent',
                transition: 'background 0.1s',
              }}>
                <input
                  id={`ma-${m.id}`}
                  type="checkbox"
                  checked={selectedMA.has(m.id)}
                  onChange={() => toggleMA(m.id)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: selectedMA.has(m.id) ? 600 : 400 }}>{m.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.rolle}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Bestätigt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input
            type="checkbox" id="bestaetigt-bulk"
            checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)}
            style={{ width: 'auto', cursor: 'pointer' }}
          />
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
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !projektId || selectedMA.size === 0 || !vonDatum || !bisDatum}
          >
            {saving ? `Lege ${blockAnzahl} Blöcke an…` : `${blockAnzahl || '?'} Blöcke einplanen`}
          </button>
        </div>
      </div>
    </div>
  );
}
