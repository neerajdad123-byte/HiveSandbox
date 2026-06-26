/**
 * HiveSandbox API client.
 *
 * All calls target the FastAPI backend.  The base URL is read from
 * NEXT_PUBLIC_API_URL (defaults to http://localhost:8000).
 */

import type { VMCreateRequest, VMCreateResponse, VMInfo } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch the list of known VMs. */
export async function listVMs(): Promise<VMInfo[]> {
  return request<VMInfo[]>("/api/vms");
}

/** Create and boot a new microVM. */
export async function createVM(
  payload: VMCreateRequest,
): Promise<VMCreateResponse> {
  return request<VMCreateResponse>("/api/vms/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Get detailed info for a single VM (includes cpu/ram). */
export async function getVM(vmId: string): Promise<VMInfo> {
  return request<VMInfo>(`/api/vms/${vmId}`);
}

/** Stop (and remove) a VM by id. */
export async function stopVM(vmId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/vms/${vmId}/stop`, {
    method: "POST",
  });
}

/** Start a stopped VM. */
export async function startVM(vmId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/vms/${vmId}/start`, {
    method: "POST",
  });
}

/** Build the WebSocket URL for a VM terminal. */
export function terminalWsUrl(vmId: string): string {
  const wsBase = BASE.replace(/^http/, "ws");
  return `${wsBase}/api/vms/${vmId}/terminal`;
}
