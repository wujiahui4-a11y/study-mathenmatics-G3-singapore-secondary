#!/usr/bin/env node
/**
 * Packages dist/project.sb3 into a single self-contained, runnable HTML file
 * using the TurboWarp packager. The output (dist/index.html) embeds the Scratch
 * VM/renderer and all project assets, so it runs offline in any browser.
 */
const fs = require("fs");
const path = require("path");
const Packager = require("@turbowarp/packager");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const IN_SB3 = path.join(DIST_DIR, "project.sb3");
const OUT_HTML = path.join(DIST_DIR, "index.html");

async function main() {
  if (!fs.existsSync(IN_SB3)) {
    throw new Error(`Missing ${IN_SB3}. Run "npm run build:sb3" first.`);
  }

  const projectData = fs.readFileSync(IN_SB3);
  const progressCallback = (type, a) => {
    if (type === "fetch") {
      process.stdout.write(`  packager fetch progress: ${Math.round(a * 100)}%\r`);
    }
  };

  console.log("Loading project into packager...");
  const loadedProject = await Packager.loadProject(projectData, progressCallback);
  process.stdout.write("\n");

  const packager = new Packager.Packager();
  packager.project = loadedProject;
  packager.options.app.packageName = "study-mathematics-g3";
  packager.options.app.windowTitle = "study-mathematics-G3 (Scratch)";
  packager.options.target = "html";
  packager.options.autoplay = false;

  console.log("Packaging to standalone HTML...");
  const result = await packager.package();
  fs.writeFileSync(OUT_HTML, Buffer.from(result.data));
  const mb = (result.data.length / (1024 * 1024)).toFixed(1);
  console.log(`Wrote ${OUT_HTML} (${mb} MB, type ${result.type})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
