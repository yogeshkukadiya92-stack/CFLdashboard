"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { WorkflowPlayground } from "@/components/workflow-playground";

export default function WorkflowsPage() {
  return (
    <AdminPlatformShell
      activeLabel="Workflow Automation"
      description="Design connected customer journeys across registration, CRM, workshops, attendance and messaging."
      title="Workflow Automation"
    >
      <WorkflowPlayground />
    </AdminPlatformShell>
  );
}
