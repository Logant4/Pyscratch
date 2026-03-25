// ======================================================
// MINI SCRATCH PYTHON
// Features:
// - multiple sprites with separate code
// - drag sprites while running or not running
// - Python-like assignments / variables
// - if / elif / else
// - while
// - for ... in range(...)
// - say()
// - costume_change("file.png")
// - costume_next()
// - size(...)
// - set_size(...)
// - import_image("https://...")
// - help popup
// - save/load project as JSON
// - tab indentation + auto-indent after colon
// ======================================================

// ------------------------------------------------------
// 1. ASSETS
// ------------------------------------------------------
const PROJECT_FILES = [
  "cat.png",
  "dog.png",
  "rocket.png",
  "wizard.png",
  "space_background.png",
  "park_background.jpg"
];

// ------------------------------------------------------
// 2. DOM REFERENCES
// ------------------------------------------------------
const backgroundSelect = document.getElementById("background-select");
const stage = document.getElementById("stage");
const stageBackground = document.getElementById("stage-background");
const spritesLayer = document.getElementById("sprites-layer");

const runSelectedBtn = document.getElementById("run-selected-btn");
const runProjectBtn = document.getElementById("run-project-btn");
const stopBtn = document.getElementById("stop-btn");
const saveProjectBtn = document.getElementById("save-project-btn");
const loadProjectBtn = document.getElementById("load-project-btn");
const loadProjectInput = document.getElementById("load-project-input");

const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpCloseBtn = document.getElementById("help-close-btn");
const helpCloseBackdrop = document.getElementById("help-close-backdrop");

const addSpriteBtn = document.getElementById("add-sprite-btn");
const removeSpriteBtn = document.getElementById("remove-sprite-btn");
const spriteListEl = document.getElementById("sprite-list");

const spriteNameInput = document.getElementById("sprite-name-input");
const spriteImageSelect = document.getElementById("sprite-image-select");
const spriteXInput = document.getElementById("sprite-x-input");
const spriteYInput = document.getElementById("sprite-y-input");
const spriteAngleInput = document.getElementById("sprite-angle-input");

const codeEditor = document.getElementById("code-editor");
const output = document.getElementById("output");

// ------------------------------------------------------
// 3. GLOBAL STATE
// ------------------------------------------------------
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const SPRITE_SIZE = 80;
const MIN_SPRITE_SIZE = 10;
const MAX_SPRITE_SIZE = 400;

const backgroundFiles = PROJECT_FILES.filter(
  (file) => isImageFile(file) && file.toLowerCase().includes("background")
);

const spriteFiles = PROJECT_FILES.filter(
  (file) => isImageFile(file) && !file.toLowerCase().includes("background")
);

let sprites = [];
let selectedSpriteId = null;
let spriteIdCounter = 1;
let stopRequested = false;

let dragState = {
  active: false,
  spriteId: null,
  offsetX: 0,
  offsetY: 0
};

// ------------------------------------------------------
// 4. UTILITIES
// ------------------------------------------------------
function isImageUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^(https?:\/\/|data:image\/|blob:)/i.test(trimmed);
}

function isImageFile(filename) {
  if (typeof filename !== "string") return false;

  const trimmed = filename.trim();
  if (isImageUrl(trimmed)) return true;

  const lower = trimmed.toLowerCase().split("?")[0].split("#")[0];
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getDisplayNameForImage(file) {
  if (typeof file !== "string") return "";
  if (!isImageUrl(file)) return file;

  try {
    const url = new URL(file);
    const lastPart = url.pathname.split("/").filter(Boolean).pop();
    return lastPart || url.hostname;
  } catch (_) {
    return file.length > 50 ? file.slice(0, 47) + "..." : file;
  }
}

function log(message) {
  output.textContent += message + "\n";
  output.scrollTop = output.scrollHeight;
}

function clearLog() {
  output.textContent = "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStageSize() {
  const rect = stage.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSelectedSprite() {
  return sprites.find((s) => s.id === selectedSpriteId) || null;
}

function getSpriteById(id) {
  return sprites.find((s) => s.id === id) || null;
}

function setSelectedSprite(id) {
  selectedSpriteId = id;
  renderSpriteList();
  renderSpriteSettings();
  renderCodeEditor();
  renderStage();
}

function makeDefaultScript(name) {
  return [
    `say("Hello from ${name}")`,
    `for i in range(4):`,
    `    move(40)`,
    `    turn(90)`
  ].join("\n");
}

function getSpritePixelSize(sprite) {
  const percent = Number(sprite.size) || 100;
  return clamp((SPRITE_SIZE * percent) / 100, MIN_SPRITE_SIZE, MAX_SPRITE_SIZE);
}

function clampSpriteToStage(sprite) {
  const { width, height } = getStageSize();
  const half = getSpritePixelSize(sprite) / 2;
  sprite.x = clamp(sprite.x, half, Math.max(half, width - half));
  sprite.y = clamp(sprite.y, half, Math.max(half, height - half));
}

function updatePositionInputs() {
  const sprite = getSelectedSprite();
  if (!sprite) return;
  spriteXInput.value = Math.round(sprite.x);
  spriteYInput.value = Math.round(sprite.y);
}

function setSpritePosition(sprite, x, y) {
  sprite.x = x;
  sprite.y = y;
  clampSpriteToStage(sprite);
  renderStage();
  if (sprite.id === selectedSpriteId) {
    updatePositionInputs();
  }
}

function normalizeSpriteSize(value) {
  return clamp(Number(value) || 0, MIN_SPRITE_SIZE, MAX_SPRITE_SIZE);
}

function addImageToSpriteLibrary(imageUrl) {
  if (!isImageFile(imageUrl)) {
    throw new Error("That does not look like a direct image link.");
  }

  if (!spriteFiles.includes(imageUrl)) {
    spriteFiles.push(imageUrl);
    renderSpriteImageOptions();
  }
}

function addCostumeToSprite(sprite, imageUrl) {
  addImageToSpriteLibrary(imageUrl);

  if (!Array.isArray(sprite.costumes)) {
    sprite.costumes = [];
  }

  if (!sprite.costumes.includes(imageUrl)) {
    sprite.costumes.push(imageUrl);
  }

  sprite.image = imageUrl;
  sprite.costumeIndex = sprite.costumes.indexOf(imageUrl);
  if (sprite.costumeIndex < 0) sprite.costumeIndex = 0;
}

// ------------------------------------------------------
// 5. SPRITE CREATION / MANAGEMENT
// ------------------------------------------------------
function createSprite() {
  const image = spriteFiles[0] || "";
  const id = "sprite_" + spriteIdCounter++;
  const name = "Sprite " + sprites.length;

  const sprite = {
    id,
    name,
    image,
    costumes: spriteFiles.length > 0 ? [...spriteFiles] : image ? [image] : [],
    costumeIndex: Math.max(0, spriteFiles.indexOf(image)),
    x: 100 + sprites.length * 40,
    y: 100 + sprites.length * 30,
    angle: 0,
    size: 100,
    visible: true,
    sayText: "",
    script: makeDefaultScript(name),
    dom: null,
    speechDom: null
  };

  if (sprite.costumeIndex < 0) sprite.costumeIndex = 0;

  clampSpriteToStage(sprite);
  sprites.push(sprite);
  setSelectedSprite(sprite.id);
}

function removeSelectedSprite() {
  if (!selectedSpriteId) return;

  sprites = sprites.filter((s) => s.id !== selectedSpriteId);

  if (sprites.length > 0) {
    setSelectedSprite(sprites[0].id);
  } else {
    selectedSpriteId = null;
    renderSpriteList();
    renderSpriteSettings();
    renderCodeEditor();
    renderStage();
  }
}

// ------------------------------------------------------
// 6. RENDERING
// ------------------------------------------------------
function renderBackgroundOptions() {
  backgroundSelect.innerHTML = "";

  if (backgroundFiles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "(No backgrounds found)";
    backgroundSelect.appendChild(option);
    return;
  }

  backgroundFiles.forEach((file) => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = getDisplayNameForImage(file);
    backgroundSelect.appendChild(option);
  });

  if (!backgroundSelect.value && backgroundFiles[0]) {
    backgroundSelect.value = backgroundFiles[0];
  }
}

function renderSpriteImageOptions() {
  spriteImageSelect.innerHTML = "";

  if (spriteFiles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "(No sprite images found)";
    spriteImageSelect.appendChild(option);
    return;
  }

  spriteFiles.forEach((file) => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = getDisplayNameForImage(file);
    spriteImageSelect.appendChild(option);
  });
}

function renderBackground() {
  const bg = backgroundSelect.value || "";
  stageBackground.style.backgroundImage = bg ? `url("${bg}")` : "none";
}

function renderSpriteList() {
  spriteListEl.innerHTML = "";

  sprites.forEach((sprite) => {
    const li = document.createElement("li");
    li.textContent = sprite.name;
    li.className = sprite.id === selectedSpriteId ? "active" : "";
    li.addEventListener("click", () => setSelectedSprite(sprite.id));
    spriteListEl.appendChild(li);
  });
}

function renderSpriteSettings() {
  const sprite = getSelectedSprite();
  const hasSprite = !!sprite;

  spriteNameInput.disabled = !hasSprite;
  spriteImageSelect.disabled = !hasSprite;
  spriteXInput.disabled = !hasSprite;
  spriteYInput.disabled = !hasSprite;
  spriteAngleInput.disabled = !hasSprite;
  codeEditor.disabled = !hasSprite;

  if (!sprite) {
    spriteNameInput.value = "";
    spriteImageSelect.value = "";
    spriteXInput.value = "";
    spriteYInput.value = "";
    spriteAngleInput.value = "";
    return;
  }

  spriteNameInput.value = sprite.name;
  spriteImageSelect.value = sprite.image;
  spriteXInput.value = Math.round(sprite.x);
  spriteYInput.value = Math.round(sprite.y);
  spriteAngleInput.value = Math.round(sprite.angle);
}

function renderCodeEditor() {
  const sprite = getSelectedSprite();
  codeEditor.value = sprite ? sprite.script : "";
}

function renderStage() {
  renderBackground();
  spritesLayer.innerHTML = "";

  sprites.forEach((sprite) => {
    const spriteEl = document.createElement("div");
    spriteEl.className = "sprite";
    if (dragState.active && dragState.spriteId === sprite.id) {
      spriteEl.classList.add("dragging");
    }

    const pixelSize = getSpritePixelSize(sprite);

    spriteEl.style.left = `${sprite.x}px`;
    spriteEl.style.top = `${sprite.y}px`;
    spriteEl.style.width = `${pixelSize}px`;
    spriteEl.style.height = `${pixelSize}px`;
    spriteEl.style.transform = `translate(-50%, -50%) rotate(${sprite.angle}deg)`;
    spriteEl.style.display = sprite.visible ? "block" : "none";

    const img = document.createElement("img");
    img.src = sprite.image;
    img.alt = sprite.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.draggable = false;

    spriteEl.appendChild(img);

    if (sprite.sayText) {
      const speech = document.createElement("div");
      speech.className = "speech";
      speech.textContent = sprite.sayText;
      spriteEl.appendChild(speech);
      sprite.speechDom = speech;
    } else {
      sprite.speechDom = null;
    }

    spriteEl.addEventListener("pointerdown", (e) => {
      startDraggingSprite(e, sprite.id);
    });

    spriteEl.addEventListener("click", (e) => {
      e.stopPropagation();
      setSelectedSprite(sprite.id);
    });

    spritesLayer.appendChild(spriteEl);
    sprite.dom = spriteEl;
  });
}

// ------------------------------------------------------
// 7. DRAGGING
// ------------------------------------------------------
function getStageRelativePoint(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function startDraggingSprite(event, spriteId) {
  event.preventDefault();
  event.stopPropagation();

  const sprite = getSpriteById(spriteId);
  if (!sprite) return;

  setSelectedSprite(sprite.id);

  const point = getStageRelativePoint(event.clientX, event.clientY);

  dragState.active = true;
  dragState.spriteId = sprite.id;
  dragState.offsetX = point.x - sprite.x;
  dragState.offsetY = point.y - sprite.y;

  if (sprite.dom && sprite.dom.setPointerCapture) {
    try {
      sprite.dom.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  renderStage();
}

function handlePointerMove(event) {
  if (!dragState.active) return;

  const sprite = getSpriteById(dragState.spriteId);
  if (!sprite) return;

  const point = getStageRelativePoint(event.clientX, event.clientY);
  const nextX = point.x - dragState.offsetX;
  const nextY = point.y - dragState.offsetY;

  setSpritePosition(sprite, nextX, nextY);
}

function stopDragging() {
  if (!dragState.active) return;
  dragState.active = false;
  dragState.spriteId = null;
  renderStage();
}

// ------------------------------------------------------
// 8. UI -> STATE
// ------------------------------------------------------
function saveSelectedSpriteFromEditor() {
  const sprite = getSelectedSprite();
  if (!sprite) return;
  sprite.script = codeEditor.value;
}

function updateSpriteCostumeList(sprite) {
  if (!sprite) return;

  const localOrKnownImages = spriteFiles.length > 0 ? [...spriteFiles] : [];
  const existingCostumes = Array.isArray(sprite.costumes) ? sprite.costumes.filter(isImageFile) : [];
  const merged = [...new Set([...existingCostumes, ...localOrKnownImages])];

  sprite.costumes = merged.length > 0 ? merged : (sprite.image ? [sprite.image] : []);

  if (sprite.image && !sprite.costumes.includes(sprite.image) && isImageFile(sprite.image)) {
    sprite.costumes.push(sprite.image);
  }

  let idx = sprite.costumes.indexOf(sprite.image);
  if (idx === -1) {
    if (sprite.costumes.length > 0) {
      sprite.image = sprite.costumes[0];
      idx = 0;
    } else {
      idx = 0;
    }
  }

  sprite.costumeIndex = idx;
}

function openHelp() {
  helpModal.classList.remove("hidden");
}

function closeHelp() {
  helpModal.classList.add("hidden");
}

function handleEditorKeys(event) {
  const textarea = codeEditor;

  if (event.key === "Tab") {
    event.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.slice(0, start) + "    " + value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 4;
    saveSelectedSpriteFromEditor();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const before = value.slice(0, start);
    const after = value.slice(end);

    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.slice(lineStart);
    const indentMatch = currentLine.match(/^ */);
    const currentIndent = indentMatch ? indentMatch[0] : "";

    const trimmed = currentLine.trim();
    const extraIndent = trimmed.endsWith(":") ? "    " : "";

    const insertion = "\n" + currentIndent + extraIndent;

    textarea.value = before + insertion + after;
    const newCaret = start + insertion.length;
    textarea.selectionStart = textarea.selectionEnd = newCaret;

    saveSelectedSpriteFromEditor();
  }
}

function saveProjectToFile() {
  saveSelectedSpriteFromEditor();

  const data = {
    version: 2,
    background: backgroundSelect.value,
    sprites: sprites.map((sprite) => ({
      id: sprite.id,
      name: sprite.name,
      image: sprite.image,
      costumes: sprite.costumes,
      costumeIndex: sprite.costumeIndex,
      x: sprite.x,
      y: sprite.y,
      angle: sprite.angle,
      size: sprite.size,
      visible: sprite.visible,
      sayText: sprite.sayText,
      script: sprite.script
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mini-scratch-project.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  log("Project saved.");
}

function loadProjectFromFile(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!data || !Array.isArray(data.sprites)) {
        throw new Error("Invalid project file.");
      }

      sprites = data.sprites.map((item, index) => {
        const costumes = Array.isArray(item.costumes) && item.costumes.length > 0
          ? item.costumes.filter(isImageFile)
          : [...spriteFiles];

        costumes.forEach((costume) => {
          if (isImageUrl(costume) && !spriteFiles.includes(costume)) {
            spriteFiles.push(costume);
          }
        });

        if (isImageUrl(item.image) && !spriteFiles.includes(item.image)) {
          spriteFiles.push(item.image);
        }

        return {
          id: item.id || "sprite_" + (index + 1),
          name: item.name || `Sprite ${index + 1}`,
          image: item.image || spriteFiles[0] || "",
          costumes,
          costumeIndex: Number.isInteger(item.costumeIndex) ? item.costumeIndex : 0,
          x: Number(item.x) || 100,
          y: Number(item.y) || 100,
          angle: Number(item.angle) || 0,
          size: normalizeSpriteSize(item.size == null ? 100 : item.size),
          visible: item.visible !== false,
          sayText: typeof item.sayText === "string" ? item.sayText : "",
          script: typeof item.script === "string" ? item.script : "",
          dom: null,
          speechDom: null
        };
      });

      renderSpriteImageOptions();

      spriteIdCounter = sprites.length + 1;

      sprites.forEach((sprite) => {
        updateSpriteCostumeList(sprite);
        clampSpriteToStage(sprite);
      });

      if (typeof data.background === "string") {
        backgroundSelect.value = data.background;
      }

      selectedSpriteId = sprites[0] ? sprites[0].id : null;
      renderAll();
      log("Project loaded.");
    } catch (err) {
      log(`LOAD ERROR: ${err.message}`);
    }
  };

  reader.readAsText(file);
}

function hookEvents() {
  backgroundSelect.addEventListener("change", () => {
    renderBackground();
  });

  addSpriteBtn.addEventListener("click", () => {
    createSprite();
    renderAll();
  });

  removeSpriteBtn.addEventListener("click", () => {
    removeSelectedSprite();
    renderAll();
  });

  spriteNameInput.addEventListener("input", () => {
    const sprite = getSelectedSprite();
    if (!sprite) return;
    sprite.name = spriteNameInput.value;
    renderSpriteList();
    renderStage();
  });

  spriteImageSelect.addEventListener("change", () => {
    const sprite = getSelectedSprite();
    if (!sprite) return;
    sprite.image = spriteImageSelect.value;
    updateSpriteCostumeList(sprite);
    renderStage();
  });

  spriteXInput.addEventListener("input", () => {
    const sprite = getSelectedSprite();
    if (!sprite) return;
    setSpritePosition(sprite, Number(spriteXInput.value) || 0, sprite.y);
  });

  spriteYInput.addEventListener("input", () => {
    const sprite = getSelectedSprite();
    if (!sprite) return;
    setSpritePosition(sprite, sprite.x, Number(spriteYInput.value) || 0);
  });

  spriteAngleInput.addEventListener("input", () => {
    const sprite = getSelectedSprite();
    if (!sprite) return;
    sprite.angle = Number(spriteAngleInput.value) || 0;
    renderStage();
  });

  codeEditor.addEventListener("input", () => {
    saveSelectedSpriteFromEditor();
  });

  codeEditor.addEventListener("keydown", handleEditorKeys);

  runSelectedBtn.addEventListener("click", async () => {
    saveSelectedSpriteFromEditor();
    const sprite = getSelectedSprite();
    if (!sprite) return;
    await runSelectedSprite(sprite);
  });

  runProjectBtn.addEventListener("click", async () => {
    saveSelectedSpriteFromEditor();
    await runProject();
  });

  stopBtn.addEventListener("click", () => {
    stopAllScripts();
  });

  saveProjectBtn.addEventListener("click", saveProjectToFile);

  loadProjectBtn.addEventListener("click", () => {
    loadProjectInput.click();
  });

  loadProjectInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      loadProjectFromFile(file);
    }
    loadProjectInput.value = "";
  });

  helpBtn.addEventListener("click", openHelp);
  helpCloseBtn.addEventListener("click", closeHelp);
  helpCloseBackdrop.addEventListener("click", closeHelp);

  window.addEventListener("resize", () => {
    sprites.forEach(clampSpriteToStage);
    renderStage();
    renderSpriteSettings();
  });

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointercancel", stopDragging);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
      closeHelp();
    }
  });
}

function renderAll() {
  renderBackgroundOptions();
  renderSpriteImageOptions();
  renderSpriteList();
  renderSpriteSettings();
  renderCodeEditor();
  renderStage();
}

// ------------------------------------------------------
// 9. MINI PYTHON-LIKE PARSER
// ------------------------------------------------------
function parseProgram(source) {
  const rawLines = source.replace(/\t/g, "    ").split("\n");

  const lines = rawLines.map((raw, index) => {
    const indentMatch = raw.match(/^ */);
    const indent = indentMatch ? indentMatch[0].length : 0;
    const text = raw.trim();

    return {
      number: index + 1,
      raw,
      indent,
      text
    };
  });

  const filtered = lines.filter((line) => line.text !== "" && !line.text.startsWith("#"));
  const state = { index: 0 };
  return parseBlock(filtered, state, 0);
}

function parseBlock(lines, state, expectedIndent) {
  const statements = [];

  while (state.index < lines.length) {
    const line = lines[state.index];

    if (line.indent < expectedIndent) break;

    if (line.indent > expectedIndent) {
      throw new Error(`Unexpected indent on line ${line.number}: "${line.raw}"`);
    }

    if (line.text.startsWith("if ") && line.text.endsWith(":")) {
      statements.push(parseIfChain(lines, state, expectedIndent));
      continue;
    }

    if (line.text.startsWith("while ") && line.text.endsWith(":")) {
      const condition = line.text.slice(6, -1).trim();
      state.index++;
      const body = parseBlock(lines, state, expectedIndent + 4);

      statements.push({
        type: "while",
        condition,
        body,
        line: line.number
      });
      continue;
    }

    const forMatch = line.text.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+):$/);
    if (forMatch) {
      const varName = forMatch[1];
      const iterableExpr = forMatch[2].trim();
      state.index++;
      const body = parseBlock(lines, state, expectedIndent + 4);

      statements.push({
        type: "for",
        varName,
        iterableExpr,
        body,
        line: line.number
      });
      continue;
    }

    if (line.text === "else:" || line.text.startsWith("elif ")) {
      break;
    }

    const assignMatch = line.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      statements.push({
        type: "assign",
        name: assignMatch[1],
        expression: assignMatch[2],
        line: line.number
      });
      state.index++;
      continue;
    }

    statements.push({
      type: "call",
      code: line.text,
      line: line.number
    });
    state.index++;
  }

  return statements;
}

function parseIfChain(lines, state, expectedIndent) {
  const firstLine = lines[state.index];
  const branches = [];

  while (state.index < lines.length) {
    const line = lines[state.index];

    if (line.indent !== expectedIndent) break;

    if (line.text.startsWith("if ") && line.text.endsWith(":")) {
      const condition = line.text.slice(3, -1).trim();
      state.index++;
      const body = parseBlock(lines, state, expectedIndent + 4);
      branches.push({
        condition,
        body,
        line: line.number
      });
      continue;
    }

    if (line.text.startsWith("elif ") && line.text.endsWith(":")) {
      const condition = line.text.slice(5, -1).trim();
      state.index++;
      const body = parseBlock(lines, state, expectedIndent + 4);
      branches.push({
        condition,
        body,
        line: line.number
      });
      continue;
    }

    break;
  }

  let elseBody = null;
  if (
    state.index < lines.length &&
    lines[state.index].indent === expectedIndent &&
    lines[state.index].text === "else:"
  ) {
    state.index++;
    elseBody = parseBlock(lines, state, expectedIndent + 4);
  }

  return {
    type: "ifchain",
    branches,
    elseBody,
    line: firstLine.number
  };
}

// ------------------------------------------------------
// 10. EXPRESSION HANDLING
// ------------------------------------------------------
function pythonExprToJs(expr) {
  return expr
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/\bnot\b/g, "!");
}

function evaluateExpression(expr, scope, helpers) {
  const jsExpr = pythonExprToJs(expr);

  try {
    const fn = new Function(
      "scope",
      "helpers",
      `
      with (helpers) {
        with (scope) {
          return (${jsExpr});
        }
      }
      `
    );
    return fn(scope, helpers);
  } catch (err) {
    throw new Error(`Bad expression "${expr}": ${err.message}`);
  }
}

function splitArguments(argsText) {
  const args = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    const prev = argsText[i - 1];

    if ((ch === '"' || ch === "'") && prev !== "\\") {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      }
      current += ch;
      continue;
    }

    if (!quote) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      if (ch === ")" || ch === "]" || ch === "}") depth--;

      if (ch === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current.trim() !== "") args.push(current.trim());
  return args;
}

function parseCall(code) {
  const match = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid command: "${code}"`);
  }

  const name = match[1];
  const argsText = match[2].trim();
  const args = argsText ? splitArguments(argsText) : [];

  return { name, args };
}

// ------------------------------------------------------
// 11. HELPERS / BUILTINS
// ------------------------------------------------------
function pythonRange(...args) {
  let start = 0;
  let stop = 0;
  let step = 1;

  if (args.length === 1) {
    stop = Number(args[0]);
  } else if (args.length === 2) {
    start = Number(args[0]);
    stop = Number(args[1]);
  } else if (args.length === 3) {
    start = Number(args[0]);
    stop = Number(args[1]);
    step = Number(args[2]);
  } else {
    throw new Error("range() takes 1, 2, or 3 arguments");
  }

  if (step === 0) throw new Error("range() step cannot be 0");

  const result = [];
  if (step > 0) {
    for (let i = start; i < stop; i += step) result.push(i);
  } else {
    for (let i = start; i > stop; i += step) result.push(i);
  }
  return result;
}

function makeHelpersForSprite(sprite, scope) {
  return {
    Math,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    int: (v) => Math.trunc(Number(v)),
    float: (v) => Number(v),
    str: (v) => String(v),
    len: (v) => (v != null && v.length != null ? v.length : 0),
    range: (...args) => pythonRange(...args),

    touching_edge: () => isTouchingEdge(sprite),
    random: (a, b) => {
      const minV = Number(a);
      const maxV = Number(b);
      return Math.floor(Math.random() * (maxV - minV + 1)) + minV;
    }
  };
}

function syncScopeFromSprite(sprite, scope) {
  scope.x = sprite.x;
  scope.y = sprite.y;
  scope.angle = sprite.angle;
  scope.size = sprite.size;
  scope.visible = sprite.visible;
  scope.costume = sprite.image;
}

function syncSpriteFromScope(sprite, scope) {
  if (typeof scope.x === "number") sprite.x = scope.x;
  if (typeof scope.y === "number") sprite.y = scope.y;
  if (typeof scope.angle === "number") sprite.angle = scope.angle;
  if (typeof scope.size === "number") sprite.size = normalizeSpriteSize(scope.size);
  if (typeof scope.visible === "boolean") sprite.visible = scope.visible;

  clampSpriteToStage(sprite);
  renderStage();
  renderSpriteSettings();
}

function isTouchingEdge(sprite) {
  const { width, height } = getStageSize();
  const half = getSpritePixelSize(sprite) / 2;

  return (
    sprite.x - half <= 0 ||
    sprite.x + half >= width ||
    sprite.y - half <= 0 ||
    sprite.y + half >= height
  );
}

function setSpriteImage(sprite, filename) {
  if (!filename) return;
  if (!isImageFile(filename)) {
    throw new Error(`Unknown costume "${filename}"`);
  }

  if (isImageUrl(filename) && !spriteFiles.includes(filename)) {
    spriteFiles.push(filename);
    renderSpriteImageOptions();
  }

  updateSpriteCostumeList(sprite);

  if (!sprite.costumes.includes(filename)) {
    sprite.costumes.push(filename);
  }

  sprite.image = filename;
  sprite.costumeIndex = sprite.costumes.indexOf(filename);
  if (sprite.costumeIndex < 0) sprite.costumeIndex = 0;
  renderStage();
  renderSpriteSettings();
}

async function builtin_move(sprite, scope, stepsExpr, helpers) {
  const steps = Number(evaluateExpression(stepsExpr, scope, helpers)) || 0;
  const radians = degreesToRadians(sprite.angle);
  sprite.x += Math.cos(radians) * steps;
  sprite.y += Math.sin(radians) * steps;

  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_turn(sprite, scope, degreesExpr, helpers) {
  const deg = Number(evaluateExpression(degreesExpr, scope, helpers)) || 0;
  sprite.angle += deg;

  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_goto(sprite, scope, xExpr, yExpr, helpers) {
  sprite.x = Number(evaluateExpression(xExpr, scope, helpers)) || 0;
  sprite.y = Number(evaluateExpression(yExpr, scope, helpers)) || 0;

  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_set_x(sprite, scope, expr, helpers) {
  sprite.x = Number(evaluateExpression(expr, scope, helpers)) || 0;
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_set_y(sprite, scope, expr, helpers) {
  sprite.y = Number(evaluateExpression(expr, scope, helpers)) || 0;
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_point(sprite, scope, expr, helpers) {
  sprite.angle = Number(evaluateExpression(expr, scope, helpers)) || 0;
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_say(sprite, scope, args, helpers) {
  const text = args.length >= 1 ? evaluateExpression(args[0], scope, helpers) : "";
  const seconds = args.length >= 2
    ? Number(evaluateExpression(args[1], scope, helpers)) || 0
    : null;

  sprite.sayText = String(text);
  renderStage();

  if (seconds != null && seconds > 0) {
    await sleep(seconds * 1000);
    if (stopRequested) return;
    sprite.sayText = "";
    renderStage();
  }
}

async function builtin_wait(sprite, scope, expr, helpers) {
  const seconds = Number(evaluateExpression(expr, scope, helpers)) || 0;
  await sleep(seconds * 1000);
}

async function builtin_hide(sprite, scope) {
  sprite.visible = false;
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_show(sprite, scope) {
  sprite.visible = true;
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_change_x(sprite, scope, expr, helpers) {
  sprite.x += Number(evaluateExpression(expr, scope, helpers)) || 0;
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_change_y(sprite, scope, expr, helpers) {
  sprite.y += Number(evaluateExpression(expr, scope, helpers)) || 0;
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_print(sprite, scope, expr, helpers) {
  const value = evaluateExpression(expr, scope, helpers);
  log(`[${sprite.name}] ${value}`);
}

async function builtin_costume_change(sprite, scope, expr, helpers) {
  const filename = String(evaluateExpression(expr, scope, helpers));
  setSpriteImage(sprite, filename);
  syncScopeFromSprite(sprite, scope);
}

async function builtin_costume_next(sprite, scope) {
  updateSpriteCostumeList(sprite);
  if (sprite.costumes.length === 0) return;

  sprite.costumeIndex = (sprite.costumeIndex + 1) % sprite.costumes.length;
  sprite.image = sprite.costumes[sprite.costumeIndex];
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_size(sprite, scope, expr, helpers) {
  const change = Number(evaluateExpression(expr, scope, helpers)) || 0;
  sprite.size = normalizeSpriteSize((Number(sprite.size) || 100) + change);
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_set_size(sprite, scope, expr, helpers) {
  const newSize = Number(evaluateExpression(expr, scope, helpers)) || 0;
  sprite.size = normalizeSpriteSize(newSize);
  clampSpriteToStage(sprite);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
}

async function builtin_import_image(sprite, scope, expr, helpers) {
  const imageUrl = String(evaluateExpression(expr, scope, helpers)).trim();

  if (!imageUrl) {
    throw new Error('import_image(...) needs a direct image URL');
  }

  addCostumeToSprite(sprite, imageUrl);
  syncScopeFromSprite(sprite, scope);
  renderStage();
  renderSpriteSettings();
  log(`[${sprite.name}] Imported image: ${getDisplayNameForImage(imageUrl)}`);
}

// ------------------------------------------------------
// 12. EXECUTION ENGINE
// ------------------------------------------------------
async function executeCall(statement, sprite, scope, helpers) {
  const { name, args } = parseCall(statement.code);

  switch (name) {
    case "move":
      if (args.length !== 1) throw new Error("move(...) takes 1 argument");
      await builtin_move(sprite, scope, args[0], helpers);
      return;

    case "turn":
      if (args.length !== 1) throw new Error("turn(...) takes 1 argument");
      await builtin_turn(sprite, scope, args[0], helpers);
      return;

    case "goto":
      if (args.length !== 2) throw new Error("goto(...) takes 2 arguments");
      await builtin_goto(sprite, scope, args[0], args[1], helpers);
      return;

    case "set_x":
      if (args.length !== 1) throw new Error("set_x(...) takes 1 argument");
      await builtin_set_x(sprite, scope, args[0], helpers);
      return;

    case "set_y":
      if (args.length !== 1) throw new Error("set_y(...) takes 1 argument");
      await builtin_set_y(sprite, scope, args[0], helpers);
      return;

    case "change_x":
      if (args.length !== 1) throw new Error("change_x(...) takes 1 argument");
      await builtin_change_x(sprite, scope, args[0], helpers);
      return;

    case "change_y":
      if (args.length !== 1) throw new Error("change_y(...) takes 1 argument");
      await builtin_change_y(sprite, scope, args[0], helpers);
      return;

    case "point":
      if (args.length !== 1) throw new Error("point(...) takes 1 argument");
      await builtin_point(sprite, scope, args[0], helpers);
      return;

    case "say":
      await builtin_say(sprite, scope, args, helpers);
      return;

    case "wait":
      if (args.length !== 1) throw new Error("wait(...) takes 1 argument");
      await builtin_wait(sprite, scope, args[0], helpers);
      return;

    case "hide":
      await builtin_hide(sprite, scope);
      return;

    case "show":
      await builtin_show(sprite, scope);
      return;

    case "print":
      if (args.length !== 1) throw new Error("print(...) takes 1 argument");
      await builtin_print(sprite, scope, args[0], helpers);
      return;

    case "costume_change":
      if (args.length !== 1) throw new Error("costume_change(...) takes 1 argument");
      await builtin_costume_change(sprite, scope, args[0], helpers);
      return;

    case "costume_next":
      if (args.length !== 0) throw new Error("costume_next() takes 0 arguments");
      await builtin_costume_next(sprite, scope);
      return;

    case "size":
      if (args.length !== 1) throw new Error("size(...) takes 1 argument");
      await builtin_size(sprite, scope, args[0], helpers);
      return;

    case "set_size":
      if (args.length !== 1) throw new Error("set_size(...) takes 1 argument");
      await builtin_set_size(sprite, scope, args[0], helpers);
      return;

    case "import_image":
      if (args.length !== 1) throw new Error("import_image(...) takes 1 argument");
      await builtin_import_image(sprite, scope, args[0], helpers);
      return;

    default:
      throw new Error(`Unknown command "${name}"`);
  }
}

async function executeStatements(statements, sprite, scope, helpers) {
  for (const statement of statements) {
    if (stopRequested) return;

    try {
      if (statement.type === "assign") {
        const value = evaluateExpression(statement.expression, scope, helpers);
        scope[statement.name] = value;
        syncSpriteFromScope(sprite, scope);
      } else if (statement.type === "call") {
        await executeCall(statement, sprite, scope, helpers);
      } else if (statement.type === "ifchain") {
        let matched = false;

        for (const branch of statement.branches) {
          const condition = !!evaluateExpression(branch.condition, scope, helpers);
          if (condition) {
            matched = true;
            await executeStatements(branch.body, sprite, scope, helpers);
            break;
          }
        }

        if (!matched && statement.elseBody) {
          await executeStatements(statement.elseBody, sprite, scope, helpers);
        }
      } else if (statement.type === "while") {
        let loopGuard = 0;

        while (!!evaluateExpression(statement.condition, scope, helpers)) {
          if (stopRequested) return;

          loopGuard++;
          if (loopGuard > 100000) {
            throw new Error(`Loop safety stop on line ${statement.line}. Too many iterations.`);
          }

          await executeStatements(statement.body, sprite, scope, helpers);
          await sleep(0);
        }
      } else if (statement.type === "for") {
        const iterable = evaluateExpression(statement.iterableExpr, scope, helpers);

        if (!iterable || typeof iterable[Symbol.iterator] !== "function") {
          throw new Error(`Expression "${statement.iterableExpr}" is not iterable`);
        }

        let loopGuard = 0;
        for (const item of iterable) {
          if (stopRequested) return;

          loopGuard++;
          if (loopGuard > 100000) {
            throw new Error(`Loop safety stop on line ${statement.line}. Too many iterations.`);
          }

          scope[statement.varName] = item;
          await executeStatements(statement.body, sprite, scope, helpers);
          await sleep(0);
        }
      } else {
        throw new Error(`Unknown statement type "${statement.type}"`);
      }
    } catch (err) {
      throw new Error(`Line ${statement.line}: ${err.message}`);
    }
  }
}

async function runSpriteScript(sprite) {
  sprite.sayText = "";
  updateSpriteCostumeList(sprite);
  renderStage();

  const scope = {
    x: sprite.x,
    y: sprite.y,
    angle: sprite.angle,
    size: sprite.size,
    visible: sprite.visible,
    costume: sprite.image
  };

  const helpers = makeHelpersForSprite(sprite, scope);
  const ast = parseProgram(sprite.script);

  log(`Running ${sprite.name}...`);
  await executeStatements(ast, sprite, scope, helpers);
  log(`Finished ${sprite.name}.`);
}

async function runSelectedSprite(sprite) {
  stopAllScripts(false);
  clearLog();
  stopRequested = false;

  try {
    await runSpriteScript(sprite);
  } catch (err) {
    log(`ERROR in ${sprite.name}: ${err.message}`);
  }
}

async function runProject() {
  stopAllScripts(false);
  clearLog();
  stopRequested = false;

  const tasks = sprites.map(async (sprite) => {
    try {
      await runSpriteScript(sprite);
    } catch (err) {
      log(`ERROR in ${sprite.name}: ${err.message}`);
    }
  });

  await Promise.all(tasks);
}

function stopAllScripts(clearSpeech = true) {
  stopRequested = true;

  if (clearSpeech) {
    sprites.forEach((sprite) => {
      sprite.sayText = "";
    });
    renderStage();
  }

  log("Stop requested.");
}

// ------------------------------------------------------
// 13. SAMPLE PROGRAMS
// ------------------------------------------------------
function loadStarterSprites() {
  if (spriteFiles.length === 0) {
    log("No sprite image files found in PROJECT_FILES.");
    return;
  }

  createSprite();
  createSprite();

  if (sprites[0]) {
    sprites[0].name = "Cat";
    sprites[0].image = spriteFiles[0] || "";
    updateSpriteCostumeList(sprites[0]);
    sprites[0].script = [
      `say("Testing")`,
      `for i in range(4):`,
      `    move(40)`,
      `    turn(90)`,
      `say("Done", 1)`
    ].join("\n");
  }

  if (sprites[1]) {
    sprites[1].name = "Dog";
    sprites[1].image = spriteFiles[1] || spriteFiles[0] || "";
    sprites[1].x = 250;
    sprites[1].y = 220;
    updateSpriteCostumeList(sprites[1]);
    sprites[1].script = [
      `n = 0`,
      `while True:`,
      `    if touching_edge():`,
      `        turn(135)`,
      `    elif n > 10:`,
      `        costume_next()`,
      `        n = 0`,
      `    else:`,
      `        move(10)`,
      `    n = n + 1`,
      `    wait(0.1)`
    ].join("\n");
  }

  if (backgroundFiles.length > 0) {
    backgroundSelect.value = backgroundFiles[0];
  }

  setSelectedSprite(sprites[0]?.id || null);
}

// ------------------------------------------------------
// 14. INIT
// ------------------------------------------------------
function init() {
  renderBackgroundOptions();
  renderSpriteImageOptions();
  hookEvents();
  loadStarterSprites();
  renderAll();
}

init();
