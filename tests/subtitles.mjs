// Subtitles as lyrics, signed in: reads MyGo Music's saved session for this
// plugin into memory (never printed or written), and only reads from Bilibili.
// node --experimental-vm-modules tests/subtitles.mjs [query…]
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { load } from "./harness.mjs";

const saved = JSON.parse(await readFile(`${homedir()}/Library/Application Support/MyGo Music/plugin-data/bilibili/storage.json`, "utf8"));
const storage = new Map(Object.entries(saved).filter(([k]) => ["cookie", "visitor", "account"].includes(k)));
const lists = [];
const watch = async (url, init) => {
  const res = await fetch(url, init);
  if (String(url).includes("/x/player/wbi/v2")) {
    const body = await res.clone().json();
    lists.push({ code: body.code, need: body.data?.need_login_subtitle, subs: (body.data?.subtitle?.subtitles || []).map((s) => `${s.lan}${s.subtitle_url ? "" : "(no url)"}`) });
  }
  return res;
};
const { api } = await load({ storage, fetch: watch });
console.log("signed in as:", (await api.account())?.name ? "yes" : "NO");
const queries = process.argv.slice(2).length ? process.argv.slice(2) : ["MV 中英字幕", "动态歌词", "日语歌 中日双语字幕"];
let tried = 0, found = 0;
for (const q of queries) {
  const { tracks } = await api.search({ query: q, kind: "tracks", offset: 0 });
  for (const tr of tracks.slice(0, 6)) {
    tried++;
    lists.length = 0;
    try {
      const l = await api.lyrics({ id: tr.id });
      found++;
      console.log(`LYRICS ${tr.id} ${tr.name.slice(0, 30)} | offered: ${lists[0]?.subs.join(",")} | ${l.lines.length} lines | ${l.lines.slice(0, 2).map((x) => `${(x.start / 1000).toFixed(1)}s ${x.text}${x.translation ? " / " + x.translation : ""}`).join(" ; ")}`);
    } catch (e) {
      console.log(`none   ${tr.id} ${tr.name.slice(0, 30)} | offered: ${lists[0]?.subs.join(",") || "-"} | need_login=${lists[0]?.need} | ${e.code || ""} ${e.message}`);
    }
  }
}
console.log(`${found}/${tried} had lyrics`);
