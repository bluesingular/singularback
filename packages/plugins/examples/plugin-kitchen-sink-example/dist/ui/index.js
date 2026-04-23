// src/ui/index.tsx
import { useEffect as useEffect2, useMemo, useState } from "react";
import {
  useHostContext,
  usePluginAction,
  usePluginData,
  usePluginStream,
  usePluginToast
} from "@paperclipai/plugin-sdk/ui";

// src/constants.ts
var PLUGIN_ID = "paperclip-kitchen-sink-example";
var PAGE_ROUTE = "kitchensink";
var SLOT_IDS = {
  page: "kitchen-sink-page",
  settingsPage: "kitchen-sink-settings-page",
  dashboardWidget: "kitchen-sink-dashboard-widget",
  sidebar: "kitchen-sink-sidebar-link",
  sidebarPanel: "kitchen-sink-sidebar-panel",
  projectSidebarItem: "kitchen-sink-project-link",
  projectTab: "kitchen-sink-project-tab",
  issueTab: "kitchen-sink-issue-tab",
  taskDetailView: "kitchen-sink-task-detail",
  toolbarButton: "kitchen-sink-toolbar-action",
  contextMenuItem: "kitchen-sink-context-action",
  commentAnnotation: "kitchen-sink-comment-annotation",
  commentContextMenuItem: "kitchen-sink-comment-action"
};
var EXPORT_NAMES = {
  page: "KitchenSinkPage",
  settingsPage: "KitchenSinkSettingsPage",
  dashboardWidget: "KitchenSinkDashboardWidget",
  sidebar: "KitchenSinkSidebarLink",
  sidebarPanel: "KitchenSinkSidebarPanel",
  projectSidebarItem: "KitchenSinkProjectSidebarItem",
  projectTab: "KitchenSinkProjectTab",
  issueTab: "KitchenSinkIssueTab",
  taskDetailView: "KitchenSinkTaskDetailView",
  toolbarButton: "KitchenSinkToolbarButton",
  contextMenuItem: "KitchenSinkContextMenuItem",
  commentAnnotation: "KitchenSinkCommentAnnotation",
  commentContextMenuItem: "KitchenSinkCommentContextMenuItem",
  launcherModal: "KitchenSinkLauncherModal"
};
var JOB_KEYS = {
  heartbeat: "demo-heartbeat"
};
var WEBHOOK_KEYS = {
  demo: "demo-ingest"
};
var TOOL_NAMES = {
  echo: "echo",
  companySummary: "company-summary",
  createIssue: "create-issue"
};
var STREAM_CHANNELS = {
  progress: "progress",
  agentChat: "agent-chat"
};
var SAFE_COMMANDS = [
  {
    key: "pwd",
    label: "Print workspace path",
    command: "pwd",
    args: [],
    description: "Prints the current workspace directory."
  },
  {
    key: "ls",
    label: "List workspace files",
    command: "ls",
    args: ["-la"],
    description: "Lists files in the selected workspace."
  },
  {
    key: "git-status",
    label: "Git status",
    command: "git",
    args: ["status", "--short", "--branch"],
    description: "Shows git status for the selected workspace."
  }
];
var DEFAULT_CONFIG = {
  showSidebarEntry: true,
  showSidebarPanel: true,
  showProjectSidebarItem: true,
  showCommentAnnotation: true,
  showCommentContextMenuItem: true,
  enableWorkspaceDemos: true,
  enableProcessDemos: false,
  secretRefExample: "",
  httpDemoUrl: "https://httpbin.org/anything",
  allowedCommands: SAFE_COMMANDS.map((command) => command.key),
  workspaceScratchFile: ".paperclip-kitchen-sink-demo.txt"
};
var RUNTIME_LAUNCHER = {
  id: "kitchen-sink-runtime-launcher",
  displayName: "Kitchen Sink Modal",
  description: "Demonstrates runtime launcher registration from the worker.",
  placementZone: "toolbarButton",
  entityTypes: ["project", "issue"],
  action: {
    type: "openModal",
    target: EXPORT_NAMES.launcherModal
  },
  render: {
    environment: "hostOverlay",
    bounds: "wide"
  }
};

// src/ui/AsciiArtAnimation.tsx
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
var CHARS = [" ", ".", "\xB7", "\u25AA", "\u25AB", "\u25CB"];
var TARGET_FPS = 24;
var FRAME_INTERVAL_MS = 1e3 / TARGET_FPS;
var PAPERCLIP_SPRITES = [
  [
    "  \u256D\u2500\u2500\u2500\u2500\u256E ",
    " \u256D\u256F\u256D\u2500\u2500\u256E\u2502 ",
    " \u2502 \u2502  \u2502\u2502 ",
    " \u2502 \u2502  \u2502\u2502 ",
    " \u2502 \u2502  \u2502\u2502 ",
    " \u2502 \u2502  \u2502\u2502 ",
    " \u2502 \u2570\u2500\u2500\u256F\u2502 ",
    " \u2570\u2500\u2500\u2500\u2500\u2500\u256F "
  ],
  [
    " \u256D\u2500\u2500\u2500\u2500\u2500\u256E ",
    " \u2502\u256D\u2500\u2500\u256E\u2570\u256E ",
    " \u2502\u2502  \u2502 \u2502 ",
    " \u2502\u2502  \u2502 \u2502 ",
    " \u2502\u2502  \u2502 \u2502 ",
    " \u2502\u2502  \u2502 \u2502 ",
    " \u2502\u2570\u2500\u2500\u256F \u2502 ",
    " \u2570\u2500\u2500\u2500\u2500\u256F  "
  ]
];
function measureChar(container) {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:11px;font-family:monospace;line-height:1;";
  container.appendChild(span);
  const rect = span.getBoundingClientRect();
  container.removeChild(span);
  return { w: rect.width, h: rect.height };
}
function spriteSize(sprite) {
  let width = 0;
  for (const row of sprite) width = Math.max(width, row.length);
  return { width, height: sprite.length };
}
function AsciiArtAnimation() {
  const preRef = useRef(null);
  const frameRef = useRef(null);
  useEffect(() => {
    if (!preRef.current) return;
    const preEl = preRef.current;
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = document.visibilityState !== "hidden";
    let loopActive = false;
    let lastRenderAt = 0;
    let tick = 0;
    let cols = 0;
    let rows = 0;
    let charW = 7;
    let charH = 11;
    let trail = new Float32Array(0);
    let colWave = new Float32Array(0);
    let rowWave = new Float32Array(0);
    let clipMask = new Uint16Array(0);
    let clips = [];
    let lastOutput = "";
    function toGlyph(value) {
      const clamped = Math.max(0, Math.min(0.999, value));
      const idx = Math.floor(clamped * CHARS.length);
      return CHARS[idx] ?? " ";
    }
    function rebuildGrid() {
      const nextCols = Math.max(0, Math.ceil(preEl.clientWidth / Math.max(1, charW)));
      const nextRows = Math.max(0, Math.ceil(preEl.clientHeight / Math.max(1, charH)));
      if (nextCols === cols && nextRows === rows) return;
      cols = nextCols;
      rows = nextRows;
      const cellCount = cols * rows;
      trail = new Float32Array(cellCount);
      colWave = new Float32Array(cols);
      rowWave = new Float32Array(rows);
      clipMask = new Uint16Array(cellCount);
      clips = clips.filter((clip) => {
        return clip.x > -clip.width - 2 && clip.x < cols + 2 && clip.y > -clip.height - 2 && clip.y < rows + 2;
      });
      lastOutput = "";
    }
    function drawStaticFrame() {
      if (cols <= 0 || rows <= 0) {
        preEl.textContent = "";
        return;
      }
      const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ambient = (Math.sin(c * 0.11 + r * 0.04) + Math.cos(r * 0.08 - c * 0.02)) * 0.18 + 0.22;
          grid[r][c] = toGlyph(ambient);
        }
      }
      const gapX = 18;
      const gapY = 13;
      for (let baseRow = 1; baseRow < rows - 9; baseRow += gapY) {
        const startX = Math.floor(baseRow / gapY) % 2 === 0 ? 2 : 10;
        for (let baseCol = startX; baseCol < cols - 10; baseCol += gapX) {
          const sprite = PAPERCLIP_SPRITES[(baseCol + baseRow) % PAPERCLIP_SPRITES.length];
          for (let sr = 0; sr < sprite.length; sr++) {
            const line = sprite[sr];
            for (let sc = 0; sc < line.length; sc++) {
              const ch = line[sc] ?? " ";
              if (ch === " ") continue;
              const row = baseRow + sr;
              const col = baseCol + sc;
              if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
              grid[row][col] = ch;
            }
          }
        }
      }
      const output = grid.map((line) => line.join("")).join("\n");
      preEl.textContent = output;
      lastOutput = output;
    }
    function spawnClip() {
      const sprite = PAPERCLIP_SPRITES[Math.floor(Math.random() * PAPERCLIP_SPRITES.length)];
      const size = spriteSize(sprite);
      const edge = Math.random();
      let x = 0;
      let y = 0;
      let vx = 0;
      let vy = 0;
      if (edge < 0.68) {
        x = Math.random() < 0.5 ? -size.width - 1 : cols + 1;
        y = Math.random() * Math.max(1, rows - size.height);
        vx = x < 0 ? 0.04 + Math.random() * 0.05 : -(0.04 + Math.random() * 0.05);
        vy = (Math.random() - 0.5) * 0.014;
      } else {
        x = Math.random() * Math.max(1, cols - size.width);
        y = Math.random() < 0.5 ? -size.height - 1 : rows + 1;
        vx = (Math.random() - 0.5) * 0.014;
        vy = y < 0 ? 0.028 + Math.random() * 0.034 : -(0.028 + Math.random() * 0.034);
      }
      clips.push({
        x,
        y,
        vx,
        vy,
        life: 0,
        maxLife: 260 + Math.random() * 220,
        drift: (Math.random() - 0.5) * 1.2,
        sprite,
        width: size.width,
        height: size.height
      });
    }
    function stampClip(clip, alpha) {
      const baseCol = Math.round(clip.x);
      const baseRow = Math.round(clip.y);
      for (let sr = 0; sr < clip.sprite.length; sr++) {
        const line = clip.sprite[sr];
        const row = baseRow + sr;
        if (row < 0 || row >= rows) continue;
        for (let sc = 0; sc < line.length; sc++) {
          const ch = line[sc] ?? " ";
          if (ch === " ") continue;
          const col = baseCol + sc;
          if (col < 0 || col >= cols) continue;
          const idx = row * cols + col;
          const stroke = ch === "\u2502" || ch === "\u2500" ? 0.8 : 0.92;
          trail[idx] = Math.max(trail[idx] ?? 0, alpha * stroke);
          clipMask[idx] = ch.charCodeAt(0);
        }
      }
    }
    function step(time) {
      if (!loopActive) return;
      frameRef.current = requestAnimationFrame(step);
      if (time - lastRenderAt < FRAME_INTERVAL_MS || cols <= 0 || rows <= 0) return;
      const delta = Math.min(2, lastRenderAt === 0 ? 1 : (time - lastRenderAt) / 16.6667);
      lastRenderAt = time;
      tick += delta;
      const cellCount = cols * rows;
      const targetCount = Math.max(3, Math.floor(cellCount / 2200));
      while (clips.length < targetCount) spawnClip();
      for (let i = 0; i < trail.length; i++) trail[i] *= 0.92;
      clipMask.fill(0);
      for (let i = clips.length - 1; i >= 0; i--) {
        const clip = clips[i];
        clip.life += delta;
        const wobbleX = Math.sin((clip.y + clip.drift + tick * 0.12) * 0.09) * 18e-4;
        const wobbleY = Math.cos((clip.x - clip.drift - tick * 0.09) * 0.08) * 14e-4;
        clip.vx = (clip.vx + wobbleX) * 0.998;
        clip.vy = (clip.vy + wobbleY) * 0.998;
        clip.x += clip.vx * delta;
        clip.y += clip.vy * delta;
        if (clip.life >= clip.maxLife || clip.x < -clip.width - 2 || clip.x > cols + 2 || clip.y < -clip.height - 2 || clip.y > rows + 2) {
          clips.splice(i, 1);
          continue;
        }
        const life = clip.life / clip.maxLife;
        const alpha = life < 0.12 ? life / 0.12 : life > 0.88 ? (1 - life) / 0.12 : 1;
        stampClip(clip, alpha);
      }
      for (let c = 0; c < cols; c++) colWave[c] = Math.sin(c * 0.08 + tick * 0.06);
      for (let r = 0; r < rows; r++) rowWave[r] = Math.cos(r * 0.1 - tick * 0.05);
      let output = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const clipChar = clipMask[idx];
          if (clipChar > 0) {
            output += String.fromCharCode(clipChar);
            continue;
          }
          const ambient = 0.2 + colWave[c] * 0.08 + rowWave[r] * 0.06 + Math.sin((c + r) * 0.1 + tick * 0.035) * 0.05;
          output += toGlyph((trail[idx] ?? 0) + ambient);
        }
        if (r < rows - 1) output += "\n";
      }
      if (output !== lastOutput) {
        preEl.textContent = output;
        lastOutput = output;
      }
    }
    const resizeObserver = new ResizeObserver(() => {
      const measured2 = measureChar(preEl);
      charW = measured2.w || 7;
      charH = measured2.h || 11;
      rebuildGrid();
      if (motionMedia.matches || !isVisible) {
        drawStaticFrame();
      }
    });
    function startLoop() {
      if (loopActive) return;
      loopActive = true;
      lastRenderAt = 0;
      frameRef.current = requestAnimationFrame(step);
    }
    function stopLoop() {
      loopActive = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    }
    function syncMode() {
      if (motionMedia.matches || !isVisible) {
        stopLoop();
        drawStaticFrame();
      } else {
        startLoop();
      }
    }
    function handleVisibility() {
      isVisible = document.visibilityState !== "hidden";
      syncMode();
    }
    const measured = measureChar(preEl);
    charW = measured.w || 7;
    charH = measured.h || 11;
    rebuildGrid();
    resizeObserver.observe(preEl);
    motionMedia.addEventListener("change", syncMode);
    document.addEventListener("visibilitychange", handleVisibility);
    syncMode();
    return () => {
      stopLoop();
      resizeObserver.disconnect();
      motionMedia.removeEventListener("change", syncMode);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        height: "320px",
        minHeight: "320px",
        maxHeight: "350px",
        background: "#1d1d1d",
        color: "#f2efe6",
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)"
      },
      children: /* @__PURE__ */ jsx(
        "pre",
        {
          ref: preRef,
          "aria-hidden": "true",
          style: {
            margin: 0,
            width: "100%",
            height: "100%",
            padding: "14px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            fontSize: "11px",
            lineHeight: 1,
            whiteSpace: "pre",
            userSelect: "none"
          }
        }
      )
    }
  );
}

// src/ui/index.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var layoutStack = {
  display: "grid",
  gap: "12px"
};
var cardStyle = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "14px",
  background: "var(--card, transparent)"
};
var subtleCardStyle = {
  border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
  borderRadius: "10px",
  padding: "12px"
};
var rowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px"
};
var sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  marginBottom: "10px"
};
var buttonStyle = {
  appearance: "none",
  border: "1px solid var(--border)",
  borderRadius: "999px",
  background: "transparent",
  color: "inherit",
  padding: "6px 12px",
  fontSize: "12px",
  cursor: "pointer"
};
var primaryButtonStyle = {
  ...buttonStyle,
  background: "var(--foreground)",
  color: "var(--background)",
  borderColor: "var(--foreground)"
};
function toneButtonStyle(tone) {
  if (tone === "success") {
    return {
      ...buttonStyle,
      background: "color-mix(in srgb, #16a34a 18%, transparent)",
      borderColor: "color-mix(in srgb, #16a34a 60%, var(--border))",
      color: "#86efac"
    };
  }
  if (tone === "warn") {
    return {
      ...buttonStyle,
      background: "color-mix(in srgb, #d97706 18%, transparent)",
      borderColor: "color-mix(in srgb, #d97706 60%, var(--border))",
      color: "#fcd34d"
    };
  }
  return {
    ...buttonStyle,
    background: "color-mix(in srgb, #2563eb 18%, transparent)",
    borderColor: "color-mix(in srgb, #2563eb 60%, var(--border))",
    color: "#93c5fd"
  };
}
var inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "8px 10px",
  background: "transparent",
  color: "inherit",
  fontSize: "12px"
};
var codeStyle = {
  margin: 0,
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "color-mix(in srgb, var(--muted, #888) 16%, transparent)",
  overflowX: "auto",
  fontSize: "11px",
  lineHeight: 1.45
};
var widgetGridStyle = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};
var widgetStyle = {
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px",
  display: "grid",
  gap: "8px",
  background: "color-mix(in srgb, var(--card, transparent) 72%, transparent)"
};
var mutedTextStyle = {
  fontSize: "12px",
  opacity: 0.72,
  lineHeight: 1.45
};
function hostPath(companyPrefix, suffix) {
  return companyPrefix ? `/${companyPrefix}${suffix}` : suffix;
}
function pluginPagePath(companyPrefix) {
  return hostPath(companyPrefix, `/${PAGE_ROUTE}`);
}
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function getObjectString(value, key) {
  if (!value || typeof value !== "object") return null;
  const next = value[key];
  return typeof next === "string" ? next : null;
}
function getObjectNumber(value, key) {
  if (!value || typeof value !== "object") return null;
  const next = value[key];
  return typeof next === "number" && Number.isFinite(next) ? next : null;
}
function isKitchenSinkDemoCompany(company) {
  return company.name.startsWith("Kitchen Sink Demo");
}
function JsonBlock({ value }) {
  return /* @__PURE__ */ jsx2("pre", { style: codeStyle, children: JSON.stringify(value, null, 2) });
}
function Section({
  title,
  action,
  children
}) {
  return /* @__PURE__ */ jsxs("section", { style: cardStyle, children: [
    /* @__PURE__ */ jsxs("div", { style: sectionHeaderStyle, children: [
      /* @__PURE__ */ jsx2("strong", { children: title }),
      action
    ] }),
    /* @__PURE__ */ jsx2("div", { style: layoutStack, children })
  ] });
}
function Pill({ label }) {
  return /* @__PURE__ */ jsx2(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        padding: "2px 8px",
        fontSize: "11px"
      },
      children: label
    }
  );
}
function MiniWidget({
  title,
  eyebrow,
  children
}) {
  return /* @__PURE__ */ jsxs("section", { style: widgetStyle, children: [
    eyebrow ? /* @__PURE__ */ jsx2("div", { style: { fontSize: "11px", opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.06em" }, children: eyebrow }) : null,
    /* @__PURE__ */ jsx2("strong", { children: title }),
    /* @__PURE__ */ jsx2("div", { style: layoutStack, children })
  ] });
}
function MiniList({
  items,
  render,
  empty
}) {
  if (items.length === 0) return /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.7 }, children: empty });
  return /* @__PURE__ */ jsx2("div", { style: { display: "grid", gap: "8px" }, children: items.map((item, index) => /* @__PURE__ */ jsx2("div", { style: subtleCardStyle, children: render(item, index) }, index)) });
}
function StatusLine({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px" }, children: [
    /* @__PURE__ */ jsx2("span", { style: { fontSize: "11px", opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.06em" }, children: label }),
    /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px" }, children: value })
  ] });
}
function PaginatedDomainCard({
  title,
  items,
  totalCount,
  empty,
  onLoadMore,
  render
}) {
  const hasMore = totalCount !== null ? items.length < totalCount : false;
  return /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
    /* @__PURE__ */ jsxs("div", { style: sectionHeaderStyle, children: [
      /* @__PURE__ */ jsx2("strong", { children: title }),
      totalCount !== null ? /* @__PURE__ */ jsxs("span", { style: mutedTextStyle, children: [
        items.length,
        " / ",
        totalCount
      ] }) : null
    ] }),
    /* @__PURE__ */ jsx2(MiniList, { items, empty, render }),
    hasMore ? /* @__PURE__ */ jsx2("div", { style: { marginTop: "10px" }, children: /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: onLoadMore, children: "Load 20 more" }) }) : null
  ] });
}
function usePluginOverview(companyId) {
  return usePluginData("overview", companyId ? { companyId } : {});
}
function usePluginConfigData() {
  return usePluginData("plugin-config");
}
function hostFetchJson(path, init) {
  return fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers ?? {}
    },
    ...init
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return await response.json();
  });
}
function useSettingsConfig() {
  const [configJson, setConfigJson] = useState({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect2(() => {
    let cancelled = false;
    setLoading(true);
    hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`).then((result) => {
      if (cancelled) return;
      setConfigJson({ ...DEFAULT_CONFIG, ...result?.configJson ?? {} });
      setError(null);
    }).catch((nextError) => {
      if (cancelled) return;
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save(nextConfig) {
    setSaving(true);
    try {
      await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: nextConfig })
      });
      setConfigJson(nextConfig);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      throw nextError;
    } finally {
      setSaving(false);
    }
  }
  return {
    configJson,
    setConfigJson,
    loading,
    saving,
    error,
    save
  };
}
function CompactSurfaceSummary({ label, entityType }) {
  const context = useHostContext();
  const companyId = context.companyId;
  const entityId = context.entityId;
  const resolvedEntityType = entityType ?? context.entityType ?? null;
  const entityQuery = usePluginData(
    "entity-context",
    companyId && entityId && resolvedEntityType ? { companyId, entityId, entityType: resolvedEntityType } : {}
  );
  const writeMetric = usePluginAction("write-metric");
  return /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
    /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
      /* @__PURE__ */ jsx2("strong", { children: label }),
      resolvedEntityType ? /* @__PURE__ */ jsx2(Pill, { label: resolvedEntityType }) : null
    ] }),
    /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This surface demo shows the host context for the current mount point. The metric button records a demo counter so you can verify plugin metrics wiring from a contextual surface." }),
    /* @__PURE__ */ jsx2(JsonBlock, { value: context }),
    /* @__PURE__ */ jsx2(
      "button",
      {
        type: "button",
        style: buttonStyle,
        onClick: () => {
          if (!companyId) return;
          void writeMetric({ name: "surface_click", value: 1, companyId }).catch(console.error);
        },
        children: "Record demo metric"
      }
    ),
    entityQuery.data ? /* @__PURE__ */ jsx2(JsonBlock, { value: entityQuery.data }) : null
  ] });
}
function KitchenSinkPageWidgets({ context }) {
  const overview = usePluginOverview(context.companyId);
  const toast = usePluginToast();
  const emitDemoEvent = usePluginAction("emit-demo-event");
  const startProgressStream = usePluginAction("start-progress-stream");
  const writeMetric = usePluginAction("write-metric");
  const progressStream = usePluginStream(
    STREAM_CHANNELS.progress,
    { companyId: context.companyId ?? void 0 }
  );
  const [quickActionStatus, setQuickActionStatus] = useState(null);
  useEffect2(() => {
    const latest = progressStream.events.at(-1);
    if (!latest) return;
    setQuickActionStatus({
      title: "Progress stream update",
      body: latest.message ?? `Step ${latest.step ?? "?"}`,
      tone: "info"
    });
  }, [progressStream.events]);
  return /* @__PURE__ */ jsxs("div", { style: widgetGridStyle, children: [
    /* @__PURE__ */ jsx2(MiniWidget, { title: "Runtime Summary", eyebrow: "Overview", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        "Companies: ",
        overview.data?.counts.companies ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Projects: ",
        overview.data?.counts.projects ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Issues: ",
        overview.data?.counts.issues ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Agents: ",
        overview.data?.counts.agents ?? 0
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs(MiniWidget, { title: "Quick Actions", eyebrow: "Try It", children: [
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: toneButtonStyle("success"),
            onClick: () => toast({
              title: "Kitchen Sink success toast",
              body: "This is rendered by the host toast system from plugin UI.",
              tone: "success"
            }),
            children: "Success toast"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: toneButtonStyle("warn"),
            onClick: () => toast({
              title: "Kitchen Sink warning toast",
              body: "Use this pattern for user-facing plugin feedback.",
              tone: "warn"
            }),
            children: "Warning toast"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: toneButtonStyle("info"),
            onClick: () => toast({
              title: "Open dashboard",
              body: "Toasts can link back into host pages.",
              tone: "info",
              action: {
                label: "Go",
                href: hostPath(context.companyPrefix, "/dashboard")
              }
            }),
            children: "Action toast"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: buttonStyle,
            onClick: () => {
              if (!context.companyId) return;
              void emitDemoEvent({ companyId: context.companyId, message: "Triggered from Kitchen Sink page" }).then((next) => {
                overview.refresh();
                const message = getObjectString(next, "message") ?? "Demo event emitted";
                setQuickActionStatus({
                  title: "Event emitted",
                  body: message,
                  tone: "success"
                });
                toast({
                  title: "Event emitted",
                  body: message,
                  tone: "success"
                });
              }).catch((error) => {
                const message = getErrorMessage(error);
                setQuickActionStatus({
                  title: "Event failed",
                  body: message,
                  tone: "error"
                });
                toast({
                  title: "Event failed",
                  body: message,
                  tone: "error"
                });
              });
            },
            children: "Emit event"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: buttonStyle,
            onClick: () => {
              if (!context.companyId) return;
              void startProgressStream({ companyId: context.companyId, steps: 4 }).then(() => {
                setQuickActionStatus({
                  title: "Stream started",
                  body: "Watch the live progress updates below.",
                  tone: "info"
                });
                toast({
                  title: "Progress stream started",
                  body: "Live updates will appear in the quick action panel.",
                  tone: "info"
                });
              }).catch((error) => {
                const message = getErrorMessage(error);
                setQuickActionStatus({
                  title: "Stream failed",
                  body: message,
                  tone: "error"
                });
                toast({
                  title: "Progress stream failed",
                  body: message,
                  tone: "error"
                });
              });
            },
            children: "Start stream"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: buttonStyle,
            onClick: () => {
              if (!context.companyId) return;
              void writeMetric({ companyId: context.companyId, name: "page_quick_action", value: 1 }).then((next) => {
                overview.refresh();
                const value = getObjectNumber(next, "value") ?? 1;
                const body = `Recorded demo.page_quick_action = ${value}`;
                setQuickActionStatus({
                  title: "Metric recorded",
                  body,
                  tone: "success"
                });
                toast({
                  title: "Metric recorded",
                  body,
                  tone: "success"
                });
              }).catch((error) => {
                const message = getErrorMessage(error);
                setQuickActionStatus({
                  title: "Metric failed",
                  body: message,
                  tone: "error"
                });
                toast({
                  title: "Metric failed",
                  body: message,
                  tone: "error"
                });
              });
            },
            children: "Write metric"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "6px" }, children: [
        /* @__PURE__ */ jsxs("div", { style: mutedTextStyle, children: [
          "Recent progress events: ",
          progressStream.events.length
        ] }),
        quickActionStatus ? /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              ...subtleCardStyle,
              borderColor: quickActionStatus.tone === "error" ? "color-mix(in srgb, #dc2626 45%, var(--border))" : quickActionStatus.tone === "warn" ? "color-mix(in srgb, #d97706 45%, var(--border))" : quickActionStatus.tone === "success" ? "color-mix(in srgb, #16a34a 45%, var(--border))" : "color-mix(in srgb, #2563eb 45%, var(--border))"
            },
            children: [
              /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", fontWeight: 600 }, children: quickActionStatus.title }),
              /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: quickActionStatus.body })
            ]
          }
        ) : null,
        progressStream.events.length > 0 ? /* @__PURE__ */ jsx2(JsonBlock, { value: progressStream.events.slice(-3) }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsx2(MiniWidget, { title: "Surface Map", eyebrow: "UI", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsx2("div", { children: "Sidebar link and panel" }),
      /* @__PURE__ */ jsx2("div", { children: "Dashboard widget" }),
      /* @__PURE__ */ jsx2("div", { children: "Project link, tab, toolbar button, launcher" }),
      /* @__PURE__ */ jsx2("div", { children: "Issue tab, task view, toolbar button, launcher" }),
      /* @__PURE__ */ jsx2("div", { children: "Comment annotation and comment action" })
    ] }) }),
    /* @__PURE__ */ jsx2(MiniWidget, { title: "Manifest Coverage", eyebrow: "Worker", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        "Jobs: ",
        overview.data?.manifest.jobs.length ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Webhooks: ",
        overview.data?.manifest.webhooks.length ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Tools: ",
        overview.data?.manifest.tools.length ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Launchers: ",
        overview.data?.runtimeLaunchers.length ?? 0
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs(MiniWidget, { title: "Latest Runtime State", eyebrow: "Diagnostics", children: [
      /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This updates as you use the worker demos below." }),
      /* @__PURE__ */ jsx2(
        JsonBlock,
        {
          value: {
            lastJob: overview.data?.lastJob ?? null,
            lastWebhook: overview.data?.lastWebhook ?? null,
            lastProcessResult: overview.data?.lastProcessResult ?? null
          }
        }
      )
    ] })
  ] });
}
function KitchenSinkIssueCrudDemo({ context }) {
  const toast = usePluginToast();
  const [issues, setIssues] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [createTitle, setCreateTitle] = useState("Kitchen Sink demo issue");
  const [createDescription, setCreateDescription] = useState("Created from the Kitchen Sink embedded page.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function loadIssues() {
    if (!context.companyId) return;
    setLoading(true);
    try {
      const result = await hostFetchJson(`/api/companies/${context.companyId}/issues`);
      const nextIssues = result.slice(0, 8);
      setIssues(nextIssues);
      setDrafts(
        Object.fromEntries(
          nextIssues.map((issue) => [issue.id, { title: issue.title, status: issue.status }])
        )
      );
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }
  useEffect2(() => {
    void loadIssues();
  }, [context.companyId]);
  async function handleCreate() {
    if (!context.companyId || !createTitle.trim()) return;
    try {
      await hostFetchJson(`/api/companies/${context.companyId}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim() || void 0,
          status: "todo",
          priority: "medium"
        })
      });
      toast({ title: "Issue created", body: createTitle.trim(), tone: "success" });
      setCreateTitle("Kitchen Sink demo issue");
      setCreateDescription("Created from the Kitchen Sink embedded page.");
      await loadIssues();
    } catch (nextError) {
      toast({ title: "Issue create failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  async function handleSave(issueId) {
    const draft = drafts[issueId];
    if (!draft) return;
    try {
      await hostFetchJson(`/api/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title.trim(),
          status: draft.status
        })
      });
      toast({ title: "Issue updated", body: draft.title.trim(), tone: "success" });
      await loadIssues();
    } catch (nextError) {
      toast({ title: "Issue update failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  async function handleDelete(issueId) {
    try {
      await hostFetchJson(`/api/issues/${issueId}`, { method: "DELETE" });
      toast({ title: "Issue deleted", tone: "info" });
      await loadIssues();
    } catch (nextError) {
      toast({ title: "Issue delete failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  return /* @__PURE__ */ jsxs(Section, { title: "Issue CRUD", children: [
    /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This is a regular embedded React page inside Paperclip calling the board API directly. It creates, updates, and deletes issues for the current company." }),
    !context.companyId ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Select a company to use issue demos." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto" }, children: [
        /* @__PURE__ */ jsx2("input", { style: inputStyle, value: createTitle, onChange: (event) => setCreateTitle(event.target.value), placeholder: "Issue title" }),
        /* @__PURE__ */ jsx2("input", { style: inputStyle, value: createDescription, onChange: (event) => setCreateDescription(event.target.value), placeholder: "Issue description" }),
        /* @__PURE__ */ jsx2("button", { type: "button", style: primaryButtonStyle, onClick: () => void handleCreate(), children: "Create issue" })
      ] }),
      loading ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Loading issues\u2026" }) : null,
      error ? /* @__PURE__ */ jsx2("div", { style: { ...mutedTextStyle, color: "var(--destructive, #dc2626)" }, children: error }) : null,
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px" }, children: [
        issues.map((issue) => {
          const draft = drafts[issue.id] ?? { title: issue.title, status: issue.status };
          return /* @__PURE__ */ jsx2("div", { style: subtleCardStyle, children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "minmax(0, 1.6fr) 140px auto auto" }, children: [
            /* @__PURE__ */ jsx2(
              "input",
              {
                style: inputStyle,
                value: draft.title,
                onChange: (event) => setDrafts((current) => ({
                  ...current,
                  [issue.id]: { ...draft, title: event.target.value }
                }))
              }
            ),
            /* @__PURE__ */ jsxs(
              "select",
              {
                style: inputStyle,
                value: draft.status,
                onChange: (event) => setDrafts((current) => ({
                  ...current,
                  [issue.id]: { ...draft, status: event.target.value }
                })),
                children: [
                  /* @__PURE__ */ jsx2("option", { value: "backlog", children: "backlog" }),
                  /* @__PURE__ */ jsx2("option", { value: "todo", children: "todo" }),
                  /* @__PURE__ */ jsx2("option", { value: "in_progress", children: "in_progress" }),
                  /* @__PURE__ */ jsx2("option", { value: "in_review", children: "in_review" }),
                  /* @__PURE__ */ jsx2("option", { value: "done", children: "done" }),
                  /* @__PURE__ */ jsx2("option", { value: "blocked", children: "blocked" }),
                  /* @__PURE__ */ jsx2("option", { value: "cancelled", children: "cancelled" })
                ]
              }
            ),
            /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void handleSave(issue.id), children: "Save" }),
            /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void handleDelete(issue.id), children: "Delete" })
          ] }) }, issue.id);
        }),
        !loading && issues.length === 0 ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "No issues yet for this company." }) : null
      ] })
    ] })
  ] });
}
function KitchenSinkCompanyCrudDemo({ context }) {
  const toast = usePluginToast();
  const [companies, setCompanies] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newCompanyName, setNewCompanyName] = useState(`Kitchen Sink Demo ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function loadCompanies() {
    setLoading(true);
    try {
      const result = await hostFetchJson("/api/companies");
      setCompanies(result);
      setDrafts(
        Object.fromEntries(
          result.map((company) => [company.id, { name: company.name, status: company.status ?? "active" }])
        )
      );
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }
  useEffect2(() => {
    void loadCompanies();
  }, []);
  async function handleCreate() {
    const trimmed = newCompanyName.trim();
    if (!trimmed) return;
    const name = trimmed.startsWith("Kitchen Sink Demo") ? trimmed : `Kitchen Sink Demo ${trimmed}`;
    try {
      await hostFetchJson("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: "Created from the Kitchen Sink example plugin page."
        })
      });
      toast({ title: "Demo company created", body: name, tone: "success" });
      setNewCompanyName(`Kitchen Sink Demo ${Date.now()}`);
      await loadCompanies();
    } catch (nextError) {
      toast({ title: "Company create failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  async function handleSave(companyId) {
    const draft = drafts[companyId];
    if (!draft) return;
    try {
      await hostFetchJson(`/api/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          status: draft.status
        })
      });
      toast({ title: "Company updated", body: draft.name.trim(), tone: "success" });
      await loadCompanies();
    } catch (nextError) {
      toast({ title: "Company update failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  async function handleDelete(company) {
    try {
      await hostFetchJson(`/api/companies/${company.id}`, { method: "DELETE" });
      toast({ title: "Demo company deleted", body: company.name, tone: "info" });
      await loadCompanies();
    } catch (nextError) {
      toast({ title: "Company delete failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  const currentCompany = companies.find((company) => company.id === context.companyId) ?? null;
  const demoCompanies = companies.filter(isKitchenSinkDemoCompany);
  return /* @__PURE__ */ jsxs(Section, { title: "Company CRUD", children: [
    /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "The worker SDK currently exposes company reads. This page shows a pragmatic embedded-app pattern for broader board actions by calling the host REST API directly." }),
    /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Current Company" }),
        currentCompany ? /* @__PURE__ */ jsx2(Pill, { label: currentCompany.issuePrefix ?? "no-prefix" }) : null
      ] }),
      /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px" }, children: currentCompany?.name ?? "No current company selected" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "minmax(0, 1fr) auto" }, children: [
      /* @__PURE__ */ jsx2(
        "input",
        {
          style: inputStyle,
          value: newCompanyName,
          onChange: (event) => setNewCompanyName(event.target.value),
          placeholder: "Kitchen Sink Demo Company"
        }
      ),
      /* @__PURE__ */ jsx2("button", { type: "button", style: primaryButtonStyle, onClick: () => void handleCreate(), children: "Create demo company" })
    ] }),
    loading ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Loading companies\u2026" }) : null,
    error ? /* @__PURE__ */ jsx2("div", { style: { ...mutedTextStyle, color: "var(--destructive, #dc2626)" }, children: error }) : null,
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px" }, children: [
      demoCompanies.map((company) => {
        const draft = drafts[company.id] ?? { name: company.name, status: "active" };
        const isCurrent = company.id === context.companyId;
        return /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "minmax(0, 1.5fr) 120px auto auto" }, children: [
            /* @__PURE__ */ jsx2(
              "input",
              {
                style: inputStyle,
                value: draft.name,
                onChange: (event) => setDrafts((current) => ({
                  ...current,
                  [company.id]: { ...draft, name: event.target.value }
                }))
              }
            ),
            /* @__PURE__ */ jsxs(
              "select",
              {
                style: inputStyle,
                value: draft.status,
                onChange: (event) => setDrafts((current) => ({
                  ...current,
                  [company.id]: { ...draft, status: event.target.value }
                })),
                children: [
                  /* @__PURE__ */ jsx2("option", { value: "active", children: "active" }),
                  /* @__PURE__ */ jsx2("option", { value: "paused", children: "paused" }),
                  /* @__PURE__ */ jsx2("option", { value: "archived", children: "archived" })
                ]
              }
            ),
            /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void handleSave(company.id), children: "Save" }),
            /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void handleDelete(company), disabled: isCurrent, children: "Delete" })
          ] }),
          isCurrent ? /* @__PURE__ */ jsx2("div", { style: { ...mutedTextStyle, marginTop: "8px" }, children: "Current company cannot be deleted from this demo." }) : null
        ] }, company.id);
      }),
      !loading && demoCompanies.length === 0 ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "No demo companies yet. Create one above and manage it from this page." }) : null
    ] })
  ] });
}
function KitchenSinkTopRow({ context }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        display: "grid",
        gap: "14px",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        alignItems: "stretch"
      },
      children: [
        /* @__PURE__ */ jsx2(Section, { title: "Embedded App Demo", children: /* @__PURE__ */ jsx2("div", { style: { fontSize: "13px", lineHeight: 1.5 }, children: "Plugins can host their own React page and behave like a native company page. Kitchen Sink now uses this route as a practical demo app, then keeps the lower-level worker console below for the rest of the SDK surface." }) }),
        /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "14px" }, children: [
          /* @__PURE__ */ jsxs(Section, { title: "Plugin Page Route", children: [
            /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "The company sidebar entry opens this route directly, so the plugin feels like a first-class company page instead of a settings subpage." }),
            /* @__PURE__ */ jsx2("a", { href: pluginPagePath(context.companyPrefix), style: { fontSize: "12px" }, children: pluginPagePath(context.companyPrefix) })
          ] }),
          /* @__PURE__ */ jsxs(Section, { title: "Paperclip Animation", children: [
            /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This is the same Paperclip ASCII treatment used in onboarding, copied into the example plugin so the package stays self-contained." }),
            /* @__PURE__ */ jsx2(AsciiArtAnimation, {})
          ] })
        ] })
      ]
    }
  );
}
function KitchenSinkStorageDemo({ context }) {
  const toast = usePluginToast();
  const stateKey = "revenue_clicker";
  const revenueState = usePluginData(
    "state-value",
    context.companyId ? { scopeKind: "company", scopeId: context.companyId, stateKey } : {}
  );
  const writeScopedState = usePluginAction("write-scoped-state");
  const deleteScopedState = usePluginAction("delete-scoped-state");
  const currentValue = useMemo(() => {
    const raw = revenueState.data?.value;
    if (typeof raw === "number") return raw;
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [revenueState.data?.value]);
  async function adjust(delta) {
    if (!context.companyId) return;
    try {
      await writeScopedState({
        scopeKind: "company",
        scopeId: context.companyId,
        stateKey,
        value: currentValue + delta
      });
      revenueState.refresh();
    } catch (nextError) {
      toast({ title: "Storage write failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  async function reset() {
    if (!context.companyId) return;
    try {
      await deleteScopedState({
        scopeKind: "company",
        scopeId: context.companyId,
        stateKey
      });
      toast({ title: "Revenue counter reset", tone: "info" });
      revenueState.refresh();
    } catch (nextError) {
      toast({ title: "Storage reset failed", body: getErrorMessage(nextError), tone: "error" });
    }
  }
  return /* @__PURE__ */ jsxs(Section, { title: "Plugin Storage", children: [
    /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This clicker persists into plugin-scoped company storage. A real revenue plugin could store counters, sync cursors, or cached external IDs the same way." }),
    !context.companyId ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Select a company to use company-scoped plugin storage." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px" }, children: [
        /* @__PURE__ */ jsx2("div", { style: { fontSize: "26px", fontWeight: 700 }, children: currentValue }),
        /* @__PURE__ */ jsxs("div", { style: mutedTextStyle, children: [
          "Stored at `company/",
          context.companyId,
          "/",
          stateKey,
          "`"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        [-10, -1, 1, 10].map((delta) => /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void adjust(delta), children: delta > 0 ? `+${delta}` : delta }, delta)),
        /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void reset(), children: "Reset" })
      ] }),
      /* @__PURE__ */ jsx2(JsonBlock, { value: revenueState.data ?? { scopeKind: "company", stateKey, value: 0 } })
    ] })
  ] });
}
function KitchenSinkHostIntegrationDemo({ context }) {
  const [liveRuns, setLiveRuns] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function loadRuns() {
    if (!context.companyId) return;
    setLoading(true);
    try {
      const [nextLiveRuns, nextRecentRuns] = await Promise.all([
        hostFetchJson(`/api/companies/${context.companyId}/live-runs?minCount=5`),
        hostFetchJson(`/api/companies/${context.companyId}/heartbeat-runs?limit=5`)
      ]);
      setLiveRuns(nextLiveRuns);
      setRecentRuns(nextRecentRuns);
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }
  useEffect2(() => {
    void loadRuns();
  }, [context.companyId]);
  return /* @__PURE__ */ jsxs(Section, { title: "Host Integrations", children: [
    /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Plugin pages can feel like native Paperclip pages. This section demonstrates host toasts, company-scoped routing, and reading live heartbeat data from the embedded page." }),
    /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Company Route" }),
        /* @__PURE__ */ jsx2(Pill, { label: pluginPagePath(context.companyPrefix) })
      ] }),
      /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "This page is mounted as a real company route instead of living only under `/plugins/:pluginId`." })
    ] }),
    !context.companyId ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Select a company to read run data." }) : /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
        /* @__PURE__ */ jsxs("div", { style: sectionHeaderStyle, children: [
          /* @__PURE__ */ jsx2("strong", { children: "Live Runs" }),
          /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void loadRuns(), children: "Refresh" })
        ] }),
        loading ? /* @__PURE__ */ jsx2("div", { style: mutedTextStyle, children: "Loading run data\u2026" }) : null,
        error ? /* @__PURE__ */ jsx2("div", { style: { ...mutedTextStyle, color: "var(--destructive, #dc2626)" }, children: error }) : null,
        /* @__PURE__ */ jsx2(
          MiniList,
          {
            items: liveRuns,
            empty: "No live runs right now.",
            render: (item) => {
              const run = item;
              return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "6px", fontSize: "12px" }, children: [
                /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
                  /* @__PURE__ */ jsx2("strong", { children: run.status }),
                  run.agentName ? /* @__PURE__ */ jsx2(Pill, { label: run.agentName }) : null
                ] }),
                /* @__PURE__ */ jsx2("div", { children: run.id }),
                run.agentId ? /* @__PURE__ */ jsx2("a", { href: hostPath(context.companyPrefix, `/agents/${run.agentId}/runs/${run.id}`), children: "Open run" }) : null
              ] });
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Recent Heartbeats" }),
        /* @__PURE__ */ jsx2(
          MiniList,
          {
            items: recentRuns,
            empty: "No recent heartbeat runs.",
            render: (item) => {
              const run = item;
              return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "6px", fontSize: "12px" }, children: [
                /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
                  /* @__PURE__ */ jsx2("strong", { children: run.status }),
                  run.invocationSource ? /* @__PURE__ */ jsx2(Pill, { label: run.invocationSource }) : null
                ] }),
                /* @__PURE__ */ jsx2("div", { children: run.id })
              ] });
            }
          }
        )
      ] })
    ] })
  ] });
}
function KitchenSinkEmbeddedApp({ context }) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "14px" }, children: [
    /* @__PURE__ */ jsx2(KitchenSinkTopRow, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkStorageDemo, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkIssueCrudDemo, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkCompanyCrudDemo, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkHostIntegrationDemo, { context })
  ] });
}
function KitchenSinkConsole({ context }) {
  const companyId = context.companyId;
  const overview = usePluginOverview(companyId);
  const [companiesLimit, setCompaniesLimit] = useState(20);
  const [projectsLimit, setProjectsLimit] = useState(20);
  const [issuesLimit, setIssuesLimit] = useState(20);
  const [goalsLimit, setGoalsLimit] = useState(20);
  const companies = usePluginData("companies", { limit: companiesLimit });
  const projects = usePluginData("projects", companyId ? { companyId, limit: projectsLimit } : {});
  const issues = usePluginData("issues", companyId ? { companyId, limit: issuesLimit } : {});
  const goals = usePluginData("goals", companyId ? { companyId, limit: goalsLimit } : {});
  const agents = usePluginData("agents", companyId ? { companyId } : {});
  const [issueTitle, setIssueTitle] = useState("Kitchen Sink demo issue");
  const [goalTitle, setGoalTitle] = useState("Kitchen Sink demo goal");
  const [stateScopeKind, setStateScopeKind] = useState("instance");
  const [stateScopeId, setStateScopeId] = useState("");
  const [stateNamespace, setStateNamespace] = useState("");
  const [stateKey, setStateKey] = useState("demo");
  const [stateValue, setStateValue] = useState('{"hello":"world"}');
  const [entityType, setEntityType] = useState("demo-record");
  const [entityTitle, setEntityTitle] = useState("Kitchen Sink Entity");
  const [entityScopeKind, setEntityScopeKind] = useState("instance");
  const [entityScopeId, setEntityScopeId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [httpUrl, setHttpUrl] = useState(DEFAULT_CONFIG.httpDemoUrl);
  const [secretRef, setSecretRef] = useState("");
  const [metricName, setMetricName] = useState("manual");
  const [metricValue, setMetricValue] = useState("1");
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspacePath, setWorkspacePath] = useState(DEFAULT_CONFIG.workspaceScratchFile);
  const [workspaceContent, setWorkspaceContent] = useState("Kitchen Sink wrote this file.");
  const [commandKey, setCommandKey] = useState(SAFE_COMMANDS[0]?.key ?? "pwd");
  const [toolMessage, setToolMessage] = useState("Hello from the Kitchen Sink tool");
  const [toolOutput, setToolOutput] = useState(null);
  const [jobOutput, setJobOutput] = useState(null);
  const [webhookOutput, setWebhookOutput] = useState(null);
  const [result, setResult] = useState(null);
  const stateQuery = usePluginData("state-value", {
    scopeKind: stateScopeKind,
    scopeId: stateScopeId || void 0,
    namespace: stateNamespace || void 0,
    stateKey
  });
  const entityQuery = usePluginData("entities", {
    entityType,
    scopeKind: entityScopeKind,
    scopeId: entityScopeId || void 0,
    limit: 25
  });
  const workspaceQuery = usePluginData(
    "workspaces",
    companyId && selectedProjectId ? { companyId, projectId: selectedProjectId } : {}
  );
  const progressStream = usePluginStream(
    STREAM_CHANNELS.progress,
    companyId ? { companyId } : void 0
  );
  const agentStream = usePluginStream(
    STREAM_CHANNELS.agentChat,
    companyId ? { companyId } : void 0
  );
  const emitDemoEvent = usePluginAction("emit-demo-event");
  const createIssue = usePluginAction("create-issue");
  const advanceIssueStatus = usePluginAction("advance-issue-status");
  const createGoal = usePluginAction("create-goal");
  const advanceGoalStatus = usePluginAction("advance-goal-status");
  const writeScopedState = usePluginAction("write-scoped-state");
  const deleteScopedState = usePluginAction("delete-scoped-state");
  const upsertEntity = usePluginAction("upsert-entity");
  const writeActivity = usePluginAction("write-activity");
  const writeMetric = usePluginAction("write-metric");
  const httpFetch = usePluginAction("http-fetch");
  const resolveSecret = usePluginAction("resolve-secret");
  const runProcess = usePluginAction("run-process");
  const readWorkspaceFile = usePluginAction("read-workspace-file");
  const writeWorkspaceScratch = usePluginAction("write-workspace-scratch");
  const startProgressStream = usePluginAction("start-progress-stream");
  const invokeAgent = usePluginAction("invoke-agent");
  const pauseAgent = usePluginAction("pause-agent");
  const resumeAgent = usePluginAction("resume-agent");
  const askAgent = usePluginAction("ask-agent");
  useEffect2(() => {
    setProjectsLimit(20);
    setIssuesLimit(20);
    setGoalsLimit(20);
  }, [companyId]);
  useEffect2(() => {
    if (!selectedProjectId && projects.data?.[0]?.id) setSelectedProjectId(projects.data[0].id);
  }, [projects.data, selectedProjectId]);
  useEffect2(() => {
    if (!selectedIssueId && issues.data?.[0]?.id) setSelectedIssueId(issues.data[0].id);
  }, [issues.data, selectedIssueId]);
  useEffect2(() => {
    if (!selectedGoalId && goals.data?.[0]?.id) setSelectedGoalId(goals.data[0].id);
  }, [goals.data, selectedGoalId]);
  useEffect2(() => {
    if (!selectedAgentId && agents.data?.[0]?.id) setSelectedAgentId(agents.data[0].id);
  }, [agents.data, selectedAgentId]);
  useEffect2(() => {
    if (!workspaceId && workspaceQuery.data?.[0]?.id) setWorkspaceId(workspaceQuery.data[0].id);
  }, [workspaceId, workspaceQuery.data]);
  const projectRef = selectedProjectId || context.projectId || "";
  async function refreshAll() {
    overview.refresh();
    projects.refresh();
    issues.refresh();
    goals.refresh();
    agents.refresh();
    stateQuery.refresh();
    entityQuery.refresh();
    workspaceQuery.refresh();
  }
  async function executeTool(name) {
    if (!companyId || !selectedAgentId || !projectRef) {
      setToolOutput({ error: "Select a company, project, and agent first." });
      return;
    }
    try {
      const toolName = `${PLUGIN_ID}:${name}`;
      const body = name === TOOL_NAMES.echo ? { message: toolMessage } : name === TOOL_NAMES.createIssue ? { title: issueTitle, description: "Created through the tool dispatcher demo." } : {};
      const response = await hostFetchJson(`/api/plugins/tools/execute`, {
        method: "POST",
        body: JSON.stringify({
          tool: toolName,
          parameters: body,
          runContext: {
            agentId: selectedAgentId,
            runId: `kitchen-sink-${Date.now()}`,
            companyId,
            projectId: projectRef
          }
        })
      });
      setToolOutput(response);
      await refreshAll();
    } catch (error) {
      setToolOutput({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  async function fetchJobsAndTrigger() {
    try {
      const jobsResponse = await hostFetchJson(`/api/plugins/${PLUGIN_ID}/jobs`);
      const job = jobsResponse.find((entry) => entry.jobKey === JOB_KEYS.heartbeat) ?? jobsResponse[0];
      if (!job) {
        setJobOutput({ error: "No plugin jobs returned by the host." });
        return;
      }
      const triggerResult = await hostFetchJson(`/api/plugins/${PLUGIN_ID}/jobs/${job.id}/trigger`, {
        method: "POST"
      });
      setJobOutput({ jobs: jobsResponse, triggerResult });
      overview.refresh();
    } catch (error) {
      setJobOutput({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  async function sendWebhook() {
    try {
      const response = await hostFetchJson(`/api/plugins/${PLUGIN_ID}/webhooks/${WEBHOOK_KEYS.demo}`, {
        method: "POST",
        body: JSON.stringify({
          source: "kitchen-sink-ui",
          sentAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      setWebhookOutput(response);
      overview.refresh();
    } catch (error) {
      setWebhookOutput({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "14px" }, children: [
    /* @__PURE__ */ jsxs(
      Section,
      {
        title: "Overview",
        action: /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => refreshAll(), children: "Refresh" }),
        children: [
          /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
            /* @__PURE__ */ jsx2(Pill, { label: `Plugin: ${overview.data?.pluginId ?? PLUGIN_ID}` }),
            /* @__PURE__ */ jsx2(Pill, { label: `Version: ${overview.data?.version ?? "loading"}` }),
            /* @__PURE__ */ jsx2(Pill, { label: `Company: ${companyId ?? "none"}` }),
            context.entityType ? /* @__PURE__ */ jsx2(Pill, { label: `Entity: ${context.entityType}` }) : null
          ] }),
          overview.data ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }, children: [
              /* @__PURE__ */ jsx2(StatusLine, { label: "Companies", value: overview.data.counts.companies }),
              /* @__PURE__ */ jsx2(StatusLine, { label: "Projects", value: overview.data.counts.projects }),
              /* @__PURE__ */ jsx2(StatusLine, { label: "Issues", value: overview.data.counts.issues }),
              /* @__PURE__ */ jsx2(StatusLine, { label: "Goals", value: overview.data.counts.goals }),
              /* @__PURE__ */ jsx2(StatusLine, { label: "Agents", value: overview.data.counts.agents }),
              /* @__PURE__ */ jsx2(StatusLine, { label: "Entities", value: overview.data.counts.entities })
            ] }),
            /* @__PURE__ */ jsx2(JsonBlock, { value: overview.data.config })
          ] }) : /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.7 }, children: "Loading overview\u2026" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(Section, { title: "UI Surfaces", children: [
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2("a", { href: pluginPagePath(context.companyPrefix), style: { fontSize: "12px" }, children: "Open plugin page" }),
        projectRef ? /* @__PURE__ */ jsx2(
          "a",
          {
            href: hostPath(context.companyPrefix, `/projects/${projectRef}?tab=plugin:${PLUGIN_ID}:${SLOT_IDS.projectTab}`),
            style: { fontSize: "12px" },
            children: "Open project tab"
          }
        ) : null,
        selectedIssueId ? /* @__PURE__ */ jsx2(
          "a",
          {
            href: hostPath(context.companyPrefix, `/issues/${selectedIssueId}`),
            style: { fontSize: "12px" },
            children: "Open selected issue"
          }
        ) : null
      ] }),
      /* @__PURE__ */ jsx2(JsonBlock, { value: overview.data?.runtimeLaunchers ?? [] })
    ] }),
    /* @__PURE__ */ jsx2(Section, { title: "Paperclip Domain APIs", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }, children: [
      /* @__PURE__ */ jsx2(
        PaginatedDomainCard,
        {
          title: "Companies",
          items: companies.data ?? [],
          totalCount: overview.data?.counts.companies ?? null,
          empty: "No companies.",
          onLoadMore: () => setCompaniesLimit((current) => current + 20),
          render: (item) => {
            const company = item;
            return /* @__PURE__ */ jsxs("div", { children: [
              company.name,
              " ",
              /* @__PURE__ */ jsxs("span", { style: { opacity: 0.6 }, children: [
                "(",
                company.id.slice(0, 8),
                ")"
              ] })
            ] });
          }
        }
      ),
      /* @__PURE__ */ jsx2(
        PaginatedDomainCard,
        {
          title: "Projects",
          items: projects.data ?? [],
          totalCount: overview.data?.counts.projects ?? null,
          empty: "No projects.",
          onLoadMore: () => setProjectsLimit((current) => current + 20),
          render: (item) => {
            const project = item;
            return /* @__PURE__ */ jsxs("div", { children: [
              project.name,
              " ",
              /* @__PURE__ */ jsxs("span", { style: { opacity: 0.6 }, children: [
                "(",
                project.status ?? "unknown",
                ")"
              ] })
            ] });
          }
        }
      ),
      /* @__PURE__ */ jsx2(
        PaginatedDomainCard,
        {
          title: "Issues",
          items: issues.data ?? [],
          totalCount: overview.data?.counts.issues ?? null,
          empty: "No issues.",
          onLoadMore: () => setIssuesLimit((current) => current + 20),
          render: (item) => {
            const issue = item;
            return /* @__PURE__ */ jsxs("div", { children: [
              issue.title,
              " ",
              /* @__PURE__ */ jsxs("span", { style: { opacity: 0.6 }, children: [
                "(",
                issue.status,
                ")"
              ] })
            ] });
          }
        }
      ),
      /* @__PURE__ */ jsx2(
        PaginatedDomainCard,
        {
          title: "Goals",
          items: goals.data ?? [],
          totalCount: overview.data?.counts.goals ?? null,
          empty: "No goals.",
          onLoadMore: () => setGoalsLimit((current) => current + 20),
          render: (item) => {
            const goal = item;
            return /* @__PURE__ */ jsxs("div", { children: [
              goal.title,
              " ",
              /* @__PURE__ */ jsxs("span", { style: { opacity: 0.6 }, children: [
                "(",
                goal.status,
                ")"
              ] })
            ] });
          }
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "Issue + Goal Actions", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId) return;
            void createIssue({ companyId, projectId: selectedProjectId || void 0, title: issueTitle }).then((next) => {
              setResult(next);
              return refreshAll();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Create issue" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: issueTitle, onChange: (event) => setIssueTitle(event.target.value) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, disabled: !companyId, children: "Create issue" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedIssueId) return;
            void advanceIssueStatus({ companyId, issueId: selectedIssueId, status: "in_review" }).then((next) => {
              setResult(next);
              return refreshAll();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Advance selected issue" }),
            /* @__PURE__ */ jsx2("select", { style: inputStyle, value: selectedIssueId, onChange: (event) => setSelectedIssueId(event.target.value), children: (issues.data ?? []).map((issue) => /* @__PURE__ */ jsx2("option", { value: issue.id, children: issue.title }, issue.id)) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId || !selectedIssueId, children: "Move to in_review" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId) return;
            void createGoal({ companyId, title: goalTitle }).then((next) => {
              setResult(next);
              return refreshAll();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Create goal" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: goalTitle, onChange: (event) => setGoalTitle(event.target.value) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, disabled: !companyId, children: "Create goal" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedGoalId) return;
            void advanceGoalStatus({ companyId, goalId: selectedGoalId, status: "active" }).then((next) => {
              setResult(next);
              return refreshAll();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Advance selected goal" }),
            /* @__PURE__ */ jsx2("select", { style: inputStyle, value: selectedGoalId, onChange: (event) => setSelectedGoalId(event.target.value), children: (goals.data ?? []).map((goal) => /* @__PURE__ */ jsx2("option", { value: goal.id, children: goal.title }, goal.id)) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId || !selectedGoalId, children: "Move to active" })
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "State + Entities", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            void writeScopedState({
              scopeKind: stateScopeKind,
              scopeId: stateScopeId || void 0,
              namespace: stateNamespace || void 0,
              stateKey,
              value: stateValue
            }).then((next) => {
              setResult(next);
              stateQuery.refresh();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "State" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: stateScopeKind, onChange: (event) => setStateScopeKind(event.target.value), placeholder: "scopeKind" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: stateScopeId, onChange: (event) => setStateScopeId(event.target.value), placeholder: "scopeId (optional)" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: stateNamespace, onChange: (event) => setStateNamespace(event.target.value), placeholder: "namespace (optional)" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: stateKey, onChange: (event) => setStateKey(event.target.value), placeholder: "stateKey" }),
            /* @__PURE__ */ jsx2("textarea", { style: { ...inputStyle, minHeight: "88px" }, value: stateValue, onChange: (event) => setStateValue(event.target.value) }),
            /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
              /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, children: "Write state" }),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => {
                    void deleteScopedState({
                      scopeKind: stateScopeKind,
                      scopeId: stateScopeId || void 0,
                      namespace: stateNamespace || void 0,
                      stateKey
                    }).then((next) => {
                      setResult(next);
                      stateQuery.refresh();
                    }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
                  },
                  children: "Delete state"
                }
              )
            ] }),
            /* @__PURE__ */ jsx2(JsonBlock, { value: stateQuery.data ?? { loading: true } })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            void upsertEntity({
              entityType,
              title: entityTitle,
              scopeKind: entityScopeKind,
              scopeId: entityScopeId || void 0,
              data: JSON.stringify({ createdAt: (/* @__PURE__ */ new Date()).toISOString() })
            }).then((next) => {
              setResult(next);
              entityQuery.refresh();
              overview.refresh();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Entities" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: entityType, onChange: (event) => setEntityType(event.target.value), placeholder: "entityType" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: entityTitle, onChange: (event) => setEntityTitle(event.target.value), placeholder: "title" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: entityScopeKind, onChange: (event) => setEntityScopeKind(event.target.value), placeholder: "scopeKind" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: entityScopeId, onChange: (event) => setEntityScopeId(event.target.value), placeholder: "scopeId (optional)" }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, children: "Upsert entity" }),
            /* @__PURE__ */ jsx2(JsonBlock, { value: entityQuery.data ?? [] })
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(Section, { title: "Events + Streams", children: [
      /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: primaryButtonStyle,
            onClick: () => {
              if (!companyId) return;
              void emitDemoEvent({ companyId, message: "Kitchen Sink manual event" }).then((next) => {
                setResult(next);
                overview.refresh();
              }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
            },
            children: "Emit demo event"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            style: buttonStyle,
            onClick: () => {
              if (!companyId) return;
              void startProgressStream({ companyId, steps: 5 }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
            },
            children: "Start progress stream"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
        /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
          /* @__PURE__ */ jsx2("strong", { children: "Progress stream" }),
          /* @__PURE__ */ jsx2(JsonBlock, { value: progressStream.events.slice(-8) })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: subtleCardStyle, children: [
          /* @__PURE__ */ jsx2("strong", { children: "Recent records" }),
          /* @__PURE__ */ jsx2(JsonBlock, { value: overview.data?.recentRecords ?? [] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx2(Section, { title: "HTTP + Secrets + Activity + Metrics", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            void httpFetch({ url: httpUrl }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "HTTP" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: httpUrl, onChange: (event) => setHttpUrl(event.target.value) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, children: "Fetch URL" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            void resolveSecret({ secretRef }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Secrets" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: secretRef, onChange: (event) => setSecretRef(event.target.value), placeholder: "MY_SECRET_REF" }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, children: "Resolve secret ref" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId) return;
            void writeActivity({ companyId, entityType: context.entityType ?? void 0, entityId: context.entityId ?? void 0 }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Activity + Metrics" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: metricName, onChange: (event) => setMetricName(event.target.value), placeholder: "metric name" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: metricValue, onChange: (event) => setMetricValue(event.target.value), placeholder: "metric value" }),
            /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => {
                    if (!companyId) return;
                    void writeMetric({ companyId, name: metricName, value: Number(metricValue || "1") }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
                  },
                  children: "Write metric"
                }
              ),
              /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId, children: "Write activity" })
            ] })
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "Workspace + Process", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Select project/workspace" }),
        /* @__PURE__ */ jsxs("select", { style: inputStyle, value: selectedProjectId, onChange: (event) => setSelectedProjectId(event.target.value), children: [
          /* @__PURE__ */ jsx2("option", { value: "", children: "Select project" }),
          (projects.data ?? []).map((project) => /* @__PURE__ */ jsx2("option", { value: project.id, children: project.name }, project.id))
        ] }),
        /* @__PURE__ */ jsxs("select", { style: inputStyle, value: workspaceId, onChange: (event) => setWorkspaceId(event.target.value), children: [
          /* @__PURE__ */ jsx2("option", { value: "", children: "Select workspace" }),
          (workspaceQuery.data ?? []).map((workspace) => /* @__PURE__ */ jsx2("option", { value: workspace.id, children: workspace.name }, workspace.id))
        ] }),
        /* @__PURE__ */ jsx2(JsonBlock, { value: workspaceQuery.data ?? [] })
      ] }),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedProjectId) return;
            void writeWorkspaceScratch({
              companyId,
              projectId: selectedProjectId,
              workspaceId: workspaceId || void 0,
              relativePath: workspacePath,
              content: workspaceContent
            }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Workspace file" }),
            /* @__PURE__ */ jsx2("input", { style: inputStyle, value: workspacePath, onChange: (event) => setWorkspacePath(event.target.value) }),
            /* @__PURE__ */ jsx2("textarea", { style: { ...inputStyle, minHeight: "88px" }, value: workspaceContent, onChange: (event) => setWorkspaceContent(event.target.value) }),
            /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
              /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId || !selectedProjectId, children: "Write scratch file" }),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => {
                    if (!companyId || !selectedProjectId) return;
                    void readWorkspaceFile({
                      companyId,
                      projectId: selectedProjectId,
                      workspaceId: workspaceId || void 0,
                      relativePath: workspacePath
                    }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
                  },
                  children: "Read file"
                }
              )
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedProjectId) return;
            void runProcess({
              companyId,
              projectId: selectedProjectId,
              workspaceId: workspaceId || void 0,
              commandKey
            }).then((next) => {
              setResult(next);
              overview.refresh();
            }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Curated process demo" }),
            /* @__PURE__ */ jsx2("select", { style: inputStyle, value: commandKey, onChange: (event) => setCommandKey(event.target.value), children: SAFE_COMMANDS.map((command) => /* @__PURE__ */ jsx2("option", { value: command.key, children: command.label }, command.key)) }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId || !selectedProjectId, children: "Run command" }),
            /* @__PURE__ */ jsx2(JsonBlock, { value: overview.data?.lastProcessResult ?? { note: "No process run yet." } })
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "Agents + Sessions", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedAgentId) return;
            void invokeAgent({ companyId, agentId: selectedAgentId, prompt: "Kitchen Sink invoke demo" }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Agent controls" }),
            /* @__PURE__ */ jsx2("select", { style: inputStyle, value: selectedAgentId, onChange: (event) => setSelectedAgentId(event.target.value), children: (agents.data ?? []).map((agent) => /* @__PURE__ */ jsx2("option", { value: agent.id, children: agent.name }, agent.id)) }),
            /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
              /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, disabled: !companyId || !selectedAgentId, children: "Invoke" }),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => {
                    if (!companyId || !selectedAgentId) return;
                    void pauseAgent({ companyId, agentId: selectedAgentId }).then((next) => {
                      setResult(next);
                      agents.refresh();
                    }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
                  },
                  children: "Pause"
                }
              ),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => {
                    if (!companyId || !selectedAgentId) return;
                    void resumeAgent({ companyId, agentId: selectedAgentId }).then((next) => {
                      setResult(next);
                      agents.refresh();
                    }).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
                  },
                  children: "Resume"
                }
              )
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "form",
        {
          style: layoutStack,
          onSubmit: (event) => {
            event.preventDefault();
            if (!companyId || !selectedAgentId) return;
            void askAgent({ companyId, agentId: selectedAgentId, prompt: "Give a short greeting from the Kitchen Sink plugin." }).then((next) => setResult(next)).catch((error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
          },
          children: [
            /* @__PURE__ */ jsx2("strong", { children: "Agent chat stream" }),
            /* @__PURE__ */ jsx2("button", { type: "submit", style: buttonStyle, disabled: !companyId || !selectedAgentId, children: "Start chat demo" }),
            /* @__PURE__ */ jsx2(JsonBlock, { value: agentStream.events.slice(-12) })
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "Jobs + Webhooks + Tools", children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }, children: [
      /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Job demo" }),
        /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void fetchJobsAndTrigger(), children: "Trigger demo job" }),
        /* @__PURE__ */ jsx2(JsonBlock, { value: jobOutput ?? overview.data?.lastJob ?? { note: "No job output yet." } })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Webhook demo" }),
        /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void sendWebhook(), children: "Send demo webhook" }),
        /* @__PURE__ */ jsx2(JsonBlock, { value: webhookOutput ?? overview.data?.lastWebhook ?? { note: "No webhook yet." } })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Tool dispatcher demo" }),
        /* @__PURE__ */ jsx2("input", { style: inputStyle, value: toolMessage, onChange: (event) => setToolMessage(event.target.value) }),
        /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
          /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void executeTool(TOOL_NAMES.echo), children: "Run echo tool" }),
          /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void executeTool(TOOL_NAMES.companySummary), children: "Run summary tool" }),
          /* @__PURE__ */ jsx2("button", { type: "button", style: buttonStyle, onClick: () => void executeTool(TOOL_NAMES.createIssue), children: "Run create-issue tool" })
        ] }),
        /* @__PURE__ */ jsx2(JsonBlock, { value: toolOutput ?? { note: "No tool output yet." } })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx2(Section, { title: "Latest Result", children: /* @__PURE__ */ jsx2(JsonBlock, { value: result ?? { note: "Run an action to see results here." } }) })
  ] });
}
function KitchenSinkPage({ context }) {
  return /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
    /* @__PURE__ */ jsx2(KitchenSinkPageWidgets, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkEmbeddedApp, { context }),
    /* @__PURE__ */ jsx2(KitchenSinkConsole, { context })
  ] });
}
function KitchenSinkSettingsPage({ context }) {
  const { configJson, setConfigJson, loading, saving, error, save } = useSettingsConfig();
  const [savedMessage, setSavedMessage] = useState(null);
  function setField(key, value) {
    setConfigJson((current) => ({ ...current, [key]: value }));
  }
  async function onSubmit(event) {
    event.preventDefault();
    await save(configJson);
    setSavedMessage("Saved");
    window.setTimeout(() => setSavedMessage(null), 1500);
  }
  if (loading) {
    return /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.7 }, children: "Loading plugin config\u2026" });
  }
  return /* @__PURE__ */ jsxs("form", { onSubmit, style: { display: "grid", gap: "18px" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px", gridTemplateColumns: "minmax(0, 1.8fr) minmax(220px, 1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "8px" }, children: [
        /* @__PURE__ */ jsx2("strong", { children: "About" }),
        /* @__PURE__ */ jsx2("div", { style: { fontSize: "13px", lineHeight: 1.5 }, children: "Kitchen Sink demonstrates the current Paperclip plugin API surface in one local, trusted example. It intentionally includes domain mutations, event handling, streams, tools, jobs, webhooks, and local workspace/process demos." }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", opacity: 0.7 }, children: [
          "Current company context: ",
          context.companyId ?? "none"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "8px" }, children: [
        /* @__PURE__ */ jsx2("strong", { children: "Danger / Trust Model" }),
        /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", lineHeight: 1.5 }, children: "Workspace and process demos run as trusted local code. Keep process demos off unless you explicitly want to exercise local child process behavior." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "12px" }, children: [
      /* @__PURE__ */ jsx2("strong", { children: "Settings" }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.showSidebarEntry !== false,
            onChange: (event) => setField("showSidebarEntry", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Show sidebar entry" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.showSidebarPanel !== false,
            onChange: (event) => setField("showSidebarPanel", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Show sidebar panel" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.showProjectSidebarItem !== false,
            onChange: (event) => setField("showProjectSidebarItem", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Show project sidebar item" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.showCommentAnnotation !== false,
            onChange: (event) => setField("showCommentAnnotation", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Show comment annotation" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.showCommentContextMenuItem !== false,
            onChange: (event) => setField("showCommentContextMenuItem", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Show comment context action" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.enableWorkspaceDemos !== false,
            onChange: (event) => setField("enableWorkspaceDemos", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Enable workspace demos" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: rowStyle, children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "checkbox",
            checked: configJson.enableProcessDemos === true,
            onChange: (event) => setField("enableProcessDemos", event.target.checked)
          }
        ),
        /* @__PURE__ */ jsx2("span", { children: "Enable curated process demos" })
      ] }),
      /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: "6px" }, children: [
        /* @__PURE__ */ jsx2("span", { style: { fontSize: "12px" }, children: "HTTP demo URL" }),
        /* @__PURE__ */ jsx2(
          "input",
          {
            style: inputStyle,
            value: String(configJson.httpDemoUrl ?? DEFAULT_CONFIG.httpDemoUrl),
            onChange: (event) => setField("httpDemoUrl", event.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: "6px" }, children: [
        /* @__PURE__ */ jsx2("span", { style: { fontSize: "12px" }, children: "Secret reference example" }),
        /* @__PURE__ */ jsx2(
          "input",
          {
            style: inputStyle,
            value: String(configJson.secretRefExample ?? ""),
            onChange: (event) => setField("secretRefExample", event.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: "6px" }, children: [
        /* @__PURE__ */ jsx2("span", { style: { fontSize: "12px" }, children: "Workspace scratch file" }),
        /* @__PURE__ */ jsx2(
          "input",
          {
            style: inputStyle,
            value: String(configJson.workspaceScratchFile ?? DEFAULT_CONFIG.workspaceScratchFile),
            onChange: (event) => setField("workspaceScratchFile", event.target.value)
          }
        )
      ] })
    ] }),
    error ? /* @__PURE__ */ jsx2("div", { style: { color: "var(--destructive, #c00)", fontSize: "12px" }, children: error }) : null,
    /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
      /* @__PURE__ */ jsx2("button", { type: "submit", style: primaryButtonStyle, disabled: saving, children: saving ? "Saving\u2026" : "Save settings" }),
      savedMessage ? /* @__PURE__ */ jsx2("span", { style: { fontSize: "12px", opacity: 0.7 }, children: savedMessage }) : null
    ] })
  ] });
}
function KitchenSinkDashboardWidget({ context }) {
  const overview = usePluginOverview(context.companyId);
  const writeMetric = usePluginAction("write-metric");
  return /* @__PURE__ */ jsxs("div", { style: layoutStack, children: [
    /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
      /* @__PURE__ */ jsx2("strong", { children: "Kitchen Sink" }),
      /* @__PURE__ */ jsx2(Pill, { label: "dashboardWidget" })
    ] }),
    /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.7 }, children: "Plugin runtime surface demo for the current company." }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "4px", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        "Recent records: ",
        overview.data?.recentRecords.length ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Projects: ",
        overview.data?.counts.projects ?? 0
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        "Issues: ",
        overview.data?.counts.issues ?? 0
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
      /* @__PURE__ */ jsx2("a", { href: pluginPagePath(context.companyPrefix), style: { fontSize: "12px" }, children: "Open page" }),
      /* @__PURE__ */ jsx2(
        "button",
        {
          type: "button",
          style: buttonStyle,
          onClick: () => {
            if (!context.companyId) return;
            void writeMetric({ companyId: context.companyId, name: "dashboard_click", value: 1 }).catch(console.error);
          },
          children: "Write metric"
        }
      )
    ] })
  ] });
}
function KitchenSinkSidebarLink({ context }) {
  const config = usePluginConfigData();
  if (config.data && config.data.showSidebarEntry === false) return null;
  const href = pluginPagePath(context.companyPrefix);
  const isActive = typeof window !== "undefined" && window.location.pathname === href;
  return /* @__PURE__ */ jsxs(
    "a",
    {
      href,
      "aria-current": isActive ? "page" : void 0,
      className: [
        "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors",
        isActive ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
      ].join(" "),
      children: [
        /* @__PURE__ */ jsx2("span", { className: "relative shrink-0", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", className: "h-4 w-4", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx2("rect", { x: "4", y: "4", width: "7", height: "7", rx: "1.5" }),
          /* @__PURE__ */ jsx2("rect", { x: "13", y: "4", width: "7", height: "7", rx: "1.5" }),
          /* @__PURE__ */ jsx2("rect", { x: "4", y: "13", width: "7", height: "7", rx: "1.5" }),
          /* @__PURE__ */ jsx2("path", { d: "M13 16.5h7" }),
          /* @__PURE__ */ jsx2("path", { d: "M16.5 13v7" })
        ] }) }),
        /* @__PURE__ */ jsx2("span", { className: "flex-1 truncate", children: "Kitchen Sink" })
      ]
    }
  );
}
function KitchenSinkSidebarPanel() {
  const context = useHostContext();
  const config = usePluginConfigData();
  const overview = usePluginOverview(context.companyId);
  if (config.data && config.data.showSidebarPanel === false) return null;
  return /* @__PURE__ */ jsxs("div", { style: { ...layoutStack, ...subtleCardStyle, fontSize: "12px" }, children: [
    /* @__PURE__ */ jsx2("strong", { children: "Kitchen Sink Panel" }),
    /* @__PURE__ */ jsxs("div", { children: [
      "Recent plugin records: ",
      overview.data?.recentRecords.length ?? 0
    ] }),
    /* @__PURE__ */ jsx2("a", { href: pluginPagePath(context.companyPrefix), children: "Open plugin page" })
  ] });
}
function KitchenSinkProjectSidebarItem({ context }) {
  const config = usePluginConfigData();
  if (config.data && config.data.showProjectSidebarItem === false) return null;
  return /* @__PURE__ */ jsx2(
    "a",
    {
      href: hostPath(context.companyPrefix, `/projects/${context.entityId}?tab=plugin:${PLUGIN_ID}:${SLOT_IDS.projectTab}`),
      style: { fontSize: "12px", textDecoration: "none" },
      children: "Kitchen Sink"
    }
  );
}
function KitchenSinkProjectTab({ context }) {
  return /* @__PURE__ */ jsx2(CompactSurfaceSummary, { label: "Project Detail Tab", entityType: "project" });
}
function KitchenSinkIssueTab({ context }) {
  return /* @__PURE__ */ jsx2(CompactSurfaceSummary, { label: "Issue Detail Tab", entityType: "issue" });
}
function KitchenSinkTaskDetailView() {
  return /* @__PURE__ */ jsx2(CompactSurfaceSummary, { label: "Task Detail View", entityType: "issue" });
}
function KitchenSinkToolbarButton() {
  const context = useHostContext();
  const startProgress = usePluginAction("start-progress-stream");
  return /* @__PURE__ */ jsx2(
    "button",
    {
      type: "button",
      style: buttonStyle,
      onClick: () => {
        if (!context.companyId) return;
        void startProgress({ companyId: context.companyId, steps: 3 }).catch(console.error);
      },
      children: "Kitchen Sink Action"
    }
  );
}
function KitchenSinkContextMenuItem() {
  const context = useHostContext();
  const writeActivity = usePluginAction("write-activity");
  return /* @__PURE__ */ jsx2(
    "button",
    {
      type: "button",
      style: buttonStyle,
      onClick: () => {
        if (!context.companyId) return;
        void writeActivity({
          companyId: context.companyId,
          entityType: context.entityType ?? void 0,
          entityId: context.entityId ?? void 0,
          message: "Kitchen Sink context action clicked"
        }).catch(console.error);
      },
      children: "Kitchen Sink Context"
    }
  );
}
function KitchenSinkCommentAnnotation({ context }) {
  const config = usePluginConfigData();
  const data = usePluginData(
    "comment-context",
    context.companyId ? { companyId: context.companyId, issueId: context.parentEntityId, commentId: context.entityId } : {}
  );
  if (config.data && config.data.showCommentAnnotation === false) return null;
  if (!data.data) return null;
  return /* @__PURE__ */ jsxs("div", { style: { ...subtleCardStyle, fontSize: "11px" }, children: [
    /* @__PURE__ */ jsx2("strong", { children: "Kitchen Sink" }),
    /* @__PURE__ */ jsxs("div", { children: [
      "Comment length: ",
      data.data.length
    ] }),
    /* @__PURE__ */ jsxs("div", { children: [
      "Copied count: ",
      data.data.copiedCount
    ] }),
    /* @__PURE__ */ jsx2("div", { style: { opacity: 0.75 }, children: data.data.preview })
  ] });
}
function KitchenSinkCommentContextMenuItem({ context }) {
  const config = usePluginConfigData();
  const copyCommentContext = usePluginAction("copy-comment-context");
  const [status, setStatus] = useState(null);
  if (config.data && config.data.showCommentContextMenuItem === false) return null;
  return /* @__PURE__ */ jsxs("div", { style: rowStyle, children: [
    /* @__PURE__ */ jsx2(
      "button",
      {
        type: "button",
        style: buttonStyle,
        onClick: () => {
          if (!context.companyId) return;
          void copyCommentContext({
            companyId: context.companyId,
            issueId: context.parentEntityId,
            commentId: context.entityId
          }).then(() => setStatus("Copied")).catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
        },
        children: "Copy To Kitchen Sink"
      }
    ),
    status ? /* @__PURE__ */ jsx2("span", { style: { fontSize: "11px", opacity: 0.7 }, children: status }) : null
  ] });
}
function KitchenSinkLauncherModal() {
  const context = useHostContext();
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "10px" }, children: [
    /* @__PURE__ */ jsx2("strong", { children: "Kitchen Sink Launcher Modal" }),
    /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.7 }, children: "This export exists so launcher infrastructure has a concrete modal target." }),
    /* @__PURE__ */ jsx2(JsonBlock, { value: context.renderEnvironment ?? { note: "No render environment metadata." } })
  ] });
}
export {
  KitchenSinkCommentAnnotation,
  KitchenSinkCommentContextMenuItem,
  KitchenSinkContextMenuItem,
  KitchenSinkDashboardWidget,
  KitchenSinkIssueTab,
  KitchenSinkLauncherModal,
  KitchenSinkPage,
  KitchenSinkProjectSidebarItem,
  KitchenSinkProjectTab,
  KitchenSinkSettingsPage,
  KitchenSinkSidebarLink,
  KitchenSinkSidebarPanel,
  KitchenSinkTaskDetailView,
  KitchenSinkToolbarButton
};
//# sourceMappingURL=index.js.map
