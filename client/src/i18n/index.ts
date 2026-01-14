import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './locales/ru.json';
import en from './locales/en.json';

const resources = {
  ru: { translation: ru },
  en: { translation: en },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wiki-language',
      convertDetectedLanguage: (lng: string) => {
        // Преобразование языковых кодов в поддерживаемые
        if (lng.startsWith('ru')) return 'ru';
        if (lng.startsWith('en')) return 'en';
        return 'ru'; // Русский по умолчанию
      },
    },
  });

export default i18n;
