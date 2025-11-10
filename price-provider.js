// price-provider.js — Nobitex UDF (daily/hourly) + small queue + detailed logs (no provider change)
(() => {
  const BASE = "https://apiv2.nobitex.ir/market/udf/history";
  const TICK = "https://apiv2.nobitex.ir/market/ticker";

  // mini logger (فرستادن لاگ‌ها کنار لاگ‌های موجود)
  const log = (level, msg, extra) => {
    try {
      window.postMessage({ source: "SNAPP_CALC", type: "log", payload: { level, msg, extra } }, "*");
    } catch {}
  };

  // caches
  const _cacheDaily = new Map(); // key: `${symbol}:D:${fromISO}:${toISO}` -> {t:number[], c:number[]}
  const _cacheDay   = new Map(); // key: `${symbol}:${day}` -> close
  const _nowCache   = new Map(); // key: symbol -> {p, t}

  // small queue (≤ ~3 req/s)
  const QUEUE = [];
  let busy = false;
  const RATE_MS = 330;

  function q(fn){
    return new Promise((resolve, reject) => {
      QUEUE.push({ fn, resolve, reject }); pump();
    });
  }
  async function pump(){
    if (busy) return; busy = true;
    while (QUEUE.length){
      const { fn, resolve, reject } = QUEUE.shift();
      try { resolve(await fn()); } catch(e){ reject(e); }
      await new Promise(r => setTimeout(r, RATE_MS));
    }
    busy = false;
  }

  const toTs = iso => Math.floor(new Date(iso).getTime()/1000);

  async function _udf(symbol, resolution, fromISO, toISO, page=1){
    const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${toTs(fromISO)}&to=${toTs(toISO)}&page=${page}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.s === "no_data") return { t:[], c:[] };
    if (data?.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
      throw new Error("bad-udf-response");
    }
    return data; // {t:number[], c:number[]}
  }

  // Daily candles with chunking (flat arrays)
  async function getDaily(symbol, fromISO, toISO){
    const key = `${symbol}:D:${fromISO}:${toISO}`;
    if (_cacheDaily.has(key)) return structuredClone(_cacheDaily.get(key));

    const MAX_CHUNK_DAYS = 100;
    const allT = [], allC = [];

    const start = new Date(fromISO);
    const end   = new Date(toISO);

    for (let d = new Date(start); d <= end; ){
      const from = new Date(d);
      const to   = new Date(Math.min(end.getTime(), from.getTime() + (MAX_CHUNK_DAYS-1)*86400000));
      let data;
      try {
        data = await q(() => _udf(symbol, "D", from.toISOString(), to.toISOString(), 1));
      } catch (e){
        log("DBG", "[PP] udf fetch fail", { symbol, from: from.toISOString(), to: to.toISOString(), e: String(e) });
        data = { t:[], c:[] };
      }
      // 🔧 مهم: فلت صحیح
      if (Array.isArray(data.t) && data.t.length) allT.push(...data.t);
      if (Array.isArray(data.c) && data.c.length) allC.push(...data.c);

      d = new Date(to.getTime() + 86400000);
    }

    // تضمین یک‌دستی خروجی
    const out = { t: allT, c: allC };
    log("OK", "[PP] daily fetched", { symbol, candles: out.t.length });
    _cacheDaily.set(key, out);
    return structuredClone(out);
  }

  // One-day daily close (UTC day "YYYY-MM-DD")
  async function getCloseForDay(symbol, day){
    const k = `${symbol}:${day}`;
    if (_cacheDay.has(k)) return _cacheDay.get(k);
    const fromISO = `${day}T00:00:00Z`, toISO = `${day}T23:59:59Z`;
    let data = { t:[], c:[] };
    try {
      data = await q(() => _udf(symbol, "D", fromISO, toISO, 1));
    } catch (e){
      log("DBG", "[PP] day close fetch fail", { symbol, day, e: String(e) });
    }
    const close = data.c?.length ? Number(data.c.at(-1)) : null;
    _cacheDay.set(k, close);
    return close;
  }

  // Hourly fallback for a UTC day
  async function getHourlyCloseForDay(symbol, day){
    const fromISO = `${day}T00:00:00Z`, toISO = `${day}T23:59:59Z`;
    let data = { t:[], c:[] };
    try {
      data = await q(() => _udf(symbol, "60", fromISO, toISO, 1));
    } catch (e){
      log("DBG", "[PP] hourly fetch fail", { symbol, day, e: String(e) });
    }
    return data.c?.length ? Number(data.c.at(-1)) : null;
  }

  // Latest price (best-effort; اگر نشد از آخرین کندل روزانه استفاده کنین)
  async function getNow(symbol){
    const hit = _nowCache.get(symbol);
    if (hit && Date.now() - (hit.t||0) < 30_000) return hit.p;
    try {
      const res = await fetch(`${TICK}?symbol=${encodeURIComponent(symbol)}`, { credentials:"omit" });
      if (res.ok){
        const j = await res.json();
        const p = Number(j?.best_ask || j?.lastPrice || j?.last_price || j?.price || j?.close || 0);
        if (p>0){ _nowCache.set(symbol, { p, t: Date.now() }); return p; }
        log("DBG", "[PP] nobitex ticker empty/non-positive", { symbol });
      } else {
        log("DBG", "[PP] nobitex ticker http", { symbol, status: res.status });
      }
    } catch (e){
      log("DBG", "[PP] nobitex ticker error", { symbol, e: String(e) });
    }
    return null;
  }

  window.PriceProvider = { getDaily, getCloseForDay, getHourlyCloseForDay, getNow };
})();
