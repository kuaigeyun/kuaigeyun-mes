/**
 * 二维码服务 - 对接后端 /api/v1/core/qrcode
 * 用于生成工单二维码（与后端 QRCode 格式一致，便于扫码识别）
 */
import { apiRequest } from './api';

const BASE = '/core/qrcode';

export interface WorkOrderQRGenerateRequest {
  work_order_uuid: string;
  work_order_code: string;
  material_code?: string;
}

export interface QRCodeGenerateResponse {
  qrcode_type: string;
  qrcode_text: string;
  qrcode_image: string; // base64 data URI
  size: number;
  border: number;
}

/** 生成工单二维码（与后端打印/前端展示格式一致） */
export async function generateWorkOrderQR(params: WorkOrderQRGenerateRequest): Promise<QRCodeGenerateResponse> {
  return apiRequest<QRCodeGenerateResponse>(`${BASE}/work-order/generate`, {
    method: 'POST',
    data: {
      work_order_uuid: params.work_order_uuid,
      work_order_code: params.work_order_code,
      material_code: params.material_code || '',
    },
  });
}
