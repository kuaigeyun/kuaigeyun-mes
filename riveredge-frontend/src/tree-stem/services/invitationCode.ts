/**
 * 邀请码 API 服务
 * 
 * 提供邀请码管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的邀请码
 */

import { apiRequest } from './api';

/**
 * 邀请码信息接口
 */
export interface InvitationCode {
  uuid: string;
  code: string;
  email?: string;
  role_id?: number;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 邀请码列表查询参数
 */
export interface InvitationCodeListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * 邀请码列表响应数据
 */
export interface InvitationCodeListResponse {
  items: InvitationCode[];
  total: number;
}

/**
 * 创建邀请码数据
 */
export interface CreateInvitationCodeData {
  email?: string;
  role_id?: number;
  max_uses?: number;
  expires_at?: string;
  is_active?: boolean;
}

/**
 * 更新邀请码数据
 */
export interface UpdateInvitationCodeData {
  email?: string;
  role_id?: number;
  max_uses?: number;
  expires_at?: string;
  is_active?: boolean;
}

/**
 * 验证邀请码请求数据
 */
export interface VerifyInvitationCodeRequest {
  code: string;
}

/**
 * 验证邀请码响应数据
 */
export interface VerifyInvitationCodeResponse {
  valid: boolean;
  message: string;
  invitation_code?: InvitationCode;
}

/**
 * 获取邀请码列表
 * 
 * 自动过滤当前组织的邀请码。
 * 
 * @param params - 查询参数
 * @returns 邀请码列表响应数据
 */
export async function getInvitationCodeList(params?: InvitationCodeListParams): Promise<InvitationCodeListResponse> {
  return apiRequest<InvitationCodeListResponse>('/system/invitation-codes', {
    params,
  });
}

/**
 * 获取邀请码详情
 * 
 * 自动验证组织权限：只能获取当前组织的邀请码。
 * 
 * @param codeUuid - 邀请码 UUID
 * @returns 邀请码信息
 */
export async function getInvitationCodeByUuid(codeUuid: string): Promise<InvitationCode> {
  return apiRequest<InvitationCode>(`/system/invitation-codes/${codeUuid}`);
}

/**
 * 创建邀请码
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 邀请码创建数据
 * @returns 创建的邀请码信息
 */
export async function createInvitationCode(data: CreateInvitationCodeData): Promise<InvitationCode> {
  return apiRequest<InvitationCode>('/system/invitation-codes', {
    method: 'POST',
    data,
  });
}

/**
 * 更新邀请码
 * 
 * 自动验证组织权限：只能更新当前组织的邀请码。
 * 
 * @param codeUuid - 邀请码 UUID
 * @param data - 邀请码更新数据
 * @returns 更新后的邀请码信息
 */
export async function updateInvitationCode(codeUuid: string, data: UpdateInvitationCodeData): Promise<InvitationCode> {
  return apiRequest<InvitationCode>(`/system/invitation-codes/${codeUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除邀请码
 * 
 * 自动验证组织权限：只能删除当前组织的邀请码。
 * 
 * @param codeUuid - 邀请码 UUID
 */
export async function deleteInvitationCode(codeUuid: string): Promise<void> {
  return apiRequest<void>(`/system/invitation-codes/${codeUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 验证邀请码（不增加使用次数）
 * 
 * @param request - 验证请求数据
 * @returns 验证结果
 */
export async function verifyInvitationCode(request: VerifyInvitationCodeRequest): Promise<VerifyInvitationCodeResponse> {
  return apiRequest<VerifyInvitationCodeResponse>('/system/invitation-codes/verify', {
    method: 'POST',
    data: request,
  });
}

/**
 * 使用邀请码（增加使用次数）
 * 
 * @param request - 验证请求数据
 * @returns 邀请码信息
 */
export async function useInvitationCode(request: VerifyInvitationCodeRequest): Promise<InvitationCode> {
  return apiRequest<InvitationCode>('/system/invitation-codes/use', {
    method: 'POST',
    data: request,
  });
}

