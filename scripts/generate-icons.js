import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, isMaskable = false) {
  // Simple PNG writer using zlib
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * (isMaskable ? 0.38 : 0.44);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: Deep Navy #0B1528
      let r = 11, g = 21, b = 40, a = 255;

      // Outer emblem circle / border
      if (dist < radius + 6 && dist >= radius - 2) {
        // Cyan ring #06B6D4
        r = 6; g = 182; b = 212; a = 255;
      } else if (dist < radius - 2) {
        // Inner badge: Dark Slate Blue #0F172A
        r = 15; g = 23; b = 42;
        
        // Let's draw a stylish "C" and financial node icon
        // Arch of "C"
        const innerDist = Math.abs(dist - radius * 0.55);
        const angle = Math.atan2(dy, dx); // -pi to pi
        const isRightGap = (angle > -0.65 && angle < 0.65);

        if (innerDist < radius * 0.18 && !isRightGap) {
          // Brand Cyan
          r = 6; g = 182; b = 212; a = 255;
        }

        // Diamond accent inside or center dot (Gold #F59E0B)
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        if (centerDist < radius * 0.22) {
          // Gold node
          r = 245; g = 158; b = 11; a = 255;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG structure: Signature + IHDR + IDAT + IEND
  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, false));

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="128" fill="#0B1528"/>
  <circle cx="256" cy="256" r="180" stroke="#06B6D4" stroke-width="20" stroke-linecap="round" stroke-dasharray="850 250"/>
  <path d="M340 180C315 150 280 140 240 140C170 140 120 190 120 256C120 322 170 372 240 372C280 372 315 362 340 332" stroke="#06B6D4" stroke-width="36" stroke-linecap="round" fill="none"/>
  <circle cx="256" cy="256" r="42" fill="#F59E0B"/>
  <path d="M256 100V130M256 382V412M100 256H130M382 256H412" stroke="#38BDF8" stroke-width="12" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
console.log('Icons generated successfully in /public');
