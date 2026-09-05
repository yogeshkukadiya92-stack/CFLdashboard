"use client";

import {
  AlertCircle,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Upload,
  Library,
  GitBranch,
  GripVertical,
  History,
  LayoutGrid,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Trash2,
  Undo2,
  UserPlus,
  UsersRound,
  Webhook,
  Workflow,
  X,
  Zap,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EmptySearch,
  KeyCap,
  MenuAction,
  NodePicker,
  OutputPanel,
  ParametersPanel,
  RunDetail,
  RunStatusBadge,
  SettingsPanel,
  ShortcutDialog,
  ValidationPopover,
  VersionHistory,
  type InspectorTab,
} from "@/components/workflow-studio-panels";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  NODE_HEIGHT,
  NODE_WIDTH,
  WORKFLOW_STORAGE_KEY,
  catalog,
  cloneSnapshot,
  colorByKind,
  defaultConfigForItem,
  initialConnections,
  initialNodes,
  initialRuns,
  validateWorkflow,
  type CatalogItem,
  type ConfigValue,
  type Connection,
  type ExecutionNodeStatus,
  type NodeKind,
  type PickerContext,
  type RunRow,
  type Snapshot,
  type WorkflowSalesPerson,
  type WhatsAppAutomationOverview,
  type AttendanceAutomationOverview,
  type PaymentAutomationOverview,
  type CrmAutomationOverview,
  type WorkflowReliabilityOverview,
  type WorkflowVersionSummary,
  type WorkflowScheduleOverview,
  type WorkflowGovernanceOverview,
  type WorkflowIncidentOverview,
  type WorkflowEnterpriseOverview,
  type WorkflowNode,
} from "@/lib/workflow-studio";
import { parseWorkflowImport, workflowTemplates, type WorkflowTemplate } from "@/lib/workflow-templates";
import { WorkflowEnterpriseHub } from "@/components/workflow-enterprise-hub";

type SaveState = "saved" | "saving" | "unsaved";

function NodeIcon({ kind }: { kind: NodeKind }) {
  const icons = { trigger: Zap, condition: GitBranch, transform: Braces, crm: UserPlus, workshop: Workflow, attendance: UsersRound, message: MessageCircle, payment: CircleDollarSign, delay: Clock3, webhook: Webhook };
  const Icon = icons[kind];
  return <Icon className="size-4" />;
}

export function WorkflowPlayground({ initialWorkflowId = "workshop-registration-onboarding", fullScreen = false, onExit, onOpenWorkflow }: {
  initialWorkflowId?: string; fullScreen?: boolean; onExit?: () => void; onOpenWorkflow?: (id: string) => void;
}) {
  const storageKey = `${WORKFLOW_STORAGE_KEY}:${initialWorkflowId}`;
  const [loadError, setLoadError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const savedDocumentRef = useRef("");
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autosaveTimerRef = useRef<number | undefined>(undefined);
  const documentRef = useRef("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const dragHistoryCapturedRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workflowName, setWorkflowName] = useState("Workshop Registration & Onboarding");
  const [active, setActive] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [testing, setTesting] = useState(false);
  const [zoom, setZoom] = useState(0.52);
  const [pan, setPan] = useState({ x: 14, y: 28 });
  const [query, setQuery] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [focusMode, setFocusMode] = useState(fullScreen);
  // Keep the canvas as the default workspace. The full library remains available
  // as an optional panel, while the faster searchable picker is the primary way
  // to add a node.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [executionsOpen, setExecutionsOpen] = useState(!fullScreen);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [noteOpen, setNoteOpen] = useState(!fullScreen);
  const [noteText, setNoteText] = useState("Batch operations\nIf capacity is full, preserve the source and send the waiting-list template.");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("parameters");
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [pickerContext, setPickerContext] = useState<PickerContext | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [executionState, setExecutionState] = useState<Record<string, ExecutionNodeStatus>>({});
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [workflowVersion, setWorkflowVersion] = useState(0);
  const [salesPeople, setSalesPeople] = useState<WorkflowSalesPerson[]>([]);
  const [storageMode, setStorageMode] = useState<"loading" | "cloud" | "browser">("loading");
  const [whatsappOverview, setWhatsappOverview] = useState<WhatsAppAutomationOverview>({ counts: {}, retryDue: 0, activity: [] });
  const [whatsappActivityOpen, setWhatsappActivityOpen] = useState(false);
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [attendanceOverview, setAttendanceOverview] = useState<AttendanceAutomationOverview>({ counts: { checkedIn: 0, late: 0, completed: 0, promoted: 0, noShowRisk: 0 }, upcomingSessions: 0, activity: [] });
  const [attendanceActivityOpen, setAttendanceActivityOpen] = useState(false);
  const [paymentOverview, setPaymentOverview] = useState<PaymentAutomationOverview>({ counts: {}, collected: 0, outstanding: 0, dueRegistrations: 0, activity: [] });
  const [paymentActivityOpen, setPaymentActivityOpen] = useState(false);
  const [crmOverview, setCrmOverview] = useState<CrmAutomationOverview>({ counts: { pending: 0, overdue: 0, today: 0, slaRisk: 0, unassigned: 0 }, activity: [] });
  const [crmActivityOpen, setCrmActivityOpen] = useState(false);
  const [crmProcessing, setCrmProcessing] = useState(false);
  const [workflowVersions, setWorkflowVersions] = useState<WorkflowVersionSummary[]>([]);
  const [reliability, setReliability] = useState<WorkflowReliabilityOverview>({ total: 0, success: 0, failed: 0, running: 0, successRate: 100, p95DurationMs: 0, slowNodes: [] });
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [replayingExecution, setReplayingExecution] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [scheduleOverview, setScheduleOverview] = useState<WorkflowScheduleOverview>({ active: 0, nextRunAt: null, schedules: [], history: [] });
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [scheduleProcessing, setScheduleProcessing] = useState(false);
  const [governance, setGovernance] = useState<WorkflowGovernanceOverview>({ currentVersion: 0, approvedVersion: null, pending: 0, approvals: [], audit: [] });
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [governanceProcessing, setGovernanceProcessing] = useState(false);
  const [incidentOverview, setIncidentOverview] = useState<WorkflowIncidentOverview>({ open: 0, acknowledged: 0, resolved: 0, critical: 0, incidents: [] });
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const [incidentProcessing, setIncidentProcessing] = useState("");
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [enterprise, setEnterprise] = useState<WorkflowEnterpriseOverview>({ roles: [], environments: [], templates: [], comments: [], alertRules: [], folders: [], workflowFolderId: "", tags: [], credentials: [], workflowLibrary: [], analytics: { executions: 0, successRate: 100, averageDurationMs: 0, estimatedConversions: 0, revenueAttributed: 0 }, readiness: [] });

  useEffect(() => {
    let cancelled = false;
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "null") as {
        nodes?: WorkflowNode[];
        connections?: Connection[];
        name?: string;
        active?: boolean;
        note?: string;
      } | null;
      const validNodes = value?.nodes?.length && value.nodes.every((node) => node.kind in colorByKind && node.config && Number.isFinite(node.x) && Number.isFinite(node.y));
      if (validNodes) setNodes(value.nodes!);
      if (validNodes && value?.connections?.length) setConnections(value.connections);
      if (value?.name) setWorkflowName(value.name);
      if (typeof value?.active === "boolean") setActive(value.active);
      if (typeof value?.note === "string") setNoteText(value.note);
    } catch {
      // Keep the production-like starter workflow when a browser draft is invalid.
    }
    async function hydrateFromServer() {
      try {
        const response = await fetch(`/api/workflows?id=${encodeURIComponent(workflowId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Workflow database unavailable");
        const payload = await response.json() as { workflow?: { id?: string; name?: string; status?: string; version?: number; nodes?: WorkflowNode[]; connections?: Connection[]; note?: string }; executions?: RunRow[]; salesPeople?: WorkflowSalesPerson[]; whatsapp?: WhatsAppAutomationOverview; attendance?: AttendanceAutomationOverview; payment?: PaymentAutomationOverview; crm?: CrmAutomationOverview; versions?: WorkflowVersionSummary[]; reliability?: WorkflowReliabilityOverview; schedules?: WorkflowScheduleOverview; governance?: WorkflowGovernanceOverview; incidents?: WorkflowIncidentOverview; enterprise?: WorkflowEnterpriseOverview };
        if (cancelled) return;
        if (payload.workflow && Array.isArray(payload.workflow.nodes)) {
          setNodes(payload.workflow.nodes);
          setConnections(Array.isArray(payload.workflow.connections) ? payload.workflow.connections : []);
          setWorkflowName(payload.workflow.name || "Workshop Registration & Onboarding");
          setActive(payload.workflow.status === "active");
          setNoteText(payload.workflow.note || "");
          setWorkflowId(payload.workflow.id || "workshop-registration-onboarding");
          setWorkflowVersion(Number(payload.workflow.version || 0));
          savedDocumentRef.current = JSON.stringify({ id: payload.workflow.id || initialWorkflowId,
            name: payload.workflow.name || "Workshop Registration & Onboarding", status: payload.workflow.status === "active" ? "active" : "draft",
            nodes: payload.workflow.nodes, connections: payload.workflow.connections ?? [], note: payload.workflow.note || "" });
        }
        setRuns(payload.executions ?? []);
        setSalesPeople(Array.isArray(payload.salesPeople) ? payload.salesPeople : []);
        if (payload.whatsapp) setWhatsappOverview(payload.whatsapp);
        if (payload.attendance) setAttendanceOverview(payload.attendance);
        if (payload.payment) setPaymentOverview(payload.payment);
        if (payload.crm) setCrmOverview(payload.crm);
        if (payload.versions) setWorkflowVersions(payload.versions);
        if (payload.reliability) setReliability(payload.reliability);
        if (payload.schedules) setScheduleOverview(payload.schedules);
        if (payload.governance) setGovernance(payload.governance);
        if (payload.incidents) setIncidentOverview(payload.incidents);
        if (payload.enterprise) setEnterprise(payload.enterprise);
        setStorageMode("cloud");
      } catch {
        if (!cancelled) { setLoadError("Could not load this workflow. Your saved workflow has not been changed."); setStorageMode("browser"); }
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    }
    void hydrateFromServer();
    return () => { cancelled = true; };
  }, []);

  const workflowDocument = JSON.stringify({ id: workflowId, name: workflowName, status: active ? "active" : "draft", nodes, connections, note: noteText });
  documentRef.current = workflowDocument;
  useEffect(() => {
    if (!hydratedRef.current || loadError || storageMode !== "cloud" || workflowDocument === savedDocumentRef.current) return;
    setSaveState("unsaved");
    autosaveTimerRef.current = window.setTimeout(() => { void persistWorkflow(); }, 900);
    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [workflowDocument, loadError, storageMode]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (documentRef.current !== savedDocumentRef.current && hydratedRef.current && !loadError) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [loadError]);
  useEffect(() => {
    if (storageMode !== "cloud") return;
    const frame = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(frame);
  }, [storageMode]);


  const selectedId = selectedIds.at(-1) ?? "";
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const flatCatalog = useMemo(() => catalog.flatMap((section) => section.items), []);
  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalog.map((section) => ({ ...section, items: section.items.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized)) })).filter((section) => section.items.length);
  }, [query]);
  const pickerItems = useMemo(() => {
    const normalized = pickerQuery.trim().toLowerCase();
    return flatCatalog.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized));
  }, [flatCatalog, pickerQuery]);
  const validationIssues = useMemo(() => validateWorkflow(nodes, connections), [connections, nodes]);

  function recordHistory() {
    setPast((history) => [...history.slice(-29), cloneSnapshot(nodes, connections)]);
    setFuture([]);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((history) => [cloneSnapshot(nodes, connections), ...history].slice(0, 30));
    setNodes(previous.nodes);
    setConnections(previous.connections);
    setPast((history) => history.slice(0, -1));
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((history) => [...history, cloneSnapshot(nodes, connections)].slice(-30));
    setNodes(next.nodes);
    setConnections(next.connections);
    setFuture((history) => history.slice(1));
  }

  async function persistWorkflow(nextActive = active, createVersion = false) {
    window.clearTimeout(autosaveTimerRef.current);
    if (storageMode !== "cloud" || loadError) return false;
    const snapshot = JSON.stringify({ id: workflowId, name: workflowName, status: nextActive ? "active" : "draft", nodes, connections, note: noteText });
    setSaveState("saving");
    // Serialize writes: a delayed autosave must never overwrite a newer explicit save.
    const task = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (snapshot === savedDocumentRef.current && !createVersion) { setSaveState(documentRef.current === snapshot ? "saved" : "unsaved"); return true; }
      try {
        const response = await fetch("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...JSON.parse(snapshot), createVersion }) });
        if (!response.ok) throw new Error("Save failed");
        const payload = await response.json() as { workflow?: { version?: number } };
        if (payload.workflow?.version) setWorkflowVersion(payload.workflow.version);
        savedDocumentRef.current = snapshot;
        try { window.localStorage.setItem(storageKey, JSON.stringify({ nodes, connections, name: workflowName, active: nextActive, note: noteText })); } catch { /* Cloud save succeeded even when browser storage is full. */ }
        setSaveState(documentRef.current === snapshot ? "saved" : "unsaved");
        return true;
      } catch { setSaveState("unsaved"); return false; }
    });
    saveQueueRef.current = task;
    return task;
  }

  async function leaveEditor() {
    if (leaving) return;
    setLeaving(true);
    if (loadError || await persistWorkflow()) onExit?.();
    else setImportError("Could not save your latest changes. Please retry before leaving.");
    setLeaving(false);
  }

  async function createCopy(name: string, nextNodes: WorkflowNode[], nextConnections: Connection[]) {
    if (!onOpenWorkflow || leaving) return;
    setLeaving(true);
    try {
      if (!await persistWorkflow()) throw new Error("Save your current workflow before creating another.");
      const id = crypto.randomUUID();
      const response = await fetch("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({id, name, status:"draft", nodes:nextNodes, connections:nextConnections, note:""}) });
      if (!response.ok) throw new Error("Could not create workflow. Please retry.");
      onOpenWorkflow(id);
    } catch(error) { setImportError(error instanceof Error ? error.message : "Could not create workflow."); }
    finally { setLeaving(false); }
  }

  function activateWorkflow() {
    if (validationIssues.some((issue) => issue.level === "error")) {
      setValidationOpen(true);
      return;
    }
    setActive(true);
    void persistWorkflow(true, true);
  }

  async function testWorkflow() {
    if (testing) return;
    if (storageMode !== "cloud" || loadError) return;
    setImportError("");
    setTesting(true);
    setExecutionState({});
    try {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workflowId, name: workflowName, status: active ? "active" : "draft", nodes, connections, note: noteText })
      });
      const payload = await response.json() as { run?: RunRow; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error || "Execution failed");
      setRuns((current) => [payload.run!, ...current.filter((run) => run.id !== payload.run!.id)].slice(0, 50));
      setExecutionState(Object.fromEntries((payload.run.steps ?? []).map((step) => [step.nodeId, step.status === "skipped" ? "idle" : step.status])));
      setSelectedRun(payload.run);
      setExecutionsOpen(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Workflow test failed. Please retry.");
    } finally {
      setTesting(false);
    }
  }

  async function processWhatsAppRetries() {
    if (retryProcessing || storageMode !== "cloud") return;
    setRetryProcessing(true);
    try {
      const response = await fetch("/api/workflows/whatsapp/retries", { method: "POST" });
      const payload = await response.json() as { overview?: WhatsAppAutomationOverview };
      if (response.ok && payload.overview) setWhatsappOverview(payload.overview);
    } finally {
      setRetryProcessing(false);
    }
  }

  async function processCrmAutomation() {
    if (crmProcessing || storageMode !== "cloud") return;
    setCrmProcessing(true);
    try {
      const response = await fetch("/api/workflows/crm/process", { method: "POST" });
      const payload = await response.json() as { overview?: CrmAutomationOverview };
      if (response.ok && payload.overview) setCrmOverview(payload.overview);
    } finally { setCrmProcessing(false); }
  }

  async function restoreVersion(version: number) {
    if (restoringVersion !== null || storageMode !== "cloud") return;
    setRestoringVersion(version);
    try {
      const response = await fetch("/api/workflows/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId, version }) });
      const payload = await response.json() as { workflow?: { name?: string; status?: string; version?: number; nodes?: WorkflowNode[]; connections?: Connection[]; note?: string }; versions?: WorkflowVersionSummary[] };
      if (!response.ok || !payload.workflow?.nodes) return;
      recordHistory();
      setNodes(payload.workflow.nodes);
      setConnections(Array.isArray(payload.workflow.connections) ? payload.workflow.connections : []);
      setWorkflowName(payload.workflow.name || workflowName);
      setActive(payload.workflow.status === "active");
      setNoteText(payload.workflow.note || "");
      setWorkflowVersion(Number(payload.workflow.version || workflowVersion));
      if (payload.versions) setWorkflowVersions(payload.versions);
      setVersionsOpen(false);
      setSaveState("saved");
    } finally { setRestoringVersion(null); }
  }

  async function replayExecution(run: RunRow) {
    if (replayingExecution || storageMode !== "cloud") return;
    setReplayingExecution(true);
    try {
      const response = await fetch("/api/workflows/executions/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executionId: run.id }) });
      if (!response.ok) return;
      const refresh = await fetch(`/api/workflows?id=${encodeURIComponent(workflowId)}`, { cache: "no-store" });
      const payload = await refresh.json() as { executions?: RunRow[]; reliability?: WorkflowReliabilityOverview };
      if (payload.executions) setRuns(payload.executions);
      if (payload.reliability) setReliability(payload.reliability);
      setSelectedRun(null);
      setExecutionsOpen(true);
    } finally { setReplayingExecution(false); }
  }

  async function processSchedules() {
    if (scheduleProcessing || storageMode !== "cloud") return;
    setScheduleProcessing(true);
    try {
      const response = await fetch("/api/workflows/schedules/process", { method: "POST" });
      const payload = await response.json() as { overview?: WorkflowScheduleOverview };
      if (response.ok && payload.overview) setScheduleOverview(payload.overview);
    } finally { setScheduleProcessing(false); }
  }

  async function runGovernanceAction(operation: "request" | "approve" | "reject", approvalId?: string) {
    if (governanceProcessing || storageMode !== "cloud") return;
    setGovernanceProcessing(true);
    try {
      const response = await fetch("/api/workflows/governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId, operation, approvalId }) });
      const payload = await response.json() as { governance?: WorkflowGovernanceOverview };
      if (response.ok && payload.governance) setGovernance(payload.governance);
    } finally { setGovernanceProcessing(false); }
  }

  async function runIncidentAction(incidentId: string, operation: "acknowledge" | "resolve") {
    if (incidentProcessing || storageMode !== "cloud") return;
    setIncidentProcessing(incidentId);
    try {
      const response = await fetch("/api/workflows/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId, incidentId, operation }) });
      const payload = await response.json() as { overview?: WorkflowIncidentOverview };
      if (response.ok && payload.overview) setIncidentOverview(payload.overview);
    } finally { setIncidentProcessing(""); }
  }

  function applyAiWorkflow(value: { name: string; nodes: WorkflowNode[]; connections: Connection[] }) {
    recordHistory();
    setWorkflowName(value.name); setNodes(value.nodes); setConnections(value.connections); setActive(false); setSelectedIds([]); setEnterpriseOpen(false); setSaveState("unsaved");
  }

  function addNode(item: Pick<CatalogItem, "kind" | "title" | "subtitle">, context: PickerContext | null = null) {
    recordHistory();
    const id = `node-${Date.now()}-${nodes.length}`;
    const rect = canvasRef.current?.getBoundingClientRect();
    let x = rect ? (rect.width / 2 - pan.x) / zoom - NODE_WIDTH / 2 : 850;
    let y = rect ? (rect.height / 2 - pan.y) / zoom - NODE_HEIGHT / 2 : 330;
    if (context?.mode === "insert") {
      const connection = connections.find((entry) => entry.id === context.connectionId);
      const from = connection ? nodeMap.get(connection.from) : null;
      const to = connection ? nodeMap.get(connection.to) : null;
      if (from && to) { x = (from.x + to.x) / 2; y = (from.y + to.y) / 2; }
    }
    x = Math.max(24, Math.min(CANVAS_WIDTH - NODE_WIDTH - 24, Math.round(x / 20) * 20));
    y = Math.max(24, Math.min(CANVAS_HEIGHT - NODE_HEIGHT - 24, Math.round(y / 20) * 20));
    const nextNode: WorkflowNode = { id, kind: item.kind, title: item.title, subtitle: item.subtitle, x, y, config: defaultConfigForItem(item) };
    setNodes((current) => [...current, nextNode]);
    if (context?.mode === "connect") {
      setConnections((current) => [...current, { id: `c-${Date.now()}`, from: context.fromId, to: id }]);
    } else if (context?.mode === "insert") {
      const existing = connections.find((connection) => connection.id === context.connectionId);
      if (existing) setConnections((current) => [...current.filter((connection) => connection.id !== existing.id), { id: `c-${Date.now()}-a`, from: existing.from, to: id, label: existing.label }, { id: `c-${Date.now()}-b`, from: id, to: existing.to, dashed: existing.dashed }]);
    }
    setSelectedIds([id]);
    setInspectorOpen(true);
    setPickerContext(null);
    setPickerQuery("");
  }

  function duplicateSelected() {
    if (!selectedIds.length) return;
    recordHistory();
    const copies = nodes.filter((node) => selectedIds.includes(node.id)).map((node, index) => ({ ...node, id: `node-${Date.now()}-${index}`, title: `${node.title} copy`, x: node.x + 36, y: node.y + 36, config: { ...node.config } }));
    setNodes((current) => [...current, ...copies]);
    setSelectedIds(copies.map((node) => node.id));
  }

  function deleteSelected() {
    if (!selectedIds.length) return;
    recordHistory();
    const selectedSet = new Set(selectedIds);
    setNodes((current) => current.filter((node) => !selectedSet.has(node.id)));
    setConnections((current) => current.filter((connection) => !selectedSet.has(connection.from) && !selectedSet.has(connection.to)));
    setSelectedIds([]);
    setConnectingFrom(null);
  }

  function connectTo(nodeId: string) {
    if (!connectingFrom || connectingFrom === nodeId) return;
    if (!connections.some((connection) => connection.from === connectingFrom && connection.to === nodeId)) {
      recordHistory();
      setConnections((current) => [...current, { id: `c-${Date.now()}`, from: connectingFrom, to: nodeId }]);
    }
    setConnectingFrom(null);
  }

  function selectNode(nodeId: string, additive: boolean) {
    if (connectingFrom) { connectTo(nodeId); return; }
    setSelectedIds((current) => additive ? (current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]) : [nodeId]);
    setInspectorOpen(true);
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, node: WorkflowNode) {
    event.stopPropagation();
    if (connectingFrom) { connectTo(node.id); return; }
    selectNode(node.id, event.shiftKey);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragHistoryCapturedRef.current = false;
    setDragging({ id: node.id, offsetX: (event.clientX - rect.left - pan.x) / zoom - node.x, offsetY: (event.clientY - rect.top - pan.y) / zoom - node.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, input, textarea, select")) return;
    if (event.button !== 0 && event.button !== 1) return;
    setSelectedIds([]);
    setPanning({ clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragging) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!dragHistoryCapturedRef.current) { recordHistory(); dragHistoryCapturedRef.current = true; }
      let x = (event.clientX - rect.left - pan.x) / zoom - dragging.offsetX;
      let y = (event.clientY - rect.top - pan.y) / zoom - dragging.offsetY;
      if (snapEnabled) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
      x = Math.max(20, Math.min(CANVAS_WIDTH - NODE_WIDTH - 20, x));
      y = Math.max(20, Math.min(CANVAS_HEIGHT - NODE_HEIGHT - 20, y));
      setNodes((current) => current.map((node) => node.id === dragging.id ? { ...node, x, y } : node));
    } else if (panning) {
      setPan({ x: panning.panX + event.clientX - panning.clientX, y: panning.panY + event.clientY - panning.clientY });
    }
  }

  function onCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) setZoom((current) => Math.max(0.35, Math.min(1.25, current - event.deltaY * 0.0015)));
    else setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
  }

  function fitToView() {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !nodes.length) return;
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));
    const nextZoom = Math.max(0.35, Math.min(0.95, Math.min((rect.width - 64) / (maxX - minX), (rect.height - 90) / (maxY - minY))));
    setZoom(nextZoom);
    setPan({ x: (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom, y: (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom });
  }

  function updateNodeConfig(key: string, value: ConfigValue) {
    if (!selected) return;
    setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, config: { ...node.config, [key]: value } } : node));
  }

  function exportWorkflow() {
    const payload = JSON.stringify({ name: workflowName, version: workflowVersion, active, note: noteText, nodes, connections }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
  }

  function applyTemplate(template: WorkflowTemplate) {
    if (onOpenWorkflow) { void createCopy(template.name, template.nodes, template.connections); return; }
    recordHistory();
    setWorkflowName(template.name);
    setNodes(template.nodes.map((item) => ({ ...item, config: { ...item.config } })));
    setConnections(template.connections.map((item) => ({ ...item })));
    setNoteText(`Created from ${template.name} template. Review credentials, workshop mapping and recipients before activation.`);
    setActive(false);
    setSaveState("unsaved");
    setTemplatesOpen(false);
    setTimeout(fitToView, 30);
  }

  async function importWorkflow(file?: File) {
    if (!file) return;
    setImportError("");
    try {
      const imported = parseWorkflowImport(await file.text());
      recordHistory();
      setWorkflowName(imported.name);
      setNodes(imported.nodes);
      setConnections(imported.connections);
      setNoteText(imported.note);
      setActive(false);
      setSaveState("unsaved");
      setMoreOpen(false);
      setTimeout(fitToView, 30);
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not import workflow."); }
    finally { if (importRef.current) importRef.current.value = ""; }
  }

  useEffect(() => {
    function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !isTyping(event.target)) { setSpacePressed(true); event.preventDefault(); }
      if (isTyping(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persistWorkflow(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      else if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      else if (event.key === "/") { event.preventDefault(); setPickerContext({ mode: "add" }); }
      else if (event.key === "Escape") { setConnectingFrom(null); setPickerContext(null); setMoreOpen(false); setValidationOpen(false); setVersionsOpen(false); setShortcutsOpen(false); }
    }
    function onKeyUp(event: KeyboardEvent) { if (event.code === "Space") setSpacePressed(false); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  });

  useEffect(() => { if (pickerContext) window.setTimeout(() => searchRef.current?.focus(), 30); }, [pickerContext]);

  if (storageMode === "loading" || loadError) return <div className="grid h-dvh place-items-center bg-slate-50 p-6"><div className="text-center"><p role={loadError ? "alert" : "status"} className="text-sm text-slate-600">{loadError || "Opening workflow…"}</p>{loadError ? <button className="workflow-button-secondary mt-4" onClick={onExit} type="button">Back to workflows</button> : null}</div></div>;

  return <section className={`${fullScreen ? "fixed inset-0 z-[80] flex flex-col overflow-hidden !rounded-none" : focusMode ? "fixed inset-2 z-[80] flex flex-col overflow-hidden shadow-2xl" : "overflow-hidden shadow-panel"} rounded-[20px] border border-slate-200 bg-white`}>
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {onExit ? <button className="workflow-button-secondary" disabled={leaving || testing} onClick={leaveEditor} type="button">{leaving ? "Saving…" : "← Workflows"}</button> : null}
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm"><Workflow className="size-5" /></span>
        <div className="min-w-0"><div className="mb-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400"><span>Automation</span><ChevronRight className="size-3" /><span>Workflows</span><span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">{workflowVersion ? `v${workflowVersion}` : "Draft"}</span><span className={`ml-1 rounded px-1.5 py-0.5 ${storageMode === "cloud" ? "bg-emerald-50 text-emerald-700" : storageMode === "browser" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{storageMode === "cloud" ? "Cloud saved" : storageMode === "browser" ? "Browser fallback" : "Connecting"}</span></div><input aria-label="Workflow name" className="w-[min(330px,58vw)] bg-transparent text-sm font-black text-slate-950 outline-none focus:text-indigo-700" onChange={(event) => setWorkflowName(event.target.value)} value={workflowName} /></div>
        <SaveIndicator state={saveState} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button aria-checked={active} className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] lg:inline-flex ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`} onClick={() => active ? setActive(false) : activateWorkflow()} role="switch" type="button"><span className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />{storageMode === "cloud" ? "Production" : "Preview"} · {active ? "Active" : "Draft"}</button>
        <button className="workflow-button-secondary" disabled={testing} onClick={testWorkflow} type="button">{testing ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}{testing ? "Running test" : "Test workflow"}</button>
        <span className="inline-flex"><button className="workflow-button-secondary" onClick={() => persistWorkflow()} type="button"><Save className="size-4" />Save</button></span>
        <span className="inline-flex"><button className="workflow-button-primary" onClick={activateWorkflow} type="button"><Sparkles className="size-4" />Save & activate</button></span>
        {!fullScreen ? <>
        <button className="workflow-button-secondary hidden lg:inline-flex" onClick={() => setTemplatesOpen(true)} type="button"><Library className="size-4" />Templates</button>
        <button className="workflow-button-secondary hidden lg:inline-flex" onClick={() => setSchedulesOpen(true)} type="button"><Clock3 className="size-4" />Schedules <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">{scheduleOverview.active}</span></button>
        <button className="workflow-button-secondary hidden lg:inline-flex" onClick={() => setGovernanceOpen(true)} type="button"><ShieldCheck className="size-4" />Governance {governance.pending ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">{governance.pending}</span> : null}</button>
        <button className={`workflow-button-secondary hidden lg:inline-flex ${incidentOverview.open || incidentOverview.critical ? "!border-rose-200 !bg-rose-50 !text-rose-700" : ""}`} onClick={() => setIncidentsOpen(true)} type="button"><AlertCircle className="size-4" />Incidents <span className="rounded bg-white/80 px-1.5 py-0.5 text-[9px]">{incidentOverview.open + incidentOverview.acknowledged}</span></button>
        <button className="workflow-button-primary hidden lg:inline-flex" onClick={() => setEnterpriseOpen(true)} type="button"><Sparkles className="size-4" />Enterprise Hub</button>
        </> : null}
        <div className="relative"><button aria-label="More workflow actions" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setMoreOpen((value) => !value)} type="button"><MoreHorizontal className="size-5" /></button>{moreOpen ? <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{fullScreen ? <><MenuAction icon={Library} label="Templates" onClick={() => { setTemplatesOpen(true); setMoreOpen(false); }} /><MenuAction icon={Clock3} label="Schedules" onClick={() => { setSchedulesOpen(true); setMoreOpen(false); }} /><MenuAction icon={ShieldCheck} label="Governance" onClick={() => { setGovernanceOpen(true); setMoreOpen(false); }} /><MenuAction icon={AlertCircle} label="Incidents" onClick={() => { setIncidentsOpen(true); setMoreOpen(false); }} /><MenuAction icon={Sparkles} label="Enterprise Hub" onClick={() => { setEnterpriseOpen(true); setMoreOpen(false); }} /></> : null}<MenuAction icon={Copy} label="Duplicate workflow" onClick={() => { void createCopy(`${workflowName} copy`, nodes, connections); setMoreOpen(false); }} /><MenuAction icon={History} label="Version history" onClick={() => { setVersionsOpen(true); setMoreOpen(false); }} /><MenuAction icon={Upload} label="Import workflow JSON" onClick={() => importRef.current?.click()} /><MenuAction icon={Download} label="Export workflow JSON" onClick={exportWorkflow} /><MenuAction icon={Braces} label="Keyboard shortcuts" onClick={() => { setShortcutsOpen(true); setMoreOpen(false); }} /></div> : null}</div>
        <input accept="application/json,.json" className="hidden" onChange={(event) => importWorkflow(event.target.files?.[0])} ref={importRef} type="file" />
      </div>
    </header>

    {!focusMode ? <>
      <MessagingHealthBar onOpen={() => setWhatsappActivityOpen(true)} overview={whatsappOverview} storageMode={storageMode} />
      <AttendanceHealthBar onOpen={() => setAttendanceActivityOpen(true)} overview={attendanceOverview} storageMode={storageMode} />
      <PaymentHealthBar onOpen={() => setPaymentActivityOpen(true)} overview={paymentOverview} storageMode={storageMode} />
      <CrmHealthBar onOpen={() => setCrmActivityOpen(true)} overview={crmOverview} storageMode={storageMode} />
      <ReliabilityHealthBar overview={reliability} />
    </> : null}



    <div className={`relative flex min-w-0 ${focusMode ? "min-h-0 flex-1" : "min-h-[720px]"}`}>
      {libraryOpen ? <NodeLibrary filteredCatalog={filteredCatalog} onAdd={(item) => addNode(item)} onClose={() => setLibraryOpen(false)} onCustom={() => setPickerContext({ mode: "add" })} query={query} setQuery={setQuery} /> : null}

      <main className="flex min-w-0 flex-1 flex-col bg-slate-100">
        <div className="flex h-12 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
          <div className="flex items-center gap-1"><ToolbarButton label="Search and add a node · /" onClick={() => setPickerContext({ mode: "add" })}><Search className="size-4" /></ToolbarButton>{!libraryOpen ? <ToolbarButton label="Pin node library" onClick={() => setLibraryOpen(true)}><LayoutGrid className="size-4" /></ToolbarButton> : null}<ToolbarButton disabled={!past.length} label="Undo · ⌘Z" onClick={undo}><Undo2 className="size-4" /></ToolbarButton><ToolbarButton disabled={!future.length} label="Redo · ⇧⌘Z" onClick={redo}><Redo2 className="size-4" /></ToolbarButton><span className="mx-1 h-5 w-px bg-slate-200" /><ToolbarButton active={snapEnabled} label="Snap to grid" onClick={() => setSnapEnabled((value) => !value)}><LayoutGrid className="size-4" /></ToolbarButton><ToolbarButton active={minimapOpen} label="Toggle minimap" onClick={() => setMinimapOpen((value) => !value)}><MousePointer2 className="size-4" /></ToolbarButton><ToolbarButton active={noteOpen} label="Add sticky note" onClick={() => setNoteOpen((value) => !value)}><StickyNote className="size-4" /></ToolbarButton></div>
          <div className="flex items-center gap-1.5">{selectedIds.length > 1 ? <span className="hidden rounded-lg bg-indigo-50 px-2 py-1.5 text-[10px] font-black text-indigo-700 sm:inline">{selectedIds.length} selected</span> : null}<button className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black ${validationIssues.some((issue) => issue.level === "error") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} onClick={() => setValidationOpen((value) => !value)} type="button">{validationIssues.length ? <AlertCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}{validationIssues.length ? `${validationIssues.length} issue${validationIssues.length > 1 ? "s" : ""}` : "Workflow valid"}</button><ToolbarButton label={fullScreen ? "Back to workflows" : focusMode ? "Exit focus mode" : "Focus mode"} onClick={() => fullScreen ? void leaveEditor() : setFocusMode((value) => { const next = !value; if (next) { setExecutionsOpen(false); setLibraryOpen(false); setInspectorOpen(false); } return next; })}><Maximize2 className="size-4" /></ToolbarButton>{!inspectorOpen && selected ? <ToolbarButton label="Open node settings" onClick={() => setInspectorOpen(true)}><SlidersHorizontal className="size-4" /></ToolbarButton> : null}</div>
        </div>

        <div className={`relative overflow-hidden ${focusMode ? "min-h-0 flex-1" : "h-[672px]"} ${spacePressed || panning ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={() => { setDragging(null); setPanning(null); dragHistoryCapturedRef.current = false; }} onWheel={onCanvasWheel} ref={canvasRef} style={{ touchAction: "none" }}>
          <div className="pointer-events-none absolute inset-0 bg-slate-50" style={{ backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${20 * zoom}px ${20 * zoom}px` }} />
          {connectingFrom ? <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[11px] font-black text-indigo-700 shadow-lg"><span className="size-2 animate-pulse rounded-full bg-indigo-500" />Choose the next node or add a new one<button className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); setConnectingFrom(null); }} type="button"><X className="size-3.5" /></button></div> : null}
          {validationOpen ? <ValidationPopover issues={validationIssues} onClose={() => setValidationOpen(false)} /> : null}
          <div className="pointer-events-none absolute left-0 top-0 origin-top-left lg:pointer-events-auto" style={{ height: CANVAS_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: CANVAS_WIDTH }}>
            <Connections connections={connections} executionState={executionState} nodeMap={nodeMap} onInsert={(connectionId) => setPickerContext({ mode: "insert", connectionId })} />
            {noteOpen ? <div className="absolute left-[760px] top-5 z-10 w-[300px] rotate-[-1deg] rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm"><div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800"><StickyNote className="size-3.5" />Batch operations note<span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5">#team-sync</span></div><textarea aria-label="Workflow sticky note" className="h-12 w-full resize-none bg-transparent text-[11px] font-semibold leading-4 text-amber-950 outline-none" onChange={(event) => setNoteText(event.target.value)} onPointerDown={(event) => event.stopPropagation()} value={noteText} /></div> : null}
            {nodes.map((node) => <CanvasNode connecting={Boolean(connectingFrom)} executionStatus={executionState[node.id] ?? "idle"} key={node.id} node={node} onConnect={() => setConnectingFrom(node.id)} onKeyboardSelect={() => selectNode(node.id, false)} onOpenPicker={() => setPickerContext({ mode: "connect", fromId: node.id })} onPointerDown={(event) => onNodePointerDown(event, node)} selected={selectedIds.includes(node.id)} />)}
          </div>
          {!nodes.length ? <div className="absolute inset-0 grid place-items-center"><button className="workflow-button-primary" onClick={() => setPickerContext({ mode: "add" })} type="button"><Plus className="size-4" />Add first step</button></div> : null}
          <div className="absolute bottom-3 left-3 z-20 flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"><ToolbarButton label="Fit workflow" onClick={fitToView}><Maximize2 className="size-4" /></ToolbarButton><ToolbarButton label="Zoom out" onClick={() => setZoom((value) => Math.max(0.35, value - 0.1))}><Minus className="size-4" /></ToolbarButton><span className="grid h-9 min-w-12 place-items-center border-x border-slate-200 px-1 text-[10px] font-black text-slate-500">{Math.round(zoom * 100)}%</span><ToolbarButton label="Zoom in" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}><Plus className="size-4" /></ToolbarButton></div>
          <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-500 shadow-sm sm:flex"><span><KeyCap>Space</KeyCap> drag to pan</span><span><KeyCap>⇧</KeyCap> select many</span><span><KeyCap>/</KeyCap> add node</span></div>
          {minimapOpen ? <MiniMap nodes={nodes} pan={pan} selectedIds={selectedIds} zoom={zoom} /> : null}
        </div>
      </main>

      {selected && inspectorOpen ? <div className="absolute inset-y-0 right-0 z-40 w-[min(360px,calc(100%-32px))] border-l border-slate-200 bg-white shadow-2xl"><Inspector node={selected} onChange={updateNodeConfig} onClose={() => setInspectorOpen(false)} onDelete={deleteSelected} onDuplicate={duplicateSelected} onRename={(title) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, title } : node))} onTab={setInspectorTab} onTest={testWorkflow} salesPeople={salesPeople} status={executionState[selected.id] ?? "idle"} tab={inspectorTab} /></div> : null}
    </div>

    <ExecutionDrawer open={executionsOpen} onOpen={() => setExecutionsOpen((value) => !value)} onSelectRun={setSelectedRun} runs={runs} />
    {pickerContext ? <NodePicker context={pickerContext} items={pickerItems} onAdd={(item) => addNode(item, pickerContext)} onClose={() => { setPickerContext(null); setPickerQuery(""); }} query={pickerQuery} searchRef={searchRef} setQuery={setPickerQuery} /> : null}
    {versionsOpen ? <VersionHistory currentVersion={workflowVersion} onClose={() => setVersionsOpen(false)} onRestore={restoreVersion} restoring={restoringVersion} versions={workflowVersions} /> : null}
    {shortcutsOpen ? <ShortcutDialog onClose={() => setShortcutsOpen(false)} /> : null}
    {selectedRun ? <RunDetail onClose={() => setSelectedRun(null)} onReplay={() => replayExecution(selectedRun)} replaying={replayingExecution} run={selectedRun} /> : null}
    {whatsappActivityOpen ? <WhatsAppActivityPanel onClose={() => setWhatsappActivityOpen(false)} onProcessRetries={processWhatsAppRetries} overview={whatsappOverview} processing={retryProcessing} storageMode={storageMode} /> : null}
    {attendanceActivityOpen ? <AttendanceActivityPanel onClose={() => setAttendanceActivityOpen(false)} overview={attendanceOverview} /> : null}
    {paymentActivityOpen ? <PaymentActivityPanel onClose={() => setPaymentActivityOpen(false)} overview={paymentOverview} /> : null}
    {crmActivityOpen ? <CrmActivityPanel onClose={() => setCrmActivityOpen(false)} onProcess={processCrmAutomation} overview={crmOverview} processing={crmProcessing} storageMode={storageMode} /> : null}
    {templatesOpen ? <TemplateGallery onApply={applyTemplate} onClose={() => setTemplatesOpen(false)} /> : null}
    {schedulesOpen ? <ScheduleOperationsPanel onClose={() => setSchedulesOpen(false)} onProcess={processSchedules} overview={scheduleOverview} processing={scheduleProcessing} storageMode={storageMode} /> : null}
    {governanceOpen ? <GovernancePanel active={active} issueCount={validationIssues.length} onAction={runGovernanceAction} onClose={() => setGovernanceOpen(false)} overview={governance} processing={governanceProcessing} storageMode={storageMode} workflowVersion={workflowVersion} /> : null}
    {incidentsOpen ? <IncidentOperationsPanel onAction={runIncidentAction} onClose={() => setIncidentsOpen(false)} overview={incidentOverview} processingId={incidentProcessing} storageMode={storageMode} /> : null}
    {enterpriseOpen ? <WorkflowEnterpriseHub onApplyGenerated={applyAiWorkflow} onClose={() => setEnterpriseOpen(false)} onOverview={setEnterprise} overview={enterprise} storageMode={storageMode} workflowId={workflowId} /> : null}
    {importError ? <div className="fixed bottom-5 right-5 z-[130] flex max-w-sm items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 text-rose-800 shadow-2xl"><AlertCircle className="mt-0.5 size-5 shrink-0" /><span className="text-xs font-bold leading-5">{importError}</span><button aria-label="Dismiss import error" onClick={() => setImportError("")} type="button"><X className="size-4" /></button></div> : null}
    <style jsx global>{`.workflow-input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;background:#fff;padding:.68rem .75rem;font-size:.72rem;font-weight:700;color:#334155;outline:none;transition:border-color 160ms ease,box-shadow 160ms ease}.workflow-input:focus{border-color:#818cf8;box-shadow:0 0 0 3px #eef2ff}.workflow-button-secondary{display:inline-flex;height:2.5rem;align-items:center;gap:.5rem;border-radius:.75rem;border:1px solid #e2e8f0;background:#fff;padding:0 .8rem;font-size:.7rem;font-weight:900;color:#475569;white-space:nowrap}.workflow-button-secondary:hover{background:#f8fafc;border-color:#cbd5e1}.workflow-button-secondary:disabled{opacity:.45;cursor:not-allowed}.workflow-button-primary{display:inline-flex;height:2.5rem;align-items:center;gap:.5rem;border-radius:.75rem;background:#059669;padding:0 .9rem;font-size:.7rem;font-weight:900;color:#fff;white-space:nowrap;box-shadow:0 8px 22px -12px rgba(5,150,105,.9)}.workflow-button-primary:hover{background:#047857}`}</style>
  </section>;
}

function MessagingHealthBar({ onOpen, overview, storageMode }: { onOpen: () => void; overview: WhatsAppAutomationOverview; storageMode: "loading" | "cloud" | "browser" }) {
  const delivered = Number(overview.counts.delivered || 0);
  const read = Number(overview.counts.read || 0);
  const failed = Number(overview.counts.failed || 0);
  const inbound = Number(overview.counts.received || 0);
  const metrics: Array<[string, number, string]> = [["Inbound", inbound, "text-sky-700"], ["Delivered", delivered, "text-emerald-700"], ["Read", read, "text-indigo-700"], ["Failed", failed, "text-rose-700"]];
  return <div className="hidden min-h-11 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/70 px-4 lg:flex"><span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"><span className={`size-2 rounded-full ${storageMode === "cloud" ? "animate-pulse bg-emerald-500" : "bg-amber-400"}`} />WhatsApp automation</span>{metrics.map(([label, value, color]) => <span className="shrink-0 rounded-lg border border-white bg-white/80 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm" key={label}><strong className={`mr-1 ${color}`}>{value}</strong>{label}</span>)}<span className={`ml-auto shrink-0 rounded-lg px-2.5 py-1 text-[9px] font-black ${overview.retryDue ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{overview.retryDue ? `${overview.retryDue} retries due` : "Retry queue clear"}</span><button className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-black text-emerald-700 hover:bg-emerald-50" onClick={onOpen} type="button">View activity</button><span className="shrink-0 text-[9px] font-bold text-slate-400">Webhook: /api/webhooks/whatsapp</span></div>;
}

function AttendanceHealthBar({ onOpen, overview, storageMode }: { onOpen: () => void; overview: AttendanceAutomationOverview; storageMode: "loading" | "cloud" | "browser" }) {
  const metrics: Array<[string, number, string]> = [["Checked in", overview.counts.checkedIn, "text-teal-700"], ["Late", overview.counts.late, "text-amber-700"], ["Promoted", overview.counts.promoted, "text-indigo-700"], ["No-show risk", overview.counts.noShowRisk, "text-rose-700"]];
  return <div className="hidden min-h-11 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-gradient-to-r from-teal-50/80 via-white to-sky-50/70 px-4 lg:flex"><span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"><span className={`size-2 rounded-full ${storageMode === "cloud" ? "animate-pulse bg-teal-500" : "bg-amber-400"}`} />Attendance automation</span>{metrics.map(([label, value, color]) => <span className="shrink-0 rounded-lg border border-white bg-white/80 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm" key={label}><strong className={`mr-1 ${color}`}>{value}</strong>{label}</span>)}<span className="ml-auto shrink-0 rounded-lg bg-sky-100 px-2.5 py-1 text-[9px] font-black text-sky-800">{overview.upcomingSessions} upcoming sessions</span><button className="shrink-0 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[9px] font-black text-teal-700 hover:bg-teal-50" onClick={onOpen} type="button">View attendance</button></div>;
}

function AttendanceActivityPanel({ onClose, overview }: { onClose: () => void; overview: AttendanceAutomationOverview }) {
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35" onMouseDown={onClose}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-700"><UsersRound className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Attendance operations</h3><p className="mt-1 text-xs font-semibold text-slate-500">Live check-ins, late arrivals, promotions and no-show risk.</p></div><button aria-label="Close attendance activity" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-3 gap-2 p-5">{([["Checked in", overview.counts.checkedIn, "bg-teal-50 text-teal-700"], ["Late", overview.counts.late, "bg-amber-50 text-amber-700"], ["No-show risk", overview.counts.noShowRisk, "bg-rose-50 text-rose-700"]] as Array<[string, number, string]>).map(([label, value, color]) => <div className={`rounded-xl p-3 ${color}`} key={label}><span className="block text-xl font-black">{value}</span><span className="text-[9px] font-black uppercase tracking-[0.1em]">{label}</span></div>)}</div><div className="border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Latest attendance events</h4></div><div className="divide-y divide-slate-100">{overview.activity.length ? overview.activity.map((item) => <div className="flex gap-3 px-5 py-4" key={item.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${item.status === "late" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"}`}><Check className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{item.attendeeName}</strong><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">{item.status.replace("_", " ")}</span></span><span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">{item.workshopName} · {item.sessionTitle} · •••• {item.mobile.slice(-4)}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}</span></span></div>) : <div className="px-5 py-16 text-center"><UsersRound className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">No attendance events yet</p><p className="mt-1 text-xs font-semibold text-slate-400">New attendance submissions will trigger active workflows automatically.</p></div>}</div></aside></div>;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function PaymentHealthBar({ onOpen, overview, storageMode }: { onOpen: () => void; overview: PaymentAutomationOverview; storageMode: "loading" | "cloud" | "browser" }) {
  return <div className="hidden min-h-11 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-gradient-to-r from-rose-50/70 via-white to-amber-50/70 px-4 lg:flex"><span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"><span className={`size-2 rounded-full ${storageMode === "cloud" ? "animate-pulse bg-rose-500" : "bg-amber-400"}`} />Payment automation</span><span className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm"><strong className="mr-1 text-emerald-700">{formatInr(overview.collected)}</strong>collected</span><span className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm"><strong className="mr-1 text-amber-700">{formatInr(overview.outstanding)}</strong>outstanding</span><span className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm"><strong className="mr-1 text-rose-700">{overview.counts["payment.failed"] || 0}</strong>failed</span><span className="ml-auto shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-800">{overview.dueRegistrations} payments due</span><button className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[9px] font-black text-rose-700 hover:bg-rose-50" onClick={onOpen} type="button">View payments</button></div>;
}

function PaymentActivityPanel({ onClose, overview }: { onClose: () => void; overview: PaymentAutomationOverview }) {
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35" onMouseDown={onClose}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><CircleDollarSign className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Payment operations</h3><p className="mt-1 text-xs font-semibold text-slate-500">Razorpay events, registration reconciliation and recovery health.</p></div><button aria-label="Close payment activity" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-3 gap-2 p-5"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><span className="block text-lg font-black">{formatInr(overview.collected)}</span><span className="text-[9px] font-black uppercase">Captured</span></div><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><span className="block text-lg font-black">{formatInr(overview.outstanding)}</span><span className="text-[9px] font-black uppercase">Outstanding</span></div><div className="rounded-xl bg-rose-50 p-3 text-rose-700"><span className="block text-lg font-black">{overview.dueRegistrations}</span><span className="text-[9px] font-black uppercase">Due leads</span></div></div><div className="border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Latest provider events</h4></div><div className="divide-y divide-slate-100">{overview.activity.length ? overview.activity.map((item) => <div className="flex gap-3 px-5 py-4" key={item.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${item.eventName === "payment.failed" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{item.eventName === "payment.failed" ? <AlertCircle className="size-4" /> : <CircleDollarSign className="size-4" />}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{item.eventName.replace("payment.", "Payment ")}</strong><span className="font-black text-slate-800">{formatInr(item.amount)}</span></span><span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">{item.method || "Provider"} · {item.registrationId || "Unmapped registration"}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")} · {item.paymentId}</span></span></div>) : <div className="px-5 py-16 text-center"><CircleDollarSign className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">No payment events yet</p><p className="mt-1 text-xs font-semibold text-slate-400">Verified Razorpay webhook events will appear here.</p></div>}</div></aside></div>;
}

function CrmHealthBar({ onOpen, overview, storageMode }: { onOpen: () => void; overview: CrmAutomationOverview; storageMode: "loading" | "cloud" | "browser" }) {
  return <div className="hidden min-h-11 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/70 px-4 lg:flex"><span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"><span className={`size-2 rounded-full ${storageMode === "cloud" ? "animate-pulse bg-violet-500" : "bg-amber-400"}`} />CRM automation</span>{([['Pending', overview.counts.pending, 'text-indigo-700'], ['Overdue', overview.counts.overdue, 'text-rose-700'], ['Today', overview.counts.today, 'text-amber-700'], ['Unassigned', overview.counts.unassigned, 'text-slate-700']] as Array<[string, number, string]>).map(([label, value, color]) => <span className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-500 shadow-sm" key={label}><strong className={`mr-1 ${color}`}>{value}</strong>{label}</span>)}<span className={`ml-auto shrink-0 rounded-lg px-2.5 py-1 text-[9px] font-black ${overview.counts.slaRisk ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{overview.counts.slaRisk ? `${overview.counts.slaRisk} SLA risks` : "SLA queue healthy"}</span><button className="shrink-0 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[9px] font-black text-violet-700 hover:bg-violet-50" onClick={onOpen} type="button">View CRM queue</button></div>;
}

function CrmActivityPanel({ onClose, onProcess, overview, processing, storageMode }: { onClose: () => void; onProcess: () => void; overview: CrmAutomationOverview; processing: boolean; storageMode: "loading" | "cloud" | "browser" }) {
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35" onMouseDown={onClose}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><UserPlus className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">CRM follow-up operations</h3><p className="mt-1 text-xs font-semibold text-slate-500">SLA risks, overdue actions and salesperson task ownership.</p></div><button aria-label="Close CRM activity" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-3 gap-2 p-5"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><span className="block text-xl font-black">{overview.counts.pending}</span><span className="text-[9px] font-black uppercase">Pending</span></div><div className="rounded-xl bg-rose-50 p-3 text-rose-700"><span className="block text-xl font-black">{overview.counts.overdue}</span><span className="text-[9px] font-black uppercase">Overdue</span></div><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><span className="block text-xl font-black">{overview.counts.slaRisk}</span><span className="text-[9px] font-black uppercase">SLA risk</span></div></div><div className="flex items-center justify-between gap-3 border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Priority task queue</h4><button className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-black text-violet-800 disabled:opacity-40" disabled={processing || storageMode !== "cloud"} onClick={onProcess} type="button">{processing ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3" />}{processing ? "Processing" : "Create SLA tasks"}</button></div><div className="divide-y divide-slate-100">{overview.activity.length ? overview.activity.map((item) => <div className="flex gap-3 px-5 py-4" key={item.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${item.bucket === "overdue" ? "bg-rose-50 text-rose-700" : item.bucket === "today" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}><Clock3 className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{item.leadName}</strong><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">{item.bucket}</span></span><span className="mt-1 block text-[10px] font-semibold text-slate-500">{item.type} · {item.assignedTo}</span><span className="mt-1 block truncate text-[9px] font-bold text-slate-400">{new Date(item.dueAt).toLocaleString("en-IN")} · {item.note}</span></span></div>) : <div className="px-5 py-16 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-300" /><p className="mt-3 text-sm font-black text-slate-700">CRM task queue is clear</p><p className="mt-1 text-xs font-semibold text-slate-400">Run SLA automation to create actions for active risks.</p></div>}</div></aside></div>;
}

function ReliabilityHealthBar({ overview }: { overview: WorkflowReliabilityOverview }) {
  const healthy = overview.failed === 0 && overview.successRate >= 95;
  return <div className="hidden min-h-11 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-950 px-4 text-white lg:flex"><span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"><span className={`size-2 rounded-full ${healthy ? "animate-pulse bg-emerald-400" : "bg-rose-400"}`} />Execution reliability</span><span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-bold text-slate-300"><strong className={healthy ? "mr-1 text-emerald-300" : "mr-1 text-amber-300"}>{overview.successRate}%</strong>success</span><span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-bold text-slate-300"><strong className="mr-1 text-white">{overview.total}</strong>runs</span><span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-bold text-slate-300"><strong className="mr-1 text-rose-300">{overview.failed}</strong>failed</span><span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-bold text-slate-300"><strong className="mr-1 text-sky-300">{overview.p95DurationMs}ms</strong>p95</span><span className="ml-auto truncate text-[9px] font-bold text-slate-400">{overview.slowNodes[0] ? `Slowest: ${overview.slowNodes[0].title} · ${overview.slowNodes[0].averageMs}ms avg` : "Waiting for production executions"}</span></div>;
}

function TemplateGallery({ onApply, onClose }: { onApply: (template: WorkflowTemplate) => void; onClose: () => void }) {
  const accents: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", teal: "bg-teal-50 text-teal-700 border-teal-200", rose: "bg-rose-50 text-rose-700 border-rose-200", sky: "bg-sky-50 text-sky-700 border-sky-200", violet: "bg-violet-50 text-violet-700 border-violet-200" };
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4" onMouseDown={onClose}><div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start gap-3 border-b border-slate-200 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><Library className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Workflow recipe library</h3><p className="mt-1 text-xs font-semibold text-slate-500">Production-ready starting points for registration, attendance, payments, messaging and CRM.</p></div><button aria-label="Close template gallery" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid max-h-[70vh] gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">{workflowTemplates.map((template) => <article className="group flex flex-col rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg" key={template.id}><div className="flex items-start justify-between gap-3"><span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${accents[template.accent] || accents.violet}`}>{template.category}</span><span className="text-[9px] font-black text-slate-400">{template.nodes.length} nodes</span></div><h4 className="mt-4 text-sm font-black text-slate-950">{template.name}</h4><p className="mt-2 flex-1 text-[11px] font-semibold leading-5 text-slate-500">{template.description}</p><div className="mt-4 flex -space-x-1.5">{template.nodes.slice(0, 5).map((item) => <span className={`grid size-7 place-items-center rounded-full border-2 border-white ${colorByKind[item.kind].soft} ${colorByKind[item.kind].icon}`} key={item.id}><NodeIcon kind={item.kind} /></span>)}</div><button className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-black text-white transition group-hover:bg-indigo-600" onClick={() => onApply(template)} type="button"><Sparkles className="size-4" />Use this recipe</button></article>)}</div><footer className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold text-slate-500"><AlertCircle className="size-3.5 text-amber-600" />Templates always open as draft. Review credentials and recipients before activation.</footer></div></div>;
}

function IncidentOperationsPanel({ onAction, onClose, overview, processingId, storageMode }: { onAction: (incidentId: string, operation: "acknowledge" | "resolve") => void; onClose: () => void; overview: WorkflowIncidentOverview; processingId: string; storageMode: "loading" | "cloud" | "browser" }) {
  const colors = { critical: "bg-rose-100 text-rose-800", high: "bg-orange-100 text-orange-800", medium: "bg-amber-100 text-amber-800", low: "bg-sky-100 text-sky-800" };
  return <div className="fixed inset-0 z-[126] flex justify-end bg-slate-950/45" onMouseDown={onClose}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Error operations center</h3><p className="mt-1 text-xs font-semibold text-slate-500">Failed runs become owned, traceable incidents with a clear resolution path.</p></div><button aria-label="Close incidents" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-4 gap-2 p-5"><div className="rounded-xl bg-rose-50 p-3 text-rose-700"><strong className="block text-xl">{overview.open}</strong><span className="text-[8px] font-black uppercase">Open</span></div><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><strong className="block text-xl">{overview.acknowledged}</strong><span className="text-[8px] font-black uppercase">Owned</span></div><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><strong className="block text-xl">{overview.resolved}</strong><span className="text-[8px] font-black uppercase">Resolved</span></div><div className="rounded-xl bg-slate-950 p-3 text-white"><strong className="block text-xl">{overview.critical}</strong><span className="text-[8px] font-black uppercase">Critical</span></div></div><div className="border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Incident queue</h4></div><div className="divide-y divide-slate-100">{overview.incidents.map((item) => <article className={`p-5 ${item.status === "resolved" ? "opacity-60" : ""}`} key={item.id}><div className="flex items-start gap-3"><span className={`mt-0.5 rounded-lg px-2 py-1 text-[8px] font-black uppercase ${colors[item.severity]}`}>{item.severity}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h5 className="text-sm font-black text-slate-900">{item.title}</h5><p className="mt-1 text-[10px] font-bold text-slate-500">{item.failedNode} · {item.executionId}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-600">{item.status}</span></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] font-semibold leading-5 text-slate-600">{item.errorMessage}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[9px] font-bold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}{item.owner ? ` · Owner: ${item.owner}` : ""}</span>{item.status !== "resolved" ? <div className="flex gap-2">{item.status === "open" ? <button className="rounded-lg bg-amber-50 px-3 py-2 text-[9px] font-black text-amber-800 disabled:opacity-40" disabled={processingId === item.id || storageMode !== "cloud"} onClick={() => onAction(item.id, "acknowledge")} type="button">Acknowledge</button> : null}<button className="rounded-lg bg-emerald-600 px-3 py-2 text-[9px] font-black text-white disabled:opacity-40" disabled={processingId === item.id || storageMode !== "cloud"} onClick={() => onAction(item.id, "resolve")} type="button">Resolve</button></div> : <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700"><CheckCircle2 className="size-3.5" />Closed</span>}</div></div></div></article>)}{!overview.incidents.length ? <div className="px-5 py-20 text-center"><CheckCircle2 className="mx-auto size-9 text-emerald-400" /><p className="mt-3 text-sm font-black text-slate-700">No workflow incidents</p><p className="mt-1 text-xs font-semibold text-slate-400">New failed executions will be captured automatically.</p></div> : null}</div></aside></div>;
}

function GovernancePanel({ active, issueCount, onAction, onClose, overview, processing, storageMode, workflowVersion }: { active: boolean; issueCount: number; onAction: (operation: "request" | "approve" | "reject", approvalId?: string) => void; onClose: () => void; overview: WorkflowGovernanceOverview; processing: boolean; storageMode: "loading" | "cloud" | "browser"; workflowVersion: number }) {
  const pending = overview.approvals.find((item) => item.status === "pending" && item.workflowVersion === workflowVersion);
  const approved = overview.approvedVersion === workflowVersion;
  const readiness = [{ label: "Workflow validation passed", ready: issueCount === 0 }, { label: "Cloud persistence connected", ready: storageMode === "cloud" }, { label: `Version ${workflowVersion || 1} approved`, ready: approved }, { label: "Production activation enabled", ready: active }];
  const actionLabel: Record<string, string> = { workflow_created: "Workflow created", workflow_saved: "Workflow saved", workflow_activated: "Workflow activated", version_created: "Version created", version_restored: "Version restored", approval_requested: "Approval requested", approval_approved: "Version approved", approval_rejected: "Changes requested", execution_replayed: "Execution replayed" };
  return <div className="fixed inset-0 z-[125] flex justify-end bg-slate-950/45" onMouseDown={onClose}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><ShieldCheck className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Team governance</h3><p className="mt-1 text-xs font-semibold text-slate-500">Version approvals, publish readiness and an immutable activity trail.</p></div><button aria-label="Close governance" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid gap-4 p-5 sm:grid-cols-2"><section className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Current release</p><h4 className="mt-1 text-xl font-black text-slate-950">Version {workflowVersion || 1}</h4></div><span className={`rounded-xl px-3 py-2 text-[10px] font-black ${approved ? "bg-emerald-50 text-emerald-700" : pending ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{approved ? "Approved" : pending ? "Review pending" : "Not reviewed"}</span></div><div className="mt-4 space-y-2">{readiness.map((item) => <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600" key={item.label}>{item.ready ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertCircle className="size-4 text-amber-500" />}{item.label}</div>)}</div>{pending ? <div className="mt-5 grid grid-cols-2 gap-2"><button className="h-10 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:opacity-40" disabled={processing} onClick={() => onAction("approve", pending.id)} type="button">Approve version</button><button className="h-10 rounded-xl bg-rose-50 text-xs font-black text-rose-700 disabled:opacity-40" disabled={processing} onClick={() => onAction("reject", pending.id)} type="button">Request changes</button></div> : <button className="mt-5 h-10 w-full rounded-xl bg-slate-950 text-xs font-black text-white disabled:opacity-40" disabled={processing || storageMode !== "cloud" || approved} onClick={() => onAction("request")} type="button">{processing ? "Submitting…" : approved ? "Version approved" : "Request team review"}</button>}</section><section className="rounded-2xl border border-slate-200 p-4"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Review history</p><div className="mt-3 space-y-2">{overview.approvals.slice(0, 5).map((item) => <div className="rounded-xl bg-slate-50 p-3" key={item.id}><div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-slate-800">Version {item.workflowVersion}</strong><span className={`rounded px-2 py-0.5 text-[8px] font-black uppercase ${item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</span></div><p className="mt-1 text-[9px] font-semibold text-slate-500">{item.requestedBy} · {new Date(item.requestedAt).toLocaleString("en-IN")}</p></div>)}{!overview.approvals.length ? <p className="py-8 text-center text-xs font-semibold text-slate-400">No review requests yet.</p> : null}</div></section></div><div className="border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Audit trail</h4></div><div className="divide-y divide-slate-100">{overview.audit.map((item) => <div className="flex gap-3 px-5 py-3.5" key={item.id}><span className="mt-1 size-2 shrink-0 rounded-full bg-indigo-500" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="text-xs text-slate-800">{actionLabel[item.action] || item.action.replaceAll("_", " ")}</strong><span className="text-[9px] font-bold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}</span></span><span className="mt-1 block text-[10px] font-semibold text-slate-500">{item.actor}{item.workflowVersion ? ` · Version ${item.workflowVersion}` : ""}</span></span></div>)}{!overview.audit.length ? <div className="px-5 py-12 text-center text-xs font-semibold text-slate-400">Activity will appear after the next saved change.</div> : null}</div></aside></div>;
}

function ScheduleOperationsPanel({ onClose, onProcess, overview, processing, storageMode }: { onClose: () => void; onProcess: () => void; overview: WorkflowScheduleOverview; processing: boolean; storageMode: "loading" | "cloud" | "browser" }) {
  return <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/45" onMouseDown={onClose}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">Schedule operations</h3><p className="mt-1 text-xs font-semibold text-slate-500">Durable hourly, daily, weekly and one-time workflow triggers.</p></div><button aria-label="Close schedule operations" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-2 gap-3 p-5"><div className="rounded-2xl bg-amber-50 p-4 text-amber-800"><span className="block text-2xl font-black">{overview.active}</span><span className="text-[9px] font-black uppercase tracking-[0.1em]">Active schedules</span></div><div className="rounded-2xl bg-indigo-50 p-4 text-indigo-800"><span className="block text-sm font-black">{overview.nextRunAt ? new Date(overview.nextRunAt).toLocaleString("en-IN") : "Not scheduled"}</span><span className="mt-1 block text-[9px] font-black uppercase tracking-[0.1em]">Next run</span></div></div><div className="flex items-center justify-between gap-3 border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Configured schedules</h4><button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[9px] font-black text-amber-800 disabled:opacity-40" disabled={processing || storageMode !== "cloud"} onClick={onProcess} type="button">{processing ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3" />}{processing ? "Checking" : "Process due now"}</button></div><div className="divide-y divide-slate-100">{overview.schedules.length ? overview.schedules.map((item) => <div className="flex gap-3 px-5 py-4" key={`${item.workflowId}-${item.nodeId}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlarmClockIcon /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{item.title}</strong><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">{item.frequency}</span></span><span className="mt-1 block text-[10px] font-semibold text-slate-500">{item.workflowName} · {item.timezone}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">Next: {item.nextRunAt ? new Date(item.nextRunAt).toLocaleString("en-IN") : "No future run"}</span></span></div>) : <div className="px-5 py-12 text-center"><Clock3 className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">No active schedules</p><p className="mt-1 text-xs font-semibold text-slate-400">Add a Scheduled time node and activate the workflow.</p></div>}</div>{overview.history.length ? <><div className="border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Recent schedule runs</h4></div><div className="divide-y divide-slate-100">{overview.history.slice(0, 10).map((item) => <div className="flex items-center gap-3 px-5 py-3" key={`${item.workflowId}-${item.nodeId}-${item.scheduledFor}`}><span className={`size-2 rounded-full ${item.status === "success" ? "bg-emerald-500" : item.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} /><span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-600">{item.executionId || item.workflowId}</span><span className="text-[9px] font-bold text-slate-400">{new Date(item.scheduledFor).toLocaleString("en-IN")}</span></div>)}</div></> : null}<footer className="border-t border-slate-200 bg-slate-50 p-4 text-[10px] font-semibold leading-5 text-slate-500">For automatic minute-by-minute execution, call this processor with <strong>Bearer WORKFLOW_CRON_SECRET</strong>. Repeated calls in the same minute are safely ignored.</footer></aside></div>;
}

function AlarmClockIcon() { return <Clock3 className="size-4" />; }

function WhatsAppActivityPanel({ onClose, onProcessRetries, overview, processing, storageMode }: { onClose: () => void; onProcessRetries: () => void; overview: WhatsAppAutomationOverview; processing: boolean; storageMode: "loading" | "cloud" | "browser" }) {
  const cards: Array<[string, number, string]> = [["Received", overview.counts.received || 0, "bg-sky-50 text-sky-700"], ["Failed", overview.counts.failed || 0, "bg-rose-50 text-rose-700"], ["Retry due", overview.retryDue, "bg-amber-50 text-amber-700"]];
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35" onMouseDown={onClose}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageCircle className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-lg font-black text-slate-950">WhatsApp activity</h3><p className="mt-1 text-xs font-semibold text-slate-500">Inbound replies, delivery receipts and retry health.</p></div><button aria-label="Close WhatsApp activity" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="grid grid-cols-3 gap-2 p-5">{cards.map(([label, value, color]) => <div className={`rounded-xl p-3 ${color}`} key={label}><span className="block text-xl font-black">{value}</span><span className="text-[9px] font-black uppercase tracking-[0.1em]">{label}</span></div>)}</div><div className="flex items-center justify-between gap-3 border-y border-slate-100 px-5 py-3"><h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Latest message events</h4><button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[9px] font-black text-amber-800 disabled:opacity-40" disabled={!overview.retryDue || processing || storageMode !== "cloud"} onClick={onProcessRetries} type="button">{processing ? <RefreshCw className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}{processing ? "Processing" : "Process due retries"}</button></div><div className="divide-y divide-slate-100">{overview.activity.length ? overview.activity.map((item) => <div className="flex gap-3 px-5 py-4" key={item.id}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${item.direction === "inbound" ? "bg-sky-50 text-sky-700" : item.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{item.direction === "inbound" ? <MessageCircle className="size-4" /> : item.status === "failed" ? <AlertCircle className="size-4" /> : <Check className="size-4" />}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{item.direction === "inbound" ? "Incoming reply" : item.templateName || "Outbound message"}</strong><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">{item.status}</span></span><span className="mt-1 block text-[10px] font-semibold text-slate-500">•••• {item.mobile.slice(-4)}{item.text ? ` · ${item.text.slice(0, 90)}` : ""}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}</span></span></div>) : <div className="px-5 py-16 text-center"><MessageCircle className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">No WhatsApp events yet</p><p className="mt-1 text-xs font-semibold text-slate-400">Signed webhook events will appear here automatically.</p></div>}</div></aside></div>;
}

function NodeLibrary({ filteredCatalog, onAdd, onClose, onCustom, query, setQuery }: { filteredCatalog: typeof catalog; onAdd: (item: CatalogItem) => void; onClose: () => void; onCustom: () => void; query: string; setQuery: (value: string) => void }) {
  return <aside className="hidden w-[224px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white lg:flex"><div className="shrink-0 border-b border-slate-200 p-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-950">Node library</h3><p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Smart rule engine ready</p></div><button aria-label="Collapse node library" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button"><PanelLeftClose className="size-4" /></button></div><button className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 text-xs font-black text-indigo-700 hover:bg-indigo-100" onClick={onCustom} type="button"><Plus className="size-4" />Custom node</button><label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50"><Search className="size-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search 25+ actions" value={query} /></label></div><div className="min-h-0 flex-1 overflow-y-auto p-3">{filteredCatalog.map((section) => <div className="mb-4" key={section.category}><p className={`mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${section.color}`}>{section.category}</p><div className="space-y-1">{section.items.map((item) => <button className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100" key={`${section.category}-${item.title}`} onClick={() => onAdd(item)} type="button"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white"><item.icon className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate">{item.title}</span><span className="block truncate text-[9px] font-semibold text-slate-400">{item.subtitle}</span></span><Plus className="size-3.5 text-slate-300 group-hover:text-indigo-500" /></button>)}</div></div>)}{!filteredCatalog.length ? <EmptySearch query={query} /> : null}</div></aside>;
}

function Connections({ connections, executionState, nodeMap, onInsert }: { connections: Connection[]; executionState: Record<string, ExecutionNodeStatus>; nodeMap: Map<string, WorkflowNode>; onInsert: (connectionId: string) => void }) {
  return <><svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible"><defs><marker id="workflow-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3"><path d="M0,0 L0,6 L7,3 z" fill="#64748b" /></marker><marker id="workflow-arrow-running" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3"><path d="M0,0 L0,6 L7,3 z" fill="#4f46e5" /></marker></defs>{connections.map((connection) => { const from = nodeMap.get(connection.from); const to = nodeMap.get(connection.to); if (!from || !to) return null; const x1 = from.x + NODE_WIDTH; const y1 = from.y + NODE_HEIGHT / 2; const x2 = to.x; const y2 = to.y + NODE_HEIGHT / 2; const bend = Math.max(58, Math.abs(x2 - x1) * .45); const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`; const live = executionState[connection.from] === "success" && ["running", "success"].includes(executionState[connection.to]); return <g key={connection.id}><path d={path} fill="none" markerEnd={live ? "url(#workflow-arrow-running)" : "url(#workflow-arrow)"} stroke={live ? "#4f46e5" : connection.dashed ? "#94a3b8" : "#64748b"} strokeDasharray={connection.dashed ? "7 6" : undefined} strokeLinecap="round" strokeWidth={live ? 3 : 2} />{connection.label ? <g><rect fill="white" height="24" rx="7" stroke="#cbd5e1" width={Math.max(76, connection.label.length * 6.4 + 18)} x={(x1 + x2) / 2 - 40} y={(y1 + y2) / 2 - 30} /><text fill="#475569" fontSize="10" fontWeight="800" x={(x1 + x2) / 2 - 30} y={(y1 + y2) / 2 - 14}>{connection.label}</text></g> : null}</g>; })}</svg>{connections.map((connection) => { const from = nodeMap.get(connection.from); const to = nodeMap.get(connection.to); if (!from || !to) return null; return <button aria-label="Insert node in connection" className="absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-slate-300 bg-white text-slate-400 opacity-60 shadow-sm transition hover:scale-110 hover:border-indigo-400 hover:text-indigo-600 focus:opacity-100" key={`insert-${connection.id}`} onClick={(event) => { event.stopPropagation(); onInsert(connection.id); }} onPointerDown={(event) => event.stopPropagation()} style={{ left: (from.x + NODE_WIDTH + to.x) / 2, top: (from.y + to.y) / 2 + NODE_HEIGHT / 2 }} type="button"><Plus className="size-3" /></button>; })}</>;
}

function CanvasNode({ connecting, executionStatus, node, onConnect, onKeyboardSelect, onOpenPicker, onPointerDown, selected }: { connecting: boolean; executionStatus: ExecutionNodeStatus; node: WorkflowNode; onConnect: () => void; onKeyboardSelect: () => void; onOpenPicker: () => void; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; selected: boolean }) {
  const colors = colorByKind[node.kind];
  const statusClass = executionStatus === "success" ? "border-emerald-500 ring-4 ring-emerald-100" : executionStatus === "running" ? "border-indigo-500 ring-4 ring-indigo-100" : executionStatus === "failed" ? "border-rose-500 ring-4 ring-rose-100" : selected ? "border-indigo-500 ring-4 ring-indigo-100" : colors.border;
  return <div aria-label={`${node.title} workflow node`} className={`group absolute h-[112px] w-[188px] select-none rounded-2xl border-2 bg-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.55)] transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-18px_rgba(15,23,42,0.5)] ${statusClass} ${connecting ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onKeyboardSelect(); } }} onPointerDown={onPointerDown} role="button" style={{ left: node.x, top: node.y }} tabIndex={0}><div className="flex h-full flex-col p-3"><div className="flex items-start gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${colors.soft} ${colors.icon}`}><NodeIcon kind={node.kind} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black text-slate-950">{node.title}</span><span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-400">{node.subtitle}</span></span><GripVertical className="size-3.5 text-slate-300" /></div><div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 text-[8px] font-black uppercase tracking-[0.1em]"><span className={executionStatus === "running" ? "text-indigo-700" : executionStatus === "success" ? "text-emerald-700" : executionStatus === "failed" ? "text-rose-700" : "text-slate-400"}><span className={`mr-1.5 inline-block size-1.5 rounded-full ${executionStatus === "running" ? "animate-pulse bg-indigo-500" : executionStatus === "success" ? "bg-emerald-500" : executionStatus === "failed" ? "bg-rose-500" : colors.dot}`} />{executionStatus === "idle" ? "Ready" : executionStatus}</span><span className="text-slate-400">{node.kind === "trigger" ? "Trigger" : node.kind === "condition" ? "Rule" : "Action"}</span></div></div>{node.kind !== "trigger" ? <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-400 shadow-sm" /> : null}<button aria-label={`Connect from ${node.title}`} className={`absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-[3px] border-white shadow-sm hover:scale-125 ${connecting ? "animate-pulse bg-indigo-600" : "bg-slate-500 hover:bg-indigo-500"}`} onClick={(event) => { event.stopPropagation(); onConnect(); }} onPointerDown={(event) => event.stopPropagation()} type="button" /><button aria-label={`Add next node after ${node.title}`} className="absolute -bottom-3 left-1/2 hidden h-6 -translate-x-1/2 items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 text-[8px] font-black text-indigo-700 shadow-sm group-hover:flex" onClick={(event) => { event.stopPropagation(); onOpenPicker(); }} onPointerDown={(event) => event.stopPropagation()} type="button"><Plus className="size-3" />Next</button></div>;
}

function Inspector({ node, onChange, onClose, onDelete, onDuplicate, onRename, onTab, onTest, salesPeople, status, tab }: { node: WorkflowNode; onChange: (key: string, value: ConfigValue) => void; onClose: () => void; onDelete: () => void; onDuplicate: () => void; onRename: (title: string) => void; onTab: (tab: InspectorTab) => void; onTest: () => void; salesPeople: WorkflowSalesPerson[]; status: ExecutionNodeStatus; tab: InspectorTab }) {
  return <aside className="flex h-full w-full flex-col overflow-hidden bg-white"><div className="shrink-0"><div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><span className={`grid size-9 place-items-center rounded-xl ${colorByKind[node.kind].soft} ${colorByKind[node.kind].icon}`}><NodeIcon kind={node.kind} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-950">{node.title}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Node ready</p></div><button aria-label="Close inspector" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button"><PanelRightClose className="size-4" /></button></div><div className="flex border-b border-slate-200 px-2">{(["parameters", "settings", "output"] as InspectorTab[]).map((item) => <button aria-selected={tab === item} className={`flex-1 border-b-2 px-1 py-3 text-[10px] font-black capitalize ${tab === item ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-700"}`} key={item} onClick={() => onTab(item)} role="tab" type="button">{item === "parameters" ? "Parameters" : item === "settings" ? "Settings" : "Test & output"}</button>)}</div></div><div className="min-h-0 flex-1 overflow-y-auto p-4">{tab === "parameters" ? <ParametersPanel node={node} onChange={onChange} onRename={onRename} onTest={onTest} salesPeople={salesPeople} /> : null}{tab === "settings" ? <SettingsPanel node={node} onChange={onChange} /> : null}{tab === "output" ? <OutputPanel node={node} onTest={onTest} status={status} /> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button className="workflow-button-secondary justify-center" onClick={onDuplicate} type="button"><Copy className="size-4" />Duplicate</button><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-50" onClick={onDelete} type="button"><Trash2 className="size-4" />Delete</button></div></div></aside>;
}

function ExecutionDrawer({ onOpen, onSelectRun, open, runs }: { onOpen: () => void; onSelectRun: (run: RunRow) => void; open: boolean; runs: RunRow[] }) {
  return <div className="border-t border-slate-200 bg-white"><button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={onOpen} type="button"><span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><History className="size-4" /></span><span><span className="block text-xs font-black text-slate-950">Executions</span><span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />{runs.length} recent runs · Listening for events</span></span></span><span className="flex items-center gap-3 text-[10px] font-bold text-slate-400"><span className="hidden sm:inline">⌘S Save · / Add node · Space + drag Pan</span>{open ? <PanelBottomClose className="size-4" /> : <PanelBottomOpen className="size-4" />}</span></button>{open ? <div className="border-t border-slate-200"><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2"><div className="flex items-center gap-2"><button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600" type="button">All statuses <ChevronDown className="ml-1 inline size-3" /></button><button aria-label="Refresh executions" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" type="button"><RefreshCw className="size-3.5" /></button></div><span className="text-[10px] font-bold text-slate-400">Latest production and test executions</span></div><div className="max-h-[270px] overflow-auto"><table className="w-full min-w-[820px] text-left text-[11px]"><thead className="sticky top-0 z-10 bg-white text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Execution</th><th className="px-4 py-2.5">Participant</th><th className="px-4 py-2.5">Progress</th><th className="px-4 py-2.5">Started</th><th className="px-4 py-2.5">Duration</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{runs.map((run) => <tr className="font-semibold text-slate-600 hover:bg-slate-50" key={run.id}><td className="px-4 py-3"><RunStatusBadge status={run.status} /></td><td className="px-4 py-3 font-mono text-[10px] font-black text-slate-800">{run.id}</td><td className="px-4 py-3"><span className="block font-bold text-slate-800">{run.participant}</span><span className="text-[9px] text-slate-400">{run.trigger}</span></td><td className="px-4 py-3">{run.progress}</td><td className="px-4 py-3">{run.started}</td><td className="px-4 py-3">{run.duration}</td><td className="px-4 py-3 text-right"><button className="font-black text-indigo-700 hover:text-indigo-900" onClick={() => onSelectRun(run)} type="button">{run.status === "failed" ? "Debug node" : "View log"}</button></td></tr>)}</tbody></table></div></div> : null}</div>;
}

function SaveIndicator({ state }: { state: SaveState }) { return <span className={`hidden items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-black sm:inline-flex ${state === "unsaved" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{state === "saving" ? <RefreshCw className="size-3 animate-spin" /> : state === "saved" ? <Check className="size-3 text-emerald-600" /> : <span className="size-1.5 rounded-full bg-amber-500" />}{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Unsaved"}</span>; }

function ToolbarButton({ active = false, children, disabled = false, label, onClick }: { active?: boolean; children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) { return <button aria-label={label} className={`grid size-8 place-items-center rounded-lg border text-slate-500 ${active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-transparent hover:bg-slate-100 hover:text-slate-800"} disabled:cursor-not-allowed disabled:opacity-30`} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }} onPointerDown={(event) => event.stopPropagation()} title={label} type="button">{children}</button>; }

function MiniMap({ nodes, pan, selectedIds, zoom }: { nodes: WorkflowNode[]; pan: { x: number; y: number }; selectedIds: string[]; zoom: number }) { return <div className="absolute bottom-3 right-3 z-20 hidden h-28 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:block"><div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-50" style={{ backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundSize: "8px 8px" }}>{nodes.map((node) => <span className={`absolute h-2.5 w-4 rounded-sm ${selectedIds.includes(node.id) ? "bg-indigo-500" : colorByKind[node.kind].dot}`} key={`map-${node.id}`} style={{ left: `${Math.min(92, node.x / CANVAS_WIDTH * 100)}%`, top: `${Math.min(88, node.y / CANVAS_HEIGHT * 100)}%` }} />)}<span className="absolute rounded border border-indigo-400 bg-indigo-100/20" style={{ height: `${Math.min(92, 70 / zoom)}%`, left: `${Math.max(0, -pan.x / CANVAS_WIDTH / zoom * 100)}%`, top: `${Math.max(0, -pan.y / CANVAS_HEIGHT / zoom * 100)}%`, width: `${Math.min(95, 38 / zoom)}%` }} /></div><span className="absolute right-2 top-2 rounded bg-white px-1.5 py-0.5 text-[8px] font-black text-slate-400">MINIMAP</span></div>; }
