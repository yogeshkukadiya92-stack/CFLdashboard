import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CFL OS | Business Operating System",
  description:
    "AI-powered business operating system for workshops, training institutes, coaches, and education brands."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
