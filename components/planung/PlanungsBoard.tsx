'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche } from '@/types';
import { gruppiereNachMonat, getKW } from '@/lib/kalender';
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
  type: 'einplanung' | 'backlog';
  // einplanung:
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
  const [modal, setModal]     = useState<ModalState | null>(null);
  const [saving, setSaving]   = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Main board selection (einplanung IDs)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const updateSelected = (s: Set<string>) => { selectedRef.current = s; setSelected(s); };

  // Backlog selection ("projektId__wocheStart")
  const [backlogSelected, setBacklogSelected] = useState<Set<string>>(new Set());
  const backlogSelectedRef = useRef<Set<string>>(new Set());
  const updateBacklogSelected = (s: Set<string>) => { backlogSelectedRef.current = s; setBacklogSelected(s); };

  // DnD state — ref only (no re-render needed, avoids stale closures)
  const dragStateRef = useRef<DragState | null>(null);

  // Clear selections with Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { updateSelected(new Set()); updateBacklogSelected(new Set()); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Auto-dismiss drag error
  useEffect(() => {
    if (!dragError) return;
    const t = setTimeout(() => setDragError(null), 3500);
    return () => clearTimeout(t);
  }, [dragError]);

  // ── Lookup maps ───────────────────────────────────────────
  const einplanungMap = new Map<string, Einplanung>();
  const einplanungById = new Map<string, Einplanung>();
  for (const e of einplanungen) {
    einplanungMap.set(`${e.mitarbeiter_id}__${e.woche_start}`, e);
    einplanungById.set(e.id, e);
  }

  const abwesenheitMap = new Map<string, Abwesenheit>();
  for (const a of abwesenheiten) {
    if (!mitarbeiter.find(m => m.id === a.mitarbeiter_id)) continue;
    for (const w of wochen) {
      const wDate = new Date(w.wocheStart + 'T00:00:00');
      const von   = new Date(a.woche_start + 'T00:00:00');
      const bis   = a.woche_ende ? new Date(a.woche_ende + 'T00:00:00') : von;
      if (wDate >= von && wDate <= bis)
        abwesenheitMap.set(`${a.mitarbeiter_id}__${w.wocheStart}`, a);
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

  // ── Backlog: projects explicitly marked as Arbeitsvorrat ──────
  const backlogProjekte = projekte.filter(
    p => p.ist_arbeitsvorrat && p.status !== 'abgeschlossen'
  );

  // ── Main board drag handlers ──────────────────────────────

  const handleCellDragStart = (e: React.DragEvent, einplanung: Einplanung) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', einplanung.id);
    dragStateRef.current = {
      type: 'einplanung',
      einplanungId: einplanung.id,
      mitarbeiterId: einplanung.mitarbeiter_id,
      wocheStart: einplanung.woche_start,
      projektId: einplanung.projekt_id,
    };
    setIsDragging(true);
    updateBacklogSelected(new Set());
    if (!selectedRef.current.has(einplanung.id)) {
      updateSelected(new Set([einplanung.id]));
    }
  };

  // ── Backlog drag handlers ─────────────────────────────────

  const handleBacklogDragStart = (e: React.DragEvent, projekt: Projekt, wocheStart: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `backlog:${projekt.id}:${wocheStart}`);
    const key = `${projekt.id}__${wocheStart}`;
    // If cell not selected, reset to just this cell
    if (!backlogSelectedRef.current.has(key)) {
      updateBacklogSelected(new Set([key]));
    }
    dragStateRef.current = { type: 'backlog', projektId: projekt.id };
    setIsDragging(true);
    updateSelected(new Set());
  };

  // ── Shared drag-over for main board cells ─────────────────

  const handleCellDragOver = (e: React.DragEvent, key: string, cellEinplanung: Einplanung | null) => {
    const ds = dragStateRef.current;
    if (!ds) return;

    if (ds.type === 'backlog') {
      if (cellEinplanung) return; // occupied → reject
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (dragOverKey !== key) setDragOverKey(key);
      return;
    }

    if (ds.type === 'einplanung') {
      if (cellEinplanung && !selectedRef.current.has(cellEinplanung.id)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverKey !== key) setDragOverKey(key);
    }
  };

  // ── Drop on main board cell ───────────────────────────────

  const handleCellDrop = useCallback(async (
    e: React.DragEvent,
    targetMA: Mitarbeiter,
    targetW: KalenderWoche,
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    const ds = dragStateRef.current;
    if (!ds) return;

    setSaving(true);
    try {
      // ── From Backlog → Main board ──────────────────────────
      if (ds.type === 'backlog') {
        const cells = [...backlogSelectedRef.current].map(k => {
          const [projektId, ...rest] = k.split('__');
          return { projektId, wocheStart: rest.join('__') };
        });
        if (cells.length === 0) return;

        // Only create entries for weeks where the employee has no existing assignment
        const entries = cells
          .filter(c => !einplanungMap.has(`${targetMA.id}__${c.wocheStart}`))
          .map(c => ({
            mitarbeiter_id: targetMA.id,
            projekt_id: c.projektId,
            woche_start: c.wocheStart,
            bestaetigt: false,
            notiz: null,
          }));

        if (entries.length === 0) {
          setDragError('Alle gewählten Wochen sind für diesen Mitarbeiter bereits belegt.');
          return;
        }

        await bulkUpsertEinplanungen(entries);
        updateBacklogSelected(new Set());
        onRefresh();
        return;
      }

      // ── Move einplanung(s) within main board ───────────────
      if (ds.type === 'einplanung' && ds.einplanungId) {
        const targetKey = `${targetMA.id}__${targetW.wocheStart}`;
        const targetExisting = einplanungMap.get(targetKey);
        const sel = selectedRef.current;
        const isMulti = sel.size > 1 && sel.has(ds.einplanungId);

        if (isMulti) {
          const sourceEinp = einplanungById.get(ds.einplanungId);
          if (!sourceEinp) return;

          const sourceIdx = wochen.findIndex(w => w.wocheStart === sourceEinp.woche_start);
          const targetIdx = wochen.findIndex(w => w.wocheStart === targetW.wocheStart);
          const delta = targetIdx - sourceIdx;

          if (delta === 0) { setDragError('Zielwoche ist dieselbe — bitte auf eine andere KW ziehen.'); return; }

          const selectedEinps = einplanungen.filter(e => sel.has(e.id));
          const selectedIds = new Set(selectedEinps.map(e => e.id));

          for (const se of selectedEinps) {
            const idx = wochen.findIndex(w => w.wocheStart === se.woche_start);
            const newIdx = idx + delta;
            if (newIdx < 0 || newIdx >= wochen.length) { setDragError('Verschieben würde einen Block außerhalb des Jahres bewegen.'); return; }
            const occupant = einplanungMap.get(`${se.mitarbeiter_id}__${wochen[newIdx].wocheStart}`);
            if (occupant && !selectedIds.has(occupant.id)) { setDragError('Eine Zielposition ist bereits belegt.'); return; }
          }

          await Promise.all(selectedEinps.map(se => deleteEinplanung(se.id)));
          await bulkUpsertEinplanungen(selectedEinps.map(se => {
            const idx = wochen.findIndex(w => w.wocheStart === se.woche_start);
            return { mitarbeiter_id: se.mitarbeiter_id, projekt_id: se.projekt_id, woche_start: wochen[idx + delta].wocheStart, bestaetigt: se.bestaetigt, notiz: se.notiz };
          }));

        } else {
          if (targetExisting && targetExisting.id !== ds.einplanungId) { setDragError('Zielzelle ist bereits belegt.'); return; }
          if (targetMA.id === ds.mitarbeiterId && targetW.wocheStart === ds.wocheStart) return;
          await moveEinplanung(ds.einplanungId, targetMA.id, targetW.wocheStart);
        }

        updateSelected(new Set());
        onRefresh();
      }
    } catch (err) {
      console.error('Drag-Drop Fehler:', err);
      setDragError('Fehler beim Speichern — bitte Seite neu laden.');
    } finally {
      setSaving(false);
      dragStateRef.current = null;
      setIsDragging(false);
    }
  }, [einplanungen, einplanungMap, einplanungById, wochen, onRefresh]);

  const handleDragEnd = () => {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragOverKey(null);
  };

  // ── Click handlers ────────────────────────────────────────

  const handleCellClick = (e: React.MouseEvent, m: Mitarbeiter, w: KalenderWoche) => {
    const key = `${m.id}__${w.wocheStart}`;
    const einplanung = einplanungMap.get(key) ?? null;
    const abwesenheit = abwesenheitMap.get(key) ?? null;

    if ((e.ctrlKey || e.metaKey) && einplanung) {
      const next = new Set(selectedRef.current);
      next.has(einplanung.id) ? next.delete(einplanung.id) : next.add(einplanung.id);
      updateSelected(next);
      updateBacklogSelected(new Set());
      return;
    }
    updateSelected(new Set());
    setModal({ mitarbeiter: m, woche: w, aktuelleEinplanung: einplanung, aktuelleAbwesenheit: abwesenheit });
  };

  const handleBacklogCellClick = (e: React.MouseEvent, projekt: Projekt, w: KalenderWoche) => {
    const key = `${projekt.id}__${w.wocheStart}`;
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(backlogSelectedRef.current);
      next.has(key) ? next.delete(key) : next.add(key);
      updateBacklogSelected(next);
    } else {
      // Toggle single select
      const next = new Set(backlogSelectedRef.current);
      if (next.has(key) && next.size === 1) next.clear(); else { next.clear(); next.add(key); }
      updateBacklogSelected(next);
    }
    updateSelected(new Set());
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

  // ── KW range helper for backlog label ─────────────────────
  const kwRange = (p: Projekt) => {
    if (!p.startdatum || !p.enddatum) return '';
    const s = getKW(new Date(p.startdatum + 'T00:00:00'));
    const e = getKW(new Date(p.enddatum + 'T00:00:00'));
    return s === e ? `KW${s}` : `KW${s}–${e}`;
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Main board selection bar */}
      {selected.size > 0 && (
        <div style={{ padding: '7px 20px', background: '#1e3358', borderBottom: '1px solid #3b82f655', fontSize: 12, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <strong>{selected.size}</strong>&nbsp;Block{selected.size !== 1 ? 'e' : ''} ausgewählt — ziehe einen davon, um alle gleichzeitig zu verschieben
          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => updateSelected(new Set())}>✕ Auswahl aufheben (Esc)</button>
        </div>
      )}

      {/* Backlog selection bar */}
      {backlogSelected.size > 0 && (
        <div style={{ padding: '7px 20px', background: '#14532d', borderBottom: '1px solid #22c55e55', fontSize: 12, color: '#86efac', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <strong>{backlogSelected.size}</strong>&nbsp;Backlog-Block{backlogSelected.size !== 1 ? 'e' : ''} ausgewählt — auf einen Mitarbeiter ziehen zum Einplanen
          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => updateBacklogSelected(new Set())}>✕ Auswahl aufheben (Esc)</button>
        </div>
      )}

      {/* Drag error */}
      {dragError && (
        <div style={{ padding: '8px 20px', background: '#450a0a', borderBottom: '1px solid #ef444455', fontSize: 12, color: '#fca5a5', flexShrink: 0 }}>
          ⚠ {dragError}
        </div>
      )}

      {/* ── Shared scroll container for both tables ── */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        {saving && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Speichern…</span>
          </div>
        )}

        {/* ════ HAUPTBOARD ════════════════════════════════════ */}
        <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: NAME_W + ROLLE_W + wochen.length * CELL_W }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th colSpan={2} style={{ width: NAME_W + ROLLE_W, minWidth: NAME_W + ROLLE_W, border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Mitarbeiter</th>
              {monatsGruppen.map(g => (
                <th key={g.monat} colSpan={g.wochen.length} style={{ border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'center', fontWeight: 700, background: 'var(--bg-card)', width: g.wochen.length * CELL_W }}>{g.monat}</th>
              ))}
            </tr>
            <tr style={{ background: 'var(--bg-card)' }}>
              <th style={{ width: NAME_W, minWidth: NAME_W, border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Name</th>
              <th style={{ width: ROLLE_W, minWidth: ROLLE_W, border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Rolle</th>
              {wochen.map(w => (
                <th key={w.wocheStart} style={{ width: CELL_W, minWidth: CELL_W, border: '1px solid var(--border)', padding: '4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{w.kw}</th>
              ))}
            </tr>
            <tr style={{ background: '#0f1117' }}>
              <td colSpan={2} style={{ border: '1px solid var(--border)', padding: '3px 8px', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Auslastung</td>
              {wochen.map(w => {
                const pct = auslastungMap.get(w.wocheStart) ?? 0;
                const color = pct >= 80 ? '#15803d' : pct >= 50 ? '#92400e' : '#7f1d1d';
                return <td key={w.wocheStart} style={{ border: '1px solid var(--border)', padding: '3px 2px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#fff', background: color }}>{pct}%</td>;
              })}
            </tr>
          </thead>
          <tbody>
            {sortierteMitarbeiter.map((m, idx) => (
              <tr key={m.id} style={{ background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f' }}>
                <td style={{ border: '1px solid var(--border)', padding: '5px 8px', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f', zIndex: 1 }}>{m.name}</td>
                <td style={{ border: '1px solid var(--border)', padding: '5px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap', position: 'sticky', left: NAME_W, background: idx % 2 === 0 ? 'var(--bg-base)' : '#12151f', zIndex: 1 }}>{m.rolle}</td>
                {wochen.map(w => {
                  const key = `${m.id}__${w.wocheStart}`;
                  const einplanung = einplanungMap.get(key) ?? null;
                  const abwesenheit = abwesenheitMap.get(key) ?? null;
                  const projekt = einplanung ? projektMap.get(einplanung.projekt_id) : null;
                  const isSelected = einplanung ? selected.has(einplanung.id) : false;
                  const isDragOver = dragOverKey === key;
                  const isDraggingThis = dragStateRef.current?.einplanungId === einplanung?.id;

                  let cellBg = 'transparent', cellText = '', cellColor = 'var(--text-muted)', cellBorder = '1px solid var(--border)';
                  if (abwesenheit) { cellBg = ABWESENHEIT_FARBEN[abwesenheit.typ] ?? '#374151'; cellText = abwesenheit.typ; cellColor = '#9ca3af'; }
                  else if (projekt) {
                    cellBg = einplanung!.bestaetigt ? projekt.farbe : projekt.farbe + '55';
                    cellText = projekt.name; cellColor = '#fff';
                    if (!einplanung!.bestaetigt) cellBorder = `2px dashed ${projekt.farbe}`;
                  }
                  let outline = 'none';
                  const opacity = isDraggingThis ? 0.35 : 1;
                  if (isSelected) outline = '2px solid #facc15';
                  if (isDragOver) { outline = '2px solid #60a5fa'; if (cellBg === 'transparent') cellBg = '#1e3a5f44'; }

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
                      title={projekt ? `${projekt.name}${!einplanung?.bestaetigt ? ' (Platzhalter)' : ''}${isSelected ? ' · Ausgewählt' : ''}` : abwesenheit ? abwesenheit.typ : isDragging ? 'Hier ablegen' : 'Klicken · Ctrl+Klick zum Auswählen'}
                      style={{ border: cellBorder, padding: '4px', textAlign: 'center', background: cellBg, color: cellColor, cursor: einplanung && !abwesenheit ? (isDragging ? 'copy' : 'grab') : isDragging ? 'crosshair' : 'pointer', fontSize: 11, maxWidth: CELL_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity, outline, outlineOffset: '-2px', userSelect: 'none', transition: 'background 0.05s' }}
                      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.filter = 'brightness(1.2)'; }}
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

        {/* ════ ARBEITSVORRAT-BACKLOG ══════════════════════════ */}
        <div style={{ borderTop: '3px solid var(--border)', marginTop: 8 }}>
          {/* Backlog header row */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#0a0f1a', padding: '8px 12px', borderBottom: '1px solid var(--border)', minWidth: NAME_W + ROLLE_W + wochen.length * CELL_W, gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', minWidth: NAME_W + ROLLE_W - 12 }}>
              Arbeitsvorrat
            </span>
            {backlogProjekte.length > 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Ctrl+Klick zum Mehrfachauswählen · auf einen Mitarbeiter ziehen zum Einplanen
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Alle Projekte sind bereits eingeplant — neue Projekte ohne Einplanung erscheinen hier
              </span>
            )}
          </div>

          {backlogProjekte.length > 0 && (
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: NAME_W + ROLLE_W + wochen.length * CELL_W }}>
              <tbody>
                {backlogProjekte.map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 === 0 ? '#0d1117' : '#0a0e16' }}>
                    {/* Sticky project name */}
                    <td style={{ border: '1px solid var(--border)', padding: '5px 8px', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: idx % 2 === 0 ? '#0d1117' : '#0a0e16', zIndex: 1, width: NAME_W, minWidth: NAME_W, color: p.farbe }}>
                      {p.name}
                    </td>
                    {/* KW range label */}
                    <td style={{ border: '1px solid var(--border)', padding: '5px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap', position: 'sticky', left: NAME_W, background: idx % 2 === 0 ? '#0d1117' : '#0a0e16', zIndex: 1, width: ROLLE_W, minWidth: ROLLE_W, fontSize: 11 }}>
                      {kwRange(p)}
                    </td>
                    {/* KW cells */}
                    {wochen.map(w => {
                      const isInRange = !!p.startdatum && !!p.enddatum
                        && w.wocheStart >= p.startdatum
                        && w.wocheStart <= p.enddatum;

                      if (!isInRange) {
                        return <td key={w.wocheStart} style={{ border: '1px solid var(--border)', width: CELL_W, minWidth: CELL_W, background: 'transparent' }} />;
                      }

                      const bkey = `${p.id}__${w.wocheStart}`;
                      const isBSelected = backlogSelected.has(bkey);

                      return (
                        <td
                          key={w.wocheStart}
                          draggable
                          onDragStart={e => handleBacklogDragStart(e, p, w.wocheStart)}
                          onDragEnd={handleDragEnd}
                          onClick={e => handleBacklogCellClick(e, p, w)}
                          title={`${p.name} ${w.kw} · Klick zum Auswählen · Ctrl+Klick für Mehrfachauswahl`}
                          style={{
                            border: '1px solid var(--border)',
                            width: CELL_W, minWidth: CELL_W,
                            padding: '4px',
                            textAlign: 'center',
                            background: isBSelected ? p.farbe : p.farbe + '66',
                            color: '#fff',
                            fontSize: 11,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            outline: isBSelected ? '2px solid #facc15' : 'none',
                            outlineOffset: '-2px',
                            fontWeight: isBSelected ? 700 : 400,
                            transition: 'background 0.05s',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => { if (!isDragging) e.currentTarget.style.filter = 'brightness(1.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
                        >
                          {p.name}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
