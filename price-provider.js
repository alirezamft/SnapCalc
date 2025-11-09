// price-provider.js — Generic UDF (Nobitex apiv2) with caching, paging, rate-limit
(() => {
  const BASE = "https://apiv2.nobitex.ir/market/udf/history";
  const TICK = "https://apiv2.nobitex.ir/market/ticker";

  // caches
  const _cacheDaily = new Map(); // key: `${symbol}:D:${fromISO}:${toISO}` -> {t,c}
  const _cacheDay   = new Map(); // key: `${symbol}:${day}` -> close
  const _nowCache   = new Map(); // key: symbol -> {p, t}

  // small queue (max ~3 req/s)
  const QUEUE = [];
  let busy = false;
  const RATE_MS = 330;

  function q(fn){
    return new Promise((resolve, reject)=>{
      QUEUE.push({fn, resolve, reject}); pump();
    });
  }
  async function pump(){
    if (busy) return; busy = true;
    while (QUEUE.length){
      const {fn, resolve, reject} = QUEUE.shift();
      try { resolve(await fn()); } catch(e){ reject(e); }
      await new Promise(r=>setTimeout(r, RATE_MS));
    }
    busy = false;
  }

  function toTs(iso){ return Math.floor(new Date(iso).getTime()/1000); }

  // fetch one page (from..to, optional page)
  async function _udf(symbol, resolution, fromISO, toISO, page=1){
    const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${toTs(fromISO)}&to=${toTs(toISO)}&page=${page}`;
    const res = await fetch(url, { credentials:"omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
      // «no_data» هم می‌آید، آن‌را با c=[] برمی‌گردانیم
      if (data?.s === "no_data") return { t:[], c:[] };
      throw new Error("bad-udf-response");
    }
    return data;
  }

  // getDaily: صفحه‌بندی خودکار (روزانه)
  async function getDaily(symbol, fromISO, toISO){
    const key = `${symbol}:D:${fromISO}:${toISO}`;
    if (_cacheDaily.has(key)) return structuredClone(_cacheDaily.get(key));

    // apiv2 حداکثر 500 کندل؛ ما جلوبندی 100 روزه می‌زنیم (پایدارتر)
    const MAX_CHUNK_DAYS = 100;
    const allT = [], allC = [];

    // روز به روز قدم می‌زنیم
    const start = new Date(fromISO);
    const end   = new Date(toISO);
    for (let d = new Date(start); d <= end; ) {
      const from = new Date(d);
      const to = new Date(Math.min(end.getTime(), from.getTime() + (MAX_CHUNK_DAYS-1)*86400000));
      const data = await q(()=>_udf(symbol, "D", from.toISOString(), to.toISOString(), 1));
      allT.push(...(data.t||[]));
      allC.push(...(data.c||[]));
      d = new Date(to.getTime() + 86400000);
    }
    const out = { t: allT, c: allC };
    _cacheDaily.set(key, out);
    return structuredClone(out);
  }

  // close for one specific UTC day "YYYY-MM-DD"
  async function getCloseForDay(symbol, day){
    const k = `${symbol}:${day}`;
    if (_cacheDay.has(k)) return _cacheDay.get(k);
    const fromISO = `${day}T00:00:00Z`, toISO = `${day}T23:59:59Z`;
    const data = await q(()=>_udf(symbol, "D", fromISO, toISO, 1));
    const close = data.c?.length ? Number(data.c.at(-1)) : null;
    _cacheDay.set(k, close);
    return close;
  }

  // hourly fallback for a day (returns latest hour close of that day)
  async function getHourlyCloseForDay(symbol, day){
    const fromISO = `${day}T00:00:00Z`, toISO = `${day}T23:59:59Z`;
    const data = await q(()=>_udf(symbol, "60", fromISO, toISO, 1));
    return data.c?.length ? Number(data.c.at(-1)) : null;
  }

  // latest (now) price snapshot; fallback to daily last-close if needed
  async function getNow(symbol){
    const hit = _nowCache.get(symbol);
    if (hit && Date.now() - (hit.t||0) < 30_000) return hit.p; // 30s cache
    try {
      const res = await fetch(`${TICK}?symbol=${encodeURIComponent(symbol)}`, { credentials:"omit" });
      if (res.ok){
        const j = await res.json();
        const p = Number(j?.best_ask || j?.lastPrice || j?.last_price || j?.price || j?.close || 0);
        if (p>0){ _nowCache.set(symbol, {p, t:Date.now()}); return p; }
      }
    } catch {}
    return null;
  }

  window.PriceProvider = {
    getDaily, getCloseForDay, getHourlyCloseForDay, getNow
  };
})();
