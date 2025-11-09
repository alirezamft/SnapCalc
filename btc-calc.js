// btc-calc.js — per-day BTC calculation + detailed logs
(() => {
  const post = (type, payload={}) =>
    window.postMessage({ source:"SNAPP_BTC", type, payload }, "*");

  const log = (level, msg, extra) =>
    post("log", { level, msg, extra });

  function rangeFromByDay(byDay){
    const days = Object.keys(byDay).sort();
    if (!days.length) return null;
    return { days, fromISO: `${days[0]}T00:00:00Z`, toISO: `${days.at(-1)}T23:59:59Z` };
  }

  async function calcBTC(byDay){
    try{
      const prv = window.PriceProvider;
      if (!prv) { post("error", { msg:"Price provider not ready" }); return; }

      const rg = rangeFromByDay(byDay);
      if (!rg) { post("result", { totalBTC:0, unresolvedRial:0, perDay:{}, priceNow:null }); return; }

      log("INFO","fetch BTC daily span", { from: rg.fromISO, to: rg.toISO, days: rg.days.length });
      let hist = await prv.getDaily("BTCIRT", rg.fromISO, rg.toISO);

      const dailyClose = {};
      (hist.t||[]).forEach((t,i)=>{
        const d = new Date(t*1000).toISOString().slice(0,10);
        const c = +(hist.c?.[i] || 0);
        if (c>0) dailyClose[d] = c;
      });
      log("OK","daily closes fetched (BTC)", { candles: (hist.t||[]).length });

      let totalBTC = 0, unresolved = 0;
      const perDay = {};
      let cumBTC = 0;

      for (const day of rg.days) {
        const rial = +byDay[day] || 0;
        let close = dailyClose[day];

        if (!close) {
          log("WARN","no daily close; try hourly", { day });
          const h = await prv.getHourlyCloseForDay("BTCIRT", day);
          if (h && h>0) { close = h; log("OK","hourly fallback used", { day, close }); }
        }

        if (!close) {
          perDay[day] = { rial, close:null, btc:null, cumBTC, valueRial:null };
          unresolved += rial;
          log("WARN","day unresolved (no price)", { day, rial });
          continue;
        }

        const btc = rial / close;
        cumBTC += btc;
        perDay[day] = { rial, close, btc, cumBTC, valueRial: cumBTC * close };
        totalBTC += btc;
      }

      let priceNow = await prv.getNow("BTCIRT");
      if (!priceNow && hist.c?.length) priceNow = +hist.c.at(-1);

      log("OK","btc result", { totalBTC, unresolvedRial: unresolved, priceNow });
      post("result", { totalBTC, unresolvedRial: unresolved, perDay, priceNow });
    } catch (e){
      log("ERR","calcBTC crash", String(e));
      post("error", { msg:"خطا در محاسبه بیت‌کوینی." });
    }
  }

  window.addEventListener("message", (ev)=>{
    if (ev.data?.source !== "SNAPP_UI") return;
    const { type, payload } = ev.data;
    if (type === "calcBTC" && payload?.byDay) {
      log("INFO","calcBTC requested", { days: Object.keys(payload.byDay).length });
      calcBTC(payload.byDay);
    }
  });

  post("ready");
})();
