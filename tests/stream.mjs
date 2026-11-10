import assert from "node:assert/strict";
import { load } from "./harness.mjs";

const id = "BV1xx411c7mD";
const primary = "https://upos.bilivideo.com/audio.m4s";
const backup = "https://cdn.bilivideo.cn/audio.m4s";

for (const { quality, statuses, expected } of [
  { quality: "high", statuses: [206], expected: primary },
  { quality: "high", statuses: [null, 206], expected: backup },
  { quality: "lossless", statuses: [403, 200], expected: backup },
  { quality: "lossless", statuses: [403, 503], expected: primary },
]) {
  const probes = [];
  const track = { baseUrl: primary, backupUrl: [primary, backup], codecs: "mp4a.40.2", bandwidth: 192000 };
  const { api } = await load({ fetch: async (url, init) => {
    if (url === primary || url === backup) {
      const status = statuses[probes.length];
      probes.push({ url, ...init });
      if (status === null) throw new TypeError("connection failed");
      return new Response(null, { status });
    }
    const { pathname } = new URL(url);
    if (pathname === "/x/frontend/finger/spi") return Response.json({ code: 0, data: { b_3: "B3", b_4: "B4" } });
    if (pathname === "/x/web-interface/nav") return Response.json({ code: -101 });
    if (pathname === "/x/web-interface/view") return Response.json({ code: 0, data: { bvid: id, cid: 99 } });
    if (pathname.endsWith("/playurl")) return Response.json({ code: 0, data: { dash: { audio: [track], flac: { audio: track } } } });
    throw new Error(`unexpected request ${pathname}`);
  } });

  const result = await api.stream({ id, quality });
  assert.equal(result.url, expected);
  assert.equal(result.type, "m4a");
  assert.equal(result.quality, quality);
  assert.equal(result.headers.Range, undefined);
  assert.deepEqual(probes.map(({ url }) => url), [primary, backup].slice(0, statuses.length));
  for (const { headers, signal } of probes) {
    assert.equal(headers.Range, "bytes=0-0");
    assert.equal(headers.Referer, result.headers.Referer);
    assert.equal(signal.aborted, true);
  }
}
console.log("stream mirror tests passed");
