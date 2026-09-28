/* Template · render.js — draws the page from A.S. */
(function (K, A) {
  "use strict";
  const $ = A.$;
  const { esc } = K.util;

  function renderAll() {
    const items = A.liveItems();
    $("itemsEmpty").hidden = items.length > 0;
    $("itemsList").innerHTML = items.map(i => `<li><span>${esc(i.text)}</span><button class="danger" data-delete="${esc(i.id)}">Delete</button></li>`).join("");
  }

  Object.assign(A, { renderAll });
})(Kyoshi, Kyoshi.apps.template);
