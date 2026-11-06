// Pages through a search the way MyGo Music does, from how many results it
// already has, and checks no id comes twice: the app keys its cards by id.
// node --experimental-vm-modules tests/paging.mjs [path/to/index.js]
import { load } from "./harness.mjs";

const { api } = await load({ main: process.argv[2] });
let failed = 0;
for (const [kind, query] of [["albums", "数模"], ["tracks", "数模"], ["tracks", "晴天"], ["artists", "周杰伦"]]) {
  const got = [];
  let more = true;
  for (let i = 0; i < 3 && more; i++) {
    const res = await api.search({ query, kind, offset: got.length });
    got.push(...res[kind]);
    more = res.more && res[kind].length > 0;
  }
  const ids = got.map((x) => x.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const ok = dupes.length === 0 && got.length > 0;
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", `${kind} "${query}": ${got.length} results over 3 loads, ${dupes.length} repeated`);
}
process.exit(failed ? 1 : 0);
