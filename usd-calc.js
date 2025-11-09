// usd-calc.js — per-day USDT calculation + detailed logs
(() => {
  const post = (type, payload={}) =>
    window.postMessage({ source:"SNAPP_USD", type, payload }, "*");

  const log = (level, msg, extra) =>
    post("log", { level, msg, extra });

  function rangeFromByDay(byDay){
    const days = Object.keys(byDay).sort();
    if (!days.length) return null;
    return { days, fromISO: `${days[0]}T00:00:00Z`, toISO: `${days.at(-1)}T23:59:59Z` };
  }

  async function calcUSD(byDay){
    try{
      const prv = window.PriceProvider;
      if (!prv) { post("error", { msg:"Price provider not ready" }); return; }

      const rg = rangeFromByDay(byDay);
      if (!rg) { post("result", { totalUSD:0, unresolvedRial:0, perDay:{}, priceNow:null }); return; }

      log("INFO","fetch USDT daily span", { from: rg.fromISO, to: rg.toISO, days: rg.days.length });
      let hist = await prv.getDaily("USDTIRT", rg.fromISO, rg.toISO);

      const dailyClose = {};
      (hist.t||[]).forEach((t,i)=>{
        const d = new Date(t*1000).toISOString().slice(0,10);
        const c = +(hist.c?.[i] || 0);
        if (c>0) dailyClose[d] = c;
      });
      log("OK","daily closes fetched", { candles: (hist.t||[]).length });

      let totalUSD = 0, unresolved = 0;
      const perDay = {};
      let cumUSD = 0;                             // ← نام درست متغیر (قبلاً cumUSDT اشتباه بود)

      for (const day of rg.days) {
        const rial = +byDay[day] || 0;
        let close = dailyClose[day];

        if (!close) {
          log("WARN","no daily close; try hourly", { day });
          const h = await prv.getHourlyCloseForDay("USDTIRT", day);
          if (h && h>0) { close = h; log("OK","hourly fallback used", { day, close }); }
        }

        if (!close) {
          perDay[day] = { rial, close:null, usd:null, cumUSD, valueRial:null };
          unresolved += rial;
          log("WARN","day unresolved (no price)", { day, rial });
          continue;
        }

        const usd = rial / close;
        cumUSD += usd;
        perDay[day] = { rial, close, usd, cumUSD, valueRial: cumUSD * close };
        totalUSD += usd;
      }

      let priceNow = await prv.getNow("USDTIRT");
      if (!priceNow && hist.c?.length) priceNow = +hist.c.at(-1);

      log("OK","usd result", { totalUSD, unresolvedRial: unresolved, priceNow });
      post("result", { totalUSD, unresolvedRial: unresolved, perDay, priceNow });
    } catch (e){
      log("ERR","calcUSD crash", String(e));
      post("error", { msg:"خطا در محاسبه دلاری (USDT)." });
    }
  }

  window.addEventListener("message", (ev)=>{
    if (ev.data?.source !== "SNAPP_UI") return;
    const { type, payload } = ev.data;
    if (type === "calcUSD" && payload?.byDay) {
      log("INFO","calcUSD requested", { days: Object.keys(payload.byDay).length });
      calcUSD(payload.byDay);
    }
  });

  post("ready");
})();
