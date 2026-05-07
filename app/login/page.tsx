import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === '1';
  const noAccess = params.error === 'access';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#5DC9AD',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="5" height="18" rx="1" fill="white" />
              <rect x="15" y="2" width="5" height="18" rx="1" fill="white" />
              <rect x="2" y="8.5" width="18" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#c8cde8', lineHeight: 1.2 }}>Herbstritt</div>
            <div style={{ fontSize: 13, color: '#8a8fb0', lineHeight: 1.2 }}>Haustechnik</div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '32px 28px',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Anmelden</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Einsatzplanung – Interner Zugang
          </p>

          {hasError && (
            <div style={{ background: '#7c2d1220', border: '1px solid #7c2d1250', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 18 }}>
              E-Mail oder Passwort ist falsch.
            </div>
          )}
          {noAccess && (
            <div style={{ background: '#7c2d1220', border: '1px solid #7c2d1250', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 18 }}>
              Kein Zugriff auf die Einsatzplanung. Bitte Administrator kontaktieren.
            </div>
          )}

          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: '#bfc3e0', fontWeight: 500 }}>E-Mail</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@herbstritt.de"
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: '#bfc3e0', fontWeight: 500 }}>Passwort</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
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

            <button
              type="submit"
              style={{
                marginTop: 4,
                padding: '11px 0',
                borderRadius: 7,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Anmelden
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 20 }}>
          © 2026 Herbstritt Haustechnik GmbH
        </p>
      </div>
    </div>
  );
}
