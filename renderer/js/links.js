'use strict';

// User-defined buttons that open a web address in the default browser (remote guest link,
// studio camera page, station site…). Configured in Settings → Buttons.
GC.links = (() => {
  function configure(settings) {
    const nav = GC.$('links');
    nav.replaceChildren(
      ...settings.links.map((l) =>
        GC.h('button', {
          class: 'btn link-btn',
          type: 'button',
          text: l.label,
          title: l.note ? `${l.note}\n${l.url}` : l.url,
          onclick: () => window.api.links.open(l.url)
        })
      )
    );
    nav.hidden = !settings.links.length;
  }
  return { configure };
})();
