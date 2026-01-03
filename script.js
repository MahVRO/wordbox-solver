console.log("JS loaded");

/* =====================
   ELEMENTS
===================== */
const gridDiv = document.getElementById("grid");
const sizeSelect = document.getElementById("size");
const output = document.getElementById("output");

const newGridBtn = document.getElementById("newGrid");
const randomBtn = document.getElementById("randomize");
const solveBtn = document.getElementById("solve");
const wrapper = document.getElementById("grid-wrapper");

const singleLetterToggle = document.getElementById("singleLetter");
const bonusToggle = document.getElementById("bonusToggle");

/* =====================
   STATE
===================== */
let bonusIndex = null;
let DICT = new Set();
let PREFIX = new Set();
let dictReady = false;

/* =====================
   LOAD FRENCH DICTIONARY
===================== */
fetch("https://raw.githubusercontent.com/Taknok/French-Wordlist/master/francais.txt")
  .then(r => r.text())
  .then(text => {
    const words = text
      .split("\n")
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length >= 3);

    for (const w of words) {
      DICT.add(w);
      for (let i = 1; i <= w.length; i++) {
        PREFIX.add(w.slice(0, i));
      }
    }

    dictReady = true;
    console.log("Dictionary ready:", DICT.size, "words");
  })
  .catch(err => {
    console.error("Dictionary load failed", err);
  });

/* =====================
   GRID BUILD
===================== */
newGridBtn.onclick = buildGrid;
randomBtn.onclick = randomizeGrid;
solveBtn.onclick = solve;

function buildGrid() {
  const n = +sizeSelect.value;
  gridDiv.innerHTML = "";
  gridDiv.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  bonusIndex = null;

  for (let i = 0; i < n * n; i++) {
    const input = document.createElement("input");
    input.dataset.index = i;
    input.maxLength = singleLetterToggle.checked ? 1 : 2;

    input.addEventListener("pointerdown", e => {
      if (bonusToggle.checked) {
        e.preventDefault();
        selectBonus(i);
        return;
      }

      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });

    gridDiv.appendChild(input);
  }
}

buildGrid();

/* =====================
   BONUS TILE
===================== */
function selectBonus(i) {
  [...gridDiv.children].forEach(el => el.classList.remove("bonus"));
  bonusIndex = i;
  gridDiv.children[i].classList.add("bonus");
}

/* =====================
   RANDOMIZE
===================== */
function randomizeGrid() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  [...gridDiv.children].forEach(input => {
    input.value = letters[Math.floor(Math.random() * letters.length)];
  });
}

/* =====================
   GRID READ
===================== */
function getGrid() {
  const n = +sizeSelect.value;
  const inputs = [...gridDiv.querySelectorAll("input")];
  const grid = [];

  for (let r = 0; r < n; r++) {
    grid[r] = [];
    for (let c = 0; c < n; c++) {
      grid[r][c] = inputs[r * n + c].value.toUpperCase();
    }
  }
  return grid;
}

/* =====================
   SOLVER
===================== */
function solve() {
  if (!dictReady) {
    alert("Dictionary still loading...");
    return;
  }

  output.innerHTML = "";

  const grid = getGrid();
  const n = grid.length;
  const found = new Map(); // word -> { usesBonus }

  function dfs(r, c, used, word, usedBonus) {
    const key = r + "," + c;
    if (used.has(key)) return;

    const letter = grid[r][c];
    if (!letter) return;

    const nextWord = word + letter;
    if (!PREFIX.has(nextWord)) return;

    const newUsed = new Set(used);
    newUsed.add(key);

    const index = r * n + c;
    const nextUsedBonus = usedBonus || (bonusIndex === index);

    if (DICT.has(nextWord)) {
      const prev = found.get(nextWord);
      if (!prev || (!prev.usesBonus && nextUsedBonus)) {
        found.set(nextWord, { usesBonus: nextUsedBonus });
      }
    }

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < n && nc < n) {
          dfs(nr, nc, newUsed, nextWord, nextUsedBonus);
        }
      }
    }
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      dfs(r, c, new Set(), "", false);
    }
  }

  renderResults(found);
}

/* =====================
   RESULTS
===================== */

function highlightPath(path) {
  const n = +sizeSelect.value;
  const inputs = [...gridDiv.querySelectorAll("input")];

  // remove old lines first
  const oldSvg = document.getElementById("lines");
  if (oldSvg) oldSvg.remove();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "lines";
  wrapper.appendChild(svg);

  const gridRect = gridDiv.getBoundingClientRect();
  const points = [];

  for (const [r, c] of path) {
    const el = inputs[r * n + c];
    el.classList.add("active");

    const rect = el.getBoundingClientRect();
    points.push({
      x: rect.left + rect.width / 2 - gridRect.left,
      y: rect.top + rect.height / 2 - gridRect.top
    });
  }

  svg.setAttribute("width", gridDiv.offsetWidth);
  svg.setAttribute("height", gridDiv.offsetHeight);

  for (let i = 0; i < points.length - 1; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", points[i].x);
    line.setAttribute("y1", points[i].y);
    line.setAttribute("x2", points[i + 1].x);
    line.setAttribute("y2", points[i + 1].y);
    svg.appendChild(line);
  }
}


function clearHighlights() {
  // remove active tiles
  document
    .querySelectorAll("#grid input.active")
    .forEach(el => el.classList.remove("active"));

  // remove SVG lines if they exist
  const svg = document.getElementById("lines");
  if (svg) svg.remove();
}

function renderResults(found) {
  output.innerHTML = "";

  const words = [...found.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );

  for (const w of words) {
    const data = found.get(w);
    const bonus = data.usesBonus;

    const li = document.createElement("li");

    // 🔹 bonus visual
    if (bonus) {
      li.classList.add("bonus-word");
    }

    li.innerHTML = `
      <span>${w}</span>
      <span>${score(w, bonus)}</span>
    `;

    // 🔹 click → highlight path
    li.addEventListener("click", () => {
      clearHighlights();
      highlightPath(data.path);
    });

    output.appendChild(li);
  }
}

/* =====================
   SCORING
===================== */
function score(word, bonus) {
  let base =
    word.length === 3 ? 1 :
    word.length === 4 ? 6 :
    word.length === 5 ? 8 :
    word.length === 6 ? 10 :
    word.length === 7 ? 12 : 14;

  return base + (bonus ? 3 : 0);
}
