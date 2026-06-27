import type { Metadata } from "next";
import { LiveDataReset } from "@/components/live-data-reset";
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
    <html data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cfl-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <LiveDataReset />
        {children}
      </body>
    </html>
  );
}
