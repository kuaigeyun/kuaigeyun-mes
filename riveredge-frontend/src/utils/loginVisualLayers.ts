/** 登录页装饰/背景开关：未配置时默认开启 */
export function isLoginVisualLayerEnabled(value: unknown, defaultEnabled = true): boolean {
  if (value === null || value === undefined) return defaultEnabled;
  return value !== false;
}

export function validateLoginVisualLayers(
  decorationEnabled: boolean,
  backgroundEnabled: boolean,
): void {
  if (!decorationEnabled && !backgroundEnabled) {
    throw new Error('LOGIN_VISUAL_LAYER_AT_LEAST_ONE');
  }
}
