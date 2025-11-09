// background.js — MV3: robust capture + crop + runtime host-permission request + verbose stages

const logStage = (stages, name, extra={}) => {
  const item = { t: Date.now(), name, ...extra };
  try { console.debug("[SNAPP][bg]", item); } catch {}
  stages.push(item);
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: "SNAPP_OPEN_UI" }); } catch {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "OPEN_TAB" && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse?.({ ok: true });
    return;
  }

  if (msg.type === "SNAPP_CAPTURE_CROP") {
    const stages = [];
    (async () => {
      try {
        const { rect, dpr } = msg;
        logStage(stages, "recv", { rect, dpr });

        // 1) resolve active tab + origin
        const tabId = sender?.tab?.id;
        const winId = sender?.tab?.windowId;
        let tab;
        try { tab = tabId ? await chrome.tabs.get(tabId) : null; } catch {}
        const url = tab?.url || "";
        let origin = "";
        try { origin = new URL(url).origin + "/*"; } catch {}
        logStage(stages, "tab.info", { tabId, winId, url, origin });

        // 2) ensure host permission (origin → fallback <all_urls>)
        async function hasOrigins(origins) {
          return await chrome.permissions.contains({ origins });
        }
        async function reqOrigins(origins) {
          return await chrome.permissions.request({ origins });
        }

        let have = false, granted = false;

        if (origin) {
          have = await hasOrigins([origin]);
          logStage(stages, "perm.check.origin", { origin, have });
          if (!have) {
            granted = await reqOrigins([origin]).catch(()=>false);
            logStage(stages, "perm.request.origin", { origin, granted });
          } else {
            granted = true;
          }
        }

        // اگر هنوز نداریم، تلاش برای <all_urls>
        if (!granted) {
          have = await hasOrigins(["<all_urls>"]);
          logStage(stages, "perm.check.all", { have });
          if (!have) {
            const grantedAll = await reqOrigins(["<all_urls>"]).catch(()=>false);
            logStage(stages, "perm.request.all", { granted: grantedAll });
            granted = grantedAll;
          } else {
            granted = true;
          }
        }

        if (!granted) {
          logStage(stages, "perm.failed");
          sendResponse?.({ ok:false, error:"host permission not granted", stages });
          return;
        }

        // 3) captureVisibleTab (with windowId → fallback noId)
        const capOnce = (withId) => new Promise((res) => {
          const cb = (dataUrl) => {
            const lr = chrome.runtime.lastError?.message;
            if (lr) logStage(stages, "capture.cb.lastError", { lr });
            res(dataUrl ? { ok:true, dataUrl } : { ok:false, err: lr || "no dataUrl" });
          };
          try {
            if (withId && winId != null) {
              logStage(stages, "capture.call.withId", { winId });
              chrome.tabs.captureVisibleTab(winId, { format: "png" }, cb);
            } else {
              logStage(stages, "capture.call.noId");
              chrome.tabs.captureVisibleTab({ format: "png" }, cb);
            }
          } catch (e) {
            logStage(stages, "capture.call.throw", { e:String(e), withId });
            res({ ok:false, err:String(e) });
          }
        });

        let cap = await capOnce(true);
        logStage(stages, "capture.res1", { ok:cap.ok, err:cap.err, len:cap.dataUrl?.length });
        if (!cap.ok) {
          cap = await capOnce(false);
          logStage(stages, "capture.res2", { ok:cap.ok, err:cap.err, len:cap.dataUrl?.length });
        }
        if (!cap.ok) {
          sendResponse?.({ ok:false, error:cap.err||"capture failed", stages });
          return;
        }

        // 4) crop (OffscreenCanvas)
        const sx = Math.max(0, Math.round(rect.x * (dpr||1)));
        const sy = Math.max(0, Math.round(rect.y * (dpr||1)));
        const sw = Math.max(1, Math.round(rect.w * (dpr||1)));
        const sh = Math.max(1, Math.round(rect.h * (dpr||1)));
        logStage(stages, "crop.params", { sx, sy, sw, sh });

        const resp = await fetch(cap.dataUrl);
        const blob = await resp.blob();
        logStage(stages, "crop.blob", { size: blob.size });

        let bmp;
        try {
          bmp = await createImageBitmap(blob);
          logStage(stages, "crop.bitmap", { w: bmp.width, h: bmp.height });
        } catch (e) {
          // fallback Image() for older chromium
          logStage(stages, "crop.bitmap.fallback", { e:String(e) });
          const dataUrl = cap.dataUrl;
          bmp = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
          });
        }

        const oc = new OffscreenCanvas(sw, sh);
        const ctx = oc.getContext("2d");
        ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
        logStage(stages, "crop.drawn");

        const outBlob = await oc.convertToBlob({ type:"image/png" });
        logStage(stages, "crop.toBlob", { size: outBlob.size });

        const fr = new FileReader();
        fr.onloadend = () => {
          logStage(stages, "encode.dataURL", { len: String(fr.result).length });
          sendResponse?.({ ok:true, dataUrl: String(fr.result), stages });
        };
        fr.readAsDataURL(outBlob);
      } catch (e) {
        logStage(stages, "error.catch", { e:String(e) });
        sendResponse?.({ ok:false, error:String(e), stages });
      }
    })();

    return true; // async
  }
});
