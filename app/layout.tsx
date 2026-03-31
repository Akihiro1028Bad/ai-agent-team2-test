import React from 'react';

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
      <body>{children}</body>
    </html>
  );
}
