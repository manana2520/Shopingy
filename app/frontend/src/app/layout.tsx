import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Shopingy Dashboard',
  description: 'Retail real estate intelligence platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="ml-60 min-h-screen p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
