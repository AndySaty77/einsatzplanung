export const dynamic = 'force-dynamic';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { passwortAendern } from './actions';

const ERRORS: Record<string, string> = {
  wrong: 'Das aktuelle Passwort ist nicht korrekt.',
  mismatch: 'Die neuen Passwörter stimmen nicht überein.',
  short: 'Das neue Passwort muss mindestens 8 Zeichen lang sein.',
  update: 'Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.',
  auth: 'Authentifizierungsfehler. Bitte erneut anmelden.',
};

export default async function EinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const errorMsg = params.error ? ERRORS[params.error] ?? 'Ein Fehler ist aufgetreten.' : null;
  const success = params.success === '1';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600, width: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Einstellungen</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Konto & Sicherheit
        </p>
      </div>

      {/* Konto-Info */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'var(--accent)', opacity: 0.85,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {user?.email?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.email}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Angemeldet</div>
        </div>
      </div>

      {/* Passwort ändern */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '24px 24px',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Passwort ändern</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Mindestens 8 Zeichen. Das neue Passwort gilt ab der nächsten Anmeldung.
        </div>

        {success && (
          <div style={{
            background: '#16532920',
            border: '1px solid #16532950',
            borderRadius: 7,
            padding: '10px 14px',
            fontSize: 13,
            color: '#86efac',
            marginBottom: 18,
          }}>
            Passwort erfolgreich geändert.
          </div>
        )}

        {errorMsg && (
          <div style={{
            background: '#7c2d1220',
            border: '1px solid #7c2d1250',
            borderRadius: 7,
            padding: '10px 14px',
            fontSize: 13,
            color: '#fca5a5',
            marginBottom: 18,
          }}>
            {errorMsg}
          </div>
        )}

        <form action={passwortAendern} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { name: 'currentPassword', label: 'Aktuelles Passwort' },
            { name: 'newPassword', label: 'Neues Passwort' },
            { name: 'confirmPassword', label: 'Neues Passwort bestätigen' },
          ].map(({ name, label }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: '#bfc3e0', fontWeight: 500 }}>{label}</label>
              <input
                name={name}
                type="password"
                required
                placeholder="••••••••"
                style={{
                  background: '#1e2235',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            style={{
              marginTop: 4,
              padding: '10px 20px',
              borderRadius: 7,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Passwort ändern
          </button>
        </form>
      </div>
    </div>
  );
}
