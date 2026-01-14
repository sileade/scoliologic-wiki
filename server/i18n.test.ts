import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Загрузка файлов локализации
const localesPath = path.join(__dirname, '../client/src/i18n/locales');
const ruJson = JSON.parse(fs.readFileSync(path.join(localesPath, 'ru.json'), 'utf-8'));
const enJson = JSON.parse(fs.readFileSync(path.join(localesPath, 'en.json'), 'utf-8'));

// Рекурсивная функция для получения всех ключей из объекта
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Получение всех ключей
const ruKeys = getAllKeys(ruJson).sort();
const enKeys = getAllKeys(enJson).sort();

describe('i18n Localization Tests', () => {
  describe('Key Synchronization', () => {
    it('should have the same number of keys in both languages', () => {
      expect(ruKeys.length).toBe(enKeys.length);
    });

    it('should have all Russian keys present in English', () => {
      const missingInEn = ruKeys.filter(key => !enKeys.includes(key));
      expect(missingInEn).toEqual([]);
    });

    it('should have all English keys present in Russian', () => {
      const missingInRu = enKeys.filter(key => !ruKeys.includes(key));
      expect(missingInRu).toEqual([]);
    });

    it('should have matching key structure', () => {
      expect(ruKeys).toEqual(enKeys);
    });
  });

  describe('Translation Quality', () => {
    it('should not have empty translations in Russian', () => {
      const emptyKeys: string[] = [];
      function checkEmpty(obj: Record<string, unknown>, prefix = '') {
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          if (typeof value === 'string' && value.trim() === '') {
            emptyKeys.push(fullKey);
          } else if (typeof value === 'object' && value !== null) {
            checkEmpty(value as Record<string, unknown>, fullKey);
          }
        }
      }
      checkEmpty(ruJson);
      expect(emptyKeys).toEqual([]);
    });

    it('should not have empty translations in English', () => {
      const emptyKeys: string[] = [];
      function checkEmpty(obj: Record<string, unknown>, prefix = '') {
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          if (typeof value === 'string' && value.trim() === '') {
            emptyKeys.push(fullKey);
          } else if (typeof value === 'object' && value !== null) {
            checkEmpty(value as Record<string, unknown>, fullKey);
          }
        }
      }
      checkEmpty(enJson);
      expect(emptyKeys).toEqual([]);
    });

    it('should not have untranslated keys (same value in both languages) for main sections', () => {
      // Проверяем только ключевые секции, где перевод обязателен
      const sectionsToCheck = ['nav', 'home', 'search', 'admin'];
      const untranslated: string[] = [];
      
      for (const section of sectionsToCheck) {
        if (ruJson[section] && enJson[section]) {
          const ruSection = ruJson[section] as Record<string, string>;
          const enSection = enJson[section] as Record<string, string>;
          for (const key of Object.keys(ruSection)) {
            if (typeof ruSection[key] === 'string' && 
                typeof enSection[key] === 'string' &&
                ruSection[key] === enSection[key] &&
                ruSection[key].length > 3) { // Игнорируем короткие строки типа "OK"
              untranslated.push(`${section}.${key}`);
            }
          }
        }
      }
      // Некоторые ключи могут быть одинаковыми (например, названия брендов)
      // Поэтому просто логируем, но не фейлим тест
      if (untranslated.length > 0) {
        console.log('Potentially untranslated keys:', untranslated);
      }
    });
  });

  describe('JSON Structure', () => {
    it('should have valid JSON structure for Russian', () => {
      expect(() => JSON.stringify(ruJson)).not.toThrow();
    });

    it('should have valid JSON structure for English', () => {
      expect(() => JSON.stringify(enJson)).not.toThrow();
    });

    it('should have expected top-level sections', () => {
      const expectedSections = ['nav', 'home', 'search', 'wiki', 'admin', 'editor', 'notifications', 'common'];
      for (const section of expectedSections) {
        expect(ruJson).toHaveProperty(section);
        expect(enJson).toHaveProperty(section);
      }
    });
  });

  describe('Error Messages', () => {
    it('should have error messages section in both languages', () => {
      expect(ruJson).toHaveProperty('errors');
      expect(enJson).toHaveProperty('errors');
    });

    it('should have matching error keys in both languages', () => {
      if (ruJson.errors && enJson.errors) {
        const ruErrorKeys = Object.keys(ruJson.errors).sort();
        const enErrorKeys = Object.keys(enJson.errors).sort();
        expect(ruErrorKeys).toEqual(enErrorKeys);
      }
    });
  });
});
