'use strict';

// Optional weather strip (Open-Meteo). Shown only when switched on in Settings.
GC.weather = (() => {
  let settings = null;
  let data = { rows: [] };

  const $ = GC.$;

  // WMO weather interpretation codes, as documented by Open-Meteo.
  const CODE_GROUP = {
    0: 'clear', 1: 'mostlyClear', 2: 'partlyCloudy', 3: 'overcast',
    45: 'fog', 48: 'fog',
    51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'freezingDrizzle', 57: 'freezingDrizzle',
    61: 'rainLight', 63: 'rain', 65: 'rainHeavy', 66: 'freezingRain', 67: 'freezingRain',
    71: 'snowLight', 73: 'snow', 75: 'snowHeavy', 77: 'snow',
    80: 'showers', 81: 'showers', 82: 'showersHeavy', 85: 'snowShowers', 86: 'snowShowers',
    95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm'
  };

  function render() {
    const strip = $('weatherStrip');
    const on = !!settings?.weather.enabled && settings.weather.places.length > 0;
    strip.hidden = !on;
    if (!on) return;
    const unit = settings.weather.unit === 'f' ? '°F' : '°C';
    const rows = new Map(data.rows.map((r) => [r.id, r]));
    $('weatherCards').replaceChildren(
      ...settings.weather.places.map((p) => {
        const r = rows.get(p.id);
        const temp = r && r.temp !== null ? `${r.temp}${unit}` : '—';
        const group = r && r.code !== null ? CODE_GROUP[r.code] : null;
        return GC.h('div', { class: 'card' }, GC.h('div', { class: 'card-name', text: p.name }), GC.h('div', { class: 'card-time', text: temp }), GC.h('div', { class: 'card-sub', text: group ? GC.t('wx.' + group) : data.error ? GC.t('wx.unavailable') : '' }));
      })
    );
    $('weatherCredit').textContent = GC.t('wx.credit');
  }

  function configure(s) {
    settings = s;
    render();
  }

  function update(state) {
    data = state;
    render();
  }

  function init() {
    $('weatherCredit').addEventListener('click', () => window.api.links.open('https://open-meteo.com/'));
  }

  return { init, configure, update };
})();
