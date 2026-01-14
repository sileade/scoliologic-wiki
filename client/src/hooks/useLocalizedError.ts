import { useTranslation } from 'react-i18next';
import { TRPCClientError } from '@trpc/client';

/**
 * Хук для локализации ошибок tRPC
 * Преобразует серверные сообщения об ошибках в локализованные строки
 */
export function useLocalizedError() {
  const { t } = useTranslation();

  /**
   * Получить локализованное сообщение об ошибке
   * @param error - ошибка tRPC или обычная ошибка
   * @returns локализованное сообщение
   */
  const getErrorMessage = (error: unknown): string => {
    if (!error) {
      return t('errors.generic');
    }

    // Обработка tRPC ошибок
    if (error instanceof TRPCClientError) {
      const message = error.message;
      
      // Проверяем, является ли сообщение кодом ошибки
      const errorKey = `errors.${message}`;
      const translated = t(errorKey);
      
      // Если перевод найден (не равен ключу), возвращаем его
      if (translated !== errorKey) {
        return translated;
      }
      
      // Маппинг стандартных сообщений на коды ошибок
      const messageToCode: Record<string, string> = {
        'Admin access required': 'ADMIN_ACCESS_REQUIRED',
        'Edit access required': 'EDIT_ACCESS_REQUIRED',
        'Access denied': 'ACCESS_DENIED',
        'Page not found': 'PAGE_NOT_FOUND',
        'Version not found': 'VERSION_NOT_FOUND',
        'No accessible pages found': 'NO_ACCESSIBLE_PAGES',
        'No pages specified': 'NO_PAGES_SPECIFIED',
        'Maximum 50 pages per export': 'MAX_PAGES_EXCEEDED',
        'Failed to add to favorites': 'FAILED_TO_ADD_FAVORITE',
        'Admin access required to delete': 'ADMIN_ACCESS_REQUIRED',
      };
      
      const code = messageToCode[message];
      if (code) {
        return t(`errors.${code}`);
      }
      
      // Обработка кодов ошибок tRPC
      switch (error.data?.code) {
        case 'UNAUTHORIZED':
          return t('errors.unauthorized');
        case 'FORBIDDEN':
          return t('errors.forbidden');
        case 'NOT_FOUND':
          return t('errors.notFound');
        case 'BAD_REQUEST':
          return t('errors.validationError');
        case 'INTERNAL_SERVER_ERROR':
          return t('errors.serverError');
        default:
          // Возвращаем оригинальное сообщение, если нет перевода
          return message || t('errors.generic');
      }
    }

    // Обработка сетевых ошибок
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return t('errors.networkError');
      }
      return error.message || t('errors.generic');
    }

    // Обработка строковых ошибок
    if (typeof error === 'string') {
      const errorKey = `errors.${error}`;
      const translated = t(errorKey);
      return translated !== errorKey ? translated : error;
    }

    return t('errors.generic');
  };

  /**
   * Показать локализованный toast с ошибкой
   * @param error - ошибка
   * @param toast - функция toast из sonner
   */
  const showErrorToast = (error: unknown, toast: { error: (msg: string) => void }) => {
    const message = getErrorMessage(error);
    toast.error(message);
  };

  return {
    getErrorMessage,
    showErrorToast,
    t,
  };
}
