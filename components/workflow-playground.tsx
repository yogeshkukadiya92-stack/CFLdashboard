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
  defaultConfigFor,
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
  type WorkflowNode,
} from "@/lib/workflow-studio";

type SaveState = "saved" | "saving" | "unsaved";

function NodeIcon({ kind }: { kind: NodeKind }) {
  const icons = { trigger: Zap, condition: GitBranch, crm: UserPlus, workshop: Workflow, attendance: UsersRound, message: MessageCircle, payment: CircleDollarSign, delay: Clock3, webhook: Webhook };
  const Icon = icons[kind];
  return <Icon className="size-4" />;
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

export function WorkflowPlayground() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const dragHistoryCapturedRef = useRef(false);
  const runTimersRef = useRef<number[]>([]);

  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workflowName, setWorkflowName] = useState("Workshop Registration & Onboarding");
  const [active, setActive] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [testing, setTesting] = useState(false);
  const [zoom, setZoom] = useState(0.52);
  const [pan, setPan] = useState({ x: 14, y: 28 });
  const [query, setQuery] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [executionsOpen, setExecutionsOpen] = useState(true);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [noteOpen, setNoteOpen] = useState(true);
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

  useEffect(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem(WORKFLOW_STORAGE_KEY) || "null") as {
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
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setSaveState("unsaved");
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify({ nodes, connections, name: workflowName, active, note: noteText }));
      window.setTimeout(() => setSaveState("saved"), 260);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, connections, nodes, noteText, workflowName]);

  useEffect(() => () => runTimersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

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

  function persistWorkflow(nextActive = active) {
    setSaveState("saving");
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify({ nodes, connections, name: workflowName, active: nextActive, note: noteText }));
    window.setTimeout(() => setSaveState("saved"), 260);
  }

  function activateWorkflow() {
    if (validationIssues.some((issue) => issue.level === "error")) {
      setValidationOpen(true);
      return;
    }
    setActive(true);
    persistWorkflow(true);
  }

  function testWorkflow() {
    if (testing) return;
    runTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    runTimersRef.current = [];
    const preferred = ["registration", "validate", "route", "assign", "batch", "wait", "whatsapp", "followup"];
    const order = preferred.filter((id) => nodeMap.has(id));
    const executionOrder = order.length ? order : nodes.map((node) => node.id);
    const runId = `EXE-${Date.now().toString().slice(-6)}`;
    const row: RunRow = { id: runId, status: "running", started: nowLabel(), duration: "Running", trigger: "Manual test", participant: "Mock participant · Ahmedabad", progress: `0 / ${executionOrder.length} nodes`, detail: "Executing with safe mock data. No external message will be sent." };
    setRuns((current) => [row, ...current]);
    setExecutionState({});
    setTesting(true);
    executionOrder.forEach((id, index) => {
      const timer = window.setTimeout(() => {
        setExecutionState((current) => {
          const next = { ...current };
          if (index > 0) next[executionOrder[index - 1]] = "success";
          next[id] = "running";
          return next;
        });
        setRuns((current) => current.map((run) => run.id === runId ? { ...run, progress: `${index + 1} / ${executionOrder.length} nodes` } : run));
      }, index * 420);
      runTimersRef.current.push(timer);
    });
    const finishTimer = window.setTimeout(() => {
      const last = executionOrder.at(-1);
      if (last) setExecutionState((current) => ({ ...current, [last]: "success" }));
      setRuns((current) => current.map((run) => run.id === runId ? { ...run, status: "success", duration: `${Math.max(1, executionOrder.length * 0.42).toFixed(1)}s`, progress: `${executionOrder.length} / ${executionOrder.length} nodes`, detail: "Mock execution completed. Salesperson, batch and messaging outputs were validated without external side effects." } : run));
      setTesting(false);
    }, executionOrder.length * 420 + 220);
    runTimersRef.current.push(finishTimer);
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
    const nextNode: WorkflowNode = { id, kind: item.kind, title: item.title, subtitle: item.subtitle, x, y, config: defaultConfigFor(item.kind) };
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
    const payload = JSON.stringify({ name: workflowName, version: "2.4", active, nodes, connections }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
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

  return <section className={`${focusMode ? "fixed inset-2 z-[80] flex flex-col overflow-hidden shadow-2xl" : "overflow-hidden shadow-panel"} rounded-[20px] border border-slate-200 bg-white`}>
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm"><Workflow className="size-5" /></span>
        <div className="min-w-0"><div className="mb-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400"><span>Automation</span><ChevronRight className="size-3" /><span>Workflows</span><span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">v2.4</span></div><input aria-label="Workflow name" className="w-[min(330px,58vw)] bg-transparent text-sm font-black text-slate-950 outline-none focus:text-indigo-700" onChange={(event) => setWorkflowName(event.target.value)} value={workflowName} /></div>
        <SaveIndicator state={saveState} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button aria-checked={active} className={`hidden items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] lg:inline-flex ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`} onClick={() => active ? setActive(false) : activateWorkflow()} role="switch" type="button"><span className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />Production · {active ? "Active" : "Draft"}</button>
        <button className="workflow-button-secondary" disabled={testing} onClick={testWorkflow} type="button">{testing ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}{testing ? "Running test" : "Test workflow"}</button>
        <span className="hidden lg:inline-flex"><button className="workflow-button-secondary" onClick={() => persistWorkflow()} type="button"><Save className="size-4" />Save</button></span>
        <span className="hidden lg:inline-flex"><button className="workflow-button-primary" onClick={activateWorkflow} type="button"><Sparkles className="size-4" />Save & activate</button></span>
        <div className="relative hidden lg:block"><button aria-label="More workflow actions" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setMoreOpen((value) => !value)} type="button"><MoreHorizontal className="size-5" /></button>{moreOpen ? <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><MenuAction icon={Copy} label="Duplicate workflow" onClick={() => { setWorkflowName(`${workflowName} copy`); setActive(false); setMoreOpen(false); }} /><MenuAction icon={History} label="Version history" onClick={() => { setVersionsOpen(true); setMoreOpen(false); }} /><MenuAction icon={Download} label="Export workflow JSON" onClick={exportWorkflow} /><MenuAction icon={Braces} label="Keyboard shortcuts" onClick={() => { setShortcutsOpen(true); setMoreOpen(false); }} /></div> : null}</div>
      </div>
    </header>

    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 lg:hidden"><p className="text-[11px] font-bold text-slate-600">Mobile run view · Open on a laptop to edit the canvas.</p><span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-500">READ ONLY</span></div>

    <div className={`flex min-w-0 ${focusMode ? "min-h-0 flex-1" : "min-h-[680px]"}`}>
      {libraryOpen ? <NodeLibrary filteredCatalog={filteredCatalog} onAdd={(item) => addNode(item)} onClose={() => setLibraryOpen(false)} onCustom={() => setPickerContext({ mode: "add" })} query={query} setQuery={setQuery} /> : null}

      <main className="flex min-w-0 flex-1 flex-col bg-slate-100">
        <div className="flex h-12 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
          <div className="flex items-center gap-1">{!libraryOpen ? <ToolbarButton label="Open node library" onClick={() => setLibraryOpen(true)}><LayoutGrid className="size-4" /></ToolbarButton> : null}<ToolbarButton disabled={!past.length} label="Undo · ⌘Z" onClick={undo}><Undo2 className="size-4" /></ToolbarButton><ToolbarButton disabled={!future.length} label="Redo · ⇧⌘Z" onClick={redo}><Redo2 className="size-4" /></ToolbarButton><span className="mx-1 h-5 w-px bg-slate-200" /><ToolbarButton active={snapEnabled} label="Snap to grid" onClick={() => setSnapEnabled((value) => !value)}><LayoutGrid className="size-4" /></ToolbarButton><ToolbarButton active={minimapOpen} label="Toggle minimap" onClick={() => setMinimapOpen((value) => !value)}><MousePointer2 className="size-4" /></ToolbarButton><ToolbarButton active={noteOpen} label="Add sticky note" onClick={() => setNoteOpen((value) => !value)}><StickyNote className="size-4" /></ToolbarButton></div>
          <div className="flex items-center gap-1.5">{selectedIds.length > 1 ? <span className="hidden rounded-lg bg-indigo-50 px-2 py-1.5 text-[10px] font-black text-indigo-700 sm:inline">{selectedIds.length} selected</span> : null}<button className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black ${validationIssues.some((issue) => issue.level === "error") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} onClick={() => setValidationOpen((value) => !value)} type="button">{validationIssues.length ? <AlertCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}{validationIssues.length ? `${validationIssues.length} issue${validationIssues.length > 1 ? "s" : ""}` : "Workflow valid"}</button><ToolbarButton label={focusMode ? "Exit focus mode" : "Focus mode"} onClick={() => setFocusMode((value) => { const next = !value; if (next) setExecutionsOpen(false); return next; })}><Maximize2 className="size-4" /></ToolbarButton>{!inspectorOpen && selected ? <ToolbarButton label="Open inspector" onClick={() => setInspectorOpen(true)}><SlidersHorizontal className="size-4" /></ToolbarButton> : null}</div>
        </div>

        <div className={`relative overflow-hidden ${focusMode ? "min-h-0 flex-1" : "h-[632px]"} ${spacePressed || panning ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={() => { setDragging(null); setPanning(null); dragHistoryCapturedRef.current = false; }} onWheel={onCanvasWheel} ref={canvasRef} style={{ touchAction: "none" }}>
          <div className="pointer-events-none absolute inset-0 bg-slate-50" style={{ backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${20 * zoom}px ${20 * zoom}px` }} />
          {connectingFrom ? <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[11px] font-black text-indigo-700 shadow-lg"><span className="size-2 animate-pulse rounded-full bg-indigo-500" />Choose the next node or add a new one<button className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); setConnectingFrom(null); }} type="button"><X className="size-3.5" /></button></div> : null}
          {validationOpen ? <ValidationPopover issues={validationIssues} onClose={() => setValidationOpen(false)} /> : null}
          <div className="pointer-events-none absolute left-0 top-0 origin-top-left lg:pointer-events-auto" style={{ height: CANVAS_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: CANVAS_WIDTH }}>
            <Connections connections={connections} executionState={executionState} nodeMap={nodeMap} onInsert={(connectionId) => setPickerContext({ mode: "insert", connectionId })} />
            {noteOpen ? <div className="absolute left-[760px] top-5 z-10 w-[300px] rotate-[-1deg] rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm"><div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800"><StickyNote className="size-3.5" />Batch operations note<span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5">#team-sync</span></div><textarea aria-label="Workflow sticky note" className="h-12 w-full resize-none bg-transparent text-[11px] font-semibold leading-4 text-amber-950 outline-none" onChange={(event) => setNoteText(event.target.value)} onPointerDown={(event) => event.stopPropagation()} value={noteText} /></div> : null}
            {nodes.map((node) => <CanvasNode connecting={Boolean(connectingFrom)} executionStatus={executionState[node.id] ?? "idle"} key={node.id} node={node} onConnect={() => setConnectingFrom(node.id)} onKeyboardSelect={() => selectNode(node.id, false)} onOpenPicker={() => setPickerContext({ mode: "connect", fromId: node.id })} onPointerDown={(event) => onNodePointerDown(event, node)} selected={selectedIds.includes(node.id)} />)}
          </div>
          <div className="absolute bottom-3 left-3 z-20 flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"><ToolbarButton label="Fit workflow" onClick={fitToView}><Maximize2 className="size-4" /></ToolbarButton><ToolbarButton label="Zoom out" onClick={() => setZoom((value) => Math.max(0.35, value - 0.1))}><Minus className="size-4" /></ToolbarButton><span className="grid h-9 min-w-12 place-items-center border-x border-slate-200 px-1 text-[10px] font-black text-slate-500">{Math.round(zoom * 100)}%</span><ToolbarButton label="Zoom in" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}><Plus className="size-4" /></ToolbarButton></div>
          <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-500 shadow-sm sm:flex"><span><KeyCap>Space</KeyCap> drag to pan</span><span><KeyCap>⇧</KeyCap> select many</span><span><KeyCap>/</KeyCap> add node</span></div>
          {minimapOpen ? <MiniMap nodes={nodes} pan={pan} selectedIds={selectedIds} zoom={zoom} /> : null}
        </div>
      </main>

      {selected && inspectorOpen ? <Inspector node={selected} onChange={updateNodeConfig} onClose={() => setInspectorOpen(false)} onDelete={deleteSelected} onDuplicate={duplicateSelected} onRename={(title) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, title } : node))} onTab={setInspectorTab} onTest={testWorkflow} status={executionState[selected.id] ?? "idle"} tab={inspectorTab} /> : null}
    </div>

    <ExecutionDrawer open={executionsOpen} onOpen={() => setExecutionsOpen((value) => !value)} onSelectRun={setSelectedRun} runs={runs} />
    {pickerContext ? <NodePicker context={pickerContext} items={pickerItems} onAdd={(item) => addNode(item, pickerContext)} onClose={() => { setPickerContext(null); setPickerQuery(""); }} query={pickerQuery} searchRef={searchRef} setQuery={setPickerQuery} /> : null}
    {versionsOpen ? <VersionHistory onClose={() => setVersionsOpen(false)} onRestore={() => { recordHistory(); setNodes(initialNodes); setConnections(initialConnections); setVersionsOpen(false); }} /> : null}
    {shortcutsOpen ? <ShortcutDialog onClose={() => setShortcutsOpen(false)} /> : null}
    {selectedRun ? <RunDetail onClose={() => setSelectedRun(null)} run={selectedRun} /> : null}
    <style jsx global>{`.workflow-input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;background:#fff;padding:.68rem .75rem;font-size:.72rem;font-weight:700;color:#334155;outline:none;transition:border-color 160ms ease,box-shadow 160ms ease}.workflow-input:focus{border-color:#818cf8;box-shadow:0 0 0 3px #eef2ff}.workflow-button-secondary{display:inline-flex;height:2.5rem;align-items:center;gap:.5rem;border-radius:.75rem;border:1px solid #e2e8f0;background:#fff;padding:0 .8rem;font-size:.7rem;font-weight:900;color:#475569;white-space:nowrap}.workflow-button-secondary:hover{background:#f8fafc;border-color:#cbd5e1}.workflow-button-secondary:disabled{opacity:.45;cursor:not-allowed}.workflow-button-primary{display:inline-flex;height:2.5rem;align-items:center;gap:.5rem;border-radius:.75rem;background:#059669;padding:0 .9rem;font-size:.7rem;font-weight:900;color:#fff;white-space:nowrap;box-shadow:0 8px 22px -12px rgba(5,150,105,.9)}.workflow-button-primary:hover{background:#047857}`}</style>
  </section>;
}

function NodeLibrary({ filteredCatalog, onAdd, onClose, onCustom, query, setQuery }: { filteredCatalog: typeof catalog; onAdd: (item: CatalogItem) => void; onClose: () => void; onCustom: () => void; query: string; setQuery: (value: string) => void }) {
  return <aside className="hidden w-[224px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white lg:flex"><div className="shrink-0 border-b border-slate-200 p-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-950">Node library</h3><p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />v2.4 engine active</p></div><button aria-label="Collapse node library" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button"><PanelLeftClose className="size-4" /></button></div><button className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 text-xs font-black text-indigo-700 hover:bg-indigo-100" onClick={onCustom} type="button"><Plus className="size-4" />Custom node</button><label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50"><Search className="size-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search 25+ actions" value={query} /></label></div><div className="min-h-0 flex-1 overflow-y-auto p-3">{filteredCatalog.map((section) => <div className="mb-4" key={section.category}><p className={`mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${section.color}`}>{section.category}</p><div className="space-y-1">{section.items.map((item) => <button className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100" key={`${section.category}-${item.title}`} onClick={() => onAdd(item)} type="button"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white"><item.icon className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate">{item.title}</span><span className="block truncate text-[9px] font-semibold text-slate-400">{item.subtitle}</span></span><Plus className="size-3.5 text-slate-300 group-hover:text-indigo-500" /></button>)}</div></div>)}{!filteredCatalog.length ? <EmptySearch query={query} /> : null}</div></aside>;
}

function Connections({ connections, executionState, nodeMap, onInsert }: { connections: Connection[]; executionState: Record<string, ExecutionNodeStatus>; nodeMap: Map<string, WorkflowNode>; onInsert: (connectionId: string) => void }) {
  return <><svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible"><defs><marker id="workflow-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3"><path d="M0,0 L0,6 L7,3 z" fill="#64748b" /></marker><marker id="workflow-arrow-running" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3"><path d="M0,0 L0,6 L7,3 z" fill="#4f46e5" /></marker></defs>{connections.map((connection) => { const from = nodeMap.get(connection.from); const to = nodeMap.get(connection.to); if (!from || !to) return null; const x1 = from.x + NODE_WIDTH; const y1 = from.y + NODE_HEIGHT / 2; const x2 = to.x; const y2 = to.y + NODE_HEIGHT / 2; const bend = Math.max(58, Math.abs(x2 - x1) * .45); const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`; const live = executionState[connection.from] === "success" && ["running", "success"].includes(executionState[connection.to]); return <g key={connection.id}><path d={path} fill="none" markerEnd={live ? "url(#workflow-arrow-running)" : "url(#workflow-arrow)"} stroke={live ? "#4f46e5" : connection.dashed ? "#94a3b8" : "#64748b"} strokeDasharray={connection.dashed ? "7 6" : undefined} strokeLinecap="round" strokeWidth={live ? 3 : 2} />{connection.label ? <g><rect fill="white" height="24" rx="7" stroke="#cbd5e1" width={Math.max(76, connection.label.length * 6.4 + 18)} x={(x1 + x2) / 2 - 40} y={(y1 + y2) / 2 - 30} /><text fill="#475569" fontSize="10" fontWeight="800" x={(x1 + x2) / 2 - 30} y={(y1 + y2) / 2 - 14}>{connection.label}</text></g> : null}</g>; })}</svg>{connections.map((connection) => { const from = nodeMap.get(connection.from); const to = nodeMap.get(connection.to); if (!from || !to) return null; return <button aria-label="Insert node in connection" className="absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-slate-300 bg-white text-slate-400 opacity-60 shadow-sm transition hover:scale-110 hover:border-indigo-400 hover:text-indigo-600 focus:opacity-100" key={`insert-${connection.id}`} onClick={(event) => { event.stopPropagation(); onInsert(connection.id); }} onPointerDown={(event) => event.stopPropagation()} style={{ left: (from.x + NODE_WIDTH + to.x) / 2, top: (from.y + to.y) / 2 + NODE_HEIGHT / 2 }} type="button"><Plus className="size-3" /></button>; })}</>;
}

function CanvasNode({ connecting, executionStatus, node, onConnect, onKeyboardSelect, onOpenPicker, onPointerDown, selected }: { connecting: boolean; executionStatus: ExecutionNodeStatus; node: WorkflowNode; onConnect: () => void; onKeyboardSelect: () => void; onOpenPicker: () => void; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; selected: boolean }) {
  const colors = colorByKind[node.kind];
  const statusClass = executionStatus === "success" ? "border-emerald-500 ring-4 ring-emerald-100" : executionStatus === "running" ? "border-indigo-500 ring-4 ring-indigo-100" : executionStatus === "failed" ? "border-rose-500 ring-4 ring-rose-100" : selected ? "border-indigo-500 ring-4 ring-indigo-100" : colors.border;
  return <div aria-label={`${node.title} workflow node`} className={`group absolute h-[112px] w-[188px] select-none rounded-2xl border-2 bg-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.55)] transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-18px_rgba(15,23,42,0.5)] ${statusClass} ${connecting ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onKeyboardSelect(); } }} onPointerDown={onPointerDown} role="button" style={{ left: node.x, top: node.y }} tabIndex={0}><div className="flex h-full flex-col p-3"><div className="flex items-start gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${colors.soft} ${colors.icon}`}><NodeIcon kind={node.kind} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black text-slate-950">{node.title}</span><span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-400">{node.subtitle}</span></span><GripVertical className="size-3.5 text-slate-300" /></div><div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 text-[8px] font-black uppercase tracking-[0.1em]"><span className={executionStatus === "running" ? "text-indigo-700" : executionStatus === "success" ? "text-emerald-700" : executionStatus === "failed" ? "text-rose-700" : "text-slate-400"}><span className={`mr-1.5 inline-block size-1.5 rounded-full ${executionStatus === "running" ? "animate-pulse bg-indigo-500" : executionStatus === "success" ? "bg-emerald-500" : executionStatus === "failed" ? "bg-rose-500" : colors.dot}`} />{executionStatus === "idle" ? "Ready" : executionStatus}</span><span className="text-slate-400">{node.kind === "trigger" ? "124 runs/hr" : node.kind === "condition" ? "14ms" : "Configured"}</span></div></div>{node.kind !== "trigger" ? <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-400 shadow-sm" /> : null}<button aria-label={`Connect from ${node.title}`} className={`absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-[3px] border-white shadow-sm hover:scale-125 ${connecting ? "animate-pulse bg-indigo-600" : "bg-slate-500 hover:bg-indigo-500"}`} onClick={(event) => { event.stopPropagation(); onConnect(); }} onPointerDown={(event) => event.stopPropagation()} type="button" /><button aria-label={`Add next node after ${node.title}`} className="absolute -bottom-3 left-1/2 hidden h-6 -translate-x-1/2 items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 text-[8px] font-black text-indigo-700 shadow-sm group-hover:flex" onClick={(event) => { event.stopPropagation(); onOpenPicker(); }} onPointerDown={(event) => event.stopPropagation()} type="button"><Plus className="size-3" />Next</button></div>;
}

function Inspector({ node, onChange, onClose, onDelete, onDuplicate, onRename, onTab, onTest, status, tab }: { node: WorkflowNode; onChange: (key: string, value: ConfigValue) => void; onClose: () => void; onDelete: () => void; onDuplicate: () => void; onRename: (title: string) => void; onTab: (tab: InspectorTab) => void; onTest: () => void; status: ExecutionNodeStatus; tab: InspectorTab }) {
  return <aside className="hidden w-[330px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white xl:flex"><div className="shrink-0"><div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><span className={`grid size-9 place-items-center rounded-xl ${colorByKind[node.kind].soft} ${colorByKind[node.kind].icon}`}><NodeIcon kind={node.kind} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-950">{node.title}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Node ready</p></div><button aria-label="Close inspector" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button"><PanelRightClose className="size-4" /></button></div><div className="flex border-b border-slate-200 px-2">{(["parameters", "settings", "output"] as InspectorTab[]).map((item) => <button aria-selected={tab === item} className={`flex-1 border-b-2 px-1 py-3 text-[10px] font-black capitalize ${tab === item ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-700"}`} key={item} onClick={() => onTab(item)} role="tab" type="button">{item === "parameters" ? "Parameters" : item === "settings" ? "Settings" : "Test & output"}</button>)}</div></div><div className="min-h-0 flex-1 overflow-y-auto p-4">{tab === "parameters" ? <ParametersPanel node={node} onChange={onChange} onRename={onRename} onTest={onTest} /> : null}{tab === "settings" ? <SettingsPanel node={node} onChange={onChange} /> : null}{tab === "output" ? <OutputPanel node={node} onTest={onTest} status={status} /> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button className="workflow-button-secondary justify-center" onClick={onDuplicate} type="button"><Copy className="size-4" />Duplicate</button><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-50" onClick={onDelete} type="button"><Trash2 className="size-4" />Delete</button></div></div></aside>;
}

function ExecutionDrawer({ onOpen, onSelectRun, open, runs }: { onOpen: () => void; onSelectRun: (run: RunRow) => void; open: boolean; runs: RunRow[] }) {
  return <div className="border-t border-slate-200 bg-white"><button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={onOpen} type="button"><span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><History className="size-4" /></span><span><span className="block text-xs font-black text-slate-950">Executions</span><span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />2,418 runs · Listening for events</span></span></span><span className="flex items-center gap-3 text-[10px] font-bold text-slate-400"><span className="hidden sm:inline">⌘S Save · / Add node · Space + drag Pan</span>{open ? <PanelBottomClose className="size-4" /> : <PanelBottomOpen className="size-4" />}</span></button>{open ? <div className="border-t border-slate-200"><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2"><div className="flex items-center gap-2"><button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600" type="button">All statuses <ChevronDown className="ml-1 inline size-3" /></button><button aria-label="Refresh executions" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" type="button"><RefreshCw className="size-3.5" /></button></div><span className="text-[10px] font-bold text-slate-400">Latest production and test executions</span></div><div className="max-h-[270px] overflow-auto"><table className="w-full min-w-[820px] text-left text-[11px]"><thead className="sticky top-0 z-10 bg-white text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Execution</th><th className="px-4 py-2.5">Participant</th><th className="px-4 py-2.5">Progress</th><th className="px-4 py-2.5">Started</th><th className="px-4 py-2.5">Duration</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{runs.map((run) => <tr className="font-semibold text-slate-600 hover:bg-slate-50" key={run.id}><td className="px-4 py-3"><RunStatusBadge status={run.status} /></td><td className="px-4 py-3 font-mono text-[10px] font-black text-slate-800">{run.id}</td><td className="px-4 py-3"><span className="block font-bold text-slate-800">{run.participant}</span><span className="text-[9px] text-slate-400">{run.trigger}</span></td><td className="px-4 py-3">{run.progress}</td><td className="px-4 py-3">{run.started}</td><td className="px-4 py-3">{run.duration}</td><td className="px-4 py-3 text-right"><button className="font-black text-indigo-700 hover:text-indigo-900" onClick={() => onSelectRun(run)} type="button">{run.status === "failed" ? "Debug node" : "View log"}</button></td></tr>)}</tbody></table></div></div> : null}</div>;
}

function SaveIndicator({ state }: { state: SaveState }) { return <span className={`hidden items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-black sm:inline-flex ${state === "unsaved" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{state === "saving" ? <RefreshCw className="size-3 animate-spin" /> : state === "saved" ? <Check className="size-3 text-emerald-600" /> : <span className="size-1.5 rounded-full bg-amber-500" />}{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Unsaved"}</span>; }

function ToolbarButton({ active = false, children, disabled = false, label, onClick }: { active?: boolean; children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) { return <button aria-label={label} className={`grid size-8 place-items-center rounded-lg border text-slate-500 ${active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-transparent hover:bg-slate-100 hover:text-slate-800"} disabled:cursor-not-allowed disabled:opacity-30`} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }} onPointerDown={(event) => event.stopPropagation()} title={label} type="button">{children}</button>; }

function MiniMap({ nodes, pan, selectedIds, zoom }: { nodes: WorkflowNode[]; pan: { x: number; y: number }; selectedIds: string[]; zoom: number }) { return <div className="absolute bottom-3 right-3 z-20 hidden h-28 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:block"><div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-50" style={{ backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundSize: "8px 8px" }}>{nodes.map((node) => <span className={`absolute h-2.5 w-4 rounded-sm ${selectedIds.includes(node.id) ? "bg-indigo-500" : colorByKind[node.kind].dot}`} key={`map-${node.id}`} style={{ left: `${Math.min(92, node.x / CANVAS_WIDTH * 100)}%`, top: `${Math.min(88, node.y / CANVAS_HEIGHT * 100)}%` }} />)}<span className="absolute rounded border border-indigo-400 bg-indigo-100/20" style={{ height: `${Math.min(92, 70 / zoom)}%`, left: `${Math.max(0, -pan.x / CANVAS_WIDTH / zoom * 100)}%`, top: `${Math.max(0, -pan.y / CANVAS_HEIGHT / zoom * 100)}%`, width: `${Math.min(95, 38 / zoom)}%` }} /></div><span className="absolute right-2 top-2 rounded bg-white px-1.5 py-0.5 text-[8px] font-black text-slate-400">MINIMAP</span></div>; }
