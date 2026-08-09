/**
 * 物料列表：质检选项导入（按主编码合并 inspection_stages / 超报）
 */

import type { TFunction } from 'i18next';

import type { MaterialBulkInspectionPatchItem } from '../types/material';
import { resolveFactoryImportHeaderIndexMap } from '../../../utils/spreadsheetImportTemplate';

export type InspectionPlanLookup = {
  id: number;
  plan_code?: string;
  planCode?: string;
  plan_type?: string;
  planType?: string;
};

export interface MaterialInspectionImportRow {
  rowNum: number;
  mainCode: string;
  patch: Omit<MaterialBulkInspectionPatchItem, 'materialUuid'>;
}

export interface MaterialInspectionImportColumnIndex {
  mainCode: number;
  iqcMode: number;
  iqcPlanCode: number;
  fqcMode: number;
  fqcPlanCode: number;
  oqcMode: number;
  oqcPlanCode: number;
  overReportMode: number;
  overReportValue: number;
}

const STAGE_PLAN_TYPE: Record<'iqc' | 'fqc' | 'oqc', string> = {
  iqc: 'incoming',
  fqc: 'finished',
  oqc: 'outbound',
};

export function buildMaterialInspectionImportColumnIndex(
  headers: string[],
  importHeaderMap: Record<string, string>,
): MaterialInspectionImportColumnIndex {
  const m = resolveFactoryImportHeaderIndexMap(headers, importHeaderMap);
  const idx = (field: string) => m[field] ?? -1;
  return {
    mainCode: idx('mainCode'),
    iqcMode: idx('iqcMode'),
    iqcPlanCode: idx('iqcPlanCode'),
    fqcMode: idx('fqcMode'),
    fqcPlanCode: idx('fqcPlanCode'),
    oqcMode: idx('oqcMode'),
    oqcPlanCode: idx('oqcPlanCode'),
    overReportMode: idx('overReportMode'),
    overReportValue: idx('overReportValue'),
  };
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

function normalizeInspectionMode(raw: string): 'none' | 'simple' | 'plan' | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  const map: Record<string, 'none' | 'simple' | 'plan'> = {
    none: 'none',
    无质检: 'none',
    无: 'none',
    simple: 'simple',
    简易: 'simple',
    简易质检: 'simple',
    plan: 'plan',
    方案: 'plan',
    方案质检: 'plan',
  };
  const mode = map[key] ?? map[raw.trim()];
  if (!mode) {
    throw new Error(`质检模式无效：${raw}（可选：无质检/简易质检/方案质检）`);
  }
  return mode;
}

function normalizeOverReportMode(raw: string): 'none' | 'fixed' | 'percent' | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  const map: Record<string, 'none' | 'fixed' | 'percent'> = {
    none: 'none',
    不允许: 'none',
    不允许超报: 'none',
    fixed: 'fixed',
    固定值: 'fixed',
    固定: 'fixed',
    percent: 'percent',
    百分比: 'percent',
    '%': 'percent',
  };
  const mode = map[key] ?? map[raw.trim()];
  if (!mode) {
    throw new Error(`超报方式无效：${raw}（可选：不允许/固定值/百分比）`);
  }
  return mode;
}

function resolvePlanId(
  planCode: string,
  stage: 'iqc' | 'fqc' | 'oqc',
  plans: InspectionPlanLookup[],
): number {
  const code = planCode.trim();
  if (!code) {
    throw new Error(`方案质检须填写${stage.toUpperCase()}方案编码`);
  }
  const expectedType = STAGE_PLAN_TYPE[stage];
  const plan = plans.find((p) => {
    const c = String(p.plan_code ?? p.planCode ?? '').trim();
    return c === code;
  });
  if (!plan) {
    throw new Error(`未找到质检方案编码：${code}`);
  }
  const planType = String(plan.plan_type ?? plan.planType ?? '');
  if (planType && planType !== expectedType) {
    throw new Error(
      `方案 ${code} 类型为 ${planType}，与场景 ${stage.toUpperCase()}（期望 ${expectedType}）不匹配`,
    );
  }
  return Number(plan.id);
}

export function parseMaterialInspectionImportRows(
  rows: unknown[][],
  idx: MaterialInspectionImportColumnIndex,
  plans: InspectionPlanLookup[],
  rowOffset = 3,
  t?: TFunction,
): { items: MaterialInspectionImportRow[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const items: MaterialInspectionImportRow[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + rowOffset;
    const mainCode = cell(row, idx.mainCode);
    if (!mainCode) {
      errors.push({
        row: rowNum,
        message: t?.('app.master-data.materials.importInspection.mainCodeRequired') ?? '主编码不能为空',
      });
      return;
    }

    try {
      const stages: NonNullable<MaterialBulkInspectionPatchItem['inspectionStages']> = {};
      let hasStage = false;

      (['iqc', 'fqc', 'oqc'] as const).forEach((stage) => {
        const modeIdx = idx[`${stage}Mode`];
        const planIdx = idx[`${stage}PlanCode`];
        const modeRaw = cell(row, modeIdx);
        const planRaw = cell(row, planIdx);
        if (!modeRaw && !planRaw) return;
        const mode = normalizeInspectionMode(modeRaw || (planRaw ? 'plan' : ''));
        if (!mode) return;
        hasStage = true;
        if (mode === 'plan') {
          stages[stage] = { mode: 'plan', planId: resolvePlanId(planRaw, stage, plans) };
        } else {
          stages[stage] = { mode, planId: null };
        }
      });

      const overMode = normalizeOverReportMode(cell(row, idx.overReportMode));
      const overValueRaw = cell(row, idx.overReportValue);
      let overReportValue: number | undefined;
      if (overValueRaw) {
        const n = Number(overValueRaw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`超报数值无效：${overValueRaw}`);
        }
        overReportValue = n;
      }

      const patch: Omit<MaterialBulkInspectionPatchItem, 'materialUuid'> = {};
      if (hasStage) patch.inspectionStages = stages;
      if (overMode !== undefined) patch.overReportMode = overMode;
      if (overReportValue !== undefined) patch.overReportValue = overReportValue;

      if (!patch.inspectionStages && patch.overReportMode === undefined && patch.overReportValue === undefined) {
        errors.push({
          row: rowNum,
          message:
            t?.('app.master-data.materials.importInspection.fieldRequired') ??
            '至少填写一项质检选项字段',
        });
        return;
      }

      items.push({ rowNum, mainCode, patch });
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return { items, errors };
}
