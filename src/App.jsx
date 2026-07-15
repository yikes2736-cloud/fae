import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

/* ============================================================
   FAE — retro desktop productivity app
   ============================================================ */

const taskPoints = (d) => 10 * d;
const DIFFICULTY = { 1: "EASY ×1", 2: "MED ×2", 3: "HARD ×3" };
const FREQ_ORDER = ["none", "once", "h1", "h2", "h3", "twice_daily", "daily"];
const FREQ_LABEL = {
  none: "NO REMINDER",
  once: "REMIND ONCE",
  h1: "EVERY HOUR",
  h2: "EVERY 2 HOURS",
  h3: "EVERY 3 HOURS",
  twice_daily: "MORNING & NIGHT",
  daily: "ONCE DAILY",
};
const FREQ_INTERVAL_MS = { h1: 3600000, h2: 7200000, h3: 10800000, daily: 86400000 };

const DEFAULT_THEME = { wall: 0, pat: 0, accent: 0, face: 0, shell: 0, screen: 0 };
const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Current streak = consecutive `true` days counting back from the most recently logged day
function currentStreak(week) {
  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    const v = week[i];
    if (v === null) continue;      // not logged yet, skip past
    if (v === true) streak++;
    else break;                    // a miss ends the streak
  }
  return streak;
}

const BAR_PALETTES = [
  ["#4f7df0", "#a98bf0", "#f0a94f", "#f0d64f", "#4fd6c0"],
  ["#ff6fa8", "#8a6fd6", "#5ac8e0", "#f5c542", "#7fd18c"],
  ["#e05a3a", "#3d8ab5", "#c1911d", "#4d9c5c", "#7756b5"],
];

const PAINT_PALETTE = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200",
  "#22b14c", "#00a2e8", "#3f48cc", "#a349a4", "#ffaec9", "#99d9ea",
  "#c8bfe7", "#b97a57", "#ffffff", "#c3c3c3",
];

/* ---------- store pricing ----------
   points = price × 2  ×  desire factor  ×  reliability factor
   desire 1..5      → 0.8 .. 1.3   (want it more → it should feel earned)
   reliability 0..1 → 0.7 .. 1.2   (struggling → gentler price, thriving → full freight)
------------------------------------ */
const POINTS_PER_CURRENCY = 2;
function suggestPoints(price, desire, reliability) {
  const p = Number(price) || 0;
  const d = 0.8 + ((Math.min(5, Math.max(1, desire)) - 1) / 4) * 0.5;
  const r = 0.7 + Math.min(1, Math.max(0, reliability)) * 0.5;
  const raw = p * POINTS_PER_CURRENCY * d * r;
  return Math.max(5, Math.round(raw / 5) * 5);
}

/* ---------- achievements ---------- */
const ACHIEVEMENTS = [
  { id: "first_task",    label: "First Task Down",       hint: "Complete your first task",         test: (s) => s.tasksDone >= 1 },
  { id: "five_in_a_day", label: "Five in a Day",         hint: "Complete 5 tasks",                 test: (s) => s.tasksDone >= 5 },
  { id: "task_machine",  label: "Task Machine",          hint: "Complete 25 tasks",                test: (s) => s.tasksDone >= 25 },
  { id: "habit_week",    label: "Week Strong",           hint: "Hit a 7-day habit streak",         test: (s) => s.bestStreak >= 7 },
  { id: "habit_month",   label: "Unbreakable",           hint: "Hit a 30-day habit streak",        test: (s) => s.bestStreak >= 30 },
  { id: "first_entry",   label: "Dear Diary",            hint: "Write your first journal entry",   test: (s) => s.entries >= 1 },
  { id: "journal_10",    label: "Chronicler",            hint: "Write 10 journal entries",         test: (s) => s.entries >= 10 },
  { id: "first_buy",     label: "Treat Yourself",        hint: "Buy your first reward",            test: (s) => s.purchases >= 1 },
  { id: "big_saver",     label: "Big Saver",             hint: "Bank 500 points at once",          test: (s) => s.wallet >= 500 },
  { id: "high_roller",   label: "High Roller",           hint: "Bank 2,000 points at once",        test: (s) => s.wallet >= 2000 },
];

/* ---------- icons ---------- */
const Icons = () => (
  <svg style={{ display: "none" }} aria-hidden>
    <symbol id="i-space" viewBox="0 0 16 16"><path d="M1 3h5l2 2h7v9H1z" fill="#ffd24d" stroke="#000"/><path d="M1 6h14v8H1z" fill="#ffe082" stroke="#000"/></symbol>
    <symbol id="i-page" viewBox="0 0 16 16"><path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#000"/><path d="M10 1v3h3" fill="#c0c0c0" stroke="#000"/><path d="M5 7h6M5 9h6M5 11h4" stroke="#000080"/></symbol>
    <symbol id="i-store" viewBox="0 0 16 16"><path d="M2 5h12v9H2z" fill="#ff4fa3" stroke="#000"/><path d="M5 5V3h6v2" fill="none" stroke="#000"/><path d="M2 5h12v2H2z" fill="#fff" stroke="#000"/></symbol>
    <symbol id="i-stats" viewBox="0 0 16 16"><path d="M1 1h14v14H1z" fill="#fff" stroke="#000"/><path d="M4 11h2v3H4zM7 7h2v7H7zM10 4h2v10h-2z" fill="#008080" stroke="#000"/></symbol>
    <symbol id="i-bin" viewBox="0 0 16 16"><path d="M4 4h8v11H4z" fill="#a0a0a0" stroke="#000"/><path d="M3 2h10v2H3z" fill="#808080" stroke="#000"/><path d="M6 6v7M8 6v7M10 6v7" stroke="#000"/></symbol>
    <symbol id="i-play" viewBox="0 0 16 16"><path d="M1 2h14v12H1z" fill="#1c1c22" stroke="#000"/><path d="M6 5l6 3-6 3z" fill="#00ff9c"/></symbol>
    <symbol id="i-mine" viewBox="0 0 16 16"><path d="M1 1h14v14H1z" fill="#c0c0c0" stroke="#808080"/><path d="M4 8l2 3 5-6" fill="none" stroke="#0a7c2f" strokeWidth="2"/></symbol>
    <symbol id="i-cpl" viewBox="0 0 16 16"><path d="M2 2h12v12H2z" fill="#c0c0c0" stroke="#000"/><path d="M4 5h8v2H4zM4 9h8v2H4z" fill="#000080"/></symbol>
    <symbol id="i-fae" viewBox="0 0 16 16"><path d="M2 2h12v12H2z" fill="#ff4fa3"/><path d="M5 4h6v2H7v2h3v2H7v3H5z" fill="#fff"/></symbol>
    <symbol id="i-grid" viewBox="0 0 16 16"><rect x="1" y="1" width="4" height="4" fill="#000"/><rect x="6" y="1" width="4" height="4" fill="#000"/><rect x="11" y="1" width="4" height="4" fill="#000"/><rect x="1" y="6" width="4" height="4" fill="#000"/><rect x="6" y="6" width="4" height="4" fill="#000"/><rect x="11" y="6" width="4" height="4" fill="#000"/><rect x="1" y="11" width="4" height="4" fill="#000"/><rect x="6" y="11" width="4" height="4" fill="#000"/><rect x="11" y="11" width="4" height="4" fill="#000"/></symbol>
    <symbol id="i-plus" viewBox="0 0 16 16"><rect x="7" y="2" width="2" height="12" fill="#000"/><rect x="2" y="7" width="12" height="2" fill="#000"/></symbol>
    <symbol id="i-journey" viewBox="0 0 16 16"><path d="M1 1h14v14H1z" fill="#fff" stroke="#000"/><path d="M3 12l3-4 3 3 4-6" fill="none" stroke="#ff4fa3" strokeWidth="2"/><circle cx="13" cy="5" r="1.5" fill="#f5c542"/></symbol>
    <symbol id="i-trophy" viewBox="0 0 16 16"><path d="M4 2h8v4a4 4 0 0 1-8 0z" fill="#f5c542" stroke="#000"/><rect x="7" y="10" width="2" height="3" fill="#000"/><rect x="5" y="13" width="6" height="2" fill="#000"/></symbol>
  </svg>
);
const Ico = ({ id }) => <svg><use href={`#${id}`} /></svg>;

/* ---------- retro due-date picker (no native calendar popup) ---------- */
function DueDatePicker({ value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const current = value ? new Date(value) : null;

  const setQuick = (ms) => onChange(new Date(Date.now() + ms).toISOString());

  const adjust = (unit, delta) => {
    const d = current ? new Date(current) : new Date();
    if (unit === "day")  d.setDate(d.getDate() + delta);
    if (unit === "hour") d.setHours(d.getHours() + delta);
    if (unit === "min")  d.setMinutes(d.getMinutes() + delta * 5);
    onChange(d.toISOString());
  };

  const label = current
    ? current.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "NO DUE DATE SET";

  return (
    <div className="ddp">
      <div className="ddpLcd">{label}</div>
      <div className="ddpQuick">
        <div className="ddpBtn" onClick={() => setQuick(3600000)}>+1H</div>
        <div className="ddpBtn" onClick={() => setQuick(10800000)}>+3H</div>
        <div className="ddpBtn" onClick={() => setQuick(86400000)}>+1D</div>
        <div className="ddpBtn" onClick={() => setQuick(604800000)}>+1WK</div>
        <div className="ddpBtn" onClick={() => setExpanded((e) => !e)}>{expanded ? "DONE" : "ADJUST"}</div>
        {value && <div className="ddpBtn clear" onClick={() => onChange(null)}>CLEAR</div>}
      </div>
      {expanded && (
        <div className="ddpSteppers">
          <div className="ddpStep">
            <span>Day</span>
            <div className="ddpArrows"><div onClick={() => adjust("day", 1)}>▲</div><div onClick={() => adjust("day", -1)}>▼</div></div>
          </div>
          <div className="ddpStep">
            <span>Hour</span>
            <div className="ddpArrows"><div onClick={() => adjust("hour", 1)}>▲</div><div onClick={() => adjust("hour", -1)}>▼</div></div>
          </div>
          <div className="ddpStep">
            <span>Min</span>
            <div className="ddpArrows"><div onClick={() => adjust("min", 1)}>▲</div><div onClick={() => adjust("min", -1)}>▼</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- draggable + resizable window ---------- */
function Win({ id, title, icon, menu, footer, children, init, z, focus, onClose, className = "" }) {
  const ref = useRef(null);
  const [box, setBox] = useState(init);

  const startDrag = (e, mode) => {
    e.stopPropagation();
    focus(id);
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;

    const move = (ev) => {
      if (mode === "move") {
        setBox((b) => ({ ...b, x: ev.clientX - ox, y: Math.max(0, ev.clientY - oy) }));
      } else {
        setBox((b) => ({
          ...b,
          w: mode !== "b" ? Math.max(220, ev.clientX - r.left) : b.w,
          h: mode !== "r" ? Math.max(150, ev.clientY - r.top)  : b.h,
        }));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      className={`win ${className}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z }}
      onPointerDown={() => focus(id)}
    >
      <div className="bar" onPointerDown={(e) => startDrag(e, "move")}>
        <Ico id={icon} />
        <div className="t">{title}</div>
        <div className="btn">_</div>
        <div className="btn" onClick={onClose}>✕</div>
      </div>
      {menu && (
        <div className="menu">
          {menu.map((m) => <span key={m}>{m}</span>)}
        </div>
      )}
      {children}
      {footer && <div className="status">{footer}</div>}
      <div className="edge e-r" onPointerDown={(e) => startDrag(e, "r")} />
      <div className="edge e-b" onPointerDown={(e) => startDrag(e, "b")} />
      <div className="grip"   onPointerDown={(e) => startDrag(e, "rb")} />
    </div>
  );
}

/* ---------- the pet ---------- */
function Tama({ pct, displayed, floatText, hyped, onStore, onFeed, onTweak, z, focus }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: window.innerWidth - 250, y: 34 });

  const startDrag = (e) => {
    if (e.target.closest(".pad")) return;
    focus("tama");
    const r = ref.current.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev) => setPos({ x: ev.clientX - ox, y: Math.max(0, ev.clientY - oy) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const mood = pct === 1 ? "THRIVING" : pct > 0.5 ? "HAPPY" : pct > 0 ? "CONTENT" : "SLEEPY";
  const mouthW = 4 + Math.round(pct * 5);
  const armY = 11 - Math.round(pct * 3);

  return (
    <div
      ref={ref}
      className={`tama ${hyped ? "pop hyped" : ""}`}
      style={{ left: pos.x, top: pos.y, zIndex: z }}
      onPointerDown={startDrag}
    >
      <div className="screen">
        <svg viewBox="0 0 44 32">
          <g className="sprite" fill="var(--ink)">
            <rect x="17" y="5" width="10" height="2" />
            <rect x="15" y="7" width="14" height="2" />
            <rect x="13" y="9" width="18" height="9" />
            <rect x="15" y="18" width="14" height="3" />
            <rect x="16" y="21" width="4" height="2" />
            <rect x="24" y="21" width="4" height="2" />
            <rect x="11" y={armY} width="2" height="5" />
            <rect x="31" y={armY} width="2" height="5" />
            <g fill="var(--screen)">
              <rect x="17" y="11" width="2" height="2" />
              <rect x="25" y="11" width="2" height="2" />
              <rect x={22 - Math.round(mouthW / 2)} y="15" width={mouthW} height="1" />
            </g>
          </g>
          <g fill="var(--ink)" opacity={pct > 0.6 ? 1 : 0.2}>
            <rect x="36" y="4"  width="2" height="2" />
            <rect x="6"  y="24" width="2" height="2" />
            <rect x="38" y="24" width="2" height="2" />
          </g>
        </svg>
        <div className="num">{displayed.toLocaleString()}</div>
        <div className="lbl">FAE POINTS · {mood}</div>
        {floatText && <div className="float go" key={floatText.key}>{floatText.text}</div>}
      </div>
      <div className="pads">
        <div className="pad" onClick={onStore}>STORE</div>
        <div className="pad" onClick={onFeed}>FEED</div>
        <div className="pad" onClick={onTweak}>TWEAK</div>
      </div>
    </div>
  );
}

/* ---------- digicam: streak chart screen ---------- */
function StreakChart({ habits, palette }) {
  const streaks = habits.map((h) => currentStreak(h.week));
  const max = Math.max(1, ...streaks);
  return (
    <div className="camLcd">
      <div className="camChartLabel">DAYS<br />ACHIEVED</div>
      <div className="camBars">
        {habits.map((h, i) => (
          <div className="camBarCol" key={h.id}>
            <div className="camBarNum">{streaks[i]}</div>
            <div
              className="camBar"
              style={{ height: `${(streaks[i] / max) * 100}%`, background: palette[i % palette.length] }}
            />
            <div className="camBarLabel">{h.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- digicam: add-habit screen ---------- */
function AddHabitScreen({ onAdd }) {
  const [name, setName] = useState("");
  const [diff, setDiff] = useState(1);
  const pts = diff === 3 ? 15 : diff === 2 ? 10 : 5;

  const save = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), pts);
    setName("");
    setDiff(1);
  };

  return (
    <div className="camLcd camAdd">
      <div className="camAddLabel">NEW HABIT</div>
      <input
        className="camInput"
        placeholder="Habit name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <div className="camDiffRow">
        <div className={`camDiff ${diff === 1 ? "on" : ""}`} onClick={() => setDiff(1)}>EASY +5</div>
        <div className={`camDiff ${diff === 2 ? "on" : ""}`} onClick={() => setDiff(2)}>MED +10</div>
        <div className={`camDiff ${diff === 3 ? "on" : ""}`} onClick={() => setDiff(3)}>HARD +15</div>
      </div>
      <div className="camShutter" onClick={save}>●</div>
      <div className="camAddHint">Tap the shutter to save</div>
    </div>
  );
}

/* ---------- digicam device ---------- */
function Digicam({ habits, onAdd }) {
  const [page, setPage] = useState("chart");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const palette = BAR_PALETTES[paletteIdx];
  const flip = () => setPage((p) => (p === "chart" ? "add" : "chart"));

  return (
    <div className="camBody">
      <div className="camTopRow"><div className="camDot" /></div>
      <div className="camMain">
        <div className="camScreen">
          {page === "chart" ? <StreakChart habits={habits} palette={palette} /> : <AddHabitScreen onAdd={onAdd} />}
        </div>
        <div className="camSide">
          <div className="camRocker" onClick={flip}><span>W</span><span>T</span></div>
          <div className="camStars">
            <div className="camStar" onClick={() => setPaletteIdx((p) => (p + 1) % BAR_PALETTES.length)}>★</div>
            <div className="camStar" onClick={() => setPaletteIdx((p) => (p + 1) % BAR_PALETTES.length)}>★</div>
          </div>
          <div className="camDial" onClick={flip}>
            <div className="camArrowL">◀</div>
            <div className="lbl">DISP</div>
            <div className="camArrowR">▶</div>
          </div>
        </div>
      </div>
      <div className="camBottomRow">
        <span onClick={flip} style={{ cursor: "pointer" }}>MENU</span>
        <span title="Delete habit — coming soon">🗑</span>
      </div>
    </div>
  );
}

/* ---------- scales its child to fill the available space, preserving aspect ratio ---------- */
function ScaleToFit({ children, minScale = 0.55, maxScale = 2.6 }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recalc = () => {
      inner.style.transform = "scale(1)";           // measure at natural size first
      const naturalW = inner.offsetWidth;
      const naturalH = inner.offsetHeight;
      if (!naturalW || !naturalH) return;
      const s = Math.min(outer.clientWidth / naturalW, outer.clientHeight / naturalH);
      setScale(Math.min(Math.max(s, minScale), maxScale));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [minScale, maxScale]);

  return (
    <div ref={outerRef} className="scaleFit">
      <div ref={innerRef} className="scaleFitInner" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Tasks: Project Hub ---------- */
function ProjectHub({ folders, tasks, selected, onSelect, onAddFolder, onDeleteFolder, onSetColor, onAddTask, onToggleTask, onDeleteTask }) {
  const [newFolder, setNewFolder] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newTask, setNewTask] = useState("");

  const folder = folders.find((f) => f.id === selected) || null;
  const folderTasks = folder ? tasks.filter((t) => t.folderId === folder.id) : [];

  const groups = [];
  const buckets = {};
  folderTasks.forEach((t) => {
    const g = t.group || "General";
    if (!buckets[g]) { buckets[g] = []; groups.push(g); }
    buckets[g].push(t);
  });
  groups.sort((a, b) => (a === "General") - (b === "General"));

  const submitTask = () => {
    if (!newTask.trim() || !folder) return;
    onAddTask(folder.id, newGroup, newTask.trim());
    setNewTask("");
  };
  const submitFolder = () => {
    if (!newFolder.trim()) return;
    onAddFolder(newFolder.trim());
    setNewFolder("");
  };

  return (
    <>
      <div className="hubBody">
        <div className="hubSidebar">
          {folders.map((f) => (
            <div key={f.id} className={`hubFolder ${selected === f.id ? "on" : ""}`} onClick={() => onSelect(f.id)}>
              <span className="hubFolderIcon" style={{ background: f.color }} />
              <span className="hubFolderName">{f.name}</span>
              {selected === f.id && (
                <span className="hubFolderDel" onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }}>×</span>
              )}
            </div>
          ))}
          <div className="hubNewFolder">
            <input
              value={newFolder}
              placeholder="+ New folder"
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitFolder()}
            />
          </div>
        </div>

        <div className="hubMain">
          {!folder && <div className="hubEmpty">Create or pick a folder on the left to see its tasks.</div>}
          {folder && (
            <>
              <div className="hubHeader">
                <span className="hubHeaderDot" style={{ background: folder.color }} />
                {folder.name}
              </div>

              <div className="hubAddRow">
                <input className="hubInputSmall" placeholder="Section (optional)" value={newGroup}
                       onChange={(e) => setNewGroup(e.target.value)} />
                <input className="hubInputBig" placeholder="New task…" value={newTask}
                       onChange={(e) => setNewTask(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && submitTask()} />
                <div className="hubAddBtn" onClick={submitTask}>Add</div>
              </div>

              <div className="hubList">
                {groups.length === 0 && <div className="hubEmpty">No tasks yet — add one above.</div>}
                {groups.map((g) => (
                  <div key={g} className="hubGroup">
                    <div className="hubGroupTitle">{g}</div>
                    {buckets[g].map((t) => (
                      <div key={t.id} className={`hubItem ${t.done ? "done" : ""}`}>
                        <div className="hubCb" onClick={() => onToggleTask(t.id)}>{t.done ? "✓" : ""}</div>
                        <div className="hubItemName">{t.name}</div>
                        <div className="hubItemDel" onClick={() => onDeleteTask(t.id)}>×</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="hubPalette">
        {PAINT_PALETTE.map((c) => (
          <div key={c} className="hubSwatch" style={{ background: c }}
               onClick={() => folder && onSetColor(folder.id, c)} />
        ))}
      </div>
    </>
  );
}

/* ---------- Journal ---------- */
function Journal({ entries, wallet, username, onAdd }) {
  const [compose, setCompose] = useState(false);
  const [caption, setCaption] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [openId, setOpenId] = useState(null);
  const fileRef = useRef(null);

  const level = Math.max(1, Math.floor(wallet / 500) + 1);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
  };

  const post = async () => {
    if (!caption.trim() && !photoFile) return;
    setPosting(true);
    await onAdd(caption.trim(), photoFile);
    setPosting(false);
    setCaption(""); setPhotoFile(null); setPhotoPreview(null); setCompose(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const opened = entries.find((e) => e.id === openId);

  return (
    <div className="jrnl">
      <div className="jrnlProfile">
        <div className="jrnlAvatar" />
        <div className="jrnlStats">
          <div><b>{entries.length}</b><span>Entries</span></div>
          <div><b>{wallet.toLocaleString()}</b><span>Points</span></div>
          <div><b>{level}</b><span>Level</span></div>
        </div>
      </div>
      <div className="jrnlName"><b>{username}</b><small>building fae one commit at a time ✨</small></div>

      <div className="jrnlToolbar">
        <div className="jrnlTool on"><Ico id="i-grid" /></div>
        <div className="jrnlTool" onClick={() => setCompose((c) => !c)}><Ico id="i-plus" /></div>
      </div>

      {compose && (
        <div className="jrnlCompose">
          <textarea placeholder="What's on your mind…" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <div className="jrnlComposeRow">
            <label className="jrnlUpload">
              {photoFile ? "Change photo" : "Add photo"}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
            {photoPreview && <img className="jrnlPreview" src={photoPreview} alt="" />}
            <div className="jrnlPostBtn" onClick={post}>{posting ? "Posting…" : "Post"}</div>
          </div>
        </div>
      )}

      <div className="jrnlGrid">
        {entries.length === 0 && <div className="hubEmpty">No entries yet — hit the + to write your first one.</div>}
        {entries.map((e) => (
          <div key={e.id} className="jrnlThumb" onClick={() => setOpenId(e.id)}>
            {e.photo ? <img src={e.photo} alt="" /> : <div className="jrnlTextThumb">{e.caption.slice(0, 60) || "…"}</div>}
          </div>
        ))}
      </div>

      {opened && (
        <div className="jrnlOverlay" onClick={() => setOpenId(null)}>
          <div className="jrnlOverlayCard" onClick={(e) => e.stopPropagation()}>
            <div className="jrnlOverlayClose" onClick={() => setOpenId(null)}>✕</div>
            {opened.photo && <img src={opened.photo} alt="" />}
            <div className="jrnlOverlayDate">{opened.date}</div>
            <div className="jrnlOverlayCaption">{opened.caption}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- STORE: gameboy ---------- */
const PER_PAGE = 6;

function Store({ items, wallet, reliability, onAdd, onDelete, onToggleCart, onCheckout, onDeleteOrder, orders }) {
  const [view, setView] = useState("shop");       // shop | add | bag | checkout | receipt
  const [page, setPage] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);

  // add-item form
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [price, setPrice] = useState("");
  const [desire, setDesire] = useState(3);
  const [mode, setMode] = useState("auto");        // auto | manual
  const [manualPts, setManualPts] = useState("");
  const fileRef = useRef(null);

  const available = items.filter((i) => i.status === "available");
  const cart      = items.filter((i) => i.status === "cart");
  const purchased = items.filter((i) => i.status === "purchased");

  const shelf = [...available, ...cart];
  const pages = Math.max(1, Math.ceil(shelf.length / PER_PAGE));
  const shown = shelf.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const cartTotal = cart.reduce((s, i) => s + i.points, 0);
  const autoPts = suggestPoints(price, desire, reliability);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const [addError, setAddError] = useState("");

  const submit = async () => {
    if (!name.trim()) { setAddError("Give it a name first."); return; }
    const pts = mode === "auto" ? autoPts : Math.max(1, parseInt(manualPts) || 0);
    setBusy(true);
    setAddError("");
    try {
      await onAdd({ name: name.trim(), file, points: pts, price: price ? Number(price) : null, desire });
      setName(""); setFile(null); setPreview(null); setPrice(""); setDesire(3); setManualPts(""); setMode("auto");
      if (fileRef.current) fileRef.current.value = "";
      setView("shop");
    } catch (err) {
      console.error("Adding store item failed:", err);
      setAddError(err.message || "Couldn't save that item — try again.");
    } finally {
      setBusy(false);
    }
  };

  const [checkoutError, setCheckoutError] = useState("");

  const doCheckout = async () => {
    setBusy(true);
    setCheckoutError("");
    try {
      const order = await onCheckout();
      if (order) { setReceipt(order); setView("receipt"); }
      else setCheckoutError("Checkout didn't go through — try again.");
    } catch (err) {
      console.error("Checkout failed:", err);
      setCheckoutError(err.message || "Checkout didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gb">
      <div className="gbMain">
        <div className="gbScreenFrame">
          <div className="gbScreen">

            {view === "shop" && (
              <>
                {shelf.length === 0 && (
                  <div className="gbEmpty">
                    No items yet.<br />Hit <b>+ ADD</b> to upload something you want.
                  </div>
                )}
                <div className="gbGrid">
                  {shown.map((it) => (
                    <div key={it.id} className={`gbItem ${it.status === "cart" ? "inCart" : ""}`}>
                      <div className="gbItemPhoto" onClick={() => onToggleCart(it.id)}>
                        {it.photo_url
                          ? <img src={it.photo_url} alt={it.name} />
                          : <div className="gbNoPhoto">{it.name.slice(0, 14)}</div>}
                        {it.status === "cart" && <div className="gbInCartFlag">IN CART</div>}
                        <div className="gbItemDel" onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}>×</div>
                      </div>
                      <div className="gbItemPts" onClick={() => onToggleCart(it.id)}>{it.points} pts</div>
                    </div>
                  ))}
                </div>
                {pages > 1 && <div className="gbPageNum">PAGE {page + 1} / {pages}</div>}
              </>
            )}

            {view === "add" && (
              <div className="gbForm">
                <div className="gbFormTitle">NEW ITEM</div>
                <input className="gbInput" placeholder="What is it?" value={name} onChange={(e) => setName(e.target.value)} />
                <label className="gbUpload">
                  {preview ? <img src={preview} alt="" /> : <span>+ Upload photo</span>}
                  <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} hidden />
                </label>

                <div className="gbModeRow">
                  <div className={`gbMode ${mode === "auto" ? "on" : ""}`} onClick={() => setMode("auto")}>AUTO PRICE</div>
                  <div className={`gbMode ${mode === "manual" ? "on" : ""}`} onClick={() => setMode("manual")}>SET MYSELF</div>
                </div>

                {mode === "auto" ? (
                  <>
                    <input className="gbInput" type="number" placeholder="Real price (RM)" value={price}
                           onChange={(e) => setPrice(e.target.value)} />
                    <div className="gbDesireRow">
                      <span>Desire</span>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <div key={d} className={`gbStar ${d <= desire ? "on" : ""}`} onClick={() => setDesire(d)}>★</div>
                      ))}
                    </div>
                    <div className="gbAutoPts">≈ {autoPts} points</div>
                  </>
                ) : (
                  <input className="gbInput" type="number" placeholder="Points to unlock" value={manualPts}
                         onChange={(e) => setManualPts(e.target.value)} />
                )}

                {addError && <div className="gbFormError">{addError}</div>}
                <div className="gbFormBtns">
                  <div className="gbBtn" onClick={() => setView("shop")}>Cancel</div>
                  <div className="gbBtn primary" onClick={submit}>{busy ? "…" : "Save"}</div>
                </div>
              </div>
            )}

            {view === "bag" && (
              <div className="gbBag">
                <div className="gbFormTitle">MY PURCHASES</div>
                {purchased.length === 0 && <div className="gbEmpty">Nothing bought yet.<br />Go earn it.</div>}
                {purchased.map((it) => (
                  <div key={it.id} className="gbBagRow">
                    {it.photo_url && <img src={it.photo_url} alt="" />}
                    <div className="gbBagInfo">
                      <b>{it.name}</b>
                      <small>{it.purchased_at ? formatDate(it.purchased_at) : ""} · {it.points} pts</small>
                    </div>
                  </div>
                ))}
                <div className="gbBtn" onClick={() => setView("shop")} style={{ marginTop: 8 }}>Back</div>
              </div>
            )}

            {view === "checkout" && (
              <div className="xpDialog">
                <div className="xpBar"><span>Windows XP</span><div className="xpX" onClick={() => setView("shop")}>✕</div></div>
                <div className="xpBody">
                  <div className="xpIcon">i</div>
                  <div className="xpText">
                    are you sure you want to check out?<br />
                    total current point cost : <b>{cartTotal}</b>
                    {cartTotal > wallet && <div className="xpWarn">Not enough points — you have {wallet}.</div>}
                    {checkoutError && <div className="xpWarn">{checkoutError}</div>}
                    <div className="xpFinal">This cannot be undone.</div>
                  </div>
                </div>
                <div className="xpBtns">
                  <div className="xpBtn" onClick={() => setView("shop")}>Cancel</div>
                  <div className={`xpBtn ${cartTotal > wallet || cart.length === 0 ? "off" : ""}`}
                       onClick={() => cartTotal <= wallet && cart.length > 0 && doCheckout()}>
                    {busy ? "…" : "OK"}
                  </div>
                </div>
              </div>
            )}

            {view === "receipt" && receipt && (
              <div className="rcpt">
                <div className="rcptLogo">FAE</div>
                <div className="rcptSub">THE HAUL</div>
                <div className="rcptMeta">
                  ORDER #{String(receipt.id).slice(0, 4).toUpperCase()}<br />
                  {new Date(receipt.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="rcptRule" />
                {receipt.items.map((it) => (
                  <div className="rcptLine" key={it.id}>
                    <span>{it.name.toUpperCase()}</span>
                    <span>{it.points}</span>
                  </div>
                ))}
                <div className="rcptRule" />
                <div className="rcptLine big"><span>ITEMS :</span><span>{receipt.items.length}</span></div>
                <div className="rcptLine big"><span>POINTS :</span><span>{receipt.total_points}</span></div>
                <div className="rcptRule" />
                <div className="rcptMeta">
                  BALANCE LEFT : {wallet}<br />
                  EARNED THE HARD WAY
                </div>
                <div className="rcptBars">
                  {Array.from({ length: 44 }).map((_, i) => (
                    <i key={i} style={{ width: (i * 7) % 3 === 0 ? 3 : 1 }} />
                  ))}
                </div>
                <div className="gbBtn" onClick={() => setView("shop")}>Done</div>
              </div>
            )}

          </div>
        </div>

        {/* right control column */}
        <div className="gbSide">
          <div className="gbCart" onClick={() => setView("checkout")}>
            <svg viewBox="0 0 24 24" className="gbCartIcon">
              <path d="M3 4h3l3 11h9l3-8H7" fill="none" stroke="var(--tama-edge)" strokeWidth="2" />
              <circle cx="10" cy="19" r="1.6" fill="var(--tama-edge)" />
              <circle cx="18" cy="19" r="1.6" fill="var(--tama-edge)" />
            </svg>
            {cart.length > 0 && <div className="gbBadge">{cart.length}</div>}
          </div>

          <div className="gbDpad">
            <div className="gbD up"    onClick={() => setPage((p) => Math.max(0, p - 1))}>▲</div>
            <div className="gbD left"  onClick={() => setPage((p) => Math.max(0, p - 1))}>◀</div>
            <div className="gbD mid" />
            <div className="gbD right" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>▶</div>
            <div className="gbD down"  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>▼</div>
          </div>

          <div className="gbBagBtn" onClick={() => setView("bag")}>
            <svg viewBox="0 0 24 24">
              <path d="M5 8h14l-1 12H6z" fill="var(--tama-b)" stroke="var(--tama-edge)" strokeWidth="1.5" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="var(--tama-edge)" strokeWidth="1.5" />
            </svg>
            {purchased.length > 0 && <div className="gbBadge dark">{purchased.length}</div>}
          </div>
        </div>
      </div>

      <div className="gbBottom">
        <div className="gbBtn primary" onClick={() => setView("add")}>+ ADD</div>
        <div className="gbWallet">{wallet.toLocaleString()} pts</div>
      </div>
    </div>
  );
}

/* ---------- JOURNEY ---------- */
function Journey({ stats, unlocked }) {
  const rows = [
    ["Tasks completed",   stats.tasksDone],
    ["Habit days ticked", stats.habitDays],
    ["Best habit streak", `${stats.bestStreak} days`],
    ["Journal entries",   stats.entries],
    ["Points earned",     stats.earnedTotal.toLocaleString()],
    ["Rewards bought",    stats.purchases],
    ["Points spent",      stats.spentTotal.toLocaleString()],
    ["Current balance",   stats.wallet.toLocaleString()],
  ];

  return (
    <div className="jny">
      <div className="jnyHead">
        <div className="jnyLevel">
          <b>LVL {Math.max(1, Math.floor(stats.wallet / 500) + 1)}</b>
          <small>{stats.wallet.toLocaleString()} pts banked</small>
        </div>
        <div className="jnyReliability">
          <div className="jnyRelBar"><i style={{ width: `${Math.round(stats.reliability * 100)}%` }} /></div>
          <small>{Math.round(stats.reliability * 100)}% follow-through</small>
        </div>
      </div>

      <div className="jnySection">Your numbers</div>
      <div className="jnyStats">
        {rows.map(([k, v]) => (
          <div className="jnyStat" key={k}><span>{k}</span><b>{v}</b></div>
        ))}
      </div>

      <div className="jnySection">Milestones</div>
      <div className="jnyAch">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`jnyBadge ${got ? "got" : ""}`} title={a.hint}>
              <Ico id="i-trophy" />
              <div>
                <b>{a.label}</b>
                <small>{got ? "Unlocked" : a.hint}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- theme data ---------- */
const WALLPAPERS = ["#3a2a4d", "#008080", "#5b3a29", "#1a1a2e", "#c96a8b", "#7aa37a", "#404040"];
const PATTERNS = [
  { label: "–", v: "none", css: "#c0c0c0" },
  { label: "",  v: "radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)",
    css: "#666 radial-gradient(#fff 1px,transparent 1px)", size: "5px 5px" },
  { label: "",  v: "repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 2px, transparent 2px 8px)",
    css: "#666 repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 4px)" },
  { label: "",  v: "repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 1px, transparent 1px 8px)",
    css: "#666 repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 5px)" },
];
const ACCENTS = [
  ["#000080", "#1084d0"], ["#7a1f5c", "#ff4fa3"], ["#0b5c3f", "#22c58b"],
  ["#5a1a1a", "#e05a3a"], ["#3a2a5c", "#8a6fd6"], ["#333333", "#888888"],
];
const FACES = ["#c0c0c0", "#d4d0c8", "#e6d9ec", "#cfe0d8", "#f0dcc8"];
const SHELLS = [
  { b: "#ff69b4", a: "#ffc2e4", c: "#cf4587", e: "#a83b73" },
  { b: "#6fc3e8", a: "#c8ecf9", c: "#3d8ab5", e: "#2d6c8f" },
  { b: "#a986e0", a: "#ddcdf7", c: "#7756b5", e: "#5c3f92" },
  { b: "#7fd18c", a: "#cdf0d3", c: "#4d9c5c", e: "#3a7a46" },
  { b: "#f5c542", a: "#fce9ae", c: "#c1911d", e: "#946e15" },
  { b: "#e8734f", a: "#f8c3b0", c: "#b34a2d", e: "#8c3721" },
];
const SCREENS = [
  { s: "#9aab6b", ink: "#22301a", e: "#6d7a4c" },
  { s: "#8fc9d4", ink: "#12333a", e: "#5e959f" },
  { s: "#e0cfa0", ink: "#3a2d12", e: "#a89a72" },
  { s: "#c9a8cf", ink: "#361a3c", e: "#94769a" },
];

/* ---------- login / signup screen ---------- */
function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (error) { setError(error.message); return; }
    if (mode === "signup") setNotice("Account created — check your email to confirm, then log in.");
  };

  return (
    <div className="authScreen">
      <form className="authWin" onSubmit={submit}>
        <div className="authBar"><Ico id="i-fae" /><span>Fae — {mode === "login" ? "Log In" : "Sign Up"}</span></div>
        <div className="authBody">
          <input type="email" placeholder="Email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6 characters)" value={password}
                 onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <div className="authError">{error}</div>}
          {notice && <div className="authNotice">{notice}</div>}
          <button type="submit" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
          <div className="authSwitch" onClick={() => { setMode((m) => (m === "login" ? "signup" : "login")); setError(""); setNotice(""); }}>
            {mode === "login" ? "New here? Create an account" : "Already have one? Log in"}
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================================ */
function Desktop({ session }) {
  const [tasks, setTasks]   = useState([]);
  const [habits, setHabits] = useState([]);
  const [folders, setFolders]           = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [toast, setToast] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [shown, setShown]   = useState(0);
  const [floatText, setFloat] = useState(null);
  const [hyped, setHyped]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [open, setOpen]     = useState({ tasks: true, habits: true, habitsHub: false, cpl: false, projectHub: false, journal: false, store: false, journey: false });
  const [zTop, setZTop]     = useState(10);
  const [zMap, setZMap]     = useState({ tasks: 3, habits: 2, habitsHub: 4, tama: 5, cpl: 9, projectHub: 6, journal: 7, store: 8, journey: 8 });
  const [startOpen, setStartOpen] = useState(false);
  const [tab, setTab]       = useState("desktop");
  const [theme, setTheme]   = useState(DEFAULT_THEME);
  const [clock, setClock]   = useState("");

  const uid = session.user.id;

  // ---- fetch everything for this user, once, on load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profileRes, tasksRes, habitsRes, foldersRes, projectRes, entriesRes, storeRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("tasks").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("habits").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("folders").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("project_tasks").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("journal_entries").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("store_items").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      if (profileRes.data) {
        setWallet(profileRes.data.wallet ?? 0);
        setShown(profileRes.data.wallet ?? 0);
        setTheme(profileRes.data.theme || DEFAULT_THEME);
      }
      setTasks(tasksRes.data || []);
      setHabits((habitsRes.data || []).map((h) => ({ ...h, week: h.week || [null, null, null, null, null, null, null] })));
      setFolders(foldersRes.data || []);
      setSelectedFolder(foldersRes.data?.[0]?.id ?? null);
      setProjectTasks(
        (projectRes.data || []).map((t) => ({ id: t.id, folderId: t.folder_id, group: t.group_name, name: t.name, done: t.done }))
      );
      setJournalEntries(
        (entriesRes.data || []).map((e) => ({ id: e.id, date: formatDate(e.created_at), caption: e.caption, photo: e.photo_url }))
      );
      setStoreItems(storeRes.data || []);
      setOrders(ordersRes.data || []);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // ---- persist wallet + theme back to the profile row whenever they change ----
  useEffect(() => {
    if (!loaded) return;
    supabase.from("profiles").update({ wallet }).eq("id", uid);
  }, [wallet, loaded, uid]);

  useEffect(() => {
    if (!loaded) return;
    supabase.from("profiles").update({ theme }).eq("id", uid);
  }, [theme, loaded, uid]);

  const focus = useCallback((id) => {
    setZTop((t) => {
      const next = t + 1;
      setZMap((m) => ({ ...m, [id]: next }));
      return next;
    });
  }, []);

  useEffect(() => {
    if (shown === wallet) return;
    const t = setInterval(() => {
      setShown((s) => {
        const step = Math.max(1, Math.ceil(Math.abs(wallet - s) / 8));
        if (Math.abs(wallet - s) <= step) { clearInterval(t); return wallet; }
        return s < wallet ? s + step : s - step;
      });
    }, 40);
    return () => clearInterval(t);
  }, [wallet, shown]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--desk", WALLPAPERS[theme.wall]);
    r.setProperty("--desk-pattern", PATTERNS[theme.pat].v);
    r.setProperty("--title",  ACCENTS[theme.accent][0]);
    r.setProperty("--title2", ACCENTS[theme.accent][1]);
    r.setProperty("--face",   FACES[theme.face]);
    const sh = SHELLS[theme.shell];
    r.setProperty("--tama-a", sh.a); r.setProperty("--tama-b", sh.b);
    r.setProperty("--tama-c", sh.c); r.setProperty("--tama-edge", sh.e);
    const sc = SCREENS[theme.screen];
    r.setProperty("--screen", sc.s); r.setProperty("--ink", sc.ink);
    r.setProperty("--screen-edge", sc.e);
  }, [theme]);

  const award = (n) => {
    setWallet((w) => w + n);
    setFloat({ text: (n > 0 ? "+" : "") + n, key: Date.now() });
    setHyped(true);
    setTimeout(() => setHyped(false), 1500);
  };

  const toggleTask = async (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const done = !t.done;
    award(done ? taskPoints(t.difficulty) : -taskPoints(t.difficulty));
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done } : x)));
    await supabase.from("tasks").update({ done }).eq("id", id);
  };

  const addTask = async (name, difficulty, due_at, remind_freq) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ user_id: uid, name, difficulty, done: false, due_at: due_at || null, remind_freq: remind_freq || "none" })
      .select()
      .single();
    if (!error && data) setTasks((ts) => [...ts, data]);
  };

  const deleteTask = async (id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const cycleHabit = async (habitId, dayIndex) => {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return;
    const v = h.week[dayIndex];
    let next, delta;
    if (v === null)  { next = true;  delta = h.points;  }
    else if (v === true) { next = false; delta = -h.points; }
    else { next = null; delta = 0; }
    if (delta) award(delta);
    const week = [...h.week];
    week[dayIndex] = next;
    setHabits((hs) => hs.map((x) => (x.id === habitId ? { ...x, week } : x)));
    await supabase.from("habits").update({ week }).eq("id", habitId);
  };

  const addHabit = async (name, points) => {
    const week = [null, null, null, null, null, null, null];
    const { data, error } = await supabase
      .from("habits")
      .insert({ user_id: uid, name, points, week })
      .select()
      .single();
    if (!error && data) setHabits((hs) => [...hs, data]);
  };

  // ---- Project Hub ----
  const addFolder = async (name) => {
    const color = PAINT_PALETTE[folders.length % PAINT_PALETTE.length];
    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: uid, name, color })
      .select()
      .single();
    if (!error && data) { setFolders((fs) => [...fs, data]); setSelectedFolder(data.id); }
  };
  const deleteFolder = async (id) => {
    setFolders((fs) => fs.filter((f) => f.id !== id));
    setProjectTasks((ts) => ts.map((t) => (t.folderId === id ? { ...t, folderId: null } : t)));
    setSelectedFolder((sf) => (sf === id ? null : sf));
    await supabase.from("folders").delete().eq("id", id); // project_tasks.folder_id auto-nulls server-side (FK ON DELETE SET NULL)
  };
  const setFolderColor = async (id, color) => {
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, color } : f)));
    await supabase.from("folders").update({ color }).eq("id", id);
  };
  const addProjectTask = async (folderId, group, name) => {
    const group_name = group?.trim() || "";
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({ user_id: uid, folder_id: folderId, group_name, name, done: false })
      .select()
      .single();
    if (!error && data) {
      setProjectTasks((ts) => [...ts, { id: data.id, folderId: data.folder_id, group: data.group_name, name: data.name, done: data.done }]);
    }
  };
  const toggleProjectTask = async (id) => {
    const t = projectTasks.find((x) => x.id === id);
    if (!t) return;
    const done = !t.done;
    setProjectTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done } : x)));
    await supabase.from("project_tasks").update({ done }).eq("id", id);
  };
  const deleteProjectTask = async (id) => {
    setProjectTasks((ts) => ts.filter((t) => t.id !== id));
    await supabase.from("project_tasks").delete().eq("id", id);
  };

  // ---- Journal ----
  const addJournalEntry = async (caption, file) => {
    let photo_url = null;
    if (file) {
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, file);
      if (!upErr) {
        const { data } = supabase.storage.from("journal-photos").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }
    const { data: row, error } = await supabase
      .from("journal_entries")
      .insert({ user_id: uid, caption, photo_url })
      .select()
      .single();
    if (!error && row) {
      setJournalEntries((js) => [{ id: row.id, date: formatDate(row.created_at), caption: row.caption, photo: row.photo_url }, ...js]);
    }
  };

  const doneTasks = tasks.filter((t) => t.done);
  const earned    = doneTasks.reduce((s, t) => s + taskPoints(t.difficulty), 0);
  const totalPts  = tasks.reduce((s, t) => s + taskPoints(t.difficulty), 0);
  const pct       = tasks.length ? doneTasks.length / tasks.length : 0;

  const allDays   = habits.flatMap((h) => h.week);
  const ticked    = allDays.filter((v) => v === true).length;
  const openDays  = allDays.filter((v) => v === null).length;

  // ---- reliability: how much of what you set out to do, you actually did ----
  const loggedDays = allDays.filter((v) => v !== null).length;
  const taskRate  = tasks.length ? doneTasks.length / tasks.length : 0.5;
  const habitRate = loggedDays ? ticked / loggedDays : 0.5;
  const reliability = (taskRate + habitRate) / 2;

  // ---- STORE ----
  const addStoreItem = async ({ name, file, points, price, desire }) => {
    let photo_url = null;
    if (file) {
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("store-items").upload(path, file);
      if (upErr) {
        console.error("Store photo upload failed:", upErr.message);
        // don't block the whole item on a photo hiccup — just save without the picture
      } else {
        const { data } = supabase.storage.from("store-items").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }
    const { data, error } = await supabase
      .from("store_items")
      .insert({ user_id: uid, name, photo_url, points, price, desire, status: "available" })
      .select()
      .single();
    if (error) {
      console.error("Saving store item failed:", error.message);
      throw new Error(error.message);
    }
    setStoreItems((xs) => [...xs, data]);
  };

  const deleteStoreItem = async (id) => {
    setStoreItems((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("store_items").delete().eq("id", id);
  };

  const toggleCart = async (id) => {
    const it = storeItems.find((x) => x.id === id);
    if (!it || it.status === "purchased") return;
    const status = it.status === "cart" ? "available" : "cart";
    setStoreItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase.from("store_items").update({ status }).eq("id", id);
  };

  const checkout = async () => {
    const cart = storeItems.filter((x) => x.status === "cart");
    if (!cart.length) return null;
    const total = cart.reduce((s, x) => s + x.points, 0);
    if (total > wallet) return null;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({ user_id: uid, total_points: total })
      .select()
      .single();
    if (error || !order) return null;

    const purchased_at = new Date().toISOString();
    await supabase
      .from("store_items")
      .update({ status: "purchased", order_id: order.id, purchased_at })
      .in("id", cart.map((x) => x.id));

    setStoreItems((xs) =>
      xs.map((x) => (x.status === "cart" ? { ...x, status: "purchased", order_id: order.id, purchased_at } : x))
    );
    setOrders((os) => [order, ...os]);
    award(-total);

    return { ...order, items: cart };
  };

  // ---- JOURNEY stats ----
  const purchasedItems = storeItems.filter((x) => x.status === "purchased");
  const spentTotal = orders.reduce((s, o) => s + (o.total_points || 0), 0);
  const bestStreak = habits.reduce((m, h) => Math.max(m, currentStreak(h.week)), 0);
  const stats = {
    tasksDone: doneTasks.length,
    habitDays: ticked,
    bestStreak,
    entries: journalEntries.length,
    purchases: purchasedItems.length,
    spentTotal,
    earnedTotal: wallet + spentTotal,
    wallet,
    reliability,
  };

  // ---- achievement watcher ----
  useEffect(() => {
    if (!loaded) return;
    const got = ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.id);
    const fresh = got.filter((id) => !unlocked.includes(id));
    if (fresh.length) {
      setUnlocked(got);
      const a = ACHIEVEMENTS.find((x) => x.id === fresh[0]);
      setToast(a.label);
      setTimeout(() => setToast(null), 3500);
    }
  }, [stats.tasksDone, stats.habitDays, stats.bestStreak, stats.entries, stats.purchases, stats.wallet, loaded]);

  // ---- reminders (foreground) ----
  const lastRemindedRef = useRef(new Map());
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const fireReminder = (task) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("Fae — task due", { body: task.name }); } catch { /* ignore */ }
    }
    setToast(`⏰ ${task.name}`);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!loaded) return;

    const check = () => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (!t.due_at || t.done || !t.remind_freq || t.remind_freq === "none") return;
        const due = new Date(t.due_at).getTime();
        if (now < due) return;

        if (t.remind_freq === "twice_daily") {
          const h = new Date(now).getHours();
          if (h !== 9 && h !== 21) return;
          const slotKey = `${new Date(now).toDateString()}-${h === 9 ? "AM" : "PM"}`;
          if (lastRemindedRef.current.get(t.id) !== slotKey) {
            fireReminder(t);
            lastRemindedRef.current.set(t.id, slotKey);
          }
          return;
        }

        const last = lastRemindedRef.current.get(t.id) || 0;
        const shouldFire =
          t.remind_freq === "once"
            ? last === 0
            : now - last >= (FREQ_INTERVAL_MS[t.remind_freq] || 86400000);
        if (shouldFire) {
          fireReminder(t);
          lastRemindedRef.current.set(t.id, now);
        }
      });
    };

    check();
    const iv = setInterval(check, 20000);
    const onReturn = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [tasks, loaded]);

  const close = (k) => setOpen((o) => ({ ...o, [k]: false }));
  const openWin = (k) => { setOpen((o) => ({ ...o, [k]: true })); focus(k); };

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDiff, setNewTaskDiff] = useState(1);
  const [newTaskDue, setNewTaskDue] = useState(null);
  const [newTaskFreq, setNewTaskFreq] = useState("none");
  const cycleFreq = () => setNewTaskFreq((f) => FREQ_ORDER[(FREQ_ORDER.indexOf(f) + 1) % FREQ_ORDER.length]);
  const submitNewTask = () => {
    if (!newTaskName.trim()) return;
    addTask(newTaskName.trim(), newTaskDiff, newTaskDue, newTaskDue ? newTaskFreq : "none");
    setNewTaskName(""); setNewTaskDiff(1); setNewTaskDue(null); setNewTaskFreq("none"); setAddingTask(false);
  };

  if (!loaded) return <div className="authLoading">Loading your desktop…</div>;

  return (
    <div className="fae" onClick={() => setStartOpen(false)}>
      <Icons />

      <div className="desktop">
        {/* ---- icons ---- */}
        <div className="dock">
          <div className="icon" onClick={() => openWin("habitsHub")}><Ico id="i-stats" /><span>Habits</span></div>
          <div className="icon" onClick={() => openWin("projectHub")}><Ico id="i-space" /><span>Tasks</span></div>
          <div className="icon" onClick={() => openWin("store")}><Ico id="i-store" /><span>Store</span></div>
          <div className="icon" onClick={() => openWin("journal")}><Ico id="i-page" /><span>Journal</span></div>
          <div className="icon" onClick={() => openWin("journey")}><Ico id="i-journey" /><span>Journey</span></div>
          <div className="icon" onClick={() => openWin("cpl")}><Ico id="i-cpl" /><span>Settings</span></div>
        </div>

        {/* ---- TASK PLAYER ---- */}
        {open.tasks && (
          <Win
            id="tasks" icon="i-play" title="Today — Task Player"
            className="tasksWin"
            menu={["File", "Edit", "View", "Help"]}
            init={{ x: 120, y: 24, w: 430, h: 320 }}
            z={zMap.tasks} focus={focus} onClose={() => close("tasks")}
            footer={[
              <div key="a">{tasks.length - doneTasks.length} tasks queued</div>,
              <div key="b">{earned} / {totalPts} pts</div>,
            ]}
          >
            <div className="content">
              <div className="lcd">
                <span>
                  {doneTasks.length === tasks.length && tasks.length > 0
                    ? "ALL CLEAR — NICE"
                    : `NOW PLAYING · ${tasks.length - doneTasks.length} TASKS`}
                </span>
                <span>{String(earned).padStart(3, "0")} PTS</span>
              </div>

              <div className="list">
                {tasks.length === 0 && !addingTask && (
                  <div className="hubEmpty" style={{ color: "#8d8d9c", padding: 14 }}>
                    No tasks yet — hit + NEW below to add your first one.
                  </div>
                )}
                {tasks.map((t) => (
                  <div key={t.id} className={`row ${t.done ? "done" : ""}`}>
                    <div className="cb" onClick={() => toggleTask(t.id)}>{t.done ? "✓" : ""}</div>
                    <div className="name">{t.name}</div>
                    {t.due_at && (
                      <div className={`dueTag ${!t.done && new Date(t.due_at).getTime() < Date.now() ? "over" : ""}`}>
                        {new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                    <div className={`tag ${t.difficulty === 3 ? "hard" : ""}`}>{DIFFICULTY[t.difficulty]}</div>
                    <div className="pts">+{taskPoints(t.difficulty)}</div>
                    <div className="rowDel" onClick={() => deleteTask(t.id)}>×</div>
                  </div>
                ))}
                {addingTask && (
                  <div className="taskAddRow">
                    <input
                      className="taskAddInput" placeholder="New task…" autoFocus
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitNewTask()}
                    />
                    <DueDatePicker value={newTaskDue} onChange={setNewTaskDue} />
                    {newTaskDue && (
                      <div className="taskAddDiff" onClick={cycleFreq}>{FREQ_LABEL[newTaskFreq]}</div>
                    )}
                    <div className="taskAddDiff" onClick={() => setNewTaskDiff((d) => (d === 3 ? 1 : d + 1))}>
                      {DIFFICULTY[newTaskDiff]}
                    </div>
                    <div className="tb" onClick={submitNewTask}>Add</div>
                  </div>
                )}
              </div>

              <div className="transport">
                <div className="tb">|◀</div>
                <div className="tb">▶</div>
                <div className="tb">▶|</div>
                <div className="prog"><i style={{ width: `${pct * 100}%` }} /></div>
                <div className="tb" onClick={() => setAddingTask((a) => !a)}>+ NEW</div>
              </div>
            </div>
          </Win>
        )}

        {/* ---- HABITS (today widget) ---- */}
        {open.habits && (
          <Win
            id="habits" icon="i-mine" title="Habits — This Week"
            className="habitsWin"
            menu={["Game", "Help"]}
            init={{ x: window.innerWidth - 330, y: window.innerHeight - 340, w: 310, h: 270 }}
            z={zMap.habits} focus={focus} onClose={() => close("habits")}
            footer={[<div key="a">{ticked} days ticked · {openDays} still open</div>]}
          >
            <div className="content">
              <div className="msbar">
                <div className="seg">{String(ticked).padStart(3, "0")}</div>
                <div className="smiley">{ticked > 20 ? "😎" : "🙂"}</div>
                <div className="seg">{String(openDays).padStart(3, "0")}</div>
              </div>
              <div className="fieldMs">
                <div className="hdr">
                  <span />
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
                </div>
                {habits.length === 0 && (
                  <div className="hubEmpty" style={{ padding: 8 }}>No habits yet — add one from the Habits icon on the desktop.</div>
                )}
                {habits.map((h, r) => (
                  <div className="hrow" key={h.id}>
                    <div className="hname">{h.name}</div>
                    {h.week.map((v, c) => (
                      <div
                        key={c}
                        className={`cell ${v === true ? "done" : v === false ? "miss" : ""}`}
                        onClick={() => cycleHabit(h.id, c)}
                      >
                        {v === true ? "✔" : v === false ? "✕" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Win>
        )}

        {/* ---- HABITS HUB (digicam) ---- */}
        {open.habitsHub && (
          <Win
            id="habitsHub" icon="i-stats" title="Habits — Streak Cam"
            init={{ x: 150, y: 50, w: 380, h: 480 }}
            z={zMap.habitsHub} focus={focus} onClose={() => close("habitsHub")}
          >
            <div className="content camWrap">
              <ScaleToFit>
                <Digicam habits={habits} onAdd={addHabit} />
              </ScaleToFit>
            </div>
          </Win>
        )}

        {/* ---- TASKS: PROJECT HUB ---- */}
        {open.projectHub && (
          <Win
            id="projectHub" icon="i-space" title="Tasks — Project Hub"
            menu={["File", "Edit", "View", "Image", "Colors", "Help"]}
            init={{ x: 130, y: 40, w: 520, h: 420 }}
            z={zMap.projectHub} focus={focus} onClose={() => close("projectHub")}
          >
            <div className="content">
              <ProjectHub
                folders={folders}
                tasks={projectTasks}
                selected={selectedFolder}
                onSelect={setSelectedFolder}
                onAddFolder={addFolder}
                onDeleteFolder={deleteFolder}
                onSetColor={setFolderColor}
                onAddTask={addProjectTask}
                onToggleTask={toggleProjectTask}
                onDeleteTask={deleteProjectTask}
              />
            </div>
          </Win>
        )}

        {/* ---- JOURNAL ---- */}
        {open.journal && (
          <Win
            id="journal" icon="i-page" title="journal.exe"
            init={{ x: 180, y: 40, w: 300, h: 480 }}
            z={zMap.journal} focus={focus} onClose={() => close("journal")}
          >
            <div className="content">
              <Journal entries={journalEntries} wallet={shown} username={session.user.email.split("@")[0]} onAdd={addJournalEntry} />
            </div>
          </Win>
        )}

        {/* ---- STORE ---- */}
        {open.store && (
          <Win
            id="store" icon="i-store" title="Store — Rewards"
            init={{ x: 160, y: 40, w: 560, h: 470 }}
            z={zMap.store} focus={focus} onClose={() => close("store")}
          >
            <div className="content storeWrap">
              <Store
                items={storeItems}
                orders={orders}
                wallet={wallet}
                reliability={reliability}
                onAdd={addStoreItem}
                onDelete={deleteStoreItem}
                onToggleCart={toggleCart}
                onCheckout={checkout}
              />
            </div>
          </Win>
        )}

        {/* ---- JOURNEY ---- */}
        {open.journey && (
          <Win
            id="journey" icon="i-journey" title="Journey — Your Progress"
            menu={["File", "View", "Help"]}
            init={{ x: 200, y: 60, w: 420, h: 480 }}
            z={zMap.journey} focus={focus} onClose={() => close("journey")}
          >
            <div className="content">
              <Journey stats={stats} unlocked={unlocked} />
            </div>
          </Win>
        )}

        {/* ---- CONTROL PANEL ---- */}
        {open.cpl && (
          <Win
            id="cpl" icon="i-cpl" title="Control Panel — Appearance"
            init={{ x: 220, y: 90, w: 400, h: 340 }}
            z={zMap.cpl} focus={focus} onClose={() => close("cpl")}
          >
            <div className="tabs">
              {["desktop", "windows", "pet", "alerts"].map((t) => (
                <div key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
                  {t[0].toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>

            <div className="pane">
              {tab === "desktop" && (
                <>
                  <fieldset>
                    <legend>Wallpaper colour</legend>
                    <div className="swatches">
                      {WALLPAPERS.map((c, i) => (
                        <div key={c} className={`sw ${theme.wall === i ? "on" : ""}`}
                             style={{ background: c }}
                             onClick={() => setTheme({ ...theme, wall: i })} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Pattern</legend>
                    <div className="swatches">
                      {PATTERNS.map((p, i) => (
                        <div key={i} className={`sw ${theme.pat === i ? "on" : ""}`}
                             style={{ background: p.css, backgroundSize: p.size || "5px 5px",
                                      display: "grid", placeItems: "center", fontSize: 11 }}
                             onClick={() => setTheme({ ...theme, pat: i })}>{p.label}</div>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {tab === "windows" && (
                <>
                  <fieldset>
                    <legend>Title bar &amp; taskbar accent</legend>
                    <div className="swatches">
                      {ACCENTS.map(([a, b], i) => (
                        <div key={i} className={`sw ${theme.accent === i ? "on" : ""}`}
                             style={{ background: `linear-gradient(90deg,${a},${b})` }}
                             onClick={() => setTheme({ ...theme, accent: i })} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Window face</legend>
                    <div className="swatches">
                      {FACES.map((c, i) => (
                        <div key={c} className={`sw ${theme.face === i ? "on" : ""}`}
                             style={{ background: c }}
                             onClick={() => setTheme({ ...theme, face: i })} />
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {tab === "pet" && (
                <>
                  <fieldset>
                    <legend>Shell colour</legend>
                    <div className="swatches">
                      {SHELLS.map((s, i) => (
                        <div key={i} className={`sw ${theme.shell === i ? "on" : ""}`}
                             style={{ background: s.b }}
                             onClick={() => setTheme({ ...theme, shell: i })} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Screen colour</legend>
                    <div className="swatches">
                      {SCREENS.map((s, i) => (
                        <div key={i} className={`sw ${theme.screen === i ? "on" : ""}`}
                             style={{ background: s.s }}
                             onClick={() => setTheme({ ...theme, screen: i })} />
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {tab === "alerts" && (
                <fieldset>
                  <legend>Browser notifications</legend>
                  <div style={{ fontSize: 11, marginBottom: 8 }}>
                    Status:{" "}
                    <b>
                      {notifPermission === "granted" ? "Enabled" :
                       notifPermission === "denied" ? "Blocked — allow in your browser's site settings" :
                       notifPermission === "unsupported" ? "Not supported on this browser" :
                       "Not yet enabled"}
                    </b>
                  </div>
                  {notifPermission !== "granted" && notifPermission !== "unsupported" && (
                    <div className="cbn" onClick={requestNotifPermission} style={{ display: "inline-block" }}>
                      Enable notifications
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#555", marginTop: 10, lineHeight: 1.5 }}>
                    These fire while Fae is open in a tab. Reminders that reach you even with the app fully closed
                    are the next thing being built.
                  </div>
                </fieldset>
              )}
            </div>

            <div className="cpbtns">
              <div className="cbn"
                   onClick={() => setTheme({ wall: 0, pat: 0, accent: 0, face: 0, shell: 0, screen: 0 })}>
                Reset
              </div>
              <div className="cbn" onClick={() => close("cpl")}>OK</div>
            </div>
          </Win>
        )}

        {/* ---- PET ---- */}
        <Tama
          pct={pct}
          displayed={shown}
          floatText={floatText}
          hyped={hyped}
          z={zMap.tama}
          focus={focus}
          onStore={() => openWin("store")}
          onFeed={() => { setHyped(true); setTimeout(() => setHyped(false), 1500); }}
          onTweak={() => openWin("cpl")}
         
        />
      </div>

      {/* ---- START MENU ---- */}
      {startOpen && (
        <div className="startmenu" onClick={(e) => e.stopPropagation()}>
          <div className="spine"><b>Fae</b></div>
          <div className="smitems">
            <div className="profile">
              <div className="avatar" />
              <div>
                <b>{session.user.email.split("@")[0]}</b>
                <small>{shown.toLocaleString()} pts · Level {Math.max(1, Math.floor(shown / 500) + 1)}</small>
              </div>
            </div>
            <div className="smitem" onClick={() => { openWin("habitsHub"); setStartOpen(false); }}>
              <Ico id="i-stats" />Habits
            </div>
            <div className="smitem" onClick={() => { openWin("projectHub"); setStartOpen(false); }}>
              <Ico id="i-space" />Tasks
            </div>
            <div className="smitem" onClick={() => { openWin("store"); setStartOpen(false); }}>
              <Ico id="i-store" />Store
            </div>
            <div className="smitem" onClick={() => { openWin("journal"); setStartOpen(false); }}>
              <Ico id="i-page" />Journal
            </div>
            <div className="smitem" onClick={() => { openWin("journey"); setStartOpen(false); }}>
              <Ico id="i-journey" />Journey
            </div>
            <div className="smsep" />
            <div className="smitem" onClick={() => { openWin("cpl"); setStartOpen(false); }}>
              <Ico id="i-cpl" />Control Panel…
            </div>
            <div className="smitem" onClick={() => supabase.auth.signOut()}><Ico id="i-bin" />Log Off…</div>
          </div>
        </div>
      )}

      {/* ---- ACHIEVEMENT TOAST ---- */}
      {toast && (
        <div className="toast">
          <Ico id="i-trophy" />
          <div><b>Milestone unlocked</b><small>{toast}</small></div>
        </div>
      )}

      {/* ---- TASKBAR ---- */}
      <div className="taskbar">
        <div className={`start ${startOpen ? "on" : ""}`}
             onClick={(e) => { e.stopPropagation(); setStartOpen((s) => !s); }}>
          <Ico id="i-fae" />Start
        </div>
        <div className="vr" />
        <div className="tbtn" onClick={() => openWin("tasks")}><Ico id="i-play" />Today — Task Pl…</div>
        <div className="tbtn" onClick={() => openWin("habits")}><Ico id="i-mine" />Habits</div>
        <div className="tbtn" onClick={() => openWin("store")}><Ico id="i-store" />Store</div>
        <div className="tray">
          <b>{shown.toLocaleString()} pts</b>
          <span>{clock}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- top-level: decides Login vs Desktop ---------- */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="authLoading">Loading Fae…</div>;
  if (!session) return <LoginScreen />;
  return <Desktop session={session} />;
}
