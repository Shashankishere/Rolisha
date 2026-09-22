/**
 * Text-extraction-only stand-in for the native `@napi-rs/canvas` package.
 *
 * WHY THIS EXISTS
 * `pdf-parse/worker` -- the entry point pdf-parse 2.x documents for
 * serverless/Workers runtimes -- begins with:
 *
 *   import { Canvas, createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
 *   global.DOMMatrix = DOMMatrix; global.Path2D = Path2D; global.ImageData = ImageData;
 *
 * `@napi-rs/canvas` is a native (Skia) addon. A Cloudflare Worker cannot load
 * `.node` binaries, so bundling it fails (`UNLOADABLE_DEPENDENCY`), and without
 * `DOMMatrix` pdf.js throws `ReferenceError: DOMMatrix is not defined` while
 * merely loading -- before `getText()` is ever called.
 *
 * Rolisha only ever calls `PDFParse#getText()` (see resume-extract.server.ts).
 * Text extraction never renders, so it needs these globals to EXIST (pdf.js
 * allocates one `DOMMatrix` when its module loads) but never calls into them.
 * vite.config.ts aliases `@napi-rs/canvas` to this file for the Worker build
 * only; Node (Vitest, `vite dev`) keeps using the real package via its own
 * config.
 *
 * Every rendering entry point throws a clear error rather than returning a
 * plausible-but-wrong value, so an accidental future use (e.g. calling
 * `getScreenshot()`) fails loudly instead of silently producing garbage.
 */

function unavailable(what: string): Error {
  return new Error(`${what} is not available in this runtime (PDF text extraction only).`);
}

export class DOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  readonly is2D = true;

  // The initial value is accepted for API-shape compatibility only.
  constructor(_init?: unknown) {}

  multiplySelf(): never {
    throw unavailable("DOMMatrix.multiplySelf");
  }
  preMultiplySelf(): never {
    throw unavailable("DOMMatrix.preMultiplySelf");
  }
  invertSelf(): never {
    throw unavailable("DOMMatrix.invertSelf");
  }
  translate(): never {
    throw unavailable("DOMMatrix.translate");
  }
  scale(): never {
    throw unavailable("DOMMatrix.scale");
  }
}

export class Path2D {
  constructor(_path?: unknown) {}
  addPath(): never {
    throw unavailable("Path2D.addPath");
  }
}

export class ImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(Math.max(0, width * height * 4));
  }
}

export class Canvas {
  constructor() {
    throw unavailable("Canvas");
  }
}

export function createCanvas(_width: number, _height: number): never {
  throw unavailable("createCanvas");
}
