"use client";

import React from "react";
import type { VMInfo } from "@/lib/types";

interface SidebarProps {
  vms: VMInfo[];
  selectedId: string | null;
  onSelect: (vmId: string) => void;
  onCreateClick: () => void;
  onStart: (vmId: string) => void;
  onStop: (vmId: string) => void;
  loading: boolean;
}

function MonitorIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.7v12.6c0 .8.9 1.3 1.6.8l9.4-6.3c.6-.4.6-1.3 0-1.7L9.6 4.9C8.9 4.4 8 4.9 8 5.7Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DistroMark({ distro }: { distro: string }) {
  const isUbuntu = distro.toLowerCase() === "ubuntu";

  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
        isUbuntu
          ? "border-orange-200 bg-orange-50 text-orange-600"
          : "border-sky-200 bg-sky-50 text-sky-600"
      }`}
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {isUbuntu ? (
          <>
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="12" cy="3.8" r="1.8" fill="currentColor" />
            <circle cx="19.1" cy="16.1" r="1.8" fill="currentColor" />
            <circle cx="4.9" cy="16.1" r="1.8" fill="currentColor" />
          </>
        ) : (
          <>
            <path d="M12 3.5 20 18H4L12 3.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M8.7 18 12 12.2 15.3 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  );
}

function statusTone(status: string): string {
  if (status === "running") return "bg-[var(--success)]";
  if (status === "stopped") return "bg-slate-400";
  return "bg-[var(--warning)]";
}

function SkeletonItem() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
      <div className="skeleton-shimmer absolute inset-0 after:absolute after:inset-y-0 after:w-1/2 after:bg-gradient-to-r after:from-transparent after:via-white/80 after:to-transparent" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full bg-slate-100" />
          <div className="h-2.5 w-20 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  vms,
  selectedId,
  onSelect,
  onCreateClick,
  onStart,
  onStop,
  loading,
}: SidebarProps) {
  const runningCount = vms.filter((vm) => vm.status === "running").length;

  return (
    <aside className="glass-surface flex h-auto max-h-[42dvh] w-full shrink-0 flex-col border-b shadow-[var(--shadow-subtle)] md:h-full md:max-h-none md:w-80 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-4 py-4 md:px-5 md:py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <MonitorIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-slate-950">HiveSandbox</h1>
          <p className="text-xs text-slate-500">{runningCount} running</p>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-700 active:scale-[0.97]"
          aria-label="Create sandbox"
          title="Create sandbox"
        >
          <PlusIcon />
          <span className="hidden sm:inline md:hidden lg:inline">New</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 md:px-5">
        <span className="text-xs font-semibold text-slate-500">Sandboxes</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {vms.length}
        </span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 md:px-4" aria-label="Sandboxes">
        {loading && vms.length === 0 && (
          <div className="space-y-2">
            <SkeletonItem />
            <SkeletonItem />
          </div>
        )}

        {!loading && vms.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/72 px-4 py-5 text-sm text-slate-500">
            No sandboxes yet.
          </div>
        )}

        <div className="space-y-2">
          {vms.map((vm) => {
            const isSelected = vm.vm_id === selectedId;
            const running = vm.status === "running";

            return (
              <div
                key={vm.vm_id}
                className={`group rounded-2xl border p-1 transition duration-200 ${
                  isSelected
                    ? "border-blue-200 bg-blue-50/80 shadow-sm"
                    : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(vm.vm_id)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition duration-200 active:scale-[0.99]"
                    aria-current={isSelected ? "page" : undefined}
                  >
                    <DistroMark distro={vm.distro} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{vm.vm_id}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className={`h-2 w-2 rounded-full ${statusTone(vm.status)} ${running ? "animate-pulse-ring" : ""}`} />
                        <span className="truncate">{vm.distro} / {vm.status}</span>
                      </span>
                    </span>
                    {isSelected && <span className="text-blue-600"><ChevronIcon /></span>}
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (running) {
                        onStop(vm.vm_id);
                      } else {
                        onStart(vm.vm_id);
                      }
                    }}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
                      running
                        ? "text-red-600 hover:bg-red-50"
                        : "text-green-700 hover:bg-green-50"
                    }`}
                    aria-label={running ? `Stop ${vm.vm_id}` : `Start ${vm.vm_id}`}
                    title={running ? "Stop sandbox" : "Start sandbox"}
                  >
                    {running ? <StopIcon /> : <PlayIcon />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="hidden border-t border-slate-200 px-5 py-4 md:block">
        <a
          href="https://github.com/superradcompany/microsandbox"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-500 transition hover:text-blue-700"
        >
          microsandbox engine
        </a>
      </div>
    </aside>
  );
}
