/* Kyoshi · core/pdf-write.js — makes PDF files (K.pdf.create), for reports any app can hand out.
 * A document's pages are drawn with a top-left coordinate API in points (72 to the inch): text in
 * Helvetica or Helvetica-Bold (core/pdf-font.js), lines, rectangles, JPEG photos (passed through as
 * they are), other PDFs' pages (Form XObjects from core/pdf-import.js) and links to pages or to web
 * addresses (http and https only). Nothing is written until save(), so footers can say "Page X of Y".
 * Output: PDF 1.7 with a classic cross-reference table, page contents compressed where the browser
 * has CompressionStream, text as hex strings and /Info and bookmarks in UTF-16. */
(function (K) {
  "use strict";
  const pdf = K.pdf;
  const { Name, Ref, Str, Dict, Stream } = pdf;
  const SIZES = { letter: [612, 792], a4: [595.28, 841.89] };
  const N = n => new Name(n);

  // --- Writing values ---
  function num(v) {
    if (!isFinite(v)) return "0";
    v = Math.max(-1e9, Math.min(1e9, v)); // never an exponent
    if (Number.isInteger(v)) return String(v);
    const s = v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }
  const escName = n => n.replace(/[^\x21-\x7e]|[#%()<>[\]{}/]/g, ch => `#${(ch.charCodeAt(0) & 255).toString(16).padStart(2, "0")}`);
  const hexOf = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  function ser(v) {
    if (v === null || v === undefined) return "null";
    if (v === true || v === false) return String(v);
    if (typeof v === "number") return num(v);
    if (v instanceof Name) return `/${escName(v.n)}`;
    if (v instanceof Ref) return `${v.num} ${v.gen} R`;
    if (v instanceof Str) return `<${hexOf(v.bytes)}>`;
    if (Array.isArray(v)) return `[${v.map(ser).join(" ")}]`;
    if (v instanceof Dict) {
      let s = "<<";
      v.forEach((val, k) => { if (val !== undefined) s += `/${escName(k)} ${ser(val)}`; });
      return `${s}>>`;
    }
    throw new Error("A value a PDF can't hold");
  }
  // Text for /Info and bookmarks: UTF-16BE with its byte-order mark.
  function utf16(s) {
    const units = [0xFE, 0xFF];
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); units.push(c >> 8, c & 255); }
    return new Str(Uint8Array.from(units));
  }
  const ascii = s => Uint8Array.from(s, ch => ch.charCodeAt(0) & 255);
  const color = c => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c || "") || [0, "000000"];
    return [0, 2, 4].map(i => num(parseInt(m[1].slice(i, i + 2), 16) / 255)).join(" ");
  };
  // Only web links go into a PDF.
  const safeUrl = u => (typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u) ? encodeURI(decodeURI(u)) : null);

  async function deflate(bytes) {
    if (typeof CompressionStream !== "function" || typeof Response !== "function") return null;
    try {
      const packed = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(packed).arrayBuffer());
    } catch (err) { return null; }
  }

  // A JPEG's size and color channels, from its start-of-frame marker.
  function jpegInfo(b) {
    if (b[0] !== 0xFF || b[1] !== 0xD8) throw new Error("Not a JPEG");
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7) || m === 0xFF) { i += m === 0xFF ? 1 : 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9] };
      i += 2 + len;
    }
    throw new Error("A JPEG without a size");
  }

  // ==========================================================================
  // A document
  // ==========================================================================
  function create({ title = "", author = "", creator = "Kyoshi", size = "letter" } = {}) {
    const [W, H] = SIZES[size] || size;
    const objects = [null]; // by object number
    const alloc = (v = null) => { objects.push(v); return new Ref(objects.length - 1, 0); };
    const set = (ref, v) => { objects[ref.num] = v; };
    const pagesRef = alloc(), fonts = {}, pages = [], marks = [];

    const fontRef = f => fonts[f] || (fonts[f] = alloc(new Dict([["Type", N("Font")], ["Subtype", N("Type1")], ["BaseFont", N(pdf.FONTS[f] || pdf.FONTS.regular)], ["Encoding", N("WinAnsiEncoding")]])));

    // A new page at the end (its size in points; the document's by default).
    function page(w = W, h = H) {
      const p = { ref: alloc(), w, h, ops: [], fonts: new Set(), xobjects: new Map(), annots: [] };
      const y = v => num(h - v);
      Object.assign(p, {
        // Text with its baseline at y. Options: font "regular" | "bold", size, color "#rrggbb".
        text(x, top, s, { font = "regular", size = 10, color: c = "#000000" } = {}) {
          const codes = pdf.encode(s);
          if (!codes.length) return;
          p.fonts.add(font);
          p.ops.push(`BT /${font === "bold" ? "F2" : "F1"} ${num(size)} Tf ${color(c)} rg 1 0 0 1 ${num(x)} ${y(top)} Tm <${hexOf(codes)}> Tj ET`);
        },
        line(x1, y1, x2, y2, { width = 0.5, color: c = "#000000" } = {}) {
          p.ops.push(`q ${num(width)} w ${color(c)} RG ${num(x1)} ${y(y1)} m ${num(x2)} ${y(y2)} l S Q`);
        },
        rect(x, top, w2, h2, { fill = null, stroke = null, width = 0.5 } = {}) {
          const paint = fill && stroke ? "B" : fill ? "f" : "S";
          p.ops.push(`q ${num(width)} w ${fill ? `${color(fill)} rg ` : ""}${stroke ? `${color(stroke)} RG ` : ""}${num(x)} ${y(top + h2)} ${num(w2)} ${num(h2)} re ${paint} Q`);
        },
        // A photo (from jpeg()) filling the box x, top, w, h.
        image(img, x, top, w2, h2) {
          const name = `Im${p.xobjects.size + 1}`;
          p.xobjects.set(name, img.ref);
          p.ops.push(`q ${num(w2)} 0 0 ${num(h2)} ${num(x)} ${y(top + h2)} cm /${name} Do Q`);
        },
        // A Form XObject (another PDF's page) drawn through a matrix in PDF space (origin bottom-left).
        place(form, m) {
          const name = `Fx${p.xobjects.size + 1}`;
          p.xobjects.set(name, form);
          p.ops.push(`q ${m.map(num).join(" ")} cm /${name} Do Q`);
        },
        // A clickable box: to another page (a page object) or to a web address.
        link(x, top, w2, h2, target) {
          const url = typeof target === "string" ? safeUrl(target) : null;
          if (typeof target === "string" && !url) return;
          p.annots.push({ rect: [x, h - top - h2, x + w2, h - top], target: url || target });
        },
        // Wrapped text from y (the first line's top); returns the y below the last line.
        paragraph(x, top, width, s, { font = "regular", size = 10, color: c, leading = size * 1.35 } = {}) {
          let at = top;
          pdf.wrap(s, font, size, width).forEach(line => {
            at += leading;
            p.text(x, at - (leading - size) / 2 - size * 0.22, line, { font, size, color: c });
          });
          return at;
        }
      });
      pages.push(p);
      return p;
    }

    // A photo to draw on pages: { ref, w, h } (its size in pixels).
    function jpeg(bytes) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), info = jpegInfo(b);
      const space = info.comps === 1 ? "DeviceGray" : info.comps === 4 ? "DeviceCMYK" : "DeviceRGB";
      const d = new Dict([["Type", N("XObject")], ["Subtype", N("Image")], ["Width", info.w], ["Height", info.h], ["ColorSpace", N(space)], ["BitsPerComponent", 8], ["Filter", N("DCTDecode")]]);
      if (info.comps === 4) d.set("Decode", [1, 0, 1, 0, 1, 0, 1, 0]); // Adobe's CMYK JPEGs are stored inverted
      return { ref: alloc(new Stream(d, b)), w: info.w, h: info.h };
    }

    // A bookmark to a page, in the order added.
    const outline = (text, p) => marks.push({ text, p });

    // The finished file, as a Blob. footer(page, index, count) runs for each page first.
    async function save({ footer = null } = {}) {
      if (footer) pages.forEach((p, i) => footer(p, i, pages.length));
      const dest = p => [p.ref, N("XYZ"), null, null, null];
      for (const p of pages) {
        const res = new Dict();
        if (p.fonts.size) res.set("Font", new Dict([...p.fonts].map(f => [f === "bold" ? "F2" : "F1", fontRef(f)])));
        if (p.xobjects.size) res.set("XObject", new Dict([...p.xobjects]));
        const d = new Dict([["Type", N("Page")], ["Parent", pagesRef], ["MediaBox", [0, 0, p.w, p.h]], ["Resources", res], ["Contents", alloc(streamOf(ascii(p.ops.join("\n")), true))]]);
        if (p.annots.length) {
          d.set("Annots", p.annots.map(a => {
            const ann = new Dict([["Type", N("Annot")], ["Subtype", N("Link")], ["Rect", a.rect], ["Border", [0, 0, 0]]]);
            if (typeof a.target === "string") ann.set("A", new Dict([["S", N("URI")], ["URI", new Str(ascii(a.target))]]));
            else if (a.target && a.target.ref) ann.set("Dest", dest(a.target));
            return alloc(ann);
          }));
        }
        set(p.ref, d);
      }
      set(pagesRef, new Dict([["Type", N("Pages")], ["Kids", pages.map(p => p.ref)], ["Count", pages.length]]));
      const catalog = new Dict([["Type", N("Catalog")], ["Pages", pagesRef]]);
      if (marks.length) {
        const top = alloc(), refs = marks.map(() => alloc());
        marks.forEach((m, i) => {
          const d = new Dict([["Title", utf16(m.text)], ["Parent", top], ["Dest", dest(m.p)]]);
          if (i > 0) d.set("Prev", refs[i - 1]);
          if (i < marks.length - 1) d.set("Next", refs[i + 1]);
          set(refs[i], d);
        });
        set(top, new Dict([["Type", N("Outlines")], ["First", refs[0]], ["Last", refs[refs.length - 1]], ["Count", refs.length]]));
        catalog.set("Outlines", top);
        catalog.set("PageMode", N("UseOutlines"));
      }
      const catalogRef = alloc(catalog);
      const now = new Date(), stamp = `D:${now.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;
      const infoRef = alloc(new Dict([["Title", utf16(title)], ["Author", utf16(author)], ["Creator", utf16(creator)], ["Producer", utf16("Kyoshi")], ["CreationDate", new Str(ascii(stamp))]]));
      // Streams that asked to be packed (page contents, joined imported contents) are compressed now.
      for (let i = 1; i < objects.length; i++) {
        const o = objects[i];
        if (o instanceof Stream && o.pack && !o.dict.get("Filter")) {
          const packed = await deflate(o.data);
          if (packed && packed.length < o.data.length) { o.data = packed; o.dict.set("Filter", N("FlateDecode")); }
        }
      }
      return new Blob(serialize(catalogRef, infoRef), { type: "application/pdf" });
    }
    const streamOf = (data, pack = false) => Object.assign(new Stream(new Dict(), data), { pack });

    // The bytes: header, every object, the cross-reference table and the trailer.
    function serialize(catalogRef, infoRef) {
      const parts = [ascii("%PDF-1.7\n%"), Uint8Array.from([0xE2, 0xE3, 0xCF, 0xD3, 10])], offsets = [];
      let at = parts.reduce((n, p) => n + p.length, 0);
      const push = bytes => { parts.push(bytes); at += bytes.length; };
      for (let i = 1; i < objects.length; i++) {
        offsets[i] = at;
        const o = objects[i] === undefined ? null : objects[i];
        if (o instanceof Stream) {
          const d = new Dict([...o.dict.map].filter(([k]) => k !== "Length"));
          d.set("Length", o.data.length);
          push(ascii(`${i} 0 obj\n${ser(d)}\nstream\n`));
          push(o.data);
          push(ascii("\nendstream\nendobj\n"));
        } else push(ascii(`${i} 0 obj\n${ser(o)}\nendobj\n`));
      }
      const xref = at, id = new Str(crypto.getRandomValues(new Uint8Array(16)));
      let table = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i++) table += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
      push(ascii(`${table}trailer\n${ser(new Dict([["Size", objects.length], ["Root", catalogRef], ["Info", infoRef], ["ID", [id, id]]]))}\nstartxref\n${xref}\n%%EOF\n`));
      return parts;
    }

    return { W, H, page, jpeg, outline, save, alloc, set, get: ref => objects[ref.num], pages, streamOf };
  }

  Object.assign(pdf, { create, SIZES });
})(Kyoshi);
