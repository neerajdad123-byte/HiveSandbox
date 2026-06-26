"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Terminal, Cpu, HardDrive, Activity, Play, Square, Trash2, Plus,
  Server, Globe, Shield, MoreVertical, ArrowUpRight, Command, Zap, LayoutGrid, List,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createVM, getVM, listVMs, startVM, stopVM, terminalWsUrl } from "@/lib/api";
import TerminalComponent from "@/components/Terminal";
import type { VMCreateRequest, VMInfo } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function formatMemory(value: number): string {
  if (!value) return "—";
  return value >= 1024 ? `${value / 1024} GB` : `${value} MB`;
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 4000;

const DISTROS = [
  { value: "alpine", label: "Alpine", desc: "Tiny image", tone: "sky" },
  { value: "ubuntu", label: "Ubuntu", desc: "Full image", tone: "orange" },
] as const;

/* ------------------------------------------------------------------ */
/* Components                                                           */
/* ------------------------------------------------------------------ */

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-cyan-500/20 opacity-20 blur-[100px]" />
      <div className="absolute right-0 bottom-0 -z-10 h-[400px] w-[400px] rounded-full bg-indigo-500/10 opacity-20 blur-[120px]" />
    </div>
  );
}

function ProgressBar({ value, color = "bg-cyan-500" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, delay }: {
  title: string; value: string | number; icon: React.ElementType; trend?: number; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0, duration: 0.5 }}
      className="relative group overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-md p-6 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-gray-800/50 text-gray-400 group-hover:text-cyan-400 transition-colors">
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={cn("text-xs font-medium px-2 py-1 rounded-full", trend > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      </div>
      <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

function TerminalLine({ text, type = "info" }: { text: string; type?: "info" | "success" | "error" | "command" }) {
  const colors: Record<string, string> = {
    info: "text-gray-300",
    success: "text-emerald-400",
    error: "text-rose-400",
    command: "text-cyan-400",
  };
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="font-mono text-xs flex gap-2 py-0.5">
      <span className="text-gray-600 select-none">[{new Date().toLocaleTimeString()}]</span>
      <span className={colors[type] ?? colors.info}>{text}</span>
    </motion.div>
  );
}

function VMCard({ vm, onToggle, onDelete, onSelect }: {
  vm: VMInfo & { cpu_pct?: number; ram_pct?: number };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isRunning = vm.status === "running";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "group relative flex flex-col gap-4 rounded-xl border p-5 transition-all duration-300",
        isRunning
          ? "bg-gray-900/80 border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]"
          : "bg-gray-900/40 border-gray-800 hover:border-gray-700"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3" onClick={() => onSelect(vm.vm_id)} style={{ cursor: "pointer" }}>
          <div className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg border",
            isRunning ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : "bg-gray-800 border-gray-700 text-gray-500"
          )}>
            <Server size={20} />
            {isRunning && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-tight">{vm.vm_id}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={cn("w-1.5 h-1.5 rounded-full", isRunning ? "bg-emerald-500" : "bg-gray-600")} />
              {vm.distro} · {vm.status}
            </div>
          </div>
        </div>
        <button className="text-gray-600 hover:text-white transition-colors">
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>CPU</span>
            <span className="text-white">{isRunning ? (vm.cpu_pct ?? 12) : 0}%</span>
          </div>
          <ProgressBar value={isRunning ? (vm.cpu_pct ?? 12) : 0} color={isRunning ? "bg-cyan-500" : "bg-gray-700"} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>RAM</span>
            <span className="text-white">{isRunning ? (vm.ram_pct ?? 18) : 0}%</span>
          </div>
          <ProgressBar value={isRunning ? (vm.ram_pct ?? 18) : 0} color={isRunning ? "bg-indigo-500" : "bg-gray-700"} />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
        <button
          onClick={() => onToggle(vm.vm_id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all",
            isRunning
              ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
          )}
        >
          {isRunning ? <Square size={14} /> : <Play size={14} />}
          {isRunning ? "Stop" : "Start"}
        </button>
        <button
          onClick={() => onDelete(vm.vm_id)}
          className="flex items-center justify-center rounded-lg p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function CreateModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (req: VMCreateRequest) => Promise<void>;
}) {
  const [distro, setDistro] = useState<"alpine" | "ubuntu">("alpine");
  const [ramMb, setRamMb] = useState(512);
  const [cpuCores, setCpuCores] = useState(1);
  const [creating, setCreating] = useState(false);
  if (!open) return null;

  const submit = async () => {
    setCreating(true);
    try { await onCreate({ distro, ram_mb: ramMb, cpu_cores: cpuCores }); onClose(); }
    catch { /* error shown in UI */ }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-5">New Sandbox</h2>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Distro</label>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {DISTROS.map((d) => (
            <button key={d.value} onClick={() => setDistro(d.value)}
              className={cn("flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-all",
                distro === d.value ? "border-cyan-500/30 bg-cyan-500/5" : "border-gray-800 bg-gray-900/40 hover:border-gray-700")}>
              <span className="text-lg">{d.tone === "orange" ? "🔶" : "❄️"}</span>
              <span className="text-[13px] font-medium text-gray-200">{d.label}</span>
              <span className="text-[10px] text-gray-600">{d.desc}</span>
            </button>
          ))}
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Memory — {ramMb >= 1024 ? `${ramMb / 1024} GB` : `${ramMb} MB`}
        </label>
        <input type="range" min={128} max={8192} step={128} value={ramMb} onChange={(e) => setRamMb(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-800 accent-cyan-500 cursor-pointer mb-5" />

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          CPU — {cpuCores} {cpuCores === 1 ? "core" : "cores"}
        </label>
        <input type="range" min={1} max={4} step={1} value={cpuCores} onChange={(e) => setCpuCores(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-800 accent-cyan-500 cursor-pointer mb-6" />

        <div className="flex gap-3">
          <button onClick={onClose} disabled={creating}
            className="flex-1 rounded-lg border border-gray-800 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 disabled:opacity-40">Cancel</button>
          <button onClick={submit} disabled={creating}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">
            {creating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Zap size={14} /></motion.div> : <Plus size={14} />}
            {creating ? "Booting…" : "Launch"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Dashboard                                                       */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [vms, setVms] = useState<VMInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msbAvailable, setMsbAvailable] = useState<boolean | null>(null);
  const [backendUp, setBackendUp] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [logs, setLogs] = useState<string[]>([
    "System initialized...",
    "Connected to microsandbox engine.",
    "Monitoring active sandboxes.",
  ]);
  const [showTerminal, setShowTerminal] = useState(false);

  const addLog = useCallback((msg: string, type = "info") => {
    setLogs((prev) => [JSON.stringify({ msg, type, t: Date.now() }), ...prev].slice(0, 30));
  }, []);

  // Health check
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/health`)
      .then((r) => r.json())
      .then((d) => { setMsbAvailable(d.msb_available ?? false); setBackendUp(true); addLog("Backend connected", "success"); })
      .catch(() => { setBackendUp(false); addLog("Backend unreachable", "error"); });
  }, [addLog]);

  // Poll VMs
  const refresh = useCallback(async () => {
    try {
      const list = await listVMs();
      setVms(list);
      if (selectedId && !list.some((v) => v.vm_id === selectedId)) setSelectedId(null);
    } catch { setBackendUp(false); }
    finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { refresh(); const t = setInterval(refresh, POLL_INTERVAL_MS); return () => clearInterval(t); }, [refresh]);

  // Fetch details on select
  useEffect(() => {
    if (!selectedId) return;
    let c = false;
    getVM(selectedId).then((d) => { if (!c) setVms((p) => p.map((v) => v.vm_id === selectedId ? { ...v, ...d } : v)); }).catch(() => {});
    return () => { c = true; };
  }, [selectedId]);

  // Handlers
  const handleCreate = useCallback(async (req: VMCreateRequest) => {
    const created = await createVM(req);
    setSelectedId(created.vm_id);
    addLog(`Sandbox ${created.vm_id} provisioning…`, "command");
    await refresh();
    addLog(`Sandbox ${created.vm_id} ready`, "success");
  }, [refresh, addLog]);

  const handleToggle = useCallback(async (vmId: string) => {
    const vm = vms.find((v) => v.vm_id === vmId);
    if (!vm) return;
    try {
      if (vm.status === "running") { await stopVM(vmId); addLog(`Stopped ${vmId}`, "error"); }
      else { await startVM(vmId); addLog(`Started ${vmId}`, "success"); }
    } catch { addLog(`Action failed for ${vmId}`, "error"); }
    await refresh();
  }, [vms, refresh, addLog]);

  const handleDelete = useCallback(async (vmId: string) => {
    try { await stopVM(vmId); if (selectedId === vmId) setSelectedId(null); addLog(`Removed ${vmId}`, "error"); }
    catch { /* ok */ }
    await refresh();
  }, [refresh, selectedId, addLog]);

  const selectedVM = vms.find((v) => v.vm_id === selectedId) ?? null;
  const terminalUrl = selectedId ? terminalWsUrl(selectedId) : "";
  const runningCount = vms.filter((v) => v.status === "running").length;
  const totalCpu = vms.reduce((s, v) => s + (v.cpu_cores || 0), 0);
  const totalRam = vms.reduce((s, v) => s + (v.ram_mb || 0), 0);

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      <BackgroundGrid />

      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#030712]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Zap className="text-white" size={18} fill="currentColor" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                HIVE<span className="text-cyan-500">SANDBOX</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-400">
                <span className={cn("w-2 h-2 rounded-full", backendUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                {backendUp ? "System Operational" : "Backend Offline"}
              </div>
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Command size={20} />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                HS
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Install banner */}
      {backendUp && msbAvailable === false && (
        <div className="sticky top-16 z-40 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-3">
          <Shield size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs text-amber-400">
            microsandbox CLI not found. Run{" "}
            <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">curl -fsSL https://install.microsandbox.dev | sh</code>
          </span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Sandbox Cluster</h1>
            <p className="text-gray-400 mt-1">Manage your isolated microVM environments.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
              <button onClick={() => setViewMode("grid")}
                className={cn("p-2 rounded-md transition-all", viewMode === "grid" ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}>
                <LayoutGrid size={18} />
              </button>
              <button onClick={() => setViewMode("list")}
                className={cn("p-2 rounded-md transition-all", viewMode === "list" ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}>
                <List size={18} />
              </button>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
              <Plus size={18} />
              <span>New Sandbox</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Sandboxes" value={vms.length} icon={Server} trend={vms.length > 0 ? 100 : 0} delay={0} />
          <StatCard title="Active Nodes" value={runningCount} icon={Activity} trend={runningCount > 0 ? 100 : 0} delay={0.1} />
          <StatCard title="Cluster vCPUs" value={totalCpu} icon={Cpu} delay={0.2} />
          <StatCard title="Memory Pool" value={totalRam >= 1024 ? `${(totalRam / 1024).toFixed(1)} GB` : `${totalRam} MB`} icon={HardDrive} delay={0.3} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main VM List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe size={18} className="text-cyan-500" />
                Instances
              </h2>
              <span className="text-xs text-gray-500 font-mono">{vms.length} sandboxes found</span>
            </div>

            {/* Skeleton loading */}
            {loading && vms.length === 0 && (
              <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-3 animate-pulse">
                    <div className="h-4 w-32 bg-gray-800 rounded" />
                    <div className="h-3 w-24 bg-gray-800 rounded" />
                    <div className="h-1.5 w-full bg-gray-800 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-gray-800 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            <LayoutGroup>
              <motion.div layout className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                <AnimatePresence mode="popLayout">
                  {vms.map((vm) => (
                    <VMCard key={vm.vm_id} vm={vm} onToggle={handleToggle} onDelete={handleDelete} onSelect={(id) => { setSelectedId(id); setShowTerminal(true); }} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>

            {!loading && vms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Server size={32} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-medium">No sandboxes found</p>
                <p className="text-gray-600 text-sm mt-1">Create a new sandbox to get started</p>
              </div>
            )}
          </div>

          {/* Terminal / Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Log Terminal */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
              className="rounded-xl border border-gray-800 bg-[#0B0F19] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
                  <Terminal size={12} />
                  hive@localhost:~
                </div>
              </div>
              <div className="p-4 h-[400px] overflow-y-auto font-mono text-sm space-y-1">
                <div className="text-gray-500 mb-4 whitespace-pre select-none text-[10px] leading-tight">
                  {`
 _   _ _             ____                  _       
| | | (_)_   _____  / ___|  __ _ _ __   __| | _____ 
| |_| | \\ \ / / _ \\ \\___ \\ / _\` | '_ \\ / _\` |/ _ \\
|  _  | |\\ V /  __/  ___) | (_| | | | | (_| |  __/
|_| |_|_| \\_/ \\___| |____/ \\__,_|_| |_|\\__,_|\\___|
                  `}
                </div>
                <AnimatePresence initial={false}>
                  {logs.map((log, i) => {
                    let displayText = log;
                    let type = "info";
                    try { const parsed = JSON.parse(log); displayText = parsed.msg; type = parsed.type; } catch { /* plain text */ }
                    return <TerminalLine key={i} text={displayText} type={type as never} />;
                  })}
                </AnimatePresence>
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-4 bg-cyan-500 mt-1" />
              </div>
            </motion.div>

            {/* System Status */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">System Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Engine</span>
                  <span className={cn("font-mono", msbAvailable ? "text-emerald-400" : "text-rose-400")}>
                    {msbAvailable ? "Connected" : "Not Found"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">KVM Access</span>
                  <span className="text-cyan-400 font-mono">—</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Sandboxes</span>
                  <span className="text-emerald-400 font-mono">{runningCount} running</span>
                </div>
              </div>
              {selectedVM && (
                <div className="pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Active terminal: {selectedVM.vm_id}</span>
                    <button onClick={() => setShowTerminal(!showTerminal)} className="text-cyan-400 hover:text-cyan-300">
                      {showTerminal ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showTerminal && (
                    <div className="h-48 rounded-lg overflow-hidden border border-gray-800">
                      <TerminalComponent key={selectedVM.vm_id} wsUrl={terminalUrl} vmId={selectedVM.vm_id} onDisconnect={refresh} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  );
}
