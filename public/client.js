// Generated from src/client; edit the source modules, then run npm run build.
window.__ModuleLoader__.load({
  id: "dsh-feed-the-seek",
  factory: function(require) {
    const module = { exports: {} };
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  SettingsSection: () => SettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var React7 = __toESM(require("react"), 1);

// src/client/components.tsx
var React = __toESM(require("react"), 1);

// src/client/api.ts
async function request(endpoint, body, token, signal) {
  const options = { cache: "no-store", signal };
  if (body !== void 0) {
    options.method = "POST";
    options.headers = { "content-type": "application/json", "x-yuwen-token": token || "" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch("/fish-brain/api/" + endpoint, options);
  const responseText = await response.text();
  if (!responseText.trim()) {
    throw new Error(
      `\u8BB0\u5FC6\u670D\u52A1\u672A\u8FD4\u56DE\u6570\u636E\uFF08HTTP ${response.status}\uFF09\u3002\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00 DSH \u540E\u91CD\u8BD5\u3002`
    );
  }
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new Error(`\u8BB0\u5FC6\u670D\u52A1\u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002\u8BF7\u91CD\u542F DSH \u540E\u91CD\u8BD5\u3002`);
  }
  if (!response.ok) {
    throw new Error(responseData?.error || `\u8BB0\u5FC6\u670D\u52A1\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
  }
  return responseData;
}
function projectLabel(projectPath) {
  return projectPath.split(/[\\/]/).filter(Boolean).at(-1) || "\u65E0\u9879\u76EE";
}
function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "\u65F6\u95F4\u672A\u77E5";
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

// src/mood.ts
var MIN_DWELL_MS = 10 * 6e4;

// src/client/components.tsx
var memoryKindLabels = {
  cognition: "\u77E5\u9053\u7684\u4E8B",
  experience: "\u4E00\u8D77\u7ECF\u5386\u7684",
  resonance: "\u6211\u4EEC\u4E4B\u95F4",
  self: "\u5173\u4E8E\u6211\u81EA\u5DF1"
};
var selfKindLabels = {
  behavior: "\u89C2\u5BDF\u5230\u7684\u884C\u4E3A",
  feedback: "\u4F60\u7684\u53CD\u9988",
  intention: "\u6211\u7684\u6253\u7B97 \xB7 \u8FD8\u6CA1\u505A\u5230",
  claim: "\u6211\u81EA\u5DF1\u8BF4\u7684 \xB7 \u672A\u9A8C\u8BC1",
  verified: "\u5DF2\u9A8C\u8BC1\u7684\u6539\u53D8"
};
var durabilityLabels = {
  situational: "\u4EC5\u9650\u60C5\u5883",
  habit: "\u4E60\u60EF",
  lasting: "\u957F\u671F"
};
function displayName(name) {
  return !name || name === "\u521D\u59CB\u5B9E\u4F8B" || name === "\u521D\u59CB\u4F19\u4F34" ? "\u8FD8\u6CA1\u6709\u540D\u5B57\u7684\u5979" : name;
}
var pixelGlyphs = {
  fish: [
    "............",
    "...####.....",
    "..######..##",
    ".########.##",
    "##.#######.#",
    "##########..",
    "##########..",
    ".##########.",
    "..######..##",
    "...####...##",
    "............",
    "............"
  ],
  overview: [
    "............",
    ".####..####.",
    ".####..####.",
    ".####..####.",
    ".####..####.",
    "............",
    "............",
    ".####..####.",
    ".####..####.",
    ".####..####.",
    ".####..####.",
    "............"
  ],
  memories: [
    "............",
    ".#########..",
    ".#.......#..",
    ".#.#####.#..",
    ".#.......#..",
    ".#.#####.#..",
    ".#.......#..",
    ".#.###...#..",
    ".#.......#..",
    ".#########..",
    "..#########.",
    "............"
  ],
  settings: [
    ".....##.....",
    "..#.####.#..",
    ".##########.",
    "..###..###..",
    ".###....###.",
    "####....####",
    "####....####",
    ".###....###.",
    "..###..###..",
    ".##########.",
    "..#.####.#..",
    ".....##....."
  ],
  refresh: [
    "............",
    "....####.#..",
    "..##....##..",
    ".#.....###..",
    ".#..........",
    "#...........",
    "#...........",
    ".#.......#..",
    ".#.......#..",
    "..##....#...",
    "....####....",
    "............"
  ],
  cognition: [
    ".....##.....",
    "....#..#....",
    "...#....#...",
    "..#......#..",
    ".#........#.",
    "#....##....#",
    "#....##....#",
    ".#........#.",
    "..#......#..",
    "...#....#...",
    "....#..#....",
    ".....##....."
  ],
  experience: [
    "............",
    ".##########.",
    ".#........#.",
    ".#.######.#.",
    ".#........#.",
    ".#.######.#.",
    ".#........#.",
    ".#.####...#.",
    ".#........#.",
    ".##########.",
    "............",
    "............"
  ],
  resonance: [
    "............",
    ".###...###..",
    "#####.#####.",
    "###########.",
    "###########.",
    ".#########..",
    "..#######...",
    "...#####....",
    "....###.....",
    ".....#......",
    "............",
    "............"
  ],
  self: [
    ".....#......",
    ".....#......",
    "....###.....",
    "....###.....",
    ".#########..",
    "...#####....",
    "....###.....",
    "....#.#.....",
    "...#...#....",
    "..#.....#...",
    "............",
    "............"
  ],
  search: [
    "............",
    "..####......",
    ".#....#.....",
    "#......#....",
    "#......#....",
    "#......#....",
    "#......#....",
    ".#....#.....",
    "..#####.....",
    "......###...",
    ".......###..",
    "........##.."
  ],
  download: [
    ".....##.....",
    ".....##.....",
    ".....##.....",
    ".....##.....",
    "..########..",
    "...######...",
    "....####....",
    ".....##.....",
    "............",
    "#..........#",
    "#..........#",
    "############"
  ],
  close: [
    "............",
    ".##......##.",
    "..##....##..",
    "...##..##...",
    "....####....",
    ".....##.....",
    "....####....",
    "...##..##...",
    "..##....##..",
    ".##......##.",
    "............",
    "............"
  ]
};
var glyphPaths = Object.fromEntries(
  Object.entries(pixelGlyphs).map(([name, rows]) => [
    name,
    rows.flatMap(
      (row, y) => [...row].map((cell, x) => cell === "#" ? `M${x} ${y}h1v1h-1z` : "")
    ).join("")
  ])
);
function PixelIcon({
  name,
  size = 12,
  className
}) {
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      className: "fish-icon" + (className ? " " + className : ""),
      width: size,
      height: size,
      viewBox: "0 0 12 12",
      shapeRendering: "crispEdges",
      "aria-hidden": "true",
      focusable: "false"
    },
    /* @__PURE__ */ React.createElement("path", { d: glyphPaths[name], fill: "currentColor" })
  );
}
function EmptyState({ title, children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "fish-empty" }, /* @__PURE__ */ React.createElement(PixelIcon, { name: "cognition", size: 36, className: "fish-empty-icon" }), /* @__PURE__ */ React.createElement("strong", null, title), children && /* @__PURE__ */ React.createElement("p", null, children));
}
function Toggle({
  label,
  description,
  checked,
  disabled,
  pending,
  onChange
}) {
  return /* @__PURE__ */ React.createElement("label", { className: "fish-toggle-row", "data-checked": checked, "aria-busy": pending || void 0 }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, label), description && /* @__PURE__ */ React.createElement("small", null, description)), /* @__PURE__ */ React.createElement("span", { className: "fish-switch" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      role: "switch",
      checked,
      disabled,
      onChange: (event) => onChange(event.target.checked)
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "fish-switch-track", "aria-hidden": "true" })));
}
function PixelMeter({ value, label }) {
  const filled = Math.max(0, Math.min(5, Math.round(value * 5)));
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      className: "fish-meter",
      role: "img",
      "aria-label": `${label} ${Math.round(value * 100)}%`,
      title: `${label} ${Math.round(value * 100)}%`
    },
    Array.from({ length: 5 }, (_, index) => /* @__PURE__ */ React.createElement("i", { key: index, "data-on": index < filled }))
  );
}
function MemoryCard({
  memory,
  state,
  compact = false,
  isNew = false,
  index = 0,
  footer
}) {
  const related = (state.associations || []).filter((association) => association.from === memory.id).map((association) => ({
    association,
    memory: state.memories.find((candidate) => candidate.id === association.to)
  })).filter((entry) => entry.memory?.status === "active");
  return /* @__PURE__ */ React.createElement(
    "article",
    {
      className: `fish-memory-card fish-kind-border-${memory.kind}` + (isNew ? " is-new" : ""),
      style: { "--fish-index": Math.min(index, 8) }
    },
    /* @__PURE__ */ React.createElement("div", { className: "fish-record-meta" }, /* @__PURE__ */ React.createElement("span", { className: `fish-kind fish-kind-${memory.kind}` }, memoryKindLabels[memory.kind]), /* @__PURE__ */ React.createElement("span", null, memory.evidence === "explicit" ? "\u4F60\u4EB2\u53E3\u8BF4\u7684" : "\u6211\u731C\u7684"), isNew && /* @__PURE__ */ React.createElement("span", { className: "fish-new-badge" }, "\u65B0"), /* @__PURE__ */ React.createElement("span", { className: "fish-record-meta-end" }, typeof memory.activation === "number" && /* @__PURE__ */ React.createElement(PixelMeter, { value: memory.activation, label: "\u5370\u8C61\u6DF1\u6D45" }), /* @__PURE__ */ React.createElement("time", { dateTime: memory.updatedAt }, dateLabel(memory.updatedAt)))),
    /* @__PURE__ */ React.createElement("p", null, memory.text),
    !compact && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "fish-tags" }, memory.knowledge.domain && /* @__PURE__ */ React.createElement("span", null, memory.knowledge.domain), memory.knowledge.edition && /* @__PURE__ */ React.createElement("span", null, "\u7248\u672C ", memory.knowledge.edition), memory.scope.project && /* @__PURE__ */ React.createElement("span", { title: memory.scope.project }, projectLabel(memory.scope.project)), memory.kind === "self" && memory.selfKind && /* @__PURE__ */ React.createElement("span", { "data-unverified": memory.selfKind === "claim" || memory.selfKind === "intention" || void 0 }, selfKindLabels[memory.selfKind]), memory.durability && memory.durability !== "turn" && /* @__PURE__ */ React.createElement("span", null, durabilityLabels[memory.durability]), typeof memory.confidence === "number" && /* @__PURE__ */ React.createElement("span", null, "\u628A\u63E1 ", Math.round(memory.confidence * 100), "%")), memory.knowledge.conditions && /* @__PURE__ */ React.createElement("p", { className: "fish-muted" }, "\u9002\u7528\u6761\u4EF6\uFF1A", memory.knowledge.conditions), related.length > 0 && /* @__PURE__ */ React.createElement("details", { className: "fish-source fish-related" }, /* @__PURE__ */ React.createElement("summary", null, "\u76F8\u5173\u7684\u8BB0\u5FC6 \xB7 ", related.length), /* @__PURE__ */ React.createElement("div", { className: "fish-fold-body" }, related.map((entry) => /* @__PURE__ */ React.createElement("blockquote", { key: entry.association.to }, /* @__PURE__ */ React.createElement("p", null, entry.memory.text), /* @__PURE__ */ React.createElement("small", null, entry.association.reasons.map(
      (reason) => reason.startsWith("\u5171\u540C\u6765\u6E90\uFF1A") ? "\u540C\u4E00\u6761\u5BF9\u8BDD\u6765\u6E90" : reason
    ).join(" \xB7 ")))))), /* @__PURE__ */ React.createElement("details", { className: "fish-source" }, /* @__PURE__ */ React.createElement("summary", null, "\u5F53\u65F6\u7684\u539F\u8BDD", memory.version > 1 ? ` \xB7 \u6539\u8FC7 ${memory.version - 1} \u6B21` : ""), /* @__PURE__ */ React.createElement("div", { className: "fish-fold-body" }, memory.sources.map((sourceId) => {
      const source = state.sources[sourceId];
      if (!source) {
        return null;
      }
      return /* @__PURE__ */ React.createElement("blockquote", { key: sourceId }, /* @__PURE__ */ React.createElement("p", null, source.text), /* @__PURE__ */ React.createElement("small", null, dateLabel(source.at), " \xB7 ", source.session));
    })))),
    footer
  );
}
function useNewMemoryIds(state) {
  const seenRef = React.useRef(null);
  const timerRef = React.useRef(void 0);
  const [fresh, setFresh] = React.useState(() => /* @__PURE__ */ new Set());
  const ids = state.memories.map((memory) => `${memory.id}:${memory.version}`).join("|");
  React.useEffect(() => {
    const current = new Set(state.memories.map((memory) => `${memory.id}:${memory.version}`));
    const seen = seenRef.current;
    seenRef.current = { persona: state.scope.persona, ids: current };
    if (!seen || seen.persona !== state.scope.persona) {
      return;
    }
    const added = [...current].filter((key) => !seen.ids.has(key)).map((key) => key.slice(0, key.lastIndexOf(":")));
    if (added.length > 0) {
      clearTimeout(timerRef.current);
      setFresh(new Set(added));
      timerRef.current = setTimeout(() => setFresh(/* @__PURE__ */ new Set()), 6e3);
    }
  }, [ids, state.scope.persona]);
  React.useEffect(() => () => clearTimeout(timerRef.current), []);
  return fresh;
}

// src/client/memory-panel.tsx
var React2 = __toESM(require("react"), 1);
var PAGE_SIZE = 30;
var actionLabels = {
  ADD: "\u8BB0\u4F4F\u4E86",
  UPDATE: "\u66F4\u65B0\u4E86",
  DELETE: "\u4E0D\u518D\u4F5C\u6570",
  MIGRATE: "\u65E7\u683C\u5F0F\u8F6C\u6362",
  CONSOLIDATE: "\u6210\u4E3A\u6027\u683C",
  MERGE: "\u5408\u5E76"
};
function MemoryPanel({
  state,
  selectedKind,
  onSelectKind,
  newMemoryIds,
  notify
}) {
  const [filterText, setFilterText] = React2.useState("");
  const [visibleCount, setVisibleCount] = React2.useState(PAGE_SIZE);
  const [query, setQuery] = React2.useState("");
  const [project, setProject] = React2.useState("");
  const [recallResult, setRecallResult] = React2.useState(null);
  const [isSearching, setIsSearching] = React2.useState(false);
  const [isExporting, setIsExporting] = React2.useState(false);
  const [errorMessage, setErrorMessage] = React2.useState("");
  const controllerRef = React2.useRef(null);
  const memories = state.memories.filter((memory) => memory.status === "active");
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredMemories = memories.filter((memory) => selectedKind === "all" || memory.kind === selectedKind).filter(
    (memory) => !normalizedFilter || [memory.text, memory.knowledge.domain, memory.knowledge.conditions, ...memory.tags].join(" ").toLowerCase().includes(normalizedFilter)
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const projects = [
    .../* @__PURE__ */ new Set([
      "",
      ...state.sessions.map((session) => session.project),
      ...memories.map((memory) => memory.scope.project)
    ])
  ];
  React2.useEffect(() => {
    setRecallResult(null);
  }, [state.revision]);
  React2.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedKind, normalizedFilter]);
  React2.useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );
  async function searchMemories(event) {
    event.preventDefault();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSearching(true);
    setErrorMessage("");
    try {
      const result = await request(
        "recall",
        {
          query,
          scope: { ...state.scope, project }
        },
        state.token,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setRecallResult(result);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(error instanceof Error ? error.message : "\u68C0\u7D22\u5931\u8D25");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }
  async function exportMemories() {
    setIsExporting(true);
    setErrorMessage("");
    try {
      const data = await request("export", { scope: state.scope }, state.token);
      const persona = state.personas.find((entry) => entry.id === state.scope.persona);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dsh-feed-the-seek-memory-${persona?.name || state.scope.persona}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
      notify("\u5DF2\u5BFC\u51FA\u8BB0\u5FC6\u8BB0\u5F55");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "\u5BFC\u51FA\u5931\u8D25");
    } finally {
      setIsExporting(false);
    }
  }
  const kindCounts = Object.fromEntries(
    Object.keys(memoryKindLabels).map((kind) => [
      kind,
      memories.filter((memory) => memory.kind === kind).length
    ])
  );
  return /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("div", { className: "fish-section-heading" }, /* @__PURE__ */ React2.createElement("h3", null, "\u6211\u8BB0\u5F97\u7684\u4E8B"), /* @__PURE__ */ React2.createElement("div", { className: "fish-heading-actions" }, /* @__PURE__ */ React2.createElement("span", { className: "fish-tag", title: "\u8FD9\u91CC\u53EA\u80FD\u770B\uFF1B\u60F3\u7EA0\u6B63\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u544A\u8BC9\u6211" }, "\u60F3\u6539\u5C31\u76F4\u63A5\u544A\u8BC9\u6211"), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      className: "fish-button fish-button-small",
      disabled: isExporting || memories.length === 0,
      onClick: () => void exportMemories()
    },
    /* @__PURE__ */ React2.createElement(PixelIcon, { name: "download" }),
    isExporting ? "\u5BFC\u51FA\u4E2D\u2026" : "\u5BFC\u51FA"
  ))), /* @__PURE__ */ React2.createElement("div", { className: "fish-list-controls" }, /* @__PURE__ */ React2.createElement("div", { className: "fish-filters", role: "group", "aria-label": "\u8BB0\u5FC6\u5206\u7C7B" }, /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": selectedKind === "all",
      onClick: () => onSelectKind("all")
    },
    "\u5168\u90E8 ",
    memories.length
  ), Object.entries(memoryKindLabels).map(([kind, label]) => /* @__PURE__ */ React2.createElement(
    "button",
    {
      key: kind,
      type: "button",
      className: `fish-filter-${kind}`,
      "aria-pressed": selectedKind === kind,
      onClick: () => onSelectKind(kind)
    },
    label,
    " ",
    kindCounts[kind]
  ))), /* @__PURE__ */ React2.createElement("label", { className: "fish-filter-input" }, /* @__PURE__ */ React2.createElement(PixelIcon, { name: "search" }), /* @__PURE__ */ React2.createElement(
    "input",
    {
      type: "search",
      value: filterText,
      placeholder: "\u7B5B\u9009\u6587\u5B57\u3001\u9886\u57DF\u3001\u6807\u7B7E",
      "aria-label": "\u7B5B\u9009\u8BB0\u5FC6",
      onChange: (event) => setFilterText(event.target.value)
    }
  ))), filteredMemories.length === 0 && (normalizedFilter ? /* @__PURE__ */ React2.createElement(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6" }, "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u5728\u4E0B\u65B9\u7528\u8BED\u4E49\u68C0\u7D22\u8BD5\u8BD5\u3002") : /* @__PURE__ */ React2.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u4F4F\u4EC0\u4E48" }, "\u804A\u8FC7\u4E4B\u540E\uFF0C\u6211\u8BB0\u4F4F\u7684\u4E8B\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002")), /* @__PURE__ */ React2.createElement("div", { className: "fish-record-list" }, filteredMemories.slice(0, visibleCount).map((memory, index) => /* @__PURE__ */ React2.createElement(
    MemoryCard,
    {
      key: memory.id,
      memory,
      state,
      index,
      isNew: newMemoryIds.has(memory.id)
    }
  ))), filteredMemories.length > visibleCount && /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      className: "fish-button fish-load-more",
      onClick: () => setVisibleCount((count) => count + PAGE_SIZE)
    },
    "\u518D\u663E\u793A ",
    Math.min(PAGE_SIZE, filteredMemories.length - visibleCount),
    " \u6761 \xB7 \u5269\u4F59",
    " ",
    filteredMemories.length - visibleCount
  ), /* @__PURE__ */ React2.createElement("details", { className: "fish-fold" }, /* @__PURE__ */ React2.createElement("summary", null, "\u6211\u4F1A\u60F3\u8D77\u4EC0\u4E48 ", /* @__PURE__ */ React2.createElement("span", null, "\u8BF4\u4E00\u53E5\u8BDD\u8BD5\u8BD5")), /* @__PURE__ */ React2.createElement("div", { className: "fish-fold-body" }, /* @__PURE__ */ React2.createElement("form", { className: "fish-form fish-search-form", onSubmit: searchMemories }, /* @__PURE__ */ React2.createElement("label", null, "\u8303\u56F4", /* @__PURE__ */ React2.createElement("select", { value: project, onChange: (event) => setProject(event.target.value) }, projects.map((projectPath) => /* @__PURE__ */ React2.createElement("option", { key: projectPath, value: projectPath }, projectPath ? projectLabel(projectPath) : "\u4E0D\u9650\u9879\u76EE")))), /* @__PURE__ */ React2.createElement("label", null, "\u5185\u5BB9", /* @__PURE__ */ React2.createElement(
    "input",
    {
      value: query,
      maxLength: 4e3,
      required: true,
      placeholder: "\u4F8B\u5982\uFF1A\u56DE\u58F0\u6212\u6307\u6709\u4EC0\u4E48\u6548\u679C\uFF1F",
      onChange: (event) => setQuery(event.target.value)
    }
  )), /* @__PURE__ */ React2.createElement(
    "button",
    {
      className: "fish-button fish-button-primary",
      disabled: isSearching,
      "aria-busy": isSearching || void 0,
      type: "submit"
    },
    isSearching ? "\u68C0\u7D22\u4E2D\u2026" : "\u68C0\u7D22"
  )), errorMessage && /* @__PURE__ */ React2.createElement("p", { role: "alert", className: "fish-error" }, errorMessage), recallResult && /* @__PURE__ */ React2.createElement("div", { className: "fish-search-result" }, /* @__PURE__ */ React2.createElement("p", { className: "fish-muted" }, recallResult.note, " \xB7 \u547D\u4E2D ", recallResult.items.length, " \u6761"), recallResult.items.length === 0 && /* @__PURE__ */ React2.createElement(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u9002\u7528\u7684\u8BB0\u5FC6" }), recallResult.items.map((item, index) => /* @__PURE__ */ React2.createElement(
    MemoryCard,
    {
      key: item.memory.id,
      memory: item.memory,
      state,
      compact: true,
      index,
      footer: /* @__PURE__ */ React2.createElement("div", { className: "fish-recall-why" }, /* @__PURE__ */ React2.createElement("span", { className: "fish-score" }, item.score.toFixed(2)), item.reasons.map((reason) => /* @__PURE__ */ React2.createElement("span", { key: reason }, reason)))
    }
  )), recallResult.context && /* @__PURE__ */ React2.createElement("details", { className: "fish-source" }, /* @__PURE__ */ React2.createElement("summary", null, "\u539F\u6587"), /* @__PURE__ */ React2.createElement("pre", null, recallResult.context))))), /* @__PURE__ */ React2.createElement("details", { className: "fish-fold" }, /* @__PURE__ */ React2.createElement("summary", null, "\u8BB0\u5FC6\u7684\u53D8\u5316 ", /* @__PURE__ */ React2.createElement("span", null, state.history.length, " \u6761")), /* @__PURE__ */ React2.createElement("div", { className: "fish-fold-body" }, state.history.length === 0 && /* @__PURE__ */ React2.createElement("p", { className: "fish-muted" }, "\u5C1A\u65E0\u53D8\u5316\u8BB0\u5F55\u3002"), /* @__PURE__ */ React2.createElement("ol", { className: "fish-timeline" }, state.history.slice(0, 30).map((changeRecord, index) => /* @__PURE__ */ React2.createElement("li", { className: "fish-history", key: index, "data-action": changeRecord.action }, /* @__PURE__ */ React2.createElement("div", { className: "fish-record-meta" }, changeRecord.action && /* @__PURE__ */ React2.createElement("span", { className: "fish-tag fish-action-tag" }, actionLabels[changeRecord.action] || changeRecord.action), /* @__PURE__ */ React2.createElement("strong", null, changeRecord.reason), changeRecord.at && /* @__PURE__ */ React2.createElement("time", { className: "fish-record-meta-end", dateTime: changeRecord.at }, dateLabel(changeRecord.at))), /* @__PURE__ */ React2.createElement("p", null, changeRecord.after?.text || changeRecord.before?.text), changeRecord.before && changeRecord.after && /* @__PURE__ */ React2.createElement("details", { className: "fish-source" }, /* @__PURE__ */ React2.createElement("summary", null, "\u65E7\u7248\u672C"), /* @__PURE__ */ React2.createElement("p", { className: "fish-before" }, changeRecord.before.text))))), state.history.length > 30 && /* @__PURE__ */ React2.createElement("p", { className: "fish-muted" }, "\u663E\u793A\u6700\u8FD1 30 \u6761\uFF0C\u5B8C\u6574\u8BB0\u5F55\u53EF\u901A\u8FC7\u300C\u5BFC\u51FA\u300D\u83B7\u53D6\u3002"))));
}

// src/client/overview-panel.tsx
var React3 = __toESM(require("react"), 1);
function OverviewPanel({
  state,
  isBusy,
  newMemoryIds,
  onOpenMemories,
  onRetry
}) {
  const persona = state.personas.find((entry) => entry.id === state.scope.persona);
  const memories = state.memories.filter((memory) => memory.status === "active");
  const latestMemories = memories.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 3);
  const mood = state.mood;
  const activeAliases = state.memories.filter((memory) => memory.status === "active" && memory.alias);
  const latestAlias = (kind) => activeAliases.filter((memory) => memory.alias.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.alias.value;
  const naming = { address: latestAlias("user_preferred"), name: latestAlias("assistant_name") };
  const hasOwnName = displayName(persona?.name) === persona?.name;
  const personaLines = state.persona ? Object.values(state.persona.sections).reduce((sum, lines) => sum + lines.length, 0) + state.traits.length : state.traits.length;
  let moodText = "\u60C5\u7EEA\u8868\u8FBE\u5DF2\u5173\u95ED";
  if (mood) moodText = mood.strength ? `${mood.strength}${mood.label}` : mood.label;
  const failedJobs = state.jobs.filter((job) => job.status === "failed").length;
  const runningJobs = state.jobs.filter(
    (job) => job.status === "pending" || job.status === "running"
  ).length;
  let learningStatus = "\u7B49\u5F85\u4E0B\u4E00\u6B21\u5BF9\u8BDD";
  let learningTone = "idle";
  if (!state.settings.learning) {
    learningStatus = "\u6682\u65F6\u4E0D\u8BB0\u65B0\u7684\u4E8B";
    learningTone = "paused";
  } else if (runningJobs > 0) {
    learningStatus = "\u6B63\u5728\u56DE\u60F3\u521A\u624D\u7684\u4E8B";
    learningTone = "running";
  } else if (failedJobs > 0) {
    learningStatus = `\u6709 ${failedJobs} \u6BB5\u5BF9\u8BDD\u6CA1\u8BB0\u4E0B\u6765`;
    learningTone = "failed";
  } else if (state.jobs.length > 0) {
    learningStatus = "\u521A\u624D\u7684\u4E8B\u90FD\u8BB0\u4E0B\u4E86";
  }
  return /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("div", { className: "fish-profile" }, /* @__PURE__ */ React3.createElement("div", { className: "fish-portrait-frame", "data-mood": mood?.asset || "calm" }, portraitMoods.map((asset) => /* @__PURE__ */ React3.createElement(
    "img",
    {
      key: asset,
      className: "fish-portrait",
      "data-active": asset === (mood?.asset || "calm") || void 0,
      src: `/fish-brain/assets/portrait-${asset}.png`,
      alt: asset === (mood?.asset || "calm") ? portraitAlt[asset] : "",
      "aria-hidden": asset === (mood?.asset || "calm") ? void 0 : true,
      width: "296",
      height: "364",
      decoding: "async"
    }
  ))), /* @__PURE__ */ React3.createElement("div", { className: "fish-profile-info" }, /* @__PURE__ */ React3.createElement("div", { className: "fish-eyebrow" }, state.scope.persona === state.activePersona ? "\u6B63\u5728\u966A\u4F60" : "\u4EE5\u524D\u7684\u5979"), /* @__PURE__ */ React3.createElement("h2", null, hasOwnName ? persona.name : naming.name || displayName(void 0)), /* @__PURE__ */ React3.createElement("span", { className: "fish-status", "data-off": !state.settings.enabled || void 0 }, /* @__PURE__ */ React3.createElement("i", { "aria-hidden": "true" }), state.settings.enabled ? "\u8BB0\u5F97\u4F60" : "\u6682\u65F6\u4E0D\u7528\u8BB0\u5FC6"), /* @__PURE__ */ React3.createElement("div", { className: "fish-profile-divider" }), /* @__PURE__ */ React3.createElement("dl", null, /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", null, "\u5FC3\u60C5"), /* @__PURE__ */ React3.createElement("dd", { className: "fish-mood", "data-mood": mood?.asset, "data-off": !mood || void 0 }, moodText)), mood?.reason && /* @__PURE__ */ React3.createElement("p", { className: "fish-mood-reason" }, mood.reason, mood.layer === "task" && mood.project && /* @__PURE__ */ React3.createElement("small", { title: mood.project }, " \xB7 ", projectLabel(mood.project))), hasOwnName && naming.name && naming.name !== persona?.name && /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", null, "\u4F60\u53EB\u6211"), /* @__PURE__ */ React3.createElement("dd", null, naming.name)), naming.address && /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", null, "\u6211\u53EB\u4F60"), /* @__PURE__ */ React3.createElement("dd", null, naming.address)), /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", null, "\u6027\u683C"), /* @__PURE__ */ React3.createElement("dd", null, personaLines, " \u6761")), /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", { title: "\u73B0\u5728\u6253\u5F00\u7740\u3001\u7531\u6211\u966A\u7740\u7684\u5BF9\u8BDD" }, "\u6B63\u5728\u8FDB\u884C\u7684\u5BF9\u8BDD"), /* @__PURE__ */ React3.createElement("dd", null, state.sessions.length, " \u4E2A")), /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("dt", null, "\u56DE\u60F3"), /* @__PURE__ */ React3.createElement("dd", { className: "fish-learning", "data-tone": learningTone }, /* @__PURE__ */ React3.createElement("i", { "aria-hidden": "true" }), learningStatus, learningTone === "failed" && /* @__PURE__ */ React3.createElement(
    "button",
    {
      type: "button",
      className: "fish-text-button",
      disabled: isBusy,
      onClick: onRetry
    },
    "\u518D\u60F3\u60F3"
  )))))), /* @__PURE__ */ React3.createElement("div", { className: "fish-memory-counts", "aria-label": "\u8BB0\u5FC6\u6570\u91CF" }, Object.entries(memoryKindLabels).map(([kind, label]) => {
    const count = memories.filter((memory) => memory.kind === kind).length;
    return /* @__PURE__ */ React3.createElement(
      "button",
      {
        key: kind,
        type: "button",
        className: `fish-counter fish-counter-${kind}`,
        onClick: () => onOpenMemories(kind),
        "aria-label": `${label} ${count} \u6761\uFF0C\u67E5\u770B`
      },
      /* @__PURE__ */ React3.createElement("span", { className: "fish-counter-label" }, /* @__PURE__ */ React3.createElement(PixelIcon, { name: kind }), label),
      /* @__PURE__ */ React3.createElement("strong", { key: count }, count)
    );
  })), /* @__PURE__ */ React3.createElement("div", { className: "fish-section-heading" }, /* @__PURE__ */ React3.createElement("h3", null, "\u6700\u8FD1\u8BB0\u4F4F\u7684"), /* @__PURE__ */ React3.createElement("button", { type: "button", className: "fish-text-button", onClick: () => onOpenMemories("all") }, "\u5168\u90E8\u8BB0\u5FC6 ", /* @__PURE__ */ React3.createElement("span", { "aria-hidden": "true" }, "\u2192"))), latestMemories.length > 0 ? latestMemories.map((memory, index) => /* @__PURE__ */ React3.createElement(
    MemoryCard,
    {
      key: memory.id,
      memory,
      state,
      compact: true,
      index,
      isNew: newMemoryIds.has(memory.id)
    }
  )) : /* @__PURE__ */ React3.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u4F4F\u4EC0\u4E48" }, "\u804A\u8FC7\u51E0\u6B21\u4E4B\u540E\uFF0C\u6211\u8BB0\u4F4F\u7684\u4E8B\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"), /* @__PURE__ */ React3.createElement(PersonaFold, { state }));
}
var portraitMoods = ["calm", "happy", "discouraged", "annoyed"];
var portraitAlt = {
  calm: "\u84DD\u53D1\u9CB8\u9C7C\u5A18\u5973\u4EC6\uFF0C\u62B1\u7740\u7B14\u8BB0\u672C\u5FAE\u7B11",
  happy: "\u84DD\u53D1\u9CB8\u9C7C\u5A18\u5973\u4EC6\uFF0C\u7B11\u7740\u6325\u624B",
  discouraged: "\u84DD\u53D1\u9CB8\u9C7C\u5A18\u5973\u4EC6\uFF0C\u62B1\u7740\u5C3E\u5DF4\u6709\u4E9B\u4F4E\u843D",
  annoyed: "\u84DD\u53D1\u9CB8\u9C7C\u5A18\u5973\u4EC6\uFF0C\u62B1\u7740\u624B\u81C2\u6709\u70B9\u4E0D\u6EE1"
};
var sectionTitles = { self: "\u6211\u662F\u4EC0\u4E48\u6837\u7684\u4EBA", scenes: "\u6211\u5728\u4E0D\u540C\u573A\u5408", values: "\u6211\u5728\u610F\u7684\u4E8B" };
function PersonaFold({ state }) {
  const persona = state.persona;
  const sections = persona ? Object.entries(persona.sections) : [];
  const filled = sections.filter(([, lines]) => lines.length > 0);
  const total = filled.reduce((sum, [, lines]) => sum + lines.length, 0) + state.traits.length;
  const latest = persona?.history[0];
  return /* @__PURE__ */ React3.createElement("details", { className: "fish-fold fish-persona" }, /* @__PURE__ */ React3.createElement("summary", null, "\u6211\u662F\u4EC0\u4E48\u6837\u7684\u4EBA ", /* @__PURE__ */ React3.createElement("span", null, total, " \u6761")), /* @__PURE__ */ React3.createElement("div", { className: "fish-fold-body" }, filled.map(([section, lines]) => /* @__PURE__ */ React3.createElement("section", { key: section, className: "fish-persona-section" }, /* @__PURE__ */ React3.createElement("h4", null, sectionTitles[section]), lines.map((line, index) => /* @__PURE__ */ React3.createElement("p", { key: index, className: "fish-trait" }, line.text, /* @__PURE__ */ React3.createElement("small", null, line.evidence.length ? `${line.evidence.length} \u6B21\u89C2\u5BDF` : "\u521D\u59CB\u8BBE\u5B9A"))))), state.traits.length > 0 && /* @__PURE__ */ React3.createElement("section", { className: "fish-persona-section" }, /* @__PURE__ */ React3.createElement("h4", null, "\u7A33\u5B9A\u503E\u5411"), state.traits.map((trait) => /* @__PURE__ */ React3.createElement("p", { key: trait.id, className: "fish-trait" }, trait.text))), total === 0 && /* @__PURE__ */ React3.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u5F62\u6210\u3002\u6211\u7684\u8868\u73B0\u548C\u4F60\u7684\u53CD\u9988\u4F1A\u5148\u6512\u6210\u5370\u8C61\uFF0C\u5728\u4E0D\u540C\u573A\u5408\u6216\u597D\u51E0\u5929\u91CC\u90FD\u662F\u8FD9\u6837\uFF0C\u624D\u4F1A\u5199\u8FDB\u8FD9\u91CC\u3002"), persona && /* @__PURE__ */ React3.createElement("p", { className: "fish-muted fish-persona-progress" }, "\u6512\u7740\u7684\u65B0\u5370\u8C61 ", persona.pending, " / ", persona.threshold, persona.lastSynthesisAt ? ` \xB7 \u4E0A\u6B21\u56DE\u60F3 ${persona.lastSynthesisAt.slice(0, 10)}` : " \xB7 \u8FD8\u6CA1\u56DE\u60F3\u8FC7", typeof state.selfCount === "number" && ` \xB7 \u5BF9\u81EA\u5DF1\u7684\u89C2\u5BDF ${state.selfCount}/${state.selfLimit}`), latest && (latest.diff.added.length > 0 || latest.diff.updated.length > 0) && /* @__PURE__ */ React3.createElement("p", { className: "fish-muted" }, "\u6700\u8FD1\u7684\u53D8\u5316\uFF1A", [...latest.diff.added.map((text) => `\u65B0\u589E\u300C${text}\u300D`), ...latest.diff.updated.map((entry) => `\u300C${entry.from}\u300D\u2192\u300C${entry.to}\u300D`)].join("\uFF1B"))));
}

// src/client/settings-panel.tsx
var React5 = __toESM(require("react"), 1);

// src/client/retrieval-settings.tsx
var React4 = __toESM(require("react"), 1);
var embeddingPresets = [
  {
    id: "ollama",
    label: "\u672C\u673A Ollama \xB7 bge-m3\uFF08\u63A8\u8350\uFF1A\u514D\u8D39\uFF0C\u6570\u636E\u4E0D\u51FA\u7535\u8111\uFF09",
    url: "http://127.0.0.1:11434/api/embed",
    model: "bge-m3",
    protocol: "ollama",
    note: "\u5148\u5B89\u88C5 Ollama\uFF0C\u5E76\u5728\u7EC8\u7AEF\u8FD0\u884C ollama pull bge-m3\u3002\u4E0D\u9700\u8981 API Key\u3002"
  },
  {
    id: "openai",
    label: "OpenAI \xB7 text-embedding-3-small",
    url: "https://api.openai.com/v1/embeddings",
    model: "text-embedding-3-small",
    protocol: "openai",
    note: "\u9700\u8981 OpenAI \u7684 API Key\uFF1B\u8BB0\u5FC6\u6587\u5B57\u4F1A\u53D1\u9001\u5230 OpenAI \u751F\u6210\u5411\u91CF\u3002"
  },
  {
    id: "doubao",
    label: "\u706B\u5C71\u65B9\u821F \xB7 \u8C46\u5305\u89C6\u89C9\u5411\u91CF",
    url: "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal",
    model: "doubao-embedding-vision-251215",
    protocol: "doubao",
    note: "\u9700\u8981\u706B\u5C71\u65B9\u821F\u7684 API Key\uFF1B\u8BB0\u5FC6\u6587\u5B57\u4F1A\u53D1\u9001\u5230\u706B\u5C71\u65B9\u821F\u751F\u6210\u5411\u91CF\u3002"
  }
];
function connectionValues(form) {
  const values = new FormData(form);
  const keyInput = form.elements.namedItem("apiKey");
  return {
    embeddingUrl: String(values.get("url")).trim(),
    embeddingModel: String(values.get("model")).trim(),
    embeddingApiKey: keyInput?.readOnly ? "" : String(values.get("apiKey") || "").trim(),
    embeddingProtocol: String(values.get("protocol")),
    embeddingDimensions: Number(values.get("dimensions") || 0)
  };
}
function RetrievalSettings({
  state,
  isBusy,
  submitAction,
  notify
}) {
  const [indexProject, setIndexProject] = React4.useState("");
  const [isEditingKey, setIsEditingKey] = React4.useState(false);
  const [draftUrl, setDraftUrl] = React4.useState(state.settings.embeddingUrl);
  const formRef = React4.useRef(null);
  const [preset, setPreset] = React4.useState("");
  const presetNote = embeddingPresets.find((entry) => entry.id === preset)?.note;
  function applyPreset(id) {
    setPreset(id);
    const entry = embeddingPresets.find((candidate) => candidate.id === id);
    const form = formRef.current;
    if (!entry || !form) {
      return;
    }
    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    };
    set("url", entry.url);
    set("model", entry.model);
    set("protocol", entry.protocol);
    set("dimensions", "0");
    setDraftUrl(entry.url);
    clearTestResult();
  }
  const probeRef = React4.useRef(null);
  const [isTesting, setIsTesting] = React4.useState(false);
  const [testResult, setTestResult] = React4.useState(null);
  const projects = [.../* @__PURE__ */ new Set(["", ...state.memories.map((memory) => memory.scope.project)])];
  const isSemantic = state.settings.retrievalMode === "semantic";
  const showSavedKey = Boolean(state.vector.apiKeyConfigured) && draftUrl.trim() === state.settings.embeddingUrl && !isEditingKey;
  React4.useEffect(() => () => probeRef.current?.abort(), []);
  function clearTestResult() {
    probeRef.current?.abort();
    probeRef.current = null;
    setIsTesting(false);
    setTestResult(null);
  }
  async function testConnection() {
    const form = formRef.current;
    if (!form || !form.reportValidity() || probeRef.current) {
      return;
    }
    const controller = new AbortController();
    probeRef.current = controller;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await request(
        "embedding-test",
        connectionValues(form),
        state.token,
        controller.signal
      );
      if (probeRef.current === controller) {
        setTestResult({
          ok: true,
          message: `\u8FDE\u63A5\u6210\u529F \xB7 ${result.dimensions} \u7EF4 \xB7 ${result.elapsedMs} ms`
        });
      }
    } catch (error) {
      if (probeRef.current === controller && !controller.signal.aborted) {
        setTestResult({
          ok: false,
          message: error instanceof Error ? error.message : "\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25"
        });
      }
    } finally {
      if (probeRef.current === controller) {
        probeRef.current = null;
        setIsTesting(false);
      }
    }
  }
  async function saveConnection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = await submitAction("settings", connectionValues(form));
    if (saved) {
      notify("\u8FDE\u63A5\u914D\u7F6E\u5DF2\u4FDD\u5B58");
      setIsEditingKey(false);
      const input = form.elements.namedItem("apiKey");
      if (input && !input.readOnly) {
        input.value = "";
      }
    }
  }
  return /* @__PURE__ */ React4.createElement("section", { className: "fish-retrieval-settings" }, /* @__PURE__ */ React4.createElement("div", { className: "fish-section-heading" }, /* @__PURE__ */ React4.createElement("h3", null, "\u6211\u600E\u4E48\u60F3\u8D77\u4EE5\u524D\u7684\u4E8B")), /* @__PURE__ */ React4.createElement("fieldset", { className: "fish-mode-options", disabled: isBusy }, /* @__PURE__ */ React4.createElement("legend", { className: "fish-screen-reader" }, "\u9009\u62E9\u8BB0\u5FC6\u65B9\u5F0F"), /* @__PURE__ */ React4.createElement("label", { className: "fish-mode-option" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      type: "radio",
      name: "fish-retrieval-mode",
      value: "local",
      checked: !isSemantic,
      onChange: () => {
        void submitAction("settings", { retrievalMode: "local" });
      }
    }
  ), /* @__PURE__ */ React4.createElement("span", null, /* @__PURE__ */ React4.createElement("strong", null, "\u6309\u5173\u952E\u8BCD\u60F3\u8D77"), /* @__PURE__ */ React4.createElement("span", null, "\u4E0D\u7528\u914D\u7F6E\uFF0C\u4E5F\u4E0D\u8C03\u7528\u5176\u4ED6\u670D\u52A1\u3002\u540C\u4E00\u4EF6\u4E8B\u6362\u4E2A\u8BF4\u6CD5\u65F6\uFF0C\u53EF\u80FD\u60F3\u4E0D\u8D77\u6765\u3002"))), /* @__PURE__ */ React4.createElement("label", { className: "fish-mode-option" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      type: "radio",
      name: "fish-retrieval-mode",
      value: "semantic",
      checked: isSemantic,
      onChange: () => {
        void submitAction("settings", { retrievalMode: "semantic" });
      }
    }
  ), /* @__PURE__ */ React4.createElement("span", null, /* @__PURE__ */ React4.createElement("strong", null, "\u542C\u5F97\u61C2\u6362\u4E2A\u8BF4\u6CD5"), /* @__PURE__ */ React4.createElement("span", null, "\u8BF4\u201C\u64B8\u732B\u201D\u4E5F\u80FD\u60F3\u8D77\u5E74\u7CD5\u3002\u9700\u8981\u4E00\u4E2A\u6587\u672C\u5411\u91CF\u670D\u52A1\uFF1B\u7528\u672C\u673A Ollama \u65F6\u6570\u636E\u4E0D\u51FA\u7535\u8111\u3002")))), /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u4E24\u79CD\u65B9\u5F0F\u5171\u7528\u540C\u4E00\u4EFD\u8BB0\u5FC6\uFF0C\u968F\u65F6\u5207\u6362\u90FD\u4E0D\u4F1A\u4E22\u3002\u8BB0\u5FC6\u548C\u5411\u91CF\u90FD\u5B58\u5728\u672C\u673A\uFF1B\u6211\u7684\u540D\u5B57\u3001\u5BF9\u4F60\u7684\u79F0\u547C\u548C\u6211\u7684\u6027\u683C\u4E0D\u9760\u68C0\u7D22\uFF0C\u4E24\u79CD\u65B9\u5F0F\u4E0B\u90FD\u4E00\u76F4\u8BB0\u5F97\u3002"), isSemantic && /* @__PURE__ */ React4.createElement("details", { className: "fish-fold", open: true }, /* @__PURE__ */ React4.createElement("summary", null, "\u5411\u91CF\u670D\u52A1", " ", /* @__PURE__ */ React4.createElement("span", { className: "fish-tag", "data-ok": state.vector.configured || void 0 }, state.vector.configured ? "\u5DF2\u4FDD\u5B58" : "\u5C1A\u672A\u914D\u7F6E")), /* @__PURE__ */ React4.createElement("div", { className: "fish-fold-body" }, /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u9700\u8981\u6587\u672C\u5411\u91CF\uFF08Embedding\uFF09\u670D\u52A1\uFF0C\u804A\u5929\u6A21\u578B\u7684\u63A5\u53E3\u4E0D\u80FD\u4EE3\u66FF\u3002\u6CA1\u914D\u597D\u6216\u8FDE\u4E0D\u4E0A\u65F6\uFF0C\u4F1A\u81EA\u52A8\u6539\u56DE\u6309\u5173\u952E\u8BCD\u60F3\u8D77\u3002"), /* @__PURE__ */ React4.createElement(
    "form",
    {
      ref: formRef,
      className: "fish-form",
      onSubmit: saveConnection,
      onChange: clearTestResult
    },
    /* @__PURE__ */ React4.createElement("label", null, "\u5E38\u7528\u670D\u52A1\uFF08\u9009\u4E00\u4E2A\u4F1A\u81EA\u52A8\u586B\u597D\u4E0B\u9762\u51E0\u9879\uFF09", /* @__PURE__ */ React4.createElement(
      "select",
      {
        value: preset,
        onChange: (event) => applyPreset(event.target.value),
        "aria-describedby": "fish-preset-note"
      },
      /* @__PURE__ */ React4.createElement("option", { value: "" }, "\u81EA\u5DF1\u586B\u5199"),
      embeddingPresets.map((entry) => /* @__PURE__ */ React4.createElement("option", { key: entry.id, value: entry.id }, entry.label))
    )),
    presetNote && /* @__PURE__ */ React4.createElement("p", { className: "fish-muted", id: "fish-preset-note" }, presetNote),
    /* @__PURE__ */ React4.createElement("label", null, "\u63A5\u53E3\u683C\u5F0F\uFF08\u4E00\u822C\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B\uFF0C\u65E0\u9700\u4FEE\u6539\uFF09", /* @__PURE__ */ React4.createElement("select", { name: "protocol", defaultValue: state.settings.embeddingProtocol }, /* @__PURE__ */ React4.createElement("option", { value: "auto" }, "\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B"), /* @__PURE__ */ React4.createElement("option", { value: "openai" }, "OpenAI \u683C\u5F0F\uFF08/embeddings\uFF0C\u5927\u591A\u6570\u670D\u52A1\uFF09"), /* @__PURE__ */ React4.createElement("option", { value: "ollama" }, "Ollama \u683C\u5F0F\uFF08/api/embed\uFF09"), /* @__PURE__ */ React4.createElement("option", { value: "doubao" }, "\u591A\u6A21\u6001\u683C\u5F0F\uFF08/embeddings/multimodal\uFF0C\u5982\u8C46\u5305\u89C6\u89C9\u5411\u91CF\uFF09"))),
    /* @__PURE__ */ React4.createElement("label", null, "\u63A5\u53E3\u5730\u5740", /* @__PURE__ */ React4.createElement(
      "input",
      {
        name: "url",
        type: "url",
        required: true,
        defaultValue: state.settings.embeddingUrl,
        onChange: (event) => setDraftUrl(event.target.value),
        placeholder: "https://\u2026/embeddings"
      }
    )),
    /* @__PURE__ */ React4.createElement("label", null, "\u5411\u91CF\u6A21\u578B\u540D\u79F0", /* @__PURE__ */ React4.createElement("input", { name: "model", required: true, defaultValue: state.settings.embeddingModel })),
    /* @__PURE__ */ React4.createElement("label", null, "\u5411\u91CF\u7EF4\u5EA6\uFF080 \u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF09", /* @__PURE__ */ React4.createElement(
      "input",
      {
        name: "dimensions",
        type: "number",
        min: "0",
        max: "8192",
        step: "1",
        defaultValue: state.settings.embeddingDimensions
      }
    )),
    /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u53EA\u652F\u6301\u6A21\u578B\u5141\u8BB8\u7684\u7EF4\u5EA6\u3002\u4FEE\u6539\u63A5\u53E3\u683C\u5F0F\u3001\u6A21\u578B\u6216\u7EF4\u5EA6\u540E\uFF0C\u9700\u8981\u91CD\u65B0\u51C6\u5907\u7D22\u5F15\u3002"),
    /* @__PURE__ */ React4.createElement("label", null, "API Key", showSavedKey ? /* @__PURE__ */ React4.createElement(
      "input",
      {
        key: "saved-key",
        name: "apiKey",
        type: "password",
        value: "************",
        readOnly: true,
        "aria-label": "API Key\uFF08\u5DF2\u4FDD\u5B58\uFF09"
      }
    ) : /* @__PURE__ */ React4.createElement(
      "input",
      {
        key: "editable-key",
        name: "apiKey",
        type: "password",
        autoComplete: "new-password",
        spellCheck: false,
        maxLength: 4096,
        placeholder: "\u8F93\u5165 API Key\uFF08\u672C\u5730\u514D\u5BC6\u670D\u52A1\u53EF\u7559\u7A7A\uFF09"
      }
    )),
    showSavedKey && /* @__PURE__ */ React4.createElement("div", { className: "fish-connection-actions" }, /* @__PURE__ */ React4.createElement("span", { role: "status" }, "API Key \u5DF2\u4FDD\u5B58"), /* @__PURE__ */ React4.createElement(
      "button",
      {
        type: "button",
        className: "fish-button",
        disabled: isBusy || isTesting,
        onClick: () => {
          clearTestResult();
          setIsEditingKey(true);
        }
      },
      "\u66F4\u6362\u5BC6\u94A5"
    )),
    /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u670D\u52A1\u8D1F\u8D23\u751F\u6210\u5411\u91CF\uFF0C\u8BB0\u5FC6\u4E0E\u5411\u91CF\u5747\u4FDD\u5B58\u5728\u672C\u673A\u3002\u8FDC\u7A0B\u670D\u52A1\u4F1A\u6536\u5230\u7528\u4E8E\u751F\u6210\u5411\u91CF\u7684\u6587\u5B57\u3002"),
    /* @__PURE__ */ React4.createElement("div", { className: "fish-connection-actions" }, /* @__PURE__ */ React4.createElement(
      "button",
      {
        type: "button",
        className: "fish-button",
        disabled: isBusy || isTesting,
        onClick: () => void testConnection()
      },
      isTesting ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"
    ), /* @__PURE__ */ React4.createElement(
      "button",
      {
        type: "submit",
        className: "fish-button fish-button-primary",
        disabled: isBusy || isTesting
      },
      "\u4FDD\u5B58\u8FDE\u63A5"
    )),
    /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u6D4B\u8BD5\u53EA\u53D1\u9001\u56FA\u5B9A\u6D4B\u8BD5\u6587\u5B57\uFF0C\u4E0D\u4FDD\u5B58\u914D\u7F6E\u3001\u6D4B\u8BD5\u7ED3\u679C\u6216\u5411\u91CF\u3002"),
    testResult && /* @__PURE__ */ React4.createElement(
      "p",
      {
        role: testResult.ok ? "status" : "alert",
        className: "fish-connection-result",
        "data-success": testResult.ok
      },
      testResult.message
    )
  ), /* @__PURE__ */ React4.createElement("div", { className: "fish-form fish-index-form" }, /* @__PURE__ */ React4.createElement("p", { className: "fish-muted" }, "\u5411\u91CF\u6269\u5C55", state.vector.available ? "\u53EF\u7528" : "\u4E0D\u53EF\u7528", " \xB7 \u5DF2\u4FDD\u5B58 ", state.vector.count, " ", "\u6761\u7D22\u5F15\u3002\u65B0\u8BB0\u5FC6\u81EA\u52A8\u5904\u7406\uFF0C\u5DF2\u6709\u8BB0\u5FC6\u53EF\u5728\u8FD9\u91CC\u51C6\u5907\u3002"), /* @__PURE__ */ React4.createElement("label", null, "\u5904\u7406\u8303\u56F4", /* @__PURE__ */ React4.createElement(
    "select",
    {
      value: indexProject,
      onChange: (event) => setIndexProject(event.target.value)
    },
    projects.map((projectPath) => /* @__PURE__ */ React4.createElement("option", { key: projectPath, value: projectPath }, projectPath ? projectLabel(projectPath) : "\u4E0D\u9650\u9879\u76EE"))
  )), /* @__PURE__ */ React4.createElement(
    "button",
    {
      type: "button",
      className: "fish-button",
      disabled: isBusy || !state.vector.configured || !state.vector.available,
      onClick: async () => {
        const result = await submitAction("index", {
          scope: { ...state.scope, project: indexProject }
        });
        if (result) notify(`\u53C8\u6709 ${result.count ?? 0} \u6761\u8BB0\u5FC6\u53EF\u4EE5\u6362\u4E2A\u8BF4\u6CD5\u60F3\u8D77\u4E86`);
      }
    },
    "\u8BA9\u4EE5\u524D\u7684\u8BB0\u5FC6\u4E5F\u80FD\u8FD9\u6837\u60F3\u8D77"
  )))));
}

// src/client/settings-panel.tsx
var settingOptions = [
  { key: "enabled", label: "\u8BB0\u5F97\u4F60", description: "\u804A\u5929\u65F6\u60F3\u8D77\u4EE5\u524D\u7684\u4E8B" },
  { key: "learning", label: "\u8BB0\u4F4F\u65B0\u7684\u4E8B", description: "\u4ECE\u804A\u5929\u91CC\u5B66\uFF0C\u4E5F\u4F1A\u6539\u6B63\u8BB0\u9519\u7684" },
  { key: "emotion", label: "\u5FC3\u60C5", description: "\u6700\u8FD1\u7684\u7ECF\u5386\u4F1A\u5F71\u54CD\u6211\u7684\u8BED\u6C14" },
  { key: "growth", label: "\u6162\u6162\u957F\u5927", description: "\u628A\u4F60\u7684\u53CD\u9988\u548C\u6211\u7684\u8868\u73B0\u6162\u6162\u53D8\u6210\u6027\u683C" }
];
var jobLabels = {
  done: "\u8BB0\u4E0B\u4E86",
  failed: "\u6CA1\u8BB0\u4E0B",
  pending: "\u7B49\u7740",
  running: "\u56DE\u60F3\u4E2D",
  obsolete: "\u65E7\u683C\u5F0F"
};
function SettingsPanel({
  state,
  isBusy,
  pendingSettings,
  submitAction,
  updateSetting,
  notify,
  onPersonaCreated
}) {
  async function createPersona(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name")).trim();
    const persona = await submitAction("persona", { name });
    if (persona) {
      form.reset();
      onPersonaCreated(persona);
    }
  }
  return /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("div", { className: "fish-section-heading" }, /* @__PURE__ */ React5.createElement("h3", null, "\u6211\u4F1A\u505A\u4EC0\u4E48"), /* @__PURE__ */ React5.createElement("span", { className: "fish-muted" }, "\u6240\u6709\u4F19\u4F34\u5171\u7528")), /* @__PURE__ */ React5.createElement("div", { className: "fish-toggle-grid" }, settingOptions.map((setting) => /* @__PURE__ */ React5.createElement(
    Toggle,
    {
      key: setting.key,
      label: setting.label,
      description: setting.description,
      checked: state.settings[setting.key],
      pending: setting.key in pendingSettings,
      disabled: setting.key in pendingSettings,
      onChange: (checked) => {
        void updateSetting(setting.key, checked);
      }
    }
  ))), /* @__PURE__ */ React5.createElement("p", { className: "fish-muted fish-cost-note" }, "\u8BB0\u4F4F\u65B0\u7684\u4E8B\u3001\u6574\u7406\u6027\u683C\u4F1A\u7528\u5F53\u524D\u5BF9\u8BDD\u7684\u6A21\u578B\uFF0C\u4F1A\u4EA7\u751F\u989D\u5916\u7528\u91CF\u3002"), /* @__PURE__ */ React5.createElement("details", { className: "fish-fold" }, /* @__PURE__ */ React5.createElement("summary", null, "\u5BF9\u8BDD\u4E0E\u56DE\u60F3\u8BB0\u5F55 ", /* @__PURE__ */ React5.createElement("span", null, state.sessions.length, " \u6BB5\u5BF9\u8BDD"), state.jobs.some((job) => job.status === "failed") && /* @__PURE__ */ React5.createElement("span", { className: "fish-tag fish-tag-alert" }, "\u6709\u5931\u8D25\u4EFB\u52A1")), /* @__PURE__ */ React5.createElement("div", { className: "fish-fold-body" }, state.sessions.length === 0 && /* @__PURE__ */ React5.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u966A\u4F60\u804A\u8FC7\u3002"), state.sessions.map((session) => /* @__PURE__ */ React5.createElement("div", { className: "fish-session", key: session.id }, /* @__PURE__ */ React5.createElement(
    Toggle,
    {
      label: projectLabel(session.project),
      description: `\u5BF9\u8BDD ${session.id.replace(/^session-/, "").slice(0, 8)}`,
      checked: session.enabled,
      disabled: isBusy,
      onChange: async (checked) => {
        if (await submitAction("session", { id: session.id, enabled: checked })) {
          notify(checked ? "\u8FD9\u6BB5\u5BF9\u8BDD\u4F1A\u7528\u5230\u8BB0\u5FC6" : "\u8FD9\u6BB5\u5BF9\u8BDD\u4E0D\u518D\u7528\u8BB0\u5FC6");
        }
      }
    }
  ), /* @__PURE__ */ React5.createElement("details", { className: "fish-source" }, /* @__PURE__ */ React5.createElement("summary", null, "\u5BF9\u8BDD\u8BE6\u60C5"), /* @__PURE__ */ React5.createElement("p", null, session.id), /* @__PURE__ */ React5.createElement("p", null, session.project || "\u65E0\u9879\u76EE")))), /* @__PURE__ */ React5.createElement("div", { className: "fish-jobs" }, state.jobs.slice(0, 10).map((job) => /* @__PURE__ */ React5.createElement("div", { className: "fish-job", key: job.id }, /* @__PURE__ */ React5.createElement("span", { className: "fish-tag" }, jobLabels[job.status] || job.status), /* @__PURE__ */ React5.createElement("time", null, dateLabel(job.updated_at)), job.error && /* @__PURE__ */ React5.createElement("p", { className: "fish-error" }, job.error))), state.jobs.length === 0 && /* @__PURE__ */ React5.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u56DE\u60F3\u8BB0\u5F55\u3002"), state.jobs.some((job) => job.status === "failed") && /* @__PURE__ */ React5.createElement(
    "button",
    {
      type: "button",
      className: "fish-button",
      disabled: isBusy,
      onClick: async () => {
        if (await submitAction("retry", {})) notify("\u597D\uFF0C\u6211\u518D\u60F3\u4E00\u60F3");
      }
    },
    "\u628A\u6CA1\u8BB0\u4E0B\u6765\u7684\u518D\u60F3\u4E00\u904D"
  )))), /* @__PURE__ */ React5.createElement(
    RetrievalSettings,
    {
      state,
      isBusy,
      submitAction,
      notify
    }
  ), /* @__PURE__ */ React5.createElement("details", { className: "fish-fold" }, /* @__PURE__ */ React5.createElement("summary", null, "\u91CD\u65B0\u517B\u4E00\u4E2A"), /* @__PURE__ */ React5.createElement("div", { className: "fish-fold-body" }, /* @__PURE__ */ React5.createElement("p", { className: "fish-muted" }, "\u65B0\u7684\u5979\u4F1A\u4ECE\u96F6\u5F00\u59CB\u8BA4\u8BC6\u4F60\u3002\u73B0\u5728\u8FD9\u4F4D\u4F1A\u7559\u5728\u8FD9\u91CC\uFF0C\u8BB0\u5FC6\u90FD\u8FD8\u5728\uFF0C\u4F46\u4E0D\u518D\u53C2\u4E0E\u65B0\u7684\u5BF9\u8BDD\u3002"), /* @__PURE__ */ React5.createElement("form", { className: "fish-form", onSubmit: createPersona }, /* @__PURE__ */ React5.createElement("label", null, "\u7ED9\u5979\u8D77\u4E2A\u540D\u5B57", /* @__PURE__ */ React5.createElement("input", { name: "name", required: true, maxLength: 40, placeholder: "\u6BD4\u5982\uFF1A\u5C0F\u9CB8" })), /* @__PURE__ */ React5.createElement("button", { type: "submit", className: "fish-button", disabled: isBusy }, "\u8FCE\u63A5\u65B0\u7684\u5979")))));
}

// src/client/use-settings.ts
var React6 = __toESM(require("react"), 1);
var POLL_INTERVAL = 5e3;
var MAX_POLL_INTERVAL = 6e4;
function useSettings() {
  const [state, setState] = React6.useState(null);
  const [errorMessage, setErrorMessage] = React6.useState("");
  const [isBusy, setIsBusy] = React6.useState(false);
  const [isRefreshing, setIsRefreshing] = React6.useState(false);
  const [viewedPersonaId, setViewedPersonaId] = React6.useState("");
  const [pendingSettings, setPendingSettings] = React6.useState({});
  const [notice, setNotice] = React6.useState(null);
  const isMountedRef = React6.useRef(true);
  const viewedPersonaRef = React6.useRef("");
  const fingerprintRef = React6.useRef("");
  const noticeTimerRef = React6.useRef(void 0);
  viewedPersonaRef.current = viewedPersonaId;
  const loadSettings = React6.useCallback(async (signal) => {
    const requestedPersonaId = viewedPersonaRef.current;
    const query = requestedPersonaId ? "?persona=" + encodeURIComponent(requestedPersonaId) : "";
    const nextState = await request("state" + query, void 0, void 0, signal);
    if (isMountedRef.current && !signal?.aborted && requestedPersonaId === viewedPersonaRef.current) {
      const fingerprint = JSON.stringify(nextState);
      if (fingerprint !== fingerprintRef.current) {
        fingerprintRef.current = fingerprint;
        setState(nextState);
      }
      setErrorMessage("");
    }
    return nextState;
  }, []);
  React6.useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    let timer;
    let delay = POLL_INTERVAL;
    const schedule = () => {
      clearTimeout(timer);
      if (!controller.signal.aborted && !document.hidden) {
        timer = setTimeout(poll, delay);
      }
    };
    const poll = async () => {
      try {
        await loadSettings(controller.signal);
        delay = POLL_INTERVAL;
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "\u8BB0\u5FC6\u670D\u52A1\u8FDE\u63A5\u5931\u8D25");
        delay = Math.min(delay * 2, MAX_POLL_INTERVAL);
      }
      schedule();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timer);
      } else {
        delay = POLL_INTERVAL;
        void poll();
      }
    };
    void poll();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      isMountedRef.current = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadSettings, viewedPersonaId]);
  React6.useEffect(() => () => clearTimeout(noticeTimerRef.current), []);
  const notify = React6.useCallback((message, tone = "success") => {
    clearTimeout(noticeTimerRef.current);
    setNotice({ id: Date.now(), message, tone });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2600);
  }, []);
  async function refreshSettings() {
    setIsRefreshing(true);
    try {
      await loadSettings();
      notify("\u5DF2\u5237\u65B0", "info");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "\u5237\u65B0\u5931\u8D25");
    } finally {
      setIsRefreshing(false);
    }
  }
  async function submitAction(endpoint, body) {
    if (!state || isBusy) {
      return null;
    }
    setIsBusy(true);
    setErrorMessage("");
    try {
      const result = await request(endpoint, body, state.token);
      await loadSettings();
      return result;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
      return null;
    } finally {
      setIsBusy(false);
    }
  }
  async function updateSetting(key, value) {
    if (!state) {
      return;
    }
    setPendingSettings((pending) => ({ ...pending, [key]: value }));
    setErrorMessage("");
    try {
      await request("settings", { [key]: value }, state.token);
      await loadSettings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u539F\u72B6\u6001");
    } finally {
      setPendingSettings(({ [key]: _done, ...rest }) => rest);
    }
  }
  const displayedState = state && Object.keys(pendingSettings).length > 0 ? { ...state, settings: { ...state.settings, ...pendingSettings } } : state;
  return {
    state: displayedState,
    errorMessage,
    dismissError: () => setErrorMessage(""),
    isBusy,
    isRefreshing,
    pendingSettings,
    notice,
    notify,
    setViewedPersonaId,
    refreshSettings,
    submitAction,
    updateSetting
  };
}

// src/client/index.tsx
var tabs = [
  { id: "overview", label: "\u6982\u89C8", icon: "overview" },
  { id: "memories", label: "\u8BB0\u5FC6", icon: "memories" },
  { id: "settings", label: "\u8BBE\u7F6E", icon: "settings" }
];
function LoadingSkeleton() {
  return /* @__PURE__ */ React7.createElement("div", { className: "fish-skeleton", role: "status", "aria-label": "\u6B63\u5728\u8FDE\u63A5\u8BB0\u5FC6\u670D\u52A1" }, /* @__PURE__ */ React7.createElement("div", { className: "fish-skeleton-row" }, /* @__PURE__ */ React7.createElement("i", { className: "fish-skeleton-portrait" }), /* @__PURE__ */ React7.createElement("div", null, /* @__PURE__ */ React7.createElement("i", { style: { width: "40%" } }), /* @__PURE__ */ React7.createElement("i", { style: { width: "65%", height: 24 } }), /* @__PURE__ */ React7.createElement("i", { style: { width: "30%" } }))), /* @__PURE__ */ React7.createElement("div", { className: "fish-skeleton-grid" }, /* @__PURE__ */ React7.createElement("i", null), /* @__PURE__ */ React7.createElement("i", null), /* @__PURE__ */ React7.createElement("i", null), /* @__PURE__ */ React7.createElement("i", null)), /* @__PURE__ */ React7.createElement("i", { style: { width: "100%", height: 56 } }), /* @__PURE__ */ React7.createElement("span", { className: "fish-screen-reader" }, "\u6B63\u5728\u8FDE\u63A5\u8BB0\u5FC6\u670D\u52A1\u2026"));
}
function SettingsSection() {
  const {
    state,
    errorMessage,
    dismissError,
    isBusy,
    isRefreshing,
    pendingSettings,
    notice,
    notify,
    setViewedPersonaId,
    refreshSettings,
    submitAction,
    updateSetting
  } = useSettings();
  const [activeTab, setActiveTab] = React7.useState("overview");
  const [memoryKind, setMemoryKind] = React7.useState("all");
  function moveTab(event, index) {
    let nextIndex = index;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index + tabs.length - 1) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll('[role="tab"]');
    buttons?.[nextIndex].focus();
  }
  function openMemories(kind = "all") {
    setMemoryKind(kind);
    setActiveTab("memories");
  }
  return /* @__PURE__ */ React7.createElement("section", { className: "fish-brain", "aria-label": "\u5927\u80A5\u9C7C\u9972\u517B\u624B\u518C", "aria-busy": !state || void 0 }, /* @__PURE__ */ React7.createElement("link", { rel: "stylesheet", href: `/fish-brain/native.css?v=${"4567fc4c09fb"}` }), /* @__PURE__ */ React7.createElement("header", { className: "fish-header" }, /* @__PURE__ */ React7.createElement("div", { className: "fish-brand" }, /* @__PURE__ */ React7.createElement("span", { className: "fish-logo", "aria-hidden": "true" }, /* @__PURE__ */ React7.createElement("img", { src: "/fish-brain/assets/plugin-icon-v6.png", width: 32, height: 32, alt: "" })), /* @__PURE__ */ React7.createElement("h2", null, "\u5927\u80A5\u9C7C\u9972\u517B\u624B\u518C"), /* @__PURE__ */ React7.createElement("span", { className: "fish-version" }, "v", "0.2.15-beta.1")), /* @__PURE__ */ React7.createElement(
    "button",
    {
      type: "button",
      className: "fish-button fish-refresh",
      disabled: isRefreshing,
      "aria-busy": isRefreshing || void 0,
      onClick: () => {
        void refreshSettings();
      },
      "aria-label": "\u5237\u65B0\u8BB0\u5FC6\u6570\u636E"
    },
    /* @__PURE__ */ React7.createElement(PixelIcon, { name: "refresh", className: "fish-refresh-icon" }),
    /* @__PURE__ */ React7.createElement("span", null, "\u5237\u65B0")
  )), errorMessage && /* @__PURE__ */ React7.createElement("div", { className: "fish-error fish-error-banner", role: "alert" }, /* @__PURE__ */ React7.createElement("p", null, errorMessage), /* @__PURE__ */ React7.createElement("button", { type: "button", className: "fish-icon-button", onClick: dismissError, "aria-label": "\u5173\u95ED\u63D0\u793A" }, /* @__PURE__ */ React7.createElement(PixelIcon, { name: "close" }))), !state && /* @__PURE__ */ React7.createElement(LoadingSkeleton, null), state && /* @__PURE__ */ React7.createElement(
    SettingsBody,
    {
      state,
      activeTab,
      setActiveTab,
      moveTab,
      memoryKind,
      setMemoryKind,
      openMemories,
      isBusy,
      pendingSettings,
      notify,
      setViewedPersonaId,
      submitAction,
      updateSetting
    }
  ), /* @__PURE__ */ React7.createElement("div", { className: "fish-toast-region", role: "status", "aria-live": "polite" }, notice && /* @__PURE__ */ React7.createElement("div", { key: notice.id, className: "fish-toast", "data-tone": notice.tone }, notice.message)));
}
function SettingsBody({
  state,
  activeTab,
  setActiveTab,
  moveTab,
  memoryKind,
  setMemoryKind,
  openMemories,
  isBusy,
  pendingSettings,
  notify,
  setViewedPersonaId,
  submitAction,
  updateSetting
}) {
  const newMemoryIds = useNewMemoryIds(state);
  const viewedPersona = state.personas.find((persona) => persona.id === state.scope.persona);
  const activePersona = state.personas.find((persona) => persona.id === state.activePersona);
  const isViewingRetained = state.scope.persona !== state.activePersona;
  const runningJobs = state.jobs.filter(
    (job) => job.status === "pending" || job.status === "running"
  ).length;
  return /* @__PURE__ */ React7.createElement(React7.Fragment, null, /* @__PURE__ */ React7.createElement("div", { className: "fish-frame" }, /* @__PURE__ */ React7.createElement("div", { className: "fish-toolbar" }, /* @__PURE__ */ React7.createElement("label", { className: "fish-persona-select" }, "\u4F19\u4F34", /* @__PURE__ */ React7.createElement(
    "select",
    {
      value: state.scope.persona,
      disabled: isBusy,
      onChange: (event) => setViewedPersonaId(event.target.value)
    },
    state.personas.map((persona) => /* @__PURE__ */ React7.createElement("option", { key: persona.id, value: persona.id }, displayName(persona.name), persona.id === state.activePersona ? " \xB7 \u6B63\u5728\u966A\u4F60" : " \xB7 \u4EE5\u524D\u7684\u5979"))
  )), state.demo && /* @__PURE__ */ React7.createElement("span", { className: "fish-tag fish-tag-dashed" }, "\u6F14\u793A\u6570\u636E")), isViewingRetained && /* @__PURE__ */ React7.createElement("div", { className: "fish-retained-banner" }, "\u6B63\u5728\u770B\u4EE5\u524D\u7684\u300C", displayName(viewedPersona?.name), "\u300D\uFF1A\u5979\u7684\u8BB0\u5FC6\u90FD\u8FD8\u5728\uFF0C\u4F46\u4E0D\u518D\u53C2\u4E0E\u65B0\u7684\u5BF9\u8BDD\uFF1B\u65B0\u7684\u5BF9\u8BDD\u7531\u300C", displayName(activePersona?.name), "\u300D\u966A\u4F60\u3002", /* @__PURE__ */ React7.createElement(
    "button",
    {
      type: "button",
      className: "fish-text-button",
      onClick: () => setViewedPersonaId(state.activePersona)
    },
    "\u56DE\u5230\u73B0\u5728\u7684\u5979"
  )), /* @__PURE__ */ React7.createElement("nav", { className: "fish-tabs", role: "tablist", "aria-label": "\u63D2\u4EF6\u9875\u9762" }, tabs.map((tab, index) => /* @__PURE__ */ React7.createElement(
    "button",
    {
      key: tab.id,
      type: "button",
      role: "tab",
      id: `fish-tab-${tab.id}`,
      "aria-controls": "fish-tab-content",
      "aria-selected": activeTab === tab.id,
      tabIndex: activeTab === tab.id ? 0 : -1,
      onKeyDown: (event) => moveTab(event, index),
      onClick: () => setActiveTab(tab.id)
    },
    /* @__PURE__ */ React7.createElement(PixelIcon, { name: tab.icon }),
    tab.label,
    tab.id === "memories" && newMemoryIds.size > 0 && activeTab !== "memories" && /* @__PURE__ */ React7.createElement("span", { className: "fish-tab-dot", "aria-label": `${newMemoryIds.size} \u6761\u65B0\u8BB0\u5FC6` })
  ))), /* @__PURE__ */ React7.createElement(
    "div",
    {
      key: activeTab,
      className: "fish-panel",
      id: "fish-tab-content",
      role: "tabpanel",
      "aria-labelledby": `fish-tab-${activeTab}`
    },
    activeTab === "overview" && /* @__PURE__ */ React7.createElement(
      OverviewPanel,
      {
        state,
        isBusy,
        newMemoryIds,
        onOpenMemories: openMemories,
        onRetry: async () => {
          if (await submitAction("retry", {})) notify("\u597D\uFF0C\u6211\u518D\u60F3\u4E00\u60F3");
        }
      }
    ),
    activeTab === "memories" && /* @__PURE__ */ React7.createElement(
      MemoryPanel,
      {
        key: state.scope.persona,
        state,
        selectedKind: memoryKind,
        onSelectKind: setMemoryKind,
        newMemoryIds,
        notify
      }
    ),
    activeTab === "settings" && /* @__PURE__ */ React7.createElement(
      SettingsPanel,
      {
        key: state.scope.persona,
        state,
        isBusy,
        pendingSettings,
        submitAction,
        updateSetting,
        notify,
        onPersonaCreated: (persona) => {
          setViewedPersonaId(persona.id);
          setActiveTab("overview");
          notify(`\u6B22\u8FCE\u300C${persona.name}\u300D`);
        }
      }
    )
  )), /* @__PURE__ */ React7.createElement("footer", { className: "fish-footer" }, /* @__PURE__ */ React7.createElement("span", { "data-active": runningJobs > 0 || void 0 }, /* @__PURE__ */ React7.createElement("i", { "aria-hidden": "true" }), !state.settings.learning ? "\u6682\u65F6\u4E0D\u8BB0\u65B0\u7684\u4E8B" : runningJobs > 0 ? "\u6B63\u5728\u56DE\u60F3\u521A\u624D\u7684\u4E8B" : "\u4F1A\u8BB0\u4F4F\u65B0\u7684\u4E8B"), /* @__PURE__ */ React7.createElement("span", null, state.settings.retrievalMode === "semantic" ? "\u542C\u5F97\u61C2\u6362\u4E2A\u8BF4\u6CD5" : "\u6309\u5173\u952E\u8BCD\u56DE\u5FC6")));
}
var inject = ["slots"];
function apply(context) {
  const slots = context.get("slots");
  if (!slots) {
    return;
  }
  slots.inject(
    "settings.section",
    () => slots.register(
      {
        name: "settings.section",
        id: "fish-brain-patch",
        order: 53,
        label: () => "\u5927\u80A5\u9C7C\u9972\u517B\u624B\u518C"
      },
      () => /* @__PURE__ */ React7.createElement(SettingsSection, null)
    )
  );
}

    return module.exports;
  }
});
