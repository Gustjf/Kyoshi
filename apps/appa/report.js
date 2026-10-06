/* Appa · report.js — the report pop-up (#reportOverlay): which things, from when, your name (kept in
 * settings, so every device has it), and whether to include costs and photos. Make PDF gathers the
 * records (newest first) and their proof, then report-pdf.js lays out and saves the file. Proof that
 * isn't on this device (only folder sync brings it; the cloud never does) is left out, after saying so. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr, downloadBlob, isDate } = K.util;
  const overlay = () => $("reportOverlay");

  function openReport(thingId) {
    const things = A.activeThings().concat(A.archivedThings());
    if (!things.length) return;
    S.report = { busy: false };
    $("rpThings").innerHTML = things.map(t => `<label><input type="checkbox" value="${esc(t.id)}"${!thingId || t.id === thingId ? " checked" : ""}> ${esc(t.name)}${t.archived ? " (archived)" : ""}</label>`).join("");
    $("rpFrom").value = "";
    $("rpFrom").max = todayStr();
    $("rpName").value = S.settings.name;
    $("rpStatus").textContent = "";
    $("rpMakeBtn").disabled = false;
    K.modal.open(overlay());
  }

  // Everything the report shows, for the things chosen: each thing's records newest first, from the day given.
  function gather(thingIds, from) {
    return thingIds.map(A.thingById).filter(Boolean).map(thing => ({
      thing, records: A.recordsOf(thing.id).filter(r => !from || r.date >= from)
    })).filter(g => g.records.length);
  }

  async function make() {
    const e = S.report;
    if (!e || e.busy) return;
    const ids = [...$("rpThings").querySelectorAll("input:checked")].map(i => i.value), from = $("rpFrom").value;
    if (!ids.length) return alert("Pick at least one thing.");
    if (from && !isDate(from)) return alert("Enter the day to start from, or leave it blank for everything.");
    const groups = gather(ids, from);
    if (!groups.length) return alert(from ? "Nothing was done on those things since then." : "Those things have no records yet.");
    const name = A.cleanLine($("rpName").value, 80);
    if (name !== S.settings.name) {
      S.settings = { name, u: Date.now() };
      A.save();
    }
    const opts = { costs: $("rpCosts").checked, photos: $("rpPhotos").checked, name };
    // Proof that hasn't reached this device yet can't go in.
    const want = groups.flatMap(g => g.records.flatMap(r => r.files)).map(A.fileById).filter(f => f && (f.kind === "pdf" || opts.photos));
    const here = new Set(await A.files.ids()), missing = want.filter(f => !here.has(f.id)).length;
    if (missing && !confirm(`${missing} photo${missing === 1 ? " or PDF isn't" : "s or PDFs aren't"} on this device (folder sync brings them from your other devices; the cloud never carries photos or PDFs), so the report will leave ${missing === 1 ? "it" : "them"} out. Make it anyway?`)) return;
    e.busy = true;
    $("rpMakeBtn").disabled = true;
    const status = text => { if (S.report === e) $("rpStatus").textContent = text; };
    try {
      const blob = await A.buildReport(groups, opts, status);
      const title = groups.length === 1 ? groups[0].thing.name : "Maintenance";
      downloadBlob(blob, `${title.replace(/[\\/:*?"<>|]+/g, "-")} maintenance record ${todayStr()}.pdf`);
      status(`Done: ${Math.max(1, Math.round(blob.size / 1024))} KB. It's in your downloads.`);
    } catch (err) {
      console.error("Appa couldn't make the report.", err && err.message);
      status("");
      alert("Couldn't make the report. Try again, and use Report a bug below if it keeps happening.");
    }
    e.busy = false;
    if (S.report === e) $("rpMakeBtn").disabled = false;
  }

  function wireReport() {
    K.modal.define(overlay(), { dismiss: () => { K.modal.close(overlay()); S.report = null; } });
    $("rpMakeBtn").addEventListener("click", make);
    $("rpCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
  }
  const reportKey = ev => {
    if (ev.key !== "Enter" || !S.report || ev.target.tagName !== "INPUT" || ev.target.type === "checkbox" || !overlay().contains(ev.target)) return false;
    ev.preventDefault();
    make();
    return true;
  };

  Object.assign(A, { openReport, wireReport, reportKey, gather });
})(Kyoshi, Kyoshi.apps.appa);
