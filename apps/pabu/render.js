/* Pabu · render.js — draws the page from A.S: This week (each call, text or visit due by Sunday or overdue, soonest
 * first: ✓, "Call Mom", "due Thu · 30m"; ticked ones stay, ✓, until the week ends; hidden while no one has any),
 * quick add's chips, the Birthdays strip (those, and the anniversary, in the next 30 days; hidden when none), and
 * People: the group chips (All, each group in use, No group; none without groups) and one line per person, A to Z: name
 * (a heart after the one you're with) and group, "Call monthly · Text weekly" and the next due, their next birthday,
 * your next anniversary. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, addDays, daysBetween, fmtShort, todayStr } = K.util;
  const { BIRTHDAY_DAYS, fmtMinutes } = A;

  // The "heart" icon from Lucide (ISC license), small and rose: after the partner's name, and before the anniversary.
  const heart = label => `<svg class="heart" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.5 5.5 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>`;
  // The "check" icon from Lucide (ISC license), in the ✓ button's circle.
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  // Quick add's chips as picked.
  function renderAdd() {
    const pressed = (box, key, value) => box.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset[key] === value);
      b.setAttribute("aria-pressed", String(b.dataset[key] === value));
    });
    pressed($("addEvery"), "every", S.add.every);
    pressed($("addHow"), "how", S.add.how);
  }

  // A day this week in words: "today", "yesterday", "tomorrow", else its name ("Thu").
  function dayWords(d, today) {
    const n = daysBetween(today, d);
    return n === 0 ? "today" : n === -1 ? "yesterday" : n === 1 ? "tomorrow" : A.weekdayOf(d);
  }

  // One line of This week: ✓ (filled once you've talked this week; tapping it again takes that day off), "Call Mom"
  // (opens the pop-up), then "due Thu · 30m", "overdue 4 days · 30m" or "talked today · 30m".
  function rowHTML({ p, c, due, done, title }, today) {
    const late = !done && due < today;
    const when = done ? `talked ${dayWords(done, today)}` : late ? `overdue ${A.plural(daysBetween(due, today), "day")}` : `due ${dayWords(due, today)}`;
    const tick = done ? `Not talked ${dayWords(done, today)}` : "Talked today";
    return `<li class="due-row${late ? " overdue" : ""}${done ? " done" : ""}" data-id="${esc(p.id)}" data-cid="${esc(c.id)}">` +
      `<button type="button" class="tick" data-act="${done ? "untick" : "tick"}" data-id="${esc(p.id)}" data-cid="${esc(c.id)}" title="${esc(tick)}" aria-label="${esc(`${tick}: ${title}`)}"><span class="box">${CHECK}</span></button>` +
      `<div class="row-main"><button type="button" class="row-title" data-act="edit" data-id="${esc(p.id)}">${esc(title)}</button>` +
      `<span class="row-meta"><span class="row-when">${esc(when)}</span> · ${fmtMinutes(c.minutes)}</span></div></li>`;
  }

  // This week: how many, and how many done ("2 of 5 done").
  function renderWeek(today) {
    const rows = A.thisWeek(today), done = rows.filter(r => r.done).length;
    $("weekSection").hidden = !A.live().some(p => p.cadences.length);
    $("weekCount").textContent = !rows.length ? "" : done ? `${done} of ${rows.length} done` : rows.length;
    $("weekEmpty").hidden = rows.length > 0;
    $("weekList").innerHTML = rows.map(r => rowHTML(r, today)).join("");
  }

  // Birthdays, and the anniversary, in the next BIRTHDAY_DAYS, soonest first: the name (opens the pop-up), then "Oct 12 ·
  // in 12 days · turns 60"; the anniversary's after a heart, "Oct 4 · in 4 days · 5 years". The heading names what's
  // listed: "Birthdays & Anniversary", "Anniversary" or "Birthdays".
  function renderBirthdays(today) {
    const end = addDays(today, BIRTHDAY_DAYS), people = A.live();
    const list = people.flatMap(p => [[A.nextBirthday(p, today), p, false], [A.nextAnniversary(p, today), p, true]])
      .filter(([d]) => d && d <= end).sort(([a, p, x], [b, q, y]) => a.localeCompare(b) || A.byName(p, q) || x - y);
    $("bdaySection").hidden = !list.length;
    const annivs = list.some(([, , a]) => a), bdays = list.some(([, , a]) => !a);
    $("bdayTitle").textContent = annivs && bdays ? "Birthdays & Anniversary" : annivs ? "Anniversary" : "Birthdays";
    $("bdayList").innerHTML = list.map(([d, p, anniv]) => {
      const n = daysBetween(today, d), years = anniv ? A.yearsOn(p, d) : A.ageOn(p, d);
      const words = [fmtShort(d), n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`, !years ? "" : anniv ? A.plural(years, "year") : `turns ${years}`].filter(Boolean).join(" · ");
      return `<li class="bday${anniv ? " anniv" : ""}${n === 0 ? " today" : ""}" data-id="${esc(p.id)}">${anniv ? heart("Anniversary") : ""}<button type="button" class="bday-name" data-act="edit" data-id="${esc(p.id)}">${esc(p.name)}</button>` +
        `<span class="bday-when">${esc(words)}</span></li>`;
    }).join("");
  }

  // Whether someone's on the People list as the chips stand: everyone (All), those without a group (No group), or
  // those in the group picked (any case).
  const shown = p => S.filter === null || p.group.toLowerCase() === S.filter.toLowerCase();

  // The chips: All, each group in use (A to Z), then No group when some have none; no chips at all without groups. A
  // chip whose group is gone goes back to All.
  function renderChips(people) {
    const groups = A.groupsInUse(), none = people.some(p => !p.group);
    if (S.filter !== null && !(S.filter ? groups.some(g => g.toLowerCase() === S.filter.toLowerCase()) : none && groups.length)) S.filter = null;
    const chips = groups.length ? [[null, "All"], ...groups.map(g => [g, g]), ...(none ? [["", "No group"]] : [])] : [];
    $("groupChips").hidden = !chips.length;
    $("groupChips").innerHTML = chips.map(([group, label]) => {
      const on = group === null ? S.filter === null : S.filter !== null && group.toLowerCase() === S.filter.toLowerCase();
      return `<button type="button" class="mode-btn chip${on ? " active" : ""}" data-act="filter"${group === null ? "" : ` data-group="${esc(group)}"`} aria-pressed="${on}">${esc(label)}</button>`;
    }).join("");
  }

  // One person, a line that opens the pop-up: the name (a heart after the one you're with) and group, then "Call monthly
  // · Text weekly · due tomorrow" (or "Birthday only"), their next birthday when it's known, and your next anniversary.
  function personHTML(p, today) {
    const due = A.nextDueOf(p, today), bday = A.fmtBirthday(p, today), anniv = A.fmtAnniversary(p, today);
    const ways = p.cadences.length ? p.cadences.map(A.cadenceWords).join(" · ") : "Birthday only";
    return `<li class="person${due && due < today ? " overdue" : ""}" data-id="${esc(p.id)}"><button type="button" class="person-row" data-act="edit" data-id="${esc(p.id)}">` +
      `<span class="person-line"><span class="person-name">${esc(p.name)}${p.partner ? `&nbsp;${heart("Your partner")}` : ""}</span>${p.group ? `<span class="person-group">${esc(p.group)}</span>` : ""}</span>` +
      `<span class="person-meta">${esc(ways)}${due ? ` · <span class="person-due">${esc(A.dueWords(due, today))}</span>` : ""}</span>` +
      `${bday ? `<span class="person-bday">${esc(bday)}</span>` : ""}${anniv ? `<span class="person-anniv">${heart("Anniversary")} ${esc(anniv)}</span>` : ""}</button></li>`;
  }

  function renderPeople(today) {
    const people = A.live();
    renderChips(people);
    $("listEmpty").hidden = people.length > 0;
    $("peopleCount").textContent = people.length || "";
    $("roster").innerHTML = people.filter(shown).sort(A.byName).map(p => personHTML(p, today)).join("");
  }

  function renderAll() {
    const today = S.knownToday = todayStr();
    renderWeek(today);
    renderAdd();
    renderBirthdays(today);
    renderPeople(today);
  }

  Object.assign(A, { renderAll, renderAdd });
})(Kyoshi, Kyoshi.apps.pabu);
