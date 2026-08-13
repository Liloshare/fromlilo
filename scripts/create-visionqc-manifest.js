import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const [, , projectId, imageDir, labelDir, outFile = "manifest.json"] = process.argv;

if (!projectId || !imageDir || !labelDir) {
  console.error("Usage: node scripts/create-visionqc-manifest.js <project-id> <image-dir> <label-dir> [out-file]");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}

function asset(root, path, kind) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return {
    key: `projects/${projectId}/${kind}/${rel}`,
    name: basename(path),
    path: rel
  };
}

const images = walk(imageDir)
  .filter(path => /\.(jpe?g|png)$/i.test(path))
  .map(path => asset(imageDir, path, "images"));

const labels = walk(labelDir)
  .filter(path => /\.(json|txt)$/i.test(path) && !/^(train|test|valid|classes)\.txt$/i.test(basename(path)))
  .map(path => asset(labelDir, path, "labels"));

const manifest = {
  name: projectId,
  images,
  labels
};

writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outFile}`);
console.log(`images=${images.length} labels=${labels.length}`);
