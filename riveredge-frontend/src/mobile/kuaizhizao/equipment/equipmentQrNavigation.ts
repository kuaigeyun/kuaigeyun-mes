import type { QRCodeParseResponse } from '../../../../services/qrcode';

/** 解析设备二维码并返回设备 UUID；无效时返回 null */
export function extractEquipmentUuidFromQrResponse(response: QRCodeParseResponse): string | null {
  if (response.qrcode_type !== 'EQ') {
    return null;
  }
  const equipmentUuid = response.data?.equipment_uuid;
  if (!equipmentUuid) {
    return null;
  }
  return String(equipmentUuid);
}
