import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDevice, collectContext } from "../feedback.js";

test("describeDevice: iPhone/Android/desktop", () => {
  assert.equal(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"), "iPhone · iOS 18.1 · Safari");
  assert.equal(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"), "Android · Android 14 · Chrome");
  assert.equal(describeDevice(""), "");
});

test("collectContext: aman tanpa window & membaca halaman", () => {
  assert.equal(collectContext(undefined), null);
  const c = collectContext({ location: { pathname: "/add", search: "?x=1" }, navigator: { userAgent: "UA", onLine: true }, screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }) });
  assert.deepEqual(c, { path: "/add?x=1", user_agent: "UA", platform: "", screen: "390×844", standalone: true, online: true });
});
