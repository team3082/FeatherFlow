"use client";

import localFont from 'next/font/local';
import "./globals.css";

const spaceGrotesk = localFont({
  src: '../../public/fonts/SpaceGrotesk-Variable.woff2',
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: '300 700',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <body
          className={` ${spaceGrotesk.variable} antialiased`}
          // onContextMenu={(e) => e.preventDefault()}
        >
          {children}
        </body>
    </html>
  );
}

