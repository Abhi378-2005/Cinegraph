// frontend/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NavbarWrapper } from '@/components/layout/NavbarWrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CineGraph — Watch algorithms discover what you'll love next",
  description:
    'A movie recommendation engine that makes its internals transparent — see the graph similarity matrix build, community clusters form, and ranking sort execute.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <NavbarWrapper />
        {children}
      </body>
    </html>
  );
}
