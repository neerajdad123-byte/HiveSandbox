/** A running (or stopped) microVM known to the backend. */
export interface VMInfo {
  vm_id: string;
  distro: string;
  status: string; // "running" | "stopped" | …
  ram_mb: number;
  cpu_cores: number;
  created_at: string | null;
}

/** Payload for POST /api/vms/create */
export interface VMCreateRequest {
  distro: "alpine" | "ubuntu";
  ram_mb: number;
  cpu_cores: number;
}

/** Response from POST /api/vms/create */
export interface VMCreateResponse {
  vm_id: string;
  distro: string;
  ram_mb: number;
  cpu_cores: number;
}
