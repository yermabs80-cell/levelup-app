/**
 * Генератор PNG-иконок из геометрии icon.svg.
 *
 * Google Play и установка PWA требуют растровые 192×192 и 512×512 плюс
 * maskable-вариант, а в проекте была одна SVG-иконка. Ставить ради этого
 * sharp или ImageMagick незачем: фигур в иконке шесть, а PNG умеет собрать
 * встроенный zlib. Скрипт запускается вручную — `npm run icons` — и его
 * результат коммитится, поэтому у сборки по-прежнему нет зависимостей.
 *
 * Геометрия повторяет icon.svg. Меняешь SVG — поправь SHAPES и перегенерируй.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'icons');

/** Исходная система координат: viewBox="0 0 512 512". */
const VIEWBOX = 512;
const SAMPLES = 3; // 3×3 подпикселя — сглаживание без заметной цены по времени

// ── Цвета ──────────────────────────────────────────────────────────────────

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const solid = hex => {
  const color = rgb(hex);
  return () => color;
};

function mix(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t)
  ];
}

/** Многоточечный градиент по нормализованной координате 0…1. */
function ramp(stops) {
  const parsed = stops.map(([offset, hex]) => [offset, rgb(hex)]);

  return t => {
    const clamped = Math.min(1, Math.max(0, t));
    for (let index = 1; index < parsed.length; index += 1) {
      const [prevOffset, prevColor] = parsed[index - 1];
      const [offset, color] = parsed[index];
      if (clamped <= offset) {
        const span = offset - prevOffset || 1;
        return mix(prevColor, color, (clamped - prevOffset) / span);
      }
    }
    return parsed.at(-1)[1];
  };
}

const diagonalGradient = stops => {
  const shade = ramp(stops);
  return (x, y) => shade((x / VIEWBOX + y / VIEWBOX) / 2);
};

const verticalGradient = (top, bottom, stops) => {
  const shade = ramp(stops);
  return (_x, y) => shade((y - top) / (bottom - top));
};

// ── Фигуры: каждая отвечает на вопрос «точка внутри?» ──────────────────────

function roundedRect(x, y, width, height, radius) {
  return (px, py) => {
    if (px < x || py < y || px > x + width || py > y + height) return false;

    const nearLeft = px < x + radius;
    const nearRight = px > x + width - radius;
    const nearTop = py < y + radius;
    const nearBottom = py > y + height - radius;
    if (!((nearLeft || nearRight) && (nearTop || nearBottom))) return true;

    const cx = nearLeft ? x + radius : x + width - radius;
    const cy = nearTop ? y + radius : y + height - radius;
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
  };
}

function polygon(points) {
  const bounds = points.reduce(
    (box, [x, y]) => [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)],
    [Infinity, Infinity, -Infinity, -Infinity]
  );

  return (px, py) => {
    if (px < bounds[0] || px > bounds[2] || py < bounds[1] || py > bounds[3]) return false;

    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const crosses = (yi > py) !== (yj > py)
        && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  };
}

function distanceToSegment(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Обводка = точки на расстоянии не больше половины толщины от ломаной. */
function stroke(points, width, { closed = false } = {}) {
  const half = width / 2;
  const segments = [];
  for (let index = 1; index < points.length; index += 1) segments.push([points[index - 1], points[index]]);
  if (closed) segments.push([points.at(-1), points[0]]);

  const boxes = segments.map(([a, b]) => [
    Math.min(a[0], b[0]) - half, Math.min(a[1], b[1]) - half,
    Math.max(a[0], b[0]) + half, Math.max(a[1], b[1]) + half
  ]);

  return (px, py) => segments.some(([a, b], index) => {
    const box = boxes[index];
    if (px < box[0] || px > box[2] || py < box[1] || py > box[3]) return false;
    return distanceToSegment(px, py, a, b) <= half;
  });
}

function circle(cx, cy, radius) {
  return (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}

/** Кубическая кривая в ломаную: 24 звена на дугу визуально неотличимы от кривой. */
function cubic(from, control1, control2, to, steps = 24) {
  const points = [];
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u ** 3 * from[0] + 3 * u * u * t * control1[0] + 3 * u * t * t * control2[0] + t ** 3 * to[0],
      u ** 3 * from[1] + 3 * u * u * t * control1[1] + 3 * u * t * t * control2[1] + t ** 3 * to[1]
    ]);
  }
  return points;
}

// ── Композиция иконки ──────────────────────────────────────────────────────

// M256 55 L407 132 V252 C407 352 345 419 256 458 C167 419 105 352 105 252 V132Z
const SHIELD = [
  [256, 55],
  [407, 132],
  [407, 252],
  ...cubic([407, 252], [407, 352], [345, 419], [256, 458]),
  ...cubic([256, 458], [167, 419], [105, 352], [105, 252]),
  [105, 132]
];

const BLADE = [[256, 108], [286, 266], [256, 326], [226, 266]];

const BACKGROUND = {
  test: roundedRect(0, 0, 512, 512, 112),
  paint: diagonalGradient([[0, '#172554'], [1, '#070b16']]),
  fullBleed: true
};

/** Всё, кроме фона: именно это масштабируется внутрь безопасной зоны maskable. */
const ARTWORK = [
  { test: polygon(SHIELD), paint: solid('#0d1729') },
  { test: stroke(SHIELD, 18, { closed: true }), paint: solid('#4de0ff') },
  { test: polygon(BLADE), paint: verticalGradient(108, 326, [[0, '#ffffff'], [0.45, '#4de0ff'], [1, '#8b5cf6']]) },
  { test: stroke([[188, 278], [324, 278]], 24), paint: solid('#4de0ff') },
  { test: stroke([[256, 314], [256, 395]], 25), paint: solid('#a78bfa') },
  { test: circle(256, 409, 19), paint: solid('#4de0ff') }
];

// ── Растеризация ───────────────────────────────────────────────────────────

/**
 * Красим по подпикселям: для каждой точки берём самую верхнюю накрывшую её
 * фигуру, затем усредняем. Дешёвое и честное сглаживание без сторонних библиотек.
 */
function rasterize(size, { maskable = false } = {}) {
  const scale = maskable ? 0.78 : 1;
  const center = VIEWBOX / 2;

  const layers = [
    { ...BACKGROUND, test: maskable ? () => true : BACKGROUND.test },
    ...ARTWORK
  ];

  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          // Пиксель изображения → координата viewBox → координата фигуры.
          const vx = ((px + (sx + 0.5) * step) / size) * VIEWBOX;
          const vy = ((py + (sy + 0.5) * step) / size) * VIEWBOX;

          for (let index = layers.length - 1; index >= 0; index -= 1) {
            const layer = layers[index];
            const x = layer.fullBleed ? vx : center + (vx - center) / scale;
            const y = layer.fullBleed ? vy : center + (vy - center) / scale;

            if (!layer.test(x, y)) continue;

            const [r, g, b] = layer.paint(x, y);
            red += r;
            green += g;
            blue += b;
            alpha += 255;
            break;
          }
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      const covered = alpha / 255;

      // Делим на количество накрытых подпикселей, иначе край темнеет:
      // прозрачные подпиксели не должны подмешивать чёрный.
      pixels[offset] = covered ? Math.round(red / covered) : 0;
      pixels[offset + 1] = covered ? Math.round(green / covered) : 0;
      pixels[offset + 2] = covered ? Math.round(blue / covered) : 0;
      pixels[offset + 3] = Math.round(alpha / total);
    }
  }

  return pixels;
}

// ── Кодирование PNG ────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // бит на канал
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // Каждая строка начинается с байта фильтра; 0 — «без фильтра».
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let row = 0; row < size; row += 1) {
    raw[row * (stride + 1)] = 0;
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Точка входа ────────────────────────────────────────────────────────────

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true }
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const png = encodePng(target.size, rasterize(target.size, { maskable: target.maskable }));
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`icons/${target.file} · ${target.size}×${target.size} · ${(png.length / 1024).toFixed(1)} КБ`);
}
