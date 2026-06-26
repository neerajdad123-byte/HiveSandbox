"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { VMCreateRequest } from "@/lib/types";

interface CreateVMModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (req: VMCreateRequest) => Promise<void>;
}

const DISTROS = [
  { value: "alpine", label: "Alpine", desc: "Tiny image", tone: "sky" },
  { value: "ubuntu", label: "Ubuntu", desc: "Full image", tone: "orange" },
] as const;

const RAM_PRESETS = [512, 1024, 2048, 4096, 8192];
const CPU_PRESETS = [1, 2, 3, 4];

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z" />
    </svg>
  );
}

function DistroIcon({ tone }: { tone: "sky" | "orange" }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
        tone === "orange" ? "bg-orange-50 text-orange-600" : "bg-sky-50 text-sky-600"
      }`}
      aria-hidden="true"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {tone === "orange" ? (
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

function formatMemory(value: number): string {
  return value >= 1024 ? `${value / 1024} GB` : `${value} MB`;
}

export default function CreateVMModal({ open, onClose, onCreate }: CreateVMModalProps) {
  const [distro, setDistro] = useState<"alpine" | "ubuntu">("alpine");
  const [ramMb, setRamMb] = useState(1024);
  const [cpuCores, setCpuCores] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [creating, onClose, open]);

  const memoryPercent = useMemo(() => ((ramMb - 128) / (8192 - 128)) * 100, [ramMb]);
  const cpuPercent = useMemo(() => ((cpuCores - 1) / 3) * 100, [cpuCores]);

  if (!open) return null;

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await onCreate({ distro, ram_mb: ramMb, cpu_cores: cpuCores });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create sandbox.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-vm-title">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/42 backdrop-blur-[10px]"
        onClick={creating ? undefined : onClose}
        aria-label="Close dialog"
      />

      <div className="animate-sheet-in relative max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/70 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="create-vm-title" className="text-xl font-semibold tracking-tight text-slate-950">
              New Sandbox
            </h2>
            <p className="mt-1 text-sm text-slate-500">Choose an image and resources.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-40"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-500">Distribution</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DISTROS.map((item) => {
                const selected = distro === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDistro(item.value)}
                    className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.99] ${
                      selected
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    aria-pressed={selected}
                  >
                    <DistroIcon tone={item.tone} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                      <span className="block text-xs text-slate-500">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="memory-slider" className="text-xs font-semibold text-slate-500">
                Memory
              </label>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-800">
                {formatMemory(ramMb)}
              </span>
            </div>
            <input
              id="memory-slider"
              type="range"
              min={128}
              max={8192}
              step={128}
              value={ramMb}
              onChange={(event) => setRamMb(Number(event.target.value))}
              className="h-2 w-full appearance-none rounded-full bg-slate-200 accent-blue-600"
              style={{
                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${memoryPercent}%, #e2e8f0 ${memoryPercent}%, #e2e8f0 100%)`,
              }}
            />
            <div className="mt-2 grid grid-cols-5 gap-1">
              {RAM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRamMb(preset)}
                  className={`min-h-9 rounded-full px-2 text-xs font-semibold transition ${
                    ramMb === preset
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {preset >= 1024 ? `${preset / 1024}G` : `${preset}M`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="cpu-slider" className="text-xs font-semibold text-slate-500">
                CPU
              </label>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-800">
                {cpuCores} {cpuCores === 1 ? "core" : "cores"}
              </span>
            </div>
            <input
              id="cpu-slider"
              type="range"
              min={1}
              max={4}
              step={1}
              value={cpuCores}
              onChange={(event) => setCpuCores(Number(event.target.value))}
              className="h-2 w-full appearance-none rounded-full bg-slate-200 accent-blue-600"
              style={{
                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${cpuPercent}%, #e2e8f0 ${cpuPercent}%, #e2e8f0 100%)`,
              }}
            />
            <div className="mt-2 grid grid-cols-4 gap-1">
              {CPU_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCpuCores(preset)}
                  className={`min-h-9 rounded-full px-2 text-xs font-semibold transition ${
                    cpuCores === preset
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="h-12 flex-1 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97] disabled:opacity-55"
          >
            {creating && <SpinnerIcon />}
            {creating ? "Launching" : "Launch Sandbox"}
          </button>
        </div>
      </div>
    </div>
  );
}
