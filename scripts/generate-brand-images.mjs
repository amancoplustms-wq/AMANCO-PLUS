import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'public', 'brand');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// SVG Shield Icon
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
  <title>Logo Generator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #333;
      color: #fff;
      font-family: 'Cairo', sans-serif;
    }
  </style>
</head>
<body>
  <h1>جاري معالجة وتصدير صور اللوجو بدقة فائقة...</h1>
  <div id="status">Loading fonts...</div>

  <script>
    const shieldSvgRaw = ${JSON.stringify(shieldSvg.trim())};

    function svgToImg(svgStr) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          resolve(img);
        };
        img.onerror = (e) => reject(e);
        img.src = url;
      });
    }

    async function sendImage(filename, canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\\/png;base64,/, '');
      await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data: base64Data })
      });
    }

    async function generateAll() {
      const status = document.getElementById('status');
      await document.fonts.ready;
      status.innerText = 'Fonts loaded. Generating images...';

      const shieldImg = await svgToImg(shieldSvgRaw);

      // Helper to draw the official horizontal logo
      function drawHorizontalLogo(ctx, width, height, isDark, transparent = false) {
        if (!transparent) {
          if (isDark) {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#0b1120');
            grad.addColorStop(0.5, '#0f172a');
            grad.addColorStop(1, '#1e293b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }
        }

        const iconSize = 185;
        const iconY = (height - iconSize) / 2;

        // Fonts
        ctx.font = '900 86px Cairo';
        const wPlusAr = ctx.measureText('بلس').width;
        const wAmancoAr = ctx.measureText('أمانكو ').width;
        const totalLine1W = wPlusAr + wAmancoAr;

        ctx.font = '700 31px Cairo';
        const wTawreed = ctx.measureText('للشحن والتوريد').width;
        const wDot = ctx.measureText('  •  ').width;
        const wAmancoEn = ctx.measureText('AMANCO ').width;
        const wPlusEn = ctx.measureText('PLUS').width;
        const totalLine2W = wTawreed + wDot + wAmancoEn + wPlusEn;

        const maxTextW = Math.max(totalLine1W, totalLine2W);
        const gap = 42;
        const totalW = iconSize + gap + maxTextW;
        const startX = (width - totalW) / 2;

        // Right edge of the whole logo layout
        const rightEdge = width - startX;
        const iconX = rightEdge - iconSize;

        // Draw Shield
        ctx.drawImage(shieldImg, iconX, iconY, iconSize, iconSize);

        // Alignment reference for text right edge
        const textRight = iconX - gap;

        // Line 1: أمانكو بلس
        const line1Y = iconY + 12;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = '900 86px Cairo';

        const line1Left = textRight - totalLine1W;
        // Draw بلس on the left
        ctx.fillStyle = '#f97316';
        ctx.fillText('بلس', line1Left, line1Y);
        // Draw أمانكو on the right
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.fillText('أمانكو ', line1Left + wPlusAr, line1Y);

        // Line 2: AMANCO PLUS • للشحن والتوريد
        const line2Y = line1Y + 104;
        ctx.font = '700 31px Cairo';
        const line2Left = textRight - totalLine2W;

        let curX = line2Left;
        // Far left: للشحن والتوريد
        ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
        ctx.fillText('للشحن والتوريد', curX, line2Y);
        curX += wTawreed;

        // Dot: •
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.fillText('  •  ', curX, line2Y);
        curX += wDot;

        // AMANCO:
        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        ctx.fillText('AMANCO ', curX, line2Y);
        curX += wAmancoEn;

        // PLUS:
        ctx.fillStyle = '#f97316';
        ctx.fillText('PLUS', curX, line2Y);
      }

      // 1. Horizontal Dark Background (2400 x 700)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');
        drawHorizontalLogo(ctx, 2400, 700, true, false);
        await sendImage('amanco-logo-dark-bg.png', canvas);
      }

      // 2. Horizontal White Background (2400 x 700)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');
        drawHorizontalLogo(ctx, 2400, 700, false, false);
        await sendImage('amanco-logo-white-bg.png', canvas);
      }

      // 3. Horizontal Transparent Background (Dark text for white papers) (2400 x 700)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');
        drawHorizontalLogo(ctx, 2400, 700, false, true);
        await sendImage('amanco-logo-transparent.png', canvas);
      }

      // 4. Horizontal Transparent Background (White text for dark banners) (2400 x 700)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');
        drawHorizontalLogo(ctx, 2400, 700, true, true);
        await sendImage('amanco-logo-transparent-white.png', canvas);
      }

      // 5. Square Avatar for Social Media / WhatsApp Business (1200 x 1200) - Luxury Dark Navy
      {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');

        // Background
        const grad = ctx.createRadialGradient(600, 600, 50, 600, 600, 750);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(0.6, '#0f172a');
        grad.addColorStop(1, '#070d19');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Circular ambient glow behind shield
        const glow = ctx.createRadialGradient(600, 480, 20, 600, 480, 320);
        glow.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
        glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Large Shield
        const iconSize = 460;
        const iconX = (canvas.width - iconSize) / 2;
        const iconY = 190;
        ctx.drawImage(shieldImg, iconX, iconY, iconSize, iconSize);

        // Line 1: أمانكو بلس
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '900 96px Cairo';

        // Measure text to center properly with dual colors
        const amancoTxt = 'أمانكو ';
        const plusTxt = 'بلس';
        const amancoW = ctx.measureText(amancoTxt).width;
        const plusW = ctx.measureText(plusTxt).width;
        const totalW = amancoW + plusW;
        const rightEdge = (canvas.width + totalW) / 2;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(amancoTxt, rightEdge, 730);

        ctx.fillStyle = '#f97316';
        ctx.fillText(plusTxt, rightEdge - amancoW, 730);

        // Subtitle: AMANCO PLUS • للشحن والتوريد
        ctx.textAlign = 'center';
        ctx.font = '700 36px Cairo';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('AMANCO PLUS  •  للشحن والتوريد', 600, 870);

        // Tagline badge
        ctx.font = '600 24px Cairo';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('القاهرة  •  الجيزة  •  القليوبية', 600, 950);

        await sendImage('amanco-avatar-square-dark.png', canvas);
      }

      // 6. Square Avatar White Background (1200 x 1200)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const iconSize = 460;
        const iconX = (canvas.width - iconSize) / 2;
        const iconY = 200;
        ctx.drawImage(shieldImg, iconX, iconY, iconSize, iconSize);

        ctx.font = '900 96px Cairo';
        const amancoTxt = 'أمانكو ';
        const plusTxt = 'بلس';
        const amancoW = ctx.measureText(amancoTxt).width;
        const plusW = ctx.measureText(plusTxt).width;
        const totalW = amancoW + plusW;
        const rightEdge = (canvas.width + totalW) / 2;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(amancoTxt, rightEdge, 740);

        ctx.fillStyle = '#f97316';
        ctx.fillText(plusTxt, rightEdge - amancoW, 740);

        ctx.textAlign = 'center';
        ctx.font = '700 36px Cairo';
        ctx.fillStyle = '#475569';
        ctx.fillText('AMANCO PLUS  •  للشحن والتوريد', 600, 880);

        await sendImage('amanco-avatar-square-white.png', canvas);
      }

      // 7. Icon Only High-Res Transparent (1024 x 1024)
      {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        const pad = 64;
        ctx.drawImage(shieldImg, pad, pad, 1024 - pad * 2, 1024 - pad * 2);

        await sendImage('amanco-shield-icon-1024.png', canvas);
      }

      // 8. Icon Only 512x512
      {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const pad = 32;
        ctx.drawImage(shieldImg, pad, pad, 512 - pad * 2, 512 - pad * 2);

        await sendImage('amanco-shield-icon-512.png', canvas);
      }

      status.innerText = 'All images generated and saved successfully!';
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

let server;
server = http.createServer(async (req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlPage);
  } else if (req.url === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
        console.log(`Saved: ${filename} (${fs.statSync(filePath).size} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(err.message);
      }
    });
  } else if (req.url === '/done' && req.method === 'POST') {
    console.log('✓ All image assets generated successfully!');
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

const PORT = 8989;
server.listen(PORT, () => {
  console.log(`Brand image generator server listening on http://localhost:${PORT}`);
  // Launch Edge headless
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless --disable-gpu http://localhost:${PORT}`;
  exec(cmd, (err) => {
    if (err) {
      console.log('Edge headless exited:', err.message);
    }
  });
});
