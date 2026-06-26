"use client";

import React, { useEffect, useRef } from "react";
import type { Terminal as XTermTerminal } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { WebLinksAddon as WebLinksAddonType } from "@xterm/addon-web-links";

/* ------------------------------------------------------------------ */
/* Lazily-loaded xterm.js classes (browser-only)                       */
/* ------------------------------------------------------------------ */

let _Terminal: typeof XTermTerminal | null = null;
let _FitAddon: typeof FitAddonType | null = null;
let _WebLinksAddon: typeof WebLinksAddonType | null = null;

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface TerminalProps {
  wsUrl: string;
  vmId: string;
  onDisconnect: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Terminal({ wsUrl, vmId, onDisconnect }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      // ── Dynamic import (only in browser) ─────────────────
      if (!_Terminal) {
        const [xterm, fit, links] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
        ]);
        _Terminal = xterm.Terminal;
        _FitAddon = fit.FitAddon;
        _WebLinksAddon = links.WebLinksAddon;
      }

      if (disposed || !_Terminal || !_FitAddon || !_WebLinksAddon) return;

      // ── Create terminal ──────────────────────────────────
      const term = new _Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Geist Mono', 'Cascadia Code', monospace",
        theme: {
          background: "#0c0c10",
          foreground: "#e4e4e7",
          cursor: "#22c55e",
          cursorAccent: "#0c0c10",
          selectionBackground: "#22c55e33",
          selectionForeground: "#fafafa",
          black: "#18181b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#f59e0b",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#d4d4d8",
          brightBlack: "#52525b",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#fbbf24",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#fafafa",
        },
        allowProposedApi: true,
        allowTransparency: true,
        scrollback: 5000,
        tabStopWidth: 4,
      });

      termRef.current = term;

      // ── Addons ───────────────────────────────────────────
      const fitAddon = new _FitAddon();
      const webLinksAddon = new _WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      fitAddonRef.current = fitAddon;

      // ── Open terminal in the container ────────────────────
      term.open(containerRef.current);
      fitAddon.fit();

      // ── Connect WebSocket ─────────────────────────────────
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        term.writeln("\x1b[1;32m●\x1b[0m Connected to sandbox \x1b[1;33m" + vmId + "\x1b[0m");
        term.writeln("");
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          term.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              term.write(new Uint8Array(reader.result));
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      ws.onerror = () => {
        term.writeln("\r\n\x1b[1;31m✕\x1b[0m WebSocket error — connection lost");
      };

      ws.onclose = (e) => {
        if (e.code === 1000) {
          term.writeln("\r\n\x1b[1;33m◉\x1b[0m Sandbox process ended.");
        } else {
          term.writeln(
            `\r\n\x1b[1;31m✕\x1b[0m Disconnected (code ${e.code})`,
          );
        }
        onDisconnect();
      };

      // ── Terminal → WebSocket ──────────────────────────────
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // ── Resize handler ────────────────────────────────────
      const handleResize = () => {
        fitAddon.fit();
        const dims = { rows: term.rows, cols: term.cols };
        if (ws.readyState === WebSocket.OPEN) {
          // Send ANSI resize escape to the backend
          ws.send(`\x1b[8;${dims.rows};${dims.cols}t`);
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // ── Keyboard shortcut overlay hint ────────────────────
      term.writeln("\x1b[2m  Ctrl+Shift+V to paste  |  Ctrl+Shift+C to copy\x1b[0m");
      term.writeln("");
    }

    init();

    return () => {
      disposed = true;

      // Dispose terminal
      if (termRef.current) {
        try {
          termRef.current.dispose();
        } catch {
          /* ignore */
        }
        termRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }

      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, vmId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: "#0c0c10" }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
