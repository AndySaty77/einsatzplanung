'use client';

import { useState } from 'react';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche } from '@/types';

interface Props {
  mitarbeiter: Mitarbeiter;
  woche: KalenderWoche;
  projekte: Projekt[];
  aktuelleEinplanung: Einplanung | null;
  aktuelleAbwesenheit: Abwesenheit | null;
  saving: boolean;
  onSave: (projektId: string | null, bestaetigt: boolean, notiz: string) => void;
  onClose: () => void;
}

export default function EinplanungsModal({
  mitarbeiter,
  woche,
  projekte,
  aktuelleEinplanung,
  aktuelleAbwesenheit,
  saving,
  onSave,
  onClose,
}: Props) {
  const [projektId, setProjektId] = useState<string>(aktuelleEinplanung?.projekt_id ?? '');
  const [bestaetigt, setBestaetigt] = useState(aktuelleEinplanung?.bestaetigt ?? false);
  const [notiz, setNotiz] = useState(aktuelleEinplanung?.notiz ?? '');

  const aktiveProjekte = projekte.filter(p => p.status !== 'abgeschlossen');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '95vw',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {mitarbeiter.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            KW {woche.kw} · {woche.monat} {woche.jahr}
          </div>
        </div>

        {aktuelleAbwesenheit && (
          <div style={{
            background: '#292524',
            border: '1px solid #78350f',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 16,
            fontSize: 12,
            color: '#fbbf24',
          }}>
            Abwesenheit: <strong>{aktuelleAbwesenheit.typ}</strong>
            {aktuelleAbwesenheit.notiz && ` – ${aktuelleAbwesenheit.notiz}`}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>Projekt</label>
            <select value={projektId} onChange={e => setProjektId(e.target.value)}>
              <option value="">— kein Projekt (Zuweisung entfernen) —</option>
              {aktiveProjekte.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.auftraggeber ? ` (${p.auftraggeber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="bestaetigt"
              checked={bestaetigt}
              onChange={e => setBestaetigt(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <label htmlFor="bestaetigt" style={{ margin: 0, cursor: 'pointer', fontSize: 13 }}>
              Bestätigt (kein Platzhalter mehr)
            </label>
          </div>

          <div>
            <label>Notiz (optional)</label>
            <input
              type="text"
              value={notiz}
              onChange={e => setNotiz(e.target.value)}
              placeholder="z.B. Montag frei, ab Dienstag"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          {aktuelleEinplanung && (
            <button
              className="btn btn-danger"
              onClick={() => onSave(null, false, '')}
              disabled={saving}
            >
              Entfernen
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => onSave(projektId || null, bestaetigt, notiz)}
            disabled={saving || (!projektId && !aktuelleEinplanung)}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
