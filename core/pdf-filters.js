/* Kyoshi · core/pdf-filters.js — unpacks the data of a PDF's streams (K.pdf.unfilter), for reading
 * attached PDFs (core/pdf-parse.js): Flate (core/pdf-inflate.js) and LZW, each with the PNG (10–15,
 * a filter type per row) or TIFF (2) predictors; ASCIIHex; ASCII85; RunLength. Images' own formats
 * (DCT, JBIG2, JPX…) are never unpacked: pages are copied with their images as they are.
 * Like inflate, each stops at a limit (bytes gathered in a plain list take more room, so a quarter of
 * K.pdf.MAX_UNPACKED), and settings that make no sense leave the data as it is. */
(function (K) {
  "use strict";
  const pdf = K.pdf || (K.pdf = {});
  const LIMIT = pdf.MAX_UNPACKED / 4;
  const isDict = v => !!v && typeof v.get === "function";
  const latin1 = b => { let t = ""; for (let i = 0; i < b.length; i++) t += String.fromCharCode(b[i]); return t; };

  function predict(data, p) {
    const pred = isDict(p) ? p.get("Predictor") || 1 : 1;
    if (pred < 2) return data;
    const colors = p.get("Colors") || 1, bpc = p.get("BitsPerComponent") || 8, cols = p.get("Columns") || 1;
    const bpp = Math.max(1, Math.ceil(colors * bpc / 8)), rowLen = Math.ceil(cols * colors * bpc / 8);
    if (!(rowLen >= 1)) return data; // a row of no bytes (or fewer) would never move on
    if (pred === 2) { // TIFF: each 8-bit sample adds the one before it
      if (bpc !== 8) return data;
      const out = Uint8Array.from(data);
      for (let r = 0; r < out.length; r += rowLen) for (let i = r + bpp; i < Math.min(r + rowLen, out.length); i++) out[i] = (out[i] + out[i - bpp]) & 255;
      return out;
    }
    const rows = Math.floor(data.length / (rowLen + 1)), out = new Uint8Array(rows * rowLen); // PNG: a filter type per row
    if (!rows) return out;
    let prev = new Uint8Array(rowLen);
    for (let r = 0; r < rows; r++) {
      const type = data[r * (rowLen + 1)], src = r * (rowLen + 1) + 1, dst = r * rowLen;
      for (let i = 0; i < rowLen; i++) {
        const x = data[src + i], a = i >= bpp ? out[dst + i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = x;
        if (type === 1) v = x + a;
        else if (type === 2) v = x + up;
        else if (type === 3) v = x + ((a + up) >> 1);
        else if (type === 4) {
          const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
        }
        out[dst + i] = v & 255;
      }
      prev = out.subarray(dst, dst + rowLen);
    }
    return out;
  }
  function lzw(data, p) {
    const early = isDict(p) && p.get("EarlyChange") === 0 ? 0 : 1, out = [];
    let dict = [], width = 9, buf = 0, bits = 0, prev = null;
    const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict.push([i]); dict.push(null, null); width = 9; prev = null; };
    reset();
    for (let i = 0; i < data.length; i++) {
      buf = (buf << 8) | data[i];
      bits += 8;
      while (bits >= width) {
        const code = (buf >> (bits - width)) & ((1 << width) - 1);
        bits -= width;
        if (code === 256) { reset(); continue; }
        if (code === 257) return Uint8Array.from(out);
        const entry = code < dict.length && dict[code] ? dict[code] : prev ? prev.concat(prev[0]) : null;
        if (!entry || out.length + entry.length > LIMIT) return Uint8Array.from(out);
        entry.forEach(v => out.push(v));
        if (prev) dict.push(prev.concat(entry[0]));
        prev = entry;
        if (dict.length + early >= 1 << width && width < 12) width++;
      }
    }
    return Uint8Array.from(out);
  }
  function asciiHex(data) {
    let t = latin1(data).replace(/>.*$/s, "").replace(/[^0-9a-fA-F]/g, "");
    if (t.length % 2) t += "0";
    const out = new Uint8Array(t.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(t.slice(2 * i, 2 * i + 2), 16);
    return out;
  }
  function ascii85(data) {
    const t = latin1(data).replace(/~>.*$/s, "").replace(/^<~/, "").replace(/\s/g, ""), out = [];
    let group = [];
    const flush = n => { // a group of 5 digits is 4 bytes; a short last group (padded with "u") gives fewer
      while (group.length < 5) group.push(84);
      let v = 0;
      group.forEach(d => { v = v * 85 + d; });
      for (let i = 3; i >= 4 - n; i--) out.push(Math.floor(v / 2 ** (8 * i)) % 256);
      group = [];
    };
    for (const ch of t) {
      if (out.length > LIMIT) break;
      if (ch === "z" && !group.length) { out.push(0, 0, 0, 0); continue; }
      const d = ch.charCodeAt(0) - 33;
      if (d < 0 || d > 84) continue;
      group.push(d);
      if (group.length === 5) flush(4);
    }
    if (group.length > 1) flush(group.length - 1);
    return Uint8Array.from(out);
  }
  function runLength(data) {
    const out = [];
    for (let i = 0; i < data.length && out.length <= LIMIT;) {
      const n = data[i++];
      if (n === 128) break;
      if (n < 128) { for (let j = 0; j <= n && i < data.length; j++) out.push(data[i++]); }
      else { const v = data[i++]; for (let j = 0; j < 257 - n; j++) out.push(v); }
    }
    return Uint8Array.from(out);
  }

  // A filter's name → the data unpacked, or null for a filter this doesn't know.
  function unfilter(name, data, parms) {
    if (name === "FlateDecode" || name === "Fl") return predict(pdf.inflate(data), parms);
    if (name === "LZWDecode" || name === "LZW") return predict(lzw(data, parms), parms);
    if (name === "ASCIIHexDecode" || name === "AHx") return asciiHex(data);
    if (name === "ASCII85Decode" || name === "A85") return ascii85(data);
    if (name === "RunLengthDecode" || name === "RL") return runLength(data);
    return null;
  }

  pdf.unfilter = unfilter;
})(Kyoshi);
