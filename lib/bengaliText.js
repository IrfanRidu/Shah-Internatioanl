// Bengali text rendering for jsPDF documents (Ka Form, Stamp Application).
//
// WHY THIS EXISTS: jsPDF's built-in fonts (helvetica/times/courier) have zero Bengali glyphs, so
// doc.text() with Bengali input renders as blank boxes. Embedding a Unicode Bengali font into jsPDF
// (addFileToVFS/addFont) is NOT enough on its own either -- jsPDF has no OpenType shaping engine, so
// it draws one glyph per Unicode codepoint left-to-right with no conjunct ligatures and no vowel-sign
// reordering, which is still wrong/broken for real Bengali text (conjuncts like ক্ষ/ন্দ্র and the very
// common pre-base vowel sign ি are fundamental to Bengali, not edge cases).
//
// FIX: render the text to an offscreen <canvas> using a bundled web font first. Canvas text goes
// through the browser's real text-shaping engine (the same one used for ordinary DOM text), so
// conjuncts and reordering come out correct. The canvas is then exported as a PNG data URL and
// embedded into the PDF with doc.addImage() instead of doc.text(). See public/fonts/FONT_LICENSE.txt
// for the bundled font itself.
//
// Only text that actually contains Bengali characters pays this cost -- see hasBengaliChars(). Pure
// Latin/number strings (reference codes, dates, foreign-currency amounts -- see the digit-convention
// notes in kaFormDocuments.js) keep using normal vector doc.text(), which stays crisp, small, and
// selectable.

const FONT_FAMILY = 'ShahBengali';
const FONT_URL = '/fonts/FreeSansBengali.ttf';
const BENGALI_RE = /[\u0980-\u09FF]/;

// Canvas pixels per PDF point. jsPDF's setFontSize()/mm-unit math is all in points for font size, so
// every size this module takes is in points too, for a consistent mental model with the rest of
// kaFormDocuments.js. SCALE=4 -> ~288 effective DPI for the rasterized text, comfortably crisp for
// print without generating huge per-cell PNGs (this only governs TEXT crispness -- the separate
// letterhead background image quality is handled independently, see lib/pdfLetterhead.js).
const SCALE = 4;
const MM_PER_PT = 25.4 / 72;

export function hasBengaliChars(str) {
  return BENGALI_RE.test(String(str ?? ''));
}

let fontLoadPromise = null;
// Must be awaited once (per page load) before any render*/measure* call below. Safe to call many
// times -- subsequent calls reuse the same in-flight/settled promise.
export function ensureBengaliFontLoaded() {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve(false);
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      try {
        // Already loaded (e.g. a second document generated in the same session)?
        if ([...document.fonts.keys()].some((f) => f.family === FONT_FAMILY)) return true;
        const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
        const loaded = await face.load();
        document.fonts.add(loaded);
        return true;
      } catch (e) {
        console.error('Bengali font failed to load; Bengali text will not render correctly.', e);
        return false;
      }
    })();
  }
  return fontLoadPromise;
}

let sharedCanvas = null;
function ctxWithFont(sizePt, italic) {
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas');
  const ctx = sharedCanvas.getContext('2d');
  const px = sizePt * SCALE;
  ctx.font = `${italic ? 'italic ' : ''}${px}px "${FONT_FAMILY}", sans-serif`;
  return ctx;
}

// Width-only measurement (mm) at the given point size -- used to lay out multi-column content (e.g.
// deciding table column widths) without actually rendering an image yet.
export function measureTextWidthMm(text, sizePt, italic = false) {
  const ctx = ctxWithFont(sizePt, italic);
  const w = ctx.measureText(String(text ?? '')).width;
  return (w / SCALE) * MM_PER_PT;
}

// Greedy word-wrap using real canvas metrics (Bengali uses spaces between words same as Latin, so
// simple space-based wrapping is correct -- unlike e.g. Thai/Lao which would need dictionary
// segmentation). Respects embedded "\n" as a FORCED line break -- each hard-broken segment is
// wrapped independently, rather than treating the whole string as one flowing paragraph where "\n"
// is just more whitespace between words (that was a real bug: a short multi-line block like a
// letter's salutation address -- several short, deliberately separate lines -- would get its break
// points silently discarded and re-wrapped as continuous prose, joining lines that must stay apart).
// Returns an array of line strings, each <= maxWidthMm.
export function wrapBengaliText(text, sizePt, maxWidthMm, italic = false) {
  const hardLines = String(text ?? '').split('\n');
  return hardLines.flatMap((hardLine) => wrapSingleLine(hardLine, sizePt, maxWidthMm, italic));
}

function wrapSingleLine(text, sizePt, maxWidthMm, italic) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const ctx = ctxWithFont(sizePt, italic);
  const maxWidthPx = (maxWidthMm / MM_PER_PT) * SCALE;
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidthPx || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Renders a SINGLE LINE of text to a PNG data URL sized to fit it exactly (plus small padding).
// bold uses a stroke-over-fill technique since the bundled font has no real bold weight for Bengali
// (see FONT_LICENSE.txt) -- this reads as a clean, slightly heavier weight rather than a smear.
export function renderBengaliLine(text, { sizePt = 9, bold = false, italic = false, color = [0, 0, 0] } = {}) {
  const str = String(text ?? '');
  const px = sizePt * SCALE;
  const measureCtx = ctxWithFont(sizePt, italic);
  const metrics = measureCtx.measureText(str || ' ');
  const ascent = metrics.actualBoundingBoxAscent || px * 0.82;
  const descent = metrics.actualBoundingBoxDescent || px * 0.28;
  const padX = Math.ceil(px * 0.06) + 1;
  const w = Math.max(1, Math.ceil(metrics.width) + padX * 2);
  const h = Math.max(1, Math.ceil(ascent + descent) + Math.ceil(px * 0.12));

  sharedCanvas.width = w;
  sharedCanvas.height = h;
  const ctx = sharedCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = `${italic ? 'italic ' : ''}${px}px "${FONT_FAMILY}", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const rgb = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fillStyle = rgb;
  const baselineY = ascent + Math.ceil(px * 0.04);
  ctx.fillText(str, padX, baselineY);
  if (bold) {
    ctx.lineWidth = Math.max(0.6, px * 0.045);
    ctx.strokeStyle = rgb;
    ctx.lineJoin = 'round';
    ctx.strokeText(str, padX, baselineY);
  }
  return {
    dataUrl: sharedCanvas.toDataURL('image/png'),
    widthMm: (w / SCALE) * MM_PER_PT,
    heightMm: (h / SCALE) * MM_PER_PT,
    ascentMm: ((ascent + Math.ceil(px * 0.04)) / SCALE) * MM_PER_PT,
  };
}

// High-level helper: draws possibly-multi-line Bengali text into a jsPDF doc at (x, y), y being the
// TOP of the text block (unlike doc.text's baseline-y convention -- kept top-based here since every
// call site in kaFormDocuments.js is laying out a vertical flow top-down). Returns the Y position
// immediately after the block. align is applied within maxWidthMm.
export function drawBengaliText(doc, text, x, y, { sizePt = 9, bold = false, italic = false, color = [0, 0, 0], maxWidthMm = 180, align = 'left', lineGapMm = 0.8 } = {}) {
  const lines = maxWidthMm ? wrapBengaliText(text, sizePt, maxWidthMm, italic) : [String(text ?? '')];
  let cursorY = y;
  for (const line of lines) {
    const img = renderBengaliLine(line, { sizePt, bold, italic, color });
    let drawX = x;
    if (align === 'center') drawX = x + (maxWidthMm - img.widthMm) / 2;
    else if (align === 'right') drawX = x + maxWidthMm - img.widthMm;
    doc.addImage(img.dataUrl, 'PNG', drawX, cursorY, img.widthMm, img.heightMm);
    cursorY += img.heightMm + lineGapMm;
  }
  return cursorY;
}

// Total height (mm) a wrapped block would occupy, without drawing it -- used for layout planning
// (e.g. table row heights) before committing to a draw call.
export function measureBengaliBlockHeightMm(text, sizePt, maxWidthMm, lineGapMm = 0.8) {
  const lines = wrapBengaliText(text, sizePt, maxWidthMm);
  const lineHeightMm = sizePt * MM_PER_PT * 1.32;
  return lines.length * lineHeightMm + (lines.length - 1) * lineGapMm;
}
