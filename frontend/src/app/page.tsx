"use client";

import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import CreateVMModal from "@/components/CreateVMModal";
import Terminal from "@/components/Terminal";
import { listVMs, createVM, startVM, stopVM, terminalWsUrl } from "@/lib/api";
import type { VMCreateRequest, VMInfo } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 4000; // refresh VM list every 4 seconds

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [vms, setVms] = useState<VMInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [msbAvailable, setMsbAvailable] = useState<boolean | null>(null);
  const [backendUp, setBackendUp] = useState(true);

  // ── Health check ───────────────────────────────────────────────────
  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${BASE}/api/health`)
      .then((r) => r.json())
      .then((data) => {
        setMsbAvailable(data.msb_available ?? false);
        setBackendUp(true);
      })
      .catch(() => setBackendUp(false));
  }, []);
  // ── Fetch VM list ────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const list = await listVMs();
      setVms(list);

      // If the selected VM disappeared, deselect it.
      if (selectedId && !list.some((v) => v.vm_id === selectedId)) {
        setSelectedId(null);
      }
    } catch {
      // Backend may be unavailable — keep stale data.
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // Initial fetch + polling
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleCreate = useCallback(async (req: VMCreateRequest) => {
    const created = await createVM(req);
    setSelectedId(created.vm_id);
    await refresh();
  }, [refresh]);

  const handleSelect = useCallback((vmId: string) => {
    setSelectedId(vmId);
  }, []);

  const handleTerminalDisconnect = useCallback(() => {
    // Refresh list so status updates reflect.
    refresh();
  }, [refresh]);

  const handleStart = useCallback(async (vmId: string) => {
    try {
      await startVM(vmId);
      await refresh();
    } catch {
      // Error shown by the polling refresh
    }
  }, [refresh]);

  const handleStop = useCallback(async (vmId: string) => {
    try {
      await stopVM(vmId);
      if (selectedId === vmId) setSelectedId(null);
      await refresh();
    } catch {
      // Error shown by the polling refresh
    }
  }, [refresh, selectedId]);

  // ── Derived state ────────────────────────────────────────────────
  const selectedVM = vms.find((v) => v.vm_id === selectedId) ?? null;
  const terminalUrl = selectedId ? terminalWsUrl(selectedId) : "";

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Sidebar
        vms={vms}
        selectedId={selectedId}
        onSelect={handleSelect}
        onCreateClick={() => setShowCreateModal(true)}
        onStart={handleStart}
        onStop={handleStop}
        loading={loading}
      />

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col min-w-0">

        {/* ── Backend down banner ────────────────────────────────── */}
        {!backendUp && (
          <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/5 px-5 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <div>
              <p className="text-[13px] font-medium text-red-400">Backend unreachable</p>
              <p className="text-[11px] text-red-400/70">
                Make sure the API server is running on {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}.
              </p>
            </div>
          </div>
        )}

        {/* ── MSB missing banner ─────────────────────────────────── */}
        {backendUp && msbAvailable === false && (
          <div className="flex items-start gap-3 border-b border-amber-500/20 bg-amber-500/5 px-5 py-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-amber-400">
                microsandbox CLI not found
              </p>
              <p className="mt-0.5 text-[12px] text-amber-400/70">
                The VM engine is missing. Install it to create and manage sandboxes:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="select-all rounded-md bg-amber-500/10 px-3 py-1.5 text-[12px] font-mono text-amber-300">
                  curl -fsSL https://install.microsandbox.dev | sh
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "curl -fsSL https://install.microsandbox.dev | sh"
                    );
                  }}
                  className="rounded-md bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/25"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-[11px] text-amber-400/50">
                After installing, restart the backend and refresh this page.
              </p>
            </div>
          </div>
        )}
        {selectedVM ? (
          /* ── Terminal view ──────────────────────────────────── */
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex items-center gap-2 border-b border-[#1c1c22] bg-[#0c0c10] px-4 py-2">
              <span className="flex h-2 w-2 shrink-0">
                <span className={`absolute h-2 w-2 rounded-full ${
                  selectedVM.status === "running" ? "bg-emerald-500 animate-pulse-glow" : "bg-amber-500"
                }`} />
              </span>
              <span className="text-[12px] font-medium text-zinc-300">
                {selectedVM.vm_id}
              </span>
              <span className="text-[11px] text-zinc-600">
                {selectedVM.distro} · {selectedVM.status}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-zinc-700">
                  {selectedVM.cpu_cores > 0 ? `${selectedVM.cpu_cores} vCPU` : ""}
                  {selectedVM.cpu_cores > 0 && selectedVM.ram_mb > 0 ? " · " : ""}
                  {selectedVM.ram_mb > 0
                    ? selectedVM.ram_mb >= 1024
                      ? `${selectedVM.ram_mb / 1024} GB`
                      : `${selectedVM.ram_mb} MB`
                    : ""}
                </span>
                {selectedVM.status === "running" && (
                  <button
                    onClick={() => handleStop(selectedVM.vm_id)}
                    title="Stop sandbox"
                    className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  </button>
                )}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <Terminal
                key={selectedVM.vm_id}
                wsUrl={terminalUrl}
                vmId={selectedVM.vm_id}
                onDisconnect={handleTerminalDisconnect}
              />
            </div>
          </div>
        ) : (
          /* ── Empty state ─────────────────────────────────────── */
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
              {/* Logo */}
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/10">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-200">
                  HiveSandbox
                </h2>
                <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-zinc-500">
                  Spin up isolated microVMs for development, testing, and
                  experimentation. Click{" "}
                  <span className="font-medium text-emerald-400">
                    New Sandbox
                  </span>{" "}
                  to get started.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-emerald-400 active:scale-[0.98]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Sandbox
              </button>

              {/* Quick shortcuts */}
              <div className="flex gap-4 pt-2">
                {[
                  { label: "Alpine", key: "❄️", desc: "~5 MB" },
                  { label: "Ubuntu", key: "🔶", desc: "~77 MB" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1 rounded-xl border border-[#1c1c22] bg-[#0c0c10] px-5 py-3"
                  >
                    <span className="text-sm">{item.key}</span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Create VM Modal ────────────────────────────────────────── */}
      <CreateVMModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
