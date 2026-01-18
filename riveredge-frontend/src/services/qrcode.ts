/**
 * 二维码 API 服务
 * 
 * 提供二维码生成和解析的 API 调用方法
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import { api } from './api';

/**
 * 二维码类型
 */
export type QRCodeType = 'MAT' | 'WO' | 'OP' | 'EQ' | 'EMP' | 'BOX' | 'TRACE';

/**
 * 错误纠正级别
 */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * 生成二维码请求
 */
export interface QRCodeGenerateRequest {
  qrcode_type: QRCodeType;
  data: Record<string, any>;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成二维码响应
 */
export interface QRCodeGenerateResponse {
  qrcode_type: QRCodeType;
  qrcode_text: string;
  qrcode_image: string; // base64编码的data URI
  size: number;
  border: number;
  error_correction: ErrorCorrectionLevel;
}

/**
 * 解析二维码请求
 */
export interface QRCodeParseRequest {
  qrcode_text?: string;
  qrcode_image?: string; // base64编码
}

/**
 * 解析二维码响应
 */
export interface QRCodeParseResponse {
  qrcode_type: QRCodeType;
  data: Record<string, any>;
  valid: boolean;
}

/**
 * 生成物料二维码请求
 */
export interface MaterialQRCodeGenerateRequest {
  material_uuid: string;
  material_code: string;
  material_name: string;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成工单二维码请求
 */
export interface WorkOrderQRCodeGenerateRequest {
  work_order_uuid: string;
  work_order_code: string;
  material_code: string;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成工序二维码请求
 */
export interface OperationQRCodeGenerateRequest {
  operation_uuid: string;
  operation_name: string;
  work_order_code: string;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成设备二维码请求
 */
export interface EquipmentQRCodeGenerateRequest {
  equipment_uuid: string;
  equipment_code: string;
  equipment_name: string;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成人员二维码请求
 */
export interface EmployeeQRCodeGenerateRequest {
  employee_uuid: string;
  employee_code: string;
  employee_name: string;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成装箱二维码请求
 */
export interface BoxQRCodeGenerateRequest {
  box_uuid: string;
  box_code: string;
  material_codes: string[];
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 生成追溯二维码请求
 */
export interface TraceQRCodeGenerateRequest {
  trace_uuid: string;
  trace_code: string;
  trace_data: Record<string, any>;
  size?: number;
  border?: number;
  error_correction?: ErrorCorrectionLevel;
}

/**
 * 二维码 API 服务
 */
export const qrcodeApi = {
  /**
   * 生成二维码
   */
  generate: async (request: QRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/generate', request);
  },

  /**
   * 解析二维码
   */
  parse: async (request: QRCodeParseRequest): Promise<QRCodeParseResponse> => {
    return api.post('/core/qrcode/parse', request);
  },

  /**
   * 生成物料二维码
   */
  generateMaterial: async (request: MaterialQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/material/generate', request);
  },

  /**
   * 生成工单二维码
   */
  generateWorkOrder: async (request: WorkOrderQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/work-order/generate', request);
  },

  /**
   * 生成工序二维码
   */
  generateOperation: async (request: OperationQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/operation/generate', request);
  },

  /**
   * 生成设备二维码
   */
  generateEquipment: async (request: EquipmentQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/equipment/generate', request);
  },

  /**
   * 生成人员二维码
   */
  generateEmployee: async (request: EmployeeQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/employee/generate', request);
  },

  /**
   * 生成装箱二维码
   */
  generateBox: async (request: BoxQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/box/generate', request);
  },

  /**
   * 生成追溯二维码
   */
  generateTrace: async (request: TraceQRCodeGenerateRequest): Promise<QRCodeGenerateResponse> => {
    return api.post('/core/qrcode/trace/generate', request);
  },
};
