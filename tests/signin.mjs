// Signing in, offline. On Bilibili's page in the app's window first; then, as an
// app without that window does, by the QR code alone, against a stand-in
// Bilibili that confirms it on the second poll and knows the session only by
// SESSDATA kept encoded, handed out in the address it answers or as Set-Cookie.
// node --experimental-vm-modules tests/signin.mjs
import { load } from "./harness.mjs";

const SESS = "8f3a1c2e%2C1794000000%2Cab12c*b1";
let failed = 0;

async function scenario(name, { inQuery, inHeaders }) {
  let polls = 0;
  const prompts = [];
  async function fakeFetch(url, init = {}) {
    const u = new URL(url);
    const cookie = init.headers?.Cookie || "";
    const json = (body, headers = new Headers()) => {
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(body), { headers });
    };
    if (u.pathname === "/x/frontend/finger/spi") return json({ code: 0, data: { b_3: "B3", b_4: "B4" } });
    if (u.pathname.endsWith("/qrcode/generate")) return json({ code: 0, data: { url: "https://passport.bilibili.com/h5-app/passport/login/scan?qrcode_key=k", qrcode_key: "k" } });
    if (u.pathname.endsWith("/qrcode/poll")) {
      if (++polls < 2) return json({ code: 0, data: { code: 86090, url: "" } });
      const query = inQuery ? `DedeUserID=42&DedeUserID__ckMd5=abc&Expires=1794000000&SESSDATA=${SESS}&bili_jct=csrf123&` : "";
      const h = new Headers();
      if (inHeaders) {
        h.append("set-cookie", `SESSDATA=${SESS}; Path=/; Domain=bilibili.com; Expires=Sat, 07 Nov 2027 00:00:00 GMT; HttpOnly; Secure`);
        h.append("set-cookie", "bili_jct=csrf123; Path=/; Domain=bilibili.com; Expires=Sat, 07 Nov 2027 00:00:00 GMT");
        h.append("set-cookie", "DedeUserID=42; Path=/; Domain=bilibili.com");
        h.append("set-cookie", "DedeUserID__ckMd5=abc; Path=/; Domain=bilibili.com");
        h.append("set-cookie", "sid=s1; Path=/; Domain=bilibili.com");
      }
      return json({ code: 0, data: { code: 0, refresh_token: "r", url: `https://passport.biligame.com/x/passport-login/web/crossDomain?${query}gourl=https%3A%2F%2Fwww.bilibili.com` } }, h);
    }
    if (u.pathname === "/x/web-interface/nav") {
      const ok = cookie.includes(`SESSDATA=${SESS}`);
      return json(ok ? { code: 0, data: { isLogin: true, mid: 42, uname: "测试账号" } } : { code: -101, message: "账号未登录", data: { isLogin: false } });
    }
    throw new Error(`unexpected ${url}`);
  }
  const { api, storage } = await load({ fetch: fakeFetch, onPrompt: (p) => prompts.push(p.text) });
  let me = null;
  let error = "";
  try { me = await api.signIn(); } catch (e) { error = e.message; }
  const kept = storage.get("cookie") || "";
  const checks = !inQuery && !inHeaders
    ? [["fails, naming what came back", /no SESSDATA; query: gourl; cookies: -/.test(error) && !kept]]
    : [
        ["account answered", me?.name === "测试账号" && me.id === "42"],
        ["SESSDATA kept encoded", kept.includes(`SESSDATA=${SESS}`)],
        ["bili_jct kept for writes", kept.includes("bili_jct=csrf123")],
        ["nothing beyond the session kept", !/Expires|gourl|Path/.test(kept)],
        ["prompted to confirm after scan", prompts.some((p) => /confirm|确认/.test(p))],
        ["account() still signed in", (await api.account())?.id === "42"],
      ];
  if (me) {
    api.signOut();
    checks.push(["signOut forgets the session", !storage.has("cookie") && (await api.account()) === null]);
  }
  for (const [check, ok] of checks) {
    console.log(ok ? "PASS" : "FAIL", `${name}: ${check}`, ok ? "" : error);
    if (!ok) failed++;
  }
}

await scenario("QR only: session in the address", { inQuery: true });
await scenario("QR only: session in Set-Cookie only", { inHeaders: true });
await scenario("QR only: session in neither", {});

// Bilibili's page in the app's window: it answers the cookies once SESSDATA and bili_jct are there.
{
  let asked = null;
  const fakeFetch = async (url, init = {}) => {
    const u = new URL(url);
    const json = (b) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
    if (u.pathname === "/x/frontend/finger/spi") return json({ code: 0, data: { b_3: "B3", b_4: "B4" } });
    if (u.pathname === "/x/web-interface/nav") {
      const ok = (init.headers?.Cookie || "").includes(`SESSDATA=${SESS}`);
      return json(ok ? { code: 0, data: { isLogin: true, mid: 42, uname: "测试账号" } } : { code: -101, data: { isLogin: false } });
    }
    throw new Error(`unexpected ${url}`);
  };
  const { api, storage } = await load({
    fetch: fakeFetch,
    webSignIn: async (o) => ((asked = o), { cookie: `buvid3=X; SESSDATA=${SESS}; bili_jct=csrf123; DedeUserID=42; DedeUserID__ckMd5=abc; sid=s1` }),
  });
  const me = await api.signIn();
  const kept = storage.get("cookie") || "";
  const checks = [
    ["page: opens Bilibili's sign-in page", asked?.url === "https://passport.bilibili.com/login"],
    ["page: waits for SESSDATA and bili_jct", JSON.stringify(asked?.until) === '["SESSDATA","bili_jct"]'],
    ["page: asks for cookies of a host the permission reaches", asked?.cookiesOf === "https://api.bilibili.com/"],
    ["page: signed in", me?.id === "42"],
    ["page: keeps the session only", kept.includes(`SESSDATA=${SESS}`) && kept.includes("bili_jct=csrf123") && !kept.includes("buvid3")],
  ];
  for (const [check, ok] of checks) { console.log(ok ? "PASS" : "FAIL", check); if (!ok) failed++; }
}
process.exit(failed ? 1 : 0);
