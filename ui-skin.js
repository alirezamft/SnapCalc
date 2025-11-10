// ui-skin.js — Dark minimal UI (YekanX), compact + cached dual (USDT/BTC)
// فقط UI — محاسبات USD/BTC و content.js دست‌نخورده باقی بماند
(() => {
  /* ---------- helpers ---------- */
  const send = (type, payload={}) => window.postMessage({ source:"SNAPP_UI", type, payload },"*");
  const toEn   = (n)=> new Intl.NumberFormat("en-US").format(+n||0);
  const toman  = (rial)=> Math.round((+rial||0)/10);
  const todayFa = ()=> new Intl.DateTimeFormat("fa-IR",{dateStyle:"long"}).format(new Date());
  const fmtFa   = (iso)=> { try { return new Intl.DateTimeFormat("fa-IR",{dateStyle:"long"}).format(new Date(iso)); } catch { return "—"; } };
  const enDigits = (s)=> String(s??"").replace(/[۰-۹]/g, d=> "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d=> "٠١٢٣٤٥٦٧٨٩".indexOf(d)); // اعداد انگلیسی حتی در تاریخ
  const $ = (sel, r=document)=> r.querySelector(sel);
  const $$= (sel, r=document)=> Array.prototype.slice.call(r.querySelectorAll(sel)||[]);

  /* ---------- mount ---------- */
  const root = document.createElement("div");
  document.body.appendChild(root);
  root.innerHTML = `
    <div id="snpp-wrap" class="snpp-wrap">
      <div id="snpp-card" class="snpp-card">
        <div class="snpp-top" id="dragHandle">
          <div class="title">محاسبه‌گر هزینه‌های اسنپ</div>
          <div class="top-acts">
            <button id="close" class="icon" title="بستن">×</button>
          </div>
        </div>

        <div id="shot-area" class="shot">
          <div class="grid2">
            <div class="box">
              <div class="k">سفرها (تکمیل شده)</div>
              <div class="v" id="stat-done">0</div>
              <div class="sub ellipsis" id="stat-range">—</div>
            </div>
            <div class="box">
              <div class="k">جمع هزینه (تومان)</div>
              <div class="v" id="stat-sum">0</div>
              <div class="sub ellipsis" id="stat-sum-note"></div>
            </div>
          </div>

          <div class="usd-box">
            <div class="cap">
              <span class="cap-text">اگر به اندازه هزینه هر سفر، همون موقع سرمایه گذاری می کردی:</span>
              <span class="switch">
                <button class="tab on" data-asset="USDT">تتر</button>
                <button class="tab" data-asset="BTC">بیت کوین</button>
              </span>
            </div>
            <div class="rows">
              <div class="line"><span>اندوخته تا امروز:</span><b id="asset-amount">—</b><span class="unit" id="asset-unit">USDT</span></div>
              <div class="line">
                <span>ارزش امروز:</span>
                <b id="asset-value">—</b>
                <span class="pct" id="asset-pct"></span>
                <span class="unit">تومان</span>
              </div>
            </div>
          </div>

          <div class="chart-head">مقایسه رشد (تومان / تتر / بیت کوین)</div>
          <div id="cmp-chart" class="chart"></div>
          <div class="chart-legend">
            <span><i class="swatch" style="--c:#8899a6"></i>تومان</span>
            <span><i class="swatch" style="--c:#21D59B"></i>USDT</span>
            <span><i class="swatch" style="--c:#ffb703"></i>BTC</span>
          </div>

          <div class="foot">توسعه داده شده توسط <a href="https://twitter.com/alirezachain" target="_blank" rel="noopener">@alirezachain</a></div>
        </div>

        <div class="ctrl">
          <button id="btn-save" class="btn outline xs" disabled>ذخیره تصویر</button>
          <button id="btn-share" class="btn outline xs" disabled>اشتراک گذاری</button>
          <button id="btn-start" class="btn primary xs">شروع محاسبه</button>
        </div>

        <div id="progress" class="progress" hidden>
          <div class="bar"><span class="fill"></span></div>
          <div id="lastlog" class="lastlog">در حال پردازش…</div>
        </div>

        <div id="cta" class="cta" hidden>
          <div class="note">هنوز هم دیر نشده ✨</div>
          <a class="cta-btn" href="https://bitpin.ir/signup/?refcode=we45xr7yih" target="_blank" rel="noopener">خرید آسان رمزارز</a>
        </div>
      </div>
      <button id="fab" class="fab">محاسبه گر</button>
    </div>
  `;

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
    @font-face{font-family:"YekanX";src:local("YekanX"),local("Yekan X");font-display:swap}
    @font-face{
      font-family:"Vazirmatn";
      src:url("https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn/Vazirmatn[wght].woff2") format("woff2");
      font-weight:100 900; font-display:swap;
    }
    :root{
      --bg:#0d1117; --bg2:#0b0f14; --line:#1f2630; --muted:#9aa4af; --text:#e6edf3;
      --acc:#1BAF7F; --acc2:#21D59B; --link:#9fdac6; --panel:#0a0f15;
    }
    .snpp-wrap, .snpp-wrap *{ font-family:"YekanX","Vazirmatn",system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,Arial,sans-serif !important; color:var(--text); letter-spacing:.1px; direction: rtl; }
    .snpp-card{ position:fixed;top:20px;right:20px;width:480px;min-height:560px;background:var(--bg);border-radius:18px;box-shadow:0 10px 34px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column;z-index:999999 }
    .snpp-top{ display:flex;align-items:center;justify-content:space-between;background:#0b0f14;border-bottom:1px solid var(--line);padding:8px 12px;cursor:grab }
    .title{font-size:13px;font-weight:700}
    <div class="snpp-top" id="dragHandle">
      <div class="title">محاسبه گر هزینه های اسنپ</div>
      <div class="top-acts">
        <button id="btn-log" class="icon" title="دانلود لاگ">⤓</button>
        <button id="close" class="icon" title="بستن">×</button>
      </div>
    </div>
    .top-acts{display:flex;gap:6px}
    .icon{border:none;border-radius:8px;background:#151b23;color:var(--text);cursor:pointer;font-size:12px;padding:6px 10px}
    #close.icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;padding:0}
    .shot{display:flex;flex-direction:column;gap:10px;padding:12px;max-height:58vh;overflow:auto}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .box{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:10px}
    .k{font-size:11px;color:var(--muted)}
    .v{font-size:18px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums;font-feature-settings:"lnum" 1,"tnum" 1;}
    .sub{margin-top:6px;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .usd-box{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:10px}
    .cap{display:flex;align-items:center;justify-content:space-between;color:#cbd5df;font-size:12px;font-weight:600}
    .switch{background:#0f1620;border:1px solid var(--line);border-radius:10px;display:flex;gap:4px;padding:3px}
    .switch .tab{border:none;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer;background:transparent;color:#9fb3c3;font-size:12px}
    .switch .tab.on{background:#1f2630;color:var(--text)}
    .rows{margin-top:8px;display:grid;gap:6px}
    .line{display:flex;align-items:center;gap:6px;font-size:13px} /* کمی نزدیک تر */
    .unit{opacity:.9;margin-right:4px}
    .pct{margin-right:4px;font-size:12px;font-weight:400;opacity:.9} /* نزدیک تر به عدد */
    .chart-head{margin:2px 0 8px;color:#9fb3c3;font-size:11px}
    .rows .line:nth-child(1){
      position:relative;
      justify-content:center;   /* عدد و درصد در مرکز */
    }
    .rows .line:nth-child(1) span:first-child{ /* "اندوخته تا امروز:" */
     position:absolute; right:0;
    }
   .rows .line:nth-child(1) .unit{            /* "USDT" */
      position:absolute; left:0;
    }
    .rows .line:nth-child(2){
    position:relative;
    justify-content:center;
    }
    .rows .line:nth-child(2) span:first-child{ /* "ارزش امروز:" */
    position:absolute; right:0;
    }
    .rows .line:nth-child(2) .unit{            /* "تومان" */
    position:absolute; left:0;
    }

    .chart{height:90px;border:1px dashed #223043;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--panel)}
    .chart-legend{display:flex;gap:14px;align-items:center;justify-content:flex-start;margin-top:6px;padding:0 4px 2px}
    .chart-legend .swatch{--c:#999;display:inline-block;width:22px;height:2px;background:var(--c);border-radius:99px;margin:0 6px 0 0;vertical-align:middle}
    .chart-legend span{color:#9fb3c3;font-size:11px;display:inline-flex;align-items:center}
    .foot{text-align:center;font-size:10px;color:#7b8792;padding:2px 0 4px}
    .foot a{color:var(--link);text-decoration:none}
    .ctrl{
    display:flex;
    gap:6px;
    justify-content:flex-end; /* بچسب به راست */
    padding:8px 12px;
    border-top:1px solid var(--line);
    background:linear-gradient(0deg,#0b0f14,transparent);
    direction:ltr;            /* چون DOM: save, share, start ـه؛ با LTR آخرین دکمه (start) میره گوشه راست */
  }
    .btn{border:none;border-radius:9px;cursor:pointer;background:#1f2630;font-weight:600;color:var(--text);padding:6px 10px;font-size:12px}
    .btn.xs{padding:5px 9px;font-size:11.5px;border-radius:8px}
    .btn:hover{filter:brightness(1.08)}
    .btn[disabled]{opacity:.55;cursor:not-allowed}
    .btn.primary{background:#1BAF7F;color:#091217}
    .btn.outline{background:#151b23;border:1px solid #1f2630;color:var(--text)}
    .progress{padding:8px 12px;border-top:1px solid #1f2630;background:#0b0f14}
    .bar{width:100%;height:7px;background:#121a24;border-radius:999px;overflow:hidden;margin-bottom:6px}
    .fill{display:block;height:100%;width:100%;background:linear-gradient(90deg,#21D59B,#1BAF7F);animation:indef 1.1s infinite}
    @keyframes indef{0%{transform:translateX(-100%)}50%{transform:translateX(0)}100%{transform:translateX(100%)}}
    .lastlog{color:#9aa4af;font-size:11px;text-align:center;min-height:14px}
    .cta{padding:8px 12px;border-top:1px solid #1f2630;display:flex;flex-direction:column;gap:8px;align-items:center}
    .cta .note{color:#cbd5df;font-size:12px}
    .cta .cta-btn{display:block;width:100%;text-align:center;background:#1BAF7F;color:#091217;font-weight:800;border-radius:10px;padding:10px 0;text-decoration:none;font-size:13px; font-family:"YekanX","Vazirmatn",system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,Arial,sans-serif !important;}
    .fab{position:fixed;top:20px;right:20px;background:#1BAF7F;color:#091217;border:none;border-radius:10px;padding:8px 12px;box-shadow:0 10px 24px rgba(0,0,0,.25);cursor:pointer;font-weight:800;display:none}
    @media (max-width:480px){ .snpp-card{width:92vw;min-height:86vw} .chart{height:86px} }
  `;
  document.head.appendChild(css);

  /* ---------- refs ---------- */
  const $card = $("#snpp-card", root);
  const $handle = $("#dragHandle", root);
  const $btnStart = $("#btn-start", root);
  const $btnShare = $("#btn-share", root);
  const $btnSave  = $("#btn-save" , root);
  const $btnLog   = $("#btn-log"  , root);
  const $close = $("#close", root);
  const $fab = $("#fab", root);
  const $shot = $("#shot-area", root);
  const $progress = $("#progress", root);
  const $cta = $("#cta", root);
  const $last = $("#lastlog", root);
  const $done = $("#stat-done", root);
  const $sum  = $("#stat-sum", root);
  const $sumNote = $("#stat-sum-note", root);
  const $range= $("#stat-range", root);
  const $amount = $("#asset-amount", root);
  const $value  = $("#asset-value", root);
  const $unit   = $("#asset-unit", root);
  const $pct    = $("#asset-pct", root);
  const $chart  = $("#cmp-chart", root);

  /* ---------- drag ---------- */
  let drag=false, offX=0, offY=0;
  const down=e=>{drag=true;$handle.style.cursor="grabbing";const r=$card.getBoundingClientRect();const x=e.touches?e.touches[0].clientX:e.clientX;const y=e.touches?e.touches[0].clientY:e.clientY;$card.style.left=`${r.left}px`; $card.style.top=`${r.top}px`; $card.style.right="auto"; offX=x-r.left;offY=y-r.top;e.preventDefault();}
  const move=e=>{if(!drag)return;const x=e.touches?e.touches[0].clientX:e.clientX;const y=e.touches?e.touches[0].clientY:e.clientY;const W=innerWidth,H=innerHeight,w=$card.offsetWidth,h=$card.offsetHeight;const L=Math.max(8,Math.min(W-w-8,x-offX));const T=Math.max(8,Math.min(H-h-8,y-offY));$card.style.left=`${L}px`;$card.style.top=`${T}px`;}
  const up=()=>{drag=false;$handle.style.cursor="grab";}
  $handle.addEventListener("mousedown",down); window.addEventListener("mousemove",move); window.addEventListener("mouseup",up);
  $handle.addEventListener("touchstart",down,{passive:false}); window.addEventListener("touchmove",move,{passive:false}); window.addEventListener("touchend",up);

  /* ---------- logs ---------- */
  let logs = [];

function pushLog(level, msg, extra){
  try {
    if (!logs) logs = [];
    logs.push({ ts:new Date().toISOString(), level, msg, ...(extra ? {extra} : {}) });
    if ($last && !$progress.hidden) $last.textContent = msg || "";
  } catch {}
}

function downloadLogs(){
  try {
    const blob = new Blob([JSON.stringify(logs||[], null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `snapp-logs-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 600);
  } catch {}
}

$btnLog && ($btnLog.onclick = downloadLogs);

  /* ---------- progress & CTA ---------- */
  const inflight = { USD:false, BTC:false };
  const startProgress=(txt="در حال پردازش…")=>{ if($progress){$progress.hidden=false;} if($cta){$cta.hidden=true;} if($last){$last.textContent=txt;} };
  const stopProgress = ()=>{ if (!inflight.USD && !inflight.BTC && $progress) $progress.hidden=true; };
  const showCTA = ()=>{ if (!inflight.USD && !inflight.BTC && $cta) $cta.hidden=false; };
  const setBusy = (b)=>{ if($btnStart){ $btnStart.disabled=!!b; $btnStart.textContent=b?"در حال محاسبه…":"شروع محاسبه"; } };

  /* ---------- SVG chart ---------- */
  function drawChart(series){
    if(!$chart) return;
    let W=$chart.clientWidth||0, H=$chart.clientHeight||0;
    if (!W) W = 400; if (!H) H = 150;
    const P=16;
    const svg = (tag,attrs,children=[])=>{
      const el=document.createElementNS("http://www.w3.org/2000/svg",tag);
      Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,String(v)));
      children.forEach(c=>el.appendChild(c)); return el;
    };
    $chart.innerHTML = "";
    const root=svg("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`}); $chart.appendChild(root);
    const safe = (arr)=> (Array.isArray(arr)?arr:[]).map(v=>+v||0);
    const arrays = [safe(series.toman), safe(series.usdt), safe(series.btc)].filter(a=>a.length);
    const max = Math.max(1, ...arrays.flat().map(n=>+n||0));
    const steps = Math.max(1, (series.days?.length||0)-1);
    const xStep = (W-2*P)/steps;
    const y = v => H-P - ((+v||0)/max)*(H-2*P);
    const path = arr => safe(arr).map((v,i)=>`${i?"L":"M"}${P+i*xStep},${y(v)}`).join(" ");
    for(let i=0;i<4;i++){
      const gy = P + i*(H-2*P)/3;
      root.appendChild(svg("line",{x1:P,y1:gy,x2:W-P,y2:gy,stroke:"#223042","stroke-width":"1",opacity:"0.35"}));
    }
    if (safe(series.toman).length) root.appendChild(svg("path",{d:path(series.toman),fill:"none",stroke:"#8899a6","stroke-width":"1.6"}));
    if (safe(series.usdt ).length) root.appendChild(svg("path",{d:path(series.usdt ),fill:"none",stroke:"#21D59B","stroke-width":"1.6"}));
    if (safe(series.btc  ).length) root.appendChild(svg("path",{d:path(series.btc  ),fill:"none",stroke:"#ffb703","stroke-width":"1.6"}));
  }

  /* ---------- UI controls + % diff ---------- */
  const $tabs = $$(".switch .tab", root);
  let currentAsset = "USDT";
  function setTab(asset){
    currentAsset = asset;
    $tabs.forEach(x=>x.classList.toggle("on", x.dataset.asset===asset));
    if ($unit) $unit.textContent = asset;
    renderFromCache();
  }
  (function bindTabsSafe(){
    for (let i=0;i<$tabs.length;i++){
      const b = $tabs[i];
      b.onclick = ()=> setTab(b.dataset.asset === "BTC" ? "BTC" : "USDT");
    }
  })();

  const onStartClick = ()=>{
    logs=[]; cacheUSD=null; cacheBTC=null; inflight.USD=false; inflight.BTC=false;
    if($btnShare) $btnShare.disabled=true; if($btnSave) $btnSave.disabled=true;
    startProgress("در حال محاسبه سفرها…"); setBusy(true); setTab("USDT");
    send("start");
  };
  $btnStart && ($btnStart.onclick = onStartClick);


/* ---------- share (X.com / Quote Post) ---------- */

// تابع کمکی برای تمیزسازی URL یا ID پست مبدا (برای quote)
function canonicalXUrl(input) {
  if (!input) return "";
  // اگه فقط عدد نیست، سعی کن ID خالص رو دربیاری
  const idMatch = String(input).match(/(\d{10,})/);
  const id = idMatch ? idMatch[1] : null;
  if (id) return `https://x.com/i/web/status/${id}`;
  // اگه خودش لینک سالمه، ولی query داره، پاکش کن
  try {
    const u = new URL(input);
    u.search = "";
    return u.toString();
  } catch {
    return "";
  }
}


/* ---------- share (X.com / simple post, no quote) ---------- */
$btnShare && ($btnShare.onclick = () => {
  const trips  = $done?.textContent.trim() || "";
  const range  = $range?.textContent.trim() || "";
  const sumT   = $sum?.textContent.trim() || "";

  const usdAmt = +(cacheUSD?.totalUSD || 0);
  const usdNow = +(cacheUSD?.priceNow  || 0);
  //const usdValT= usdNow ? Math.round(usdAmt * usdNow / 10) : 0;
  const usdValT = usdNow ? Math.round(usdAmt * usdNow) : 0; // IRT = تومان

  const btcAmt = +(cacheBTC?.totalBTC || 0);
  const btcNow = +(cacheBTC?.priceNow  || 0);
  //const btcValT= btcNow ? Math.round(btcAmt * btcNow / 10) : 0;
  const btcValT = btcNow ? Math.round(btcAmt * btcNow) : 0;

  const usdPct = usdValT ? Math.round(computePctDiff(usdValT) || 0) : null;
  const btcPct = btcValT ? Math.round(computePctDiff(btcValT) || 0) : null;
  const pctStr = (p) => p == null ? "—" : `${p > 0 ? "+" : ""}${p}%`;

  const text =
`یه حساب سرانگشتی از هزینه های اسنپ من 🚕
${trips} سفر (${range})
جمع هزینه: ${sumT} تومان
به عبارتی معادل:
${toEn(usdAmt.toFixed(2))} تتر (حدودا: ${toEn(usdValT)} تومان)
یا ${toEn(btcAmt.toFixed(6))} بیتکوین (حدودا ${toEn(btcValT)} تومان)

@alirezachain`;

  const params = new URLSearchParams();
  params.set("text", text);

  // endpoint رسمی X برای پست جدید
  const intent = "https://x.com/intent/post?" + params.toString();
  window.open(intent, "_blank", "noopener");
});


  $close && ($close.onclick = ()=>{ $card.style.display="none"; $fab.style.display="inline-flex"; });
  $fab   && ($fab.onclick   = ()=>{ $card.style.display="flex"; $fab.style.display="none"; });

  try{ chrome?.runtime?.onMessage?.addListener(m=>{ if(m?.type==="SNAPP_OPEN_UI"){ $card.style.display="flex"; $fab && ($fab.style.display="none"); } }); }catch{}

  /* ---------- cache & state ---------- */
  let cacheUSD = null;   // { totalUSD, priceNow, perDay, series:{usdt}, days }
  let cacheBTC = null;   // { totalBTC, priceNow, perDay, series:{btc},  days }
  let byDay=null, totalIRT=0, firstISO=null, firstJalali=null;

  function buildTomanSeries(days, perDayMap){
    let t=0; const out=[];
    for (const d of days){ t += toman((perDayMap[d]?.rial || 0)); out.push(t); }
    return out;
  }
  function mergePerDay(){ return (cacheUSD?.perDay) || (cacheBTC?.perDay) || {}; }

  // % اختلاف = (ارزش فعلی - اصل) / اصل
  function computePctDiff(currentToman){
    if (!byDay) return null;
    const days = Object.keys(byDay).sort();
    const principal = buildTomanSeries(days, mergePerDay()).slice(-1)[0] || 0;
    if (!principal || !currentToman) return null;
    return ((currentToman - principal) / principal) * 100;
  }
  function renderPct(diff){
    if(!$pct){return;}
    if (diff == null){ $pct.textContent=""; return; }
    const sign = diff >= 0 ? "+" : "";
    const rounded = Math.round(diff);
    $pct.textContent = `(${sign}${toEn(rounded)}%)`;
    $pct.style.color = diff >= 0 ? "#21D59B" : "#ff6b6b";
    $pct.style.fontWeight = "400";
    $pct.style.opacity = ".9";
    $pct.style.fontSize = "12px";
  }

  function setSumNote(sumToman){
    if(!$sumNote) return;
    let txt = "";
    if (sumToman >= 150_000_000) txt = "شما یه ماشین با رننده دربست بگیر 😒";
    else if (sumToman >= 100_000_000) txt = "تبریک میگم! شما اسنپ رو پولدار کردی 🤗";
    else if (sumToman >= 50_000_000) txt = "اوه اوه، خرجت زیاده  🤯";
    else if (sumToman >= 20_000_000) txt = "هزینه‌هات داره میره بالا 😐";
    else if (sumToman > 0) txt = "اوکیه، مدیریت هزینه‌ت خوبه 👌";
    $sumNote.textContent = txt;
  }

  function renderFromCache(){
    if (currentAsset==="USDT" && cacheUSD){
      const usd=+cacheUSD.totalUSD||0, now=+cacheUSD.priceNow||0;
      const valT = now ? Math.round(usd * now) : 0;
      if ($amount) $amount.textContent = toEn(usd.toFixed ? +usd.toFixed(2) : usd);
      if ($value)  $value.textContent  = valT? toEn(valT) : "—";
      renderPct(valT? computePctDiff(valT) : null);
    } else if (currentAsset==="BTC" && cacheBTC){
      const btc=+cacheBTC.totalBTC||0, now=+cacheBTC.priceNow||0;
      const valT = now ? Math.round(btc * now) : 0;
      if ($amount) $amount.textContent = toEn(btc.toFixed ? +btc.toFixed(6) : btc);
      if ($value)  $value.textContent  = valT? toEn(valT) : "—";
      renderPct(valT? computePctDiff(valT) : null);
    } else {
      if ($amount) $amount.textContent = "—";
      if ($value)  $value.textContent  = "—";
      renderPct(null);
    }

    if (!byDay) return;
    const days = Object.keys(byDay).sort();
    const tomanSeries = buildTomanSeries(days, mergePerDay());
    const usdtSeries  = cacheUSD?.series?.usdt || [];
    const btcSeries   = cacheBTC?.series?.btc  || [];
    drawChart({ days, toman: tomanSeries, usdt: usdtSeries, btc: btcSeries });

    if ((cacheUSD || cacheBTC)) { if($btnShare) $btnShare.disabled=false; if($btnSave) $btnSave.disabled=false; }
    if (!inflight.USD && !inflight.BTC){ stopProgress(); showCTA(); setBusy(false); }
  }

  function startBothCalculations(){
    if (!byDay) return;
    if (!cacheUSD && !inflight.USD) { inflight.USD=true; startProgress("محاسبه USDT…"); send("calcUSD",{ byDay }); }
    if (!cacheBTC && !inflight.BTC) { inflight.BTC=true; startProgress("محاسبه BTC…");  send("calcBTC",{ byDay }); }
  }

  /* ---------- bus ---------- */
  window.addEventListener("message",(ev)=>{
    const d = ev.data;

    if (d?.source === "SNAPP_CALC") {
      const { type, payload } = d;
      if (type==="log") pushLog(payload?.level||"INFO", payload?.msg||"", payload?.extra);
      if (type==="update" || type==="done") {
        totalIRT = payload.totalIRT|0; byDay = payload.byDay || byDay;
        firstISO = payload.firstISO || firstISO; firstJalali = payload.firstJalali || firstJalali;
        if ($done) $done.textContent = toEn(payload.completed|0);
        if ($sum)  { const sumT = toman(totalIRT); $sum.textContent  = toEn(sumT); setSumNote(sumT); }
        const fromFa = firstISO?fmtFa(firstISO):(firstJalali||"—");
        if ($range) $range.textContent = enDigits(`از ${fromFa} تا ${todayFa()}`);
        if (type==="done"){ startBothCalculations(); }
      }
    }

    if (d?.source === "SNAPP_USD" || d?.source === "SNAPP_BTC") {
      const { type, payload } = d;
      if (type==="log"){ pushLog(payload?.level||"INFO", payload?.msg||"", payload?.extra); }
    }

    if (d?.source === "SNAPP_USD") {
      const { type, payload } = d;
      if (type==="error"){ inflight.USD=false; stopProgress(); showCTA(); setBusy(false); pushLog("ERR", payload?.msg||"USD error"); }
      if (type==="result"){
        inflight.USD=false;
        const days = Object.keys(payload.perDay||{}).sort();
        let cumUSD=0; const sU=[];
        for (const day of days){
          const row=payload.perDay[day]||{};
          if (row.usd) cumUSD += row.usd;
          const close=row.close||payload.priceNow||0;
          sU.push( close ? Math.round(cumUSD * close) : (sU.length ? sU[sU.length-1] : 0) );
        }
        cacheUSD = { totalUSD:+payload.totalUSD||0, priceNow:+payload.priceNow||0, perDay: payload.perDay||{}, series:{ usdt:sU } };
        renderFromCache();
      }
    }

    if (d?.source === "SNAPP_BTC") {
      const { type, payload } = d;
      if (type==="error"){ inflight.BTC=false; stopProgress(); showCTA(); setBusy(false); pushLog("ERR", payload?.msg||"BTC error"); }
      if (type==="result"){
        inflight.BTC=false;
        const days = Object.keys(payload.perDay||{}).sort();
        let cumBTC=0; const sB=[];
        for (const day of days){
          const row=payload.perDay[day]||{};
          if (row.btc) cumBTC += row.btc;
          const close=row.close||payload.priceNow||0;
          sB.push( close ? Math.round(cumBTC * close) : (sB.length ? sB[sB.length-1] : 0) );
        }
        cacheBTC = { totalBTC:+payload.totalBTC||0, priceNow:+payload.priceNow||0, perDay: payload.perDay||{}, series:{ btc:sB } };
        renderFromCache();
      }
    }
  });

/* ==================== PURE-SVG EXPORT (RTL polished: bigger title, rounded, fixed labels/percents) ==================== */
/* ==================== PURE-SVG EXPORT (+ sum note in image) ==================== */
function _numEn(x, digits) {
  const n = +x || 0;
  const val = (digits != null ? n.toFixed(digits) : n);
  return new Intl.NumberFormat("en-US").format(+val);
}
function _esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* NEW: ساده‌ترین پارسر برای تبدیل متن 74,026,500 → عدد */
function _toNum(s){
  return +String(s || "").replace(/[^\d.-]/g,"") || 0;
}

/* NEW: همون منطق نوت جمع هزینه که تو مودال داری، برای خروجی عکس */
function _toNum(s){ return +String(s || "").replace(/[^\d.-]/g,"") || 0; }
function _sumNoteText(sumToman){
  let txt="";
  if (sumToman >= 150_000_000) txt="😒 شما یه ماشین با رننده دربست بگیر";
  else if (sumToman >= 100_000_000) txt="🤗 تبریک میگم! شما اسنپ رو پولدار کردی";
  else if (sumToman >= 50_000_000)  txt="🤯 اوه اوه، خرجت زیاده ";
  else if (sumToman >= 20_000_000)  txt="😐 هزینه‌هات داره میره بالا";
  else if (sumToman > 0)            txt="👌 اوکیه، مدیریت هزینه‌ت خوبه";
  return txt;
}

function _collectExportDataBoth(){
  const t = id => (document.getElementById(id)?.textContent || "").trim();
  const title = t("page-title") || "محاسبه‌گر هزینه‌های اسنپ";
  const trips = t("stat-done");
  const range = t("stat-range");
  const sumT  = t("stat-sum");

  let days=[], tomanArr=[], usdtVal=[], btcVal=[];
  try{
    if (byDay) {
      days = Object.keys(byDay).sort();

      // از perDay هر کدوم آماده‌تر بود استفاده کن (اولویت با فیلد جدید IRT)
      const per = (cacheUSD?.perDay) || (cacheBTC?.perDay) || {};
      let acc = 0;
      tomanArr = days.map(d => {
        const irt =
          (per[d]?.tomanIRT != null) ? per[d].tomanIRT :
          (per[d]?.irt != null)       ? per[d].irt :
          Math.round((per[d]?.rialIRR ?? per[d]?.rial ?? 0) / 10);
        acc += Math.round(+irt || 0);
        return acc;
      });
    }
    usdtVal = cacheUSD?.series?.usdt || [];
    btcVal  = cacheBTC?.series?.btc  || [];
  }catch{}

  const usdAmt = +((cacheUSD?.totalUSD)||0);
  const usdNow = +((cacheUSD?.priceNow)||0);  // IRT
  const usdValNowToman = usdNow ? Math.round(usdAmt * usdNow) : 0;

  const btcAmt = +((cacheBTC?.totalBTC)||0);
  const btcNow = +((cacheBTC?.priceNow)||0);  // IRT
  const btcValNowToman = btcNow ? Math.round(btcAmt * btcNow) : 0;

  const principal = tomanArr.length ? tomanArr[tomanArr.length-1] : 0;
  const pct = (cur) => (principal>0 && cur>0) ? (((cur - principal)/principal)*100) : null;
  const sumTNum  = _toNum(sumT);
  const sumNote  = _sumNoteText(sumTNum);

  return {
    title, trips, range, sumT,
    days, toman: tomanArr, usdtVal, btcVal,
    usdAmt, usdValNowToman, usdPct: pct(usdValNowToman),
    btcAmt, btcValNowToman, btcPct: pct(btcValNowToman),
    sumNote
  };
}


function _linePathLinear(vals, W, H, P, max){
  const arr = (Array.isArray(vals)?vals:[]).map(v=>+v||0);
  if (!arr.length) return "";
  const n   = arr.length;
  const xSt = n>1 ? (W-2*P)/(n-1) : 0;
  const y = v => H-P - (v/max)*(H-2*P);
  let d=""; for (let i=0;i<n;i++){ const x=P+i*xSt, yy=y(arr[i]); d+=(i?"L":"M")+x.toFixed(2)+","+yy.toFixed(2); }
  return d;
}

function _buildExportSVG(data, opt = {}) {
  const W = opt.width || 620;
  const pad = 18, cardR = 22;

  const topH = 40;
  const statsH = 124;
  const gap1 = 12;

  const investH = 118;
  const gap2 = 10;

  const chartTitleH = 24;
  const chartH = 190;
  const footH = 20;

  const innerW = W - pad * 2;
  const half = (innerW - 12) / 2;
  const boxR = 16;

  const H = pad + topH + statsH + gap1 + investH + gap2 + chartTitleH + chartH + pad + footH;

  const safe = a => (Array.isArray(a) ? a : []).map(v => +v || 0);
  const arrays = [safe(data.toman), safe(data.usdtVal), safe(data.btcVal)].filter(a => a.length);
  const max = Math.max(1, ...arrays.flat());

  const chartW = innerW, chartP = 16;
  const pathT = _linePathLinear(data.toman,   chartW, chartH, chartP, max);
  const pathU = _linePathLinear(data.usdtVal, chartW, chartH, chartP, max);
  const pathB = _linePathLinear(data.btcVal,  chartW, chartH, chartP, max);

  // YekanX روی همه متن‌های SVG
  const txt = (x, y, t, fs = 12, fw = 400, fill = "#e6edf3", anchor = "start") =>
    `<text x="${x}" y="${y}" font-family="'YekanX','Vazirmatn',system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Arial,sans-serif" font-size="${fs}" font-weight="${fw}" fill="${fill}" text-anchor="${anchor}" style="font-family:'YekanX','Vazirmatn',system-ui !important;">${_esc(t)}</text>`;

  let grid = "";
  for (let i = 0; i < 4; i++) {
    const y = chartP + i * (chartH - 2 * chartP) / 3;
    grid += `<line x1="${chartP}" y1="${y}" x2="${chartW - chartP}" y2="${y}" stroke="#223042" stroke-width="1" opacity="0.35"/>`;
  }

  const colGap = 20;
  const colW = (innerW - colGap * 2) / 3;

  const xLabel = pad + innerW - 14;
  const xBTC   = xLabel - colGap - colW;
  const xUSDT  = xBTC   - colGap - colW;

  const usdAmtStr  = `${_numEn(data.usdAmt, 2)} USDT`;
  const btcAmtStr  = `${_numEn(data.btcAmt, 6)} BTC`;
  const pctChip = p => (p == null ? "" : `(${p >= 0 ? "+" : ""}${_numEn(Math.round(p))}%)`);
  const usdValOnly = _numEn(data.usdValNowToman);
  const btcValOnly = _numEn(data.btcValNowToman);

  const colorPos = "#21D59B", colorNeg = "#ff6b6b";
  const usdPctColor = (data.usdPct != null && data.usdPct < 0) ? colorNeg : colorPos;
  const btcPctColor = (data.btcPct != null && data.btcPct < 0) ? colorNeg : colorPos;

  const legend = (() => {
    const y = chartH - 10;
    const startX = chartW - 10;
    const item = (x, color, label) => `
      <g>
        <line x1="${x - 40}" y1="${y}" x2="${x - 22}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        ${txt(x - 46, y + 4, label, 11, 600, "#9fb3c3", "end")}
      </g>`;
    const step = 78;
    return `
      ${item(startX,               "#ffb703", "BTC")}
      ${item(startX - step,        "#21D59B", "USDT")}
      ${item(startX - step * 2,    "#8899a6", "تومان")}
    `;
  })();

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="clip-card"><rect x="0" y="0" width="${W}" height="${H}" rx="${cardR}" ry="${cardR}"/></clipPath>
    <style>
      /* تضمین YekanX در متن‌های SVG */
      text, tspan { font-family: 'YekanX','Vazirmatn',system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Arial,sans-serif !important; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="${cardR}" ry="${cardR}" fill="#0d1117"/>

  <!-- عنوان با YekanX قطعی -->
  <text x="${W/2}" y="${pad+22}" font-family="'YekanX','Vazirmatn',sans-serif" font-size="15" font-weight="800" fill="#e6edf3" text-anchor="middle" style="font-family:'YekanX','Vazirmatn',sans-serif !important;">
    ${_esc(data.title)}
  </text>

  <g transform="translate(${pad}, ${pad + topH})">
    <!-- Box: Trips -->
    <g transform="translate(${innerW - half}, 0)">
      <rect width="${half}" height="${statsH}" rx="${boxR}" fill="#0b0f14" stroke="#1f2630"/>
      ${txt(half-14, 28, "سفرها (تکمیل شده)", 11, 600, "#9aa4af","end")}
      ${txt(half-14, 66, data.trips || "—", 22, 800, "#e6edf3","end")}
      ${txt(half-14, 92, data.range || "—", 11, 500, "#9aa4af","end")}
    </g>

    <!-- Box: Sum -->
    <g transform="translate(0, 0)">
      <rect width="${half}" height="${statsH}" rx="${boxR}" fill="#0b0f14" stroke="#1f2630"/>
      ${txt(half-14, 28, "(تومان) جمع هزینه", 11, 600, "#9aa4af","end")}
      ${txt(half-14, 66, data.sumT || "—", 22, 800, "#e6edf3","end")}
      ${data.sumNote ? txt(half-14, 92, data.sumNote, 11, 500, "#9aa4af","end") : ""}
    </g>
  </g>

  <g transform="translate(${pad}, ${pad + topH + statsH + gap1})">
    <rect width="${innerW}" height="${investH}" rx="${boxR}" fill="#0b0f14" stroke="#1f2630"/>
    ${txt(pad + innerW - 30, 30, ":اگر به اندازه هزینه هر سفر، همان زمان سرمایه گذاری می کردی", 12, 700, "#cbd5df","end")}

    ${`<text x="${xBTC}" y="56" text-anchor="end" font-size="12" font-weight="800" fill="#ffca42" style="font-family:'YekanX','Vazirmatn',system-ui !important;">بیت کوین</text>`}
    ${`<text x="${xUSDT}" y="56" text-anchor="end" font-size="12" font-weight="800" fill="#21D59B" style="font-family:'YekanX','Vazirmatn',system-ui !important;">تتر</text>`}

    ${txt(xLabel - 20, 78, ":اندوخته تا امروز", 13, 600, "#e6edf3","end")}
    ${txt(xBTC,        78, _numEn(data.btcAmt, 6), 13, 800, "#e6edf3","end")}
    ${txt(xBTC + 5,    78, "BTC", 11, 500, "#9da5b4","start")}
    ${txt(xUSDT,       78, _numEn(data.usdAmt, 2), 13, 800, "#e6edf3","end")}
    ${txt(xUSDT + 5,   78, "USDT",11, 500, "#9da5b4","start")}

    ${txt(xLabel - 20, 104, ":ارزش امروز (تومان)", 13, 600, "#e6edf3","end")}
    ${txt(xBTC,        104, _numEn(data.btcValNowToman), 13, 800, "#e6edf3","end")}
    ${txt(xBTC + 6,    104, pctChip(data.btcPct), 11, 600, "#21D59B","start")}
    ${txt(xUSDT,       104, _numEn(data.usdValNowToman), 13, 800, "#e6edf3","end")}
    ${txt(xUSDT + 6,   104, pctChip(data.usdPct), 11, 600, "#21D59B","start")}
  </g>

  ${txt(W/2, pad + topH + statsH + gap1 + investH + 18, "مقایسه رشد (تومان / تتر / بیت کوین)", 11, 600, "#9fb3c3","middle")}

  <g transform="translate(${pad}, ${pad + topH + statsH + gap1 + investH + gap2 + chartTitleH})" clip-path="url(#clip-card)">
    <rect width="${chartW}" height="${chartH}" rx="12" fill="#0a0f15" stroke="#223043" stroke-dasharray="4 6" opacity="0.9"/>
    ${grid}
    ${pathT ? `<path d="${pathT}" fill="none" stroke="#8899a6" stroke-width="1.8"/>` : ""}
    ${pathU ? `<path d="${pathU}" fill="none" stroke="#21D59B" stroke-width="1.8"/>` : ""}
    ${pathB ? `<path d="${pathB}" fill="none" stroke="#ffb703" stroke-width="1.8"/>` : ""}
    ${legend}
  </g>

  <!-- فوتر با tspan شخصی‌سازی‌شده (اختیاری) -->
  ${`<text x="${W/2}" y="${H - pad - 6}" text-anchor="middle" font-size="10" font-weight="500" style="font-family:'YekanX','Vazirmatn',system-ui !important;">
      <tspan fill="#21D59B">Alireza Moftakhar</tspan>
      <tspan fill="#7b8792"> توسعه داده شده توسط </tspan>
    </text>`}
</svg>
`;
}
async function _svgToImageURL(svgStr, pref="image/png"){
  try { pushLog("DBG","[export] build.svg.ok",{len: svgStr.length}); } catch {}
  const blob = new Blob([svgStr], { type:"image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  try{
    const img = new Image();
    const loadP = new Promise((res, rej)=>{
      img.onload = res;
      img.onerror = ()=> rej(new Error("img load error"));
    });
    img.src = url;
    await loadP;

    const svgEl = new DOMParser().parseFromString(svgStr, "image/svg+xml").documentElement;
    const W = +svgEl.getAttribute("width") || 620;
    const H = +svgEl.getAttribute("height")|| 560;

    const scale = Math.min(2, devicePixelRatio || 1.5);
    const c = document.createElement("canvas");
    c.width  = Math.round(W*scale);
    c.height = Math.round(H*scale);
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0,0,W,H);
    ctx.drawImage(img, 0, 0, W, H);

    const outURL = await new Promise((res, rej)=>{
      c.toBlob(b => b ? res(URL.createObjectURL(b)) : rej(new Error("toBlob null")), pref, pref==="image/jpeg"?0.92:1);
    });
    try { pushLog("OK","[export] canvas.toBlob.ok",{mime: pref}); } catch {}
    return { ok:true, url: outURL, mime: pref };
  }catch(e){
    try { pushLog("ERR","[export] svg→img failed",{e:String(e)}); } catch {}
    return { ok:false, error:String(e) };
  }finally{
    URL.revokeObjectURL(url);
  }
}
async function saveShot(){
  try{
    const d = _collectExportDataBoth();
    const svg = _buildExportSVG(d, { width: 620 });
    

    let out = await _svgToImageURL(svg, "image/png");
    if (!out.ok) out = await _svgToImageURL(svg, "image/jpeg");
    if (!out.ok) throw new Error(out.error || "render failed");

    const a = document.createElement("a");
    a.href = out.url;
    a.download = `snapp-${Date.now()}.${out.mime==="image/png"?"png":"jpg"}`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(out.url), 1200);
  }catch(e){
    try { pushLog("ERR","ذخیره تصویر ناموفق بود",{ e:String(e) }); } catch {}
  }
}
  const $btnSave2 = $("#btn-save", root);
  $btnSave2 && ($btnSave2.onclick  = saveShot);
})();
