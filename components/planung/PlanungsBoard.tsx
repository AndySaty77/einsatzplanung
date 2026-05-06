'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche } from '@/types';
import { gruppiereNachMonat } from '@/lib/kalender';
import {
  upsertEinplanung, deleteEinplanung, moveEinplanung,
  bulkUpsertEinplanungen,
} from '@/lib/supabase';
import EinplanungsModal from './EinplanungsModal';

const ROLLEN_REIHENFOLGE = ['Obermonteur', 'Monteur', 'Azubi', 'Helfer', 'Lager'];

const ABWESENHEIT_FARBEN: Record<string, string> = {
  Urlaub:        '#78350f',
  Elternzeit:    '#1e3a5f',
  Schule:        '#3b0764',
  Krank:         '#450a0a',
  Ausgeschieden: '#1c1c1c',
  Sonstiges:     '#374151',
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

interface DragState {
  type: 'einplanung' | 'projekt';
  einplanungId?: string;
  mitarbeiterId?: string;
  wocheStart?: string;
  projektId: string;
}

const CELL_W = 110;
const NAME_W = 180;
const ROLLE_W = 110;

export default function PlanungsBoard({
  mitarbeiter, projekte, einplanungen, abwesenheiten, wochen, onRefresh,
}: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // einplanung IDs
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Clear selection with Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(new Set()); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Lookup maps ───────────────────────────────────────────
  const einplanungMap = new Map<string, Einplanung>();
  const einplanungById = new Map<string, Einplanung>();
  for (const e of einplanungen) {
    einplanungMap.set(`${e.mitarbeiter_id}__${e.woche_start}`, e);
    einplanungById.set(e.id, e);
  }

  const abwesenheitMap = new Map<string, Abwesenheit>();
  for (const a of abwesenheiten) {
    const ma = mitarbeiter.find(m => m.id === a.mitarbeiter_id);
    if (!ma) continue;
    for (const w of wochen) {
      const wDate = new Date(w.wocheStart + 'T00:00:00');
      const vonDate = new Date(a.woche_start + 'T00:00:00');
      const bisDate = a.woche_ende ? new Date(a.woche_ende + 'T00:00:00') : vonDate;
      if (wDate >= vonDate && wDate <= bisDate) {
        abwesenheitMap.set(`${a.mitarbeiter_id}__${w.wocheStart}`, a);
      }
    }
  }

  const projektMap = new Map<string, Projekt>();
  for (const p of projekte) projektMap.set(p.id, p);

  const sortierteMitarbeiter = [...mitarbeiter].sort((a, b) => {
    const ri = ROLLEN_REIHENFOLGE.indexOf(a.rolle) - ROLLEN_REIHENFOLGE.indexOf(b.rolle);
    return ri !== 0 ? ri : a.name.localeCompare(b.name);
  });

  const monatsGruppen = gruppiereNachMonat(wochen);

  const relevanteMA = mitarbeiter.filter(m => m.rolle !== 'Lager');
  const auslastungMap = new Map<string, number>();
  for (const w of wochen) {
    let belegt = 0;
    for (const m of relevanteMA) {
      if (einplanungMap.has(`${m.id}__${w.wocheStart}`)) belegt++;
      else if (abwesenheitMap.has(`${m.id}__${w.wocheStart}`)) belegt++;
    }
    auslastungMap.set(w.wocheStart, relevanteMA.length > 0
      ? Math.round((belegt / relevanteMA.length) * 100) : 0);
  }

  // ── Backlog: projects with no assignments in current view ─
  const projekteImBoard = new Set(einplanungen.map(e => e.projekt_id));
  const backlogProjekte = projekte.filter(
    p => !projekteImBoard.has(p.id) && p.status !== 'abgeschlossen'
  );

  // ── Drag handlers ─────────────────────────────────────────

  const handleCellDragStart = (e: React.DragEvent, einplanung: Einplanung) => {
    e.dataTransfer.effectAllowed = 'move';
    // Set a dummy text so Firefox doesn't cancel the drag
    e.dataTransfer.setData('text/plain', einplanung.id);
    setDragState({
      type: 'einplanung',
      einplanungId: einplanung.id,
      mitarbeiterId: einplanung.mitarbeiter_id,
      wocheStart: einplanung.woche_start,
      projektId: einplanung.projekt_id,
    });
    // If dragged cell not in selection, reset selection to just this
    if (!selected.has(einplanung.id)) {
      setSelected(new Set([einplanung.id]));
    }
  };

  const handleProjektDragStart = (e: React.DragEvent, projekt: Projekt) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `proj:${projekt.id}`);
    setDragState({ type: 'projekt', projektId: projekt.id });
    setSelected(new Set());
  };

  const handleCellDragOver = (
    e: React.DragEvent,
    key: string,
    einplanung: Einplanung | null,
  ) => {
    if (!dragState) return;
    // Block drop on occupied cells (unless the occupant is in our selection)
    if (einplanung) {
      if (dragState.type === 'projekt') return; // never drop project on occupied
      if (!selected.has(einplanung.id)) return; // occupied by unselected block
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const handleCellDrop = useCallback(async (
    e: React.DragEvent,
    targetMA: Mitarbeiter,
    targetW: KalenderWoche,
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragState) return;

    const targetKey = `${targetMA.id}__${targetW.wocheStart}`;
    const targetExisting = einplanungMap.get(targetKey);

    setSaving(true);
    try {
      if (dragState.type === 'projekt') {
        if (targetExisting) return;
        await upsertEinplanung({
          mitarbeiter_id: targetMA.id,
          projekt_id: dragState.projektId,
          woche_start: targetW.wocheStart,
          bestaetigt: false,
          notiz: null,
        });

      } else if (dragState.type === 'einplanung' && dragState.einplanungId) {
        const isMulti = selected.size > 1 && selected.has(dragState.einplanungId);

        if (isMulti) {
          // ── Multi-drag: shift all selected by same week delta ──
          const sourceEinp = einplanungById.get(dragState.einplanungId);
          if (!sourceEinp) return;

          const sourceIdx = wochen.findIndex(w => w.wocheStart === sourceEinp.woche_start);
          const targetIdx = wochen.findIndex(w => w.wocheStart === targetW.wocheStart);
          const delta = targetIdx - sourceIdx;
          if (delta === 0) return;

          const selectedEinps = einplanungen.filter(e => selected.has(e.id));
          const selectedIds = new Set(selectedEinps.map(e => e.id));

          // Validate: all new positions in range and not occupied by non-selected block
          for (const se of selectedEinps) {
            const idx = wochen.findIndex(w => w.wocheStart === se.woche_start);
            const newIdx = idx + delta;
            if (newIdx < 0 || newIdx >= wochen.length) return;
            const newKey = `${se.mitarbeiter_id}__${wochen[newIdx].wocheStart}`;
            const occupant = einplanungMap.get(newKey);
            if (occupant && !selectedIds.has(occupant.id)) return;
          }

          // Delete all selected, then re-insert at new positions
          await Promise.all(selectedEinps.map(se => deleteEinplanung(se.id)));
          await bulkUpsertEinplanungen(selectedEinps.map(se => {
            const idx = wochen.findIndex(w => w.wocheStart === se.woche_start);
            return {
              mitarbeiter_id: se.mitarbeiter_id,
              projekt_id: se.projekt_id,
              woche_start: wochen[idx + delta].wocheStart,
              bestaetigt: se.bestaetigt,
              notiz: se.notiz,
            };
          }));

        } else {
          // ── Single drag ───────────────────────────────────────
          if (targetExisting && targetExisting.id !== dragState.einplanungId) return;
          if (targetMA.id === dragState.mitarbeiterId && targetW.wocheStart === dragState.wocheStart) return;
          await moveEinplanung(dragState.einplanungId, targetMA.id, targetW.wocheStart);
        }

        setSelected(new Set());
      }

      onRefresh();
    } catch (err) {
      console.error('Drag-Drop Fehler:', err);
    } finally {
      setSaving(false);
      setDragState(null);
    }
  }, [dragState, selected, einplanungen, einplanungMap, einplanungById, wochen, onRefresh]);

  const handleDragEnd = () => {
    setDragState(null);
    setDragOverKey(null);
  };

  // ── Click handler ─────────────────────────────────────────

  const handleCellClick = (e: React.MouseEvent, m: Mitarbeiter, w: KalenderWoche) => {
    const key = `${m.id}__${w.wocheStart}`;
    const einplanung = einplanungMap.get(key) ?? null;
    const abwesenheit = abwesenheitMap.get(key) ?? null;

    if ((e.ctrlKey || e.metaKey) && einplanung) {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(einplanung.id) ? next.delete(einplanung.id) : next.add(einplanung.id);
        return next;
      });
      return;
    }

    setSelected(new Set());
    setModal({ mitarbeiter: m, woche: w, aktuelleEinplanung: einplanung, aktuelleAbwesenheit: abwesenheit });
  };

  const handleSave = useCallback(async (projektId: string | null, bestaetigt: boolean, notiz: string) => {
    if (!modal) return;
    setSaving(true);
    try {
      if (projektId === null) {
        if (modal.aktuelleEinplanung) await deleteEinplanung(modal.aktuelleEinplanung.id);
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

  // ── Render ────────────────────────────────────────────────

  const isDraggingAnything = !!dragState;

  return (
    <>
      {/* Selection hint */}
      {selected.size > 0 && (
        <div style={{
          padding: '6px 20px',
          background: '#1e3a5f',
          borderBottom: '1px solid #3b82f655',
          fontSize: 12,
          color: '#93c5fd',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span>
            <strong>{selected.size}</strong> Block{selected.size > 1 ? 'e' : ''} ausgewählt —
            ziehe einen davon, um alle zu verschieben
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => setSelected(new Set())}
          >
            ✕ Auswahl aufheben (Esc)
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        {saving && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
            zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Speichern…</span>
          </div>
        )}

        <table style={{
          borderCollapse: 'collapse',
          fontSize: 12,
          minWidth: NAME_W + ROLLE_W + wochen.length * CELL_W,
        }}>
          <thead>
            {/* Monats-Header */}
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th colSpan={2} style={{
                width: NAME_W + ROLLE_W, minWidth: NAME_W + ROLLE_W,
                border: '1px solid var(--border)', padding: '6px 8px',
                textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
              }}>
                Mitarbeiter
              </th>
              {monatsGruppen.map(g => (
                <th key={g.monat} colSpan={g.wochen.length} style={{
                  border: '1px solid var(--border)', padding: '6px 8px',
                  textAlign: 'center', color: 'var(--text-primary)', fontWeight: 700,
                  background: 'var(--bg-card)', width: g.wochen.length * CELL_W,
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
                  border: '1px solid var(--border)', padding: '4px',
                  textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                }}>
                  {w.kw}
                </th>
              ))}
            </tr>
            {/* Auslastungs-Zeile */}
            <tr style={{ background: '#0f1117' }}>
              <td colSpan={2} style={{
                border: '1px solid var(--border)', padding: '3px 8px',
                fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic',
              }}>
                Auslastung
              </td>
              {wochen.map(w => {
                const pct = auslastungMap.get(w.wocheStart) ?? 0;
                const color = pct >= 80 ? '#15803d' : pct >= 50 ? '#92400e' : '#7f1d1d';
                return (
                  <td key={w.wocheStart} style={{
                    border: '1px solid var(--border)', padding: '3px 2px',
                    textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#fff', background: color,
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
                  border: '1px solid var(--border)', padding: '5px 8px',
                  fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap',
                  position: 'sticky', left: 0,
                  background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f', zIndex: 1,
                }}>
                  {m.name}
                </td>
                <td style={{
                  border: '1px solid var(--border)', padding: '5px 8px',
                  color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  position: 'sticky', left: NAME_W,
                  background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f', zIndex: 1,
                }}>
                  {m.rolle}
                </td>

                {wochen.map(w => {
                  const key = `${m.id}__${w.wocheStart}`;
                  const einplanung = einplanungMap.get(key) ?? null;
                  const abwesenheit = abwesenheitMap.get(key) ?? null;
                  const projekt = einplanung ? projektMap.get(einplanung.projekt_id) : null;
                  const isSelected = einplanung ? selected.has(einplanung.id) : false;
                  const isDragOver = dragOverKey === key;
                  const isDraggingThis = dragState?.einplanungId === einplanung?.id;

                  let cellBg = 'transparent';
                  let cellText = '';
                  let cellColor = 'var(--text-muted)';
                  let cellBorder = '1px solid var(--border)';

                  if (abwesenheit) {
                    cellBg = ABWESENHEIT_FARBEN[abwesenheit.typ] ?? '#374151';
                    cellText = abwesenheit.typ;
                    cellColor = '#9ca3af';
                  } else if (projekt) {
                    cellBg = einplanung!.bestaetigt ? projekt.farbe : projekt.farbe + '55';
                    cellText = projekt.name;
                    cellColor = '#fff';
                    if (!einplanung!.bestaetigt) cellBorder = `2px dashed ${projekt.farbe}`;
                  }

                  // Overlay styles for selection/drag
                  let outline = 'none';
                  let opacity = isDraggingThis ? 0.4 : 1;
                  if (isSelected) outline = '2px solid #facc15';
                  if (isDragOver) {
                    outline = '2px solid #60a5fa';
                    cellBg = cellBg === 'transparent' ? '#1e3a5f55' : cellBg;
                  }

                  return (
                    <td
                      key={w.wocheStart}
                      draggable={!!einplanung && !abwesenheit}
                      onDragStart={einplanung ? e => handleCellDragStart(e, einplanung) : undefined}
                      onDragOver={e => handleCellDragOver(e, key, einplanung)}
                      onDragLeave={() => { if (dragOverKey === key) setDragOverKey(null); }}
                      onDrop={e => handleCellDrop(e, m, w)}
                      onDragEnd={handleDragEnd}
                      onClick={e => handleCellClick(e, m, w)}
                      title={
                        projekt
                          ? `${projekt.name}${!einplanung?.bestaetigt ? ' (Platzhalter)' : ''}${isSelected ? ' · Ausgewählt' : ''}`
                          : abwesenheit ? abwesenheit.typ
                          : isDraggingAnything ? 'Hier ablegen'
                          : 'Klicken zum Einplanen'
                      }
                      style={{
                        border: cellBorder,
                        padding: '4px',
                        textAlign: 'center',
                        background: cellBg,
                        color: cellColor,
                        cursor: einplanung ? (isDraggingAnything ? 'copy' : 'grab') : isDraggingAnything ? 'copy' : 'pointer',
                        fontSize: 11,
                        maxWidth: CELL_W,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity,
                        outline,
                        outlineOffset: '-2px',
                        transition: 'outline 0.05s, background 0.05s',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => { if (!isDraggingAnything) e.currentTarget.style.filter = 'brightness(1.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
                    >
                      {cellText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Arbeitsvorrat (Backlog) ─────────────────────────── */}
      {backlogProjekte.length > 0 && (
        <div style={{
          borderTop: '2px dashed var(--border)',
          padding: '14px 20px',
          background: 'var(--bg-sidebar)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            Arbeitsvorrat — {backlogProjekte.length} Projekt{backlogProjekte.length !== 1 ? 'e' : ''} ohne Einplanung
            <span style={{ fontWeight: 400, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
              (auf eine Zelle ziehen zum Einplanen)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {backlogProjekte.map(p => (
              <div
                key={p.id}
                draggable
                onDragStart={e => handleProjektDragStart(e, p)}
                onDragEnd={handleDragEnd}
                style={{
                  background: p.farbe,
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: 20,
                  cursor: 'grab',
                  fontWeight: 600,
                  fontSize: 12,
                  userSelect: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
                }}
              >
                ↑ {p.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <EinplanungsModal
          mitarbeiter={modal.mitarbeiter}
          woche={modal.woche}
          projekte={projekte}
          aktuelleEinplanung={modal.aktuelleEinplanung}
          aktuelleAbwesenheit={modal.aktuelleAbwesenheit}
          saving={saving}
          onSave={handleSave}
          onAbwesenheitSaved={onRefresh}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
