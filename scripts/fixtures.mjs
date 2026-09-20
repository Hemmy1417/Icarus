/**
 * Fetch the demonstration photographs from Wikimedia Commons and normalize
 * them to what the runner's decoder reads: a JFIF-headed JPEG under the
 * contract's byte cap.
 *
 *   node scripts/fixtures.mjs
 *
 * The originals are EXIF-headed or bare JPEGs. Rather than re-encode them,
 * which would change the picture, a JFIF APP0 segment is inserted directly
 * after the start-of-image marker; every other segment is left exactly as it
 * was, so the bytes a validator judges are the photographer's own pixels.
 * Width is chosen per file so the result fits the cap; the nameplate keeps
 * the most resolution, because reading it is the point.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 400_000;
const JFIF_APP0 = Buffer.from([
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
]);

const FILES = [
  { name: "growatt-nameplate", width: 1280,
    title: "File:Growatt MOD 4000TL3-X inverter data sheet.jpg" },
  { name: "growatt-inverter", width: 1000,
    title: "File:Growatt MOD 4000TL3-X inverter.jpg" },
  { name: "kostal-inverter", width: 1000,
    title: "File:Dornbirn-Kostal Inverter-Piko 10.1-02ASD.jpg" },
  { name: "array-kenya", width: 1000,
    title: "File:Solar Installation in Kenya.jpg" },
];

/** Commons serves the widths it has; ask its API rather than guess a URL. */
async function thumbUrl(title, width) {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&titles="
    + `${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=${width}`;
  const res = await fetch(api, { headers: { "user-agent": "IcarusDemo/1.0 (build)" } });
  const data = await res.json();
  const info = Object.values(data.query.pages)[0]?.imageinfo?.[0];
  if (!info?.thumburl) throw new Error(`no thumbnail for ${title}`);
  return info.thumburl;
}

function toJfif(jpeg) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("not a JPEG");
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) return jpeg;     // already JFIF
  return Buffer.concat([jpeg.subarray(0, 2), JFIF_APP0, jpeg.subarray(2)]);
}

for (const entry of FILES) {
  let width = entry.width;
  let out = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = await thumbUrl(entry.title, width);
    const res = await fetch(url, { headers: { "user-agent": "IcarusDemo/1.0 (build)" } });
    if (!res.ok) throw new Error(`${entry.name}: ${res.status} at ${width}px`);
    const jfif = toJfif(Buffer.from(await res.arrayBuffer()));
    if (jfif.length <= MAX_BYTES) { out = jfif; break; }
    width = Math.round(width * 0.82);
  }
  if (!out) throw new Error(`${entry.name}: cannot be brought under the cap`);
  const path = fileURLToPath(new URL(`../fixtures/images/${entry.name}.jpg`, import.meta.url));
  writeFileSync(path, out);
  console.log(`${entry.name.padEnd(20)} ${String(out.length).padStart(7)} bytes  `
    + `${width}px  header ${[...out.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
}
