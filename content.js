// content.js — API-only + earliest date + daily buckets + پاسخ به needDailyBuckets
(() => {
  /*************** messaging ***************/
  const post = (type, payload = {}) =>
    window.postMessage({ source: "SNAPP_CALC", type, payload }, "*");

  const log = (level, msg, extra) =>
    post("log", { ts: new Date().toISOString(), level, msg, ...(extra ? { extra } : {}) });

  /*************** utils ***************/
  const toLatin = (s = "") =>
    s.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[^\d]/g, "");

  const onRideHistory = () => location.pathname.includes("/ride-history");

  /*************** state ***************/
  const state = {
    running: false,
    all: 0,
    completed: 0,
    totalIRT: 0,      // جمع به «ریال»
    pages: 0,
    firstISO: null,   // اولین تاریخ (ISO از created_at)
    firstJalali: null, // اولین تاریخ (نمایش جلالی از rows)
    byDay: {},          // YYYY-MM-DD => sum Rial (completed)
    ridesCountByDay: {} // YYYY-MM-DD => count (completed)
  };

  const reset = () => {
    state.running = false;
    state.all = 0;
    state.completed = 0;
    state.totalIRT = 0;
    state.pages = 0;
    state.firstISO = null;
    state.firstJalali = null;
    state.byDay = {};
    state.ridesCountByDay = {};
  };

  const pushUpdate = () => {
    post("update", {
      all: state.all,
      completed: state.completed,
      totalIRT: state.totalIRT,
      pages: state.pages,
      firstISO: state.firstISO,
      firstJalali: state.firstJalali,
      byDay: state.byDay,
      ridesCountByDay: state.ridesCountByDay
    });
  };

  /*************** core (API) ***************/
  async function startAPI() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      log("ERR", "توکن پیدا نشد. لطفاً در اسنپ لاگین باشید.");
      return;
    }

    log("INFO", "شروع محاسبه سفرها");
    state.running = true;

    let next = "page=1&archive=0";
    const base = "/api/api-base/v3/passenger/ride/history";
    let prevNext = "";
    let guard = 0;

    while (state.running && next && guard < 500) {
      guard++;
      const url = `${base}?${next}`;
      log("INFO", `دریافت صفحه ${next}`);

      let res;
      try {
        res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` },
          credentials: "include"
        });
      } catch (e) {
        log("ERR", "network error", { err: String(e) });
        break;
      }

      if (res.status === 401) { log("ERR", "دسترسی منقضی شد (401)."); break; }
      if (!res.ok) {
        log("INFO", `خطای HTTP ${res.status}`);
        break;
      }

      const json = await res.json().catch(() => null);
      state.pages++;

      const rides = json?.data?.rides || [];
      const req   = json?.data?.required_params || ""; // مثل "page=2&archive=0"
      next = req || "";

      for (const r of rides) {
        state.all++;

        // اولین تاریخ‌ها
        const createdISO = r?.created_at ? new Date(r.created_at) : null;
        if (createdISO) {
          const iso = createdISO.toISOString();
          if (!state.firstISO || new Date(iso) < new Date(state.firstISO)) {
            state.firstISO = iso;
          }
        }
        if (!state.firstJalali && Array.isArray(r.rows)) {
          const drow = r.rows.find(x => /تاریخ\s*سفر/.test(x.title || ""));
          if (drow) state.firstJalali = String(drow.description || "").trim();
        }

        // مبلغ و وضعیت
        const done = r.latest_ride_status === 5;
        let amount = r.final_price || 0;
        if (!amount && Array.isArray(r.rows)) {
          const row = r.rows.find(x => x.type === "price" || /مبلغ|هزینه/.test(x.title || ""));
          if (row) amount = parseInt(toLatin(String(row.description)), 10) || 0;
        }

        // جمع‌های نهایی + باکت روزانه
        if (done && amount > 0) {
          state.completed++;
          state.totalIRT += amount;

          const d = createdISO ? new Date(createdISO) : null;
          const key = d ? d.toISOString().slice(0, 10) : null; // YYYY-MM-DD (UTC)
          if (key) {
            state.byDay[key] = (state.byDay[key] || 0) + amount;
            state.ridesCountByDay[key] = (state.ridesCountByDay[key] || 0) + 1;
          }
        }
      }

      pushUpdate();
      if (!next || next === prevNext) break;
      prevNext = next;

      // کمی استراحت برای جلوگیری از فشار روی API اسنپ
      await new Promise(r => setTimeout(r, 150));
    }

    state.running = false;
    log("OK", "calc done", { all: state.all, completed: state.completed, pages: state.pages });

    post("done", {
      all: state.all,
      completed: state.completed,
      totalIRT: state.totalIRT,
      pages: state.pages,
      firstISO: state.firstISO,
      firstJalali: state.firstJalali,
      byDay: state.byDay,
      ridesCountByDay: state.ridesCountByDay
    });
  }

  /*************** message bridge ***************/
  window.addEventListener("message", (ev) => {
    if (ev.data?.source !== "SNAPP_UI") return;
    const { type } = ev.data;

    if (type === "start") {
      reset();
      state.running = true;
      post("start");
      startAPI();
    }

    if (type === "stop") {
      state.running = false;
      log("OK", "stop requested");
    }

    if (type === "needDailyBuckets") {
      // بدون شروع مجدد، همین الان وضعیت فعلی را بده
      log("INFO", "needDailyBuckets requested");
      pushUpdate();
    }
  });

  /*************** boot ***************/
  if (onRideHistory()) post("ready");
})();
