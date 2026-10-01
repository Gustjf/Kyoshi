/* Kyoshi · core/pdf-parse.js — reads the objects of a PDF file (K.pdf.parse), so attached PDFs can be
 * brought into reports (pages: core/pdf-read.js; copying: core/pdf-import.js). Knows classic
 * cross-reference tables and cross-reference streams (following /Prev and /XRefStm, the first
 * definition winning), object streams, the usual filters (Flate with PNG/TIFF predictors, LZW,
 * ASCIIHex, ASCII85, RunLength) and wrong /Length values. A file whose cross-reference is broken is
 * read by scanning it for "N G obj". Filters: core/pdf-filters.js. Values: numbers, booleans, null, Name, Str (bytes), arrays,
 * Dict, Stream (dict + raw, still-encoded data) and Ref. Encrypted files are read but flagged. */
(function (K) {
  "use strict";
  const pdf = K.pdf || (K.pdf = {});

  class Name { constructor(n) { this.n = n; } }
  class Ref { constructor(num, gen) { this.num = num; this.gen = gen; } }
  class Str { constructor(bytes) { this.bytes = bytes; } }
  class Keyword { constructor(k) { this.k = k; } }
  class Stream { constructor(dict, data) { this.dict = dict; this.data = data; } }
  class Dict {
    constructor(entries) { this.map = new Map(entries || []); }
    get(k) { return this.map.get(k); }
    set(k, v) { this.map.set(k, v); return this; }
    has(k) { return this.map.has(k); }
    delete(k) { this.map.delete(k); }
    forEach(fn) { this.map.forEach(fn); }
  }
  const isName = (v, n) => v instanceof Name && (n === undefined || v.n === n);
  const fail = (msg, code = "broken") => Object.assign(new Error(msg), { code });

  // ==========================================================================
  // Lexer & values
  // ==========================================================================
  const WS = c => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const DELIM = c => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;
  const REGULAR = c => c !== undefined && !WS(c) && !DELIM(c);
  const latin1 = (b, from, to) => { let t = ""; for (let i = from; i < to; i++) t += String.fromCharCode(b[i]); return t; };
  const startsWith = (b, at, word) => { for (let i = 0; i < word.length; i++) if (b[at + i] !== word.charCodeAt(i)) return false; return true; };
  function indexOf(b, word, from = 0) {
    const first = word.charCodeAt(0);
    for (let i = Math.max(0, from); i <= b.length - word.length; i++) if (b[i] === first && startsWith(b, i, word)) return i;
    return -1;
  }
  function lastIndexOf(b, word, from) {
    for (let i = b.length - word.length; i >= from; i--) if (startsWith(b, i, word)) return i;
    return -1;
  }

  function skip(s) {
    const b = s.buf;
    while (s.pos < b.length) {
      if (WS(b[s.pos])) s.pos++;
      else if (b[s.pos] === 37) { while (s.pos < b.length && b[s.pos] !== 10 && b[s.pos] !== 13) s.pos++; }
      else break;
    }
  }
  function run(s) {
    const from = s.pos;
    while (s.pos < s.buf.length && REGULAR(s.buf[s.pos])) s.pos++;
    return latin1(s.buf, from, s.pos);
  }
  const nameText = t => t.replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

  function literal(s) {
    const b = s.buf, out = [];
    let depth = 1;
    s.pos++;
    while (s.pos < b.length) {
      let c = b[s.pos++];
      if (c === 92) {
        c = b[s.pos++];
        const esc = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 }[c];
        if (esc !== undefined) out.push(esc);
        else if (c === 13) { if (b[s.pos] === 10) s.pos++; } // a line break after \ is ignored
        else if (c >= 48 && c <= 55) {
          let v = c - 48;
          for (let i = 0; i < 2 && b[s.pos] >= 48 && b[s.pos] <= 55; i++) v = v * 8 + (b[s.pos++] - 48);
          out.push(v & 255);
        } else if (c !== 10 && c !== undefined) out.push(c);
        continue;
      }
      if (c === 40) depth++;
      else if (c === 41 && --depth === 0) break;
      out.push(c);
    }
    return new Str(Uint8Array.from(out));
  }
  function hex(s) {
    const b = s.buf, digits = [];
    s.pos++;
    while (s.pos < b.length && b[s.pos] !== 62) {
      const c = b[s.pos++], v = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;
      if (v >= 0) digits.push(v);
    }
    s.pos++;
    if (digits.length % 2) digits.push(0);
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = digits[2 * i] * 16 + digits[2 * i + 1];
    return new Str(out);
  }

  function value(s, depth = 0) {
    if (depth > 200) throw fail("Nested too deeply");
    skip(s);
    const b = s.buf, c = b[s.pos];
    if (s.pos >= b.length) throw fail("Unexpected end of file");
    if (c === 47) { s.pos++; return new Name(nameText(run(s))); }
    if (c === 40) return literal(s);
    if (c === 60) {
      if (b[s.pos + 1] !== 60) return hex(s);
      s.pos += 2;
      const d = new Dict();
      for (;;) {
        skip(s);
        if (s.pos >= b.length) throw fail("Unexpected end in a dictionary");
        if (b[s.pos] === 62 && b[s.pos + 1] === 62) { s.pos += 2; return d; }
        const k = value(s, depth + 1);
        if (!(k instanceof Name)) continue; // junk where a key should be
        skip(s);
        if (b[s.pos] === 62 && b[s.pos + 1] === 62) { s.pos += 2; d.set(k.n, null); return d; }
        d.set(k.n, value(s, depth + 1));
      }
    }
    if (c === 91) {
      s.pos++;
      const arr = [];
      for (;;) {
        skip(s);
        if (s.pos >= b.length) throw fail("Unexpected end in an array");
        if (b[s.pos] === 93) { s.pos++; return arr; }
        arr.push(value(s, depth + 1));
      }
    }
    if (DELIM(c)) { s.pos++; return new Keyword(String.fromCharCode(c)); } // a stray ) > ] { }
    const tok = run(s);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      if (/^\d+$/.test(tok)) { // "12 0 R" is a reference
        const back = s.pos;
        skip(s);
        const gen = run(s);
        if (/^\d+$/.test(gen)) {
          skip(s);
          if (b[s.pos] === 82 && !REGULAR(b[s.pos + 1])) { s.pos++; return new Ref(+tok, +gen); }
        }
        s.pos = back;
      }
      return parseFloat(tok);
    }
    if (tok === "true") return true;
    if (tok === "false") return false;
    if (tok === "null") return null;
    if (/^[+-]*[\d.]/.test(tok)) { const v = parseFloat(tok.replace(/^[+-]+/, m => m.slice(-1))); return isFinite(v) ? v : 0; } // "--5", "5.-"
    return new Keyword(tok);
  }

  // ==========================================================================
  // A document
  // ==========================================================================
  function parse(bytes) {
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const doc = { buf, entries: new Map(), trailer: new Dict(), cache: new Map(), objstms: new Map(), busy: new Set(), scanned: null };
    const resolve = (v, n = 0) => (v instanceof Ref && n < 8 ? resolve(get(v), n + 1) : v);

    // The object behind a reference (or number): read once, then remembered. null when it can't be.
    function get(ref) {
      const num = ref instanceof Ref ? ref.num : ref;
      if (doc.cache.has(num)) return doc.cache.get(num);
      if (doc.busy.has(num)) return null; // an object that needs itself
      doc.busy.add(num);
      let v = null;
      try {
        const e = doc.entries.get(num);
        if (e && e.type === 1) v = objectAt(e.off, num);
        else if (e && e.type === 2) {
          const os = objstm(e.stm), at = os.get(num);
          if (at !== undefined) v = value({ buf: os.data, pos: at });
        }
      } catch (err) {
        v = null;
      }
      if (v === null && !doc.rebuilding) v = fromScan(num);
      doc.busy.delete(num);
      doc.cache.set(num, v);
      return v;
    }
    function fromScan(num) {
      const off = scan().get(num);
      try { return off === undefined ? null : objectAt(off, num); } catch (err) { return null; }
    }

    // "N G obj … endobj" at an offset (a stream's data is found through /Length, or else by endstream).
    function objectAt(off, num) {
      const s = { buf, pos: off };
      const n = value(s), g = value(s), kw = value(s);
      if (typeof n !== "number" || typeof g !== "number" || !(kw instanceof Keyword && kw.k === "obj")) throw fail("Not an object");
      if (num !== undefined && n !== num) throw fail("A different object");
      const v = value(s);
      skip(s);
      if (!(v instanceof Dict) || !startsWith(buf, s.pos, "stream")) return v;
      s.pos += 6;
      if (buf[s.pos] === 13 && buf[s.pos + 1] === 10) s.pos += 2;
      else if (buf[s.pos] === 10 || buf[s.pos] === 13) s.pos++;
      const from = s.pos;
      let len = v.get("Length"), end = -1;
      if (len instanceof Ref) len = resolve(len);
      if (Number.isInteger(len) && len >= 0 && from + len <= buf.length) {
        let p = from + len;
        while (p < buf.length && WS(buf[p])) p++;
        if (startsWith(buf, p, "endstream")) end = from + len;
      }
      if (end < 0) { // no /Length, or a wrong one: up to endstream
        const at = indexOf(buf, "endstream", from);
        end = at < 0 ? buf.length : at;
        if (buf[end - 1] === 10) end--;
        if (buf[end - 1] === 13) end--;
      }
      return new Stream(v, buf.subarray(from, Math.max(from, end)));
    }

    // An object stream's objects: { data (unpacked), get(num) → where that object starts in it, nums }.
    function objstm(num) {
      if (doc.objstms.has(num)) return doc.objstms.get(num);
      const st = get(num), at = new Map();
      const os = { data: new Uint8Array(0), get: n => at.get(n), nums: () => [...at.keys()] };
      doc.objstms.set(num, os);
      if (!(st instanceof Stream)) return os;
      os.data = decode(st);
      const s = { buf: os.data, pos: 0 }, n = st.dict.get("N") || 0, first = st.dict.get("First") || 0;
      for (let i = 0; i < n; i++) {
        const objNum = value(s), off = value(s);
        if (!Number.isInteger(objNum) || !Number.isInteger(off)) break;
        at.set(objNum, first + off);
      }
      return os;
    }

    // A stream's data unpacked through its filters. An unknown filter is an error (code "filter").
    function decode(st) {
      let data = st.data, filters = resolve(st.dict.get("Filter")), parms = resolve(st.dict.get("DecodeParms"));
      if (!Array.isArray(filters)) filters = filters ? [filters] : [];
      if (!Array.isArray(parms)) parms = [parms];
      filters.forEach((f, i) => {
        const name = f instanceof Name ? f.n : "", p = resolve(parms[i]);
        data = pdf.unfilter(name, data, p);
        if (!data) throw fail(`Unsupported filter ${name}`, "filter");
      });
      return data;
    }

    // The cross-reference: tables and streams, newest first through /Prev (the first definition wins).
    function readXref() {
      const at = lastIndexOf(buf, "startxref", Math.max(0, buf.length - 4096));
      if (at < 0) throw fail("No startxref");
      let off = value({ buf, pos: at + 9 });
      const seen = new Set();
      while (Number.isInteger(off) && off > 0 && off < buf.length && !seen.has(off)) {
        seen.add(off);
        const s = { buf, pos: off };
        skip(s);
        let t;
        if (startsWith(buf, s.pos, "xref")) {
          s.pos += 4;
          t = readTable(s);
          const stm = t.get("XRefStm");
          if (Number.isInteger(stm)) try { readStream(stm); } catch (err) { /* the table still has the rest */ }
        } else t = readStream(off);
        t.forEach((v, k) => { if (!doc.trailer.has(k)) doc.trailer.set(k, v); });
        off = t.get("Prev");
      }
    }
    function readTable(s) {
      for (;;) {
        skip(s);
        if (startsWith(buf, s.pos, "trailer")) {
          s.pos += 7;
          const t = value(s);
          return t instanceof Dict ? t : new Dict();
        }
        let start = value(s);
        const count = value(s);
        if (!Number.isInteger(start) || !Number.isInteger(count)) throw fail("A damaged cross-reference table");
        for (let i = 0; i < count; i++) {
          const off = value(s), gen = value(s), kw = value(s);
          if (!(kw instanceof Keyword)) throw fail("A damaged cross-reference row");
          if (i === 0 && start === 1 && kw.k === "f" && gen === 65535) start = 0; // a common off-by-one
          const num = start + i;
          if (kw.k === "n" && Number.isInteger(off) && off > 0 && !doc.entries.has(num)) doc.entries.set(num, { type: 1, off });
        }
      }
    }
    function readStream(off) {
      const st = objectAt(off);
      if (!(st instanceof Stream) || !isName(st.dict.get("Type"), "XRef")) throw fail("Not a cross-reference stream");
      const data = decode(st), W = st.dict.get("W");
      if (!Array.isArray(W) || W.length < 3) throw fail("A damaged cross-reference stream");
      const [w0, w1, w2] = W.map(w => (Number.isInteger(w) && w >= 0 ? w : 0));
      if (!(w0 + w1 + w2)) throw fail("A damaged cross-reference stream"); // rows of no bytes would never end
      let index = st.dict.get("Index");
      if (!Array.isArray(index)) index = [0, st.dict.get("Size") || 0];
      let p = 0;
      const field = w => { let v = 0; for (let i = 0; i < w; i++) v = v * 256 + data[p++]; return v; };
      for (let i = 0; i + 1 < index.length; i += 2) {
        for (let j = 0; j < index[i + 1] && p + w0 + w1 + w2 <= data.length; j++) {
          const type = w0 ? field(w0) : 1, a = field(w1), b = field(w2), num = index[i] + j;
          if (doc.entries.has(num)) continue;
          if (type === 1) doc.entries.set(num, { type: 1, off: a });
          else if (type === 2) doc.entries.set(num, { type: 2, stm: a, idx: b });
        }
      }
      return st.dict;
    }

    // Every "N G obj" in the file (the later of two wins), found once when the cross-reference fails.
    function scan() {
      if (doc.scanned) return doc.scanned;
      doc.scanned = new Map();
      // One character per byte, so a match's index is its offset.
      const text = typeof TextDecoder === "function" ? new TextDecoder("latin1").decode(buf) : latin1(buf, 0, buf.length);
      const re = /(\d+)[ \t\r\n\f\0]+(\d+)[ \t\r\n\f\0]+obj\b/g;
      let m;
      while ((m = re.exec(text))) doc.scanned.set(+m[1], m.index);
      return doc.scanned;
    }
    // Rebuilds the cross-reference from a scan: every object, the ones in object streams, and a
    // trailer (the last one written, else a cross-reference stream's, else one naming the catalog).
    function rebuild() {
      doc.rebuilding = true;
      doc.entries = new Map();
      doc.cache = new Map();
      doc.objstms = new Map();
      scan().forEach((off, num) => doc.entries.set(num, { type: 1, off }));
      let trailer = null, catalog = null;
      for (let at = lastIndexOf(buf, "trailer", 0); at >= 0 && !trailer; at = at > 0 ? lastIndexOf(buf.subarray(0, at), "trailer", 0) : -1) {
        try { const t = value({ buf, pos: at + 7 }); if (t instanceof Dict && t.get("Root")) trailer = t; } catch (err) { /* keep looking */ }
      }
      [...scan().keys()].forEach(num => {
        const v = get(num), d = v instanceof Stream ? v.dict : v;
        if (!(d instanceof Dict)) return;
        if (isName(d.get("Type"), "ObjStm")) {
          try { objstm(num).nums().forEach(n => { if (!doc.entries.has(n)) doc.entries.set(n, { type: 2, stm: num }); }); } catch (err) { /* unreadable: skipped */ }
        }
        if (!trailer && isName(d.get("Type"), "XRef") && d.get("Root")) trailer = d;
        if (isName(d.get("Type"), "Catalog")) catalog = new Ref(num, 0);
      });
      doc.trailer = trailer || new Dict();
      if (!doc.trailer.get("Root") && catalog) doc.trailer.set("Root", catalog);
      doc.cache = new Map();
      doc.rebuilding = false;
    }

    try { readXref(); } catch (err) { doc.entries = new Map(); }
    const root = doc.trailer.get("Root") ? resolve(doc.trailer.get("Root")) : null;
    if (!(root instanceof Dict) || !root.get("Pages")) rebuild();
    return { trailer: doc.trailer, encrypted: !!doc.trailer.get("Encrypt"), get, resolve, decode };
  }

  Object.assign(pdf, { Name, Ref, Str, Dict, Stream, isName, parse });
})(Kyoshi);
