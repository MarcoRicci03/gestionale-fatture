/**
 * Tipi standardizzati per il contratto di ritorno delle Server Actions (ARCH-03).
 */

export type ActionSuccess<T = void> = T extends void
  ? { success: true; message?: string }
  : { success: true; data: T; message?: string };

export type ActionFailure = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure;

export function actionSuccess(): ActionSuccess<void>;
export function actionSuccess<T>(data: T, message?: string): ActionSuccess<T>;
export function actionSuccess<T = void>(data?: T, message?: string): ActionSuccess<T> {
  if (data !== undefined) {
    return { success: true, data, message } as ActionSuccess<T>;
  }
  return { success: true, message } as ActionSuccess<T>;
}

export function actionFailure(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionFailure {
  return { success: false, error, fieldErrors };
}
