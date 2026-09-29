/* Kyoshi · core/pdf-inflate.js — K.pdf.inflate(bytes): unpacks Deflate data (zlib-wrapped or raw),
 * the compression inside most PDFs, so attached PDFs can be read (core/pdf-parse.js). Synchronous and
 * forgiving: damaged, cut-short or over-long data gives back whatever could be unpacked before the
 * trouble (which is how PDF readers behave), never an error. After Mark Adler's "puff". */
(function (K) {
  "use strict";
  const pdf = K.pdf || (K.pdf = {});
  const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const STOP = {}; // thrown when the data runs out or doesn't make sense

  // A Huffman code from its code lengths: how many codes of each length, and the symbols in code order.
  function huffman(lengths) {
    const counts = new Uint16Array(16), symbols = new Uint16Array(lengths.length), offs = new Uint16Array(16);
    lengths.forEach(l => { counts[l]++; });
    counts[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    lengths.forEach((l, s) => { if (l) symbols[offs[l]++] = s; });
    return { counts, symbols };
  }
  let fixedLit = null, fixedDist = null;
  function fixedCodes() {
    if (!fixedLit) {
      const l = new Array(288);
      for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
      fixedLit = huffman(l);
      fixedDist = huffman(new Array(30).fill(5));
    }
    return [fixedLit, fixedDist];
  }

  function inflate(input) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    let pos = 0, bitBuf = 0, bitCnt = 0;
    let out = new Uint8Array(Math.max(1024, data.length * 4)), n = 0;
    // A zlib header (compression method 8, checksum of the two bytes) is skipped; raw data has none.
    if (data.length > 2 && (data[0] & 0x0f) === 8 && ((data[0] << 8) | data[1]) % 31 === 0) pos = data[1] & 0x20 ? 6 : 2;

    const bits = need => {
      while (bitCnt < need) {
        if (pos >= data.length) throw STOP;
        bitBuf |= data[pos++] << bitCnt;
        bitCnt += 8;
      }
      const v = bitBuf & ((1 << need) - 1);
      bitBuf >>>= need;
      bitCnt -= need;
      return v;
    };
    const room = more => {
      if (n + more <= out.length) return;
      let size = out.length * 2;
      while (size < n + more) size *= 2;
      const bigger = new Uint8Array(size);
      bigger.set(out.subarray(0, n));
      out = bigger;
    };
    const decode = h => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const count = h.counts[len];
        if (code - count < first) return h.symbols[index + (code - first)];
        index += count;
        first = (first + count) << 1;
        code <<= 1;
      }
      throw STOP;
    };
    const stored = () => {
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > data.length) throw STOP;
      const len = data[pos] | (data[pos + 1] << 8);
      pos += 4;
      const take = Math.min(len, data.length - pos);
      room(take);
      out.set(data.subarray(pos, pos + take), n);
      n += take;
      pos += take;
      if (take < len) throw STOP;
    };
    const codes = (lit, dist) => {
      for (;;) {
        let sym = decode(lit);
        if (sym < 256) { room(1); out[n++] = sym; continue; }
        if (sym === 256) return;
        sym -= 257;
        if (sym >= 29) throw STOP;
        const len = LEN_BASE[sym] + bits(LEN_EXTRA[sym]);
        const d = decode(dist);
        if (d >= 30) throw STOP;
        const back = DIST_BASE[d] + bits(DIST_EXTRA[d]);
        if (back > n) throw STOP;
        room(len);
        for (let i = 0; i < len; i++, n++) out[n] = out[n - back];
      }
    };
    const dynamic = () => {
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw STOP;
      const cl = new Array(19).fill(0);
      for (let i = 0; i < ncode; i++) cl[ORDER[i]] = bits(3);
      const lencode = huffman(cl), lengths = [];
      while (lengths.length < nlen + ndist) {
        const sym = decode(lencode);
        if (sym < 16) { lengths.push(sym); continue; }
        let rep = 0, val = 0;
        if (sym === 16) {
          if (!lengths.length) throw STOP;
          val = lengths[lengths.length - 1];
          rep = 3 + bits(2);
        } else rep = sym === 17 ? 3 + bits(3) : 11 + bits(7);
        if (lengths.length + rep > nlen + ndist) throw STOP;
        for (let i = 0; i < rep; i++) lengths.push(val);
      }
      codes(huffman(lengths.slice(0, nlen)), huffman(lengths.slice(nlen)));
    };

    try {
      let last = 0;
      while (!last) {
        last = bits(1);
        const type = bits(2);
        if (type === 0) stored();
        else if (type === 1) codes(...fixedCodes());
        else if (type === 2) dynamic();
        else throw STOP;
      }
    } catch (err) {
      if (err !== STOP) throw err;
    }
    return out.slice(0, n);
  }

  pdf.inflate = inflate;
})(Kyoshi);
