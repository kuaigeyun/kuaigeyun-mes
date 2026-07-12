import type { QRCodeParseResponse } from '../../../services/qrcode';

/** 客户端解析设备二维码 JSON，避免扫码页强依赖已登录 parse API */
export function tryParseEquipmentQrText(text: string): QRCodeParseResponse | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { type?: string; data?: Record<string, unknown> };
    if (parsed?.type !== 'EQ' || !parsed.data || typeof parsed.data !== 'object') {
      return null;
    }
    const equipmentUuid = parsed.data.equipment_uuid;
    if (typeof equipmentUuid !== 'string' || !equipmentUuid.trim()) {
      return null;
    }
    return {
      qrcode_type: 'EQ',
      data: parsed.data,
      valid: true,
    };
  } catch {
    return null;
  }
}
