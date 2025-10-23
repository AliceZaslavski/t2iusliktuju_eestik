const moodsData = {
  "Tänulik":   "#ffffcc",
  "Üksildane": "#e6ffff",
  "Segaduses": "#ecc6d9",
  "Innustunud":"#ccffcc",
  "Ärev":      "#f2ccff",
  "Rahulik":   "#ffcccc",
  "Vihane":    "#ff0000",
  "Kurb":      "#ccf2ff",
  "Rõõmus":    "#ffe6f9",
  "Mäh":       "#ffcc99"
};

let selectedDate = null;
let userMoods = { ...moodsData };
let selectedCell = null;

/* ---------- Salvestuse nimed ja migratsioon ---------- */
const STORAGE = {
  // uus namespace, et vanad ingliskeelsed võtmed ei segaks
  moodsKey: "moodWidget:v2:userMoods",
  migratedFlag: "moodWidget:v2:migratedToET"
};

// EN -> ET tabel (tõlgime salvestatud andmed eestikeelseks)
const enToEt = {
  "Grateful":"Tänulik",
  "Lonely":"Üksildane",
  "Confused":"Segaduses",
  "Inspired":"Innustunud",
  "Anxious":"Ärev",
  "Calm":"Rahulik",
  "Angry":"Vihane",
  "Sad":"Kurb",
  "Happy":"Rõõmus",
  "Meh":"Mäh"
};

// sobivate kuupäevavõtmete regex (nt "5/10/2025" või "5/10")
const DATE_KEY_RE = /^\d{1,2}\/\d{1,2}(?:\/\d{4})?$/;

/** ÜHEKORDNE migratsioon: tõlgib ingliskeelsed tujud eestikeelseks nii
 *  - tujulistis (userMoods) kui
 *  - KÕIGIS kuupäeva salvestustes.
 */
function migrateStorageToET() {
  if (localStorage.getItem(STORAGE.migratedFlag) === "1") return;

  // 1) Migreeri varasemad userMoods võtmed, kui need olid v1 all või ET/EN segamini
  const legacyKeys = ["userMoods", STORAGE.moodsKey];
  let merged = {};

  for (const key of legacyKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) || {};
      Object.keys(parsed).forEach(name => {
        // tõlgi EN -> ET (kui võimalik), või jäta nagu on
        const etName = enToEt[name] || name;
        if (!(etName in merged)) merged[etName] = parsed[name];
      });
    } catch (_) {}
  }

  // kui midagi leidsime, kirjuta uude võtmesse juba ET nimedega;
  // kui ei leidnud, kasuta vaikimisi eestikeelset loendit
  if (Object.keys(merged).length === 0) {
    merged = { ...moodsData };
  } else {
    // taga, et vaikimisi ET tujud oleksid olemas (värve mitte üle kirjutada)
    for (const [etName, hex] of Object.entries(moodsData)) {
      if (!(etName in merged)) merged[etName] = hex;
    }
  }
  localStorage.setItem(STORAGE.moodsKey, JSON.stringify(merged));

  // 2) Migreeri KÕIK kuupäevavõtmed (kirjetes on {mood, percentage, color})
  // NB! localStorage iteratsioonis ei tohi muuta pikkust; kogume võtmed ette
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && DATE_KEY_RE.test(k)) keys.push(k);
  }
  keys.forEach(k => {
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]");
      if (Array.isArray(arr)) {
        const migratedArr = arr.map(item => {
          if (item && typeof item === "object") {
            const etName = enToEt[item.mood] || item.mood; // tõlgi EN->ET, kui vaja
            return { ...item, mood: etName };
          }
          return item;
        });
        localStorage.setItem(k, JSON.stringify(migratedArr));
      }
    } catch (_) {}
  });

  localStorage.setItem(STORAGE.migratedFlag, "1");
}

/* ---------- Laadimine / salvestamine ---------- */
function loadUserMoods() {
  const raw = localStorage.getItem(STORAGE.moodsKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // sanity check: kui mõni tuju on ingliskeelne, tõlgime jooksvalt ET-ks
      const normalized = {};
      Object.keys(parsed).forEach(name => {
        const etName = enToEt[name] || name;
        if (!(etName in normalized)) normalized[etName] = parsed[name];
      });
      userMoods = normalized;
      // hoia salvestus kohe eestikeelne
      persistUserMoods();
      return;
    } catch (e) {
      console.warn("userMoods (v2) parse ebaõnnestus – lähtestan vaikimisi ET loendiga.");
    }
  }
  userMoods = { ...moodsData };
  persistUserMoods();
}

function persistUserMoods() {
  localStorage.setItem(STORAGE.moodsKey, JSON.stringify(userMoods));
}

/* ---------- Popup ---------- */
function openMoodPopup() {
  document.getElementById("newMoodPopup").style.display = "block";
}
function closeMoodPopup() {
  document.getElementById("newMoodPopup").style.display = "none";
}

function addNewMood() {
  const inputEl = document.getElementById("newMoodInput");
  const colorEl = document.getElementById("newMoodColor");
  const newMoodName = (inputEl.value || "").trim();
  if (!newMoodName) return;

  // väldi duplikaate (tõstutundetult)
  const exists = Object.keys(userMoods).some(
    m => m.toLowerCase() === newMoodName.toLowerCase()
  );
  if (exists) {
    alert("See tuju on juba olemas.");
    return;
  }

  const newMoodColor = colorEl.value || "#cccccc";
  userMoods[newMoodName] = newMoodColor;

  persistUserMoods();
  generateMoodButtons();

  inputEl.value = "";
  colorEl.value = "#cccccc";
  closeMoodPopup();
}

/* ---------- UI: nuppude genereerimine ---------- */
function generateMoodButtons() {
  const container = document.getElementById("mood-buttons");
  container.innerHTML = "";

  Object.keys(userMoods).forEach(mood => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("mood-wrapper");

    const button = document.createElement("button");
    button.classList.add("mood-button");
    button.textContent = mood; // ⬅️ eestikeelne nimi
    button.style.backgroundColor = userMoods[mood];

    const select = document.createElement("select");
    for (let i = 0; i <= 100; i += 10) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `${i}%`;
      select.appendChild(option);
    }

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = userMoods[mood];

    colorPicker.addEventListener("input", () => {
      const val = colorPicker.value;
      button.style.backgroundColor = val;
      userMoods[mood] = val;
      persistUserMoods(); // salvestame kohe
    });

    const removeBtn = document.createElement("button");
    removeBtn.classList.add("remove-mood");
    removeBtn.textContent = "❌";
    removeBtn.title = "Eemalda tuju";
    removeBtn.addEventListener("click", () => {
      delete userMoods[mood];
      persistUserMoods();
      generateMoodButtons();
    });

    wrapper.appendChild(button);
    wrapper.appendChild(select);
    wrapper.appendChild(colorPicker);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}

/* ---------- Päevade salvestus ---------- */
function saveMood() {
  if (!selectedDate) {
    alert("Palun vali kuupäev kalendrist!");
    return;
  }

  const selectedMoods = [];
  document.querySelectorAll(".mood-wrapper").forEach(wrapper => {
    const mood = wrapper.querySelector("button").textContent; // ET nimetus
    const percentage = parseInt(wrapper.querySelector("select").value, 10);
    const color = wrapper.querySelector('input[type="color"]').value;
    if (percentage > 0) selectedMoods.push({ mood, percentage, color });
  });

  localStorage.setItem(selectedDate, JSON.stringify(selectedMoods));
  renderCalendar();
}

/* ---------- Kalender ---------- */
function renderCalendar() {
  const yearEl = document.getElementById("year");
  const year = yearEl && yearEl.value ? yearEl.value : new Date().getFullYear();

  const header = document.getElementById("days-header");
  const body = document.getElementById("calendar-body");
  header.innerHTML = '<th class="fixed-cell"></th>';
  body.innerHTML = "";

  for (let i = 1; i <= 31; i++) {
    const th = document.createElement("th");
    th.textContent = i;
    header.appendChild(th);
  }

  const months = [
    "Jaanuar","Veebruar","Märts","Aprill","Mai","Juuni",
    "Juuli","August","September","Oktoober","November","Detsember"
  ];

  months.forEach((month, monthIndex) => {
    const row = document.createElement("tr");
    const monthCell = document.createElement("td");
    monthCell.textContent = month;
    monthCell.classList.add("month-label");
    row.appendChild(monthCell);

    for (let i = 1; i <= 31; i++) {
      const dayCell = document.createElement("td");
      dayCell.classList.add("day");
      dayCell.dataset.date = `${i}/${monthIndex + 1}/${year}`;

      dayCell.addEventListener("click", () => selectDate(dayCell));
      dayCell.addEventListener("mouseenter", () => { dayCell.style.border = "2px solid black"; });
      dayCell.addEventListener("mouseleave", () => {
        if (dayCell !== selectedCell) dayCell.style.border = "1px solid #ccc";
      });
      dayCell.style.border = (dayCell === selectedCell) ? "2px solid black" : "1px solid #ccc";

      const moods = JSON.parse(localStorage.getItem(dayCell.dataset.date) || "[]");
      if (moods.length > 0) {
        dayCell.style.background = createGradientBackground(moods);
      }

      row.appendChild(dayCell);
    }
    body.appendChild(row);
  });
}

/* ---------- Valik ---------- */
function selectDate(dayCell) {
  if (selectedCell) selectedCell.style.border = "1px solid #ccc";
  selectedDate = dayCell.dataset.date;
  selectedCell = dayCell;
  selectedCell.style.border = "2px solid black";
}

/* ---------- Gradient ---------- */
function createGradientBackground(moods) {
  if (moods.length === 1 && moods[0].percentage === 100) {
    return moods[0].color;
  }
  moods.sort((a, b) => b.percentage - a.percentage);
  if (moods.length > 5) moods = moods.slice(0, 5);

  let gradientStops = [];
  let total = 0;
  moods.forEach(m => {
    total += m.percentage;
    if (total > 100) total = 100;
    gradientStops.push(`${m.color} ${total}%`);
  });
  return `linear-gradient(to bottom right, ${gradientStops.join(', ')})`;
}

/* ---------- Käivitus ---------- */
document.addEventListener("DOMContentLoaded", () => {
  migrateStorageToET();   // ⬅️ tõlgib korra kõik EN → ET
  loadUserMoods();        // ⬅️ laeb ET tujulisti uue võtme alt
  generateMoodButtons();
  renderCalendar();

  document.getElementById("add-mood").addEventListener("click", openMoodPopup);
  document.getElementById("confirm-add-mood").addEventListener("click", addNewMood);
  document.getElementById("cancel-add-mood").addEventListener("click", closeMoodPopup);
  document.getElementById("save-btn").addEventListener("click", saveMood);

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.addEventListener("input", renderCalendar);
});
