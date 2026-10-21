/* =========================================================
   HELLTAKER DIALOGUE EDITOR
   Local fan-made dialogue / cutscene authoring tool.
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = (prefix = "n") =>
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const pad2 = (n) => String(n).padStart(2, "0");

  const TYPE_LABEL = {
    dialogue: "对话",
    cutscene: "剧情过场",
    title: "标题卡",
    success: "SUCCESS",
    badEnd: "BAD END",
    end: "结束",
  };

  const STORAGE_KEY = "helltaker-dialogue-editor-v1";
  const MUTE_KEY = "helltaker-dialogue-editor-muted";
  const ASSET_DB_NAME = "helltaker-dialogue-editor-assets";
  const ASSET_DB_VERSION = 1;
  const ASSET_STORE = "assets";

  // URL 参数：
  //   ?play=1              纯游玩：隐藏所有编辑 UI，自动从头播放
  //   ?preset=<名称|路径>   载入预设对话：presets/<名称>.json，或完整 URL
  //   ?node=<节点 id>       指定起始节点（配合 play / preset 使用）
  const QUERY = new URLSearchParams(location.search);
  const PLAY_PARAM = QUERY.get("play");
  const PLAY_ONLY = PLAY_PARAM !== null && !["0", "false", "off"].includes(PLAY_PARAM.toLowerCase());
  const PRESET_PARAM = (QUERY.get("preset") || "").trim();

  // 预设项目只读：不写 localStorage / IndexedDB，避免覆盖访客自己的项目。
  let storageLocked = false;

  if (PLAY_ONLY && document.body) document.body.classList.add("play-only");

  /* ---------------------------------------------------------
     Built-in assets
     --------------------------------------------------------- */

  const BOOPER_FRAMES = Array.from(
    { length: 17 },
    (_, i) => `assets/ui/booper/booper-${pad2(i + 1)}.png`
  );

  const ASSET = {
    bgHell: "assets/ui/dialogue-bg-hell.png",
    bgAbyss: "assets/ui/dialogue-bg-abyss.png",
    bgSin: "assets/ui/dialogue-bg-sin.png",
    bgHome: "assets/ui/dialogue-bg-home.png",
    bgThrone: "assets/ui/dialogue-bg-throne.png",
    bgChapter1: "assets/ui/chapter-bg-01.png",
    logo: "assets/ui/helltaker-logo.png",
    placeholder: "assets/ui/portrait-placeholder.svg",
    choiceFrame: "assets/ui/choice-frame.png",
    choiceFrameHover: "assets/ui/choice-frame-hover.png",
    booper: BOOPER_FRAMES,
    // 原版 booper_idle：booper0001..booper0017，24fps，循环。
    booperIdle: BOOPER_FRAMES,
    success: Array.from(
      { length: 16 },
      (_, i) => `assets/ui/success/success-${pad2(i + 1)}.png`
    ),
    badend: Array.from(
      { length: 9 },
      (_, i) => `assets/ui/badend/badend-${pad2(i + 1)}.png`
    ),
    cutscene: Array.from(
      { length: 9 },
      (_, i) => `assets/ui/cutscene/cutscene-${String(i).padStart(4, "0")}.png`
    ),
    // 原版 transition_close（02–21）与 transition_open（22–30）。
    // 运行时用 960px 宽的预加载副本，30fps 播放。
    transitionClose: Array.from(
      { length: 20 },
      (_, i) => `assets/ui/transition/runtime/transition-${String(i + 2).padStart(4, "0")}.png`
    ),
    transitionOpen: Array.from(
      { length: 9 },
      (_, i) => `assets/ui/transition/runtime/transition-${String(i + 22).padStart(4, "0")}.png`
    ),
  };

  const BUILTIN_BACKGROUNDS = [
    { src: ASSET.bgHell, name: "地狱 · 红岩", kind: "背景" },
    { src: ASSET.bgAbyss, name: "深渊", kind: "背景" },
    { src: ASSET.bgSin, name: "罪孽", kind: "背景" },
    { src: ASSET.bgHome, name: "人间 · 房间", kind: "背景" },
    { src: ASSET.bgThrone, name: "王座", kind: "背景" },
    { src: ASSET.bgChapter1, name: "章节背景 01", kind: "背景" },
    { src: "assets/ui/chapter-bg-02.png", name: "章节背景 02", kind: "背景" },
    { src: "assets/ui/chapter-bg-03.png", name: "章节背景 03", kind: "背景" },
    { src: "assets/ui/chapter-bg-04.png", name: "章节背景 04", kind: "背景" },
    { src: "assets/ui/chapter-bg-05.png", name: "章节背景 05", kind: "背景" },
    { src: "assets/ui/chapter-bg-06.png", name: "章节背景 06", kind: "背景" },
    { src: "assets/ui/chapter-bg-07.png", name: "章节背景 07", kind: "背景" },
    { src: "assets/ui/chapter-bg-08.png", name: "章节背景 08", kind: "背景" },
  ];

  // 内置示例素材：AI 绘制的同人图，放在 assets/portraits/，不用上传就能直接选用。
  const SAMPLE_PORTRAITS = [
    { src: "assets/portraits/murasame-1.webp", name: "丛雨 · 叉腰", kind: "立绘" },
    { src: "assets/portraits/murasame-2.webp", name: "丛雨 · 抱臂", kind: "立绘" },
    { src: "assets/portraits/bride-1.webp", name: "梦游神玩 · 墨镜", kind: "立绘" },
    { src: "assets/portraits/bride-2.webp", name: "梦游神玩 · 托腮", kind: "立绘" },
    { src: "assets/portraits/maid-1.webp", name: "我是一个按钮 · 墨镜", kind: "立绘" },
    { src: "assets/portraits/maid-2.webp", name: "我是一个按钮 · 摘镜", kind: "立绘" },
    { src: "assets/portraits/bigfish-1.webp", name: "大肥鱼群友 · 端盘", kind: "立绘" },
    { src: "assets/portraits/bigfish-2.webp", name: "大肥鱼群友 · 叼勺", kind: "立绘" },
    { src: "assets/portraits/aida-1.webp", name: "姓艾大王 · 拿试管", kind: "立绘" },
    { src: "assets/portraits/aida-2.webp", name: "姓艾大王 · 凑近", kind: "立绘" },
    { src: "assets/portraits/xiaoyu-1.webp", name: "小玉 · 比心", kind: "立绘" },
    { src: "assets/portraits/xiaoyu-2.webp", name: "小玉 · 咬手指", kind: "立绘" },
    { src: "assets/portraits/nico-1.webp", name: "尼古嫣嫣 · 站姿", kind: "立绘" },
    { src: "assets/portraits/nico-2.webp", name: "尼古嫣嫣 · 侧身", kind: "立绘" },
    { src: "assets/portraits/xuan-1.webp", name: "轩轩 · 抱文件夹", kind: "立绘" },
    { src: "assets/portraits/xuan-2.webp", name: "轩轩 · 推眼镜", kind: "立绘" },
    { src: "assets/portraits/trio-1.webp", name: "三小只 · 比耶", kind: "立绘" },
    { src: "assets/portraits/trio-2.webp", name: "三小只 · 大笑", kind: "立绘" },
    { src: "assets/portraits/feicui-1.webp", name: "翡翠树 · 张手", kind: "立绘" },
    { src: "assets/portraits/feicui-2.webp", name: "翡翠树 · 端盘", kind: "立绘" },
    { src: "assets/portraits/dragon-1.webp", name: "白龙 · 张牙", kind: "立绘" },
    { src: "assets/portraits/dragon-2.webp", name: "白龙 · 蜷手", kind: "立绘" },
  ];

  const BUILTIN_CUTSCENES = [
    { src: ASSET.cutscene[0], name: "剧情 00 · 王座", kind: "剧情图" },
    { src: ASSET.cutscene[1], name: "剧情 01 · 恶魔", kind: "剧情图" },
    { src: ASSET.cutscene[2], name: "剧情 02 · 惊醒", kind: "剧情图" },
    { src: ASSET.cutscene[3], name: "剧情 03 · 镜子", kind: "剧情图" },
    { src: ASSET.cutscene[4], name: "剧情 04 · 暴怒", kind: "剧情图" },
    { src: ASSET.cutscene[5], name: "剧情 05 · 众人", kind: "剧情图" },
    { src: ASSET.cutscene[6], name: "剧情 06 · 酒吧", kind: "剧情图" },
    { src: ASSET.cutscene[7], name: "剧情 07 · 骷髅", kind: "剧情图" },
    { src: ASSET.cutscene[8], name: "剧情 08 · 聚会", kind: "剧情图" },
  ];

  const BUILTIN_PORTRAITS = [
    { src: ASSET.placeholder, name: "占位剪影 · 替换为你的立绘", kind: "立绘" },
    ...SAMPLE_PORTRAITS,
  ];

  const BUILTIN_ALL = [
    ...BUILTIN_BACKGROUNDS,
    ...BUILTIN_CUTSCENES,
    ...BUILTIN_PORTRAITS,
  ];

  const AUDIO_FILES = {
    start: "assets/audio/dialogue-start.wav",
    textEnd: "assets/audio/text-end.wav",
    move: "assets/audio/choice-move.wav",
    confirm: "assets/audio/choice-confirm.wav",
    success: "assets/audio/success.wav",
    badend: "assets/audio/badend.wav",
    transitionClose: "assets/audio/transition-close.wav",
    transitionOpen: "assets/audio/transition-open.wav",
  };

  /* ---------------------------------------------------------
     Default project
     --------------------------------------------------------- */

  function defaultProject() {
    return {
      version: 1,
      title: "我的 Helltaker 对话",
      settings: { textSpeed: 20 },
      assets: [],
      nodes: [
        {
          id: "n_start",
          type: "cutscene",
          name: "开场 · 惊醒",
          image: ASSET.cutscene[2],
          imageFit: "contain",
          text:
            "你做了一个噩梦，于是被惊醒了。\n你梦见你的租客下地狱了。",
          showIndicator: true,
          next: "n_talk",
        },
        {
          id: "n_talk",
          type: "dialogue",
          name: "PANDEMONICA · 初见",
          speaker: "PANDEMONICA",
          text: "……你终于醒了。\n这里可不是你该待的地方。",
          background: ASSET.bgHell,
          portrait: ASSET.placeholder,
          portraitPos: "center",
          portraitScale: 100,
          checkpoint: true,
          choices: [
            { id: "c_yes", text: "跟你走。", next: "n_success" },
            { id: "c_no", text: "再睡五分钟。", next: "n_bad" },
          ],
          next: "n_success",
        },
        {
          id: "n_success",
          type: "success",
          name: "SUCCESS",
          variant: "normal",
          background: ASSET.bgHell,
          portrait: ASSET.placeholder,
          portraitPos: "center",
          portraitScale: 100,
          speaker: "PANDEMONICA",
          text: "……你终于醒了。\n这里可不是你该待的地方。",
          next: "n_door",
        },
        {
          id: "n_bad",
          type: "badEnd",
          name: "BAD END",
          text: "你选错了。",
          retryNodeId: "n_talk",
        },
        {
          id: "n_door",
          type: "cutscene",
          name: "剧情过场 · 门",
          image: ASSET.cutscene[3],
          imageFit: "contain",
          text: "门后是更深的地狱。",
          showIndicator: true,
          next: "n_after",
        },
        {
          id: "n_after",
          type: "dialogue",
          name: "PANDEMONICA · 继续",
          speaker: "PANDEMONICA",
          text: "别磨蹭了，我们还有很多事要做。",
          background: ASSET.bgHell,
          portrait: ASSET.placeholder,
          portraitPos: "center",
          portraitScale: 100,
          checkpoint: true,
          choices: [],
          next: "n_show",
        },
        {
          id: "n_show",
          type: "dialogue",
          name: "示例 · 三小只",
          speaker: "三小只",
          text: "三小只同样是「立绘」，在右侧「立绘」里选就有。",
          background: ASSET.bgHell,
          portrait: "assets/portraits/trio-1.webp",
          portraitPos: "center",
          portraitScale: 100,
          checkpoint: true,
          choices: [],
          next: "n_show2",
        },
        {
          id: "n_show2",
          type: "dialogue",
          name: "示例 · 立绘",
          speaker: "MURASAME",
          text: "内置示例立绘都在右侧「立绘」里，也可以上传你自己的透明 PNG。",
          background: ASSET.bgThrone,
          portrait: SAMPLE_PORTRAITS[0].src,
          portraitPos: "center",
          portraitScale: 100,
          checkpoint: true,
          choices: [],
          next: "n_end",
        },
        {
          id: "n_end",
          type: "end",
          name: "结束",
          title: "DEMO COMPLETE",
          text: "你的对话流程到这里结束。\n可以继续在编辑器里添加节点。",
          buttonLabel: "重新开始",
        },
      ],
    };
  }

  /* ---------------------------------------------------------
     State
     --------------------------------------------------------- */

  let project = loadProject();
  let selectedId = project.nodes[0]?.id ?? null;
  let playing = false;
  let runtime = {};
  let transitionActive = false;
  let transitionCancel = null;
  let transitionSwapping = false;
  let saveTimer = null;
  let stageTimer = null;
  let toastTimer = null;
  let assetPicker = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let gameMusicEnabled = false;
  let gameSfxEnabled = false;
  const audioObjects = {};
  const bgm = new Audio("assets/audio/Vitality.mp3");
  bgm.loop = true;
  bgm.volume = 0.32;
  bgm.preload = "auto";

  const els = {};

  /* ---------------------------------------------------------
     Normalization / storage
     --------------------------------------------------------- */

  function normalizeProject(raw) {
    if (!raw || typeof raw !== "object") return defaultProject();
    const p = clone(raw);
    if (!Array.isArray(p.nodes) || p.nodes.length === 0) return defaultProject();
    const sourceVersion = Number(raw.version) || 1;
    p.version = 2;
    p.title = typeof p.title === "string" && p.title.trim() ? p.title : "我的 Helltaker 对话";
    p.settings = Object.assign({ textSpeed: 20 }, p.settings || {});
    p.settings.textSpeed = clamp(Number(p.settings.textSpeed) || 20, 8, 80);
    p.assets = Array.isArray(p.assets)
      ? p.assets
          .filter((a) => a && typeof a.id === "string" && a.id)
          .map((a) => {
            const asset = {
              id: a.id,
              name: typeof a.name === "string" && a.name ? a.name : "上传图片",
            };
            if (typeof a.data === "string" && a.data.startsWith("data:")) asset.data = a.data;
            return asset;
          })
      : [];

    const seen = new Set();
    p.nodes = p.nodes
      .filter((n) => n && typeof n === "object")
      .map((n, index) => {
        let id = typeof n.id === "string" && n.id ? n.id : uid("n");
        while (seen.has(id)) id = uid("n");
        seen.add(id);
        const type = TYPE_LABEL[n.type] ? n.type : "dialogue";
        const node = {
          id,
          type,
          name: typeof n.name === "string" && n.name ? n.name : `节点 ${index + 1}`,
        };

        if (type === "dialogue") {
          node.speaker = typeof n.speaker === "string" ? n.speaker : "";
          node.text = typeof n.text === "string" ? n.text : "";
          node.background = n.background || ASSET.bgHell;
          node.portrait = n.portrait || "";
          node.portraitPos = ["center", "left", "right"].includes(n.portraitPos)
            ? n.portraitPos
            : "center";
          node.portraitScale = clamp(Number(n.portraitScale) || 100, 40, 130);
          node.checkpoint = n.checkpoint !== false;
          node.choices = Array.isArray(n.choices)
            ? n.choices.map((c, ci) => ({
                id: typeof c.id === "string" && c.id ? c.id : uid("c"),
                text: typeof c.text === "string" ? c.text : "",
                next: typeof c.next === "string" ? c.next : "",
              }))
            : [];
          node.next = typeof n.next === "string" ? n.next : "";
        } else if (type === "cutscene") {
          node.image = n.image || ASSET.cutscene[2];
          node.imageFit = ["contain", "cover", "fill"].includes(n.imageFit)
            ? n.imageFit
            : "contain";
          node.text = typeof n.text === "string" ? n.text : "";
          node.showIndicator = n.showIndicator !== false;
          node.next = typeof n.next === "string" ? n.next : "";
        } else if (type === "title") {
          node.background = n.background || ASSET.bgChapter1;
          node.showLogo = n.showLogo !== false;
          node.title = typeof n.title === "string" ? n.title : "HELLTAKER";
          node.subtitle = typeof n.subtitle === "string" ? n.subtitle : "";
          node.next = typeof n.next === "string" ? n.next : "";
        } else if (type === "success") {
          node.variant = n.variant === "glorious" ? "glorious" : "normal";
          node.background = typeof n.background === "string" && n.background
            ? n.background
            : (typeof n.image === "string" ? n.image : "");
          node.portrait = typeof n.portrait === "string" ? n.portrait : "";
          node.portraitPos = ["center", "left", "right"].includes(n.portraitPos) ? n.portraitPos : "center";
          node.portraitScale = clamp(Number(n.portraitScale) || 100, 40, 130);
          node.speaker = typeof n.speaker === "string" ? n.speaker : "";
          node.text = typeof n.text === "string" ? n.text : "";
          if (node.text === "你做出了正确的选择。") node.text = "";
          node.next = typeof n.next === "string" ? n.next : "";
        } else if (type === "badEnd") {
          node.text = typeof n.text === "string" ? n.text : "";
          node.retryNodeId = typeof n.retryNodeId === "string" ? n.retryNodeId : "";
        } else if (type === "end") {
          node.title = typeof n.title === "string" ? n.title : "END";
          node.text = typeof n.text === "string" ? n.text : "";
          node.buttonLabel = typeof n.buttonLabel === "string" ? n.buttonLabel : "重新开始";
        }
        return node;
      });

    if (p.nodes.length === 0) return defaultProject();

    // Version 1 SUCCESS nodes had no portrait/message and sometimes used the
    // old chapter background. Reuse the preceding dialogue once; later saves
    // keep deliberate clears instead of re-filling them on every load.
    if (sourceVersion < 2) {
      for (const node of p.nodes) {
        if (node.type !== "success") continue;
        const prev = p.nodes.find((candidate) =>
          candidate.next === node.id ||
          (candidate.type === "dialogue" && candidate.choices?.some((choice) => choice.next === node.id))
        );
        const oldDefaultBackdrop = !node.background || node.background === ASSET.bgChapter1;
        if (oldDefaultBackdrop) node.background = prev?.background || prev?.image || ASSET.bgHell;
        if (prev?.type === "dialogue") {
          if (!node.portrait) {
            node.portrait = prev.portrait || "";
            node.portraitPos = prev.portraitPos || "center";
            node.portraitScale = prev.portraitScale || 100;
          }
          if (!node.speaker) node.speaker = prev.speaker || "";
          if (!node.text) node.text = prev.text || "";
        }
      }
    }
    return p;
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProject();
      return normalizeProject(JSON.parse(raw));
    } catch (error) {
      console.warn("Project load failed", error);
      return defaultProject();
    }
  }

  // ?preset=demo → presets/demo.json；也可以直接写路径或完整 URL。
  function presetUrl(value) {
    if (/^(?:https?:)?\/\//i.test(value)) return value;
    if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return value;
    if (value.toLowerCase().endsWith(".json")) return value;
    return "presets/" + value + ".json";
  }

  async function loadPresetProject() {
    const url = presetUrl(PRESET_PARAM);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}（${url}）`);
    const raw = await response.json();
    if (!raw || !Array.isArray(raw.nodes) || raw.nodes.length === 0) {
      throw new Error("JSON 里没有节点（" + url + "）");
    }
    return normalizeProject(raw);
  }

  function saveNow(showToast = false) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (storageLocked) {
      setSaveStatus("预设项目 · 不自动保存", false);
      if (showToast) toast("预设项目不会写入本地存储，请用「导出 JSON」保存", true);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveStatus("已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
      if (showToast) toast("项目已保存到浏览器本地存储");
    } catch (error) {
      console.warn("Project save failed", error);
      setSaveStatus("存储已满，请导出 JSON", true);
      if (showToast) toast("保存失败：浏览器本地存储已满，请导出 JSON 备份", true);
    }
  }

  function scheduleSave() {
    if (storageLocked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(false), 380);
  }

  function setSaveStatus(text, isError = false) {
    if (!els.saveStatus) return;
    els.saveStatus.textContent = text;
    els.saveStatus.classList.toggle("error", !!isError);
  }

  /* ---------------------------------------------------------
     Uploaded assets (IndexedDB, no size cap)
     --------------------------------------------------------- */

  let assetDbPromise = null;
  const assetUrls = new Map(); // id -> blob: URL
  const assetBlobs = new Map(); // id -> Blob (export / fallback)

  function dataUrlToBlob(dataUrl) {
    try {
      const text = String(dataUrl);
      const comma = text.indexOf(",");
      if (comma < 0) return null;
      const meta = text.slice(0, comma);
      const body = text.slice(comma + 1);
      const mime = (/data:([^;]+)/.exec(meta) || [])[1] || "image/png";
      const isBase64 = /;base64/i.test(meta);
      const binary = isBase64 ? atob(body) : decodeURIComponent(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch (error) {
      console.warn("dataUrlToBlob failed", error);
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  }

  function openAssetDb() {
    if (assetDbPromise) return assetDbPromise;
    assetDbPromise = new Promise((resolve) => {
      if (!("indexedDB" in window)) return resolve(null);
      let request;
      try {
        request = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION);
      } catch (error) {
        console.warn("IndexedDB open failed", error);
        return resolve(null);
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("IndexedDB unavailable", request.error);
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    });
    return assetDbPromise;
  }

  async function dbPutAsset(record) {
    const db = await openAssetDb();
    if (!db) throw new Error("IndexedDB unavailable");
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, "readwrite");
      tx.objectStore(ASSET_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("put failed"));
      tx.onabort = () => reject(tx.error || new Error("put aborted"));
    });
  }

  async function dbGetAsset(id) {
    const db = await openAssetDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, "readonly");
      const request = tx.objectStore(ASSET_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbClearAssets() {
    const db = await openAssetDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, "readwrite");
      tx.objectStore(ASSET_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function attachAssetUrl(id, blob) {
    assetBlobs.set(id, blob);
    const previous = assetUrls.get(id);
    if (previous) URL.revokeObjectURL(previous);
    assetUrls.set(id, URL.createObjectURL(blob));
  }

  async function storeAssetBlob(blob, { id, name }) {
    try {
      await dbPutAsset({
        id,
        name,
        blob,
        type: blob.type || "",
        size: blob.size || 0,
        addedAt: Date.now(),
      });
      attachAssetUrl(id, blob);
      return true;
    } catch (error) {
      console.warn("IndexedDB store failed", error);
      return false;
    }
  }

  async function initAssetStorage() {
    const db = await openAssetDb();
    let migrated = 0;
    for (const asset of project.assets) {
      if (assetUrls.has(asset.id)) continue;
      const stored = db ? await dbGetAsset(asset.id).catch(() => null) : null;
      if (stored && stored.blob) {
        attachAssetUrl(asset.id, stored.blob);
      } else if (typeof asset.data === "string" && asset.data.startsWith("data:")) {
        const blob = dataUrlToBlob(asset.data);
        if (!blob) continue;
        const ok = db ? await storeAssetBlob(blob, { id: asset.id, name: asset.name }) : false;
        if (!ok) attachAssetUrl(asset.id, blob);
        migrated += 1;
      }
    }
    // 迁移成功后从项目 JSON 里剔除 data:URL，localStorage 只留元数据。
    let changed = false;
    if (db) {
      for (const asset of project.assets) {
        if (typeof asset.data === "string" && assetUrls.has(asset.id)) {
          delete asset.data;
          changed = true;
        }
      }
    }
    if (migrated) {
      setSaveStatus("素材已迁移到浏览器数据库");
      if (changed) saveNow(false);
    }
  }

  function clearAssetCache() {
    for (const url of assetUrls.values()) URL.revokeObjectURL(url);
    assetUrls.clear();
    assetBlobs.clear();
  }

  /* ---------------------------------------------------------
     DOM / init
     --------------------------------------------------------- */

  function cacheEls() {
    els.projectTitle = $("#project-title");
    els.nodeList = $("#node-list");
    els.nodeCount = $("#node-count");
    els.newNodeType = $("#new-node-type");
    els.btnAddNode = $("#btn-add-node");
    els.btnSave = $("#btn-save");
    els.saveStatus = $("#save-status");
    els.stage = $("#stage");
    els.stageView = $("#stage-view");
    els.stageBadge = $("#stage-badge");
    els.stageModeLabel = $("#stage-mode-label");
    els.stageNodeLabel = $("#stage-node-label");
    els.stageHint = $("#stage-hint");
    els.btnPlayHere = $("#btn-play-here");
    els.btnPlayStart = $("#btn-play-start");
    els.btnStop = $("#btn-stop");
    els.btnFocus = $("#btn-focus");
    els.muteCheckbox = $("#mute-checkbox");
    els.gameMusicBtn = $("#btn-game-music");
    els.gameSfxBtn = $("#btn-game-sfx");
    els.inspectorBody = $("#inspector-body");
    els.inspectorType = $("#inspector-type");
    els.modalRoot = $("#modal-root");
    els.toast = $("#toast");
  }

  async function init() {
    cacheEls();
    bindEvents();
    preloadAnimationAssets();
    els.muteCheckbox.checked = muted;
    updateGameAudioUI();

    let preset = null;
    let presetError = null;
    if (PRESET_PARAM) {
      try {
        preset = await loadPresetProject();
      } catch (error) {
        presetError = error;
        console.warn("Preset load failed", error);
      }
    }

    if (preset) {
      project = preset;
      storageLocked = true;
      selectedId = project.nodes[0]?.id ?? null;
      clearAssetCache();
    } else {
      await initAssetStorage();
    }

    const nodeParam = QUERY.get("node");
    if (nodeParam && getNode(nodeParam)) selectedId = nodeParam;

    updateDocumentTitle();
    renderAll();

    if (preset) {
      setSaveStatus("预设项目 · 不自动保存");
    } else if (presetError) {
      setSaveStatus("预设载入失败，已回退本地项目", true);
      toast("预设载入失败：" + (presetError.message || "未知错误"), true);
    } else {
      setSaveStatus("已载入");
      if (!localStorage.getItem(STORAGE_KEY)) saveNow(false);
    }

    if (PLAY_ONLY) {
      if (presetError && !preset) {
        showPresetError(presetError);
      } else {
        const startId = selectedId || project.nodes[0]?.id;
        if (startId) requestAnimationFrame(() => playFrom(startId));
      }
    }
  }

  function bindEvents() {
    els.projectTitle.addEventListener("input", () => {
      project.title = els.projectTitle.value;
      updateDocumentTitle();
      scheduleSave();
    });

    $("#btn-new").addEventListener("click", newProject);
    $("#btn-import").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", importProject);
    $("#btn-export").addEventListener("click", exportProject);
    $("#btn-help").addEventListener("click", openHelp);

    els.btnSave.addEventListener("click", () => saveNow(true));
    els.btnAddNode.addEventListener("click", () => addNode(els.newNodeType.value));

    els.btnPlayHere.addEventListener("click", () => {
      if (selectedId) playFrom(selectedId);
    });
    els.btnPlayStart.addEventListener("click", () => {
      if (project.nodes[0]) playFrom(project.nodes[0].id);
    });
    els.btnStop.addEventListener("click", () => stopPlayback());
    els.btnFocus.addEventListener("click", toggleFocus);

    els.muteCheckbox.addEventListener("change", () => {
      setMuted(els.muteCheckbox.checked);
    });

    els.gameMusicBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      gameMusicEnabled = !gameMusicEnabled;
      if (gameMusicEnabled && muted) setMuted(false);
      updateGameAudioUI();
      syncGameMusic();
    });
    els.gameSfxBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      gameSfxEnabled = !gameSfxEnabled;
      if (gameSfxEnabled && muted) setMuted(false);
      updateGameAudioUI();
    });

    els.nodeList.addEventListener("click", onNodeListClick);
    els.inspectorBody.addEventListener("input", onInspectorInput);
    els.inspectorBody.addEventListener("change", onInspectorChange);
    els.inspectorBody.addEventListener("click", onInspectorClick);

    els.stage.addEventListener("click", onStageClick);
    els.stage.addEventListener("pointerover", onStagePointerOver);

    els.modalRoot.addEventListener("click", onModalClick);
    els.modalRoot.addEventListener("change", onModalChange);

    document.addEventListener("keydown", onKeyDown);

    window.addEventListener("beforeunload", () => {
      if (saveTimer) saveNow(false);
    });
  }

  function updateDocumentTitle() {
    document.title = (project.title || "Helltaker Dialogue Editor") + " · Helltaker Dialogue Editor";
  }

  function toggleFocus() {
    const on = document.body.classList.toggle("focus-stage");
    els.btnFocus.textContent = on ? "退出专注" : "专注";
    els.btnFocus.classList.toggle("primary", on);
  }

  /* ---------------------------------------------------------
     Rendering — shell
     --------------------------------------------------------- */

  function renderAll() {
    els.projectTitle.value = project.title;
    renderNodeList();
    renderInspector();
    renderStage();
  }

  function renderNodeList() {
    els.nodeCount.textContent = pad2(project.nodes.length);
    els.nodeList.innerHTML = project.nodes
      .map((node, index) => {
        const selected = node.id === selectedId;
        const isPlaying = playing && node.id === runtime.nodeId;
        return `
          <div class="node-row type-${esc(node.type)} ${selected ? "selected" : ""} ${isPlaying ? "playing" : ""}" data-node-id="${esc(node.id)}">
            <div class="node-index">${pad2(index + 1)}</div>
            <div class="node-main">
              <span class="node-name">${esc(nodeLabel(node))}</span>
              <span class="node-sub"><span class="dot"></span>${esc(TYPE_LABEL[node.type] || "节点")}</span>
            </div>
            <div class="node-tools">
              <button class="node-tool" type="button" data-node-action="up" title="上移">↑</button>
              <button class="node-tool" type="button" data-node-action="down" title="下移">↓</button>
              <button class="node-tool" type="button" data-node-action="duplicate" title="复制">⧉</button>
              <button class="node-tool danger" type="button" data-node-action="delete" title="删除">×</button>
            </div>
          </div>`;
      })
      .join("");

    const selectedEl = $(".node-row.selected", els.nodeList);
    if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" });
  }

  function renderStage() {
    if (playing) return;
    stopTimers();
    const node = getNode(selectedId);
    if (!node) {
      els.stageView.innerHTML = `<div class="scene scene-end"><div class="end-bg"></div><div class="end-content"><div class="end-kicker">NO NODE</div><h2 class="end-title">EMPTY</h2><div class="end-rule"></div><p class="end-text">左侧还没有节点。添加一个对话开始。</p></div></div>`;
      els.stageModeLabel.textContent = "PREVIEW";
      els.stageNodeLabel.textContent = "—";
      return;
    }
    els.stageView.innerHTML = sceneHTML(node, {
      mode: "edit",
      previousNode: findPreviousNode(node.id),
    });
    fillStaticPreview(node);
    els.stageBadge.textContent = "PREVIEW";
    els.stageModeLabel.textContent = "PREVIEW";
    els.stageNodeLabel.textContent = nodeLabel(node);
    els.stageHint.textContent = "选择左侧节点编辑。点击“从当前播放”或按空格试玩。";
  }

  /* ---------------------------------------------------------
     Rendering — inspector
     --------------------------------------------------------- */

  function renderInspector() {
    const node = getNode(selectedId);
    if (!node) {
      els.inspectorType.textContent = "—";
      els.inspectorBody.innerHTML = `<div class="choice-empty">没有选中的节点</div>`;
      return;
    }
    els.inspectorType.textContent = TYPE_LABEL[node.type] || "NODE";
    const parts = [];

    parts.push(`
      <div class="insp-section">
        <h3 class="insp-title">NODE</h3>
        ${fieldText("节点名称", "name", node.name)}
        <div class="field">
          <label>类型</label>
          <div class="asset-kind">${esc(TYPE_LABEL[node.type] || node.type)} · ${esc(node.id)}</div>
        </div>
      </div>
    `);

    if (node.type === "dialogue") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">DIALOGUE</h3>
          ${fieldText("说话者", "speaker", node.speaker, "留空则只显示正文")}
          ${fieldArea("正文", "text", node.text, 4)}
          ${assetField("背景", "background", node.background, "background")}
          ${assetField("立绘", "portrait", node.portrait, "portrait")}
          <div class="field-row">
            ${fieldSelect("立绘位置", "portraitPos", [
              ["center", "居中"],
              ["left", "左侧"],
              ["right", "右侧"],
            ], node.portraitPos)}
            ${fieldRange("立绘缩放", "portraitScale", node.portraitScale, 40, 130, 1)}
          </div>
          ${fieldCheck("设为复活点（死亡后回到这里）", "checkpoint", node.checkpoint !== false)}
        </div>
      `);

      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">CHOICES</h3>
          <div class="choice-edit-list">
            ${node.choices.length ? node.choices.map((choice, i) => choiceEditor(choice, i)).join("") : `<div class="choice-empty">没有选项。玩家点击正文继续。</div>`}
          </div>
          <button class="btn small choice-add" type="button" data-action="add-choice" ${node.choices.length >= 4 ? "disabled" : ""}>+ 添加选项</button>
          <div class="warn-text">${node.choices.length >= 4 ? "最多 4 个选项，保证版面不溢出。" : "每个选项都可以指向任意节点。指向 BAD END 就能做死亡分支。"}</div>
        </div>
      `);
    } else if (node.type === "cutscene") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">剧情过场</h3>
          ${assetField("画面", "image", node.image, "image")}
          ${fieldArea("旁白", "text", node.text, 4)}
          ${fieldCheck("显示点击指示器（红眼）", "showIndicator", node.showIndicator !== false)}
          ${fieldSelect("画面适配", "imageFit", [
            ["contain", "完整显示（留黑边）"],
            ["cover", "铺满（裁切）"],
            ["fill", "拉伸"],
          ], node.imageFit)}
          <div class="warn-text">“剧情过场”只有“画面”。立绘和背景属于“对话”节点；需要人物时，请接一个对话节点。</div>
        </div>
      `);
    } else if (node.type === "title") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">TITLE CARD</h3>
          ${assetField("背景", "background", node.background, "background")}
          ${fieldCheck("显示 HELLTAKER 标志", "showLogo", node.showLogo !== false)}
          ${fieldText("标题文字（未显示标志时使用）", "title", node.title)}
          ${fieldText("副标题", "subtitle", node.subtitle)}
        </div>
      `);
    } else if (node.type === "success") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">SUCCESS</h3>
          ${assetField("背景", "background", node.background, "background")}
          ${assetField("立绘", "portrait", node.portrait, "portrait")}
          <div class="field-row">
            ${fieldSelect("立绘位置", "portraitPos", [
              ["center", "居中"],
              ["left", "左侧"],
              ["right", "右侧"],
            ], node.portraitPos)}
            ${fieldRange("立绘缩放", "portraitScale", node.portraitScale, 40, 130, 1)}
          </div>
          ${fieldSelect("动画版本", "variant", [
            ["normal", "SUCCESS"],
            ["glorious", "GLORIOUS SUCCESS"],
          ], node.variant)}
          ${fieldText("留言人物（可留空）", "speaker", node.speaker)}
          ${fieldArea("人物留言（可留空）", "text", node.text, 3)}
          <button class="btn small ghost" type="button" data-action="sync-success">沿用上一个对话（背景 / 立绘 / 留言）</button>
          <div class="warn-text">背景和立绘与“对话”节点使用同一套参数；留空时会尽量沿用上一个对话。动画结束后点击舞台 / 空格继续。</div>
        </div>
      `);
    } else if (node.type === "badEnd") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">BAD END</h3>
          ${fieldArea("死亡文字（可留空）", "text", node.text, 3)}
          ${fieldSelect("重试目标", "retryNodeId", nodeOptions(node.retryNodeId, "上次对话（自动）"), node.retryNodeId, true)}
          <div class="warn-text">默认回到最近一次经过的对话节点；也可以指定固定节点。</div>
        </div>
      `);
    } else if (node.type === "end") {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">ENDING</h3>
          ${fieldText("标题", "title", node.title)}
          ${fieldArea("结束文字", "text", node.text, 4)}
          ${fieldText("按钮文字", "buttonLabel", node.buttonLabel)}
        </div>
      `);
    }

    if (["dialogue", "cutscene", "title", "success"].includes(node.type)) {
      parts.push(`
        <div class="insp-section">
          <h3 class="insp-title">FLOW</h3>
          ${fieldSelect("下一个节点", "next", nodeOptions(node.next), node.next, true)}
          ${node.next && !getNode(node.next) ? `<div class="warn-text">目标节点不存在，请重新选择。</div>` : ""}
        </div>
      `);
    }

    parts.push(`
      <div class="insp-section">
        <h3 class="insp-title">PROJECT</h3>
        ${fieldRange("默认文字速度", "settings.textSpeed", project.settings.textSpeed, 8, 80, 1, true)}
        <div class="field"><span class="hint">数值越小，打字越快。每个节点共用这个速度。</span></div>
      </div>
    `);

    parts.push(`
      <div class="insp-section">
        <h3 class="insp-title">NODE ACTIONS</h3>
        <div class="insp-node-actions">
          <button class="btn small ghost" type="button" data-action="duplicate-node">复制节点</button>
          <button class="btn small ghost" type="button" data-action="delete-node">删除节点</button>
        </div>
      </div>
    `);

    els.inspectorBody.innerHTML = parts.join("");
  }

  function fieldText(label, field, value, hint = "") {
    return `<div class="field"><label>${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</label><input type="text" data-field="${field}" value="${esc(value)}" spellcheck="false"></div>`;
  }

  function fieldArea(label, field, value, rows = 3, hint = "") {
    return `<div class="field"><label>${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</label><textarea data-field="${field}" rows="${rows}" spellcheck="false">${esc(value)}</textarea></div>`;
  }

  function fieldSelect(label, field, options, value, allowEmpty = false) {
    const opts = Array.isArray(options)
      ? options.map(([v, labelText]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(labelText)}</option>`).join("")
      : options;
    const empty = allowEmpty && !Array.isArray(options)
      ? ""
      : "";
    return `<div class="field"><label>${esc(label)}</label><select data-field="${field}">${empty}${opts}</select></div>`;
  }

  function fieldRange(label, field, value, min, max, step, isSetting = false) {
    return `<div class="field"><label>${esc(label)}<span class="hint">${esc(String(value))}</span></label><input type="range" ${isSetting ? `data-setting="${field}"` : `data-field="${field}"`} min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }

  function fieldCheck(label, field, checked) {
    return `<label class="check-row"><input type="checkbox" data-field="${field}" ${checked ? "checked" : ""}> ${esc(label)}</label>`;
  }

  function assetField(label, target, src, kind) {
    const srcValue = src || "";
    const name = srcValue ? assetName(srcValue) : "未选择";
    const thumb = srcValue
      ? `<img class="${target === "portrait" ? "contain" : ""}" src="${esc(resolveAsset(srcValue))}" alt="">`
      : `<span class="asset-kind">—</span>`;
    return `
      <div class="field">
        <label>${esc(label)}</label>
        <div class="asset-field" data-target="${target}" data-kind="${kind}" title="点击缩略图也可以更换">
          <div class="asset-thumb">${thumb}</div>
          <div class="asset-meta">
            <div class="asset-name">${esc(name)}</div>
            <div class="asset-kind">${esc(kind === "portrait" ? "PNG / 透明立绘" : kind === "background" ? "背景图" : "画面")}</div>
          </div>
          <div class="asset-actions">
            <button class="mini-btn" type="button" data-action="pick-asset" data-target="${target}" data-kind="${kind}">选择</button>
            ${srcValue ? `<button class="mini-btn" type="button" data-action="clear-asset" data-target="${target}">清除</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function choiceEditor(choice, index) {
    return `
      <div class="choice-edit" data-choice-id="${esc(choice.id)}">
        <div class="choice-edit-top">
          <input type="text" data-choice-field="text" value="${esc(choice.text)}" placeholder="选项 ${index + 1}" spellcheck="false">
          <button class="mini-btn danger" type="button" data-action="del-choice" title="删除选项">×</button>
        </div>
        <div class="choice-edit-bottom">
          <select data-choice-field="next">${nodeOptions(choice.next)}</select>
        </div>
      </div>`;
  }

  function nodeOptions(selected, emptyLabel = "（未设置）") {
    return `<option value="" ${!selected ? "selected" : ""}>${esc(emptyLabel)}</option>` +
      project.nodes.map((node, i) =>
        `<option value="${esc(node.id)}" ${node.id === selected ? "selected" : ""}>${pad2(i + 1)} · ${esc(nodeLabel(node))} [${esc(TYPE_LABEL[node.type] || node.type)}]</option>`
      ).join("");
  }

  function nodeLabel(node) {
    if (!node) return "—";
    return node.name || TYPE_LABEL[node.type] || "未命名";
  }

  function markPlayingNode(id) {
    $$(".node-row", els.nodeList).forEach((row) => {
      row.classList.toggle("playing", !!id && row.dataset.nodeId === id);
    });
  }

  function getNode(id) {
    return project.nodes.find((n) => n.id === id) || null;
  }

  function nodeIndex(id) {
    return project.nodes.findIndex((n) => n.id === id);
  }

  function findPreviousNode(id) {
    for (const node of project.nodes) {
      if (node.next === id) return node;
      if (node.type === "dialogue" && node.choices?.some((c) => c.next === id)) return node;
    }
    const index = nodeIndex(id);
    return index > 0 ? project.nodes[index - 1] : null;
  }

  function syncSuccessFromDialogue(node, dialogue) {
    if (!node || node.type !== "success" || !dialogue || dialogue.type !== "dialogue") return false;
    node.background = dialogue.background || node.background || ASSET.bgHell;
    node.portrait = dialogue.portrait || "";
    node.portraitPos = dialogue.portraitPos || "center";
    node.portraitScale = dialogue.portraitScale || 100;
    node.speaker = dialogue.speaker || "";
    node.text = dialogue.text || "";
    return true;
  }

  /* ---------------------------------------------------------
     Rendering — stage scenes
     --------------------------------------------------------- */

  function sceneHTML(node, { mode = "edit", previousNode = null } = {}) {
    if (!node) return "";
    switch (node.type) {
      case "cutscene":
        return cutsceneHTML(node);
      case "dialogue":
        return dialogueHTML(node, mode);
      case "title":
        return titleHTML(node);
      case "success":
        return successHTML(node, previousNode);
      case "badEnd":
        return badEndHTML(node);
      case "end":
        return endHTML(node);
      default:
        return "";
    }
  }

  function cutsceneHTML(node) {
    const src = resolveAsset(node.image || ASSET.cutscene[2]);
    const fit = node.imageFit || "contain";
    return `
      <div class="scene scene-cutscene">
        <div class="cutscene-frame ${esc(fit)}" data-edit-asset="image" title="点击更换画面">
          <img src="${esc(src)}" alt="">
        </div>
        <div class="cutscene-copy">
          <p class="js-type"></p>
          <div class="js-indicator"></div>
          <div class="click-hint js-hint">CLICK / SPACE</div>
        </div>
      </div>`;
  }

  function dialogueHTML(node, mode) {
    const bg = resolveAsset(node.background || ASSET.bgHell);
    const portrait = node.portrait ? resolveAsset(node.portrait) : "";
    const pos = node.portraitPos || "center";
    const scale = clamp(Number(node.portraitScale) || 100, 40, 130) / 100;
    const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
    const choices = hasChoices
      ? node.choices.map((choice) =>
          `<button class="choice" type="button" data-choice-id="${esc(choice.id)}" title="${mode === "play" ? "选择" : "试玩时可点击"}">${esc(choice.text || "（空选项）")}</button>`
        ).join("")
      : "";
    return `
      <div class="scene scene-dialogue">
        <div class="dialogue-bg" data-edit-asset="background" title="点击更换背景"><img src="${esc(bg)}" alt=""></div>
        <div class="dialogue-vignette"></div>
        ${portrait ? `<div class="dialogue-portrait ${esc(pos)}" data-edit-asset="portrait" title="点击更换立绘" style="--portrait-scale:${scale}"><img src="${esc(portrait)}" alt=""></div>` : ""}
        <div class="dialogue-panel ${hasChoices ? "has-choices" : "no-choices"}">
          ${node.speaker ? `<div class="speaker">• ${esc(node.speaker)} •</div>` : `<div class="speaker" style="visibility:hidden">• •</div>`}
          <p class="dialogue-text js-type"></p>
          <div class="choices js-choices" ${mode === "play" ? "hidden" : ""}>${choices}</div>
          <div class="dialogue-indicator js-indicator"></div>
        </div>
      </div>`;
  }

  function successHTML(node, previousNode) {
    const backdrop = getSuccessBackdrop(node, previousNode);
    const background = node.background || backdrop.background || ASSET.bgHell;
    const bg = resolveAsset(background);
    const portrait = node.portrait ? resolveAsset(node.portrait) : "";
    const pos = node.portraitPos || "center";
    const scale = clamp(Number(node.portraitScale) || 100, 40, 130) / 100;
    const variant = node.variant === "glorious" ? "glorious" : "normal";
    const frames = variant === "glorious" ? ASSET.success.slice(8) : ASSET.success.slice(0, 8);
    return `
      <div class="scene scene-success" data-frames="${esc(frames.join("|"))}">
        <div class="success-bg" data-edit-asset="background" title="点击更换背景"><img src="${esc(bg)}" alt=""></div>
        <div class="success-dim"></div>
        ${portrait ? `<div class="success-portrait ${esc(pos)}" data-edit-asset="portrait" title="点击更换立绘" style="--portrait-scale:${scale}"><img src="${esc(portrait)}" alt=""></div>` : ""}
        <div class="success-content">
          ${node.speaker ? `<div class="success-speaker">• ${esc(node.speaker)} •</div>` : ""}
          ${node.text ? `<p class="success-line">${esc(node.text)}</p>` : ""}
          <div class="success-anim-wrap"><img class="success-anim js-anim" alt=""></div>
        </div>
        <div class="success-hint js-hint">CLICK / SPACE</div>
      </div>`;
  }

  function badEndHTML(node) {
    return `
      <div class="scene scene-badend">
        <div class="badend-bg"></div>
        <div class="badend-content">
          <div class="badend-anim-wrap"><img class="badend-anim js-anim" alt=""></div>
          ${node.text ? `<p class="badend-text">${esc(node.text)}</p>` : ""}
          <div class="badend-actions js-actions" hidden>
            <button class="hs-btn" type="button" data-action="retry">回到上次对话</button>
            <button class="hs-btn" type="button" data-action="restart">从头开始</button>
          </div>
        </div>
      </div>`;
  }

  function endHTML(node) {
    return `
      <div class="scene scene-end">
        <div class="end-bg"></div>
        <div class="end-content">
          <div class="end-kicker">THE END</div>
          <h2 class="end-title">${esc(node.title || "END")}</h2>
          <div class="end-rule"></div>
          <p class="end-text">${esc(node.text || "")}</p>
          <div class="end-actions">
            <button class="hs-btn" type="button" data-action="restart">${esc(node.buttonLabel || "重新开始")}</button>
            ${PLAY_ONLY ? "" : `<button class="hs-btn ghost" type="button" data-action="stop">返回编辑</button>`}
          </div>
        </div>
      </div>`;
  }

  function titleHTML(node) {
    const bg = resolveAsset(node.background || ASSET.bgChapter1);
    return `
      <div class="scene scene-title">
        <div class="title-bg" data-edit-asset="background" title="点击更换背景"><img src="${esc(bg)}" alt=""></div>
        <div class="title-dim"></div>
        <div class="title-content">
          ${node.showLogo !== false
            ? `<img class="title-logo" src="${esc(ASSET.logo)}" alt="HELLTAKER">`
            : `<h2 class="end-title">${esc(node.title || "HELLTAKER")}</h2>`}
          ${node.subtitle ? `<div class="title-sub">${esc(node.subtitle)}</div>` : ""}
          <div class="title-actions"><button class="hs-btn" type="button" data-action="start">开始</button></div>
        </div>
      </div>`;
  }

  function getSuccessBackdrop(node, previousNode) {
    const prev = previousNode || findPreviousNode(node.id);
    if (prev && prev.type === "dialogue") {
      return { background: prev.background, portrait: prev.portrait };
    }
    if (prev && prev.type === "cutscene") {
      return { background: prev.image, portrait: "" };
    }
    if (prev && prev.type === "title") {
      return { background: prev.background, portrait: "" };
    }
    return { background: ASSET.bgHell, portrait: "" };
  }

  function fillStaticPreview(node) {
    const textEl = $(".js-type", els.stageView);
    if (textEl) textEl.textContent = node.text || "";
    if (node.type === "cutscene") {
      if (node.showIndicator !== false) renderStaticBooper($(".js-indicator", els.stageView));
      const hint = $(".js-hint", els.stageView);
      if (hint) hint.classList.add("is-visible");
    }
    if (node.type === "dialogue") {
      const choicesEl = $(".js-choices", els.stageView);
      if (choicesEl) choicesEl.hidden = !(node.choices && node.choices.length);
      if (!(node.choices && node.choices.length)) {
        renderStaticBooper($(".js-indicator", els.stageView), true);
      }
    }
    if (node.type === "success") {
      const frames = node.variant === "glorious" ? ASSET.success.slice(8) : ASSET.success.slice(0, 8);
      setFrame($(".js-anim", els.stageView), frames[frames.length - 1]);
    }
    if (node.type === "badEnd") {
      setFrame($(".js-anim", els.stageView), ASSET.badend[ASSET.badend.length - 1]);
    }
  }

  function setFrame(img, src) {
    if (!img) return;
    img.src = resolveAsset(src);
  }

  const preloadedImages = [];
  function preloadAnimationAssets() {
    const sources = [
      ...ASSET.booper,
      ...ASSET.success,
      ...ASSET.badend,
      ...ASSET.transitionClose,
      ...ASSET.transitionOpen,
      ASSET.logo,
    ];
    for (const src of sources) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      preloadedImages.push(img);
    }
  }

  function renderStaticBooper(container, dialogue = false) {
    if (!container) return;
    container.innerHTML = `<img class="booper ${dialogue ? "dialogue-booper" : ""} static-booper" src="${esc(ASSET.booperIdle[7])}" alt="">`;
  }

  /* ---------------------------------------------------------
     Playback
     --------------------------------------------------------- */

  function playFrom(id) {
    const start = getNode(id) || project.nodes[0];
    if (!start) {
      toast("没有可播放的节点", true);
      return;
    }
    if (!transitionSwapping) transitionCancel?.();
    stopTimers();
    playing = true;
    syncGameMusic();
    runtime = {
      nodeId: null,
      previousId: null,
      lastCheckpoint: null,
      hasSeenDialogue: false,
      startedAtFirst: start.id === project.nodes[0]?.id,
    };
    els.stage.classList.add("playing");
    els.stageBadge.textContent = "PLAYING";
    els.stageModeLabel.textContent = "PLAYING";
    els.btnStop.disabled = false;
    els.stageHint.textContent = "点击舞台 / 空格推进；点击选项分支。Esc 停止。";
    const previous = start.type === "success" ? findPreviousNode(start.id)?.id ?? null : null;
    showNode(start.id, previous);
    validateFlow(start.id);
  }

  function showNode(id, previousId = null) {
    const node = getNode(id);
    if (!node) {
      toast("节点不存在：" + id, true);
      showFlowEnd();
      return;
    }
    stopTimers();
    const prev = previousId !== null ? previousId : runtime.nodeId;
    runtime.previousId = prev;
    runtime.nodeId = node.id;
    runtime.textDone = false;
    if (node.type === "dialogue") runtime.hasSeenDialogue = true;

    if (node.type === "dialogue" && node.checkpoint !== false) {
      runtime.lastCheckpoint = node.id;
    }

    els.stageView.innerHTML = sceneHTML(node, {
      mode: "play",
      previousNode: getNode(prev),
    });
    els.stageNodeLabel.textContent = nodeLabel(node);
    els.stageBadge.textContent = "PLAYING";
    markPlayingNode(node.id);

    const prevNode = getNode(prev);

    if (node.type === "cutscene") {
      const textEl = $(".js-type", els.stageView);
      startTypewriter(textEl, node.text || "", () => {
        runtime.textDone = true;
        if (node.text?.trim()) playSfx("textEnd");
        const indicator = $(".js-indicator", els.stageView);
        if (node.showIndicator !== false) startBooper(indicator);
        const hint = $(".js-hint", els.stageView);
        if (hint) hint.classList.add("is-visible");
      });
    } else if (node.type === "dialogue") {
      // 对话开始的 3.9s 音效只在一段对话的第一句播放，不再每个节点都重放。
      if (prevNode?.type !== "dialogue") playStartSound();
      const textEl = $(".js-type", els.stageView);
      startTypewriter(textEl, node.text || "", () => {
        runtime.textDone = true;
        if (node.text?.trim()) playSfx("textEnd");
        const choicesEl = $(".js-choices", els.stageView);
        if (choicesEl) choicesEl.hidden = !(node.choices && node.choices.length);
        if (!(node.choices && node.choices.length)) {
          startBooper($(".js-indicator", els.stageView), true);
        }
      });
    } else if (node.type === "success") {
      playSfx("success");
      runtime.animDone = false;
      const frames = node.variant === "glorious" ? ASSET.success.slice(8) : ASSET.success.slice(0, 8);
      const anim = $(".js-anim", els.stageView);
      startFrameAnimation(anim, frames, 78, () => {
        runtime.animDone = true;
        const hint = $(".js-hint", els.stageView);
        if (hint) hint.classList.add("is-visible");
      });
    } else if (node.type === "badEnd") {
      playSfx("badend");
      const anim = $(".js-anim", els.stageView);
      const actions = $(".js-actions", els.stageView);
      startFrameAnimation(anim, ASSET.badend, 85, () => {
        if (actions) actions.hidden = false;
      });
    } else if (node.type === "end" || node.type === "title") {
      // Static actions are already visible.
    }
  }

  function advance() {
    if (!playing || transitionActive) return;
    const node = getNode(runtime.nodeId);
    if (!node) return;

    if (runtime.type) {
      finishTypewriter();
      return;
    }
    if (node.type === "success") {
      if (runtime.animDone) {
        const next = node.next;
        runTransition(() => {
          if (next) goTo(next);
          else showFlowEnd();
        });
      }
      return;
    }
    if (["badEnd", "end", "title"].includes(node.type)) return;
    if (node.type === "dialogue" && node.choices && node.choices.length) return;

    const nextNode = node.next ? getNode(node.next) : null;
    const isOpening = runtime.startedAtFirst &&
      !runtime.hasSeenDialogue &&
      node.type === "cutscene" &&
      nextNode?.type === "dialogue";
    if (isOpening) {
      runTransition(() => {
        if (node.next) goTo(node.next);
        else showFlowEnd();
      });
      return;
    }

    if (node.next) {
      goTo(node.next);
    } else {
      showFlowEnd();
    }
  }

  function goTo(id) {
    if (!id) {
      showFlowEnd();
      return;
    }
    const prev = runtime.nodeId;
    if (!getNode(id)) {
      toast("目标节点不存在：" + id, true);
      showFlowEnd();
      return;
    }
    showNode(id, prev);
  }

  function choose(choiceId) {
    if (!playing) return;
    const node = getNode(runtime.nodeId);
    if (!node || !node.choices) return;
    const choice = node.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    playSfx("confirm");
    if (choice.next) {
      goTo(choice.next);
    } else {
      toast("这个选项还没有设置目标节点", true);
    }
  }

  function retry() {
    if (!playing) return;
    const node = getNode(runtime.nodeId);
    let target = node?.type === "badEnd" ? node.retryNodeId : "";
    if (!target) target = runtime.lastCheckpoint;
    if (!target) target = project.nodes[0]?.id;
    const apply = () => {
      if (target && getNode(target)) {
        showNode(target, runtime.nodeId);
      } else {
        toast("没有可用的复活点，回到第一个节点", true);
        if (project.nodes[0]) showNode(project.nodes[0].id, null);
      }
    };
    if (node?.type === "badEnd") runTransition(apply);
    else apply();
  }

  function restartFlow() {
    if (!project.nodes[0]) return;
    const fromBadEnd = playing && getNode(runtime.nodeId)?.type === "badEnd";
    const start = () => playFrom(project.nodes[0].id);
    if (fromBadEnd) runTransition(start);
    else start();
  }

  function stopPlayback(silent = false) {
    playing = false;
    transitionCancel?.();
    try { bgm.pause(); } catch (_) {}
    stopTimers();
    runtime = {};
    markPlayingNode(null);
    els.stage.classList.remove("playing");
    els.stageBadge.textContent = "PREVIEW";
    els.stageModeLabel.textContent = "PREVIEW";
    els.btnStop.disabled = true;
    els.stageHint.textContent = "选择左侧节点编辑。点击“从当前播放”或按空格试玩。";
    if (!silent) renderStage();
  }

  function showFlowEnd() {
    stopTimers();
    markPlayingNode(null);
    els.stageView.innerHTML = `
      <div class="scene scene-end">
        <div class="end-bg"></div>
        <div class="end-content">
          <div class="end-kicker">FLOW END</div>
          <h2 class="end-title">END</h2>
          <div class="end-rule"></div>
          <p class="end-text">流程停在这里：当前节点没有设置下一个节点。</p>
          <div class="end-actions">
            <button class="hs-btn" type="button" data-action="restart">从头开始</button>
            ${PLAY_ONLY ? "" : `<button class="hs-btn ghost" type="button" data-action="stop">返回编辑</button>`}
          </div>
        </div>
      </div>`;
    els.stageNodeLabel.textContent = "流程结束";
    els.stageBadge.textContent = "PLAYING";
  }

  function showPresetError(error) {
    const url = presetUrl(PRESET_PARAM);
    els.stage.classList.add("error");
    els.stageView.innerHTML = `
      <div class="scene scene-end">
        <div class="end-bg"></div>
        <div class="end-content">
          <div class="end-kicker">PRESET ERROR</div>
          <h2 class="end-title">载入失败</h2>
          <div class="end-rule"></div>
          <p class="end-text">打不开预设：${esc(url)}<br>${esc(error.message || "未知错误")}<br><br>请检查文件是否已提交到仓库，或链接是否允许跨域读取。</p>
          <div class="end-actions">
            <button class="hs-btn" type="button" data-action="reload">重试</button>
          </div>
        </div>
      </div>`;
    els.stageModeLabel.textContent = "ERROR";
    els.stageBadge.textContent = "ERROR";
    els.stageHint.textContent = "预设载入失败。";
  }

  /* ---------------------------------------------------------
     Typewriter / animation
     --------------------------------------------------------- */

  function startTypewriter(el, text, onDone) {
    if (!el) {
      onDone?.();
      return;
    }
    const chars = Array.from(text || "");
    el.textContent = "";
    if (!chars.length) {
      onDone?.();
      return;
    }
    const speed = clamp(Number(project.settings.textSpeed) || 20, 8, 80);
    runtime.type = { el, chars, index: 0, timer: null, onDone };
    runtime.type.timer = setInterval(() => {
      if (!runtime.type) return;
      runtime.type.index += 1;
      el.textContent = chars.slice(0, runtime.type.index).join("");
      if (runtime.type.index >= chars.length) finishTypewriter();
    }, speed);
  }

  function finishTypewriter() {
    const t = runtime.type;
    if (!t) return;
    clearInterval(t.timer);
    t.el.textContent = t.chars.join("");
    runtime.type = null;
    t.onDone?.();
  }

  function makeBooperStack(frames, variant = "idle") {
    const stack = document.createElement("span");
    stack.className = `booper-stack ${variant}`;
    frames.forEach((src, index) => {
      const img = document.createElement("img");
      img.className = "booper-frame" + (index === 0 ? " active" : "");
      img.src = src;
      img.alt = "";
      stack.appendChild(img);
    });
    return stack;
  }

  function setBooperFrame(stack, index) {
    const frames = stack.children;
    for (let i = 0; i < frames.length; i += 1) {
      frames[i].classList.toggle("active", i === index);
    }
  }

  function startBooper(container, dialogue = false) {
    if (!container) return;
    stopBooperTimer();
    const stack = makeBooperStack(ASSET.booperIdle, "idle");
    container.replaceChildren(stack);
    const frameMs = 1000 / 24;
    const started = performance.now();
    let last = -1;
    const tick = (now) => {
      const index = Math.floor((now - started) / frameMs) % ASSET.booperIdle.length;
      if (index !== last) {
        last = index;
        setBooperFrame(stack, index);
      }
      runtime.booperRAF = requestAnimationFrame(tick);
    };
    runtime.booperRAF = requestAnimationFrame(tick);
  }

  function stopBooperTimer() {
    if (runtime.booperRAF) {
      cancelAnimationFrame(runtime.booperRAF);
      runtime.booperRAF = null;
    }
  }

  // 原版 transition_close（02–21）+ transition_open（22–30）。
  // 黑场覆盖舞台；到 transition-0006（完整石门）时切换节点，
  // 再继续关门/开门，结束后平滑露出新场景。
  function runTransition(onSwap) {
    if (transitionActive) return;
    transitionActive = true;
    const overlay = document.createElement("div");
    overlay.className = "scene-transition";
    overlay.innerHTML = `<img alt=""><span>CLICK TO SKIP</span>`;
    els.stage.appendChild(overlay);
    const img = overlay.querySelector("img");
    let swapped = false;
    let timer = null;

    const cleanup = (stopAudio = true) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (stopAudio) {
        stopSfx("transitionClose");
        stopSfx("transitionOpen");
      }
      overlay.remove();
      transitionActive = false;
      transitionCancel = null;
    };
    const swap = () => {
      if (swapped) return;
      swapped = true;
      transitionSwapping = true;
      try {
        onSwap?.();
      } finally {
        transitionSwapping = false;
      }
    };
    const finish = () => {
      swap();
      cleanup(true);
    };
    transitionCancel = () => cleanup(true);
    overlay.addEventListener("click", (event) => {
      event.stopPropagation();
      finish();
    });

    // 原版 12fps 太慢；这里用 30fps，整套转场约 0.97 秒。
    const playFrames = (frames, done, onFrame) => {
      if (timer) clearInterval(timer);
      let index = 0;
      img.src = frames[0];
      timer = setInterval(() => {
        index += 1;
        if (index >= frames.length) {
          clearInterval(timer);
          timer = null;
          done();
          return;
        }
        img.src = frames[index];
        onFrame?.(index);
      }, 1000 / 30);
    };

    playSfx("transitionClose");
    playSfx("transitionOpen");
    playFrames(
      ASSET.transitionClose,
      () => {
        swap();
        playFrames(ASSET.transitionOpen, () => cleanup(false));
      },
      // 第 6 帧已经是一张完整石门，此时把下一幕换到下面；
      // 后面的 close/open 帧会把它平滑盖住再揭开。
      (index) => {
        if (index === 4) swap(); // 02,03,04,05,06 -> index 4
      }
    );
  }

  function startFrameAnimation(img, frames, frameMs, onDone) {
    if (!img || !frames.length) {
      onDone?.();
      return;
    }
    let index = 0;
    img.src = resolveAsset(frames[0]);
    runtime.animTimer = setInterval(() => {
      index += 1;
      if (index >= frames.length) {
        clearInterval(runtime.animTimer);
        runtime.animTimer = null;
        img.src = resolveAsset(frames[frames.length - 1]);
        onDone?.();
        return;
      }
      img.src = resolveAsset(frames[index]);
    }, frameMs);
  }

  function stopTimers() {
    if (runtime.type) {
      clearInterval(runtime.type.timer);
      runtime.type = null;
    }
    stopBooperTimer();
    if (runtime.animTimer) {
      clearInterval(runtime.animTimer);
      runtime.animTimer = null;
    }
  }

  /* ---------------------------------------------------------
     Assets / uploading
     --------------------------------------------------------- */

  function resolveAsset(src) {
    if (!src) return "";
    if (src.startsWith("asset:")) {
      const id = src.slice(6);
      const url = assetUrls.get(id);
      if (url) return url;
      const asset = project.assets.find((a) => a.id === id);
      if (!asset) return "";
      // 旧数据 / IndexedDB 不可用时的兜底：内联 data:URL
      return typeof asset.data === "string" ? asset.data : "";
    }
    return src;
  }

  function assetName(src) {
    if (!src) return "未选择";
    if (src.startsWith("asset:")) {
      const asset = project.assets.find((a) => a.id === src.slice(6));
      return asset ? asset.name : "已丢失的上传素材";
    }
    const found = BUILTIN_ALL.find((a) => a.src === src);
    return found ? found.name : src.split("/").pop();
  }

  function openAssetPicker({ target, kind, nodeId }) {
    assetPicker = {
      target,
      kind,
      nodeId: nodeId || selectedId,
      tab: kind === "background" ? "background" : kind === "portrait" ? "portrait" : "cutscene",
    };
    const tabs = [
      ["background", "背景"],
      ["cutscene", "剧情图"],
      ["portrait", "立绘"],
      ["upload", "上传"],
    ];
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop="1">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>选择素材</h3>
            <span class="modal-sub">${esc(kind === "portrait" ? "立绘 / 透明 PNG" : kind === "background" ? "背景 / 画面" : "画面")}</span>
            <button class="modal-close" type="button" data-modal-close="1">×</button>
          </div>
          <div class="modal-body">
            <div class="asset-tabs">
              ${tabs.map(([id, label]) => `<button class="asset-tab ${assetPicker.tab === id ? "active" : ""}" type="button" data-asset-tab="${id}">${label}</button>`).join("")}
            </div>
            <div class="asset-grid" id="asset-grid"></div>
          </div>
          <div class="modal-foot">
            <span class="hint">支持 PNG / JPG / WEBP / GIF，可一次多选，不限单张大小。</span>
            <label class="btn small primary" for="asset-upload">上传图片</label>
            <input id="asset-upload" type="file" accept="image/*" multiple hidden>
            <button class="btn small ghost" type="button" data-modal-close="1">取消</button>
            ${assetPicker.target !== "portrait" || true ? `<button class="btn small ghost" type="button" data-asset-clear="1">清除</button>` : ""}
          </div>
        </div>
      </div>`;
    renderAssetGrid();
  }

  function assetPickerItems() {
    const tab = assetPicker?.tab || "all";
    const uploaded = project.assets.map((asset) => ({
      src: "asset:" + asset.id,
      name: asset.name,
      kind: "上传",
    }));
    let items;
    if (tab === "background") items = [...BUILTIN_BACKGROUNDS, ...uploaded];
    else if (tab === "cutscene") items = [...BUILTIN_CUTSCENES, ...uploaded];
    else if (tab === "portrait") items = [...BUILTIN_PORTRAITS, ...uploaded];
    else if (tab === "upload") items = uploaded;
    else items = [...BUILTIN_ALL, ...uploaded];
    return items;
  }

  function renderAssetGrid() {
    const grid = $("#asset-grid");
    if (!grid) return;
    const items = assetPickerItems();
    if (!items.length) {
      grid.innerHTML = `<div class="choice-empty" style="grid-column:1/-1">还没有上传素材。点击右下角“上传图片”。</div>`;
      return;
    }
    grid.innerHTML = items.map((item) => {
      const contain = item.kind === "立绘";
      return `
        <div class="asset-card" data-asset-src="${esc(item.src)}" data-asset-name="${esc(item.name)}">
          <div class="thumb"><img class="${contain ? "contain" : ""}" src="${esc(resolveAsset(item.src))}" alt=""></div>
          <div class="name">${esc(item.name)}</div>
          <div class="kind">${esc(item.kind)}</div>
        </div>`;
    }).join("");
  }

  function chooseAsset(src) {
    if (!assetPicker) return;
    const node = getNode(assetPicker.nodeId);
    if (!node) return;
    if (assetPicker.target === "background") node.background = src;
    else if (assetPicker.target === "portrait") node.portrait = src;
    else if (assetPicker.target === "image") node.image = src;
    closeModal();
    scheduleSave();
    renderInspector();
    renderStage();
    toast("素材已应用");
  }

  function clearAssetField(target) {
    const node = getNode(assetPicker?.nodeId || selectedId);
    if (!node) return;
    if (target === "background") node.background = "";
    else if (target === "portrait") node.portrait = "";
    else if (target === "image") node.image = "";
    closeModal();
    scheduleSave();
    renderInspector();
    renderStage();
  }

  function setAssetTab(tab) {
    if (!assetPicker) return;
    assetPicker.tab = tab;
    $$(".asset-tab", els.modalRoot).forEach((el) => {
      el.classList.toggle("active", el.dataset.assetTab === tab);
    });
    renderAssetGrid();
  }

  async function handleUploads(files) {
    if (!assetPicker) return;
    const list = Array.from(files || []).filter((file) => file && file.type.startsWith("image/"));
    if (!list.length) {
      toast("请选择图片文件", true);
      return;
    }

    const db = await openAssetDb();
    const added = [];
    let inlineBytes = 0;

    for (const file of list) {
      const id = uid("a");
      const name = file.name.replace(/\.[^.]+$/, "") || "上传图片";
      const asset = { id, name };

      const stored = db ? await storeAssetBlob(file, { id, name }) : false;
      if (!stored) {
        // IndexedDB 不可用时的兜底：退回内联 data:URL（会占用 localStorage 配额）
        try {
          asset.data = await blobToDataUrl(file);
          inlineBytes += file.size;
        } catch (error) {
          console.warn("read upload failed", error);
          continue;
        }
      }
      project.assets.push(asset);
      added.push(asset);
    }

    if (!added.length) {
      toast("图片读取失败", true);
      return;
    }

    scheduleSave();

    if (added.length === 1) {
      chooseAsset("asset:" + added[0].id);
      return;
    }

    setAssetTab("upload");
    toast(`已添加 ${added.length} 张素材，点缩略图切换`);
    if (inlineBytes > 3 * 1024 * 1024) {
      toast("素材较大且浏览器数据库不可用，请尽快导出 JSON 备份", true);
    }
  }

  function closeModal() {
    assetPicker = null;
    els.modalRoot.innerHTML = "";
  }

  /* ---------------------------------------------------------
     Node actions
     --------------------------------------------------------- */

  function createNode(type) {
    const id = uid("n");
    if (type === "cutscene") {
      return {
        id, type, name: "新剧情过场", image: ASSET.cutscene[2], imageFit: "contain",
        text: "在这里输入旁白。", showIndicator: true, next: "",
      };
    }
    if (type === "title") {
      return {
        id, type, name: "标题卡", background: ASSET.bgChapter1, showLogo: true,
        title: "HELLTAKER", subtitle: "", next: "",
      };
    }
    if (type === "success") {
      return {
        id, type, name: "SUCCESS", variant: "normal",
        background: ASSET.bgHell, portrait: ASSET.placeholder, portraitPos: "center", portraitScale: 100,
        speaker: "", text: "", next: "",
      };
    }
    if (type === "badEnd") {
      return { id, type, name: "BAD END", text: "", retryNodeId: "" };
    }
    if (type === "end") {
      return { id, type, name: "结束", title: "END", text: "在这里写结束语。", buttonLabel: "重新开始" };
    }
    return {
      id, type: "dialogue", name: "新对话", speaker: "", text: "在这里输入对话。",
      background: ASSET.bgHell, portrait: ASSET.placeholder, portraitPos: "center",
      portraitScale: 100, checkpoint: true, choices: [], next: "",
    };
  }

  function addNode(type) {
    if (playing) stopPlayback(true);
    const node = createNode(type);
    const prev = getNode(selectedId);
    if (type === "success" && prev?.type === "dialogue") {
      syncSuccessFromDialogue(node, prev);
    }
    const oldNext = prev?.next || "";
    const index = prev ? nodeIndex(prev.id) + 1 : project.nodes.length;
    project.nodes.splice(index, 0, node);
    if (prev && supportsNext(prev) && (!prev.choices || prev.choices.length === 0)) {
      node.next = oldNext;
      prev.next = node.id;
    }
    selectedId = node.id;
    scheduleSave();
    renderNodeList();
    renderInspector();
    renderStage();
  }

  function supportsNext(node) {
    return ["dialogue", "cutscene", "title", "success"].includes(node.type);
  }

  function removeNode(id) {
    const index = nodeIndex(id);
    if (index < 0) return;
    if (project.nodes.length <= 1) {
      toast("至少保留一个节点", true);
      return;
    }
    if (!window.confirm(`删除「${nodeLabel(project.nodes[index])}」？引用它的节点会被清空目标。`)) return;
    project.nodes.splice(index, 1);
    for (const node of project.nodes) {
      if (node.next === id) node.next = "";
      if (node.retryNodeId === id) node.retryNodeId = "";
      if (node.choices) {
        for (const choice of node.choices) if (choice.next === id) choice.next = "";
      }
    }
    if (selectedId === id) selectedId = project.nodes[Math.max(0, index - 1)]?.id ?? project.nodes[0]?.id ?? null;
    scheduleSave();
    renderAll();
  }

  function duplicateNode(id) {
    const node = getNode(id);
    if (!node) return;
    const copy = clone(node);
    copy.id = uid("n");
    copy.name = nodeLabel(node) + " 副本";
    if (copy.choices) copy.choices = copy.choices.map((c) => ({ ...c, id: uid("c") }));
    project.nodes.splice(nodeIndex(id) + 1, 0, copy);
    selectedId = copy.id;
    scheduleSave();
    renderAll();
  }

  function moveNode(id, dir) {
    const index = nodeIndex(id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= project.nodes.length) return;
    const [node] = project.nodes.splice(index, 1);
    project.nodes.splice(target, 0, node);
    scheduleSave();
    renderNodeList();
  }

  /* ---------------------------------------------------------
     Event handlers
     --------------------------------------------------------- */

  function onNodeListClick(event) {
    const row = event.target.closest("[data-node-id]");
    if (!row) return;
    const id = row.dataset.nodeId;
    const actionEl = event.target.closest("[data-node-action]");
    if (actionEl) {
      event.stopPropagation();
      const action = actionEl.dataset.nodeAction;
      if (action === "up") moveNode(id, -1);
      else if (action === "down") moveNode(id, 1);
      else if (action === "duplicate") duplicateNode(id);
      else if (action === "delete") removeNode(id);
      return;
    }
    selectNode(id);
  }

  function selectNode(id) {
    if (!getNode(id)) return;
    if (playing) stopPlayback(true);
    selectedId = id;
    renderNodeList();
    renderInspector();
    renderStage();
  }

  function onInspectorInput(event) {
    const target = event.target;
    if (target.matches("[data-setting]")) {
      updateSetting(target);
      return;
    }
    if (target.matches("[data-choice-field]")) {
      updateChoiceField(target);
      return;
    }
    if (!target.matches("[data-field]")) return;
    updateNodeField(target);
  }

  function onInspectorChange(event) {
    const target = event.target;
    if (target.matches("[data-setting]")) {
      updateSetting(target);
      return;
    }
    if (target.matches("[data-choice-field]")) {
      updateChoiceField(target);
      return;
    }
    if (!target.matches("[data-field]")) return;
    updateNodeField(target);
    if (target.dataset.field === "variant" || target.dataset.field === "imageFit") {
      // no structural change; stage refresh is enough
    }
  }

  function updateNodeField(target) {
    const node = getNode(selectedId);
    if (!node) return;
    const field = target.dataset.field;
    let value;
    if (target.type === "checkbox") value = target.checked;
    else if (target.type === "range") value = Number(target.value);
    else value = target.value;

    if (field === "settings.textSpeed") {
      project.settings.textSpeed = clamp(Number(value) || 20, 8, 80);
      scheduleSave();
      return;
    }
    node[field] = value;
    if (field === "name") renderNodeList();
    if (field === "portraitScale") {
      const hint = target.closest(".field")?.querySelector(".hint");
      if (hint) hint.textContent = value;
    }
    scheduleSave();
    if (playing) stopPlayback(true);
    scheduleStageRender();
  }

  function updateSetting(target) {
    const field = target.dataset.setting;
    if (field === "textSpeed") {
      project.settings.textSpeed = clamp(Number(target.value) || 20, 8, 80);
      const hint = target.closest(".field")?.querySelector(".hint");
      if (hint) hint.textContent = target.value;
      scheduleSave();
    }
  }

  function updateChoiceField(target) {
    const node = getNode(selectedId);
    if (!node || !node.choices) return;
    const row = target.closest("[data-choice-id]");
    if (!row) return;
    const choice = node.choices.find((c) => c.id === row.dataset.choiceId);
    if (!choice) return;
    choice[target.dataset.choiceField] = target.value;
    scheduleSave();
    if (playing) stopPlayback(true);
    scheduleStageRender();
  }

  function scheduleStageRender() {
    clearTimeout(stageTimer);
    stageTimer = setTimeout(() => {
      if (!playing) renderStage();
    }, 80);
  }

  function onInspectorClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) {
      const field = event.target.closest(".asset-field[data-target]");
      if (field) {
        openAssetPicker({
          target: field.dataset.target,
          kind: field.dataset.kind,
          nodeId: selectedId,
        });
      }
      return;
    }
    const action = actionEl.dataset.action;
    if (action === "pick-asset") {
      openAssetPicker({
        target: actionEl.dataset.target,
        kind: actionEl.dataset.kind,
        nodeId: selectedId,
      });
    } else if (action === "clear-asset") {
      const node = getNode(selectedId);
      if (!node) return;
      if (actionEl.dataset.target === "portrait") node.portrait = "";
      else if (actionEl.dataset.target === "background") node.background = "";
      else if (actionEl.dataset.target === "image") node.image = "";
      scheduleSave();
      renderInspector();
      renderStage();
    } else if (action === "sync-success") {
      const node = getNode(selectedId);
      const prev = node ? findPreviousNode(node.id) : null;
      if (syncSuccessFromDialogue(node, prev)) {
        scheduleSave();
        renderInspector();
        renderStage();
        toast("已沿用上一个对话的背景 / 立绘 / 留言");
      } else {
        toast("上一个节点不是对话，无法沿用", true);
      }
    } else if (action === "add-choice") {
      const node = getNode(selectedId);
      if (!node || node.type !== "dialogue" || node.choices.length >= 4) return;
      node.choices.push({ id: uid("c"), text: "", next: "" });
      scheduleSave();
      renderInspector();
      renderStage();
    } else if (action === "del-choice") {
      const node = getNode(selectedId);
      if (!node) return;
      const row = event.target.closest("[data-choice-id]");
      if (!row) return;
      node.choices = node.choices.filter((c) => c.id !== row.dataset.choiceId);
      scheduleSave();
      renderInspector();
      renderStage();
    } else if (action === "duplicate-node") {
      duplicateNode(selectedId);
    } else if (action === "delete-node") {
      removeNode(selectedId);
    }
  }

  function onStageClick(event) {
    if (event.target.closest(".game-audio-hud")) return;
    if (!playing) {
      const hotspot = event.target.closest("[data-edit-asset]");
      if (hotspot) {
        const target = hotspot.dataset.editAsset;
        openAssetPicker({
          target,
          kind: target === "portrait" ? "portrait" : target === "image" ? "image" : "background",
          nodeId: selectedId,
        });
        return;
      }
    }
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === "restart") restartFlow();
      else if (action === "retry") retry();
      else if (action === "reload") location.reload();
      else if (action === "continue") {
        const node = getNode(runtime.nodeId);
        if (node?.next) goTo(node.next);
        else showFlowEnd();
      } else if (action === "stop") stopPlayback();
      else if (action === "start") {
        const node = getNode(runtime.nodeId);
        if (node?.next) goTo(node.next);
        else toast("标题卡还没有设置下一个节点", true);
      }
      return;
    }
    const choiceEl = event.target.closest("[data-choice-id]");
    if (choiceEl && playing) {
      choose(choiceEl.dataset.choiceId);
      return;
    }
    if (playing) advance();
  }

  let lastHoverAt = 0;
  function onStagePointerOver(event) {
    if (!playing) return;
    if (!event.target.closest(".choice")) return;
    const now = performance.now();
    if (now - lastHoverAt < 80) return;
    lastHoverAt = now;
    playSfx("move");
  }

  function onModalClick(event) {
    if (event.target.matches("[data-modal-backdrop]")) {
      closeModal();
      return;
    }
    if (event.target.closest("[data-modal-close]")) {
      closeModal();
      return;
    }
    const tab = event.target.closest("[data-asset-tab]");
    if (tab && assetPicker) {
      assetPicker.tab = tab.dataset.assetTab;
      $$(".asset-tab", els.modalRoot).forEach((el) => el.classList.toggle("active", el === tab));
      renderAssetGrid();
      return;
    }
    if (event.target.closest("[data-asset-clear]")) {
      clearAssetField(assetPicker?.target);
      return;
    }
    const card = event.target.closest("[data-asset-src]");
    if (card) {
      chooseAsset(card.dataset.assetSrc);
    }
  }

  function onModalChange(event) {
    if (event.target.id === "asset-upload" && event.target.files?.length) {
      const files = Array.from(event.target.files);
      event.target.value = "";
      handleUploads(files);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (assetPicker) {
        closeModal();
        return;
      }
      if (playing) {
        if (PLAY_ONLY) return;
        stopPlayback();
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveNow(true);
      return;
    }
    if (!playing) return;
    const tag = event.target?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      advance();
    }
  }

  /* ---------------------------------------------------------
     Project actions
     --------------------------------------------------------- */

  async function newProject() {
    if (!window.confirm("新建项目会替换当前内容，已上传的素材也会一起清空。建议先导出 JSON 备份。继续？")) return;
    try {
      await dbClearAssets();
    } catch (error) {
      console.warn("clear assets failed", error);
    }
    clearAssetCache();
    storageLocked = false;
    project = defaultProject();
    selectedId = project.nodes[0].id;
    playing = false;
    saveNow(false);
    renderAll();
    toast("已新建示例项目");
  }

  async function adoptImportedAssets(imported) {
    const db = await openAssetDb();
    for (const asset of imported.assets) {
      if (typeof asset.data !== "string" || !asset.data.startsWith("data:")) continue;
      const blob = dataUrlToBlob(asset.data);
      if (!blob) continue;
      const stored = db ? await storeAssetBlob(blob, { id: asset.id, name: asset.name }) : false;
      if (stored) {
        delete asset.data;
      } else {
        attachAssetUrl(asset.id, blob);
      }
    }
  }

  function importProject(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = normalizeProject(parsed);
        if (!Array.isArray(imported.nodes) || imported.nodes.length === 0) {
          throw new Error("empty project");
        }
        await adoptImportedAssets(imported);
        project = imported;
        selectedId = project.nodes[0].id;
        playing = false;
        storageLocked = false;
        saveNow(false);
        renderAll();
        toast(`项目已导入（${project.assets.length} 张素材）`);
      } catch (error) {
        console.warn(error);
        toast("导入失败：不是有效的项目 JSON", true);
      }
    };
    reader.onerror = () => toast("读取文件失败", true);
    reader.readAsText(file, "utf-8");
  }

  async function exportProject() {
    const assets = [];
    for (const asset of project.assets) {
      let data = typeof asset.data === "string" ? asset.data : "";
      if (!data) {
        let blob = assetBlobs.get(asset.id) || null;
        if (!blob) {
          try {
            blob = (await dbGetAsset(asset.id))?.blob || null;
          } catch (error) {
            console.warn("read asset failed", error);
          }
        }
        if (blob) {
          try {
            data = await blobToDataUrl(blob);
          } catch (error) {
            console.warn("encode asset failed", error);
          }
        }
      }
      assets.push(data ? { id: asset.id, name: asset.name, data } : { id: asset.id, name: asset.name });
    }

    const payload = {
      ...project,
      assets,
      exportedAt: new Date().toISOString(),
      generator: "Helltaker Dialogue Editor",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (project.title || "helltaker-dialogue").replace(/[\\/:*?"<>|]/g, "_");
    a.href = url;
    a.download = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`已导出 JSON（${assets.length} 张素材）`);
  }

  function validateFlow(startId) {
    const issues = [];
    const seen = new Set();
    const walk = (id) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const node = getNode(id);
      if (!node) {
        issues.push(`目标节点不存在：${id}`);
        return;
      }
      if (node.type === "dialogue") {
        if (node.choices?.length) {
          for (const choice of node.choices) {
            if (!choice.next) issues.push(`「${nodeLabel(node)}」有选项没有目标`);
            else walk(choice.next);
          }
        } else if (node.next) walk(node.next);
      } else if (["cutscene", "title", "success"].includes(node.type)) {
        if (node.next) walk(node.next);
      } else if (node.type === "badEnd") {
        if (node.retryNodeId && !getNode(node.retryNodeId)) issues.push(`BAD END 的重试目标不存在`);
      }
    };
    walk(startId);
    if (issues.length) toast("流程提示：" + issues[0], true);
  }

  /* ---------------------------------------------------------
     Audio / toast / help
     --------------------------------------------------------- */

  function updateGameAudioUI() {
    if (!els.gameMusicBtn || !els.gameSfxBtn) return;
    const set = (button, enabled) => {
      button.classList.toggle("on", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      const state = button.querySelector(".ga-state");
      if (state) state.textContent = enabled ? "开" : "关";
    };
    set(els.gameMusicBtn, gameMusicEnabled);
    set(els.gameSfxBtn, gameSfxEnabled);
  }

  function syncGameMusic() {
    if (playing && gameMusicEnabled && !muted) {
      const promise = bgm.play();
      if (promise?.catch) promise.catch(() => {});
    } else {
      try { bgm.pause(); } catch (_) {}
    }
  }

  function setMuted(value) {
    muted = !!value;
    if (els.muteCheckbox) els.muteCheckbox.checked = muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (muted) {
      gameMusicEnabled = false;
      gameSfxEnabled = false;
      updateGameAudioUI();
      try { bgm.pause(); } catch (_) {}
      Object.values(audioObjects).forEach((audio) => {
        try { audio.pause(); } catch (_) {}
      });
    }
  }

  function playSfx(name) {
    if (!gameSfxEnabled || muted) return;
    const src = AUDIO_FILES[name];
    if (!src) return;
    try {
      let audio = audioObjects[name];
      if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = name === "move" ? 0.24
          : name === "confirm" ? 0.55
          : name === "textEnd" ? 0.26
          : name === "transitionClose" || name === "transitionOpen" ? 0.34
          : 0.5;
        audioObjects[name] = audio;
      }
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function playStartSound() {
    playSfx("start");
  }

  function stopSfx(name) {
    const audio = audioObjects[name];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  function toast(message, isError = false) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle("error", !!isError);
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  function openHelp() {
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop="1">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>使用说明</h3>
            <span class="modal-sub">HELLTAKER DIALOGUE EDITOR</span>
            <button class="modal-close" type="button" data-modal-close="1">×</button>
          </div>
          <div class="modal-body help-body">
            <h4>它是什么</h4>
            <p>一个本地运行的 Helltaker 风格对话 / 剧情过场编辑器。所有内容存在浏览器里，也可以导出 JSON 备份。它不包含原版关卡玩法，只处理对话、选项、剧情过场、BAD END、SUCCESS、结束卡，以及它们之间的转场动画。</p>
            <h4>推荐工作流</h4>
            <ul>
              <li>左侧添加节点，按“开场剧情过场 → 对话 → 选项 → 死亡 / 通关 → 剧情过场 → … → 结束”的顺序连起来。</li>
              <li>选中节点后在右侧改文字、背景、立绘和跳转目标。</li>
              <li>点“从当前播放”检查这一段；点“从头播放”检查完整流程。</li>
              <li>死亡节点默认回到最近一次经过的对话；通关节点的背景 / 立绘和对话节点使用同一套参数，留言默认沿用上一个对话，也可以一键同步；动画结束后点击舞台或空格继续。</li>
              <li>转场动画会自动用在“开场剧情过场 → 首段对话”“BAD END → 重试 / 从头开始”“SUCCESS → 下一场景”；播放时点击画面可以跳过。</li>
              <li>音效安排：对话开始音效只在一段对话的第一句播放；每句打字结束有短提示音；转场使用两条分层音轨。</li>
              <li>试玩时舞台右上角有「音乐」「音效」按钮，默认关闭；音乐固定使用 Vitality.mp3，音效控制所有游戏音效。</li>
            </ul>
            <h4>素材</h4>
            <ul>
              <li>内置素材来自游戏本体的 UI 图层：选项框、红眼指示器、BAD END / SUCCESS 帧、剧情图、转场动画、对话背景和字体。</li>
              <li>编辑预览里可以直接点背景 / 立绘 / 画面打开素材选择；右侧缩略图也可以点。剧情过场节点只有“画面”，SUCCESS 节点和对话节点一样有“背景 + 立绘”。</li>
              <li>立绘请上传你自己的透明 PNG。内置只有占位剪影。</li>
              <li>一次可以多选图片上传，不限制单张大小；图片存放在浏览器的 IndexedDB 里（受磁盘剩余空间限制），项目 JSON 只保存引用。导出 JSON 时会把图片一起打包。</li>
            </ul>
            <h4>快捷键</h4>
            <ul>
              <li><code>空格 / Enter</code>：试玩时推进文本</li>
              <li><code>Esc</code>：停止试玩 / 关闭弹窗</li>
              <li><code>Ctrl + S</code>：立即保存</li>
            </ul>
            <h4>在线分享链接 / URL 参数</h4>
            <ul>
              <li><code>?play=1</code>：纯游玩模式，隐藏全部编辑界面，并自动从头播放。</li>
              <li><code>?preset=demo</code>：载入 <code>presets/demo.json</code>；也可以写 <code>presets/demo.json</code> 或完整 URL。</li>
              <li><code>?node=节点id</code>：指定从哪个节点开始播放。</li>
              <li>组合示例：<code>?play=1&amp;preset=my-story</code>。预设项目不会写入访客的浏览器存储，适合直接发链接给别人玩。</li>
            </ul>
            <h4>版权</h4>
            <p>这是本地同人工具。内置的游戏 UI / 剧情图 / 转场动画素材版权归 vanripper 与 Helltaker 原作所有，请勿随公开发布分发；对外发布请替换成你自己的素材。</p>
          </div>
          <div class="modal-foot">
            <span class="hint">素材目录：assets/ui</span>
            <button class="btn small primary" type="button" data-modal-close="1">知道了</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init().catch((error) => console.error("init failed", error));
  }
})();
