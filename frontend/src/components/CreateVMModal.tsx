"use client";

import React, { useState } from "react";
import type { VMCreateRequest } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface CreateVMModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (req: VMCreateRequest) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DISTROS = [
  { value: "alpine", label: "Alpine Linux", desc: "Tiny, security-oriented · ~5 MB", icon: "❄️" },
  { value: "ubuntu", label: "Ubuntu", desc: "Full-featured · ~77 MB", icon: "🔶" },
] as const;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CreateVMModal({ open, onClose, onCreate }: CreateVMModalProps) {
  const [distro, setDistro] = useState<"alpine" | "ubuntu">("alpine");
  const [ramMb, setRamMb] = useState(512);
  const [cpuCores, setCpuCores] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await onCreate({ distro, ram_mb: ramMb, cpu_cores: cpuCores });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create sandbox");
    } finally {
      setCreating(false);
    }
  };

  const ramPresets = [512, 1024, 2048, 4096, 8192];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={creating ? undefined : onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md animate-fade-in rounded-2xl border border-[#27272d] bg-[#121215] p-6 shadow-2xl shadow-black/40">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            New Sandbox
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            Configure your isolated microVM environment.
          </p>
        </div>

        {/* ── Distro Selector ─────────────────────────────────── */}
        <div className="mb-5">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            Distribution
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DISTROS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDistro(d.value)}
                className={`flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-all ${
                  distro === d.value
                    ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                    : "border-[#27272d] bg-[#0c0c10] hover:border-zinc-600"
                }`}
              >
                <span className="text-base">{d.icon}</span>
                <span className="text-[13px] font-medium text-zinc-200">
                  {d.label}
                </span>
                <span className="text-[10px] leading-tight text-zinc-600">
                  {d.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── RAM Slider ──────────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              Memory
            </label>
            <span className="text-[13px] tabular-nums text-zinc-300">
              {ramMb >= 1024 ? `${ramMb / 1024} GB` : `${ramMb} MB`}
            </span>
          </div>
          <input
            type="range"
            min={128}
            max={8192}
            step={128}
            value={ramMb}
            onChange={(e) => setRamMb(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-[#27272d] accent-emerald-500 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((ramMb - 128) / (8192 - 128)) * 100}%, #27272d ${((ramMb - 128) / (8192 - 128)) * 100}%, #27272d 100%)`,
            }}
          />
          <div className="mt-1.5 flex justify-between">
            {ramPresets.map((p) => (
              <button
                key={p}
                onClick={() => setRamMb(p)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  ramMb === p
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {p >= 1024 ? `${p / 1024}G` : `${p}M`}
              </button>
            ))}
          </div>
        </div>

        {/* ── CPU Slider ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              CPU Cores
            </label>
            <span className="text-[13px] tabular-nums text-zinc-300">
              {cpuCores} {cpuCores === 1 ? "core" : "cores"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={cpuCores}
            onChange={(e) => setCpuCores(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-[#27272d] accent-emerald-500 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((cpuCores - 1) / 3) * 100}%, #27272d ${((cpuCores - 1) / 3) * 100}%, #27272d 100%)`,
            }}
          />
          <div className="mt-1.5 flex justify-between">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCpuCores(n)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  cpuCores === n
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 rounded-lg border border-[#27272d] px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-[#1a1a22] hover:text-zinc-200 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-[13px] font-medium text-black transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
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
                Booting…
              </>
            ) : (
              "Launch Sandbox"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
