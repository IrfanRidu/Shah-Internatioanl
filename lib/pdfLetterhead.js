// Single shared implementation of "draw the admin's uploaded company letterhead as the PDF page
// background" for every generated document (Packing List, Buyer's Invoice, BD Invoice, Ka Form,
// Stamp Application). Previously each generator either hand-rolled a programmatic header (green
// banner + company name/address/etc drawn in code) or squeezed the uploaded image into a small,
// sometimes-distorted header band. Per the explicit requirement: the uploaded letterhead IS the
// header (logo, name, address, phone, email, website, banner -- all of it) -- none of that is ever
// synthesized in code again. This module only decides WHERE and AT WHAT SIZE to place that one
// image; every document's own content (title, tables, signatures, etc.) is unchanged.

// Fetches a (Cloudinary) image URL and returns a data URL jsPDF can embed, plus its true pixel
// dimensions (needed to preserve aspect ratio). Returns nulls on any failure (offline, CORS, bad
// URL, nothing uploaded yet) so callers can gracefully render with no background at all.
export async function loadImageForPdf(url) {
  if (!url) return { dataUrl: null, dims: null };
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    return dims ? { dataUrl, dims } : { dataUrl: null, dims: null };
  } catch {
    return { dataUrl: null, dims: null };
  }
}

// A very short/small letterhead upload still reserves at least this much clearance (matches the
// proportions of the reference sample invoice's own header band), and a very tall/full-page-shaped
// upload is still capped here so there's always room left for the document's own content -- the
// image itself is NEVER cropped/cut to this cap, only where content starts drawing on top of it is.
const MIN_CONTENT_START_MM = 38;
const MAX_CONTENT_START_MM = 90;
// Small visual gap between the bottom of the letterhead artwork and the first line of content.
const CONTENT_GAP_MM = 5;

// Pure layout math, no drawing -- exposed separately so a caller can know the content-start Y before
// deciding how to lay out the rest of the page.
export function computeLetterheadLayout(letterhead, pageWidthMm, pageHeightMm) {
  const dims = letterhead?.dims;
  if (!letterhead?.dataUrl || !dims?.width || !dims?.height) {
    return { renderW: 0, renderH: 0, x: 0, y: 0, contentStartY: null };
  }
  const ratio = dims.height / dims.width;
  let renderW = pageWidthMm;
  let renderH = pageWidthMm * ratio;
  let x = 0;
  // Full-bleed on width; only constrained by page height for an unusually tall/portrait upload
  // (never distorted -- always derived from the image's own ratio either way).
  if (renderH > pageHeightMm) {
    renderH = pageHeightMm;
    renderW = pageHeightMm / ratio;
    x = (pageWidthMm - renderW) / 2;
  }
  const contentStartY = Math.min(Math.max(renderH + CONTENT_GAP_MM, MIN_CONTENT_START_MM), MAX_CONTENT_START_MM);
  return { renderW, renderH, x, y: 0, contentStartY };
}

// Draws the letterhead full-bleed (edge to edge) at the top of the CURRENT page, preserving its
// native aspect ratio exactly (no crop, no stretch). Returns the Y (mm) the page's own content
// should start at, or null if there is no letterhead to draw (caller should fall back to its normal
// top margin in that case).
export function drawLetterheadBackground(doc, letterhead, pageWidthMm, pageHeightMm) {
  if (!letterhead?.dataUrl) return null;
  const layout = computeLetterheadLayout(letterhead, pageWidthMm, pageHeightMm);
  if (!layout.renderW) return null;
  try {
    doc.addImage(letterhead.dataUrl, layout.x, layout.y, layout.renderW, layout.renderH);
  } catch (e) {
    console.error('Failed to draw letterhead background image', e);
    return null;
  }
  return layout.contentStartY;
}
