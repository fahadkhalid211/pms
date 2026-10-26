import fs from "fs";
import path from "path";

const cwd = process.cwd();
const standaloneDir = path.join(cwd, ".next", "standalone");
const standaloneNext = path.join(standaloneDir, ".next");
const staticSrc = path.join(cwd, ".next", "static");
const staticDest = path.join(standaloneNext, "static");
const publicSrc = path.join(cwd, "public");
const publicDest = path.join(standaloneDir, "public");

if (fs.existsSync(standaloneDir)) {
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.log("[copy-standalone] Copied .next/static to .next/standalone/.next/static");
  }
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.log("[copy-standalone] Copied public to .next/standalone/public");
  }
}
