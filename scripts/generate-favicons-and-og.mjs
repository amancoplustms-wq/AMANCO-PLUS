import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const brandDir = path.join(publicDir, 'brand');
const appDir = path.join(projectRoot, 'src', 'app');

// The shield SVG from generate-brand-images.mjs
const shieldSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="shieldGrad" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="arrowGrad" x1="18" y1="28" x2="46" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#fdba74" />
    </linearGradient>
  </defs>
  <path d="M32 4L8 16V30C8 44.36 18.28 57.52 32 60C45.72 57.52 56 44.36 56 30V16L32 4Z"
        fill="#0f172a" stroke="#334155" stroke-width="1.8" />
  <path d="M32 7L11 17.5V30C11 42.8 20.2 54.6 32 57C43.8 54.6 53 42.8 53 30V17.5L32 7Z"
        fill="url(#shieldGrad)" />
  <rect x="21" y="22" width="16" height="14" rx="2" fill="url(#arrowGrad)" />
  <line x1="29" y1="22" x2="29" y2="36" stroke="#0f172a" stroke-width="1.2" />
  <line x1="21" y1="29" x2="37" y2="29" stroke="#0f172a" stroke-width="1.2" />
  <path d="M38 32L50 26L46 31H50L38 38L42 33H38V32Z"
        fill="#f97316" stroke="#fdba74" stroke-width="0.5" stroke-linejoin="round" />
  <path d="M25 43L29 47L39 37" stroke="#059669" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>
`;

const htmlPage = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Favicon & OG Generator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #111;
      color: #fff;
      font-family: 'Cairo', sans-serif;
    }
  </style>
</head>
<body>
  <h1>توليد أيقونات الموقع وبانر المشاركة الاجتماعية بدقة فائقة...</h1>
  <div id="status">Loading...</div>

  <script>
    const shieldSvgRaw = ${JSON.stringify(shieldSvg.trim())};

    function svgToImg(svgStr) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
      });
    }

    async function sendImage(key, canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\\/png;base64,/, '');
      await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data: base64Data })
      });
    }

    async function generateAll() {
      const status = document.getElementById('status');
      await document.fonts.ready;
      status.innerText = 'Fonts ready. Drawing assets...';

      const shieldImg = await svgToImg(shieldSvgRaw);

      // 1. Icon sizes: 16, 32, 48, 64, 180, 192, 512
      const sizes = [16, 32, 48, 64, 180, 192, 512];
      for (const sz of sizes) {
        const canvas = document.createElement('canvas');
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext('2d');

        // Draw shield centered with tiny padding
        const pad = Math.max(1, Math.round(sz * 0.05));
        ctx.drawImage(shieldImg, pad, pad, sz - pad * 2, sz - pad * 2);
        await sendImage('icon-' + sz, canvas);
      }

      // 2. Open Graph Card (1200 x 630)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');

        // Base gradient background (Rich Navy)
        const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
        bgGrad.addColorStop(0, '#070d19');
        bgGrad.addColorStop(0.4, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1200, 630);

        // Ambient glows
        // 1. Orange brand glow top-right
        const orangeGlow = ctx.createRadialGradient(980, 240, 10, 980, 240, 380);
        orangeGlow.addColorStop(0, 'rgba(249, 115, 22, 0.22)');
        orangeGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = orangeGlow;
        ctx.fillRect(0, 0, 1200, 630);

        // 2. Sky blue glow bottom-left
        const blueGlow = ctx.createRadialGradient(200, 500, 10, 200, 500, 360);
        blueGlow.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
        blueGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = blueGlow;
        ctx.fillRect(0, 0, 1200, 630);

        // Subtle geometric grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 1;
        for (let x = 40; x < 1200; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 630);
          ctx.stroke();
        }
        for (let y = 40; y < 630; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1200, y);
          ctx.stroke();
        }

        // Luxury outer border
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, 1160, 590);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(26, 26, 1148, 578);

        // Top decorative accent bar
        const barGrad = ctx.createLinearGradient(100, 20, 1100, 20);
        barGrad.addColorStop(0, '#0ea5e9');
        barGrad.addColorStop(0.5, '#f97316');
        barGrad.addColorStop(1, '#10b981');
        ctx.fillStyle = barGrad;
        ctx.fillRect(80, 20, 1040, 4);

        // Draw Shield Icon on the right side
        const shieldSize = 340;
        const shieldX = 780;
        const shieldY = (630 - shieldSize) / 2 - 20;

        // Glowing backdrop behind shield
        const shieldBgGlow = ctx.createRadialGradient(shieldX + shieldSize/2, shieldY + shieldSize/2, 20, shieldX + shieldSize/2, shieldY + shieldSize/2, 220);
        shieldBgGlow.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        shieldBgGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shieldBgGlow;
        ctx.beginPath();
        ctx.arc(shieldX + shieldSize/2, shieldY + shieldSize/2, 200, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(shieldImg, shieldX, shieldY, shieldSize, shieldSize);

        // Text Section on the left / RTL right aligned
        const textRight = 740;

        // Badge: نظام الشحن والتوريد المتكامل
        ctx.textBaseline = 'top';
        ctx.textAlign = 'right';

        // Badge background
        const badgeX = textRight - 280;
        const badgeY = 95;
        ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, 280, 42, 21);
        ctx.fill();
        ctx.stroke();

        ctx.font = '700 20px Cairo';
        ctx.fillStyle = '#fb923c';
        ctx.fillText('⚡ خدمات لوجستية وتوريد ذكية', textRight - 25, badgeY + 8);

        // Main Brand Title: أمانكو بلس
        const titleY = 155;
        ctx.font = '900 84px Cairo';
        const amancoW = ctx.measureText('أمانكو ').width;
        const plusW = ctx.measureText('بلس').width;

        // Draw أمانكو in white
        ctx.fillStyle = '#ffffff';
        ctx.fillText('أمانكو ', textRight, titleY);

        // Draw بلس in brand orange
        ctx.fillStyle = '#f97316';
        ctx.fillText('بلس', textRight - amancoW, titleY);

        // English Subtitle & Arabic specialization
        const subY = 275;
        ctx.font = '800 28px Cairo';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('AMANCO PLUS  •  للشحن والتوريد المعتمد', textRight, subY);

        // Description / Tagline
        const descY = 325;
        ctx.font = '600 24px Cairo';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('شحن وتوريد فوري، آمن، واحترافي بأعلى معايير الدقة والأمان', textRight, descY);

        // Feature Pills Container
        const pillsY = 385;

        // Pill 1: التغطية
        function drawPill(rx, ry, w, h, text, iconColor, bg) {
          ctx.fillStyle = bg;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rx - w, ry, w, h, 12);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'right';
          ctx.font = '700 20px Cairo';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(text, rx - 18, ry + 10);
        }

        drawPill(textRight, pillsY, 320, 50, '📍 القاهرة • الجيزة • القليوبية', '#0ea5e9', 'rgba(15, 23, 42, 0.8)');
        drawPill(textRight - 335, pillsY, 280, 50, '🔍 تتبع لحظي للبوليصة', '#10b981', 'rgba(15, 23, 42, 0.8)');

        // Bottom Footer Bar
        const footerY = 475;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(80, footerY, 1040, 75, 16);
        ctx.fill();
        ctx.stroke();

        // Footer items
        // Contact phone
        ctx.textAlign = 'right';
        ctx.font = '800 24px Cairo';
        ctx.fillStyle = '#f97316';
        ctx.fillText('📞 خدمة العملاء والمتابعة:', 1080, footerY + 22);

        ctx.font = '900 26px Cairo';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('01274365996', 820, footerY + 21);

        // Left side of footer
        ctx.textAlign = 'left';
        ctx.font = '700 22px Cairo';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('شحنتك في أمان مع أمانكو بلس 🛡️', 110, footerY + 24);

        await sendImage('og-image', canvas);
      }

      status.innerText = 'Completed all generations!';
      await fetch('/done', { method: 'POST' });
    }

    window.onload = () => {
      generateAll().catch(err => {
        console.error(err);
        document.getElementById('status').innerText = 'Error: ' + err.message;
      });
    };
  </script>
</body>
</html>
`;

// Helper to assemble PNG buffers into a valid ICO file
function createIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;

  let currentOffset = headerSize + dirSize;
  const entries = [];

  for (const item of pngBuffers) {
    const size = item.buffer.length;
    entries.push({
      width: item.width >= 256 ? 0 : item.width,
      height: item.height >= 256 ? 0 : item.height,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: size,
      imageOffset: currentOffset,
      buffer: item.buffer,
    });
    currentOffset += size;
  }

  const outBuffer = Buffer.alloc(currentOffset);

  // Write ICO Header
  outBuffer.writeUInt16LE(0, 0); // Reserved
  outBuffer.writeUInt16LE(1, 2); // Type 1 = Icon
  outBuffer.writeUInt16LE(count, 4); // Number of images

  // Write Directory Entries
  let pos = 6;
  for (const entry of entries) {
    outBuffer.writeUInt8(entry.width, pos);
    outBuffer.writeUInt8(entry.height, pos + 1);
    outBuffer.writeUInt8(entry.colorCount, pos + 2);
    outBuffer.writeUInt8(entry.reserved, pos + 3);
    outBuffer.writeUInt16LE(entry.planes, pos + 4);
    outBuffer.writeUInt16LE(entry.bitCount, pos + 6);
    outBuffer.writeUInt32LE(entry.bytesInRes, pos + 8);
    outBuffer.writeUInt32LE(entry.imageOffset, pos + 12);
    pos += 16;
  }

  // Write Image Buffers
  for (const entry of entries) {
    entry.buffer.copy(outBuffer, entry.imageOffset);
  }

  return outBuffer;
}

const capturedBuffers = {};

let server = http.createServer(async (req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlPage);
  } else if (req.url === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { key, data } = JSON.parse(body);
        const buf = Buffer.from(data, 'base64');
        capturedBuffers[key] = buf;
        console.log(`Captured ${key} (${buf.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(err.message);
      }
    });
  } else if (req.url === '/done' && req.method === 'POST') {
    console.log('✓ All canvases rendered! Writing to destinations...');

    // 1. Write OG Image to destinations
    const ogBuf = capturedBuffers['og-image'];
    if (ogBuf) {
      fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogBuf);
      fs.writeFileSync(path.join(brandDir, 'og-image.png'), ogBuf);
      fs.writeFileSync(path.join(appDir, 'opengraph-image.png'), ogBuf);
      fs.writeFileSync(path.join(appDir, 'twitter-image.png'), ogBuf);
      console.log('✓ Saved og-image.png to public/, brand/, and src/app/(opengraph-image.png, twitter-image.png)');
    }

    // 2. Write Icons to destinations
    const icon512 = capturedBuffers['icon-512'];
    const icon192 = capturedBuffers['icon-192'];
    const icon180 = capturedBuffers['icon-180'];
    const icon64 = capturedBuffers['icon-64'];
    const icon48 = capturedBuffers['icon-48'];
    const icon32 = capturedBuffers['icon-32'];
    const icon16 = capturedBuffers['icon-16'];

    if (icon512) {
      fs.writeFileSync(path.join(appDir, 'icon.png'), icon512);
      fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
      fs.writeFileSync(path.join(publicDir, 'icon.png'), icon512);
      fs.writeFileSync(path.join(brandDir, 'amanco-shield-icon-512.png'), icon512);
    }

    if (icon192) {
      fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
    }

    if (icon180) {
      fs.writeFileSync(path.join(appDir, 'apple-icon.png'), icon180);
      fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), icon180);
      fs.writeFileSync(path.join(publicDir, 'apple-icon.png'), icon180);
    }

    if (icon32) {
      fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), icon32);
    }

    if (icon16) {
      fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), icon16);
    }

    // Also copy SVG icon to public/favicon.svg
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), shieldSvg.trim());

    // 3. Assemble and write multi-res favicon.ico
    const icoBuffer = createIco([
      { width: 16, height: 16, buffer: icon16 },
      { width: 32, height: 32, buffer: icon32 },
      { width: 48, height: 48, buffer: icon48 },
      { width: 64, height: 64, buffer: icon64 },
    ]);

    fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
    console.log(`✓ Built multi-res favicon.ico (${icoBuffer.length} bytes) and saved to src/app/ and public/`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8991;
server.listen(PORT, () => {
  console.log(`Favicon & OG generator listening on http://localhost:${PORT}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless --disable-gpu http://localhost:${PORT}`;
  exec(cmd, (err) => {
    if (err) {
      console.log('Edge headless execution notification:', err.message);
    }
  });
});
