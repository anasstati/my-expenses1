// ============================================
// CONFIG
// ============================================
const STORAGE_KEY = "my_expenses_v4";
const SETTINGS_KEY = "my_expenses_settings_v4";

const CATEGORIES = [
  { id: "طعام", icon: "🍔" }, { id: "مواصلات", icon: "🚗" },
  { id: "تسوق", icon: "🛍️" }, { id: "فواتير", icon: "📄" },
  { id: "ترفيه", icon: "🎮" }, { id: "صحة", icon: "💊" },
  { id: "تعليم", icon: "📚" }, { id: "حلاقة", icon: "✂️" },
  { id: "إنترنت", icon: "📶" }, { id: "خط", icon: "📱" },
  { id: "أخرى", icon: "📦" }
];
const SOURCES = [
  { id: "باقي الشهر السابق", icon: "💰" }, { id: "راتب", icon: "💼" },
  { id: "عيديات", icon: "🎁" }, { id: "هدية", icon: "🎀" },
  { id: "عمل إضافي", icon: "⏰" }, { id: "استرداد", icon: "↩️" },
  { id: "أخرى", icon: "📦" }
];

// ============================================
// STATE
// ============================================
let data = { months: {} };
let settings = { currency: "د.أ" };
let currentMonth = "";
let currentView = "home";
let charts = {};
let deferredPrompt = null;
let waStyle = "simple";
let waLastText = "";
let qaType = "expense";

// ============================================
// HELPERS
// ============================================
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toFixed(2);
const cur = () => settings.currency;
const uid = () => Date.now().toString() + Math.random().toString(36).slice(2,7);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${names[parseInt(m)-1]} ${y}`;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function getIcon(id) {
  return (CATEGORIES.find(c => c.id === id) || SOURCES.find(s => s.id === id) || {}).icon || "📌";
}

// ============================================
// STORAGE
// ============================================
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : { months: {} };
    if (!data.months) data.months = {};
  } catch (e) { data = { months: {} }; }
  try {
    const rs = localStorage.getItem(SETTINGS_KEY);
    settings = rs ? JSON.parse(rs) : { currency: "د.أ" };
  } catch (e) { settings = { currency: "د.أ" }; }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

function ensureMonth(ym) {
  if (!data.months[ym]) data.months[ym] = { income: [], expenses: [] };
  return data.months[ym];
}
function monthStats(ym) {
  const m = ensureMonth(ym);
  const income = m.income.reduce((s, i) => s + Number(i.amount || 0), 0);
  const exp = m.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  return { income, exp, balance: income - exp, count: m.income.length + m.expenses.length };
}
function totalAll() {
  let income = 0, exp = 0;
  Object.keys(data.months).forEach(ym => {
    const s = monthStats(ym);
    income += s.income; exp += s.exp;
  });
  return { income, exp, balance: income - exp };
}

// ============================================
// TOAST
// ============================================
let toastTimer = null;
function toast(msg, type = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast" + (type ? " " + type : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

// ============================================
// ROUTER (Home <-> Month)
// ============================================
function showView(name) {
  currentView = name;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view" + (name === "home" ? "Home" : "Month")));
  window.scrollTo(0, 0);
  if (name === "home") renderHome();
  if (name === "month") renderMonth();
}

// ============================================
// HOME RENDER
// ============================================
function renderHome() {
  // Total
  const t = totalAll();
  $("allBalance").innerHTML = `${fmt(t.balance)} <span class="cur">${cur()}</span>`;
  $("allIncome").textContent = fmt(t.income) + " " + cur();
  $("allExpense").textContent = fmt(t.exp) + " " + cur();

  // Months grid
  const months = Object.keys(data.months).sort().reverse();
  $("monthCount").textContent = `${months.length} شهر`;

  const grid = $("monthsGrid");
  const empty = $("emptyMonths");
  if (months.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = months.map(ym => {
    const s = monthStats(ym);
    const [y, m] = ym.split("-");
    const balClass = s.balance >= 0 ? "positive" : "negative";
    return `
      <div class="month-card" data-ym="${ym}">
        <div class="month-card-name">${monthLabel(ym)}</div>
        <div class="month-card-year">${y} • ${m.expenses.length} مصروف</div>
        <div class="month-card-balance ${balClass}">${fmt(s.balance)} ${cur()}</div>
        <div class="month-card-meta">
          <div>
            دخول
            <strong>${fmt(s.income)}</strong>
          </div>
          <div>
            صرف
            <strong>${fmt(s.exp)}</strong>
          </div>
          <div>
            عمليات
            <strong>${s.count}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Click handlers
  grid.querySelectorAll(".month-card").forEach(card => {
    card.addEventListener("click", () => {
      currentMonth = card.dataset.ym;
      showView("month");
    });
  });
}

// ============================================
// MONTH RENDER
// ============================================
function renderMonth() {
  $("mTitle").textContent = monthLabel(currentMonth);
  const s = monthStats(currentMonth);
  const m = ensureMonth(currentMonth);
  $("mSub").textContent = `${m.expenses.length} مصروف • ${m.income.length} مدخول`;

  $("mIncome").textContent = fmt(s.income);
  $("mExpense").textContent = fmt(s.exp);
  $("mBalance").textContent = fmt(s.balance);
  $("mBalanceCard").classList.toggle("negative", s.balance < 0);
  $("mBalanceCard").classList.toggle("positive", s.balance > 0);

  ["mCur1","mCur2","mCur3"].forEach(id => $(id).textContent = cur());
  $("mExpBadge").textContent = m.expenses.length;
  $("mIncBadge").textContent = m.income.length;

  renderMonthExpenses();
  renderMonthIncome();
  if (document.querySelector('.m-tab.active')?.dataset.mtab === "analysis") {
    renderAnalysis();
  }
}

function renderMonthExpenses() {
  const m = ensureMonth(currentMonth);
  const search = $("mSearch").value.trim().toLowerCase();
  const filterCat = $("mFilterCat").value;

  // Build filter
  const allCats = Array.from(new Set(m.expenses.map(e => e.category))).sort();
  const cur = $("mFilterCat").value;
  $("mFilterCat").innerHTML = '<option value="all">كل الفئات</option>' +
    allCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if ([...$("mFilterCat").options].some(o => o.value === cur)) $("mFilterCat").value = cur;

  const filtered = m.expenses.filter(e => {
    const mc = filterCat === "all" || e.category === filterCat;
    const ms = !search || (e.note||"").toLowerCase().includes(search) || (e.category||"").toLowerCase().includes(search);
    return mc && ms;
  });

  const list = $("mExpList");
  const empty = $("mExpEmpty");
  if (filtered.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    empty.textContent = m.expenses.length === 0 ? "لا توجد مصاريف بعد. اضغط 'إضافة سريعة' ✨" : "لا توجد نتائج تطابق 🔍";
    return;
  }
  empty.style.display = "none";
  const sorted = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  list.innerHTML = sorted.map(e => `
    <div class="m-item">
      <div class="m-item-icon">${getIcon(e.category)}</div>
      <div class="m-item-body">
        <div class="m-item-title">${escapeHtml(e.category)}</div>
        <div class="m-item-sub">${escapeHtml(e.date)}${e.note ? " • " + escapeHtml(e.note) : ""}</div>
      </div>
      <div class="m-item-amount">${fmt(e.amount)} ${cur()}</div>
      <div class="m-item-actions">
        <button class="icon-action" data-action="edit-exp" data-id="${e.id}">✏️</button>
        <button class="icon-action danger" data-action="del-exp" data-id="${e.id}">🗑️</button>
      </div>
    </div>
  `).join("");
}

function renderMonthIncome() {
  const m = ensureMonth(currentMonth);
  const list = $("mIncList");
  const empty = $("mIncEmpty");
  if (m.income.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  const sorted = [...m.income].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  list.innerHTML = sorted.map(i => `
    <div class="m-item income-item">
      <div class="m-item-icon">${getIcon(i.source)}</div>
      <div class="m-item-body">
        <div class="m-item-title">${escapeHtml(i.source)}</div>
        <div class="m-item-sub">${escapeHtml(i.date)}${i.note ? " • " + escapeHtml(i.note) : ""}</div>
      </div>
      <div class="m-item-amount">${fmt(i.amount)} ${cur()}</div>
      <div class="m-item-actions">
        <button class="icon-action" data-action="edit-inc" data-id="${i.id}">✏️</button>
        <button class="icon-action danger" data-action="del-inc" data-id="${i.id}">🗑️</button>
      </div>
    </div>
  `).join("");
}

// ============================================
// ANALYSIS
// ============================================
function destroyCharts() {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};
}
function renderAnalysis() {
  destroyCharts();
  const range = document.querySelector(".rpill.active")?.dataset.range || "6";
  let months = Object.keys(data.months).sort();
  if (range !== "all") months = months.slice(-parseInt(range));
  if (months.length === 0) {
    $("mStats").innerHTML = '<p style="color:#64748b;font-size:0.9rem">أضف بيانات أولاً</p>';
    return;
  }

  const labels = months.map(monthLabel);
  const incomeVals = months.map(m => monthStats(m).income);
  const expVals = months.map(m => monthStats(m).exp);
  const balVals = months.map(m => monthStats(m).balance);
  const ratioVals = incomeVals.map((v, i) => v > 0 ? Math.round((expVals[i] / v) * 100) : 0);

  const c = cur();
  const baseOpts = (yLbl = "") => ({
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: "#cbd5e1", font: { family: "Tajawal", size: 11 } } }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#64748b", font: { family: "Tajawal" } },
        grid: { color: "rgba(255,255,255,0.05)" },
        title: yLbl ? { display: true, text: yLbl, color: "#94a3b8", font: { family: "Tajawal" } } : undefined
      },
      x: { ticks: { color: "#64748b", font: { family: "Tajawal" } }, grid: { color: "rgba(255,255,255,0.05)" } }
    }
  });

  charts.ie = new Chart($("chIncomeExpense"), {
    type: "bar",
    data: { labels, datasets: [
      { label: "المدخولات", data: incomeVals, backgroundColor: "rgba(74,222,128,0.7)", borderRadius: 6 },
      { label: "المصاريف", data: expVals, backgroundColor: "rgba(251,113,133,0.7)", borderRadius: 6 }
    ]},
    options: baseOpts(c)
  });

  const m = ensureMonth(currentMonth);
  const catMap = {};
  m.expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount || 0); });
  const catLabels = Object.keys(catMap);
  const catData = Object.values(catMap);
  const palette = ["#06b6d4","#8b5cf6","#fb7185","#fb923c","#4ade80","#60a5fa","#fbbf24","#a78bfa","#2dd4bf","#f472b6","#94a3b8"];
  if (catLabels.length > 0) {
    charts.cat = new Chart($("chCategory"), {
      type: "doughnut",
      data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catLabels.map((_,i) => palette[i % palette.length]), borderColor: "#1e293b", borderWidth: 2 }] },
      options: { responsive: true, plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1", font: { family: "Tajawal" } } } } }
    });
  } else {
    $("chCategory").parentElement.innerHTML += '<p style="color:#64748b;font-size:0.8rem">لا توجد مصاريف</p>';
  }

  charts.bal = new Chart($("chBalance"), {
    type: "line",
    data: { labels, datasets: [{
      label: "الرصيد", data: balVals,
      borderColor: "#60a5fa", backgroundColor: "rgba(96,165,250,0.15)",
      fill: true, tension: 0.3, pointBackgroundColor: "#60a5fa"
    }]},
    options: baseOpts(c)
  });

  charts.ratio = new Chart($("chRatio"), {
    type: "line",
    data: { labels, datasets: [{
      label: "نسبة الصرف %", data: ratioVals,
      borderColor: "#fb923c", backgroundColor: "rgba(251,146,60,0.15)",
      fill: true, tension: 0.3, pointBackgroundColor: "#fb923c"
    }]},
    options: { ...baseOpts("%"), scales: { ...baseOpts().scales, y: { ...baseOpts().scales.y, max: 100 } } }
  });

  const totalInc = incomeVals.reduce((a,b) => a+b, 0);
  const totalExp = expVals.reduce((a,b) => a+b, 0);
  const avgExp = totalExp / months.length;
  const avgInc = totalInc / months.length;
  const maxExp = Math.max(...expVals);
  const maxExpMonth = labels[expVals.indexOf(maxExp)];
  const allMonths = Object.keys(data.months).sort();
  const curIdx = allMonths.indexOf(currentMonth);
  let deltaHtml = "";
  if (curIdx > 0) {
    const prev = monthStats(allMonths[curIdx - 1]);
    const cs = monthStats(currentMonth);
    if (cs.exp !== 0 || prev.exp !== 0) {
      const diff = cs.exp - prev.exp;
      const pct = prev.exp > 0 ? Math.round((diff / prev.exp) * 100) : 0;
      const cls = diff > 0 ? "up" : "down";
      const arrow = diff > 0 ? "▲" : "▼";
      deltaHtml = `<div class="stat-delta ${cls}">${arrow} ${pct}% عن ${monthLabel(allMonths[curIdx - 1])}</div>`;
    }
  }

  $("mStats").innerHTML = `
    <div class="stat-m"><div class="stat-label">متوسط المصاريف</div><div class="stat-value">${fmt(avgExp)} ${c}</div></div>
    <div class="stat-m"><div class="stat-label">متوسط المدخولات</div><div class="stat-value">${fmt(avgInc)} ${c}</div></div>
    <div class="stat-m"><div class="stat-label">أعلى شهر صرفاً</div><div class="stat-value">${fmt(maxExp)} ${c}</div><div class="stat-delta">${maxExpMonth}</div></div>
    <div class="stat-m"><div class="stat-label">صرف الشهر الحالي</div><div class="stat-value">${fmt(monthStats(currentMonth).exp)} ${c}</div>${deltaHtml}</div>
  `;
}

// ============================================
// QUICK ADD MODAL
// ============================================
function openQuickAdd(prefill = null) {
  $("qaForm").reset();
  $("qaDate").value = today();
  $("qaEditId").value = "";
  $("qaAmount").value = "";
  $("qaNote").value = "";
  qaType = "expense";
  setQaType("expense");
  buildQaChips();
  $("qaCur").textContent = cur();

  if (prefill) {
    qaType = prefill.type;
    setQaType(prefill.type);
    buildQaChips();
    if (prefill.type === "expense") {
      $("qaAmount").value = prefill.item.amount;
      $("qaDate").value = prefill.item.date;
      $("qaNote").value = prefill.item.note || "";
      $("qaEditId").value = prefill.item.id;
      setActiveQaChip(prefill.item.category);
    } else {
      $("qaAmount").value = prefill.item.amount;
      $("qaDate").value = prefill.item.date;
      $("qaNote").value = prefill.item.note || "";
      $("qaEditId").value = prefill.item.id;
      setActiveQaChip(prefill.item.source);
    }
    $("qaTitle").textContent = "✏️ تعديل";
  } else {
    $("qaTitle").textContent = "➕ إضافة سريعة";
  }
  openModal("quickAddModal");
  setTimeout(() => $("qaAmount").focus(), 200);
}

function setQaType(type) {
  qaType = type;
  $("qaType").value = type;
  document.querySelectorAll(".qa-tg").forEach(b => b.classList.toggle("active", b.dataset.qa === type));
  $("qaCatLabel").textContent = type === "expense" ? "الفئة" : "المصدر";
}

function buildQaChips() {
  const list = qaType === "expense" ? CATEGORIES : SOURCES;
  $("qaChips").innerHTML = list.map(c =>
    `<button type="button" class="chip" data-id="${c.id}">${c.icon} ${c.id}</button>`
  ).join("");
  $("qaChips").onclick = (ev) => {
    const chip = ev.target.closest(".chip");
    if (chip) setActiveQaChip(chip.dataset.id);
  };
}

function setActiveQaChip(id) {
  document.querySelectorAll("#qaChips .chip").forEach(c => c.classList.toggle("active", c.dataset.id === id));
  $("qaCatVal").value = id;
}

// ============================================
// EXPORT
// ============================================
function buildMonthItems(ym) {
  const m = ensureMonth(ym);
  return [
    ...m.expenses.map(e => ({ ...e, _type: "مصروف" })),
    ...m.income.map(i => ({ ...i, _type: "مدخول", category: i.source }))
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("تم التحميل: " + filename, "success");
}

function exportExcelHTML(items, filename, title) {
  const rows = items.map(it => `
    <tr>
      <td>${escapeHtml(it.date)}</td>
      <td>${escapeHtml(it._type)}</td>
      <td>${escapeHtml(it.category || it.source || "")}</td>
      <td>${escapeHtml(it.note || "")}</td>
      <td style="text-align:left;font-weight:bold">${fmt(it.amount)}</td>
    </tr>`).join("");
  const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"></head><body>
    <h2>${title}</h2>
    <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:Tajawal">
      <thead><tr style="background:#06b6d4;color:#fff">
        <th>التاريخ</th><th>النوع</th><th>الفئة/المصدر</th><th>الملاحظة</th><th>المبلغ (${cur()})</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f7fafc;font-weight:bold"><td colspan="4">المجموع</td><td style="text-align:left">${fmt(total)}</td></tr></tfoot>
    </table></body></html>`;
  downloadFile(html, filename, "application/vnd.ms-excel");
}

function exportCurrentMonthExcel() {
  const items = buildMonthItems(currentMonth);
  if (items.length === 0) return toast("لا توجد بيانات", "error");
  exportExcelHTML(items, `مصاريفي-${currentMonth}.xls`, `سجل ${monthLabel(currentMonth)}`);
}

function exportCurrentMonthCSV() {
  const items = buildMonthItems(currentMonth);
  if (items.length === 0) return toast("لا توجد بيانات", "error");
  const headers = ["التاريخ", "النوع", "الفئة/المصدر", "الملاحظة", "المبلغ"];
  const rows = items.map(it => [
    it.date, it._type,
    `"${(it.category || it.source || "").replace(/"/g, '""')}"`,
    `"${(it.note || "").replace(/"/g, '""')}"`,
    it.amount
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map(r => r.join(",")).join("\n");
  downloadFile(csv, `مصاريفي-${currentMonth}.csv`, "text/csv;charset=utf-8");
}

function exportJSON() {
  downloadFile(JSON.stringify({ data, settings, exportedAt: new Date().toISOString() }, null, 2),
    `backup-${today()}.json`, "application/json");
}

function exportToDrive() {
  const json = JSON.stringify({ data, settings, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `expenses-backup-${today()}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setTimeout(() => {
    window.open("https://drive.google.com/drive/u/0/my-drive", "_blank");
    toast("ارفع الملف على Drive 🚀", "success");
  }, 500);
}

// ============================================
// WHATSAPP
// ============================================
function buildWhatsAppText(style = "simple") {
  const s = monthStats(currentMonth);
  const m = ensureMonth(currentMonth);
  const c = cur();
  const month = monthLabel(currentMonth);
  const catMap = {};
  m.expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount || 0); });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const savingsRate = s.income > 0 ? Math.round(((s.income - s.exp) / s.income) * 100) : 0;
  const ratio = s.income > 0 ? Math.round((s.exp / s.income) * 100) : 0;
  const allMonths = Object.keys(data.months).sort();
  const curIdx = allMonths.indexOf(currentMonth);
  let compLine = "";
  if (curIdx > 0) {
    const prev = monthStats(allMonths[curIdx - 1]);
    if (prev.exp > 0) {
      const diff = s.exp - prev.exp;
      const pct = Math.round((diff / prev.exp) * 100);
      const arrow = diff > 0 ? "⬆️ زيادة" : "⬇️ توفير";
      compLine = `\n📊 مقارنة بـ ${monthLabel(allMonths[curIdx - 1])}: ${arrow} ${Math.abs(pct)}%`;
    }
  }

  if (style === "minimal") {
    return `💰 *${month}*
دخول: ${fmt(s.income)} ${c}
صرف: ${fmt(s.exp)} ${c}
باقي: ${fmt(s.balance)} ${c} (${savingsRate}%)`;
  }
  if (style === "detailed") {
    let detail = `📊 *تقرير ${month}*\n━━━━━━━━━━━━━━━━━━\n\n`;
    detail += `💵 *المدخولات:* ${fmt(s.income)} ${c}\n`;
    m.income.forEach(i => detail += `  • ${i.source}${i.note ? " - " + i.note : ""}: ${fmt(i.amount)} ${c}\n`);
    detail += `\n💸 *المصاريف:* ${fmt(s.exp)} ${c}\n`;
    m.expenses.forEach(e => detail += `  • ${e.category}${e.note ? " - " + e.note : ""}: ${fmt(e.amount)} ${c}\n`);
    detail += `\n━━━━━━━━━━━━━━━━━━\n`;
    detail += `💎 *المتبقي:* ${fmt(s.balance)} ${c}\n`;
    detail += `📈 توفير: ${savingsRate}% | 📉 صرف: ${ratio}%${compLine}\n\n`;
    if (topCats.length) {
      detail += `🏆 *أعلى الفئات:*\n`;
      topCats.forEach(([cat, amt], i) => detail += `  ${i + 1}. ${cat}: ${fmt(amt)} ${c}\n`);
    }
    detail += `\n📋 العمليات: ${s.count}`;
    return detail;
  }
  let msg = `📊 *تقرير ${month}*\n\n`;
  msg += `💵 المدخولات: ${fmt(s.income)} ${c}\n`;
  msg += `💸 المصاريف: ${fmt(s.exp)} ${c}\n`;
  msg += `💎 المتبقي: ${fmt(s.balance)} ${c}\n`;
  msg += `📈 توفير: ${savingsRate}% | 📉 صرف: ${ratio}%${compLine}\n\n`;
  if (topCats.length) {
    msg += `🏆 *أعلى الفئات:*\n`;
    topCats.forEach(([cat, amt], i) => msg += `  ${i + 1}. ${cat} — ${fmt(amt)} ${c}\n`);
  }
  msg += `\n📋 العمليات: ${s.count}`;
  return msg;
}

function updateWaPreview() {
  waLastText = buildWhatsAppText(waStyle);
  $("waPreview").textContent = waLastText;
}

function openWhatsApp() {
  waStyle = "simple";
  document.querySelectorAll(".wa-style-btn").forEach(b => b.classList.toggle("active", b.dataset.style === waStyle));
  $("waPhone").value = localStorage.getItem("wa_phone") || "962788225366";
  updateWaPreview();
  openModal("whatsappModal");
}

function sendWhatsApp() {
  const phone = $("waPhone").value.trim().replace(/[^0-9]/g, "");
  if (phone) localStorage.setItem("wa_phone", phone);
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(waLastText)}` : `https://wa.me/?text=${encodeURIComponent(waLastText)}`;
  window.open(url, "_blank");
  toast("تم فتح واتساب 💬", "success");
}

function copyWaText() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(waLastText).then(() => toast("تم النسخ 📋", "success"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = waLastText;
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("تم النسخ 📋", "success");
  }
}

// ============================================
// MODAL HELPERS
// ============================================
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
function closeAllModals() { document.querySelectorAll(".modal").forEach(m => m.hidden = true); }

// ============================================
// IMPORT
// ============================================
function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      const importedData = imported.data || imported;
      if (!importedData.months) return toast("ملف غير صالح", "error");
      if (confirm("دمج مع البيانات الحالية؟ (إلغاء = استبدال)")) {
        Object.keys(importedData.months).forEach(k => {
          if (!data.months[k]) data.months[k] = importedData.months[k];
        });
      } else {
        data = importedData;
        if (imported.settings) settings = imported.settings;
      }
      saveData(); saveSettings();
      renderHome();
      toast("تم الاستيراد ✅", "success");
    } catch (err) { toast("خطأ في قراءة الملف", "error"); }
  };
  reader.readAsText(file);
}

// ============================================
// PWA INSTALL
// ============================================
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").style.display = "flex";
});

// ============================================
// INIT
// ============================================
function init() {
  loadData();
  if (!currentMonth) currentMonth = todayMonth();
  $("qaDate").value = today();
  $("currencySelect").value = settings.currency;
  $("newYear").value = new Date().getFullYear();
  $("newMonth").value = String(new Date().getMonth() + 1).padStart(2, "0");

  // FAB add month
  $("fabAddMonth").addEventListener("click", () => openModal("addMonthModal"));

  // Add month form
  $("addMonthForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const y = String($("newYear").value).padStart(4, "0");
    const m = String($("newMonth").value).padStart(2, "0");
    const ym = `${y}-${m}`;
    if (data.months[ym]) {
      if (!confirm(`شهر ${monthLabel(ym)} موجود. تبي تفتحه؟`)) return;
      currentMonth = ym;
      closeAllModals();
      showView("month");
      return;
    }
    data.months[ym] = { income: [], expenses: [] };
    saveData();
    currentMonth = ym;
    closeAllModals();
    showView("month");
    toast("تم إنشاء " + monthLabel(ym) + " ✅", "success");
  });

  // Back button
  $("backBtn").addEventListener("click", () => showView("home"));

  // Month menu
  $("mMenu").addEventListener("click", () => {
    $("mMenuTitle").textContent = `📅 ${monthLabel(currentMonth)}`;
    openModal("monthMenuModal");
  });

  // Quick add pill
  $("quickAddPill").addEventListener("click", () => openQuickAdd());

  // QA type toggle
  document.querySelectorAll(".qa-tg").forEach(b => {
    b.addEventListener("click", () => { setQaType(b.dataset.qa); buildQaChips(); });
  });

  // QA form submit
  $("qaForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const amount = parseFloat($("qaAmount").value);
    const date = $("qaDate").value;
    const note = $("qaNote").value.trim();
    const cat = $("qaCatVal").value;
    const editId = $("qaEditId").value;
    if (isNaN(amount) || amount < 0 || !date || !cat) return toast("املأ الحقول", "error");
    const m = ensureMonth(currentMonth);
    if (editId) {
      if (qaType === "expense") {
        const idx = m.expenses.findIndex(e => e.id === editId);
        if (idx >= 0) m.expenses[idx] = { ...m.expenses[idx], date, amount, category: cat, note };
      } else {
        const idx = m.income.findIndex(i => i.id === editId);
        if (idx >= 0) m.income[idx] = { ...m.income[idx], date, amount, source: cat, note };
      }
    } else {
      const id = uid();
      if (qaType === "expense") {
        m.expenses.push({ id, date, amount, category: cat, note });
      } else {
        m.income.push({ id, date, amount, source: cat, note });
      }
    }
    saveData();
    closeAllModals();
    renderMonth();
    toast("تم الحفظ ✓", "success");
  });

  // Month panels tabs
  document.querySelectorAll(".m-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".m-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".m-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      $("mPanel-" + tab.dataset.mtab).classList.add("active");
      if (tab.dataset.mtab === "analysis") renderAnalysis();
    });
  });

  // Search & filter
  $("mSearch").addEventListener("input", renderMonthExpenses);
  $("mFilterCat").addEventListener("change", renderMonthExpenses);

  // List actions
  $("mExpList").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const m = ensureMonth(currentMonth);
    if (btn.dataset.action === "edit-exp") {
      const it = m.expenses.find(e => e.id === id);
      if (it) openQuickAdd({ type: "expense", item: it });
    }
    if (btn.dataset.action === "del-exp") {
      if (!confirm("حذف هذا المصروف؟")) return;
      m.expenses = m.expenses.filter(e => e.id !== id);
      saveData(); renderMonth();
      toast("تم الحذف ✓", "success");
    }
  });

  $("mIncList").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const m = ensureMonth(currentMonth);
    if (btn.dataset.action === "edit-inc") {
      const it = m.income.find(i => i.id === id);
      if (it) openQuickAdd({ type: "income", item: it });
    }
    if (btn.dataset.action === "del-inc") {
      if (!confirm("حذف هذا المدخول؟")) return;
      m.income = m.income.filter(i => i.id !== id);
      saveData(); renderMonth();
      toast("تم الحذف ✓", "success");
    }
  });

  // Range pills
  document.querySelectorAll(".rpill").forEach(p => {
    p.addEventListener("click", () => {
      document.querySelectorAll(".rpill").forEach(x => x.classList.remove("active"));
      p.classList.add("active");
      renderAnalysis();
    });
  });

  // Month menu actions
  document.querySelectorAll('#monthMenuModal .export-opt').forEach(opt => {
    opt.addEventListener("click", () => {
      const action = opt.dataset.action;
      if (action === "excel-current") exportCurrentMonthExcel();
      else if (action === "csv-current") exportCurrentMonthCSV();
      else if (action === "wa-share") { closeAllModals(); openWhatsApp(); return; }
      else if (action === "rename") {
        const ym = currentMonth;
        const newName = prompt("اسم جديد للشهر:", monthLabel(ym));
        if (newName && newName.trim()) {
          // We don't have a separate display name; the month is identified by ym.
          // Instead, allow user to "move" to a new ym.
          const ymNew = prompt("السنة-الشهر (YYYY-MM):", ym);
          if (ymNew && ymNew !== ym) {
            data.months[ymNew] = data.months[ym];
            delete data.months[ym];
            currentMonth = ymNew;
            saveData(); showView("month");
            toast("تم النقل ✅", "success");
            return;
          }
        }
        return;
      }
      else if (action === "delete-month") {
        if (!confirm(`حذف ${monthLabel(currentMonth)} كامل؟`)) return;
        delete data.months[currentMonth];
        saveData();
        closeAllModals();
        showView("home");
        toast("تم الحذف", "success");
        return;
      }
      closeAllModals();
    });
  });

  // Settings
  $("settingsBtn").addEventListener("click", () => openModal("settingsModal"));
  $("currencySelect").addEventListener("change", (ev) => {
    settings.currency = ev.target.value;
    saveSettings();
    if (currentView === "home") renderHome();
    if (currentView === "month") renderMonth();
  });
  $("exportJsonBtn").addEventListener("click", exportJSON);
  $("driveBtn").addEventListener("click", exportToDrive);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (ev) => {
    if (ev.target.files[0]) importData(ev.target.files[0]);
    ev.target.value = "";
  });
  $("clearAllBtn").addEventListener("click", () => {
    if (!confirm("متأكد تبي تمسح كل البيانات؟")) return;
    if (!confirm("آخر فرصة! حذف نهائي؟")) return;
    data = { months: {} };
    saveData();
    closeAllModals();
    showView("home");
    toast("تم مسح كل البيانات", "success");
  });

  // WhatsApp
  $("waBtn")?.addEventListener("click", openWhatsApp);
  document.querySelectorAll(".wa-style-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".wa-style-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      waStyle = btn.dataset.style;
      updateWaPreview();
    });
  });
  $("waPhone").addEventListener("input", () => localStorage.setItem("wa_phone", $("waPhone").value.trim()));
  $("waSendBtn").addEventListener("click", sendWhatsApp);
  $("waCopyBtn").addEventListener("click", copyWaText);

  // Install button
  $("installBtn").addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") toast("تم التثبيت 📱", "success");
      deferredPrompt = null;
      $("installBtn").style.display = "none";
    } else {
      toast("القائمة ← إضافة للشاشة الرئيسية", "");
    }
  });

  // Close modals on backdrop
  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", (ev) => {
      const m = ev.target.closest(".modal");
      if (m) m.hidden = true;
    });
  });

  renderHome();
}

document.addEventListener("DOMContentLoaded", init);
