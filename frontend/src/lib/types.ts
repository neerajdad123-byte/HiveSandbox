export interface VMInfo {
  vm_id: string;
  distro: string;
  status: string;
  ram_mb: number;
  cpu_cores: number;
  created_at: string | null;
}

export interface VMCreateRequest {
  distro: "alpine" | "ubuntu";
  ram_mb: number;
  cpu_cores: number;
}

export interface VMCreateResponse {
  vm_id: string;
  distro: string;
  ram_mb: number;
  cpu_cores: number;
}
