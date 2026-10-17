/**
 * HTML → PNG：截取 architecture.html 中的 #diagram
 * 依赖：riveredge-frontend 的 playwright（@playwright/test 自带 chromium）
 *
 *   node docs/screenshots/system/render_architecture.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const frontend = path.join(root, "riveredge-frontend");
const require = createRequire(path.join(frontend, "package.json"));

const { chromium } = require("playwright");

const htmlPath = path.join(__dirname, "architecture.html");
const outPath = path.join(__dirname, "architecture.png");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2100, height: 2400 },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
const el = page.locator("#diagram");
await el.waitFor({ state: "visible" });
await el.screenshot({ path: outPath, type: "png" });
const box = await el.boundingBox();
await browser.close();
console.log(`wrote ${outPath} size=${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}`);
