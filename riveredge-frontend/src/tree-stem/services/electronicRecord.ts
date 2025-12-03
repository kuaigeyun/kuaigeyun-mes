/**
 * 电子记录管理服务
 * 
 * 提供电子记录的 CRUD 操作和签名、归档功能。
 * 注意：所有 API 自动过滤当前组织的电子记录
 */

import { apiRequest } from './api';

export interface ElectronicRecord {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  content: Record<string, any>;
  file_uuid?: string;
  status: 'draft' | 'signed' | 'archived' | 'destroyed';
  lifecycle_stage?: 'created' | 'signing' | 'archiving' | 'completed';
  inngest_workflow_id?: string;
  inngest_run_id?: string;
  signer_id?: number;
  signed_at?: string;
  signature_data?: string;
  archived_at?: string;
  archive_location?: string;
  created_at: string;
  updated_at: string;
}

export interface ElectronicRecordListParams {
  skip?: number;
  limit?: number;
  type?: string;
  status?: string;
  lifecycle_stage?: string;
}

export interface CreateElectronicRecordData {
  name: string;
  code: string;
  type: string;
  description?: string;
  content: Record<string, any>;
  file_uuid?: string;
}

export interface UpdateElectronicRecordData {
  name?: string;
  description?: string;
  content?: Record<string, any>;
  file_uuid?: string;
}

export interface SignElectronicRecordData {
  signer_id: number;
  signature_data?: string;
}

export interface ArchiveElectronicRecordData {
  archive_location?: string;
}

/**
 * 获取电子记录列表
 */
export async function getElectronicRecordList(params?: ElectronicRecordListParams): Promise<ElectronicRecord[]> {
  return apiRequest<ElectronicRecord[]>('/system/electronic-records', {
    params,
  });
}

/**
 * 获取电子记录详情
 */
export async function getElectronicRecordByUuid(electronicRecordUuid: string): Promise<ElectronicRecord> {
  return apiRequest<ElectronicRecord>(`/system/electronic-records/${electronicRecordUuid}`);
}

/**
 * 创建电子记录
 */
export async function createElectronicRecord(data: CreateElectronicRecordData): Promise<ElectronicRecord> {
  return apiRequest<ElectronicRecord>('/system/electronic-records', {
    method: 'POST',
    data,
  });
}

/**
 * 更新电子记录
 */
export async function updateElectronicRecord(electronicRecordUuid: string, data: UpdateElectronicRecordData): Promise<ElectronicRecord> {
  return apiRequest<ElectronicRecord>(`/system/electronic-records/${electronicRecordUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除电子记录
 */
export async function deleteElectronicRecord(electronicRecordUuid: string): Promise<void> {
  return apiRequest<void>(`/system/electronic-records/${electronicRecordUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 签名电子记录
 */
export async function signElectronicRecord(electronicRecordUuid: string, data: SignElectronicRecordData): Promise<ElectronicRecord> {
  return apiRequest<ElectronicRecord>(`/system/electronic-records/${electronicRecordUuid}/sign`, {
    method: 'POST',
    data,
  });
}

/**
 * 归档电子记录
 */
export async function archiveElectronicRecord(electronicRecordUuid: string, data: ArchiveElectronicRecordData): Promise<ElectronicRecord> {
  return apiRequest<ElectronicRecord>(`/system/electronic-records/${electronicRecordUuid}/archive`, {
    method: 'POST',
    data,
  });
}

