/* Pabu · render.js — draws the page from A.S: quick add's chips, the Birthdays strip (those in the next 30 days, hidden
 * when none), and the list in its groups: Due now, Coming up (within 14 days) and Later (birthday-only people at its
 * end, by name), each with how many and their time. Each person: ✓ (filled once you've talked today), their name, how
 * and how often, the last talk, when they're due, and their next birthday. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, sum, addDays, daysBetween, fmtShort, todayStr } = K.util;
  const { HOW, BIRTHDAY_DAYS, fmtMinutes } = A;

  // The "check" icon from Lucide (ISC license), in the ✓ button's circle.
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const GROUPS = [["due", "Due now"], ["soon", "Coming up"], ["later", "Later"]];

  // Quick add's chips as picked.
  function renderAdd() {
    const pressed = (box, key, value) => box.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset[key] === value);
      b.setAttribute("aria-pressed", String(b.dataset[key] === value));
    });
    pressed($("addEvery"), "every", S.add.every);
    pressed($("addHow"), "how", S.add.how);
  }

  // Birthdays in the next BIRTHDAY_DAYS, soonest first: the name (opens the pop-up), then "Oct 12 · in 12 days · turns 60".
  function renderBirthdays(today) {
    const end = addDays(today, BIRTHDAY_DAYS);
    const list = A.live().map(p => [A.nextBirthday(p, today), p]).filter(([d]) => d && d <= end).sort(([a, p], [b, q]) => a.localeCompare(b) || A.byName(p, q));
    $("bdaySection").hidden = !list.length;
    $("bdayList").innerHTML = list.map(([d, p]) => {
      const n = daysBetween(today, d), age = A.ageOn(p, d);
      const words = [fmtShort(d), n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`, age ? `turns ${age}` : ""].filter(Boolean).join(" · ");
      return `<li class="bday${n === 0 ? " today" : ""}" data-id="${esc(p.id)}"><button type="button" class="bday-name" data-act="edit" data-id="${esc(p.id)}">${esc(p.name)}</button>` +
        `<span class="bday-when">${esc(words)}</span></li>`;
    }).join("");
  }

  // One person: ✓ (filled once you've talked today, and tapping it again undoes), the name (opens the pop-up), then
  // "Call · every month · last talked 5 weeks ago · overdue 4 days", and their next birthday when it's known.
  function personHTML(p, today) {
    const last = A.lastTalk(p, today), due = A.dueOf(p, today), talked = last === today, bday = A.fmtBirthday(p, today);
    const tick = talked ? "Not talked today" : "Talked today";
    const meta = esc([HOW[A.howOf(p)].label, A.everyWords(p), A.talkedWords(last, today)].join(" · ")) +
      (due ? ` · <span class="person-due">${esc(A.dueWords(due, today))}</span>` : "");
    return `<li class="person${due && due < today ? " overdue" : ""}${talked ? " done" : ""}" data-id="${esc(p.id)}">` +
      `<button type="button" class="tick" data-act="${talked ? "untick" : "tick"}" data-id="${esc(p.id)}" title="${tick}" aria-label="${tick}: ${esc(p.name)}"><span class="box">${CHECK}</span></button>` +
      `<div class="person-main"><button type="button" class="person-name" data-act="edit" data-id="${esc(p.id)}">${esc(p.name)}</button>` +
      `<span class="person-meta">${meta}</span>${bday ? `<span class="person-bday">${esc(bday)}</span>` : ""}</div></li>`;
  }

  // Everyone in their groups (only those with anyone), soonest due first; birthday-only people at the end of Later, by
  // name. Each group: how many, and the time of those Momo fits in (birthday-only people send it nothing).
  function renderList(today) {
    const people = A.live(), groups = { due: [], soon: [], later: [] };
    A.byDue(people.filter(p => A.everyOf(p) !== "none"), today).forEach(p => groups[A.groupOf(p, today)].push(p));
    groups.later.push(...people.filter(p => A.everyOf(p) === "none").sort(A.byName));
    $("listEmpty").hidden = people.length > 0;
    $("peopleCount").textContent = people.length || "";
    $("groups").innerHTML = GROUPS.map(([key, title]) => {
      const list = groups[key], minutes = sum(list.filter(p => A.everyOf(p) !== "none").map(p => p.minutes));
      return list.length ? `<div class="group ${key}"><div class="group-head"><span class="group-title">${title}</span>` +
        `<span class="group-sum">${list.length}${minutes ? ` · ${fmtMinutes(minutes)}` : ""}</span></div>` +
        `<ul class="people">${list.map(p => personHTML(p, today)).join("")}</ul></div>` : "";
    }).join("");
  }

  function renderAll() {
    const today = S.knownToday = todayStr();
    renderAdd();
    renderBirthdays(today);
    renderList(today);
  }

  Object.assign(A, { renderAll, renderAdd });
})(Kyoshi, Kyoshi.apps.pabu);
