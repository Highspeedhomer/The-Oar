import { useState, useEffect, useRef, useCallback } from "react";

// ─── GOOGLE CLOUD OAUTH CLIENT ID ──────────────────────────────────────────
const CLIENT_ID = "12992629640-tqgoerntbrt76l3g9unv85gfm2i7i2a1.apps.googleusercontent.com";
// ───────────────────────────────────────────────────────────────────────────

const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";
const SHEET_NAME = "TheOar";
const TABS = { ROWS: "rows", FASTS: "fasts", FOOD: "food_logs", SETTINGS: "settings", WATER: "water" };

// ─── GOOGLE API HELPERS ──────────────────────────────────────────────────────

async function gapiRequest(method, url, body) {
  const token = window.google_access_token;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function findOrCreateSheet(token) {
  window.google_access_token = token;
  // Search Drive for existing sheet
  const search = await gapiRequest("GET",
    `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_NAME}'+and+mimeType='application/vnd.google-apps.spreadsheet'+and+trashed=false&fields=files(id,name)`
  );
  if (search.files?.length > 0) return search.files[0].id;

  // Create new spreadsheet
  const created = await gapiRequest("POST", "https://sheets.googleapis.com/v4/spreadsheets", {
    properties: { title: SHEET_NAME },
    sheets: [...Object.values(TABS)].map(t => ({ properties: { title: t } })),
  });
  const id = created.spreadsheetId;

  // Write headers
  const headers = {
    [TABS.ROWS]: [["id", "date", "meters", "notes"]],
    [TABS.FASTS]: [["id", "date", "startTime", "endTime", "goalHours"]],
    [TABS.FOOD]: [["id", "date", "name", "calories", "protein", "fat", "carbs"]],
    [TABS.SETTINGS]: [["key", "value"]],
    [TABS.WATER]: [["id", "date", "oz"]],
  };
  const data = Object.entries(headers).map(([tab, values]) => ({
    range: `${tab}!A1`,
    values,
  }));
  await gapiRequest("POST", `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    valueInputOption: "RAW",
    data,
  });

  // Write default settings
  await appendRows(id, TABS.SETTINGS, [
    ["calorieGoal", "2000"],
    ["proteinGoal", "150"],
    ["fatGoal", "80"],
    ["carbsGoal", "50"],
    ["weekdayFastHours", "20"],
    ["waterGoal", "100"],
  ]);

  return id;
}

async function appendRows(sheetId, tab, rows) {
  await gapiRequest("POST",
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!A1:Z1000:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: rows }
  );
}

async function readTab(sheetId, tab) {
  const res = await gapiRequest("GET",
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!A1:Z1000`
  );
  const rows = res.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || "");
    return obj;
  });
}

async function readSettings(sheetId) {
  const rows = await readTab(sheetId, TABS.SETTINGS);
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return {
    calorieGoal: parseInt(s.calorieGoal) || 2000,
    macroGoals: {
      protein: parseInt(s.proteinGoal) || 150,
      fat: parseInt(s.fatGoal) || 80,
      carbs: parseInt(s.carbsGoal) || 50,
    },
    weekdayHours: parseInt(s.weekdayFastHours) || 20,
    weekendHours: parseInt(s.weekendFastHours) || 16,
    waterGoal: parseInt(s.waterGoal) || 100,
  };
}

async function updateSettingValue(sheetId, key, value) {
  const res = await gapiRequest("GET",
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.SETTINGS}!A1:B100`
  );
  const rows = res.values || [];
  const rowIdx = rows.findIndex(r => r[0] === key);
  if (rowIdx >= 0) {
    await gapiRequest("PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.SETTINGS}!B${rowIdx + 1}?valueInputOption=RAW`,
      { values: [[String(value)]] }
    );
  } else {
    await appendRows(sheetId, TABS.SETTINGS, [[key, String(value)]]);
  }
}

async function deleteRowById(sheetId, sheetTitle, id) {
  // Get sheet metadata to find sheetId number
  const meta = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`);
  const sheet = meta.sheets.find(s => s.properties.title === sheetTitle);
  if (!sheet) return;
  const gid = sheet.properties.sheetId;

  const res = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetTitle}!A1:A1000`);
  const rows = res.values || [];
  const rowIdx = rows.findIndex(r => r[0] === String(id));
  if (rowIdx < 1) return;

  await gapiRequest("POST", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    requests: [{ deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 } } }]
  });
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isWeekend() { const d = new Date().getDay(); return d === 0 || d === 6; }
function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function formatMeters(m) { return parseInt(m).toLocaleString(); }
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}
function calcStreak(fasts) {
  if (!fasts.length) return 0;
  const sorted = [...fasts].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0, cur = todayStr();
  for (const f of sorted) {
    const dur = (parseInt(f.endTime) - parseInt(f.startTime)) / 3600000;
    if (f.date === cur && dur >= parseInt(f.goalHours)) {
      streak++;
      const d = new Date(cur); d.setDate(d.getDate() - 1);
      cur = d.toISOString().split("T")[0];
    } else break;
  }
  return streak;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

const NAV = ["Dashboard", "Row", "Fast", "Food", "Trends"];
const NAV_ICONS = { Dashboard: "🏠", Row: "🚣", Fast: "🔥", Food: "🥩", Trends: "📈" };

export default function TheOar() {
  const [authState, setAuthState] = useState("idle"); // idle | signing_in | loading | ready | error
  const [user, setUser] = useState(null);
  const [sheetId, setSheetId] = useState(null);
  const [tab, setTab] = useState("Dashboard");
  const [tick, setTick] = useState(0);
  const [error, setError] = useState(null);

  // App data
  const [rows, setRows] = useState([]);
  const [fasts, setFasts] = useState([]);
  const [foodLogs, setFoodLogs] = useState([]);
  const [settings, setSettings] = useState({ calorieGoal: 2000, macroGoals: { protein: 150, fat: 80, carbs: 50 }, weekdayHours: 20, weekendHours: 16 });
  const [waterLogs, setWaterLogs] = useState([]);
  const [activeFast, setActiveFast] = useState(null); // { startTime, goalHours }

  // Live timer
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Load GIS
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const signIn = () => {
    setAuthState("signing_in");
    setError(null);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { setError("Sign-in failed: " + resp.error); setAuthState("idle"); return; }
        window.google_access_token = resp.access_token;
        setAuthState("loading");
        try {
          // Get user info
          const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${resp.access_token}` }
          }).then(r => r.json());
          setUser(me);
          const id = await findOrCreateSheet(resp.access_token);
          setSheetId(id);
          await loadAllData(id);
          setAuthState("ready");
        } catch (e) {
          setError("Failed to connect to Google Sheets: " + e.message);
          setAuthState("idle");
        }
      },
    });
    client.requestAccessToken();
  };

  const loadAllData = async (id) => {
    const [rowData, fastData, foodData, settingsData, waterData] = await Promise.all([
      readTab(id, TABS.ROWS),
      readTab(id, TABS.FASTS),
      readTab(id, TABS.FOOD),
      readSettings(id),
      readTab(id, TABS.WATER),
    ]);
    setRows(rowData.map(r => ({ ...r, meters: parseInt(r.meters) || 0 })).reverse());
    const completedFasts = fastData.filter(f => f.endTime).map(f => ({ ...f, goalHours: parseInt(f.goalHours) || 16 })).reverse();
    const activeFastRow = fastData.find(f => !f.endTime);
    setFasts(completedFasts);
    if (activeFastRow) setActiveFast({ startTime: parseInt(activeFastRow.startTime), goalHours: parseInt(activeFastRow.goalHours), id: activeFastRow.id });
    setFoodLogs(foodData.map(f => ({ ...f, calories: parseInt(f.calories) || 0, protein: parseInt(f.protein) || 0, fat: parseInt(f.fat) || 0, carbs: parseInt(f.carbs) || 0 })).reverse());
    setWaterLogs(waterData.map(w => ({ ...w, oz: parseInt(w.oz) || 0 })).reverse());
    setSettings(settingsData);
  };

  // ── Computed ──
  const fastGoal = isWeekend() ? settings.weekendHours : settings.weekdayHours;
  const fastElapsed = activeFast ? Date.now() - activeFast.startTime : 0;
  const fastPct = activeFast ? Math.min((fastElapsed / (fastGoal * 3600000)) * 100, 100) : 0;
  const fastDone = fastPct >= 100;
  const todayFood = foodLogs.filter(f => f.date === todayStr());
  const todayCals = todayFood.reduce((s, f) => s + f.calories, 0);
  const todayProtein = todayFood.reduce((s, f) => s + f.protein, 0);
  const todayFat = todayFood.reduce((s, f) => s + f.fat, 0);
  const todayCarbs = todayFood.reduce((s, f) => s + f.carbs, 0);
  const weekMeters = rows.filter(r => { const diff = (new Date() - new Date(r.date)) / 86400000; return diff <= 7; }).reduce((s, r) => s + r.meters, 0);

  const todayWater = waterLogs.filter(w => w.date === todayStr()).reduce((s, w) => s + w.oz, 0);

  // ── Actions ──
  const addWater = async (oz) => {
    const entry = { id: Date.now(), date: todayStr(), oz };
    await appendRows(sheetId, TABS.WATER, [[entry.id, entry.date, entry.oz]]);
    setWaterLogs(prev => [entry, ...prev]);
  };

  const addRow = async (meters, notes, date) => {
    const entry = { id: Date.now(), date: date || todayStr(), meters, notes };
    await appendRows(sheetId, TABS.ROWS, [[entry.id, entry.date, entry.meters, entry.notes]]);
    setRows(prev => [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
  };

  const startFast = async () => {
    const id = Date.now();
    const goal = fastGoal;
    await appendRows(sheetId, TABS.FASTS, [[id, todayStr(), id, "", goal]]);
    setActiveFast({ startTime: id, goalHours: goal, id });
  };

  const endFast = async () => {
    if (!activeFast) return;
    const endTime = Date.now();
    // Find the row and update it
    const res = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FASTS}!A1:F1000`);
    const allRows = res.values || [];
    const rowIdx = allRows.findIndex(r => r[0] === String(activeFast.id));
    if (rowIdx >= 0) {
      await gapiRequest("PUT",
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FASTS}!D${rowIdx + 1}?valueInputOption=RAW`,
        { values: [[String(endTime)]] }
      );
    }
    const completed = { id: activeFast.id, date: todayStr(), startTime: activeFast.startTime, endTime, goalHours: activeFast.goalHours };
    setFasts(prev => [completed, ...prev]);
    setActiveFast(null);
  };

  const addFood = async (entry) => {
    await appendRows(sheetId, TABS.FOOD, [[entry.id, entry.date, entry.name, entry.calories, entry.protein, entry.fat, entry.carbs]]);
    setFoodLogs(prev => [entry, ...prev]);
  };

  const updateFastStartTime = async (newTimestamp) => {
    const res = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FASTS}!A1:A1000`);
    const allRows = res.values || [];
    const rowIdx = allRows.findIndex(r => r[0] === String(activeFast.id));
    if (rowIdx >= 0) {
      await gapiRequest("PUT",
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FASTS}!C${rowIdx + 1}?valueInputOption=RAW`,
        { values: [[String(newTimestamp)]] }
      );
    }
    setActiveFast(prev => ({ ...prev, startTime: newTimestamp }));
  };

  const updateSettings = async (key, value) => {
    await updateSettingValue(sheetId, key, value);
    setSettings(prev => {
      const next = { ...prev };
      if (key === "calorieGoal") next.calorieGoal = parseInt(value);
      if (key === "proteinGoal") next.macroGoals = { ...next.macroGoals, protein: parseInt(value) };
      if (key === "fatGoal") next.macroGoals = { ...next.macroGoals, fat: parseInt(value) };
      if (key === "carbsGoal") next.macroGoals = { ...next.macroGoals, carbs: parseInt(value) };
      if (key === "weekdayFastHours") next.weekdayHours = parseInt(value);
      if (key === "weekendFastHours") next.weekendHours = parseInt(value);
      return next;
    });
  };

  const updateFood = async (entry) => {
    const res = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FOOD}!A1:A1000`);
    const allRows = res.values || [];
    const rowIdx = allRows.findIndex(r => r[0] === String(entry.id));
    if (rowIdx >= 0) {
      await gapiRequest("PUT",
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.FOOD}!A${rowIdx + 1}:G${rowIdx + 1}?valueInputOption=RAW`,
        { values: [[String(entry.id), entry.date, entry.name, String(entry.calories), String(entry.protein), String(entry.fat), String(entry.carbs)]] }
      );
    }
    setFoodLogs(prev => prev.map(f => String(f.id) === String(entry.id) ? entry : f));
  };

  const deleteFood = async (id) => {
    await deleteRowById(sheetId, TABS.FOOD, id);
    setFoodLogs(prev => prev.filter(f => String(f.id) !== String(id)));
  };

  const updateWater = async (entry) => {
    const res = await gapiRequest("GET", `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.WATER}!A1:A1000`);
    const allRows = res.values || [];
    const rowIdx = allRows.findIndex(r => r[0] === String(entry.id));
    if (rowIdx >= 0) {
      await gapiRequest("PUT",
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${TABS.WATER}!A${rowIdx + 1}:C${rowIdx + 1}?valueInputOption=RAW`,
        { values: [[String(entry.id), entry.date, String(entry.oz)]] }
      );
    }
    setWaterLogs(prev => prev.map(w => String(w.id) === String(entry.id) ? entry : w));
  };

  const deleteWater = async (id) => {
    await deleteRowById(sheetId, TABS.WATER, id);
    setWaterLogs(prev => prev.filter(w => String(w.id) !== String(id)));
  };

  // ── RENDER ──

  if (authState !== "ready") {
    return (
      <div style={S.shell}>
        <style>{css}</style>
        <div style={S.authScreen}>
          <div style={S.authLogo}>THE OAR</div>
          <div style={S.authTagline}>row · fast · fuel</div>
          {authState === "loading" && <div style={S.authLoading}><Spinner /> connecting to sheets...</div>}
          {authState === "signing_in" && <div style={S.authLoading}><Spinner /> waiting for google...</div>}
          {authState === "idle" && (
            <button style={S.authBtn} onClick={signIn}>
              <span style={{ fontSize: "1.1rem" }}>G</span> Sign in with Google
            </button>
          )}
          {error && <div style={S.authError}>{error}</div>}
          <div style={S.authNote}>Your data lives in a private Google Sheet in your Drive. Nothing is shared.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.shell}>
      <style>{css}</style>
      <div style={S.app}>
        <div style={S.header}>
          <div>
            <span style={S.logo}>THE OAR</span>
            <span style={S.tagline}>Row. Fast. Fuel.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={S.headerSub}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
            {user?.picture && <img src={user.picture} style={S.avatar} alt="avatar" />}
          </div>
        </div>

        <div style={S.content}>
          {tab === "Dashboard" && <Dashboard settings={settings} todayCals={todayCals} todayProtein={todayProtein} todayFat={todayFat} todayCarbs={todayCarbs} weekMeters={weekMeters} fastElapsed={fastElapsed} fastGoal={fastGoal} fastPct={fastPct} fastDone={fastDone} activeFast={activeFast} rows={rows} setTab={setTab} todayWater={todayWater} addWater={addWater} />}
          {tab === "Row" && <RowLog rows={rows} addRow={addRow} />}
          {tab === "Fast" && <FastTracker activeFast={activeFast} fasts={fasts} fastElapsed={fastElapsed} fastGoal={fastGoal} fastPct={fastPct} fastDone={fastDone} startFast={startFast} endFast={endFast} updateFastStartTime={updateFastStartTime} />}
          {tab === "Food" && <FoodLog foodLogs={foodLogs} settings={settings} todayCals={todayCals} todayProtein={todayProtein} todayFat={todayFat} todayCarbs={todayCarbs} addFood={addFood} todayWater={todayWater} addWater={addWater} sheetId={sheetId} updateFood={updateFood} deleteFood={deleteFood} waterLogs={waterLogs} updateWater={updateWater} deleteWater={deleteWater} />}
          {tab === "Trends" && <Trends rows={rows} fasts={fasts} foodLogs={foodLogs} settings={settings} activeFast={activeFast} />}
        </div>

        <div style={S.nav}>
          {NAV.map(n => (
            <button key={n} style={{ ...S.navBtn, ...(tab === n ? S.navBtnActive : {}) }} onClick={() => setTab(n)}>
              <span style={S.navIcon}>{NAV_ICONS[n]}</span>
              <span style={S.navLabel}>{n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function Dashboard({ settings, todayCals, todayProtein, todayFat, todayCarbs, weekMeters, fastElapsed, fastGoal, fastPct, fastDone, activeFast, rows, setTab, todayWater, addWater }) {
  const [customOz, setCustomOz] = useState("");
  const calPct = Math.min((todayCals / settings.calorieGoal) * 100, 100);
  const todayMeters = rows.filter(r => r.date === todayStr()).reduce((s, r) => s + r.meters, 0);
  const waterPct = Math.min((todayWater / (settings.waterGoal || 100)) * 100, 100);
  const handleCustomWater = async () => {
    const oz = parseFloat(customOz);
    if (!oz || oz <= 0) return;
    await addWater(oz);
    setCustomOz("");
  };

  return (
    <div style={S.screen}>
      <div style={S.sectionTitle}>TODAY</div>

      <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setTab("Fast")} className="card-tap">
        <div style={S.cardHeader}>
          <span style={S.cardLabel}>🔥 FAST</span>
          <span style={{ ...S.pill, ...(fastDone ? S.pillGreen : activeFast ? S.pillAmber : S.pillDim) }}>
            {fastDone ? "COMPLETE" : activeFast ? "ACTIVE" : "NOT STARTED"}
          </span>
        </div>
        {activeFast ? (
          <>
            <div style={S.bigNum}>{formatDuration(fastElapsed)}</div>
            <div style={S.fastTimeRow}>
              <span>🕐 Started {new Date(activeFast.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              <span>🏁 Ends {new Date(activeFast.startTime + fastGoal * 3600000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <div style={S.cardSub}>{fastDone ? "🎯 Goal reached!" : `${(fastGoal - fastElapsed / 3600000).toFixed(1)}h remaining`}</div>
            <ProgressBar pct={fastPct} color={fastDone ? "#4ade80" : "#f59e0b"} />
          </>
        ) : (
          <div style={S.bigNumDim}>——</div>
        )}
      </div>

      <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setTab("Row")} className="card-tap">
        <div style={S.cardHeader}>
          <span style={S.cardLabel}>🚣 ROW</span>
          <span style={S.cardLabelRight}>THIS WEEK</span>
        </div>
        <div style={S.splitRow}>
          <div>
            <div style={S.bigNum}>{todayMeters > 0 ? formatMeters(todayMeters) + "m" : "——"}</div>
            <div style={S.cardSub}>Today</div>
          </div>
          <div style={S.dividerV} />
          <div style={{ textAlign: "right" }}>
            <div style={S.bigNum}>{weekMeters > 0 ? formatMeters(weekMeters) + "m" : "——"}</div>
            <div style={S.cardSub}>7 days</div>
          </div>
        </div>
      </div>

      <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setTab("Food")} className="card-tap">
        <div style={S.cardHeader}>
          <span style={S.cardLabel}>🥩 CALORIES</span>
          <span style={S.cardLabelRight}>{todayCals} / {settings.calorieGoal} kcal</span>
        </div>
        <ProgressBar pct={calPct} color={calPct > 100 ? "#f87171" : "#38bdf8"} />
        <div style={S.macroRow}>
          <MacroPill label="P" val={todayProtein} goal={settings.macroGoals.protein} color="#a78bfa" />
          <MacroPill label="F" val={todayFat} goal={settings.macroGoals.fat} color="#fb923c" />
          <MacroPill label="C" val={todayCarbs} goal={settings.macroGoals.carbs} color="#34d399" />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardLabel}>💧 WATER</span>
          <span style={S.cardLabelRight}>{todayWater} / {settings.waterGoal || 100} oz</span>
        </div>
        <ProgressBar pct={waterPct} color={waterPct >= 100 ? "#4ade80" : "#38bdf8"} />
        <div style={S.waterBtns}>
          {[8, 16, 24, 32].map(oz => (
            <button key={oz} style={S.waterBtn} onClick={e => { e.stopPropagation(); addWater(oz); }}>+{oz}oz</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.input, flex: 1, padding: "10px 12px" }} type="number" inputMode="decimal" placeholder="custom oz" value={customOz} onChange={e => setCustomOz(e.target.value)} />
          <button style={{ ...S.waterBtn, flex: 0, padding: "10px 16px", whiteSpace: "nowrap" }} onClick={e => { e.stopPropagation(); handleCustomWater(); }}>ADD</button>
        </div>
      </div>
    </div>
  );
}

function RowLog({ rows, addRow }) {
  const [meters, setMeters] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const m = parseInt(meters);
    if (!m || m < 1) return;
    setSaving(true);
    await addRow(m, notes, date);
    setMeters(""); setNotes(""); setDate(todayStr());
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={S.screen}>
      <div style={S.sectionTitle}>🚣 LOG A ROW</div>
      <div style={S.card}>
        <div style={S.twoCol}>
          <div style={S.inputGroup}>
            <label style={S.inputLabel}>METERS</label>
            <input style={S.input} type="number" placeholder="e.g. 5000" value={meters} onChange={e => setMeters(e.target.value)} inputMode="numeric" />
          </div>
          <div style={S.inputGroup}>
            <label style={S.inputLabel}>DATE</label>
            <input style={{ ...S.input, colorScheme: "dark" }} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div style={S.inputGroup}>
          <label style={S.inputLabel}>NOTES (optional)</label>
          <input style={S.input} type="text" placeholder="Steady state, intervals..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <button style={{ ...S.btn, ...(saved ? S.btnSuccess : {}) }} onClick={submit} disabled={saving}>
          {saving ? "SAVING..." : saved ? "✓ SAVED" : "LOG SESSION"}
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <div style={S.sectionTitle}>HISTORY</div>
          {rows.slice(0, 15).map(r => (
            <div key={r.id} style={S.listItem}>
              <div style={S.listMain}>{parseInt(r.meters).toLocaleString()}m</div>
              <div style={S.listSub}>{r.date}{r.notes ? ` · ${r.notes}` : ""}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function FastTracker({ activeFast, fasts, fastElapsed, fastGoal, fastPct, fastDone, startFast, endFast, updateFastStartTime }) {
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const streak = calcStreak(fasts);

  const handleStart = async () => { setStarting(true); await startFast(); setStarting(false); };
  const handleEnd = async () => { setEnding(true); await endFast(); setEnding(false); };

  const startTimeValue = activeFast ? (() => {
    const d = new Date(activeFast.startTime);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })() : "";

  const handleStartTimeChange = (e) => {
    const [h, m] = e.target.value.split(":").map(Number);
    const d = new Date(activeFast.startTime);
    d.setHours(h, m, 0, 0);
    updateFastStartTime(d.getTime());
  };

  return (
    <div style={S.screen}>
      <div style={S.sectionTitle}>🔥 FASTING</div>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardLabel}>TARGET TODAY</span>
          <span style={S.cardLabelRight}>{fastGoal}:00 · {isWeekend() ? "Weekend" : "Weekday"}</span>
        </div>
        {activeFast ? (
          <>
            <div style={{ ...S.bigNum, fontSize: "2.8rem", textAlign: "center", letterSpacing: "0.05em" }}>
              {formatDuration(fastElapsed)}
            </div>
            <div style={S.fastTimeRow}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                🕐 Started
                <input
                  type="time"
                  value={startTimeValue}
                  onChange={handleStartTimeChange}
                  style={S.fastTimeInput}
                />
              </span>
              <span>🏁 Ends {new Date(activeFast.startTime + fastGoal * 3600000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <div style={{ ...S.cardSub, textAlign: "center", marginBottom: 12 }}>
              {fastDone ? "🎯 Goal reached!" : `${((fastGoal * 3600000 - fastElapsed) / 3600000).toFixed(1)}h remaining`}
            </div>
            <ProgressBar pct={fastPct} color={fastDone ? "#4ade80" : "#f59e0b"} thick />
            <button style={{ ...S.btn, ...S.btnDanger, marginTop: 16 }} onClick={handleEnd} disabled={ending}>
              {ending ? "SAVING..." : "END FAST"}
            </button>
          </>
        ) : (
          <>
            <div style={{ ...S.bigNumDim, textAlign: "center" }}>NOT STARTED</div>
            <button style={S.btn} onClick={handleStart} disabled={starting}>
              {starting ? "STARTING..." : "START FAST"}
            </button>
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardLabel}>STREAK</div>
        <div style={S.bigNum}>{streak} <span style={{ fontSize: "1rem", color: "#64748b" }}>days</span></div>
      </div>

      {fasts.slice(0, 7).length > 0 && (
        <>
          <div style={S.sectionTitle}>RECENT</div>
          {fasts.slice(0, 7).map(f => {
            const dur = (parseInt(f.endTime) - parseInt(f.startTime)) / 3600000;
            const met = dur >= parseInt(f.goalHours);
            return (
              <div key={f.id} style={S.listItem}>
                <div style={S.listMain}>{dur.toFixed(1)}h <span style={{ ...S.pill, ...(met ? S.pillGreen : S.pillDim), marginLeft: 8 }}>{met ? "✓" : "—"}</span></div>
                <div style={S.listSub}>{f.date} · goal {f.goalHours}h</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function FoodLog({ foodLogs, settings, todayCals, todayProtein, todayFat, todayCarbs, addFood, todayWater, addWater, sheetId, updateFood, deleteFood, waterLogs, updateWater, deleteWater }) {
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customOz, setCustomOz] = useState("");
  const [showWaterLog, setShowWaterLog] = useState(false);
  const [editFood, setEditFood] = useState(null);
  const [editWater, setEditWater] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  const submit = async () => {
    const c = parseInt(cals);
    if (!name || !c) return;
    setSaving(true);
    const entry = { id: Date.now(), date: todayStr(), name, calories: c, protein: parseInt(protein) || 0, fat: parseInt(fat) || 0, carbs: parseInt(carbs) || 0 };
    await addFood(entry);
    setName(""); setCals(""); setProtein(""); setFat(""); setCarbs("");
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCustomWater = async () => {
    const oz = parseFloat(customOz);
    if (!oz || oz <= 0) return;
    await addWater(oz);
    setCustomOz("");
  };

  const handleSaveFood = async () => {
    if (!editFood.name) return;
    setModalSaving(true);
    await updateFood(editFood);
    setModalSaving(false);
    setEditFood(null);
  };

  const handleDeleteFood = async () => {
    setModalSaving(true);
    await deleteFood(editFood.id);
    setModalSaving(false);
    setEditFood(null);
  };

  const handleSaveWater = async () => {
    if (!editWater.oz) return;
    setModalSaving(true);
    await updateWater(editWater);
    setModalSaving(false);
    setEditWater(null);
  };

  const handleDeleteWater = async () => {
    setModalSaving(true);
    await deleteWater(editWater.id);
    setModalSaving(false);
    setEditWater(null);
  };

  const calPct = Math.min((todayCals / settings.calorieGoal) * 100, 100);
  const todayItems = foodLogs.filter(f => f.date === todayStr());
  const todayWaterItems = (waterLogs || []).filter(w => w.date === todayStr());

  return (
    <>
      {editFood && (
        <div style={S.modalOverlay} onClick={() => setEditFood(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>EDIT ENTRY</div>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>FOOD NAME</label>
              <input style={S.input} type="text" value={editFood.name} onChange={e => setEditFood(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={S.twoCol}>
              <div style={S.inputGroup}>
                <label style={S.inputLabel}>CALORIES</label>
                <input style={S.input} type="number" inputMode="numeric" value={editFood.calories} onChange={e => setEditFood(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))} />
              </div>
              <div style={S.inputGroup}>
                <label style={S.inputLabel}>PROTEIN (g)</label>
                <input style={S.input} type="number" inputMode="numeric" value={editFood.protein} onChange={e => setEditFood(p => ({ ...p, protein: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div style={S.twoCol}>
              <div style={S.inputGroup}>
                <label style={S.inputLabel}>FAT (g)</label>
                <input style={S.input} type="number" inputMode="numeric" value={editFood.fat} onChange={e => setEditFood(p => ({ ...p, fat: parseInt(e.target.value) || 0 }))} />
              </div>
              <div style={S.inputGroup}>
                <label style={S.inputLabel}>CARBS (g)</label>
                <input style={S.input} type="number" inputMode="numeric" value={editFood.carbs} onChange={e => setEditFood(p => ({ ...p, carbs: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <button style={S.btn} onClick={handleSaveFood} disabled={modalSaving}>{modalSaving ? "SAVING..." : "SAVE"}</button>
            <button style={{ ...S.btn, ...S.btnDanger, marginTop: 8 }} onClick={handleDeleteFood} disabled={modalSaving}>DELETE</button>
            <button style={{ ...S.btn, background: "#1e293b", marginTop: 8 }} onClick={() => setEditFood(null)} disabled={modalSaving}>CANCEL</button>
          </div>
        </div>
      )}
      {editWater && (
        <div style={S.modalOverlay} onClick={() => setEditWater(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>EDIT WATER</div>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>OZ</label>
              <input style={S.input} type="number" inputMode="decimal" value={editWater.oz} onChange={e => setEditWater(p => ({ ...p, oz: parseFloat(e.target.value) || 0 }))} />
            </div>
            <button style={S.btn} onClick={handleSaveWater} disabled={modalSaving}>{modalSaving ? "SAVING..." : "SAVE"}</button>
            <button style={{ ...S.btn, ...S.btnDanger, marginTop: 8 }} onClick={handleDeleteWater} disabled={modalSaving}>DELETE</button>
            <button style={{ ...S.btn, background: "#1e293b", marginTop: 8 }} onClick={() => setEditWater(null)} disabled={modalSaving}>CANCEL</button>
          </div>
        </div>
      )}
      <div style={S.screen}>
        <div style={S.sectionTitle}>🥩 FOOD LOG</div>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardLabel}>TODAY</span>
            <span style={S.cardLabelRight}>{todayCals} / {settings.calorieGoal} kcal</span>
          </div>
          <ProgressBar pct={calPct} color={calPct > 100 ? "#f87171" : "#38bdf8"} />
          <div style={S.macroRow}>
            <MacroPill label="P" val={todayProtein} goal={settings.macroGoals.protein} color="#a78bfa" />
            <MacroPill label="F" val={todayFat} goal={settings.macroGoals.fat} color="#fb923c" />
            <MacroPill label="C" val={todayCarbs} goal={settings.macroGoals.carbs} color="#34d399" />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardLabel}>💧 WATER</span>
            <span style={S.cardLabelRight}>{todayWater} / {settings.waterGoal || 100} oz</span>
          </div>
          <ProgressBar pct={Math.min((todayWater / (settings.waterGoal || 100)) * 100, 100)} color={todayWater >= (settings.waterGoal || 100) ? "#4ade80" : "#38bdf8"} />
          <div style={S.waterBtns}>
            {[8, 16, 24, 32].map(oz => (
              <button key={oz} style={S.waterBtn} onClick={() => addWater(oz)}>+{oz}oz</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input style={{ ...S.input, flex: 1, padding: "10px 12px" }} type="number" inputMode="decimal" placeholder="custom oz" value={customOz} onChange={e => setCustomOz(e.target.value)} />
            <button style={{ ...S.waterBtn, flex: 0, padding: "10px 16px", whiteSpace: "nowrap" }} onClick={handleCustomWater}>ADD</button>
          </div>
        </div>

        <div style={S.sectionTitle}>🥩 ADD FOOD</div>
        <div style={S.card}>
          <div style={S.inputGroup}>
            <label style={S.inputLabel}>FOOD NAME</label>
            <input style={S.input} type="text" placeholder="Chicken breast, eggs..." value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={S.twoCol}>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>CALORIES</label>
              <input style={S.input} type="number" placeholder="kcal" value={cals} onChange={e => setCals(e.target.value)} inputMode="numeric" />
            </div>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>PROTEIN (g)</label>
              <input style={S.input} type="number" placeholder="g" value={protein} onChange={e => setProtein(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div style={S.twoCol}>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>FAT (g)</label>
              <input style={S.input} type="number" placeholder="g" value={fat} onChange={e => setFat(e.target.value)} inputMode="numeric" />
            </div>
            <div style={S.inputGroup}>
              <label style={S.inputLabel}>CARBS (g)</label>
              <input style={S.input} type="number" placeholder="g" value={carbs} onChange={e => setCarbs(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <button style={{ ...S.btn, ...(saved ? S.btnSuccess : {}) }} onClick={submit} disabled={saving}>
            {saving ? "SAVING..." : saved ? "✓ LOGGED" : "ADD ENTRY"}
          </button>
        </div>

        {todayItems.length > 0 && (
          <>
            <div style={S.sectionTitle}>TODAY'S ENTRIES</div>
            {todayItems.map(f => (
              <div key={f.id} style={{ ...S.listItem, cursor: "pointer" }} onClick={() => setEditFood({ ...f })} className="card-tap">
                <div style={S.listMain}>{f.name} <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.85rem" }}>✏</span></div>
                <div style={S.listSub}>{f.calories} kcal · P:{f.protein}g F:{f.fat}g C:{f.carbs}g</div>
              </div>
            ))}
          </>
        )}

        {todayWaterItems.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>💧 WATER LOG</span>
              <button style={S.toggleBtn} onClick={() => setShowWaterLog(v => !v)}>{showWaterLog ? "HIDE" : "EDIT"}</button>
            </div>
            {showWaterLog && todayWaterItems.map(w => (
              <div key={w.id} style={{ ...S.listItem, cursor: "pointer" }} onClick={() => setEditWater({ ...w })} className="card-tap">
                <div style={S.listMain}>{w.oz}oz <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.85rem" }}>✏</span></div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function Trends({ rows, fasts, foodLogs, settings, activeFast }) {
  const last7 = getLast7Days();
  const metersByDay = last7.map(d => ({ date: d, val: rows.filter(r => r.date === d).reduce((s, r) => s + r.meters, 0) }));
  const calsByDay = last7.map(d => ({ date: d, val: foodLogs.filter(f => f.date === d).reduce((s, f) => s + f.calories, 0) }));
  const fastsByDay = last7.map(d => ({
    date: d,
    val: fasts.filter(f => {
      const end = new Date(parseInt(f.endTime));
      const y = end.getFullYear();
      const mo = String(end.getMonth() + 1).padStart(2, "0");
      const dy = String(end.getDate()).padStart(2, "0");
      return `${y}-${mo}-${dy}` === d;
    }).reduce((best, f) => {
      const h = (parseInt(f.endTime) - parseInt(f.startTime)) / 3600000;
      return Math.max(best, h);
    }, 0),
  }));
  const totalMeters = rows.reduce((s, r) => s + r.meters, 0);
  const streak = calcStreak(fasts);

  return (
    <div style={S.screen}>
      <div style={S.sectionTitle}>TRENDS · 7 DAYS</div>
      <div style={S.statRow}>
        <div style={S.statCard}><div style={S.statVal}>{formatMeters(totalMeters)}m</div><div style={S.statLabel}>ALL TIME</div></div>
        <div style={S.statCard}><div style={S.statVal}>{streak}</div><div style={S.statLabel}>FAST STREAK</div></div>
        <div style={S.statCard}><div style={S.statVal}>{rows.length}</div><div style={S.statLabel}>SESSIONS</div></div>
      </div>
      <MiniChart label="METERS / DAY" items={metersByDay} color="#38bdf8" />
      <MiniChart label="CALORIES / DAY" items={calsByDay} color="#fb923c" goal={settings.calorieGoal} />
      <MiniChart label="FAST HOURS / DAY" items={fastsByDay} color="#4ade80" decimals={1} />
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function ProgressBar({ pct, color, thick }) {
  return (
    <div style={{ ...S.progressTrack, height: thick ? 10 : 6 }}>
      <div style={{ ...S.progressFill, width: `${pct}%`, background: color }} />
    </div>
  );
}

function MacroPill({ label, val, goal, color }) {
  return (
    <div style={{ ...S.macroPill, borderColor: color }}>
      <span style={{ ...S.macroLabel, color }}>{label}</span>
      <span style={S.macroVal}>{val}g</span>
      <span style={S.macroGoal}>/{goal}g</span>
    </div>
  );
}

function MiniChart({ label, items, color, goal, decimals = 0 }) {
  const max = Math.max(...items.map(i => i.val), goal || 0, 1);
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.chartWrap}>
        {items.map(item => {
          const pct = (item.val / max) * 100;
          const [yr, mo, dy] = item.date.split("-").map(Number);
          const day = new Date(yr, mo - 1, dy).toLocaleDateString("en-US", { weekday: "narrow" });
          return (
            <div key={item.date} style={S.chartCol}>
              <div style={S.chartBarWrap}>
                {goal && <div style={{ ...S.chartGoalLine, bottom: `${(goal / max) * 100}%` }} />}
                <div style={{ ...S.chartBar, height: `${Math.max(pct, item.val > 0 ? 4 : 0)}%`, background: color }} />
              </div>
              <div style={S.chartDay}>{day}</div>
              {item.val > 0 && <div style={{ ...S.chartVal, color }}>{item.val >= 1000 ? formatMeters(item.val) : item.val.toFixed(decimals)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite", marginRight: 8 }}>◌</span>;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  shell: { minHeight: "100vh", background: "#09090b", display: "flex", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" },
  app: { width: "100%", maxWidth: 430, minHeight: "100vh", background: "#0f0f11", display: "flex", flexDirection: "column" },

  authScreen: { width: "100%", maxWidth: 430, minHeight: "100vh", background: "#0f0f11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 20 },
  authLogo: { fontSize: "2.8rem", fontWeight: 700, letterSpacing: "0.2em", color: "#f1f5f9" },
  authTagline: { fontSize: "1rem", letterSpacing: "0.15em", color: "#94a3b8" },
  tagline: { display: "block", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#94a3b8", marginTop: 3 },
  authBtn: { background: "#1e293b", border: "1px solid #475569", borderRadius: 10, padding: "14px 28px", color: "#f1f5f9", fontSize: "1rem", fontFamily: "inherit", letterSpacing: "0.05em", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginTop: 12 },
  authLoading: { fontSize: "0.9rem", color: "#94a3b8", letterSpacing: "0.05em", display: "flex", alignItems: "center" },
  authError: { fontSize: "0.85rem", color: "#fca5a5", background: "#1c0505", border: "1px solid #991b1b", borderRadius: 8, padding: "12px 16px", maxWidth: 320, textAlign: "center" },
  authNote: { fontSize: "0.8rem", color: "#64748b", textAlign: "center", maxWidth: 280, lineHeight: 1.8, marginTop: 8 },

  header: { padding: "18px 20px 10px", borderBottom: "1px solid #1e1e24", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.15em", color: "#f1f5f9" },
  headerSub: { fontSize: "0.85rem", color: "#94a3b8", letterSpacing: "0.05em" },
  avatar: { width: 28, height: 28, borderRadius: "50%", border: "1px solid #1e1e28" },

  content: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  screen: { padding: "16px 16px 8px" },
  sectionTitle: { fontSize: "0.8rem", letterSpacing: "0.15em", color: "#94a3b8", marginBottom: 10, marginTop: 8, fontWeight: 600 },

  card: { background: "#16161a", border: "1px solid #252530", borderRadius: 12, padding: "16px 18px", marginBottom: 12 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLabel: { fontSize: "0.9rem", letterSpacing: "0.1em", color: "#cbd5e1", fontWeight: 700 },
  cardLabelRight: { fontSize: "0.85rem", letterSpacing: "0.05em", color: "#94a3b8" },
  cardSub: { fontSize: "0.9rem", color: "#94a3b8", marginTop: 6 },

  bigNum: { fontSize: "2rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.1, marginBottom: 4 },
  bigNumDim: { fontSize: "2rem", fontWeight: 700, color: "#2d2d35", lineHeight: 1.1, marginBottom: 10, textAlign: "center" },

  pill: { fontSize: "0.75rem", letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, border: "1px solid", fontWeight: 600 },
  pillGreen: { color: "#4ade80", borderColor: "#166534", background: "#052e16" },
  pillAmber: { color: "#fbbf24", borderColor: "#92400e", background: "#1c1200" },
  pillDim: { color: "#94a3b8", borderColor: "#334155", background: "transparent" },

  fastTimeRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem", color: "#94a3b8", marginBottom: 8 },
  fastTimeInput: { background: "transparent", border: "none", borderBottom: "1px solid #475569", color: "#f1f5f9", fontSize: "0.9rem", fontFamily: "inherit", padding: "2px 4px", cursor: "pointer", outline: "none", width: 90 },

  waterBtns: { display: "flex", gap: 8, marginTop: 12 },
  waterBtn: { flex: 1, background: "#0d1b2a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 0", color: "#38bdf8", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  progressTrack: { width: "100%", background: "#1e1e28", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99, transition: "width 0.4s ease" },

  macroRow: { display: "flex", gap: 8, marginTop: 12 },
  macroPill: { flex: 1, border: "1px solid", borderRadius: 8, padding: "8px 10px", background: "#0f0f13" },
  macroLabel: { fontSize: "0.75rem", fontWeight: 700, display: "block" },
  macroVal: { fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", display: "block" },
  macroGoal: { fontSize: "0.8rem", color: "#94a3b8" },

  splitRow: { display: "flex", alignItems: "center", gap: 16 },
  dividerV: { width: 1, height: 40, background: "#1e1e28" },

  inputGroup: { marginBottom: 14, flex: 1 },
  inputLabel: { fontSize: "0.8rem", letterSpacing: "0.1em", color: "#94a3b8", display: "block", marginBottom: 6, fontWeight: 600 },
  input: { width: "100%", background: "#0d0d10", border: "1px solid #252530", borderRadius: 8, padding: "12px 14px", color: "#f1f5f9", fontSize: "1rem", fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
  twoCol: { display: "flex", gap: 10 },

  btn: { width: "100%", background: "#1d4ed8", border: "none", borderRadius: 8, padding: "14px", color: "#fff", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", marginTop: 4, fontFamily: "inherit" },
  btnSuccess: { background: "#15803d" },
  btnDanger: { background: "#991b1b" },

  listItem: { background: "#16161a", border: "1px solid #252530", borderRadius: 10, padding: "12px 16px", marginBottom: 8 },
  listMain: { fontSize: "1rem", color: "#f1f5f9", fontWeight: 600, display: "flex", alignItems: "center" },
  listSub: { fontSize: "0.85rem", color: "#94a3b8", marginTop: 3 },

  statRow: { display: "flex", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, background: "#16161a", border: "1px solid #252530", borderRadius: 10, padding: "12px 8px", textAlign: "center" },
  statVal: { fontSize: "1.3rem", fontWeight: 700, color: "#f1f5f9" },
  statLabel: { fontSize: "0.7rem", letterSpacing: "0.08em", color: "#94a3b8", marginTop: 4 },

  chartWrap: { display: "flex", gap: 6, alignItems: "flex-end", height: 90, marginTop: 12 },
  chartCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  chartBarWrap: { flex: 1, width: "100%", position: "relative", display: "flex", alignItems: "flex-end" },
  chartBar: { width: "100%", borderRadius: "4px 4px 0 0", minHeight: 2, transition: "height 0.4s ease" },
  chartGoalLine: { position: "absolute", left: 0, right: 0, height: 1, background: "#334155", zIndex: 1 },
  chartDay: { fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 },
  chartVal: { fontSize: "0.65rem", fontWeight: 700 },

  toggleBtn: { background: "none", border: "1px solid #334155", borderRadius: 6, padding: "3px 10px", color: "#94a3b8", fontSize: "0.7rem", letterSpacing: "0.08em", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#16161a", border: "1px solid #252530", borderRadius: 14, padding: "24px 20px", width: "100%", maxWidth: 390, maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: "0.85rem", letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 700, marginBottom: 16 },

  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0f0f11", borderTop: "1px solid #252530", display: "flex", padding: "10px 0 14px", zIndex: 100 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", opacity: 0.4 },
  navBtnActive: { opacity: 1 },
  navIcon: { fontSize: "1.4rem", lineHeight: 1 },
  navLabel: { fontSize: "0.7rem", letterSpacing: "0.05em", color: "#cbd5e1", fontFamily: "inherit", fontWeight: 600 },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: #09090b; }
  input:focus { border-color: #475569 !important; }
  input::placeholder { color: #475569; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  .card-tap:active { opacity: 0.85; transform: scale(0.99); }
  ::-webkit-scrollbar { width: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;