"use client";

import React from "react";
import type { VMInfo } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  vms: VMInfo[];
  selectedId: string | null;
  onSelect: (vmId: string) => void;
  onCreateClick: () => void;
  onStart: (vmId: string) => void;
  onStop: (vmId: string) => void;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DistroIcon: Record<string, string> = {
  alpine: "❄️",
  ubuntu: "🔶",
  unknown: "📦",
};

function statusColor(status: string): string {
  if (status === "running") return "bg-emerald-500";
  if (status === "stopped") return "bg-zinc-500";
  return "bg-amber-500";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
export default function Sidebar({
  vms,
  selectedId,
  onSelect,
  onCreateClick,
  onStart,
  onStop,
  loading,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-[#27272d] bg-[#0c0c10] select-none">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1c1c22]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            HiveSandbox
          </h1>
          <p className="text-[11px] text-zinc-500">Developer Playground</p>
        </div>
      </div>

      {/* ── Create VM button ─────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onCreateClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-black transition-all hover:bg-emerald-400 active:scale-[0.98]"
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
      </div>

      {/* ── Section label ────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          Sandboxes
        </span>
      </div>

      {/* ── VM List ──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && vms.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-zinc-500">
            <svg
              className="animate-spin h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Scanning for sandboxes…
          </div>
        )}

        {!loading && vms.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-600">
            No sandboxes yet. Create one to get started.
          </p>
        )}

        {vms.map((vm) => {
          const isSelected = vm.vm_id === selectedId;
          const running = vm.status === "running";

          return (
            <div
              key={vm.vm_id}
              className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-150 ${
                isSelected
                  ? "bg-[#1a1a22] text-zinc-100 ring-1 ring-white/5"
                  : "text-zinc-400 hover:bg-[#14141a] hover:text-zinc-200"
              }`}
            >
              {/* Clickable main area */}
              <button
                onClick={() => onSelect(vm.vm_id)}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                {/* Status dot */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span
                    className={`absolute inset-0 rounded-full ${statusColor(vm.status)} ${
                      running ? "animate-pulse-glow" : ""
                    }`}
                  />
                </span>

                {/* Distro icon + name */}
                <span className="text-sm leading-none shrink-0">
                  {DistroIcon[vm.distro] ?? DistroIcon.unknown}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {vm.vm_id}
                  </div>
                  <div className="text-[11px] leading-tight text-zinc-600">
                    {vm.distro} · {vm.status}
                  </div>
                </div>

                {/* Selected arrow */}
                {isSelected && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </button>

              {/* Action buttons — visible on hover */}
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {running ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStop(vm.vm_id); }}
                    title="Stop sandbox"
                    className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStart(vm.vm_id); }}
                    title="Start sandbox"
                    className="rounded p-1 text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="7,4 20,12 7,20" />
                    </svg>
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="border-t border-[#1c1c22] px-5 py-3">
        <p className="text-[10px] text-zinc-600">
          Powered by{" "}
          <a
            href="https://github.com/superradcompany/microsandbox"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          >
            microsandbox
          </a>
        </p>
      </div>
    </aside>
  );
}
