"use client";

import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";


const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
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
          onContextMenu={(e) => e.preventDefault()}
        >
          {children}
        </body>
    </html>
  );
}

