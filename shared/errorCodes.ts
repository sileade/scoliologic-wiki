/**
 * Коды ошибок для локализации на клиентской стороне
 * Используются вместо текстовых сообщений в TRPCError
 */

export const ERROR_CODES = {
  // Авторизация и доступ
  ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED',
  EDIT_ACCESS_REQUIRED: 'EDIT_ACCESS_REQUIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // Страницы
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  NO_ACCESSIBLE_PAGES: 'NO_ACCESSIBLE_PAGES',
  
  // Экспорт
  NO_PAGES_SPECIFIED: 'NO_PAGES_SPECIFIED',
  MAX_PAGES_EXCEEDED: 'MAX_PAGES_EXCEEDED',
  
  // Избранное
  FAILED_TO_ADD_FAVORITE: 'FAILED_TO_ADD_FAVORITE',
  
  // Общие
  GENERIC_ERROR: 'GENERIC_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
