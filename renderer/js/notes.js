'use strict';

// Messages for the announcer, under the dial on the On Air screen: the saved ones (Settings → Messages) are
// picked with the keys 1..9 or the chips, M types a one-off message, 0 clears. What is on screen is not saved:
// after a restart the strip starts empty, so an old message never stays on the air by mistake.
GC.notes = (() => {
  const { h, $ } = GC;
  let list = [];
  let shown = null; // { text, id } while a message is on screen

  const bar = () => $('noteBar');

  function paint() {
    $('noteText').textContent = shown ? shown.text : '';
    bar().hidden = !shown;
    $('noteChips').replaceChildren(
      ...list.map((n, i) =>
        h('button', {
          class: 'note-chip' + (shown?.id === n.id ? ' on' : ''),
          type: 'button',
          title: n.text,
          'aria-pressed': String(shown?.id === n.id),
          onclick: () => pick(i + 1)
        }, h('span', { class: 'note-key', text: String(i + 1) }), h('span', { class: 'note-label', text: n.text }))
      )
    );
    $('noteChips').hidden = !list.length;
  }

  function configure(settings) {
    list = settings.notes.list;
    if (shown?.id && !list.some((n) => n.id === shown.id && n.text === shown.text)) shown = null; // edited or removed in Settings
    paint();
  }

  // the same key again takes the message off
  function pick(n) {
    const note = list[n - 1];
    if (!note) return;
    shown = shown?.id === note.id ? null : { id: note.id, text: note.text };
    paint();
  }

  function clear() {
    shown = null;
    paint();
  }

  // ---- M: type a message and press Enter ----
  const input = () => $('noteInput');
  const isWriting = () => !$('noteWrite').hidden;

  function write() {
    $('noteWrite').hidden = false;
    input().value = '';
    input().focus();
  }

  function endWrite() {
    $('noteWrite').hidden = true;
    input().blur();
  }

  function init() {
    bar().addEventListener('click', clear);
    input().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = input().value.replace(/\s+/g, ' ').trim().slice(0, 120);
        endWrite();
        if (text) {
          shown = { id: null, text };
          paint();
        }
      } else if (e.key === 'Escape') {
        endWrite();
        e.stopPropagation();
      }
    });
    input().addEventListener('blur', endWrite);
  }

  return { init, configure, pick, clear, write, isWriting };
})();
