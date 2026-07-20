"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { hydratePublicRegistrationState, LIVE_STATE_STORAGE_KEYS, readLocalArray } from "@/lib/live-state";
import type { LandingPageRecord } from "@/lib/types";

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      const slug = String(params.slug ?? "").toLowerCase();
      const match = readLocalArray<LandingPageRecord>(LIVE_STATE_STORAGE_KEYS.landingPages)
        .find((item) => item.slug.toLowerCase() === slug && item.published);
      setPage(match ?? null);
      setLoading(false);
    }
    load();
    void hydratePublicRegistrationState().then(load);
  }, [params.slug]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">Loading page...</div>;
  if (!page) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <div className="max-w-md text-center"><img alt="Coach For Life" className="mx-auto h-24 w-auto" src="/brand/coach-for-life-logo-stacked.png" /><h1 className="mt-6 text-3xl font-black">Page not available</h1><p className="mt-3 text-slate-500">This landing page is unpublished or the link has changed.</p></div>
      </main>
    );
  }

  return <LandingPageRenderer page={page} />;
}
