"""
HiveSandbox API — FastAPI backend wrapping the microsandbox CLI.

Endpoints:
  GET  /api/vms                  — list running sandboxes
  POST /api/vms/create           — create + boot a sandbox
  POST /api/vms/{vm_id}/stop     — stop a sandbox
  WS   /api/vms/{vm_id}/terminal — bidirectional PTY terminal
"""

from __future__ import annotations

import asyncio
import json
import os
import pty
import shutil
import signal
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Resolve the microsandbox binary.  Checks MSB_BIN env var, then common
# install locations (official installer, Homebrew, npm global, cargo).
def _resolve_msb() -> str:
    explicit = os.environ.get("MSB_BIN")
    if explicit:
        return explicit

    candidates = [
        "msb",                                                # on PATH
        os.path.expanduser("~/.local/bin/msb"),               # official installer
        os.path.expanduser("~/.microsandbox/bin/msb"),        # official installer (alt)
        "/home/linuxbrew/.linuxbrew/bin/msb",                 # Homebrew on Linux
        "/opt/homebrew/bin/msb",                              # Homebrew on macOS
        "/usr/local/bin/msb",                                 # manual / npm global
    ]
    for c in candidates:
        if shutil.which(c) or (os.path.isfile(c) and os.access(c, os.X_OK)):
            return c
    return "msb"  # fallback — will fail with a clear error

MSB_BIN: str = _resolve_msb()

# Distros we expose in the GUI.
SUPPORTED_DISTROS: dict[str, str] = {
    "alpine": "alpine",
    "ubuntu": "ubuntu",
}

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="HiveSandbox API",
    version="0.1.0",
    description="MicroVM playground — wrapper around the microsandbox CLI.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class VMCreateRequest(BaseModel):
    distro: str = Field(
        default="alpine",
        description="Guest OS image (alpine | ubuntu).",
        pattern="^(alpine|ubuntu)$",
    )
    ram_mb: int = Field(
        default=512,
        ge=128,
        le=8192,
        description="RAM in megabytes (128–8192).",
    )
    cpu_cores: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Virtual CPU cores (1–4).",
    )


class VMCreateResponse(BaseModel):
    vm_id: str
    distro: str
    ram_mb: int
    cpu_cores: int


class VMInfo(BaseModel):
    vm_id: str
    distro: str
    status: str
    ram_mb: int = 0
    cpu_cores: int = 0
    created_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _short_id() -> str:
    """A short, human-friendly VM id (8 hex chars)."""
    return uuid.uuid4().hex[:8]


def _memory_flag(mb: int) -> str:
    """Convert megabytes to the microsandbox `--memory` format."""
    if mb >= 1024 and mb % 1024 == 0:
        return f"{mb // 1024}G"
    return f"{mb}M"


async def _run_msb(*args: str, timeout: float = 60.0) -> tuple[int, str, str]:
    """Run `msb <args>` and return (exit_code, stdout, stderr)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            MSB_BIN,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=f"`{MSB_BIN}` not found. Install microsandbox: "
            "curl -fsSL https://install.microsandbox.dev | sh",
        )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        try:
            proc.kill()
            await proc.wait()
        except ProcessLookupError:
            pass  # process already exited
        raise HTTPException(status_code=504, detail="microsandbox command timed out")

    return (
        proc.returncode or 0,
        stdout.decode("utf-8", errors="replace").strip(),
        stderr.decode("utf-8", errors="replace").strip(),
    )


def _parse_list_output(stdout: str) -> list[dict]:
    """Parse `msb list --format json` output into a list of VM dicts."""
    try:
        entries = json.loads(stdout) if stdout else []
    except json.JSONDecodeError:
        return []
    # The CLI returns [{name, status, created_at, image}, …]
    results: list[dict] = []
    for e in entries:
        image = e.get("image", "")
        # Normalise image name to a distro key
        distro = "unknown"
        for key, ref in SUPPORTED_DISTROS.items():
            if ref in image:
                distro = key
                break
        results.append(
            {
                "vm_id": e.get("name", ""),
                "distro": distro,
                "status": e.get("status", "unknown").lower(),
                "created_at": e.get("created_at"),
            }
        )
    return results


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/vms", response_model=list[VMInfo])
async def list_vms():
    """Return all sandboxes known to microsandbox."""
    code, stdout, stderr = await _run_msb("list", "--format", "json")
    if code != 0:
        raise HTTPException(status_code=500, detail=stderr or "msb list failed")
    return _parse_list_output(stdout)



@app.get("/api/vms/{vm_id}")
async def get_vm(vm_id: str):
    """Get detailed info for a single sandbox including CPU/RAM."""
    code, stdout, stderr = await _run_msb("inspect", vm_id, "--format", "json")
    if code != 0:
        raise HTTPException(status_code=404, detail=stderr or f"VM '{vm_id}' not found")
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse sandbox info")
    config = data.get("config", {})
    resources = config.get("resources", {})
    image = config.get("image", {})
    distro = "unknown"
    for key, ref in SUPPORTED_DISTROS.items():
        if isinstance(image, dict) and ref in str(image.get("Oci", {}).get("reference", "")):
            distro = key
            break
    return {
        "vm_id": data.get("name", vm_id),
        "distro": distro,
        "status": data.get("status", "unknown").lower(),
        "ram_mb": resources.get("memory_mib", 0),
        "cpu_cores": resources.get("cpus", 0),
        "created_at": data.get("created_at"),
    }


@app.post("/api/vms/create", response_model=VMCreateResponse)
async def create_vm(req: VMCreateRequest):
    """Boot a new microVM — returns instantly, VM appears when ready."""
    vm_id = _short_id()
    distro_ref = SUPPORTED_DISTROS[req.distro]
    mem_flag = _memory_flag(req.ram_mb)

    # Fire-and-forget: spawn in background so the API returns immediately.
    # The frontend polls /api/vms and picks up the VM when msb finishes.
    asyncio.create_task(
        _run_msb(
            "run",
            distro_ref,
            "--name", vm_id,
            "--detach",
            "--cpus", str(req.cpu_cores),
            "--memory", mem_flag,
            timeout=300.0,
        )
    )

    return VMCreateResponse(
        vm_id=vm_id,
        distro=req.distro,
        ram_mb=req.ram_mb,
        cpu_cores=req.cpu_cores,
    )


@app.post("/api/vms/{vm_id}/stop")
async def stop_vm(vm_id: str):
    """Stop a sandbox — force-kill if graceful shutdown times out."""
    # Try graceful first with a short timeout
    code, stdout, stderr = await _run_msb("stop", vm_id, "--force", "--timeout", "5", timeout=15.0)
    if code != 0:
        # Fallback: immediate force-kill (no timeout)
        code2, _, stderr2 = await _run_msb("stop", vm_id, "--force", timeout=10.0)
        if code2 != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to stop VM '{vm_id}': {stderr2 or stderr or 'unknown error'}",
            )
    return {"status": "stopped", "vm_id": vm_id}


@app.post("/api/vms/{vm_id}/start")
async def start_vm(vm_id: str):
    """Start a stopped sandbox by issuing a no-op exec (auto-starts it)."""
    code, stdout, stderr = await _run_msb("exec", vm_id, "--", "/bin/true")
    if code != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start VM '{vm_id}': {stderr or 'unknown error'}",
        )
    return {"status": "running", "vm_id": vm_id}


# ---------------------------------------------------------------------------
# WebSocket — Terminal
# ---------------------------------------------------------------------------

@app.websocket("/api/vms/{vm_id}/terminal")
async def vm_terminal(websocket: WebSocket, vm_id: str):
    """
    Bidirectional terminal for *vm_id*.

    Spawns `msb exec <vm_id> -t -- /bin/sh` inside a PTY and bridges
    WebSocket text frames ↔ subprocess stdin/stdout.
    """
    await websocket.accept()

    # ------------------------------------------------------------------
    # Resize helper — send SIGWINCH when the client reports a new size.
    # ------------------------------------------------------------------
    async def _resize(fd: int, rows: int, cols: int):
        try:
            import fcntl
            import struct
            import termios

            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
        except Exception:
            pass  # best-effort

    # ------------------------------------------------------------------
    # Spawn the `msb exec` subprocess with a PTY.
    # ------------------------------------------------------------------
    master_fd: int | None = None
    slave_fd: int | None = None
    proc: asyncio.subprocess.Process | None = None

    try:
        master_fd, slave_fd = pty.openpty()

        proc = await asyncio.create_subprocess_exec(
            MSB_BIN,
            "exec",
            vm_id,
            "-t",
            "--",
            "/bin/sh",
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
            preexec_fn=os.setsid,  # new session so signals don't propagate
        )

        # Close the slave fd in the parent — the child owns it.
        os.close(slave_fd)
        slave_fd = None

        # Wrap master_fd in asyncio streams.
        reader = asyncio.StreamReader()
        transport, _ = await asyncio.get_event_loop().connect_read_pipe(
            lambda: asyncio.StreamReaderProtocol(reader),
            os.fdopen(master_fd, "rb", buffering=0),
        )

        # ------------------------------------------------------------------
        # Background task: read subprocess stdout → push to WebSocket.
        # ------------------------------------------------------------------
        async def _pipe_stdout_to_ws():
            nonlocal master_fd
            closed = False
            while not closed:
                try:
                    chunk = await asyncio.wait_for(reader.read(4096), timeout=0.5)
                    if not chunk:  # EOF
                        closed = True
                        break
                    await websocket.send_bytes(chunk)
                except asyncio.TimeoutError:
                    # Probe whether the websocket is still alive.
                    pass
                except Exception:
                    closed = True
                    break
            # Subprocess stdout closed — notify the client and close the WS.
            try:
                await websocket.close(code=1000, reason="VM process ended")
            except Exception:
                pass

        stdout_task = asyncio.create_task(_pipe_stdout_to_ws())

        # ------------------------------------------------------------------
        # Main loop: read WebSocket → push to subprocess stdin.
        # ------------------------------------------------------------------
        write_fd = os.fdopen(master_fd, "wb", buffering=0)
        current_rows = 24
        current_cols = 80

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive(), timeout=0.5)
            except asyncio.TimeoutError:
                # Check if the subprocess is still alive.
                if proc.returncode is not None:
                    break
                continue

            if data["type"] == "websocket.disconnect":
                break

            if data["type"] == "websocket.receive":
                text = data.get("text") or data.get("bytes")
                if text is None:
                    continue

                # ------------------------------------------------------------------
                # Resize escape sequence:  \x1b[8;<rows>;<cols>t
                # Sent by xterm.js fit addon.
                # ------------------------------------------------------------------
                if isinstance(text, str) and text.startswith("\x1b[8;"):
                    try:
                        parts = text[4:].rstrip("t").split(";")
                        rows = int(parts[0])
                        cols = int(parts[1])
                        if rows != current_rows or cols != current_cols:
                            current_rows, current_cols = rows, cols
                            await _resize(master_fd, rows, cols)
                    except (ValueError, IndexError):
                        pass
                    continue

                # Write to subprocess stdin.
                payload = text.encode("utf-8") if isinstance(text, str) else text
                try:
                    write_fd.write(payload)
                    write_fd.flush()
                except (BrokenPipeError, OSError):
                    break

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # ── Cleanup ────────────────────────────────────────────────────
        if stdout_task and not stdout_task.done():
            stdout_task.cancel()
            try:
                await stdout_task
            except asyncio.CancelledError:
                pass

        if proc is not None and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except (asyncio.TimeoutError, ProcessLookupError):
                try:
                    proc.kill()
                    await proc.wait()
                except ProcessLookupError:
                    pass

        if slave_fd is not None:
            try:
                os.close(slave_fd)
            except OSError:
                pass

        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    """Liveness probe — also checks that `msb` is reachable."""
    try:
        code, stdout, stderr = await _run_msb("--version", timeout=5.0)
    except Exception:
        code, stdout = 1, None
    return {
        "status": "ok",
        "msb_available": code == 0,
        "msb_version": stdout if code == 0 else None,
    }


# ---------------------------------------------------------------------------
# Entrypoint (for `python main.py` / `uvicorn main:app`)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
