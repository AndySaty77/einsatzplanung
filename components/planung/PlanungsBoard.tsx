'use client';

import { useState, useCallback } from 'react';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche } from '@/types';
import { gruppiereNachMonat } from '@/lib/kalender';
import { upsertEinplanung, deleteEinplanung } from '@/lib/supabase';
import EinplanungsModal from './EinplanungsModal';

const ROLLEN_REIHENFOLGE = ['Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager'];

const ABWESENHEIT_FARBEN: Record<string, string> = {
  Urlaub:       '#78350f',
  Elternzeit:   '#1e3a5f',
  Schule:       '#3b0764',
  Krank:        '#450a0a',
  Ausgeschieden:'#1c1c1c',
  Sonstiges:    '#374151',
};

interface Props {
  mitarbeiter: Mitarbeiter[];
  projekte: Projekt[];
  einplanungen: Einplanung[];
  abwesenheiten: Abwesenheit[];
  wochen: KalenderWoche[];
  onRefresh: () => void;
}

interface ModalState {
  mitarbeiter: Mitarbeiter;
  woche: KalenderWoche;
  aktuelleEinplanung: Einplanung | null;
  aktuelleAbwesenheit: Abwesenheit | null;
}

export default function PlanungsBoard({
  mitarbeiter,
  projekte,
  einplanungen,
  abwesenheiten,
  wochen,
  onRefresh,
}: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);

  // Build lookup maps
  const einplanungMap = new Map<string, Einplanung>();
  for (const e of einplanungen) {
    einplanungMap.set(`${e.mitarbeiter_id}__${e.woche_start}`, e);
  }

  const abwesenheitMap = new Map<string, Abwesenheit>();
  for (const a of abwesenheiten) {
    const ma = mitarbeiter.find(m => m.id === a.mitarbeiter_id);
    if (!ma) continue;
    // Mark all weeks within the absence range
    for (const w of wochen) {
      const wDate = new Date(w.wocheStart);
      const vonDate = new Date(a.woche_start);
      const bisDate = a.woche_ende ? new Date(a.woche_ende) : vonDate;
      if (wDate >= vonDate && wDate <= bisDate) {
        abwesenheitMap.set(`${a.mitarbeiter_id}__${w.wocheStart}`, a);
      }
    }
  }

  const projektMap = new Map<string, Projekt>();
  for (const p of projekte) projektMap.set(p.id, p);

  // Sort employees by role order then name
  const sortierteMitarbeiter = [...mitarbeiter].sort((a, b) => {
    const ri = ROLLEN_REIHENFOLGE.indexOf(a.rolle) - ROLLEN_REIHENFOLGE.indexOf(b.rolle);
    if (ri !== 0) return ri;
    return a.name.localeCompare(b.name);
  });

  const monatsGruppen = gruppiereNachMonat(wochen);

  // Auslastung je Woche (% eingeplante Monteure)
  const auslastungMap = new Map<string, number>();
  const relevanteMA = mitarbeiter.filter(m => m.rolle !== 'Lager');
  for (const w of wochen) {
    let belegt = 0;
    for (const m of relevanteMA) {
      if (einplanungMap.has(`${m.id}__${w.wocheStart}`)) belegt++;
      else if (abwesenheitMap.has(`${m.id}__${w.wocheStart}`)) belegt++; // Abwesenheit = nicht verfügbar
    }
    auslastungMap.set(w.wocheStart, relevanteMA.length > 0 ? Math.round((belegt / relevanteMA.length) * 100) : 0);
  }

  const handleCellClick = (m: Mitarbeiter, w: KalenderWoche) => {
    setModal({
      mitarbeiter: m,
      woche: w,
      aktuelleEinplanung: einplanungMap.get(`${m.id}__${w.wocheStart}`) ?? null,
      aktuelleAbwesenheit: abwesenheitMap.get(`${m.id}__${w.wocheStart}`) ?? null,
    });
  };

  const handleSave = useCallback(async (projektId: string | null, bestaetigt: boolean, notiz: string) => {
    if (!modal) return;
    setSaving(true);
    try {
      if (projektId === null) {
        if (modal.aktuelleEinplanung) {
          await deleteEinplanung(modal.aktuelleEinplanung.id);
        }
      } else {
        await upsertEinplanung({
          mitarbeiter_id: modal.mitarbeiter.id,
          projekt_id: projektId,
          woche_start: modal.woche.wocheStart,
          bestaetigt,
          notiz: notiz || null,
        });
      }
      onRefresh();
      setModal(null);
    } finally {
      setSaving(false);
    }
  }, [modal, onRefresh]);

  const CELL_W = 110;
  const NAME_W = 180;
  const ROLLE_W = 110;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontSize: 12,
        minWidth: NAME_W + ROLLE_W + wochen.length * CELL_W,
      }}>
        <thead>
          {/* Monats-Header */}
          <tr style={{ background: 'var(--bg-sidebar)' }}>
            <th colSpan={2} style={{ width: NAME_W + ROLLE_W, minWidth: NAME_W + ROLLE_W, border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>
              Mitarbeiter
            </th>
            {monatsGruppen.map(g => (
              <th key={g.monat} colSpan={g.wochen.length} style={{
                border: '1px solid var(--border)',
                padding: '6px 8px',
                textAlign: 'center',
                color: 'var(--text-primary)',
                fontWeight: 700,
                background: 'var(--bg-card)',
                width: g.wochen.length * CELL_W,
              }}>
                {g.monat}
              </th>
            ))}
          </tr>
          {/* KW-Header */}
          <tr style={{ background: 'var(--bg-card)' }}>
            <th style={{ width: NAME_W, minWidth: NAME_W, border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Name</th>
            <th style={{ width: ROLLE_W, minWidth: ROLLE_W, border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Rolle</th>
            {wochen.map(w => (
              <th key={w.wocheStart} style={{
                width: CELL_W, minWidth: CELL_W,
                border: '1px solid var(--border)',
                padding: '4px 4px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {w.kw}
              </th>
            ))}
          </tr>
          {/* Auslastungs-Zeile */}
          <tr style={{ background: '#0f1117' }}>
            <td colSpan={2} style={{ border: '1px solid var(--border)', padding: '3px 8px', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Auslastung
            </td>
            {wochen.map(w => {
              const pct = auslastungMap.get(w.wocheStart) ?? 0;
              const color = pct >= 80 ? '#15803d' : pct >= 50 ? '#92400e' : '#7f1d1d';
              return (
                <td key={w.wocheStart} style={{
                  border: '1px solid var(--border)',
                  padding: '3px 2px',
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  background: color,
                }}>
                  {pct}%
                </td>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortierteMitarbeiter.map((m, idx) => (
            <tr key={m.id} style={{ background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f' }}>
              <td style={{
                border: '1px solid var(--border)',
                padding: '5px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                position: 'sticky',
                left: 0,
                background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f',
                zIndex: 1,
              }}>
                {m.name}
              </td>
              <td style={{
                border: '1px solid var(--border)',
                padding: '5px 8px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                position: 'sticky',
                left: NAME_W,
                background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f',
                zIndex: 1,
              }}>
                {m.rolle}
              </td>
              {wochen.map(w => {
                const key = `${m.id}__${w.wocheStart}`;
                const einplanung = einplanungMap.get(key);
                const abwesenheit = abwesenheitMap.get(key);
                const projekt = einplanung ? projektMap.get(einplanung.projekt_id) : null;

                let cellBg = 'transparent';
                let cellText = '';
                let cellColor = 'var(--text-muted)';
                let opacity = 1;
                let cellBorder = '1px solid var(--border)';

                if (abwesenheit) {
                  cellBg = ABWESENHEIT_FARBEN[abwesenheit.typ] ?? '#374151';
                  cellText = abwesenheit.typ;
                  cellColor = '#9ca3af';
                } else if (projekt) {
                  cellBg = einplanung!.bestaetigt
                    ? projekt.farbe
                    : projekt.farbe + '55'; // translucent = Platzhalter
                  cellText = projekt.name;
                  cellColor = '#fff';
                  if (!einplanung!.bestaetigt) {
                    cellBorder = `2px dashed ${projekt.farbe}`;
                  }
                }

                return (
                  <td
                    key={w.wocheStart}
                    onClick={() => handleCellClick(m, w)}
                    title={projekt ? `${projekt.name}${!einplanung?.bestaetigt ? ' (Platzhalter)' : ''}` : abwesenheit ? abwesenheit.typ : 'Klicken zum Einplanen'}
                    style={{
                      border: cellBorder,
                      padding: '4px 4px',
                      textAlign: 'center',
                      background: cellBg,
                      color: cellColor,
                      cursor: 'pointer',
                      fontSize: 11,
                      maxWidth: CELL_W,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      opacity,
                      transition: 'filter 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = '')}
                  >
                    {cellText}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <EinplanungsModal
          mitarbeiter={modal.mitarbeiter}
          woche={modal.woche}
          projekte={projekte}
          aktuelleEinplanung={modal.aktuelleEinplanung}
          aktuelleAbwesenheit={modal.aktuelleAbwesenheit}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
