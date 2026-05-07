import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Einsatzplanung – Herbstritt Haustechnik',
  description: 'Monteur-Einsatzplanung',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let email: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? undefined;
  } catch {
    // not logged in yet (login page)
  }

  return (
    <html lang="de">
      <body style={{ display: 'flex', minHeight: '100vh', margin: 0 }}>
        <Sidebar email={email} />
        <main style={{ flex: 1, overflowX: 'auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
