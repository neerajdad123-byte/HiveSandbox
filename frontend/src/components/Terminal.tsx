"use client";

import React, { useEffect, useRef } from "react";
import type { Terminal as XTermTerminal } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { WebLinksAddon as WebLinksAddonType } from "@xterm/addon-web-links";

let TerminalCtor: typeof XTermTerminal | null = null;
let FitAddonCtor: typeof FitAddonType | null = null;
let WebLinksAddonCtor: typeof WebLinksAddonType | null = null;

interface TerminalProps {
  wsUrl: string;
  vmId: string;
  onDisconnect: () => void;
}

export default function Terminal({ wsUrl, vmId, onDisconnect }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    async function init() {
      if (!containerRef.current) return;

      if (!TerminalCtor) {
        const [xterm, fit, links] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
        ]);
        TerminalCtor = xterm.Terminal;
        FitAddonCtor = fit.FitAddon;
        WebLinksAddonCtor = links.WebLinksAddon;
      }

      if (disposed || !TerminalCtor || !FitAddonCtor || !WebLinksAddonCtor || !containerRef.current) {
        return;
      }

      const term = new TerminalCtor({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 14,
        fontFamily: "'Geist Mono', 'Cascadia Code', 'JetBrains Mono', monospace",
        lineHeight: 1.18,
        theme: {
          background: "#0b0f17",
          foreground: "#d8dee9",
          cursor: "#8ab4f8",
          cursorAccent: "#0b0f17",
          selectionBackground: "#1a73e84d",
          selectionForeground: "#ffffff",
          black: "#111827",
          red: "#f87171",
          green: "#34d399",
          yellow: "#fbbf24",
          blue: "#8ab4f8",
          magenta: "#c084fc",
          cyan: "#67e8f9",
          white: "#e5e7eb",
          brightBlack: "#64748b",
          brightRed: "#fca5a5",
          brightGreen: "#86efac",
          brightYellow: "#fde68a",
          brightBlue: "#bfdbfe",
          brightMagenta: "#ddd6fe",
          brightCyan: "#a5f3fc",
          brightWhite: "#ffffff",
        },
        allowProposedApi: true,
        scrollback: 5000,
        tabStopWidth: 4,
      });

      const fitAddon = new FitAddonCtor();
      const linksAddon = new WebLinksAddonCtor();

      term.loadAddon(fitAddon);
      term.loadAddon(linksAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termRef.current = term;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln(`\x1b[1;34mConnected\x1b[0m to sandbox \x1b[1;37m${vmId}\x1b[0m`);
        term.writeln("");
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          term.write(event.data);
          return;
        }

        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
          return;
        }

        if (event.data instanceof Blob) {
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
        term.writeln("\r\n\x1b[1;31mConnection error.\x1b[0m");
      };

      ws.onclose = (event) => {
        if (event.code === 1000) {
          term.writeln("\r\n\x1b[1;33mSandbox process ended.\x1b[0m");
        } else {
          term.writeln(`\r\n\x1b[1;31mDisconnected\x1b[0m (code ${event.code})`);
        }
        onDisconnect();
      };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const handleResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\x1b[8;${term.rows};${term.cols}t`);
        }
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);

      term.writeln("\x1b[2mCtrl+Shift+V to paste  |  Ctrl+Shift+C to copy\x1b[0m");
      term.writeln("");
    }

    init();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();

      try {
        termRef.current?.dispose();
      } catch {
        // ignore cleanup errors
      }
      termRef.current = null;

      try {
        wsRef.current?.close();
      } catch {
        // ignore cleanup errors
      }
      wsRef.current = null;
    };
  }, [onDisconnect, vmId, wsUrl]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[var(--terminal-bg)]"
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${vmId} terminal`}
    />
  );
}
