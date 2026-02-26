/**
 * 批号规则与序列号规则 API 服务
 */

import { api } from '../../../services/api';

export interface BatchRule {
  id: number;
  uuid: string;
  tenantId?: number;
  name: string;
  code: string;
  ruleComponents?: Record<string, unknown>[];
  description?: string;
  seqStart: number;
  seqStep: number;
  seqResetRule?: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BatchRuleCreate {
  name: string;
  code: string;
  ruleComponents?: Record<string, unknown>[];
  description?: string;
  seqStart?: number;
  seqStep?: number;
  seqResetRule?: string;
  isActive?: boolean;
}

export interface BatchRuleUpdate extends Partial<BatchRuleCreate> {}

export interface SerialRule {
  id: number;
  uuid: string;
  tenantId?: number;
  name: string;
  code: string;
  ruleComponents?: Record<string, unknown>[];
  description?: string;
  seqStart: number;
  seqStep: number;
  seqResetRule?: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerialRuleCreate {
  name: string;
  code: string;
  ruleComponents?: Record<string, unknown>[];
  description?: string;
  seqStart?: number;
  seqStep?: number;
  seqResetRule?: string;
  isActive?: boolean;
}

export interface SerialRuleUpdate extends Partial<SerialRuleCreate> {}

function mapRuleFromApi(raw: Record<string, unknown>): BatchRule | SerialRule {
  return {
    id: raw.id as number,
    uuid: raw.uuid as string,
    tenantId: (raw.tenant_id ?? raw.tenantId) as number | undefined,
    name: (raw.name as string) ?? '',
    code: (raw.code as string) ?? '',
    ruleComponents: (raw.rule_components ?? raw.ruleComponents) as Record<string, unknown>[] | undefined,
    description: (raw.description as string) ?? undefined,
    seqStart: Number(raw.seq_start ?? raw.seqStart ?? 1),
    seqStep: Number(raw.seq_step ?? raw.seqStep ?? 1),
    seqResetRule: (raw.seq_reset_rule ?? raw.seqResetRule) as string | undefined,
    isActive: (raw.is_active ?? raw.isActive) !== false,
    isSystem: (raw.is_system ?? raw.isSystem) === true,
    createdAt: (raw.created_at ?? raw.createdAt) as string,
    updatedAt: (raw.updated_at ?? raw.updatedAt) as string,
  };
}

export const batchRuleApi = {
  list: async (params?: { page?: number; pageSize?: number; isActive?: boolean }) => {
    const p: Record<string, unknown> = {};
    if (params?.page) p.page = params.page;
    if (params?.pageSize) p.page_size = params.pageSize;
    if (params?.isActive !== undefined) p.is_active = params.isActive;
    const res = await api.get<{ items: Record<string, unknown>[]; total: number }>(
      '/apps/master-data/materials/batch-rules',
      { params: p }
    );
    return {
      items: (res.items || []).map((r) => mapRuleFromApi(r) as BatchRule),
      total: res.total || 0,
    };
  },
  get: async (uuid: string) => {
    const res = await api.get<Record<string, unknown>>(`/apps/master-data/materials/batch-rules/${uuid}`);
    return mapRuleFromApi(res) as BatchRule;
  },
  create: async (data: BatchRuleCreate) => {
    const payload = {
      name: data.name,
      code: data.code,
      rule_components: data.ruleComponents,
      description: data.description,
      seq_start: data.seqStart ?? 1,
      seq_step: data.seqStep ?? 1,
      seq_reset_rule: data.seqResetRule,
      is_active: data.isActive ?? true,
    };
    const res = await api.post<Record<string, unknown>>('/apps/master-data/materials/batch-rules', payload);
    return mapRuleFromApi(res) as BatchRule;
  },
  update: async (uuid: string, data: BatchRuleUpdate) => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.ruleComponents !== undefined) payload.rule_components = data.ruleComponents;
    if (data.description !== undefined) payload.description = data.description;
    if (data.seqStart !== undefined) payload.seq_start = data.seqStart;
    if (data.seqStep !== undefined) payload.seq_step = data.seqStep;
    if (data.seqResetRule !== undefined) payload.seq_reset_rule = data.seqResetRule;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    const res = await api.put<Record<string, unknown>>(`/apps/master-data/materials/batch-rules/${uuid}`, payload);
    return mapRuleFromApi(res) as BatchRule;
  },
  delete: async (uuid: string) => {
    await api.delete(`/apps/master-data/materials/batch-rules/${uuid}`);
  },
};

export const serialRuleApi = {
  list: async (params?: { page?: number; pageSize?: number; isActive?: boolean }) => {
    const p: Record<string, unknown> = {};
    if (params?.page) p.page = params.page;
    if (params?.pageSize) p.page_size = params.pageSize;
    if (params?.isActive !== undefined) p.is_active = params.isActive;
    const res = await api.get<{ items: Record<string, unknown>[]; total: number }>(
      '/apps/master-data/materials/serial-rules',
      { params: p }
    );
    return {
      items: (res.items || []).map((r) => mapRuleFromApi(r) as SerialRule),
      total: res.total || 0,
    };
  },
  get: async (uuid: string) => {
    const res = await api.get<Record<string, unknown>>(`/apps/master-data/materials/serial-rules/${uuid}`);
    return mapRuleFromApi(res) as SerialRule;
  },
  create: async (data: SerialRuleCreate) => {
    const payload = {
      name: data.name,
      code: data.code,
      rule_components: data.ruleComponents,
      description: data.description,
      seq_start: data.seqStart ?? 1,
      seq_step: data.seqStep ?? 1,
      seq_reset_rule: data.seqResetRule,
      is_active: data.isActive ?? true,
    };
    const res = await api.post<Record<string, unknown>>('/apps/master-data/materials/serial-rules', payload);
    return mapRuleFromApi(res) as SerialRule;
  },
  update: async (uuid: string, data: SerialRuleUpdate) => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.ruleComponents !== undefined) payload.rule_components = data.ruleComponents;
    if (data.description !== undefined) payload.description = data.description;
    if (data.seqStart !== undefined) payload.seq_start = data.seqStart;
    if (data.seqStep !== undefined) payload.seq_step = data.seqStep;
    if (data.seqResetRule !== undefined) payload.seq_reset_rule = data.seqResetRule;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    const res = await api.put<Record<string, unknown>>(`/apps/master-data/materials/serial-rules/${uuid}`, payload);
    return mapRuleFromApi(res) as SerialRule;
  },
  delete: async (uuid: string) => {
    await api.delete(`/apps/master-data/materials/serial-rules/${uuid}`);
  },
};
