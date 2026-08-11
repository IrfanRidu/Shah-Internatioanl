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

// Fixed clearance below the letterhead before content starts — deliberately NOT derived from the
// uploaded image's own rendered height any more. Confirmed from a real admin's actual upload
// (measured directly from a generated PDF): the image's visible graphic (a green banner) was only
// ~20mm tall, but the image FILE's own aspect ratio rendered to ~80mm tall at full page width — it
// had a lot of blank space baked into the file well past its visible content, and reserving space
// proportional to that full rendered height (the previous approach) reintroduced exactly the
// oversized-gap problem this constant exists to avoid. A letterhead is, by definition, a short
// header graphic — ~1 inch of clearance past a typical banner's own height is what was explicitly
// asked for, and is a far better default than trying to infer "where the image's real content ends"
// (not something derivable from just width/height without actual pixel analysis). The image itself
// is still always drawn at its own full, undistorted natural size underneath — only where CONTENT
// starts drawing on top of it is fixed, never the image's own rendering.
export const LETTERHEAD_CONTENT_START_MM = 45;

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
  return { renderW, renderH, x, y: 0, contentStartY: LETTERHEAD_CONTENT_START_MM };
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
