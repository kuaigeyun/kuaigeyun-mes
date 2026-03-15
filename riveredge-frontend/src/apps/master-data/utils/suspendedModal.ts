/**
 * 暂存 Modal 状态工具
 *
 * 当用户在物料表单中点击链接跳转到其他页面时，暂存当前表单数据，
 * 以便返回时恢复，避免填写信息丢失。
 */

const STORAGE_KEY = 'suspendedMaterialForm';

export interface SuspendedModalState {
  returnPath: string;
  formData: Record<string, any>;
  timestamp: number;
}

export function saveSuspendedModal(returnPath: string, formData: Record<string, any>): void {
  try {
    const state: SuspendedModalState = {
      returnPath,
      formData,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save suspended modal state', e);
  }
}

export function getSuspendedModal(): SuspendedModalState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SuspendedModalState;
    // 超过 2 小时视为过期
    if (Date.now() - state.timestamp > 2 * 60 * 60 * 1000) {
      clearSuspendedModal();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function clearSuspendedModal(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
