import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workflow Automation — Coach For Life",
  description: "Build and test visual business automations for Coach For Life."
};

export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  return children;
}
