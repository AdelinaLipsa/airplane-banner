'use strict';
// Generates a visible black "template" airplane icon for the macOS menu bar /
// Windows tray. Template images are black + alpha; macOS auto-inverts them for
// light/dark menu bars. Produces trayTemplate.png (16px) and @2x (32px).
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// 16x16 top-down airplane silhouette ('#' = filled).
const ART = [
  '       ##       ',
  '       ##       ',
  '      ####      ',
  '      ####      ',
  '      ####      ',
  ' ############## ',
  ' ############## ',
  '      ####      ',
  '      ####      ',
  '      ####      ',
  '      ####      ',
  '    ########    ',
  '    ########    ',
  '      ####      ',
  '       ##       ',
  '       ##       ',
];

function buildRGBA(art, scale) {
  const h = art.length;
  const w = art[0].length;
  const W = w * scale;
  const H = h * scale;
  const buf = Buffer.alloc(W * H * 4, 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (art[Math.floor(y / scale)][Math.floor(x / scale)] === '#') {
        const o = (y * W + x) * 4;
        buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = 255;
      }
    }
  }
  return { buf, W, H };
}

function encodePNG({ buf, W, H }) {
  const stride = W * 4 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none
    buf.copy(raw, y * stride + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, '..', 'assets');
fs.writeFileSync(path.join(dir, 'trayTemplate.png'), encodePNG(buildRGBA(ART, 1)));
fs.writeFileSync(path.join(dir, 'trayTemplate@2x.png'), encodePNG(buildRGBA(ART, 2)));
console.log('Wrote assets/trayTemplate.png (16) and trayTemplate@2x.png (32)');
