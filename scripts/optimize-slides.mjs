/**
 * Turn the camera JPEGs in public/slides/ into web-sized copies in
 * public/slides/web/ and write the list to src/lib/slides.json for the
 * slideshow component.
 *
 *   pnpm slides:optimize
 *
 * The originals are ~3 MB each and carry EXIF rotation; the copies are
 * rotated upright, capped at 1400 px on the long edge, and ~150 KB.
 * Originals are gitignored, copies and the JSON are committed, so a fresh
 * clone needs nothing from this script unless you add photos.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "public/slides";
const OUT = join(SRC, "web");
const MAX_EDGE = 1400;

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f))
  .sort();

const slides = [];
for (const file of files) {
  const name = file.replace(/\.[^.]+$/, "") + ".jpg";
  const image = sharp(join(SRC, file)).rotate(); // bake EXIF orientation in
  const info = await image
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(join(OUT, name));
  slides.push({ src: `/slides/web/${name}`, width: info.width, height: info.height });
  console.log(`${file} → web/${name} ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}

writeFileSync("src/lib/slides.json", JSON.stringify(slides, null, 2) + "\n");
console.log(`wrote src/lib/slides.json (${slides.length} slides)`);
