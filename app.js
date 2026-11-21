(() => {
"use strict";
const CATS = {
  "Potholes / Road damage": "Roads & Highways",
  "Garbage / Waste": "Solid Waste Management",
  "Streetlights": "Electricity & Street Lighting",
  "Water problems": "Water Supply Board",
  "Drainage / Sewage": "Drainage & Sewerage",
  "Traffic / Signals": "Traffic & Transport",
  "Parks / Public spaces": "Parks & Horticulture",
  "Other": "General Administration"
};
const DEPTS = [...new Set(Object.values(CATS))];
const PRI = ["Low", "Medium", "High"];
const STATUS = ["Submitted", "Under Review", "In Progress", "Resolved"];
const VIEWS = ["report", "track", "admin", "about"];
const KEY = "urbandebug.reports", PASS = "admin123";
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const opts = (arr, sel) => arr.map((o) => `<option${o === sel ? " selected" : ""}>${esc(o)}</option>`).join("");
const PIN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;

// ---------- Data (saved in this browser's localStorage) ----------
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(d) ? d.filter((i) => i && typeof i === "object" && i.id) : [];
  }
  catch (e) { return []; }
}
let issues = load();
let current = "report", adminSort = "latest", gps = null, toastTimer;

// Verified location selection state
let selectedCityData = null; // { name, lat, lng }
let selectedAreaData = null; // { name, lat, lng }

function toast(msg, type) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show " + (type || "ok");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = "toast"; }, 4200);
}

function save() {
  try { 
    localStorage.setItem(KEY, JSON.stringify(issues)); 
  } catch (e) {
    issues.forEach((i) => { i.img = ""; });
    try { 
      localStorage.setItem(KEY, JSON.stringify(issues)); 
      toast("Browser storage was full, so photos were removed to keep your reports.", "error"); 
    } catch (e2) { 
      toast("Could not save to browser storage. Reports will be lost on refresh.", "error"); 
    }
  }
  issues = load();
  summary();
  refreshView();
}

function newId() {
  let id;
  do { id = "UD-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + (Math.random().toString(36) + "0000").slice(2, 6).toUpperCase(); }
  while (issues.some((i) => i.id === id));
  return id;
}
const made = (i) => i.created || (i.history && i.history[0] && i.history[0].t) || 0;
const fmt = (t) => t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Unknown date";

function summary() {
  issues = load();
  const c = (s) => issues.filter((i) => i.status === s).length;
  const sub = c("Submitted"), rev = c("Under Review"), prog = c("In Progress"), res = c("Resolved");
  $("#s-total").textContent = issues.length;
  $("#s-pend").textContent = sub + rev;
  $("#s-pend-sub").textContent = sub + " submitted, " + rev + " under review";
  $("#s-prog").textContent = prog;
  $("#s-prog-sub").textContent = prog ? "Being worked on" : "Nothing in progress";
  $("#s-res").textContent = res;
  $("#s-res-sub").textContent = issues.length ? Math.round((res / issues.length) * 100) + "% of all reports" : "No reports yet";
}

// ---------- Nominatim Geocoding Integration ----------
async function searchNominatim(query, type) {
  if (!query || query.length < 2) return [];
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    if (type === "city") {
      url += `&featureType=city&addressdetails=1`;
    }
    const res = await fetch(url, { headers: { "User-Agent": "UrbanDebugHackathon/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      name: item.display_name,
      shortName: item.name || item.display_name.split(",")[0],
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  } catch (e) {
    return [];
  }
}

// Setup City Autocomplete
const cityInput = $("#city");
const citySug = $("#city-sug");
let cityTimer = null;

cityInput.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  selectedCityData = null;
  cityInput.classList.remove("loc-verified");
  clearTimeout(cityTimer);
  if (val.length < 2) {
    citySug.hidden = true;
    citySug.innerHTML = "";
    return;
  }
  cityTimer = setTimeout(async () => {
    const results = await searchNominatim(val, "city");
    if (results.length === 0) {
      citySug.innerHTML = `<div class="sug-item muted">No verified locations found</div>`;
      citySug.hidden = false;
      return;
    }
    citySug.innerHTML = results.map(r => `<div class="sug-item" data-name="${esc(r.shortName)}" data-lat="${r.lat}" data-lng="${r.lng}">${esc(r.name)}</div>`).join("");
    citySug.hidden = false;
  }, 300);
});

citySug.addEventListener("click", (e) => {
  const item = e.target.closest(".sug-item");
  if (!item || !item.dataset.name) return;
  cityInput.value = item.dataset.name;
  selectedCityData = {
    name: item.dataset.name,
    lat: parseFloat(item.dataset.lat),
    lng: parseFloat(item.dataset.lng)
  };
  cityInput.classList.add("loc-verified");
  citySug.hidden = true;
  $("#e-city").textContent = "";
  cityInput.setAttribute("aria-invalid", "false");
});

// Setup Area Autocomplete
const areaInput = $("#area");
const areaSug = $("#area-sug");
let areaTimer = null;

areaInput.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  selectedAreaData = null;
  areaInput.classList.remove("loc-verified");
  clearTimeout(areaTimer);
  if (val.length < 2) {
    areaSug.hidden = true;
    areaSug.innerHTML = "";
    return;
  }
  areaTimer = setTimeout(async () => {
    let query = val;
    if (selectedCityData && selectedCityData.name) {
      query += ", " + selectedCityData.name;
    }
    const results = await searchNominatim(query, "street");
    if (results.length === 0) {
      areaSug.innerHTML = `<div class="sug-item muted">No verified streets found</div>`;
      areaSug.hidden = false;
      return;
    }
    areaSug.innerHTML = results.map(r => `<div class="sug-item" data-name="${esc(r.name || r.shortName)}" data-lat="${r.lat}" data-lng="${r.lng}">${esc(r.name)}</div>`).join("");
    areaSug.hidden = false;
  }, 300);
});

areaSug.addEventListener("click", (e) => {
  const item = e.target.closest(".sug-item");
  if (!item || !item.dataset.name) return;
  areaInput.value = item.dataset.name;
  selectedAreaData = {
    name: item.dataset.name,
    lat: parseFloat(item.dataset.lat),
    lng: parseFloat(item.dataset.lng)
  };
  areaInput.classList.add("loc-verified");
  areaSug.hidden = true;
  $("#e-area").textContent = "";
  areaInput.setAttribute("aria-invalid", "false");
});

// Close suggestions on outside click
document.addEventListener("click", (e) => {
  if (!cityInput.contains(e.target) && !citySug.contains(e.target)) citySug.hidden = true;
  if (!areaInput.contains(e.target) && !areaSug.contains(e.target)) areaSug.hidden = true;
});

// ---------- AI triage ----------
async function askGemini(body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error("AI service unavailable");
    const ai = await r.json();
    if (!CATS[ai.category] || !PRI.includes(ai.priority) || !ai.reason) throw new Error("Bad AI response");
    if (!DEPTS.includes(ai.department)) ai.department = CATS[ai.category];
    ai.summary = ai.summary || body.title;
    return ai;
  } finally { clearTimeout(timer); }
}

const WORDS = {
  "Potholes / Road damage": /pothole|road|crack|asphalt|bridge|pavement|footpath/g,
  "Garbage / Waste": /garbage|trash|waste|bin|dump|litter|smell/g,
  "Streetlights": /street ?light|lamp|dark|wire|pole|electric|power/g,
  "Water problems": /water|leak|pipe|tap|supply/g,
  "Drainage / Sewage": /drain|sewage|sewer|manhole|overflow|flood|clog/g,
  "Traffic / Signals": /traffic|signal|junction|parking|zebra/g,
  "Parks / Public spaces": /park|garden|tree|playground|bench/g
};
function localTriage(b) {
  const s = (b.title + " " + b.desc).toLowerCase();
  let category = "Other", top = 0;
  for (const [c, re] of Object.entries(WORDS)) {
    const n = (s.match(re) || []).length;
    if (n > top) { top = n; category = c; }
  }
  const hi = s.match(/live wire|electrocut|open manhole|collapse|fire|injur|accident|danger|flood|school|hospital|burst|children|blocked/);
  const md = s.match(/leak|broken|damaged|not working|smell|overflow|for days|week/);
  const priority = hi ? "High" : md ? "Medium" : "Low";
  const reason = hi ? `The report mentions "${hi[0]}", which suggests a safety risk or wide public impact.`
    : md ? `The report mentions "${md[0]}", which suggests a real inconvenience but not an immediate danger.`
    : "No urgent or safety-related keywords were found, so it is treated as a minor issue.";
  return { category, priority, department: CATS[category], summary: b.title + " (" + b.area + ", " + b.city + ").", reason };
}

function shrink(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve("");
    img.src = URL.createObjectURL(file);
  });
}

// ---------- Rendering ----------
const prio = (p) => `<span class="pill p-${esc(p)}"><span class="sig" aria-hidden="true">${[0, 1, 2].map((n) => `<i${n <= PRI.indexOf(p) ? ' class="on"' : ""}></i>`).join("")}</span>${esc(p)} priority</span>`;
const badge = (s) => `<span class="badge s-${esc(s).replace(/ /g, "")}">${esc(s)}</span>`;

function card(i, admin, full) {
  const idx = STATUS.indexOf(i.status);
  const ctl = admin ? `<div class="ctl" data-id="${esc(i.id)}">
      <label>Status<select data-f="status">${opts(STATUS, i.status)}</select></label>
      <label>Priority<select data-f="priority">${opts(PRI, i.priority)}</select></label>
      <label>Department<select data-f="dept">${opts(DEPTS, i.dept)}</select></label>
      <button type="button" class="ghost danger" data-del="${esc(i.id)}">Delete report</button></div>` : "";
  const photo = i.img && String(i.img).startsWith("data:image/") ? `<img src="${i.img}" alt="Photo of the reported issue">` : "";
  const landmarkStr = i.landmark ? ` • Landmark: ${esc(i.landmark)}` : "";
  const coordsStr = (i.lat && i.lng) ? ` <em class="tag">Lat: ${i.lat}, Lng: ${i.lng}</em>` : "";
  return `<article class="issue p-${esc(i.priority)}">
    <div class="rowb"><span class="id">${esc(i.id)}</span><div class="badges">${prio(i.priority)}${badge(i.status)}</div></div>
    <h3>${esc(i.title)}</h3>
    <p class="desc${full ? " full" : ""}">${esc(i.desc || i.summary)}</p>
    ${photo}
    <div class="meta">
      <span class="loc">${PIN}${esc(i.area || "Area not given")}, ${esc(i.city || "City not given")}${landmarkStr}${i.gps ? ' <em class="tag">GPS attached</em>' : coordsStr}</span>
      <span>Reported ${esc(fmt(made(i)))}</span>
      <span><b class="tag">${esc(i.category)}</b><b class="tag">${esc(i.dept)}</b>${i.source === "Sample data" ? '<b class="tag sm">Sample</b>' : ""}</span>
    </div>
    ${i.reason ? `<p class="why"><b>Why ${esc(i.priority)} priority:</b> ${esc(i.reason)} <em>(${esc(i.source)})</em></p>` : ""}
    <ol class="line">${STATUS.map((s, n) => `<li class="${n < idx ? "done" : n === idx ? "now" : ""}">${s}</li>`).join("")}</ol>
    ${ctl}</article>`;
}

const newest = (a, b) => made(b) - made(a);

function renderTrack() {
  issues = load();
  const f = $("#fstatus").value;
  const list = issues.filter((i) => f === "All" || i.status === f).sort(newest);
  $("#tlist").innerHTML = list.length ? list.map((i) => card(i, false)).join("")
    : `<p class="empty">${issues.length ? "No reports have this status." : "No reports on this device yet. Submit one from Report issue and it will appear here."}</p>`;
}

function renderAdmin() {
  issues = load();
  const el = $("#admin");
  if (sessionStorage.getItem("ud-admin") !== "1") {
    el.innerHTML = `<form class="panel gate" id="gate"><h2>Admin sign in</h2>
      <label>Passcode<input id="pass" type="password" autocomplete="off"></label>
      <button class="primary">Sign in</button>
      <p class="muted" id="gerr">Demo passcode: ${PASS}</p></form>`;
    return;
  }
  const list = [...issues].sort(adminSort === "priority" ? (a, b) => PRI.indexOf(b.priority) - PRI.indexOf(a.priority) || newest(a, b) : newest);
  el.innerHTML = `<div class="head"><div><h2>Admin dashboard</h2><p class="muted">Review reports and update their status. Changes save instantly.</p></div>
    <div class="tools">
      <select id="asort" aria-label="Sort reports"><option value="latest"${adminSort === "latest" ? " selected" : ""}>Latest first</option><option value="priority"${adminSort === "priority" ? " selected" : ""}>Highest priority first</option></select>
      <button type="button" class="ghost" id="sample">Load sample reports</button>
      <button type="button" class="ghost danger" id="clear">Clear all</button>
      <button type="button" class="ghost" id="out">Sign out</button></div></div>
    <div class="grid">${list.length ? list.map((i) => card(i, true)).join("") : `<p class="empty">No reports yet. Reports submitted by citizens appear here, newest first. Use "Load sample reports" to preview the dashboard.</p>`}</div>`;
}

function refreshView() {
  summary();
  if (current === "track") renderTrack();
  if (current === "admin") renderAdmin();
}

function show(v) {
  if (!VIEWS.includes(v)) v = "report";
  current = v;
  document.querySelectorAll(".view").forEach((x) => { x.hidden = x.id !== v; });
  document.querySelectorAll("nav button").forEach((b) => {
    const on = b.dataset.v === v;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  try { history.replaceState(null, "", "#" + v); } catch (e) {}
  refreshView();
}

function showTriage(i) {
  const differs = i.aiCategory && i.aiCategory !== i.category;
  $("#triage").innerHTML = `<div class="ok-box" role="status"><b>Report submitted successfully</b>
      <span class="muted">Your report ID. Save it to track your complaint:</span>
      <div class="idrow"><code class="rid">${esc(i.id)}</code><button type="button" class="ghost" data-copy="${esc(i.id)}">Copy ID</button></div>
      <button type="button" class="primary" data-track="${esc(i.id)}">Track this report</button></div>
    <div class="res-top"><h2>AI triage</h2>${prio(i.priority)}</div>
    <dl><dt>Suggested category</dt><dd>${esc(i.aiCategory || i.category)}</dd>
    ${differs ? `<dt>You chose</dt><dd>${esc(i.category)}</dd>` : ""}
    <dt>Department</dt><dd>${esc(i.dept)}</dd></dl>
    <p class="why-box"><b>Why ${esc(i.priority)} priority:</b> ${esc(i.reason)}</p>
    <p class="muted">${esc(i.summary)}</p>
    <span class="src${i.source === "Google Gemini" ? "" : " fb"}">${i.source === "Google Gemini" ? "Analysed by Google Gemini" : "Rule-based analysis (not AI). Gemini is not connected or unavailable."}</span>`;
}

// ---------- Form ----------
const FIELDS = {
  title: { min: 5, msg: "Enter a short title (at least 5 characters)." },
  desc: { min: 15, msg: "Describe the problem in at least 15 characters." },
  cat: { msg: "Choose a category, or pick “Not sure, let AI suggest”." },
  city: { min: 2, msg: "Select a verified city from suggestions." },
  area: { min: 3, msg: "Select a verified street/area from suggestions." }
};
function validate() {
  let first = null;
  
  // Validate standard text fields
  for (const [k, f] of Object.entries(FIELDS)) {
    const el = $("#" + k);
    let bad = false;
    if (k === "city") {
      bad = !selectedCityData || !el.value.trim();
    } else if (k === "area") {
      bad = !selectedAreaData || !el.value.trim();
    } else {
      const v = el.value.trim();
      bad = !v || (f.min && v.length < f.min);
    }
    $("#e-" + k).textContent = bad ? f.msg : "";
    el.setAttribute("aria-invalid", String(bad));
    if (bad && !first) first = el;
  }
  
  if (first) { first.focus(); toast("Please select verified location suggestions.", "error"); return false; }
  return true;
}
function gpsUI() {
  const b = $("#gps");
  b.textContent = gps ? "Approximate GPS attached. Click to remove" : "Add approximate GPS (optional)";
  b.classList.toggle("on", !!gps);
}

$("#cat").innerHTML = `<option value="">Select a category</option><option value="auto">Not sure, let AI suggest</option>` + opts(Object.keys(CATS));
$("#fstatus").innerHTML = opts(["All", ...STATUS]);

$("#form").addEventListener("input", (e) => {
  if (FIELDS[e.target.id]) { $("#e-" + e.target.id).textContent = ""; e.target.setAttribute("aria-invalid", "false"); }
});

$("#gps").addEventListener("click", () => {
  if (gps) { gps = null; gpsUI(); return; }
  if (!navigator.geolocation) { toast("GPS is not available on this device. You can continue without it.", "error"); return; }
  const b = $("#gps"); b.disabled = true; b.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    (p) => { 
      gps = { lat: +p.coords.latitude.toFixed(3), lng: +p.coords.longitude.toFixed(3) }; 
      b.disabled = false; 
      gpsUI(); 
      toast("GPS coordinates attached successfully.", "ok");
    },
    () => { b.disabled = false; gpsUI(); toast("Could not get GPS. You can continue without it.", "error"); },
    { timeout: 10000 });
});

$("#img").addEventListener("change", (e) => {
  const f = e.target.files[0], p = $("#prev");
  if (f) { p.src = URL.createObjectURL(f); p.hidden = false; } else p.hidden = true;
});

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;
  const btn = $("#go");
  btn.disabled = true; btn.textContent = "Submitting…";
  $("#triage").innerHTML = `<h2>AI triage</h2><div class="spin" role="status" aria-label="Analysing"></div><p class="muted">Analysing your report…</p>`;
  try {
    const f = $("#img").files[0], sel = $("#cat").value;
    const body = { 
      title: $("#title").value.trim(), 
      desc: $("#desc").value.trim(), 
      city: selectedCityData ? selectedCityData.name : $("#city").value.trim(),
      area: selectedAreaData ? selectedAreaData.name : $("#area").value.trim(), 
      cat: sel === "auto" ? "" : sel, 
      image: f ? await shrink(f) : "" 
    };
    let ai, source = "Google Gemini";
    try { ai = await askGemini(body); } catch (err) { ai = localTriage(body); source = "Rule-based analysis"; }
    
    issues = load();
    const issue = { 
      id: newId(), 
      title: body.title, 
      desc: body.desc, 
      city: body.city, 
      area: body.area, 
      landmark: $("#landmark").value.trim(),
      lat: selectedAreaData ? selectedAreaData.lat : (selectedCityData ? selectedCityData.lat : null),
      lng: selectedAreaData ? selectedAreaData.lng : (selectedCityData ? selectedCityData.lng : null),
      gps,
      category: body.cat || ai.category, 
      aiCategory: ai.category, 
      priority: ai.priority,
      dept: body.cat ? CATS[body.cat] : ai.department, 
      summary: ai.summary, 
      reason: ai.reason, 
      source,
      img: body.image, 
      status: "Submitted", 
      created: Date.now(), 
      history: [{ s: "Submitted", t: Date.now() }] 
    };
    
    if (!issues.some((x) => x.id === issue.id)) {
      issues.unshift(issue);
      save();
    }
    showTriage(issue);
    toast("Report submitted. Your ID is " + issue.id, "ok");
    e.target.reset(); 
    $("#prev").hidden = true; 
    gps = null; 
    selectedCityData = null;
    selectedAreaData = null;
    $("#city").classList.remove("loc-verified");
    $("#area").classList.remove("loc-verified");
    gpsUI();
  } catch (err) {
    $("#triage").innerHTML = `<h2>AI triage</h2><p class="note bad">Something went wrong while submitting. Please try again.</p>`;
    toast("Could not submit the report. Please try again.", "error");
  } finally { btn.disabled = false; btn.textContent = "Submit report"; }
});

$("#triage").addEventListener("click", (e) => {
  const c = e.target.dataset.copy, t = e.target.dataset.track;
  if (c) {
    (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(
      () => toast("Report ID copied.", "ok"), () => toast("Copy failed. Please select the ID and copy it manually.", "error"));
  }
  if (t) { show("track"); $("#rid").value = t; $("#lookup").requestSubmit(); }
});

// ---------- Track ----------
$("#lookup").addEventListener("submit", (e) => {
  e.preventDefault();
  const rawId = $("#rid").value;
  const searchId = rawId ? rawId.trim().toUpperCase().replace(/\s+/g, "") : "";
  const out = $("#lres");
  
  if (!searchId) { out.innerHTML = `<p class="note bad">Enter a report ID to search.</p>`; return; }
  
  issues = load();
  summary();

  const i = issues.find((x) => x && x.id && x.id.trim().toUpperCase().replace(/\s+/g, "") === searchId);
  out.innerHTML = i ? card(i, false, true)
    : `<p class="note bad">No report found with ID <b>${esc(rawId)}</b>. Check the ID and try again. In this prototype, reports are stored in the browser where they were submitted.</p>`;
});
$("#fstatus").addEventListener("change", renderTrack);

// ---------- Admin ----------
function loadSamples() {
  issues = load();
  const d = 864e5, n = Date.now();
  [["Streetlights dead on school lane", "Four streetlights on the lane beside the primary school have been off for a week. Children walk home in the dark.", "New York, NY, United States", "School Lane, Manhattan, NY", "Streetlights", "High", "The report mentions children and a week-long outage, a safety risk.", "In Progress", 4, "Near Public School 12"],
   ["Garbage bins overflowing", "The bins near the park gate overflow every morning and attract stray animals.", "London, Greater London, United Kingdom", "Central Park East Gate, London", "Garbage / Waste", "Medium", "Regular overflow is an inconvenience and a hygiene concern.", "Under Review", 2, "Main Park Entrance"],
   ["Faded zebra crossing", "The zebra crossing outside the market is almost invisible.", "Paris, Île-de-France, France", "Market Road, Paris", "Traffic / Signals", "Low", "A cosmetic issue with no immediate danger.", "Resolved", 9, "Central Market Square"]
  ].forEach((a) => issues.unshift({ id: newId(), title: a[0], desc: a[1], city: a[2], area: a[3], landmark: a[9], lat: 40.7128, lng: -74.0060, gps: null, category: a[4], aiCategory: a[4],
    priority: a[5], dept: CATS[a[4]], summary: a[0], reason: a[6], source: "Sample data", img: "", status: a[7],
    created: n - a[8] * d, history: [{ s: "Submitted", t: n - a[8] * d }] }));
  save(); renderAdmin(); toast("Sample reports added. They are labelled Sample.", "ok");
}

$("#admin").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("#pass").value === PASS) { sessionStorage.setItem("ud-admin", "1"); renderAdmin(); }
  else $("#gerr").textContent = "Wrong passcode. Try again.";
});

$("#admin").addEventListener("click", (e) => {
  const id = e.target.id;
  if (id === "out") { sessionStorage.removeItem("ud-admin"); renderAdmin(); }
  if (id === "sample") loadSamples();
  if (id === "clear" && confirm("Delete ALL reports stored in this browser?")) {
    issues = [];
    save();
    toast("All reports cleared.", "ok");
  }
  if (e.target.dataset.del && confirm("Delete this report?")) {
    const targetId = e.target.dataset.del.trim();
    issues = load();
    issues = issues.filter((i) => i && i.id && i.id.trim() !== targetId);
    save();
    toast("Report deleted.", "ok");
  }
});

$("#admin").addEventListener("change", (e) => {
  if (e.target.id === "asort") { adminSort = e.target.value; renderAdmin(); return; }
  const f = e.target.dataset.f, box = e.target.closest("[data-id]");
  issues = load();
  const i = box && issues.find((x) => x.id === box.dataset.id);
  if (!i || !f) return;
  i[f] = e.target.value;
  if (f === "status") (i.history = i.history || []).push({ s: i.status, t: Date.now() });
  save();
  toast(f === "status" ? "Status updated to " + i.status + "." : "Report updated.", "ok");
});

// ---------- Navigation and start ----------
document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => { show(b.dataset.v); window.scrollTo({ top: 0, behavior: "smooth" }); }));
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  issues = load(); summary(); refreshView();
});
gpsUI(); summary(); show(location.hash.slice(1));
})();