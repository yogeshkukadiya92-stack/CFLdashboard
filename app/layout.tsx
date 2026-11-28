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
          id="meta-pixel"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
 n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
 n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
 t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
 document,'script','https://connect.facebook.net/en_US/fbevents.js');
 fbq('init', '452599152513047');
 fbq('track', 'PageView');`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.remove('dark');try{localStorage.setItem('cfl-theme','light');}catch(e){}})();`
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
