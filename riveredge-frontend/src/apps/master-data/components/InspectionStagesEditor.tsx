/**
 * 分场景质检策略编辑（物料/工序）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Select, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useRequest } from 'ahooks';
import { inspectionPlanApi } from '../../kuaizhizao/services/production';
import { qualityApi } from '../../kuaizhizao/services/quality-execution';
import { QualityMasterDataHint } from '../../kuaizhizao/pages/quality-management/components/QualityMasterDataHint';

export type MaterialStageKey = 'iqc' | 'fqc' | 'oqc';

export const MATERIAL_STAGE_KEYS: MaterialStageKey[] = ['iqc', 'fqc', 'oqc'];

export type StageKey = MaterialStageKey | 'ipqc';

export type StagePolicy = {
  mode: 'none' | 'simple' | 'plan';
  planId?: number | null;
};

export type InspectionStagesValue = Partial<Record<StageKey, StagePolicy>>;

const STAGE_PLAN_TYPE: Record<StageKey, string> = {
  iqc: 'incoming',
  fqc: 'finished',
  oqc: 'outbound',
  ipqc: 'process',
};

const MODE_OPTIONS_MATERIAL = [
  { value: 'none', labelKey: 'app.master-data.materialForm.inspectionModeNone' },
  { value: 'simple', labelKey: 'app.master-data.materialForm.inspectionModeSimple' },
  { value: 'plan', labelKey: 'app.master-data.materialForm.inspectionModePlan' },
];

const MODE_OPTIONS_OPERATION = [
  { value: 'none', labelKey: 'field.operation.inspectionModeNone' },
  { value: 'simple', labelKey: 'field.operation.inspectionModeSimple' },
  { value: 'plan', labelKey: 'field.operation.inspectionModePlan' },
];

type InspectionStagesEditorProps = {
  scope: 'material' | 'operation';
  value?: InspectionStagesValue;
  onChange?: (v: InspectionStagesValue) => void;
};

function defaultStages(): InspectionStagesValue {
  return {
    iqc: { mode: 'none', planId: null },
    fqc: { mode: 'none', planId: null },
    oqc: { mode: 'none', planId: null },
    ipqc: { mode: 'none', planId: null },
  };
}

export function normalizeStagesInput(raw?: InspectionStagesValue | Record<string, any> | null): InspectionStagesValue {
  const base = defaultStages();
  if (!raw) return base;
  (Object.keys(base) as StageKey[]).forEach((k) => {
    const p = (raw as any)[k];
    if (p) {
      base[k] = {
        mode: (p.mode as StagePolicy['mode']) || 'none',
        planId: p.planId ?? p.plan_id ?? null,
      };
    }
  });
  return base;
}

export function stagesFromLegacy(
  inspectionMode?: string,
  defaultInspectionPlanId?: number | null,
): InspectionStagesValue {
  const mode = (inspectionMode || 'none') as StagePolicy['mode'];
  const planId = mode === 'plan' ? defaultInspectionPlanId ?? null : null;
  const p: StagePolicy = { mode, planId };
  return { iqc: { ...p }, fqc: { ...p }, oqc: { ...p } };
}

export function legacyFromStages(stages: InspectionStagesValue): {
  inspectionMode: string;
  defaultInspectionPlanId?: number | null;
} {
  const order: MaterialStageKey[] = MATERIAL_STAGE_KEYS;
  let inspectionMode = 'none';
  let defaultInspectionPlanId: number | null = null;
  for (const k of order) {
    const m = stages[k]?.mode || 'none';
    if (m !== 'none') {
      inspectionMode = m;
      if (stages[k]?.planId) defaultInspectionPlanId = stages[k]!.planId!;
      break;
    }
  }
  if (inspectionMode === 'plan' && !defaultInspectionPlanId) {
    for (const k of order) {
      if (stages[k]?.planId) {
        defaultInspectionPlanId = stages[k]!.planId!;
        break;
      }
    }
  }
  return { inspectionMode, defaultInspectionPlanId };
}

/** API snake_case（全场景） */
export function stagesToApiPayload(stages: InspectionStagesValue): Record<string, { mode: string; plan_id: number | null }> {
  const out: Record<string, { mode: string; plan_id: number | null }> = {};
  (Object.keys(stages) as StageKey[]).forEach((k) => {
    const p = stages[k];
    if (!p) return;
    out[k] = { mode: p.mode || 'none', plan_id: p.mode === 'plan' ? p.planId ?? null : null };
  });
  return out;
}

/** 物料 API：仅 IQC/FQC/OQC */
export function materialStagesToApiPayload(
  stages: InspectionStagesValue,
): Record<string, { mode: string; plan_id: number | null }> {
  const out: Record<string, { mode: string; plan_id: number | null }> = {};
  for (const k of MATERIAL_STAGE_KEYS) {
    const p = stages[k] || { mode: 'none', planId: null };
    out[k] = { mode: p.mode || 'none', plan_id: p.mode === 'plan' ? p.planId ?? null : null };
  }
  return out;
}

export const InspectionStagesEditor: React.FC<InspectionStagesEditorProps> = ({
  scope,
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const stages = useMemo(() => normalizeStagesInput(value), [value]);
  const [planOptionsByType, setPlanOptionsByType] = useState<Record<string, { label: string; value: number }[]>>({});

  const { data: effectiveCfg } = useRequest(() => qualityApi.effectiveConfig.get());

  const stageRows: StageKey[] = useMemo(
    () => (scope === 'operation' ? ['ipqc'] : [...MATERIAL_STAGE_KEYS]),
    [scope],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const plans = (await inspectionPlanApi.list({ limit: 500, is_active: true })) || [];
        const grouped: Record<string, { label: string; value: number }[]> = {};
        for (const p of Array.isArray(plans) ? plans : []) {
          const pt = p.plan_type || p.planType || '';
          if (!pt) continue;
          grouped[pt] = grouped[pt] || [];
          grouped[pt].push({
            label: `${p.plan_code || p.planCode || ''} ${p.plan_name || p.planName || ''}`.trim() || String(p.id),
            value: p.id,
          });
        }
        setPlanOptionsByType(grouped);
      } catch {
        setPlanOptionsByType({});
      }
    };
    void load();
  }, []);

  const orgStageEnabled = (key: StageKey): boolean => {
    if (!effectiveCfg) return true;
    const map: Record<StageKey, boolean> = {
      iqc: !!(effectiveCfg.stage_enabled?.iqc && effectiveCfg.module_enabled?.incoming),
      ipqc: !!(effectiveCfg.stage_enabled?.ipqc && effectiveCfg.module_enabled?.process),
      fqc: !!(effectiveCfg.stage_enabled?.fqc && effectiveCfg.module_enabled?.finished),
      oqc: !!effectiveCfg.stage_enabled?.oqc,
    };
    return map[key];
  };

  const patchStage = (key: StageKey, patch: Partial<StagePolicy>) => {
    const next = { ...stages, [key]: { ...stages[key], mode: stages[key]?.mode || 'none', ...patch } };
    if (next[key]?.mode !== 'plan') {
      next[key] = { ...next[key]!, planId: null };
    }
    onChange?.(next);
  };

  const stageLabel = (key: StageKey) => {
    if (scope === 'operation' && key === 'ipqc') {
      return t('app.master-data.operationForm.inspectionStageIpqc');
    }
    const keys: Record<StageKey, string> = {
      iqc: 'app.master-data.materialForm.inspectionStageIqc',
      fqc: 'app.master-data.materialForm.inspectionStageFqc',
      oqc: 'app.master-data.materialForm.inspectionStageOqc',
      ipqc: 'app.master-data.materialForm.inspectionStageIpqc',
    };
    return t(keys[key]);
  };

  const modeOptions = scope === 'operation' ? MODE_OPTIONS_OPERATION : MODE_OPTIONS_MATERIAL;
  const ipqcMode = stages.ipqc?.mode || 'none';

  if (scope === 'operation') {
    const planCol = ipqcMode === 'plan' ? '1fr 1.25fr auto' : '1fr auto';
    return (
      <div style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          {t('app.master-data.operationForm.inspectionStagesHint')}
        </Typography.Paragraph>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: planCol,
            gap: 16,
            alignItems: 'end',
            width: '100%',
          }}
        >
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              {t('field.operation.inspectionMode')}
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={ipqcMode}
              options={modeOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(mode) => patchStage('ipqc', { mode: mode as StagePolicy['mode'] })}
            />
          </div>
          {ipqcMode === 'plan' ? (
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                {t('field.operation.defaultInspectionPlan')}
              </Typography.Text>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder={t('field.operation.defaultInspectionPlanPlaceholder')}
                value={stages.ipqc?.planId ?? undefined}
                options={planOptionsByType.process || []}
                onChange={(planId) => patchStage('ipqc', { planId: planId ?? null })}
              />
            </div>
          ) : null}
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              {t('app.master-data.materialForm.inspectionStageOrgStatus')}
            </Typography.Text>
            {orgStageEnabled('ipqc') ? (
              <Typography.Text type="success">{t('common.enabled', { defaultValue: '开启' })}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                {t('app.master-data.materialForm.inspectionStagePending')}
              </Typography.Text>
            )}
          </div>
        </div>
        {ipqcMode !== 'none' && !orgStageEnabled('ipqc') && (
          <div style={{ marginTop: 12 }}>
            <QualityMasterDataHint scope={scope} stage="ipqc" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
        {t('app.master-data.materialForm.inspectionStagesHint')}
      </Typography.Paragraph>
      <Table
        size="small"
        pagination={false}
        rowKey="stage"
        dataSource={stageRows.map((stage) => ({ stage }))}
        columns={[
          {
            title: t('app.master-data.materialForm.inspectionStageColumn'),
            dataIndex: 'stage',
            width: 160,
            render: (stage: StageKey) => stageLabel(stage),
          },
          {
            title: t('app.master-data.materialForm.inspectionMode'),
            dataIndex: 'stage',
            width: 200,
            render: (stage: StageKey) => (
              <Select
                style={{ width: '100%' }}
                value={stages[stage]?.mode || 'none'}
                options={modeOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                onChange={(mode) => patchStage(stage, { mode: mode as StagePolicy['mode'] })}
              />
            ),
          },
          {
            title: t('app.master-data.materialForm.defaultInspectionPlan'),
            dataIndex: 'stage',
            render: (stage: StageKey) => {
              const mode = stages[stage]?.mode || 'none';
              if (mode !== 'plan') return '—';
              const planType = STAGE_PLAN_TYPE[stage];
              return (
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  placeholder={t('common.pleaseSelect', { defaultValue: '请选择' })}
                  value={stages[stage]?.planId ?? undefined}
                  options={planOptionsByType[planType] || []}
                  onChange={(planId) => patchStage(stage, { planId: planId ?? null })}
                />
              );
            },
          },
          {
            title: t('app.master-data.materialForm.inspectionStageOrgStatus'),
            dataIndex: 'stage',
            width: 120,
            render: (stage: StageKey) =>
              orgStageEnabled(stage) ? (
                <Typography.Text type="success">{t('common.enabled', { defaultValue: '开启' })}</Typography.Text>
              ) : (
                <Typography.Text type="secondary">
                  {t('app.master-data.materialForm.inspectionStagePending')}
                </Typography.Text>
              ),
          },
        ]}
      />
      {stageRows
        .filter((s) => (stages[s]?.mode || 'none') !== 'none' && !orgStageEnabled(s))
        .map((s) => (
          <QualityMasterDataHint key={s} scope={scope} stage={s} />
        ))}
    </div>
  );
};
