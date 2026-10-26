import { useEffect } from "react";

export interface UnsavedCheckResult {
  isDirty: boolean;
  message?: string;
}

type UnsavedChecker = () => UnsavedCheckResult;

const checkers = new Map<string, UnsavedChecker>();

/**
 * Регистрация провайдера проверки несохраненных изменений
 */
export function registerUnsavedChecker(id: string, checker: UnsavedChecker) {
  checkers.set(id, checker);
}

/**
 * Отмена регистрации
 */
export function unregisterUnsavedChecker(id: string) {
  checkers.delete(id);
}

/**
 * Проверка наличия несохраненных изменений во всем приложении
 */
export function hasUnsavedChanges(): UnsavedCheckResult {
  for (const checker of checkers.values()) {
    try {
      const res = checker();
      if (res && res.isDirty) {
        return res;
      }
    } catch (e) {
      console.warn("Unsaved checker error:", e);
    }
  }
  return { isDirty: false };
}

/**
 * Запрос подтверждения ухода со страницы, если есть несохраненные данные.
 * Возвращает true, если уходить можно (нет изменений или пользователь согласился уйти).
 * Возвращает false, если пользователь решил остаться.
 */
export function confirmLeaveIfUnsaved(customPrompt?: string): boolean {
  const check = hasUnsavedChanges();
  if (!check.isDirty) {
    return true;
  }

  const defaultMsg =
    "Внимание: у вас есть несохранённые изменения в текущей форме!\n\n" +
    "Если вы перейдёте в другой раздел прямо сейчас, внесённые данные будут потеряны.\n\n" +
    "Нажмите «Отмена», чтобы остаться и сохранить данные.\n" +
    "Нажмите «ОК», чтобы уйти без сохранения.";

  const message = customPrompt || check.message || defaultMsg;
  const proceed = window.confirm(message);
  return proceed;
}

/**
 * Хук для подключения компонента к контроллеру несохраненных данных
 */
export function useUnsavedChanges(id: string, isDirty: boolean, message?: string) {
  useEffect(() => {
    if (isDirty) {
      registerUnsavedChecker(id, () => ({ isDirty: true, message }));
    } else {
      unregisterUnsavedChecker(id);
    }

    return () => {
      unregisterUnsavedChecker(id);
    };
  }, [id, isDirty, message]);
}

// Защита от закрытия вкладки браузера или обновления страницы (F5 / Ctrl+R)
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges().isDirty) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });
}
