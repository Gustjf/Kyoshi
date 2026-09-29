/* Kyoshi · core/pdf-read.js — an attached PDF's pages (K.pdf.open), and a quick check that one can be
 * brought into reports (K.pdf.inspect: how many pages, or why not). Walks the page tree, giving each
 * page the Resources, MediaBox, CropBox and Rotate it inherits from above. A password-protected file
 * is refused (code "protected"), as is one with no pages to be found (code "broken"). */
(function (K) {
  "use strict";
  const pdf = K.pdf;
  const { Dict, Ref, isName } = pdf;
  const MAX_PAGES = 2000;
  const refuse = code => Object.assign(new Error(code === "protected" ? "This PDF is password-protected" : "This PDF couldn't be read"), { code });

  // A box ([x0, y0, x1, y1], lowest corner first), or null.
  function boxOf(doc, v) {
    const a = doc.resolve(v);
    if (!Array.isArray(a) || a.length < 4) return null;
    const n = a.slice(0, 4).map(x => Number(doc.resolve(x)));
    if (n.some(x => !isFinite(x))) return null;
    const b = [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
    return b[2] - b[0] > 1 && b[3] - b[1] > 1 ? b : null;
  }

  // One page: its dictionary, the part that shows (CropBox within MediaBox), its turn (0, 90, 180 or 270,
  // clockwise) and its Resources (a Dict or a Ref, as found).
  function pageOf(doc, dict, attrs) {
    const media = boxOf(doc, attrs.MediaBox) || [0, 0, 612, 792], crop = boxOf(doc, attrs.CropBox) || media;
    const box = [Math.max(crop[0], media[0]), Math.max(crop[1], media[1]), Math.min(crop[2], media[2]), Math.min(crop[3], media[3])];
    const turn = Number(doc.resolve(attrs.Rotate)) || 0;
    return {
      dict,
      box: box[2] - box[0] > 1 && box[3] - box[1] > 1 ? box : media,
      rotate: (((Math.round(turn / 90) * 90) % 360) + 360) % 360,
      resources: attrs.Resources || new Dict()
    };
  }

  // A PDF file's bytes → { doc (see core/pdf-parse.js), pages }.
  function open(bytes) {
    let doc;
    try { doc = pdf.parse(bytes); } catch (err) { throw refuse("broken"); }
    if (doc.encrypted) throw refuse("protected");
    const root = doc.resolve(doc.trailer.get("Root")), pages = [], seen = new Set();
    const walk = (node, inherited, depth) => {
      if (!(node instanceof Dict) || depth > 60 || pages.length >= MAX_PAGES) return;
      const attrs = { ...inherited };
      ["Resources", "MediaBox", "CropBox", "Rotate"].forEach(k => { if (node.get(k) !== undefined && node.get(k) !== null) attrs[k] = node.get(k); });
      const kids = doc.resolve(node.get("Kids"));
      if (Array.isArray(kids) && !isName(node.get("Type"), "Page")) {
        kids.forEach(k => {
          if (k instanceof Ref) {
            if (seen.has(k.num)) return;
            seen.add(k.num);
          }
          walk(doc.resolve(k), attrs, depth + 1);
        });
      } else pages.push(pageOf(doc, node, attrs));
    };
    walk(root instanceof Dict ? doc.resolve(root.get("Pages")) : null, {}, 0);
    if (!pages.length) throw refuse("broken");
    return { doc, pages };
  }

  // Whether a PDF can go into reports: { pages } — or an Error whose code says why not.
  function inspect(bytes) {
    return { pages: open(bytes).pages.length };
  }

  Object.assign(pdf, { open, inspect });
})(Kyoshi);
