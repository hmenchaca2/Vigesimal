import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vigesimal · Payload Lab',
  description: 'Compare structured JSON payloads, verify round-trips, and keep the smaller format. Data stays in your browser.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
