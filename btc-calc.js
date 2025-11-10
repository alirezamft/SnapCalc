// btc-calc.js – per-day BTC (by Nobitex IRT) with detailed logs
(() => {
  const post = (type, payload={}) =>
    window.postMessage({ source:"SNAPP_BTC", type, payload }, "*");
  const log = (level, msg, extra) => post("log", { level, msg, extra });
  const rangeFromByDay = (byDay) => {
    const days = Object.keys(byDay).sort();
    return days.length ? { days, fromISO:`${days[0]}T00:00:00Z`, toISO:`${days.at(-1)}T23:59:59Z` } : null;
  };

  async function calcBTC(byDay){
    try{
      const prv = window.PriceProvider;
      if (!prv) { post("error", { msg:"Price provider not ready" }); return; }
      const rg = rangeFromByDay(byDay);
      if (!rg){ log("WARN","byDay empty, returning zero");
        post("result",{ totalBTC:0, unresolvedRial:0, perDay:{}, priceNow:null }); return; }

      log("INFO","calcBTC started", { totalDays:rg.days.length, from:rg.fromISO, to:rg.toISO });

      log("INFO","fetching BTCIRT daily candles from Nobitex…");
      const hist = await prv.getDaily("BTCIRT", rg.fromISO, rg.toISO);
      const dailyClose = {};
      (hist.t||[]).forEach((t,i)=>{
        const d = new Date(t*1000).toISOString().slice(0,10);
        const c = +(hist.c?.[i] || 0);
        if (c>0) dailyClose[d] = c; // تومن
      });

      let totalBTC=0, unresolved=0;
      const perDay = {};
      let cumBTC=0;

      for (const day of rg.days){
        const rialIRR = +byDay[day] || 0;
        const tomanIRT = Math.round(rialIRR/10);
        let close = dailyClose[day];

        if (!close){
          log("WARN","no daily close, trying hourly fallback", { day });
          const h = await prv.getHourlyCloseForDay("BTCIRT", day);
          if (h && h>0){ close = h; log("OK","hourly fallback success",{ day, closeIRT:close }); }
          else { log("WARN","hourly fallback also failed", { day }); }
        }

        if (!close){
          perDay[day] = { rialIRR, tomanIRT, close:null, btc:null, cumBTC, valueToman:null };
          unresolved += rialIRR;
          log("WARN","day unresolved (no price)", { day, rialIRR, tomanIRT });
          continue;
        }

        const btc = tomanIRT / close; // close = تومن
        cumBTC += btc;
        const valueToman = Math.round(cumBTC * close);

        perDay[day] = { rialIRR, tomanIRT, close:close, btc, cumBTC, valueToman };

        log("OK","day detail", {
          day, rialIRR, tomanIRT, closeIRT:close,
          btc:+btc.toFixed(8), cumBTC:+cumBTC.toFixed(8), valueToman
        });
        totalBTC += btc;
      }

      let priceNow = await prv.getNow("BTCIRT");
      if (!priceNow && hist?.c?.length){ priceNow = +hist.c.at(-1); log("WARN","priceNow from last candle (fallback)", { priceNow }); }
      else log("OK","priceNow fetched successfully", { priceNowIRT: priceNow });

      const finalValueToman = Math.round(totalBTC * (priceNow || 0));
      log("OK","calcBTC final result", {
        totalBTC:+totalBTC.toFixed(8), unresolvedRial:unresolved,
        priceNowIRT:priceNow, finalValueToman
      });

      post("result",{ totalBTC, unresolvedRial:unresolved, perDay, priceNow });
    }catch(e){
      log("ERR","calcBTC crashed",{ error:String(e), stack:e.stack });
      post("error", { msg:"خطا در محاسبه بیت‌کوینی." });
    }
  }

  window.addEventListener("message",(ev)=>{
    if (ev.data?.source!=="SNAPP_UI") return;
    const { type, payload } = ev.data;
    if (type==="calcBTC" && payload?.byDay){
      log("INFO","calcBTC requested",{ days:Object.keys(payload.byDay).length });
      calcBTC(payload.byDay);
    }
  });

  post("ready"); log("INFO","BTC calculator ready");
})();
