'use strict';

// User-defined buttons that open a web address in the default browser (remote guest link,
// studio camera page, station site…). Configured in Settings → Buttons.
GC.links = (() => {
  function configure(settings) {
    const nav = GC.$('links');
    nav.replaceChildren(
      ...settings.links.map((l) =>
        GC.h('button', {
          class: 'studio-btn',
          type: 'button',
          title: l.note ? `${l.note}\n${l.url}` : l.url,
          onclick: () => window.api.links.open(l.url)
        }, GC.h('span', { class: 'sb-dot' }), l.label)
      )
    );
    nav.hidden = !settings.links.length;
  }
  return { configure };
})();
