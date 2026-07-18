import type { Metadata } from "next";
import { LiveDataReset } from "@/components/live-data-reset";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://coachforlife.cflb.in"),
  title: "Coach For Life",
  description: "Coach For Life",
  openGraph: {
    title: "Coach For Life",
    description: "Coach For Life",
    siteName: "Coach For Life",
    images: [
      {
        url: "/brand/coach-for-life-logo-horizontal.png",
        width: 1080,
        height: 1080,
        alt: "Coach For Life"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Coach For Life",
    description: "Coach For Life",
    images: ["/brand/coach-for-life-logo-horizontal.png"]
  }
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
