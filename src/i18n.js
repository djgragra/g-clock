import { app } from 'electron';
import { getSettings } from './store.js';

// Texts shown by the main process (file dialogs). The interface texts live in renderer/js/i18n.js.
const TEXT = {
  exportTitle: { en: 'Export settings', it: 'Esporta impostazioni', es: 'Exportar ajustes' },
  importTitle: { en: 'Import settings', it: 'Importa impostazioni', es: 'Importar ajustes' },
  jsonFilter: { en: 'Settings file (JSON)', it: 'File impostazioni (JSON)', es: 'Archivo de ajustes (JSON)' },
  programsExportTitle: { en: 'Export programs', it: 'Esporta programmi', es: 'Exportar programas' },
  programsImportTitle: { en: 'Import programs', it: 'Importa programmi', es: 'Importar programas' },
  programsFilter: { en: 'Programs file (JSON)', it: 'File programmi (JSON)', es: 'Archivo de programas (JSON)' },
  reportTitle: { en: 'Save report', it: 'Salva report', es: 'Guardar informe' },
  txtFilter: { en: 'Text file', it: 'File di testo', es: 'Archivo de texto' },
  resetMessage: { en: 'Restore the default settings?', it: 'Ripristinare le impostazioni predefinite?', es: '¿Restaurar los ajustes predeterminados?' },
  resetDetail: {
    en: 'Feeds, cities, buttons, logo and all other settings go back to their defaults.',
    it: 'Feed, città, pulsanti, logo e tutte le altre impostazioni tornano ai valori predefiniti.',
    es: 'Los feeds, ciudades, botones, logo y el resto de ajustes vuelven a sus valores predeterminados.'
  },
  reset: { en: 'Restore', it: 'Ripristina', es: 'Restaurar' },
  cancel: { en: 'Cancel', it: 'Annulla', es: 'Cancelar' }
};

const SUPPORTED = ['en', 'it', 'es'];

// 'auto' follows the system language; English when the system language is not supported.
export function resolveLanguage() {
  const chosen = getSettings().language;
  if (SUPPORTED.includes(chosen)) return chosen;
  const sys = (app.getPreferredSystemLanguages?.()[0] || app.getLocale() || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(sys) ? sys : 'en';
}

// BCP 47 tag for Intl formatting: keep the system region when the language matches it.
export function resolveLocale() {
  const lang = resolveLanguage();
  const sys = app.getLocale() || '';
  return sys.toLowerCase().startsWith(lang) ? sys : lang;
}

export const T = (key) => TEXT[key][resolveLanguage()] ?? TEXT[key].en;
