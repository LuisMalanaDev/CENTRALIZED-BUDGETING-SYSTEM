const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generatePng(size) {
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);

  const center = size / 2;
  const strokeWidth = Math.max(2, Math.round(size * 0.04));

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      const dx = Math.abs(x - center);
      const dy = Math.abs(y - center);

      // Card graphic boundaries
      const cardW = size * 0.32;
      const cardH = size * 0.22;
      const inCardRect = dx <= cardW && dy <= cardH;
      const onCardBorder =
        inCardRect &&
        (dx >= cardW - strokeWidth || dy >= cardH - strokeWidth);

      // Horizontal magnetic stripe
      const stripeY = center - cardH * 0.35;
      const onStripe = inCardRect && Math.abs(y - stripeY) <= strokeWidth * 0.6;

      // Chip / circle
      const circleX = center + cardW * 0.45;
      const circleY = center + cardH * 0.35;
      const distCircle = Math.hypot(x - circleX, y - circleY);
      const onCircle = distCircle <= size * 0.045;

      let r = 0, g = 0, b = 0, a = 255;

      if (onCardBorder || onStripe || onCircle) {
        r = 255;
        g = 255;
        b = 255;
      }

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdr);

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.join(__dirname, '..', 'public');
const png192 = generatePng(192);
const png512 = generatePng(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);
console.log('Successfully generated icon-192.png and icon-512.png in frontend/public!');
