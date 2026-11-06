// Tries everything a signed-out listener can do, against the real Bilibili.
// node --experimental-vm-modules tests/live.mjs
import { load } from "./harness.mjs";

const { api } = await load();
let failed = 0;
const short = (v) => { const s = JSON.stringify(v); return s && s.length > 300 ? s.slice(0, 300) + "…" : s; };
async function check(name, run) {
  const start = Date.now();
  try { const v = await run(); console.log(`PASS ${name} (${Date.now() - start}ms)`, short(v)); return v; }
  catch (e) { failed++; console.log(`FAIL ${name}`, e.code || "", e.message); return null; }
}

await check("account (signed out)", () => api.account());
const r = await check("search tracks", async () => {
  const r = await api.search({ query: "晴天 周杰伦", kind: "tracks", offset: 0 });
  if (!r.tracks.length) throw new Error("nothing found");
  return r;
});
await check("search page 2", async () => (await api.search({ query: "晴天", kind: "tracks", offset: 20 })).tracks.length);
await check("search artists", async () => (await api.search({ query: "周杰伦", kind: "artists", offset: 0 })).artists.slice(0, 2));
await check("search albums", async () => (await api.search({ query: "晴天", kind: "albums", offset: 0 })).albums.length);
await check("paste b23", async () => (await api.search({ query: "【哔哩哔哩】 https://b23.tv/BV1GJ411x7h7", kind: "tracks", offset: 0 })).tracks.map((t) => t.name));
await check("multi-part video, pasted with ?p=3", async () => {
  const { albums } = await api.search({ query: "周杰伦 歌曲合集 分P", kind: "albums", offset: 0 });
  for (const a of albums.slice(0, 8)) {
    const page = await api.album({ id: a.id });
    if (page.tracks.length < 3 || !page.tracks[0].id.includes("|")) continue;
    const { tracks } = await api.search({ query: `https://www.bilibili.com/video/${a.id}?p=3`, kind: "tracks", offset: 0 });
    if (tracks[0].id !== page.tracks[2].id) throw new Error(`p=3 not first: ${tracks[0].name}`);
    return [a.id, tracks.length, tracks[0].name];
  }
  throw new Error("no multi-part video among the results");
});
await check("suggest", () => api.suggest({ query: "晴天" }));
await check("home", async () => (await api.home()).sections.map((s) => [s.title, (s.tracks || s.links).length]));
for (const page of ["charts", "chart", "rank:28"]) {
  await check(`browse ${page}`, async () => (await api.browse({ page })).sections.map((s) => [s.title, (s.tracks || s.links).length, s.tracks?.[0]?.name]));
}
const tr = r?.tracks[0];
if (tr) {
  await check("album", async () => { const a = await api.album({ id: tr.album.id }); return [a.album.name, a.tracks.length]; });
  await check("album of a collection", async () => { const a = await api.album({ id: "BV1GJ411x7h7" }); return [a.album.name, a.tracks.length]; });
  await check("artist", async () => { const a = await api.artist({ id: tr.artists[0].id }); return [a.artist, a.tracks.length]; });
  await check("comments", async () => { const c = await api.comments({ trackId: tr.id, offset: 0 }); return [c.total, c.more, c.comments[0]]; });
  await check("comments page 2", async () => (await api.comments({ trackId: tr.id, offset: 20 })).comments.length);
  await check("lyrics (signed out, none is fine)", async () => {
    try { return (await api.lyrics({ id: tr.id })).lines.slice(0, 3); }
    catch (e) { if (e.code === "unavailable") return e.message; throw e; }
  });
  await check("stations", () => api.stations());
  api.played({ id: tr.id });
  await check("stationNext", async () => (await api.stationNext({ id: "related" })).map((t) => t.name));
  for (const quality of ["high", "standard", "lossless"]) {
    await check(`stream ${quality}`, async () => {
      const start = Date.now();
      const s = await api.stream({ id: tr.id, quality });
      const ready = Date.now() - start;
      const res = await fetch(s.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const head = buf.subarray(0, 4).toString("hex");
      const mp3 = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
      const flac = buf.subarray(0, 4).toString() === "fLaC";
      if (!(mp3 && s.type === "mp3") && !(flac && s.type === "flac")) throw new Error(`served ${s.type} but head is ${head}`);
      return { ...s, ready: `${ready}ms`, bytes: buf.length, total: `${Date.now() - start}ms`, expectSeconds: tr.duration / 1000, kbpsActual: Math.round((buf.length * 8) / (tr.duration)) };
    });
  }
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
