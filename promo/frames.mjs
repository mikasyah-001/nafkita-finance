// Bingkai ponsel (HTML/CSS murni, tanpa logo merek) untuk mockup promosi.
// Ukuran dalam CSS px; dirender oleh Playwright pada deviceScaleFactor tinggi.
import { DEVICES } from "./capture.mjs";

export const BG = { light: "hsl(50 30% 96%)", dark: "hsl(165 24% 7%)" };
const INK = { light: "#0f1f1a", dark: "#f3f1ea" };

const iosIcons = (c) => `
<svg width="19" height="12" viewBox="0 0 19 12"><g fill="${c}">
<rect x="0" y="8" width="3.2" height="4" rx="1"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1"/>
<rect x="10" y="3" width="3.2" height="9" rx="1"/><rect x="15" y="0" width="3.2" height="12" rx="1"/></g></svg>
<svg width="17" height="12" viewBox="0 0 17 12"><path fill="${c}" d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.3-1.3A10.6 10.6 0 0 0 8.5.4 10.6 10.6 0 0 0 .9 3.5l1.3 1.3A8.8 8.8 0 0 1 8.5 2.3Zm0 3.7c1.4 0 2.7.5 3.7 1.4l1.3-1.3a7.2 7.2 0 0 0-10 0l1.3 1.3c1-.9 2.3-1.4 3.7-1.4Zm0 3.6c-.5 0-1 .2-1.3.6l1.3 1.4 1.3-1.4c-.3-.4-.8-.6-1.3-.6Z"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="${c}" opacity=".4"/>
<rect x="2" y="2" width="18" height="9" rx="2.4" fill="${c}"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="${c}" opacity=".45"/></svg>`;

const androidIcons = (c) => `
<svg width="16" height="16" viewBox="0 0 24 24"><path fill="${c}" d="M12 21 1 9.3a15.6 15.6 0 0 1 22 0Z"/></svg>
<svg width="16" height="16" viewBox="0 0 24 24"><path fill="${c}" d="M2 22 22 2v20Z"/></svg>
<svg width="16" height="16" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="${c}" stroke-width="1.8"/><rect x="9" y="7" width="6" height="12.5" rx=".8" fill="${c}"/><rect x="10" y="1" width="4" height="2" rx=".6" fill="${c}"/></svg>`;

// Satu ponsel. kind: "ios" | "android"; mode: "light" | "dark"; src: path file screenshot.
export function phone({ kind, mode = "light", src, scale = 1, tilt = 0, shadow = true, id = "" }) {
  const d = DEVICES[kind];
  const ios = kind === "ios";
  const bez = ios ? 11 : 9;
  const W = d.w + bez * 2, H = d.h + bez * 2;
  const R = ios ? 66 : 50, r = ios ? 55 : 41;
  const ink = INK[mode];
  const status = ios
    ? `<div style="position:absolute;left:0;top:0;width:100%;height:${d.status}px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 46px;box-sizing:border-box">
        <span style="font:600 17px/1 -apple-system,'Inter',sans-serif;color:${ink};letter-spacing:-.2px">9:41</span>
        <span style="display:flex;gap:6px;align-items:center">${iosIcons(ink)}</span></div>
       <div style="position:absolute;left:50%;top:11px;transform:translateX(-50%);width:124px;height:36px;border-radius:20px;background:#000"></div>`
    : `<div style="position:absolute;left:0;top:0;width:100%;height:${d.status}px;display:flex;align-items:center;justify-content:space-between;padding:0 22px 0 26px;box-sizing:border-box">
        <span style="font:500 15px/1 'Inter',Roboto,sans-serif;color:${ink}">9:41</span>
        <span style="display:flex;gap:4px;align-items:center">${androidIcons(ink)}</span></div>
       <div style="position:absolute;left:50%;top:13px;transform:translateX(-50%);width:15px;height:15px;border-radius:50%;background:#050505;box-shadow:inset 0 0 0 3px #161616"></div>`;
  const indicator = ios
    ? `<div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:${ink}"></div>`
    : `<div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:110px;height:4px;border-radius:3px;background:${ink};opacity:.75"></div>`;
  const frame = ios
    // Rangka titanium: gradien logam + tombol samping.
    ? `background:linear-gradient(135deg,#9a9a96 0%,#e6e5e1 18%,#7d7d79 40%,#d9d8d3 62%,#6e6e6a 82%,#c9c8c3 100%);`
    : `background:linear-gradient(135deg,#3b3d40 0%,#8a8d91 22%,#2c2e31 48%,#7b7e82 75%,#2a2c2f 100%);`;
  const buttons = ios
    ? `<i style="left:-3px;top:180px;height:34px"></i><i style="left:-3px;top:240px;height:64px"></i><i style="left:-3px;top:318px;height:64px"></i><i style="right:-3px;top:262px;height:100px"></i><i style="right:-3px;top:430px;height:60px;width:4px;border-radius:3px"></i>`
    : `<i style="right:-3px;top:200px;height:110px"></i><i style="right:-3px;top:340px;height:60px"></i>`;
  return `
<div class="phone" ${id ? `id="${id}"` : ""} style="position:relative;width:${W}px;height:${H}px;transform:rotate(${tilt}deg) scale(${scale});transform-origin:center;flex:none">
  <style>.phone i{position:absolute;width:4px;border-radius:2px;${frame.replace("background", "background")}}</style>
  ${buttons}
  <div style="position:absolute;inset:0;border-radius:${R}px;${frame}padding:3px;box-sizing:border-box;
    ${shadow ? "box-shadow:0 60px 90px -30px rgba(0,20,14,.55),0 30px 40px -20px rgba(0,0,0,.35);" : ""}">
    <div style="width:100%;height:100%;border-radius:${R - 3}px;background:#050505;padding:${bez - 3}px;box-sizing:border-box">
      <div class="screen" style="position:relative;width:${d.w}px;height:${d.h}px;border-radius:${r}px;overflow:hidden;background:${BG[mode]}">
        <img class="shot" src="${src}" style="position:absolute;left:0;top:${d.status}px;width:${d.w}px;display:block">
        <div style="position:absolute;left:0;top:0;width:100%;height:${d.status}px;background:${BG[mode]}"></div>
        ${status}${indicator}
        <div style="position:absolute;inset:0;border-radius:${r}px;pointer-events:none;background:linear-gradient(125deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 35%)"></div>
      </div>
    </div>
  </div>
</div>`;
}

export const phoneSize = (kind) => {
  const d = DEVICES[kind]; const bez = kind === "ios" ? 11 : 9;
  return { w: d.w + bez * 2, h: d.h + bez * 2 };
};
