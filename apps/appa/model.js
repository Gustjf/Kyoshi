/* Appa · model.js — the data's shapes, cleaning (so a damaged file or an older version's data can't
 * break the app) and lookups. Every list item keeps { id, deleted, at, u }: deleted ones stay as markers
 * so another device's older copy can't bring them back; at = added, u = last changed (the later wins in
 * sync). Next due dates are never stored: schedule.js works them out.
 *
 * things:   { id, name, about, serial, meter: "" | "mi" | "km" | "h", pace (a year), docs, archived }
 *           docs (its manuals and other sources): [{ id, title, link (web address, or where it's kept) }]
 * jobs:     { id, thingId, name, every: { n, unit: "d" | "w" | "m" | "y" } | null, seasons: [0-3],
 *             meterEvery (in the thing's unit) | null, from: { date, reading } (counted from before any
 *             record), est (minutes, your guess) | null, source: { docId, where }, notes (text with bullets) }
 * records:  { id, thingId, date, reading | null, title, jobs: [{ jobId, name, minutes | null, timed }], minutes (a
 *             record with no jobs, other work alone: how long it took; else null, its jobs hold it) | null, by (a
 *             shop; "" = you), cost (cents) | null, notes, files: [fileId], links: [{ url, label }] }
 * readings: { id, thingId, date, value }
 * files:    { id, kind: "photo" | "pdf", name, type, size, pages, w, h } — the bytes are in A.files
 * settings: { name (on reports), u } */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { cleanText, cleanLine, safeLink, METERS, UNITS } = A;

  const cleanId = v => (typeof v === "string" && /^[a-z0-9]{4,40}$/i.test(v) ? v : "");
  const stamp = v => (isPos(v) ? v : 0);
  // The fields every item has; a deleted one keeps only these.
  function base(i) {
    return { id: cleanId(i.id) || newId(), deleted: i.deleted === true, at: stamp(i.at), u: stamp(i.u) };
  }
  // A list of items, each cleaned by fn (null drops it), ids unique.
  function cleanList(list, fn) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(i => {
      const b = base(i);
      return b.deleted ? b : fn(i, b);
    }).filter(i => i && !ids.has(i.id) && ids.add(i.id));
  }
  const num = (v, min = 0) => (isNum(v) && v >= min ? v : null);

  const cleanThings = list => cleanList(list, (t, b) => {
    const name = cleanLine(t.name, A.MAX_THING);
    if (!name) return null;
    const ids = new Set();
    return {
      ...b, name,
      about: cleanLine(t.about, A.MAX_ABOUT),
      serial: cleanLine(t.serial, A.MAX_SERIAL),
      meter: Object.hasOwn(METERS, t.meter) ? t.meter : "",
      pace: num(t.pace) || 0,
      docs: (Array.isArray(t.docs) ? t.docs : []).filter(isObj).map(d => ({
        id: cleanId(d.id) || newId(),
        title: cleanLine(d.title, A.MAX_SOURCE),
        link: cleanLine(d.link, A.MAX_LINK)
      })).filter(d => d.title && !ids.has(d.id) && ids.add(d.id)),
      archived: t.archived === true
    };
  });

  const cleanJobs = list => cleanList(list, (j, b) => {
    const name = cleanLine(j.name, A.MAX_TITLE), thingId = cleanId(j.thingId);
    if (!name || !thingId) return null;
    const every = isObj(j.every) && Object.hasOwn(UNITS, j.every.unit) && Number.isInteger(j.every.n) && j.every.n > 0 ? { n: Math.min(j.every.n, 999), unit: j.every.unit } : null;
    const from = isObj(j.from) ? j.from : {};
    return {
      ...b, thingId, name, every,
      seasons: every ? [] : [...new Set((Array.isArray(j.seasons) ? j.seasons : []).filter(s => Number.isInteger(s) && s >= 0 && s <= 3))].sort(),
      meterEvery: isPos(j.meterEvery) ? j.meterEvery : null,
      from: { date: isDate(from.date) ? from.date : "", reading: num(from.reading) },
      est: Number.isInteger(j.est) && j.est > 0 ? Math.min(j.est, A.MAX_MINUTES) : null,
      source: { docId: cleanId(isObj(j.source) && j.source.docId), where: cleanLine(isObj(j.source) && j.source.where, A.MAX_WHERE) },
      notes: cleanText(j.notes, A.MAX_NOTES)
    };
  });

  const cleanRecords = list => cleanList(list, (r, b) => {
    const thingId = cleanId(r.thingId);
    if (!thingId || !isDate(r.date)) return null;
    const jobIds = new Set();
    const jobs = (Array.isArray(r.jobs) ? r.jobs : []).filter(isObj).map(x => ({
      jobId: cleanId(x.jobId),
      name: cleanLine(x.name, A.MAX_TITLE), // as it was called then, for once the job is deleted
      minutes: Number.isInteger(x.minutes) && x.minutes > 0 ? Math.min(x.minutes, A.MAX_MINUTES) : null,
      timed: x.timed === true
    })).filter(x => x.jobId && !jobIds.has(x.jobId) && jobIds.add(x.jobId));
    const title = cleanLine(r.title, A.MAX_TITLE);
    if (!jobs.length && !title) return null;
    return {
      ...b, thingId, date: r.date, reading: num(r.reading), title, jobs,
      minutes: !jobs.length && Number.isInteger(r.minutes) && r.minutes > 0 ? Math.min(r.minutes, A.MAX_MINUTES) : null, // before 1.363: none
      by: cleanLine(r.by, A.MAX_BY),
      cost: Number.isInteger(r.cost) && r.cost >= 0 ? r.cost : null,
      notes: cleanText(r.notes, A.MAX_RECORD_NOTES),
      files: [...new Set((Array.isArray(r.files) ? r.files : []).map(cleanId).filter(Boolean))],
      links: (Array.isArray(r.links) ? r.links : []).filter(isObj).map(l => ({ url: safeLink(l.url), label: cleanLine(l.label, A.MAX_LABEL) })).filter(l => l.url)
    };
  });

  const cleanReadings = list => cleanList(list, (r, b) => {
    const thingId = cleanId(r.thingId), value = num(r.value);
    return thingId && isDate(r.date) && value !== null ? { ...b, thingId, date: r.date, value } : null;
  });

  const cleanFiles = list => cleanList(list, (f, b) => {
    const kind = f.kind === "pdf" ? "pdf" : f.kind === "photo" ? "photo" : "";
    if (!kind || !isPos(f.size)) return null;
    return {
      ...b, kind,
      name: cleanLine(f.name, 120) || (kind === "pdf" ? "document.pdf" : "photo.jpg"),
      type: kind === "pdf" ? "application/pdf" : "image/jpeg",
      size: f.size,
      pages: Number.isInteger(f.pages) && f.pages > 0 ? f.pages : 0,
      w: Number.isInteger(f.w) ? f.w : 0,
      h: Number.isInteger(f.h) ? f.h : 0
    };
  });

  const cleanSettings = s => ({ name: cleanLine(isObj(s) && s.name, 80), u: stamp(isObj(s) && s.u) });

  // --- Lookups (live = not deleted) ---
  const live = list => list.filter(i => !i.deleted);
  const byId = (list, id) => (id && list.find(i => i.id === id && !i.deleted)) || null;
  const thingById = id => byId(S.things, id);
  const jobById = id => byId(S.jobs, id);
  const recordById = id => byId(S.records, id);
  const fileById = id => byId(S.files, id);
  // Things in use, by name (archived ones — sold or retired — apart).
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const activeThings = () => live(S.things).filter(t => !t.archived).sort(byName);
  const archivedThings = () => live(S.things).filter(t => t.archived).sort(byName);
  const jobsOf = thingId => live(S.jobs).filter(j => j.thingId === thingId).sort(byName);
  // A thing's records (or every thing's), newest first.
  const newest = (a, b) => b.date.localeCompare(a.date) || b.at - a.at;
  const recordsOf = thingId => live(S.records).filter(r => !thingId || r.thingId === thingId).sort(newest);
  const docOf = (thing, docId) => (thing && docId && thing.docs.find(d => d.id === docId)) || null;
  // What a record says was done: its jobs' names (as they're called now, or were then if deleted), then its own words.
  const workOf = r => r.jobs.map(x => (jobById(x.jobId) || { name: x.name || "A deleted job" }).name).concat(r.title || []).join(", ");

  Object.assign(A, {
    cleanThings, cleanJobs, cleanRecords, cleanReadings, cleanFiles, cleanSettings,
    live, thingById, jobById, recordById, fileById, activeThings, archivedThings, jobsOf, recordsOf, docOf, workOf, newest
  });
})(Kyoshi, Kyoshi.apps.appa);
