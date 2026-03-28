import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { KaiChatProvider } from '@/lib/kai-context';
import KaiWidget from '@/components/kai/KaiWidget';

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
        <KaiChatProvider>
          <Navbar />
          <main className="ml-60 min-h-screen p-8">
            {children}
          </main>
          <KaiWidget />
        </KaiChatProvider>
      </body>
    </html>
  );
}
