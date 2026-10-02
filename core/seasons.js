/* Kyoshi · core/seasons.js — when each season starts, as K.seasons (used by Bosco, Momo, Appa, Iroh and
 * core's season meetings, core/meetings.js).
 * Seasons start on the equinoxes and solstices, the astronomical seasons. Their
 * instants come from Meeus's Astronomical Algorithms (ch. 27), within a minute
 * of a full ephemeris: checked against one, every season from 2000 to 2150
 * falls on the same day in every North American time zone. */
(function (K) {
  "use strict";
  const { DAY_MS, msDate, sum, todayStr } = K.util;

  const NAMES = ["Spring", "Summer", "Fall", "Winter"]; // index s: 0 spring … 3 winter
  const BASE = [ // March equinox, June solstice, September equinox, December solstice
    [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
    [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],
    [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
    [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032]
  ];
  const TERMS = [ // periodic corrections: amplitude, phase, speed
    [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
    [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
    [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
    [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
    [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074]
  ];

  // The instant a season starts in a year (0 spring … 3 winter), in ms since
  // 1970 UTC. The formulas give a Julian day on astronomers' steady clock,
  // which runs ahead of the slowing Earth: 69 s now, more each century.
  function seasonMs(year, s) {
    const deg = Math.PI / 180, Y = (year - 2000) / 1000, [a, b, c, d, e] = BASE[s];
    const jde0 = a + Y * (b + Y * (c + Y * (d + Y * e)));
    const T = (jde0 - 2451545) / 36525, W = (35999.373 * T - 2.47) * deg;
    const S = sum(TERMS.map(([A, B, C]) => A * Math.cos((B + C * T) * deg)));
    const jde = jde0 + 0.00001 * S / (1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W));
    return (jde - 2440587.5) * DAY_MS - (69 + 32 * ((year - 2026) / 100) ** 2) * 1000;
  }

  // The day a season starts in North America ("YYYY-MM-DD"): the date of its
  // equinox or solstice on this device's clock when that's on North American
  // time (Hawaii to Newfoundland), else on Eastern time (EDT, or EST in December).
  function seasonStart(year, s) {
    const ms = seasonMs(year, s), behind = new Date(ms).getTimezoneOffset(); // minutes behind UTC
    return msDate(ms - (behind >= 150 && behind <= 600 ? behind : s === 3 ? 300 : 240) * 60000);
  }

  // The first season to start strictly after a day ("YYYY-MM-DD"), as { label, date, s }.
  function firstAfter(day) {
    for (let year = +day.slice(0, 4); ; year++) {
      for (let s = 0; s < NAMES.length; s++) {
        const date = seasonStart(year, s);
        if (date > day) return { label: NAMES[s], date, s };
      }
    }
  }
  // The day the first season after a day starts.
  const seasonAfter = day => firstAfter(day).date;

  // The next n seasons to start after today, soonest first, as { label, date, s }.
  // The season under way is left out until the next one starts.
  function nextSeasons(n) {
    const next = [];
    for (let day = todayStr(); next.length < n; day = next[next.length - 1].date) next.push(firstAfter(day));
    return next;
  }

  K.seasons = { NAMES, seasonMs, seasonStart, nextSeasons, seasonAfter };
})(Kyoshi);
