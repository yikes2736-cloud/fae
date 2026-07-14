import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

/* ============================================================
   FAE — retro desktop productivity app
   ============================================================ */

const START_BALANCE = 1240;

const INITIAL_TASKS = [
  { id: 1, name: "Finish EMT2 past paper",        difficulty: 3, done: false },
  { id: 2, name: "Draft networking viva answers", difficulty: 2, done: false },
  { id: 3, name: "Email lab report to group",     difficulty: 1, done: false },
  { id: 4, name: "Debug C linked-list module",    difficulty: 2, done: false },
  { id: 5, name: "Guitar practice — 20 min",      difficulty: 1, done: false },
];

const HABIT_NAMES = ["Read 20pg", "Gym", "No doomscroll", "Leetcode ×1", "Sleep by 12"];

// null = not logged, true = done, false = missed. First 4 days are seeded history.
const INITIAL_HABITS = [
  [true,  true,  true,  false, null, null, null],
  [true,  false, true,  true,  null, null, null],
  [true,  true,  false, true,  null, null, null],
  [false, true,  true,  false, null, null, null],
  [true,  true,  true,  true,  null, null, null],
];

// Points: tasks = 10 × difficulty, habits = flat 5
const taskPoints = (d) => 10 * d;
const HABIT_POINTS = 5;
const DIFFICULTY = { 1: "EASY ×1", 2: "MED ×2", 3: "HARD ×3" };

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
  </svg>
);
const Ico = ({ id }) => <svg><use href={`#${id}`} /></svg>;

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
    e.currentTarget.setPointerCapture?.(e.pointerId);

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
function Tama({ pct, displayed, floatText, hyped, onStore, onFeed, onStats, z, focus }) {
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
        <div className="pad" onClick={onStats}>STATS</div>
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

/* ============================================================ */
export default function App() {
  const [tasks, setTasks]   = useState(INITIAL_TASKS);
  const [habits, setHabits] = useState(INITIAL_HABITS);
  const [wallet, setWallet] = useState(START_BALANCE);
  const [shown, setShown]   = useState(START_BALANCE);   // animated counter
  const [floatText, setFloat] = useState(null);
  const [hyped, setHyped]   = useState(false);

  const [open, setOpen]     = useState({ tasks: true, habits: true, cpl: false });
  const [zTop, setZTop]     = useState(10);
  const [zMap, setZMap]     = useState({ tasks: 3, habits: 2, tama: 5, cpl: 9 });
  const [startOpen, setStartOpen] = useState(false);
  const [tab, setTab]       = useState("desktop");
  const [theme, setTheme]   = useState({ wall: 0, pat: 0, accent: 0, face: 0, shell: 0, screen: 0 });
  const [clock, setClock]   = useState("");

  const focus = useCallback((id) => {
    setZTop((t) => {
      const next = t + 1;
      setZMap((m) => ({ ...m, [id]: next }));
      return next;
    });
  }, []);

  /* animated point counter */
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

  /* clock */
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* apply theme to CSS variables */
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

  /* earning / spending */
  const award = (n) => {
    setWallet((w) => w + n);
    setFloat({ text: (n > 0 ? "+" : "") + n, key: Date.now() });
    setHyped(true);
    setTimeout(() => setHyped(false), 1500);
  };

  const toggleTask = (id) => {
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        award(done ? taskPoints(t.difficulty) : -taskPoints(t.difficulty));
        return { ...t, done };
      })
    );
  };

  const cycleHabit = (r, c) => {
    setHabits((hs) =>
      hs.map((row, i) => {
        if (i !== r) return row;
        return row.map((v, j) => {
          if (j !== c) return v;
          if (v === null)  { award(HABIT_POINTS);  return true;  }  // blank → done
          if (v === true)  { award(-HABIT_POINTS); return false; }  // done → missed
          return null;                                              // missed → blank
        });
      })
    );
  };

  /* derived */
  const doneTasks = tasks.filter((t) => t.done);
  const earned    = doneTasks.reduce((s, t) => s + taskPoints(t.difficulty), 0);
  const totalPts  = tasks.reduce((s, t) => s + taskPoints(t.difficulty), 0);
  const pct       = tasks.length ? doneTasks.length / tasks.length : 0;
  const ticked    = habits.flat().filter((v) => v === true).length;
  const openDays  = habits.flat().filter((v) => v === null).length;

  const close = (k) => setOpen((o) => ({ ...o, [k]: false }));
  const openWin = (k) => { setOpen((o) => ({ ...o, [k]: true })); focus(k); };

  return (
    <div className="fae" onClick={() => setStartOpen(false)}>
      <Icons />

      <div className="desktop">
        {/* ---- icons ---- */}
        <div className="dock">
          <div className="icon"><Ico id="i-space" /><span>Spaces</span></div>
          <div className="icon"><Ico id="i-page" /><span>Pages</span></div>
          <div className="icon"><Ico id="i-store" /><span>Store</span></div>
          <div className="icon"><Ico id="i-stats" /><span>Stats</span></div>
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
                {tasks.map((t) => (
                  <div key={t.id} className={`row ${t.done ? "done" : ""}`}>
                    <div className="cb" onClick={() => toggleTask(t.id)}>{t.done ? "✓" : ""}</div>
                    <div className="name">{t.name}</div>
                    <div className={`tag ${t.difficulty === 3 ? "hard" : ""}`}>{DIFFICULTY[t.difficulty]}</div>
                    <div className="pts">+{taskPoints(t.difficulty)}</div>
                  </div>
                ))}
              </div>

              <div className="transport">
                <div className="tb">|◀</div>
                <div className="tb">▶</div>
                <div className="tb">▶|</div>
                <div className="prog"><i style={{ width: `${pct * 100}%` }} /></div>
                <div className="tb">+ NEW</div>
              </div>
            </div>
          </Win>
        )}

        {/* ---- HABITS ---- */}
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
                {habits.map((row, r) => (
                  <div className="hrow" key={r}>
                    <div className="hname">{HABIT_NAMES[r]}</div>
                    {row.map((v, c) => (
                      <div
                        key={c}
                        className={`cell ${v === true ? "done" : v === false ? "miss" : ""}`}
                        onClick={() => cycleHabit(r, c)}
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

        {/* ---- CONTROL PANEL ---- */}
        {open.cpl && (
          <Win
            id="cpl" icon="i-cpl" title="Control Panel — Appearance"
            init={{ x: 220, y: 90, w: 400, h: 340 }}
            z={zMap.cpl} focus={focus} onClose={() => close("cpl")}
          >
            <div className="tabs">
              {["desktop", "windows", "pet"].map((t) => (
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
          onStore={() => setFloat({ text: "STORE", key: Date.now() })}
          onFeed={() => { setHyped(true); setTimeout(() => setHyped(false), 1500); }}
          onStats={() => openWin("cpl")}
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
                <b>Diva</b>
                <small>{shown.toLocaleString()} pts · Level 4</small>
              </div>
            </div>
            <div className="smitem"><Ico id="i-space" />Spaces</div>
            <div className="smitem"><Ico id="i-page" />New Page</div>
            <div className="smitem"><Ico id="i-store" />Store</div>
            <div className="smitem" onClick={() => { openWin("tasks"); setStartOpen(false); }}>
              <Ico id="i-play" />Task Player
            </div>
            <div className="smitem" onClick={() => { openWin("habits"); setStartOpen(false); }}>
              <Ico id="i-mine" />Habits
            </div>
            <div className="smsep" />
            <div className="smitem" onClick={() => { openWin("cpl"); setStartOpen(false); }}>
              <Ico id="i-cpl" />Control Panel…
            </div>
            <div className="smitem"><Ico id="i-bin" />Log Off…</div>
          </div>
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
        <div className="tray">
          <b>{shown.toLocaleString()} pts</b>
          <span>{clock}</span>
        </div>
      </div>
    </div>
  );
}
