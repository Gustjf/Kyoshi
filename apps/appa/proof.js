/* Appa · proof.js — a record's proof: photos (made into JPEGs no bigger than PHOTO_MAX_PX, the right way
 * up, on white), PDFs (checked that they can go into reports: a protected or unreadable one is flagged,
 * with a tip) and links (web addresses only). In the record pop-up (S.rec) new ones stay in memory until
 * Done (record.js saves them to A.files); thumbnails and viewing use object URLs, let go on close.
 * Nothing about a file (its name or contents) goes into the console, which bug reports keep. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, fmtBytes, newId } = K.util;
  const { ICONS, PHOTO_MAX_PX, PHOTO_QUALITY, PDF_MAX_BYTES, PDF_WARN_BYTES, safeLink, cleanLine, MAX_LABEL } = A;
  const urls = new Map(); // a file's key -> its object URL, while the pop-up is open

  const keyOf = f => f.id || f.key;
  const note = text => { $("rcProofNote").textContent = text; };

  // ==========================================================================
  // Photos
  // ==========================================================================
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("An image the browser can't read")); };
      img.src = url;
    });
  }
  // A photo (a file or Blob) as a JPEG: upright (its camera's turn applied), at most max px on its long
  // side, on white.
  async function toJpeg(file, max = PHOTO_MAX_PX, quality = PHOTO_QUALITY) {
    let src, close = () => {};
    try {
      src = await createImageBitmap(file, { imageOrientation: "from-image" });
      close = () => src.close();
    } catch (err) {
      src = await loadImage(file); // older browsers: an <img> is drawn the right way up too
    }
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const scale = Math.min(1, max / Math.max(w, h)), cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(src, 0, 0, cw, ch);
    close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("The photo couldn't be made into a JPEG");
    return { blob, w: cw, h: ch };
  }
  const jpgName = name => `${cleanLine(String(name || "photo").replace(/\.[a-z0-9]{2,5}$/i, ""), 100) || "photo"}.jpg`;

  async function addPhotos(list) {
    const e = S.rec;
    if (!e || !list.length) return;
    note(`Adding ${list.length === 1 ? "the photo" : `${list.length} photos`}…`);
    for (const file of list) {
      try {
        const { blob, w, h } = await toJpeg(file);
        if (S.rec !== e) return; // closed meanwhile
        e.files.push({ key: newId(), isNew: true, kind: "photo", name: jpgName(file.name), type: "image/jpeg", size: blob.size, w, h, pages: 0, blob });
      } catch (err) {
        alert("Couldn't read that photo. Try a JPEG or PNG (on a computer, HEIC photos may need converting first).");
      }
    }
    note("");
    renderProof();
  }

  // ==========================================================================
  // PDFs & links
  // ==========================================================================
  async function addPdfs(list) {
    const e = S.rec;
    if (!e) return;
    for (const file of list) {
      if (file.size > PDF_MAX_BYTES) { alert(`That PDF is ${fmtBytes(file.size)}: the most Appa keeps is ${fmtBytes(PDF_MAX_BYTES)}. A lighter copy (Print → Save as PDF, or a scan at a lower quality) will fit.`); continue; }
      let bytes;
      try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (err) { alert("Couldn't read that file."); continue; }
      let pages = 0, problem = "";
      try { pages = K.pdf.inspect(bytes).pages; } catch (err) { problem = err.code === "protected" ? "protected" : "broken"; }
      if (problem && !confirm(problem === "protected"
        ? "This PDF is password-protected, so reports can't include its pages (Appa still keeps it as proof). Tip: open it and Print → Save as PDF to make a copy that can go in. Attach it anyway?"
        : "This PDF couldn't be read, so reports can't include its pages (Appa still keeps it as proof). Attach it anyway?")) continue;
      if (!problem && file.size > PDF_WARN_BYTES && !confirm(`That PDF is ${fmtBytes(file.size)}, which makes reports heavy. Attach it anyway?`)) continue;
      if (S.rec !== e) return;
      e.files.push({ key: newId(), isNew: true, kind: "pdf", name: cleanLine(file.name, 120) || "document.pdf", type: "application/pdf", size: file.size, pages, w: 0, h: 0, blob: new Blob([bytes], { type: "application/pdf" }) });
    }
    renderProof();
  }

  function addLink() {
    const e = S.rec, url = safeLink($("rcLinkUrl").value);
    if (!e) return;
    if (!url) { $("rcLinkUrl").focus(); return alert("Paste a web address starting with https:// (or http://)."); }
    e.links.push({ url, label: cleanLine($("rcLinkLabel").value, MAX_LABEL) });
    $("rcLinkUrl").value = "";
    $("rcLinkLabel").value = "";
    $("rcLinkEntry").hidden = true;
    renderProof();
  }
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (err) { return url; } };

  // ==========================================================================
  // The list in the pop-up
  // ==========================================================================
  function renderProof() {
    const e = S.rec;
    if (!e) return;
    const files = e.files.filter(f => !f.removed);
    $("rcProof").innerHTML = files.map(f => {
      const k = esc(keyOf(f)), x = `<button type="button" class="proof-x" data-act="proof-remove" data-key="${k}" aria-label="Remove">&times;</button>`;
      if (f.kind === "photo") return `<div class="proof-item photo"><button type="button" class="proof-open" data-act="proof-open" data-key="${k}" title="Open the photo"><img alt="Photo" data-thumb="${k}"></button>${x}</div>`;
      const pages = f.pages ? `${f.pages} page${f.pages === 1 ? "" : "s"}` : "not for reports";
      return `<div class="proof-item doc"><button type="button" class="proof-open" data-act="proof-open" data-key="${k}" title="Open the PDF">${ICONS.file}<span class="proof-name">${esc(f.name)}</span><span class="proof-meta">${pages} · ${esc(fmtBytes(f.size))}</span></button>${x}</div>`;
    }).join("") + e.links.map((l, i) => `<div class="proof-item doc"><a class="proof-open" href="${esc(l.url)}" target="_blank" rel="noopener">${ICONS.link}<span class="proof-name">${esc(l.label || host(l.url))}</span><span class="proof-meta">${esc(host(l.url))}</span></a><button type="button" class="proof-x" data-act="link-remove" data-index="${i}" aria-label="Remove">&times;</button></div>`).join("");
    files.filter(f => f.kind === "photo").forEach(async f => {
      const url = await urlOf(f), img = $("rcProof").querySelector(`img[data-thumb="${CSS.escape(keyOf(f))}"]`);
      if (img && url) img.src = url;
      else if (img) img.replaceWith(Object.assign(document.createElement("span"), { className: "proof-missing", textContent: "Not on this device yet" }));
    });
  }

  // A file's object URL (made once while the pop-up is open); "" when it isn't on this device (yet).
  async function urlOf(f) {
    const k = keyOf(f);
    if (urls.has(k)) return urls.get(k);
    const blob = f.blob || (await A.files.get(f.id).catch(() => null));
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    urls.set(k, url);
    return url;
  }
  async function openProof(key) {
    const f = S.rec && S.rec.files.find(x => keyOf(x) === key);
    const url = f ? await urlOf(f) : "";
    if (!url) return alert("That file isn't on this device yet. Folder sync brings it over from your other devices.");
    window.open(url, "_blank");
  }
  function removeProof(key) {
    const f = S.rec && S.rec.files.find(x => keyOf(x) === key);
    if (!f) return;
    if (f.isNew) S.rec.files = S.rec.files.filter(x => x !== f);
    else f.removed = true; // deleted on Done
    renderProof();
  }
  function removeLink(i) {
    if (!S.rec) return;
    S.rec.links.splice(i, 1);
    renderProof();
  }
  function releaseProof() {
    urls.forEach(u => URL.revokeObjectURL(u));
    urls.clear();
  }

  Object.assign(A, { addPhotos, addPdfs, addLink, renderProof, openProof, removeProof, removeLink, releaseProof, toJpeg });
})(Kyoshi, Kyoshi.apps.appa);
