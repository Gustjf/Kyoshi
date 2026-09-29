/* Kyoshi · core/pdf-import.js — brings another PDF's pages into a document being made (core/pdf-write.js),
 * for proof attached to a report. K.pdf.importPages(doc, bytes) turns each page into a Form XObject: its
 * content (one stream copied as it is, or several unpacked and joined), its own Resources, its /Group,
 * clipped to the part that shows (CropBox within MediaBox). Everything it uses is copied once per file
 * and renumbered, leaving out links back to the page tree. Filled-in form fields and other annotations
 * with an appearance come along too, drawn in place. K.pdf.fit(page, area) gives the matrix that turns a
 * page upright (its /Rotate) and fits it in an area of a new page. A file that can't be read throws
 * (code "protected" or "broken"); a page whose content can't be unpacked comes back as { error }. */
(function (K) {
  "use strict";
  const pdf = K.pdf;
  const { Name, Ref, Dict, Stream, isName } = pdf;
  const N = n => new Name(n);
  const SKIP_KEYS = new Set(["Parent", "P", "StructParent", "StructParents"]);
  const SKIP_TYPES = new Set(["Page", "Pages", "Catalog"]);

  // Matrices [a b c d e f] (PDF's row-vector convention): m first, then n.
  const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  function importPages(doc, bytes) {
    const { doc: src, pages } = pdf.open(bytes);
    const copied = new Map(); // the file's object number -> its Ref in doc

    function copy(v, depth = 0) {
      if (depth > 400) return null;
      if (!(v instanceof Ref)) return copyValue(v, depth);
      if (copied.has(v.num)) return copied.get(v.num);
      const target = src.get(v), d = target instanceof Stream ? target.dict : target;
      if (target === null || target === undefined) return null;
      if (d instanceof Dict && isName(d.get("Type")) && SKIP_TYPES.has(d.get("Type").n)) return null; // no page tree
      const ref = doc.alloc();
      copied.set(v.num, ref);
      doc.set(ref, copyValue(target, depth + 1));
      return ref;
    }
    function copyValue(v, depth) {
      if (Array.isArray(v)) return v.map(x => copy(x, depth + 1));
      if (v instanceof Stream) {
        const d = copyDict(v.dict, depth);
        d.delete("Length"); // written afresh
        return new Stream(d, v.data);
      }
      return v instanceof Dict ? copyDict(v, depth) : v;
    }
    function copyDict(d, depth) {
      const out = new Dict();
      d.forEach((val, k) => { if (!SKIP_KEYS.has(k)) out.set(k, copy(val, depth + 1)); });
      return out;
    }

    // A page's content as one stream: a single piece as it is (still packed, with its filter), or
    // several pieces unpacked and joined with a line break between (packed again when saved).
    function contentOf(page) {
      const c = src.resolve(page.dict.get("Contents")), pieces = (Array.isArray(c) ? c.map(x => src.resolve(x)) : [c]).filter(x => x instanceof Stream);
      if (pieces.length === 1) {
        const d = new Dict();
        ["Filter", "DecodeParms"].forEach(k => { if (pieces[0].dict.get(k) !== undefined) d.set(k, copy(pieces[0].dict.get(k))); });
        return new Stream(d, pieces[0].data);
      }
      const parts = pieces.map(p => src.decode(p)), out = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0));
      let at = 0;
      parts.forEach(p => { out.set(p, at); at += p.length; out[at++] = 10; });
      return Object.assign(new Stream(new Dict(), out), { pack: true });
    }

    // Annotations with an appearance (filled-in fields, stamps, signatures…), each as a form and the
    // matrix that puts it on its rectangle (the PDF spec's algorithm), in the page's space.
    function annotsOf(page) {
      const list = src.resolve(page.dict.get("Annots")), out = [];
      (Array.isArray(list) ? list : []).forEach(a => {
        const ann = src.resolve(a);
        if (!(ann instanceof Dict)) return;
        const flags = Number(src.resolve(ann.get("F"))) || 0, sub = src.resolve(ann.get("Subtype"));
        if (flags & 2 || flags & 32 || isName(sub, "Popup") || isName(sub, "Link")) return; // hidden, not for viewing
        const ap = src.resolve(ann.get("AP"));
        let n = ap instanceof Dict ? ap.get("N") : null;
        const states = src.resolve(n);
        if (states instanceof Dict && !(states instanceof Stream)) {
          const as = src.resolve(ann.get("AS"));
          n = as instanceof Name ? states.get(as.n) : null;
        }
        const st = src.resolve(n), rect = src.resolve(ann.get("Rect"));
        if (!(n instanceof Ref) || !(st instanceof Stream) || !Array.isArray(rect)) return;
        const r = rect.map(x => Number(src.resolve(x))), bb = (src.resolve(st.dict.get("BBox")) || []).map(x => Number(src.resolve(x)));
        const m = (src.resolve(st.dict.get("Matrix")) || [1, 0, 0, 1, 0, 0]).map(x => Number(src.resolve(x)));
        if (r.length < 4 || bb.length < 4 || r.concat(bb, m).some(x => !isFinite(x))) return;
        const corners = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => apply(m, x, y));
        const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
        const tx = Math.min(...xs), ty = Math.min(...ys), tw = Math.max(...xs) - tx, th = Math.max(...ys) - ty;
        const rx = Math.min(r[0], r[2]), ry = Math.min(r[1], r[3]), rw = Math.abs(r[2] - r[0]), rh = Math.abs(r[3] - r[1]);
        if (tw <= 0 || th <= 0) return;
        const form = copy(n), obj = form && doc.get(form);
        if (!(obj instanceof Stream)) return;
        obj.dict.set("Type", N("XObject")); // an appearance is a form, whether it says so or not
        obj.dict.set("Subtype", N("Form"));
        out.push({ form, matrix: [rw / tw, 0, 0, rh / th, rx - tx * rw / tw, ry - ty * rh / th] });
      });
      return out;
    }

    return pages.map(page => {
      try {
        const st = contentOf(page);
        st.dict.set("Type", N("XObject"));
        st.dict.set("Subtype", N("Form"));
        st.dict.set("BBox", page.box);
        st.dict.set("Resources", copy(page.resources) || new Dict());
        const group = page.dict.get("Group");
        if (group !== undefined && group !== null) st.dict.set("Group", copy(group));
        let annots = [];
        try { annots = annotsOf(page); } catch (err) { annots = []; } // the page still comes, without them
        return { form: doc.alloc(st), box: page.box, rotate: page.rotate, annots };
      } catch (err) {
        return { error: err.code || "broken", box: page.box, rotate: page.rotate };
      }
    });
  }

  // The matrix that turns an imported page upright and fits it in area { x, y, w, h } (PDF space: from the
  // bottom-left), centered across and held to the top, never enlarged past maxScale; and its size there.
  function fit(imp, area, maxScale = 1.25) {
    const [x0, y0, x1, y1] = imp.box, w = x1 - x0, h = y1 - y0, turned = imp.rotate % 180 !== 0;
    const dw = turned ? h : w, dh = turned ? w : h, s = Math.min(area.w / dw, area.h / dh, maxScale);
    const upright = { 0: [1, 0, 0, 1, -x0, -y0], 90: [0, -1, 1, 0, -y0, x1], 180: [-1, 0, 0, -1, x1, y1], 270: [0, 1, -1, 0, y1, -x0] }[imp.rotate];
    const m = mul(upright, [s, 0, 0, s, area.x + (area.w - dw * s) / 2, area.y + area.h - dh * s]);
    return { m, w: dw * s, h: dh * s };
  }

  // Draws an imported page (and its annotations) on a page of the new document through matrix m.
  function draw(page, imp, m) {
    page.place(imp.form, m);
    (imp.annots || []).forEach(a => page.place(a.form, mul(a.matrix, m)));
  }

  Object.assign(pdf, { importPages, fit, draw, mul });
})(Kyoshi);
