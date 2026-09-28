/* Bosco · image.js — the progress image (PNG) from Goal Weights' download button.
 * A portrait share card: title, a minimal weigh-in curve, and the goal table, in
 * the app's light-theme colors. 1080px wide; 1350-1920px tall, growing past that
 * only when there are too many goals to fit. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { daysBetween, todayStr, downloadBlob } = K.util;
  const { weightRange, axisDates, fmtDateBrief, medLabel } = A;

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Smooth curve through pts (midpoint quadratic technique) on the current path.
  function tracePath(ctx, pts) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 2; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    if (pts.length > 1) {
      const last = pts[pts.length - 1], prev = pts[pts.length - 2];
      ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
    }
  }

  function drawReport({ w, rate, goals: list }) {
    const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
    const TEXT = "#1f2430", MUTED = "#6b7280", BORDER = "#dcdfe4", ACCENT = "#2563eb";
    const unit = S.unit, last = w[w.length - 1];
    const W = 1080, PAD_X = 90;
    const topPad = 96, titleH = 66, chartGapTop = 56, cardPadTop = 44, chartH = 540, chartToTableGap = 96;
    const tableHeaderH = 56, cardPadBottom = 48, cardToFooterGap = 64, bottomPad = 40;
    const n = Math.max(list.length, 1);
    const fixedH = topPad + titleH + chartGapTop + cardPadTop + chartH + chartToTableGap + tableHeaderH + cardPadBottom + cardToFooterGap + bottomPad;
    let rowH = Math.min(112, Math.max(58, Math.round((1650 - fixedH) / n)));
    let H = Math.min(1920, Math.max(1350, Math.round(fixedH + rowH * n)));
    rowH = Math.max(50, Math.floor((H - fixedH) / n));
    H = Math.max(H, fixedH + rowH * n);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const text = (s, x, y, font, color, align = "left") => {
      ctx.font = `${font} ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(s, x, y);
    };
    const hLine = (x1, x2, y) => {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    text(S.profile.name ? `${S.profile.name}'s weight report` : "Weight report", W / 2, topPad + 50, "700 56px", TEXT, "center");

    // Chart and goal table share one light-grey card; the footer sits below it.
    const cardTop = topPad + titleH + chartGapTop, cardLeft = PAD_X, cardRight = W - PAD_X;
    const chartTop = cardTop + cardPadTop, chartLeft = cardLeft + 116, chartRight = cardRight - 40, chartBottom = chartTop + chartH;
    const tableLeft = cardLeft + 40, tableRight = cardRight - 40, tableTop = chartBottom + chartToTableGap;
    const cardBottom = tableTop + tableHeaderH + n * rowH + cardPadBottom;
    roundRectPath(ctx, cardLeft, cardTop, cardRight - cardLeft, cardBottom - cardTop, 20);
    ctx.fillStyle = "#f4f5f7";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    const [min, max] = weightRange(w.map(e => e.weight), 0.12);
    const first = w[0].date, span = daysBetween(first, last.date);
    const cx = d => chartLeft + (span ? daysBetween(first, d) / span : 0.5) * (chartRight - chartLeft);
    const cy = v => chartTop + (1 - (v - min) / (max - min)) * chartH;

    [0, 0.5, 1].forEach(f => {
      const v = min + f * (max - min);
      ctx.setLineDash([3, 3]);
      hLine(chartLeft, chartRight, cy(v));
      ctx.setLineDash([]);
      text(`${Math.round(v)} ${unit}`, chartLeft - 16, cy(v) + 7, "400 22px", MUTED, "right");
    });
    axisDates(first, span).forEach(d => text(fmtDateBrief(d), cx(d), chartBottom + 36, "400 22px", MUTED, "center"));

    const pts = w.map(e => ({ x: cx(e.date), y: cy(e.weight) }));
    ctx.beginPath();
    tracePath(ctx, pts);
    ctx.lineTo(pts[pts.length - 1].x, chartBottom);
    ctx.lineTo(pts[0].x, chartBottom);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    fill.addColorStop(0, "rgba(37,99,235,0.14)");
    fill.addColorStop(1, "rgba(37,99,235,0)");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    tracePath(ctx, pts);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    const end = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    text("GOAL", tableLeft, tableTop, "600 20px", MUTED);
    text("STATUS", tableLeft + 260, tableTop, "600 20px", MUTED);
    text("DATE", tableRight, tableTop, "600 20px", MUTED, "right");
    hLine(tableLeft, tableRight, tableTop + 20);
    let rowY = tableTop + tableHeaderH;
    if (!list.length) text("No goals added yet.", tableLeft, rowY + rowH / 2 + 8, "400 26px", MUTED);
    // Pill colors match the in-app .badge classes.
    const PILLS = {
      reached: ["Reached", "#dcfce7", "#16a34a"],
      projected: ["In progress", "#fef3c7", "#92400e"],
      flat: ["Flat rate", BORDER, MUTED],
      unreachable: ["Off track", "#fee2e2", "#dc2626"]
    };
    list.forEach((g, i) => {
      const s = A.goalStatus(g, w, rate);
      const [label, bg, fg] = PILLS[s.status];
      const mid = rowY + rowH / 2;
      text(`${+g.toFixed(1)} ${unit}`, tableLeft, mid + 11, "700 32px", TEXT);
      ctx.font = `600 22px ${FONT}`;
      const pillW = ctx.measureText(label).width + 32;
      roundRectPath(ctx, tableLeft + 260, mid - 19, pillW, 38, 19);
      ctx.fillStyle = bg;
      ctx.fill();
      text(label, tableLeft + 276, mid + 7, "600 22px", fg);
      text(s.date ? fmtDateBrief(s.date) : "—", tableRight, mid + 9, "500 26px", MUTED, "right");
      if (i < list.length - 1) hLine(tableLeft, tableRight, rowY + rowH);
      rowY += rowH;
    });

    const weightNote = `Current weight: ${last.weight.toFixed(1)} ${unit} as of ${fmtDateBrief(last.date)}`;
    const doses = A.medicationEnabled() ? Object.entries(A.cumulativeDoseMg()) : [];
    const oneLine = [weightNote, ...doses.map(([id, mg]) => `${medLabel(id)} cumulative dosage: ${mg} mg`)].join(" | ");
    ctx.font = `500 22px ${FONT}`;
    // One line when it fits; otherwise weight above, shorter dose totals below.
    if (ctx.measureText(oneLine).width <= W - PAD_X * 2) {
      text(oneLine, W / 2, cardBottom + cardToFooterGap, "500 22px", "#94a3b8", "center");
    } else {
      text(weightNote, W / 2, cardBottom + cardToFooterGap - 14, "500 22px", "#94a3b8", "center");
      text(doses.map(([id, mg]) => `${medLabel(id)} total: ${mg} mg`).join(" | "), W / 2, cardBottom + cardToFooterGap + 16, "500 22px", "#94a3b8", "center");
    }
    return canvas;
  }

  async function exportGoalsImage() {
    const m = A.model();
    if (!m.w.length) return alert("Add at least one weigh-in before exporting your progress.");
    const filename = `bosco-progress-${todayStr()}.png`;
    // Ask where to save while the click still counts as user activation. Browsers
    // without a save picker (Firefox, Safari) fall back to a normal download.
    let handle = null;
    if (window.showSaveFilePicker) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "PNG image", accept: { "image/png": [".png"] } }] });
      } catch (err) {
        if (err.name === "AbortError") return; // save dialog cancelled
        console.warn("Save picker unavailable, falling back to a direct download.", err);
      }
    }
    const blob = await new Promise(resolve => drawReport(m).toBlob(resolve, "image/png"));
    if (!blob) return alert("Couldn't create the image.");
    if (!handle) return downloadBlob(blob, filename);
    try {
      const out = await handle.createWritable();
      await out.write(blob);
      await out.close();
    } catch (err) {
      console.error("Failed to write the exported image.", err);
      alert("Couldn't save the file to that location.");
    }
  }

  Object.assign(A, { drawReport, exportGoalsImage });
})(Kyoshi, Kyoshi.apps.bosco);
