/* Appa · report-pdf.js — lays out the maintenance report with K.pdf (core/pdf-write.js): US Letter,
 * Helvetica, black and grays, no flourish. First the summary: "Maintenance record", the thing(s), who
 * owns them, when it was prepared, what it covers, then a table per thing with a line per job (date,
 * reading, work, who did it, cost) and the page its details and proof start on (a link). Then each job, newest
 * first: heading, details, notes and links, photos two to a row, and its PDF pages right after it,
 * each stamped "Proof · …"; the next job starts after them. Every page: "Page X of Y". */
(function (K, A) {
  "use strict";
  const { fmtDate, todayStr } = K.util;
  const { fmtReading, fmtMoney } = A;
  const pdf = K.pdf;
  const M = 54, TOP = 54, BOTTOM = 734, STAMP_Y = 38, PROOF_TOP = 50; // margins; content ends above the footer
  const INK = "#111827", MUTED = "#6b7280", RULE = "#d1d5db", LINK = "#1d4ed8";
  const PHOTO_PX = 1400, PHOTO_Q = 0.75, PHOTO_H = 190, GAP = 12;

  const titleOf = groups => (groups.length === 1 ? groups[0].thing.name : "Maintenance");
  const aboutOf = t => [t.about, t.serial ? `VIN / serial ${t.serial}` : ""].filter(Boolean).join(" · ");

  async function buildReport(groups, opts, status) {
    const doc = pdf.create({ title: `${titleOf(groups)}: maintenance record`, author: opts.name, creator: "Appa (Kyoshi)" });
    const W = doc.W, CW = W - 2 * M;
    let page = null, y = 0;
    const newPage = () => { page = doc.page(); y = TOP; return page; };
    const ensure = h => { if (y + h > BOTTOM) newPage(); };
    const text = (x, yy, s, o = {}) => page.text(x, yy, s, { size: 9, color: INK, ...o });
    const by = r => r.by || opts.name || "Owner";
    const recordPage = new Map(), proofCells = [];
    const all = groups.flatMap(g => g.records), dates = all.map(r => r.date).sort();
    const total = all.reduce((n, r) => n + (r.cost || 0), 0);

    // ------------------------------------------------------------------ Summary
    newPage();
    doc.outline("Summary", page);
    text(M, y + 8, "MAINTENANCE RECORD", { font: "bold", size: 8, color: MUTED });
    y += 12;
    pdf.wrap(groups.map(g => g.thing.name).join(", "), "bold", 22, CW).forEach(line => { y += 26; text(M, y, line, { font: "bold", size: 22 }); });
    if (groups.length === 1 && aboutOf(groups[0].thing)) { y += 17; text(M, y, pdf.shorten(aboutOf(groups[0].thing), "regular", 10, CW), { size: 10, color: MUTED }); }
    y += 16;
    page.line(M, y, W - M, y, { color: RULE });
    const facts = [opts.name && ["Owner", opts.name], ["Prepared", fmtDate(todayStr())], ["Covers", dates[0] === dates[dates.length - 1] ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`],
      ["Records", String(all.length)], opts.costs && total && ["Total cost", fmtMoney(total)]].filter(Boolean);
    let fx = M;
    y += 8;
    facts.forEach(([label, value]) => {
      const w = Math.max(pdf.width(label, "regular", 8), pdf.width(value, "bold", 10)) + 26;
      if (fx > M && fx + w > W - M) { fx = M; y += 32; }
      text(fx, y + 10, label, { size: 8, color: MUTED });
      text(fx, y + 24, value, { font: "bold", size: 10 });
      fx += w;
    });
    y += 36;
    page.line(M, y, W - M, y, { color: RULE });
    y += 20;

    // One table per thing: date, reading, work, by, cost, proof page.
    const cols = [["Date", 70], ["Reading", 66], ["Work", 0], ["By", 92], opts.costs && ["Cost", 58, true], ["Page", 36, true]].filter(Boolean);
    cols.find(c => c[0] === "Work")[1] = CW - cols.reduce((n, c) => n + c[1], 0);
    const header = () => {
      let x = M;
      cols.forEach(([label, w, right]) => { text(right ? x + w - 4 - pdf.width(label, "bold", 8) : x, y + 10, label, { font: "bold", size: 8, color: MUTED }); x += w; });
      y += 16;
      page.line(M, y, W - M, y, { color: RULE, width: 0.75 });
    };
    groups.forEach(({ thing, records }) => {
      if (groups.length > 1) {
        ensure(60);
        y += 6;
        text(M, y + 10, thing.name, { font: "bold", size: 11 });
        if (aboutOf(thing)) text(M + pdf.width(thing.name, "bold", 11) + 8, y + 10, pdf.shorten(aboutOf(thing), "regular", 9, CW - pdf.width(thing.name, "bold", 11) - 8), { color: MUTED });
        y += 18;
      }
      ensure(40);
      header();
      records.forEach(r => {
        const cells = [fmtDate(r.date), r.reading !== null ? fmtReading(r.reading, thing) : "—", A.workOf(r), by(r)].concat(opts.costs ? [r.cost !== null ? fmtMoney(r.cost) : "—"] : []);
        const lines = cells.map((c, i) => pdf.wrap(c, "regular", 9, cols[i][1] - 8));
        const h = Math.max(...lines.map(l => l.length)) * 12 + 8;
        if (y + h > BOTTOM) { newPage(); header(); }
        let x = M;
        lines.forEach((ls, i) => {
          const [, w, right] = cols[i];
          ls.forEach((line, k) => text(right ? x + w - 4 - pdf.width(line, "regular", 9) : x, y + 14 + k * 12, line));
          x += w;
        });
        proofCells.push({ page, x, y, w: cols[cols.length - 1][1], h, record: r });
        y += h;
        page.line(M, y, W - M, y, { color: RULE, width: 0.4 });
      });
      y += 14;
    });

    // ------------------------------------------------------------------ Each job, newest first
    const photoCount = opts.photos ? all.reduce((n, r) => n + r.files.map(A.fileById).filter(f => f && f.kind === "photo").length, 0) : 0;
    let photoDone = 0;
    newPage();
    for (const { thing, records } of groups) {
      if (groups.length > 1) {
        ensure(120);
        doc.outline(thing.name, page);
        text(M, y + 12, thing.name.toUpperCase(), { font: "bold", size: 10, color: MUTED });
        y += 24;
      }
      for (let ri = 0; ri < records.length; ri++) {
        const r = records[ri], wanted = r.files.map(A.fileById).filter(f => f && (f.kind === "pdf" || opts.photos));
        const here = await Promise.all(wanted.map(f => A.files.has(f.id))), files = wanted.filter((f, i) => here[i]);
        const photos = files.filter(f => f.kind === "photo"), pdfs = files.filter(f => f.kind === "pdf"), away = wanted.length - files.length;
        const heading = pdf.wrap(`${fmtDate(r.date)} — ${A.workOf(r)}`, "bold", 11, CW);
        ensure(heading.length * 15 + 16 + (photos.length ? PHOTO_H : 24));
        recordPage.set(r.id, page);
        doc.outline(`${fmtDate(r.date)} — ${A.workOf(r)}`, page);
        heading.forEach(line => { y += 15; text(M, y, line, { font: "bold", size: 11 }); });
        const bits = [groups.length > 1 ? thing.name : "", r.reading !== null ? fmtReading(r.reading, thing) : "", `Done by ${by(r)}`, opts.costs && r.cost !== null ? fmtMoney(r.cost) : ""].filter(Boolean);
        y += 15;
        text(M, y, pdf.shorten(bits.join("  ·  "), "regular", 9, CW), { color: MUTED });
        y += 4;
        if (r.notes) {
          const lines = pdf.wrap(r.notes, "regular", 9, CW - 40);
          lines.forEach((line, k) => { ensure(13); if (k === 0) text(M, y + 12, "Notes", { size: 8, color: MUTED }); y += 13; text(M + 40, y - 1, line); });
        }
        r.links.forEach(l => {
          ensure(13);
          y += 13;
          text(M, y - 1, "Link", { size: 8, color: MUTED });
          const label = pdf.shorten(l.label ? `${l.label}: ${l.url}` : l.url, "regular", 9, CW - 40);
          text(M + 40, y - 1, label, { color: LINK });
          page.link(M + 40, y - 11, pdf.width(label, "regular", 9), 12, l.url);
        });
        // Photos, two to a row, each as large as its half-width box allows.
        const cellW = (CW - GAP) / 2;
        for (let i = 0; i < photos.length; i += 2) {
          const row = [];
          for (const f of photos.slice(i, i + 2)) {
            status(`Adding photos… ${++photoDone} of ${photoCount}`);
            const blob = await A.files.get(f.id);
            if (!blob) continue;
            try {
              const small = await A.toJpeg(blob, PHOTO_PX, PHOTO_Q), img = doc.jpeg(new Uint8Array(await small.blob.arrayBuffer()));
              const s = Math.min(cellW / img.w, PHOTO_H / img.h);
              row.push({ img, w: img.w * s, h: img.h * s });
            } catch (err) { /* an unreadable photo is left out */ }
          }
          if (!row.length) continue;
          const h = Math.max(...row.map(p => p.h));
          y += 10;
          ensure(h);
          row.forEach((p, k) => page.image(p.img, M + k * (cellW + GAP), y, p.w, p.h));
          y += h;
        }
        const said = [];
        if (pdfs.length) said.push(`Proof attached: ${pdfs.map(f => `${f.name}${f.pages ? ` (${f.pages} page${f.pages === 1 ? "" : "s"})` : ""}`).join(", ")}, on the following pages.`);
        if (away) said.push(`${away} file${away === 1 ? " isn't" : "s aren't"} included here.`);
        if (said.length) {
          y += 16;
          ensure(14);
          text(M, y, pdf.shorten(said.join(" "), "regular", 8, CW), { size: 8, color: MUTED });
        }
        y += 14;
        page.line(M, y, W - M, y, { color: RULE, width: 0.4 });
        y += 10;
        // Its PDFs right after it, then the next job starts on a new page.
        if (pdfs.length) {
          for (const f of pdfs) {
            status(`Adding ${f.name}…`);
            await proofPages(doc, f, `${thing.name} · ${A.workOf(r)} · ${fmtDate(r.date)}`);
          }
          if (ri < records.length - 1 || thing !== groups[groups.length - 1].thing) newPage();
        }
      }
    }

    // ------------------------------------------------------------------ Proof page numbers, footers
    proofCells.forEach(c => {
      const p = recordPage.get(c.record.id), n = p ? doc.pages.indexOf(p) + 1 : 0;
      if (!n) return;
      const label = `p. ${n}`;
      c.page.text(c.x + c.w - 4 - pdf.width(label, "regular", 9), c.y + 14, label, { size: 9, color: LINK });
      c.page.link(c.x, c.y, c.w, c.h, p);
    });
    const foot = `${titleOf(groups)}: maintenance record${opts.name ? ` · ${opts.name}` : ""}`;
    status("Saving…");
    return doc.save({
      footer: (p, i, n) => {
        const right = `Page ${i + 1} of ${n}`;
        p.text(M, p.h - 30, pdf.shorten(foot, "regular", 8, CW - 90), { size: 8, color: MUTED });
        p.text(p.w - M - pdf.width(right, "regular", 8), p.h - 30, right, { size: 8, color: MUTED });
      }
    });
  }

  // A PDF's pages, each on a page of its own under a "Proof" stamp, scaled to fit and framed; a page
  // (or file) that can't come in is a page saying so.
  async function proofPages(doc, f, label) {
    const note = (p, why) => p.paragraph(M, PROOF_TOP + 20, doc.W - 2 * M, `${f.name} can't be shown here: ${why} The original is kept in Appa.`, { size: 10, color: MUTED });
    const stamp = (p, i, n) => p.text(M, STAMP_Y, pdf.shorten(`PROOF  ·  ${label}  ·  ${f.name}${n > 1 ? `  ·  page ${i + 1} of ${n}` : ""}`, "regular", 8, doc.W - 2 * M), { size: 8, color: MUTED });
    const blob = await A.files.get(f.id);
    if (!blob) return;
    let imps;
    try {
      imps = pdf.importPages(doc, new Uint8Array(await blob.arrayBuffer()));
    } catch (err) {
      const p = doc.page();
      stamp(p, 0, 1);
      note(p, err.code === "protected" ? "it's password-protected (Print → Save as PDF makes a copy that can go in)." : "it couldn't be read.");
      return;
    }
    const area = { x: M, y: doc.H - BOTTOM, w: doc.W - 2 * M, h: BOTTOM - PROOF_TOP };
    imps.forEach((imp, i) => {
      const p = doc.page();
      stamp(p, i, imps.length);
      if (imp.error) return note(p, "this page couldn't be read.");
      const fit = pdf.fit(imp, area);
      pdf.draw(p, imp, fit.m);
      p.rect(M + (area.w - fit.w) / 2, PROOF_TOP, fit.w, fit.h, { stroke: RULE, width: 0.5 });
    });
  }

  Object.assign(A, { buildReport });
})(Kyoshi, Kyoshi.apps.appa);
