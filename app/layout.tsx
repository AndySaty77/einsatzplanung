import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Einsatzplanung – Herbstritt Haustechnik",
  description: "Monteur-Einsatzplanung",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body style={{ display: 'flex', minHeight: '100vh', margin: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, overflowX: 'auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
