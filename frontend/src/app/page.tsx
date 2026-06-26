"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Cpu, HardDrive, Activity, Play, Square, Trash2, Plus,
  Terminal, Zap, Globe, Shield, LayoutGrid, List,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createVM, getVM, listVMs, startVM, stopVM, terminalWsUrl } from "@/lib/api";
import TerminalComponent from "@/components/Terminal";
import type { VMCreateRequest, VMInfo } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatMemory(value: number): string {
  if (!value) return "—";
  return value >= 1024 ? `${value / 1024} GB` : `${value} MB`;
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 4000;

const DISTROS = [
  { value: "alpine", label: "Alpine", desc: "Tiny · ~5 MB", icon: "❄️" },
  { value: "ubuntu", label: "Ubuntu", desc: "Full · ~77 MB", icon: "🔶" },
] as const;

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function ProgressBar({ value, color = "bg-cyan-500" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color = "cyan" }: {
  title: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-5 hover:border-white/[0.10] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-cyan-400 transition-colors">
          <Icon size={18} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-white tracking-tight mt-1">{value}</p>
      </div>
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

function VMCard({ vm, onToggle, onDelete, onSelect }: {
  vm: VMInfo & { cpu_pct?: number; ram_pct?: number };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const running = vm.status === "running";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onSelect(vm.vm_id)}
      className={cn(
        "group relative flex flex-col gap-4 rounded-xl border p-5 transition-all duration-300 cursor-pointer",
        running
          ? "bg-white/[0.04] border-cyan-500/20 shadow-[0_0_20px_-5px_rgba(6,182,212,0.08)] hover:border-cyan-500/30"
          : "bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg border",
            running ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : "bg-white/[0.03] border-white/[0.06] text-zinc-500"
          )}>
            <Server size={20} />
            {running && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white tracking-tight truncate">{vm.vm_id}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", running ? "bg-emerald-400" : "bg-zinc-600")} />
              {vm.distro} · {vm.status}
            </div>
          </div>
        </div>
      </div>

      {/* Resource bars */}
      <div className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5"><Cpu size={12} /> CPU</span>
            <span className="text-zinc-300">{vm.cpu_cores > 0 ? `${vm.cpu_cores} vCPU` : "—"}</span>
          </div>
          <ProgressBar value={vm.cpu_pct ?? 0} color="bg-cyan-500" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5"><HardDrive size={12} /> RAM</span>
            <span className="text-zinc-300">{vm.ram_mb > 0 ? formatMemory(vm.ram_mb) : "—"}</span>
          </div>
          <ProgressBar value={vm.ram_pct ?? 0} color="bg-violet-500" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/[0.05]">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(vm.vm_id); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all",
            running
              ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
          )}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
          {running ? "Stop" : "Start"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(vm.vm_id); }}
          className="flex items-center justify-center rounded-lg p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <Trash2 size={15} />
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0a0a0f] p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white mb-5">New Sandbox</h2>

        {/* Distro */}
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Distro</label>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {DISTROS.map((d) => (
            <button key={d.value} onClick={() => setDistro(d.value)}
              className={cn("flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-all",
                distro === d.value ? "border-cyan-500/30 bg-cyan-500/5" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]")}>
              <span className="text-lg">{d.icon}</span>
              <span className="text-[13px] font-medium text-zinc-200">{d.label}</span>
              <span className="text-[10px] text-zinc-600">{d.desc}</span>
            </button>
          ))}
        </div>

        {/* RAM */}
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          Memory — {ramMb >= 1024 ? `${ramMb / 1024} GB` : `${ramMb} MB`}
        </label>
        <input type="range" min={128} max={8192} step={128} value={ramMb}
          onChange={(e) => setRamMb(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06] accent-cyan-500 cursor-pointer mb-5" />

        {/* CPU */}
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          CPU — {cpuCores} {cpuCores === 1 ? "core" : "cores"}
        </label>
        <input type="range" min={1} max={4} step={1} value={cpuCores}
          onChange={(e) => setCpuCores(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06] accent-cyan-500 cursor-pointer mb-6" />

        <div className="flex gap-3">
          <button onClick={onClose} disabled={creating}
            className="flex-1 rounded-lg border border-white/[0.08] py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-40">Cancel</button>
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

  // Health check
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/health`)
      .then((r) => r.json()).then((d) => { setMsbAvailable(d.msb_available ?? false); setBackendUp(true); })
      .catch(() => setBackendUp(false));
  }, []);

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
    await refresh();
  }, [refresh]);

  const handleToggle = useCallback(async (vmId: string) => {
    const vm = vms.find((v) => v.vm_id === vmId);
    if (!vm) return;
    try {
      if (vm.status === "running") await stopVM(vmId);
      else await startVM(vmId);
    } catch { /* ok */ }
    await refresh();
  }, [vms, refresh]);

  const handleDelete = useCallback(async (vmId: string) => {
    try {
      await stopVM(vmId);
      if (selectedId === vmId) setSelectedId(null);
    } catch { /* ok */ }
    await refresh();
  }, [refresh, selectedId]);

  const selectedVM = vms.find((v) => v.vm_id === selectedId) ?? null;
  const terminalUrl = selectedId ? terminalWsUrl(selectedId) : "";
  const runningCount = vms.filter((v) => v.status === "running").length;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#030712] text-zinc-100 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#030712]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-cyan-500/10 opacity-30 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-[300px] w-[400px] rounded-full bg-violet-500/8 opacity-20 blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between h-14 px-5 border-b border-white/[0.04] bg-[#030712]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-md flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="text-white" size={14} fill="currentColor" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">Hive<span className="text-cyan-500">Sandbox</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {backendUp ? "Connected" : "Offline"}
          </span>
          <div className="flex bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded transition-all", viewMode === "grid" ? "bg-white/[0.06]" : "text-zinc-600 hover:text-zinc-400")}><LayoutGrid size={15} /></button>
            <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded transition-all", viewMode === "list" ? "bg-white/[0.06]" : "text-zinc-600 hover:text-zinc-400")}><List size={15} /></button>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95">
            <Plus size={14} /> New
          </button>
        </div>
      </nav>

      {/* Install banner */}
      {backendUp && msbAvailable === false && (
        <div className="relative z-20 border-b border-amber-500/20 bg-amber-500/5 px-5 py-2.5 flex items-center gap-3">
          <Shield size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs text-amber-400">microsandbox CLI not found. Run <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">curl -fsSL https://install.microsandbox.dev | sh</code></span>
        </div>
      )}

      {/* Main */}
      <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
        {/* Left: VM grid + stats */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Sandboxes" value={vms.length} icon={Server} />
            <StatCard title="Running" value={runningCount} icon={Activity} />
            <StatCard title="vCPUs" value={vms.reduce((s, v) => s + (v.cpu_cores || 0), 0)} icon={Cpu} />
            <StatCard title="Memory" value={(() => { const m = vms.reduce((s, v) => s + (v.ram_mb || 0), 0); return m >= 1024 ? `${(m / 1024).toFixed(1)} GB` : `${m} MB`; })()} icon={HardDrive} />
          </div>

          {/* VM Grid */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Globe size={14} className="text-cyan-500" /> Instances
              <span className="text-zinc-700 font-normal text-[11px]">{vms.length} total</span>
            </h2>

            {loading && vms.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5 space-y-3 animate-pulse">
                    <div className="h-4 w-32 bg-white/[0.04] rounded" />
                    <div className="h-3 w-24 bg-white/[0.03] rounded" />
                    <div className="h-1.5 w-full bg-white/[0.03] rounded-full" />
                    <div className="h-1.5 w-3/4 bg-white/[0.03] rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {!loading && vms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.06] rounded-xl">
                <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                  <Server size={28} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm font-medium">No sandboxes yet</p>
                <p className="text-zinc-700 text-xs mt-1">Create one to get started</p>
                <button onClick={() => setShowCreate(true)} className="mt-4 flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cyan-500/20 transition-colors">
                  <Plus size={13} /> New Sandbox
                </button>
              </div>
            )}

            <motion.div layout className={cn("grid gap-3", viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
              <AnimatePresence mode="popLayout">
                {vms.map((vm) => (
                  <VMCard key={vm.vm_id} vm={vm} onToggle={handleToggle} onDelete={handleDelete} onSelect={setSelectedId} />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* Right: Terminal panel */}
        <div className="hidden lg:flex w-[420px] shrink-0 flex-col border-l border-white/[0.04]">
          {selectedVM ? (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[11px] font-mono text-zinc-500">{selectedVM.vm_id}@{selectedVM.distro}</span>
                <span className="ml-auto text-[10px] text-zinc-700">
                  {selectedVM.cpu_cores > 0 ? `${selectedVM.cpu_cores} vCPU` : ""}
                  {selectedVM.cpu_cores > 0 && selectedVM.ram_mb > 0 ? " · " : ""}
                  {selectedVM.ram_mb > 0 ? formatMemory(selectedVM.ram_mb) : ""}
                </span>
              </div>
              <div className="flex-1 min-h-0 bg-[#0b0f17]">
                <TerminalComponent
                  key={selectedVM.vm_id}
                  wsUrl={terminalUrl}
                  vmId={selectedVM.vm_id}
                  onDisconnect={refresh}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                <Terminal size={22} className="text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500 font-medium">Select a sandbox</p>
              <p className="text-xs text-zinc-700 mt-1">Click any VM card to open its terminal</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  );
}
