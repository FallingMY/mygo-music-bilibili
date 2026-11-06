// Subtitles as lyrics, offline, against a stand-in Bilibili.
// node --experimental-vm-modules tests/lyrics.mjs
import { load } from "./harness.mjs";

const json = (b) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
function bilibili(subtitles, bodies) {
  const asked = [];
  const fetch = async (url) => {
    const u = new URL(url);
    asked.push(u);
    if (u.pathname === "/x/frontend/finger/spi") return json({ code: 0, data: { b_3: "B3", b_4: "B4" } });
    if (u.pathname === "/x/web-interface/nav") return json({ code: -101, data: { wbi_img: { img_url: "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png", sub_url: "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png" } } });
    if (u.pathname === "/x/web-interface/view") return json({ code: 0, data: { bvid: "BV1xx411c7mD", aid: 170001, cid: 99, pages: [{ cid: 99, page: 1, part: "", duration: 200 }], title: "t", owner: { mid: 1, name: "up" } } });
    if (u.pathname === "/x/player/wbi/v2") return json({ code: 0, data: { subtitle: { subtitles } } });
    if (bodies[u.pathname]) return json({ body: bodies[u.pathname] });
    throw new Error(`unexpected ${url}`);
  };
  return { fetch, asked };
}
let failed = 0;
const check = (name, ok, got) => { console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(got)); if (!ok) failed++; };

{ // Japanese and Chinese: Japanese is the lyric, Chinese its translation.
  const { fetch, asked } = bilibili(
    [{ lan: "ai-zh", subtitle_url: "//aisubtitle.hdslb.com/ai.json" }, { lan: "zh-CN", subtitle_url: "//i0.hdslb.com/bfs/subtitle/zh.json" }, { lan: "ja", subtitle_url: "//i0.hdslb.com/bfs/subtitle/ja.json" }],
    {
      "/bfs/subtitle/ja.json": [{ from: 1, to: 3, content: "夜に駆ける" }, { from: 3.1, to: 5, content: "沈むように" }, { from: 9, to: 10, content: "ラララ" }],
      "/bfs/subtitle/zh.json": [{ from: 1.2, to: 3, content: "向夜晚奔去" }, { from: 3.0, to: 5, content: "如同沉没一般" }],
    },
  );
  const { api } = await load({ fetch });
  const { lines } = await api.lyrics({ id: "BV1xx411c7mD" });
  check("bilingual: original language is the lyric", lines.map((l) => l.text).join("|") === "夜に駆ける|沈むように|ラララ", lines);
  check("bilingual: Chinese lines become translations by time", lines[0].translation === "向夜晚奔去" && lines[1].translation === "如同沉没一般" && !lines[2].translation, lines);
  check("bilingual: AI subtitles not fetched", !asked.some((u) => u.pathname === "/ai.json"), asked.map((u) => u.pathname));
  const v2 = asked.find((u) => u.pathname === "/x/player/wbi/v2");
  check("asks with aid as well as bvid", v2?.searchParams.get("aid") === "170001" && v2?.searchParams.get("cid") === "99", v2?.search);
}
{ // AI subtitles only: ♪ marks gone, instrumental filler dropped.
  const { fetch } = bilibili([{ lan: "ai-zh", subtitle_url: "https://aisubtitle.hdslb.com/ai.json" }], {
    "/ai.json": [{ from: 0, to: 2, content: "♪ 音乐 ♪" }, { from: 2.5, to: 4, content: "♪ 窗外的天气 ♪" }, { from: 5, to: 6, content: "♪" }, { from: 7, to: 8, content: "(Music)" }],
  });
  const { api } = await load({ fetch });
  const { lines } = await api.lyrics({ id: "BV1xx411c7mD" });
  check("AI: ♪ and filler removed", lines.length === 1 && lines[0].text === "窗外的天气" && lines[0].start === 2500, lines);
}
{ // Nothing but filler: no lyrics, rather than an empty page.
  const { fetch } = bilibili([{ lan: "ai-zh", subtitle_url: "https://aisubtitle.hdslb.com/ai.json" }], { "/ai.json": [{ from: 0, to: 2, content: "♪ 音乐 ♪" }] });
  const { api } = await load({ fetch });
  let code = "";
  try { await api.lyrics({ id: "BV1xx411c7mD" }); } catch (e) { code = e.code; }
  check("filler only: unavailable", code === "unavailable", code);
}
process.exit(failed ? 1 : 0);
