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
  const id = "BV1q4FTeBEMj"; // a hundred parts
  const page = await api.album({ id });
  const { tracks } = await api.search({ query: `https://www.bilibili.com/video/${id}?p=3`, kind: "tracks", offset: 0 });
  if (page.tracks[0].id !== id) throw new Error(`part 1 should be the plain id: ${page.tracks[0].id}`);
  if (tracks[0].id !== page.tracks[2].id) throw new Error(`p=3 not first: ${tracks[0].name}`);
  return [page.tracks.length, tracks[0].id, tracks[0].name];
});
await check("suggest", () => api.suggest({ query: "晴天" }));
await check("home", async () => (await api.home()).sections.map((s) => [s.title, (s.tracks || s.links).length]));
for (const page of ["charts", "chart", "rank", "fresh", "rank:28", "site", "popular", "classics"]) {
  await check(`browse ${page}`, async () => (await api.browse({ page })).sections.map((s) => [s.title, (s.tracks || s.links).length, s.tracks?.[0]?.name]));
}
await check("rankings are current", async () => {
  const { sections } = await api.browse({ page: "rank" });
  const ids = sections[0].tracks.slice(0, 5).map((t) => t.album.id);
  const dates = await Promise.all(ids.map(async (id) => (await api.album({ id })).album.released));
  const newest = dates.sort().pop();
  const days = (Date.now() - Date.parse(newest)) / 86400000;
  if (days > 30) throw new Error(`newest of the top five is ${newest}`);
  return { newest };
});
await check("one id per video", async () => {
  const tracks = (await api.browse({ page: "fresh" })).sections[0].tracks;
  const bad = tracks.filter((t) => t.id.includes("|"));
  if (bad.length) throw new Error(`part ids for whole videos: ${bad.map((t) => t.id)}`);
  return tracks.length;
});
await check("playlists search signed out is empty", async () => (await api.search({ query: "音乐", kind: "playlists", offset: 0 })).playlists.length === 0);
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
  // FLAC and AAC-LC go to the app as Bilibili's own fragmented MP4, fetched
  // with the headers the stream gives; HE-AAC comes from ffmpeg as WAV.
  const play = async (id, quality) => {
    const start = Date.now();
    const s = await api.stream({ id, quality });
    const ready = Date.now() - start;
    const res = await fetch(s.url, { headers: s.headers || {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.subarray(0, 8).toString("hex");
    const mp4 = buf.subarray(4, 8).toString() === "ftyp";
    const wav = buf.subarray(0, 4).toString() === "RIFF";
    if (!(mp4 && s.type === "m4a" && s.headers?.Referer) && !(wav && s.type === "wav")) throw new Error(`gave ${s.type} but head is ${head}`);
    return { type: s.type, quality: s.quality, bitRate: s.bitRate, host: new URL(s.url).host, ready: `${ready}ms`, bytes: buf.length };
  };
  for (const quality of ["high", "standard", "lossless"]) await check(`stream ${quality}`, () => play(tr.id, quality));
  await check("stream HE-AAC only, through ffmpeg", () => play("BV1vgZrY8Eoo", "high"));
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
