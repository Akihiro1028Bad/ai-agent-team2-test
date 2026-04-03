import React from 'react';
import { Header } from '../src/components/Header';
import './globals.css';

export const metadata = {
  title: 'Sample App',
  description: 'Next.js + TypeScript サンプルアプリケーション',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
