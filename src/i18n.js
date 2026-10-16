import { app } from 'electron';
import { getSettings } from './store.js';

// Texts shown by the main process (file dialogs). The interface texts live in renderer/js/i18n.js.
const TEXT = {
  exportTitle: { en: 'Export backup', it: 'Esporta backup', es: 'Exportar copia de seguridad' },
  importTitle: { en: 'Import backup', it: 'Importa backup', es: 'Importar copia de seguridad' },
  jsonFilter: { en: 'Backup file (JSON)', it: 'File di backup (JSON)', es: 'Archivo de copia de seguridad (JSON)' },
  importModeMessage: { en: 'How do you want to import this backup?', it: 'Come vuoi importare questo backup?', es: '¿Cómo quieres importar esta copia de seguridad?' },
  importModeDetail: {
    en: 'Replace everything: settings and items come from the file. Add only the missing: the settings of this computer stay as they are and only the programs, buttons, feeds, cities, events and schedules it does not have yet are added.',
    it: 'Sostituisci tutto: impostazioni ed elementi vengono dal file. Aggiungi solo i mancanti: le impostazioni di questo computer restano come sono e si aggiungono solo programmi, pulsanti, feed, città, eventi e orari che non ci sono ancora.',
    es: 'Reemplazar todo: los ajustes y los elementos vienen del archivo. Añadir solo los que faltan: los ajustes de este equipo se mantienen y solo se añaden los programas, botones, feeds, ciudades, eventos y horarios que aún no existen.'
  },
  importReplace: { en: 'Replace everything', it: 'Sostituisci tutto', es: 'Reemplazar todo' },
  importAdd: { en: 'Add only the missing', it: 'Aggiungi solo i mancanti', es: 'Añadir solo los que faltan' },
  installBusyMessage: { en: 'A timer is running.', it: 'Un timer è in corso.', es: 'Un temporizador está en marcha.' },
  installBusyDetail: {
    en: 'Closing G-Clock to install the update stops the timer and loses the take or the count in progress.',
    it: 'Chiudere G-Clock per installare l\'aggiornamento ferma il timer e perde la ripresa o il conteggio in corso.',
    es: 'Cerrar G-Clock para instalar la actualización detiene el temporizador y pierde la toma o la cuenta en curso.'
  },
  installAnyway: { en: 'Close and install', it: 'Chiudi e installa', es: 'Cerrar e instalar' },
  programsExportTitle: { en: 'Export programs', it: 'Esporta programmi', es: 'Exportar programas' },
  programsImportTitle: { en: 'Import programs', it: 'Importa programmi', es: 'Importar programas' },
  programsFilter: { en: 'Programs file (JSON)', it: 'File programmi (JSON)', es: 'Archivo de programas (JSON)' },
  reportTitle: { en: 'Save report', it: 'Salva report', es: 'Guardar informe' },
  txtFilter: { en: 'Text file', it: 'File di testo', es: 'Archivo de texto' },
  resetMessage: { en: 'Restore the default settings?', it: 'Ripristinare le impostazioni predefinite?', es: '¿Restaurar los ajustes predeterminados?' },
  resetDetail: {
    en: 'Feeds, cities, buttons, logo, schedules, events and all other settings go back to their defaults, and the recording programs are removed.',
    it: 'Feed, città, pulsanti, logo, orari, eventi e tutte le altre impostazioni tornano ai valori predefiniti, e i programmi di registrazione vengono rimossi.',
    es: 'Los feeds, ciudades, botones, logo, horarios, eventos y el resto de ajustes vuelven a sus valores predeterminados, y se eliminan los programas de grabación.'
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
