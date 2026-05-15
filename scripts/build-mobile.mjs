import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const dist = join(root, "dist");
const directories = ["assets", "src"];
const files = ["index.html", "manifest.webmanifest", "service-worker.js"];

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}

mkdirSync(dist, { recursive: true });

for (const directory of directories) {
  cpSync(join(root, directory), join(dist, directory), { recursive: true });
}

for (const file of files) {
  copyFileSync(join(root, file), join(dist, file));
}

console.log("Mobile web assets copied to dist/");
