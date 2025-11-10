// usd-calc.js – per-day USDT (by Nobitex IRT) with detailed logs
(() => {
  const post = (type, payload={}) =>
    window.postMessage({ source:"SNAPP_USD", type, payload }, "*");
  const log = (level, msg, extra) => post("log", { level, msg, extra });

  const rangeFromByDay = (byDay) => {
    const days = Object.keys(byDay).sort();
    return days.length ? { days, fromISO:`${days[0]}T00:00:00Z`, toISO:`${days.at(-1)}T23:59:59Z` } : null;
  };

  async function calcUSD(byDay){
    try{
      const prv = window.PriceProvider;
      if (!prv) { post("error", { msg:"Price provider not ready" }); return; }

      const rg = rangeFromByDay(byDay);
      if (!rg){ log("WARN","byDay empty, returning zero");
        post("result",{ totalUSD:0, unresolvedRial:0, perDay:{}, priceNow:null }); return; }

      log("INFO","calcUSD started", { totalDays: rg.days.length, from: rg.fromISO, to: rg.toISO });

      // قیمت‌های روزانه (IRT = تومن)
      log("INFO","fetching USDTIRT daily candles from Nobitex…");
      const hist = await prv.getDaily("USDTIRT", rg.fromISO, rg.toISO);
      const dailyClose = {};
      (hist.t||[]).forEach((t,i)=>{
        const d = new Date(t*1000).toISOString().slice(0,10);
        const c = +(hist.c?.[i] || 0);
        if (c>0) dailyClose[d] = c; // تومن
      });

      let totalUSD = 0, unresolved = 0;
      const perDay = {};
      let cumUSD = 0;

      log("INFO","starting day-by-day loop", { days: rg.days.length });

      for (const day of rg.days){
        const rialIRR = +byDay[day] || 0;          // از اسنپ (ریال)
        const tomanIRT = Math.round(rialIRR/10);   // تبدیل به تومن
        let close = dailyClose[day];               // قیمت پایانی تتر به تومن

        if (!close){
          log("WARN","no daily close, trying hourly fallback", { day });
          const h = await prv.getHourlyCloseForDay("USDTIRT", day);
          if (h && h>0){ close = h; log("OK","hourly fallback success",{ day, closeIRT:close }); }
          else { log("WARN","hourly fallback also failed", { day }); }
        }

        if (!close){
          perDay[day] = { rialIRR, tomanIRT, close:null, usd:null, cumUSD, valueToman:null };
          unresolved += rialIRR;
          log("WARN","day unresolved (no price)", { day, rialIRR, tomanIRT });
          continue;
        }

        const usd = tomanIRT / close;   // چون close = تومنه
        cumUSD += usd;
        const valueToman = Math.round(cumUSD * close);

        perDay[day] = { rialIRR, tomanIRT, close:close, usd, cumUSD, valueToman };

        log("OK","day detail", {
          day, rialIRR, tomanIRT, closeIRT: close,
          usd:+usd.toFixed(6), cumUSD:+cumUSD.toFixed(6), valueToman
        });
        totalUSD += usd;
      }

      // قیمت فعلی به تومن
      let priceNow = await prv.getNow("USDTIRT");
      if (!priceNow && hist?.c?.length){ priceNow = +hist.c.at(-1); log("WARN","priceNow from last candle (fallback)", { priceNow }); }
      else log("OK","priceNow fetched successfully", { priceNowIRT: priceNow });

      const finalValueToman = Math.round(totalUSD * (priceNow || 0));

      log("OK","calcUSD final result", {
        totalUSD:+totalUSD.toFixed(6), unresolvedRial:unresolved,
        priceNowIRT: priceNow, finalValueToman
      });

      post("result", { totalUSD, unresolvedRial: unresolved, perDay, priceNow });
    }catch(e){
      log("ERR","calcUSD crashed", { error:String(e), stack:e.stack });
      post("error", { msg:"خطا در محاسبه دلاری (USDT)." });
    }
  }

  window.addEventListener("message",(ev)=>{
    if (ev.data?.source!=="SNAPP_UI") return;
    const { type, payload } = ev.data;
    if (type==="calcUSD" && payload?.byDay){
      log("INFO","calcUSD requested", { days:Object.keys(payload.byDay).length });
      calcUSD(payload.byDay);
    }
  });

  post("ready"); log("INFO","USD calculator ready");
})();
