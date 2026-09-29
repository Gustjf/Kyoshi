/* Kyoshi · core/pdf-font.js — the text of Kyoshi's PDFs (K.pdf): Helvetica and Helvetica-Bold, two of
 * the 14 fonts every PDF reader has built in, so no font is embedded and files stay small.
 * Character widths come from Adobe's Core 14 AFM metrics (Copyright (c) 1985, 1987, 1989, 1990, 1997
 * Adobe Systems Incorporated; free to use and share with this notice kept) and measure and wrap text.
 * Text is written in WinAnsi: the Latin-1 letters plus ‘ ’ “ ” – — • … € ™ and a few more. Anything
 * else becomes a look-alike ("→" is "->") or "?". */
(function (K) {
  "use strict";
  const pdf = K.pdf || (K.pdf = {});

  // Widths in 1/1000 of the font size, for WinAnsi codes 32–255 (0 where WinAnsi has nothing).
  const WIDTHS = {
    regular: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
    bold: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
  };
  // The characters WinAnsi puts at 128–159 (the rest of 160–255 is Latin-1 as it is).
  const HIGH = new Map([[0x20AC, 128], [0x201A, 130], [0x0192, 131], [0x201E, 132], [0x2026, 133], [0x2020, 134], [0x2021, 135], [0x02C6, 136], [0x2030, 137], [0x0160, 138], [0x2039, 139], [0x0152, 140], [0x017D, 142],
    [0x2018, 145], [0x2019, 146], [0x201C, 147], [0x201D, 148], [0x2022, 149], [0x2013, 150], [0x2014, 151], [0x02DC, 152], [0x2122, 153], [0x0161, 154], [0x203A, 155], [0x0153, 156], [0x017E, 158], [0x0178, 159]]);
  // Stand-ins for characters WinAnsi doesn't have.
  const LOOKS = { "→": "->", "←": "<-", "↔": "<->", "≈": "~", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "‐": "-", "‑": "-", "‒": "-", "′": "'", "″": "\"", "✓": "v", "✔": "v", "✗": "x", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8" };

  function code(ch) {
    const c = ch.codePointAt(0);
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) return c;
    return HIGH.get(c) || null;
  }
  // A text as WinAnsi codes (numbers 32–255).
  function encode(s) {
    const out = [];
    for (const ch of String(s).normalize("NFC")) {
      const c = code(ch), cp = ch.codePointAt(0);
      if (c !== null) out.push(c);
      else if (LOOKS[ch]) { for (const x of LOOKS[ch]) out.push(code(x) || 63); }
      else if (/\s/.test(ch)) out.push(32);
      else if (!((cp >= 0x200B && cp <= 0x200D) || cp === 0xFEFF || (cp >= 0xFE00 && cp <= 0xFE0F))) out.push(63); // zero-width marks vanish
    }
    return out;
  }
  // How wide a text is, in points, in a font ("regular" or "bold") at a size.
  function width(s, font = "regular", size = 10) {
    const w = WIDTHS[font] || WIDTHS.regular;
    return encode(s).reduce((t, c) => t + (w[c - 32] || 0), 0) * size / 1000;
  }
  // A text cut into lines no wider than max points: at spaces where it can, mid-word where it must.
  // Line breaks in the text are kept (an empty line stays empty).
  function wrap(s, font, size, max) {
    const lines = [];
    String(s).split(/\r\n|\r|\n/).forEach(para => {
      let line = "";
      para.split(/ +/).forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (width(next, font, size) <= max) { line = next; return; }
        if (line) lines.push(line);
        line = "";
        // A word too long for a line on its own is split where it has to be.
        let piece = "";
        for (const ch of word) {
          if (piece && width(piece + ch, font, size) > max) { lines.push(piece); piece = ""; }
          piece += ch;
        }
        line = piece;
      });
      lines.push(line);
    });
    return lines;
  }
  // A text cut to fit max points, ending in "…" when it had to be cut.
  function shorten(s, font, size, max) {
    if (width(s, font, size) <= max) return String(s);
    let out = "";
    for (const ch of String(s)) {
      if (width(`${out}${ch}…`, font, size) > max) break;
      out += ch;
    }
    return `${out.trimEnd()}…`;
  }

  Object.assign(pdf, { encode, width, wrap, shorten, FONTS: { regular: "Helvetica", bold: "Helvetica-Bold" } });
})(Kyoshi);
