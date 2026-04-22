import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Check Register',
  description: 'Self-hosted personal finance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
