// Encode le film motion design en MP4 (H.264) + une image poster.
//
//   pip install imageio-ffmpeg        # ou ffmpeg dans le PATH
//   NODE_PATH=$(npm root -g) node tools/motion/render.cjs
//
// Le rendu est fait image par image (30 i/s) : le résultat est identique
// quelle que soit la vitesse de la machine.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "assets", "lueur-motion.mp4");
const POSTER = path.join(ROOT, "assets", "lueur-motion-poster.jpg");
const FPS = 30;

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execSync(`python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();
  } catch {
    return "ffmpeg";
  }
}

const types = { ".html": "text/html", ".woff2": "font/woff2", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${port}/tools/motion/lueur-motion.html?capture`);
  await page.waitForFunction(() => window.fontsReady === true);
  const duration = await page.evaluate(() => window.DURATION);

  const ff = spawn(ffmpegPath(), [
    "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-r", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", OUT,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    const b64 = await page.evaluate((t) => {
      window.render(t);
      return document.getElementById("c").toDataURL("image/jpeg", 0.95).split(",")[1];
    }, i / FPS);
    const buf = Buffer.from(b64, "base64");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i === Math.round(21.5 * FPS)) fs.writeFileSync(POSTER, buf);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  server.close();
  console.log(`OK → ${path.relative(ROOT, OUT)} (${frames} images)`);
})();
