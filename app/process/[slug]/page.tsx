import { ProcessModulePage } from "@/components/process-module-page";
import { processPageConfigs } from "@/lib/process-pages";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return Object.keys(processPageConfigs).map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!processPageConfigs[slug]) {
    notFound();
  }

  return <ProcessModulePage slug={slug} />;
}
