import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'WealthSync - Centralized Personal Finance & Lifestyle Expense Management',
  description:
    'Master your cashflow, grocery spending, and Shopee online orders with intelligent auto-tagging, receipt statement parsing, dynamic budget caps, and savings vaults.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WealthSync',
  },
  keywords: [
    'personal finance',
    'budgeting',
    'shopee expense tracker',
    'gcash tracker',
    'wealthsync',
    'groceries tracker',
    'cashflow management',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 antialiased selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
