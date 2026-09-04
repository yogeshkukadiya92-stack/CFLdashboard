import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Connection, WorkflowNode } from "@/lib/workflow-studio";

export type EnterpriseRole = { id: string; name: string; permissions: string[]; members: number };
export type EnterpriseEnvironment = { id: "development" | "staging" | "production"; version: number; status: "ready" | "review" | "live"; promotedAt?: string; promotedBy?: string };
export type EnterpriseSettings = { roles: EnterpriseRole[]; environments: EnterpriseEnvironment[]; templates: Array<{ id: string; name: string; language: string; status: "approved" | "pending" | "rejected"; variables: string[] }>; comments: Array<{ id: string; text: string; author: string; createdAt: string; resolved: boolean }>; alertRules: Array<{ id: string; name: string; severity: string; channel: string; enabled: boolean }>; folders: Array<{ id: string; name: string; color: string }>; workflowFolderId: string; tags: string[] };
export type EnterpriseOverview = EnterpriseSettings & { credentials: Array<{ id: string; name: string; provider: string; environment: string; maskedValue: string; updatedAt: string }>; workflowLibrary: Array<{ id: string; name: string; status: string; version: number; folderId: string; tags: string[]; updatedAt: string }>; analytics: { executions: number; successRate: number; averageDurationMs: number; estimatedConversions: number; revenueAttributed: number }; readiness: Array<{ key: string; label: string; ready: boolean }> };

export const defaultEnterpriseSettings: EnterpriseSettings = {
  roles: [
    { id: "admin", name: "Administrator", permissions: ["build", "approve", "deploy", "credentials", "analytics"], members: 1 },
    { id: "manager", name: "Manager", permissions: ["build", "approve", "analytics"], members: 0 },
    { id: "builder", name: "Workflow Builder", permissions: ["build", "simulate"], members: 0 },
    { id: "viewer", name: "Read only", permissions: ["view", "analytics"], members: 0 }
  ],
  environments: [{ id: "development", version: 0, status: "ready" }, { id: "staging", version: 0, status: "review" }, { id: "production", version: 0, status: "live" }],
  templates: [
    { id: "tpl-registration", name: "Registration confirmation", language: "en_GB", status: "approved", variables: ["name", "workshop", "date", "venue"] },
    { id: "tpl-reminder", name: "Workshop reminder", language: "en_GB", status: "approved", variables: ["name", "workshop", "time"] },
    { id: "tpl-payment", name: "Payment follow-up", language: "en_GB", status: "pending", variables: ["name", "amount", "link"] }
  ],
  comments: [],
  alertRules: [{ id: "alert-critical", name: "Critical workflow failure", severity: "critical", channel: "WhatsApp + dashboard", enabled: true }, { id: "alert-sla", name: "Incident unowned for 15 minutes", severity: "high", channel: "Dashboard", enabled: true }],
  folders: [{ id: "growth", name: "Growth automations", color: "indigo" }, { id: "operations", name: "Operations", color: "emerald" }, { id: "finance", name: "Finance", color: "rose" }],
  workflowFolderId: "growth",
  tags: ["registration", "workshop"]
};

export function normalizeEnterpriseSettings(value: unknown): EnterpriseSettings {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<EnterpriseSettings> : {};
  return {
    roles: Array.isArray(source.roles) ? source.roles.slice(0, 12) : defaultEnterpriseSettings.roles,
    environments: Array.isArray(source.environments) ? source.environments.slice(0, 3) : defaultEnterpriseSettings.environments,
    templates: Array.isArray(source.templates) ? source.templates.slice(0, 100) : defaultEnterpriseSettings.templates,
    comments: Array.isArray(source.comments) ? source.comments.slice(0, 100) : [],
    alertRules: Array.isArray(source.alertRules) ? source.alertRules.slice(0, 30) : defaultEnterpriseSettings.alertRules,
    folders: Array.isArray(source.folders) ? source.folders.slice(0, 50) : defaultEnterpriseSettings.folders,
    workflowFolderId: String(source.workflowFolderId || "growth").slice(0, 80),
    tags: Array.isArray(source.tags) ? source.tags.map(String).map((item) => item.slice(0, 40)).slice(0, 20) : defaultEnterpriseSettings.tags
  };
}

function encryptionKey() {
  const configured = process.env.WORKFLOW_CREDENTIAL_KEY?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("WORKFLOW_CREDENTIAL_KEY must be configured in production.");
  return createHash("sha256").update(configured || "cfl-local-workflow-credential-key").digest();
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCredential(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function maskCredential(value: string) { return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`; }

export function generateWorkflowFromPrompt(prompt: string): { name: string; nodes: WorkflowNode[]; connections: Connection[]; explanation: string } {
  const value = prompt.toLowerCase();
  const nodes: WorkflowNode[] = [{ id: "ai-trigger", kind: "trigger", title: value.includes("payment") ? "Payment received" : "Registration received", subtitle: "AI generated trigger", x: 80, y: 260, config: { event: value.includes("payment") ? "Payment completed" : "New public registration", deduplicate: true } }];
  if (value.includes("city") || value.includes("date") || value.includes("if")) nodes.push({ id: "ai-condition", kind: "condition", title: "Route by city & date", subtitle: "AI generated condition", x: 320, y: 260, config: { field: "Registration city", operator: "Equals", value: "Ahmedabad", branchA: "Matches", branchB: "Otherwise" } });
  if (value.includes("assign") || value.includes("sales") || value.includes("lead")) nodes.push({ id: "ai-assign", kind: "crm", title: "Assign sales person", subtitle: "Smart workload routing", x: 560, y: 260, config: { fallbackStrategy: "least-active", assignmentRules: [], continueOnError: true } });
  if (value.includes("workshop") || value.includes("batch")) nodes.push({ id: "ai-workshop", kind: "workshop", title: "Assign workshop & batch", subtitle: "Capacity aware", x: 800, y: 260, config: { workshop: "Business Growth Blueprint", batch: "Best available batch", capacity: "Respect capacity" } });
  if (value.includes("whatsapp") || value.includes("message") || value.includes("remind")) nodes.push({ id: "ai-message", kind: "message", title: "Send WhatsApp template", subtitle: "Approved template", x: 1040, y: 260, config: { template: "cfl_registration_confirmation_v3", recipient: "{{registration.mobile}}", retry: true, attempts: 3 } });
  if (nodes.length === 1) nodes.push({ id: "ai-followup", kind: "crm", title: "Create CRM follow-up", subtitle: "AI generated action", x: 320, y: 260, config: { action: "Create follow-up", due: "Today" } });
  const connections = nodes.slice(1).map((node, index) => ({ id: `ai-c-${index}`, from: nodes[index].id, to: node.id }));
  return { name: prompt.trim().slice(0, 80) || "AI generated workflow", nodes, connections, explanation: `Created ${nodes.length} connected nodes using safe defaults. Review recipients and credentials before activation.` };
}

export function applyTransform(input: Record<string, unknown>, config: Record<string, unknown>) {
  const output = { ...input };
  const target = String(config.targetField || "normalizedValue").slice(0, 80);
  const source = String(config.sourceField || "fullName").slice(0, 80);
  const operation = String(config.operation || "trim");
  const value = output[source];
  output[target] = operation === "uppercase" ? String(value ?? "").toUpperCase() : operation === "lowercase" ? String(value ?? "").toLowerCase() : operation === "number" ? Number(value || 0) : String(value ?? "").trim();
  return output;
}
