'use client';

import { useState } from 'react';
import type { Mitarbeiter, Projekt, Einplanung, Abwesenheit, KalenderWoche, AbwesenheitTyp } from '@/types';
import { getMontag, toISODate, generiereKalenderwochen } from '@/lib/kalender';
import { createAbwesenheit, deleteAbwesenheit } from '@/lib/supabase';

const ABW_TYPEN: AbwesenheitTyp[] = ['Urlaub', 'Elternzeit', 'Schule', 'Krank', 'Ausgeschieden', 'Sonstiges'];

const ABW_FARBEN: Record<AbwesenheitTyp, string> = {
  Urlaub:       '#f59e0b',
  Elternzeit:   '#3b82f6',
  Schule:       '#8b5cf6',
  Krank:        '#ef4444',
  Ausgeschieden:'#6b7280',
  Sonstiges:    '#6b7280',
};

type Tab = 'projekt' | 'abwesenheit';

interface Props {
  mitarbeiter: Mitarbeiter;
  woche: KalenderWoche;
  projekte: Projekt[];
  aktuelleEinplanung: Einplanung | null;
  aktuelleAbwesenheit: Abwesenheit | null;
  saving: boolean;
  onSave: (projektId: string | null, bestaetigt: boolean, notiz: string) => void;
  onAbwesenheitSaved: () => void;
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
  onAbwesenheitSaved,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(aktuelleAbwesenheit ? 'abwesenheit' : 'projekt');
  const [projektId, setProjektId] = useState<string>(aktuelleEinplanung?.projekt_id ?? '');
  const [bestaetigt, setBestaetigt] = useState(aktuelleEinplanung?.bestaetigt ?? false);
  const [notiz, setNotiz] = useState(aktuelleEinplanung?.notiz ?? '');

  // Abwesenheit-Formular
  const [abwTyp, setAbwTyp] = useState<AbwesenheitTyp>(aktuelleAbwesenheit?.typ ?? 'Urlaub');
  const [abwBis, setAbwBis] = useState(aktuelleAbwesenheit?.woche_ende ?? '');
  const [abwNotiz, setAbwNotiz] = useState(aktuelleAbwesenheit?.notiz ?? '');
  const [abwSaving, setAbwSaving] = useState(false);

  const aktiveProjekte = projekte.filter(p => p.status !== 'abgeschlossen');

  // Abwesenheit speichern
  const handleAbwSave = async () => {
    setAbwSaving(true);
    try {
      await createAbwesenheit({
        mitarbeiter_id: mitarbeiter.id,
        typ: abwTyp,
        woche_start: woche.wocheStart,
        woche_ende: abwBis
          ? toISODate(getMontag(new Date(abwBis)))
          : null,
        notiz: abwNotiz || null,
      });
      onAbwesenheitSaved();
      onClose();
    } finally {
      setAbwSaving(false);
    }
  };

  const handleAbwLoeschen = async () => {
    if (!aktuelleAbwesenheit) return;
    setAbwSaving(true);
    try {
      await deleteAbwesenheit(aktuelleAbwesenheit.id);
      onAbwesenheitSaved();
      onClose();
    } finally {
      setAbwSaving(false);
    }
  };

  // Berechne Wochen-Anzahl für Abwesenheit-Vorschau
  const abwWochen = abwBis
    ? generiereKalenderwochen(new Date(woche.wocheStart), new Date(abwBis)).length
    : 1;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 420, maxWidth: '95vw',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {mitarbeiter.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            KW {woche.kw} · {woche.monat} {woche.jahr}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
          {(['projekt', 'abwesenheit'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
              {t === 'projekt' ? '🏗️ Projekt' : '📅 Abwesenheit'}
            </button>
          ))}
        </div>

        {/* Tab: Projekt */}
        {tab === 'projekt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {aktuelleAbwesenheit && (
              <div style={{ background: '#292524', border: '1px solid #78350f', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#fbbf24' }}>
                ⚠ Aktuell: <strong>{aktuelleAbwesenheit.typ}</strong> – Projekt-Einplanung trotzdem möglich
              </div>
            )}
            <div>
              <label>Projekt</label>
              <select value={projektId} onChange={e => setProjektId(e.target.value)}>
                <option value="">— kein Projekt (Zuweisung entfernen) —</option>
                {aktiveProjekte.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.auftraggeber ? ` · ${p.auftraggeber}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="bestaetigt" checked={bestaetigt}
                onChange={e => setBestaetigt(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
              <label htmlFor="bestaetigt" style={{ margin: 0, cursor: 'pointer', fontSize: 13 }}>
                Bestätigt (kein Platzhalter)
              </label>
            </div>
            <div>
              <label>Notiz (optional)</label>
              <input type="text" value={notiz} onChange={e => setNotiz(e.target.value)}
                placeholder="z.B. Montag frei, ab Dienstag" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Abbrechen</button>
              {aktuelleEinplanung && (
                <button className="btn btn-danger" onClick={() => onSave(null, false, '')} disabled={saving}>
                  Entfernen
                </button>
              )}
              <button className="btn btn-primary"
                onClick={() => onSave(projektId || null, bestaetigt, notiz)}
                disabled={saving || (!projektId && !aktuelleEinplanung)}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Abwesenheit */}
        {tab === 'abwesenheit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {aktuelleAbwesenheit ? (
              <div style={{
                background: 'var(--bg-input)', borderRadius: 8, padding: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                    background: ABW_FARBEN[aktuelleAbwesenheit.typ] + '33',
                    color: ABW_FARBEN[aktuelleAbwesenheit.typ],
                    fontWeight: 600, fontSize: 12, marginBottom: 4,
                  }}>
                    {aktuelleAbwesenheit.typ}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {aktuelleAbwesenheit.woche_start}
                    {aktuelleAbwesenheit.woche_ende ? ` bis ${aktuelleAbwesenheit.woche_ende}` : ' (1 Woche)'}
                  </div>
                  {aktuelleAbwesenheit.notiz && (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{aktuelleAbwesenheit.notiz}</div>
                  )}
                </div>
                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={handleAbwLoeschen} disabled={abwSaving}>
                  {abwSaving ? '…' : 'Löschen'}
                </button>
              </div>
            ) : (
              <>
                {/* Typ-Auswahl */}
                <div>
                  <label>Art der Abwesenheit</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {ABW_TYPEN.map(t => (
                      <button key={t} onClick={() => setAbwTyp(t)} style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600,
                        background: abwTyp === t ? ABW_FARBEN[t] : 'var(--bg-input)',
                        color: abwTyp === t ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bis wann */}
                <div>
                  <label>Bis (Ende der Abwesenheit, optional)</label>
                  <input type="date" value={abwBis} onChange={e => setAbwBis(e.target.value)}
                    min={woche.wocheStart} />
                  {abwBis && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {abwWochen} {abwWochen === 1 ? 'Woche' : 'Wochen'} werden markiert
                    </div>
                  )}
                </div>

                <div>
                  <label>Notiz (optional)</label>
                  <input type="text" value={abwNotiz} onChange={e => setAbwNotiz(e.target.value)}
                    placeholder="z.B. Genehmigt von..." />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={onClose} disabled={abwSaving}>Abbrechen</button>
                  <button className="btn btn-primary" onClick={handleAbwSave} disabled={abwSaving}>
                    {abwSaving ? 'Speichern…' : `${abwWochen} ${abwWochen === 1 ? 'Woche' : 'Wochen'} eintragen`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
