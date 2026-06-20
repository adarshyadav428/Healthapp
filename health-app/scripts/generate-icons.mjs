import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Orange background
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, size, size);

  // White text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(size * 0.35)}px Arial`;
  ctx.fillText('CT', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

mkdirSync(join(__dirname, '../public/icons'), { recursive: true });
writeFileSync(join(__dirname, '../public/icons/icon-192x192.png'), generateIcon(192));
writeFileSync(join(__dirname, '../public/icons/icon-512x512.png'), generateIcon(512));
console.log('Icons generated successfully');
