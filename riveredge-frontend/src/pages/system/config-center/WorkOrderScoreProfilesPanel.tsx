/**
 * APS-Lite 工单综合打分权重模板编辑
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, Col, InputNumber, Row, Select, Space, Typography } from 'antd';
import { batchUpdateProcessParameters } from '../../../services/businessConfig';
import { workOrderApi } from '../../../apps/kuaizhizao/services/work-order';

const WEIGHT_KEYS = [
  'manual_priority',
  'due_urgency',
  'demand_urgency',
  'kitting_readiness',
  'plan_fidelity',
] as const;

const WEIGHT_LABEL_KEYS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  manual_priority: 'pages.system.configCenter.scoreProfiles.weight.manual_priority',
  due_urgency: 'pages.system.configCenter.scoreProfiles.weight.due_urgency',
  demand_urgency: 'pages.system.configCenter.scoreProfiles.weight.demand_urgency',
  kitting_readiness: 'pages.system.configCenter.scoreProfiles.weight.kitting_readiness',
  plan_fidelity: 'pages.system.configCenter.scoreProfiles.weight.plan_fidelity',
};

type WeightMap = Record<(typeof WEIGHT_KEYS)[number], number>;

interface ProfileState {
  weights: WeightMap;
  kitting_mode: 'direct' | 'invert';
}

interface ScoreProfilesValue {
  scheduling?: ProfileState;
  picking?: ProfileState;
}

const DEFAULT_PROFILES: Required<ScoreProfilesValue> = {
  scheduling: {
    weights: {
      manual_priority: 0.25,
      due_urgency: 0.35,
      demand_urgency: 0.15,
      kitting_readiness: 0.2,
      plan_fidelity: 0.05,
    },
    kitting_mode: 'direct',
  },
  picking: {
    weights: {
      manual_priority: 0.2,
      due_urgency: 0.25,
      demand_urgency: 0.15,
      kitting_readiness: 0.4,
      plan_fidelity: 0,
    },
    kitting_mode: 'invert',
  },
};

function normalizeProfile(raw: any, fallback: ProfileState): ProfileState {
  const weightsRaw = raw?.weights || {};
  const weights = {} as WeightMap;
  for (const key of WEIGHT_KEYS) {
    const v = weightsRaw[key];
    weights[key] = typeof v === 'number' ? v : fallback.weights[key];
  }
  const mode = raw?.kitting_mode === 'invert' ? 'invert' : 'direct';
  return { weights, kitting_mode: mode };
}

function weightSum(weights: WeightMap): number {
  return WEIGHT_KEYS.reduce((acc, k) => acc + (Number(weights[k]) || 0), 0);
}

export interface WorkOrderScoreProfilesPanelProps {
  scoreProfiles?: ScoreProfilesValue | null;
  onSaved?: () => void | Promise<void>;
}

export const WorkOrderScoreProfilesPanel: React.FC<WorkOrderScoreProfilesPanelProps> = ({
  scoreProfiles,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [profiles, setProfiles] = useState<Required<ScoreProfilesValue>>(DEFAULT_PROFILES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfiles({
      scheduling: normalizeProfile(scoreProfiles?.scheduling, DEFAULT_PROFILES.scheduling),
      picking: normalizeProfile(scoreProfiles?.picking, DEFAULT_PROFILES.picking),
    });
  }, [scoreProfiles]);

  const schedulingSum = useMemo(() => weightSum(profiles.scheduling.weights), [profiles.scheduling.weights]);
  const pickingSum = useMemo(() => weightSum(profiles.picking.weights), [profiles.picking.weights]);

  const updateWeight = (scenario: 'scheduling' | 'picking', key: (typeof WEIGHT_KEYS)[number], value: number | null) => {
    setProfiles((prev) => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        weights: {
          ...prev[scenario].weights,
          [key]: value ?? 0,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (schedulingSum <= 0 || pickingSum <= 0) {
      message.error(t('pages.system.configCenter.scoreProfiles.sumMustBePositive'));
      return;
    }
    try {
      setSaving(true);
      await batchUpdateProcessParameters({
        parameters: {
          work_order: {
            score_profiles: profiles,
          },
        },
      });
      try {
        const refreshResult: { refreshed?: number; work_order_count?: number; skipped?: boolean } =
          await workOrderApi.batchRefreshScores({ scenarios: ['scheduling', 'picking'] });
        if (refreshResult?.skipped) {
          message.success(t('pages.system.configCenter.scoreProfiles.savedSkippedRecalc'));
        } else {
          const woCount = refreshResult?.work_order_count ?? 0;
          message.success(t('pages.system.configCenter.scoreProfiles.savedRecalcedCount', { count: woCount }));
        }
      } catch (refreshErr: any) {
        message.warning(
          refreshErr?.message
            ? t('pages.system.configCenter.scoreProfiles.savedButRecalcFailedWithReason', { reason: refreshErr.message })
            : t('pages.system.configCenter.scoreProfiles.savedButRecalcFailed'),
        );
      }
      await onSaved?.();
    } catch (e: any) {
      message.error(e?.message || t('pages.system.configCenter.scoreProfiles.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderProfileCard = (
    scenario: 'scheduling' | 'picking',
    title: string,
    subtitle: string,
    sum: number,
  ) => (
    <Card size="small" title={title} style={{ marginBottom: 16 }}>
      <Typography.Paragraph type="secondary" style={{ marginTop: -8, fontSize: 12 }}>
        {subtitle}
      </Typography.Paragraph>
      <Row gutter={[12, 12]}>
        {WEIGHT_KEYS.map((key) => (
          <Col key={key} xs={24} sm={12} md={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t(WEIGHT_LABEL_KEYS[key])}
            </Typography.Text>
            <InputNumber
              min={0}
              max={1}
              step={0.05}
              style={{ width: '100%', marginTop: 4 }}
              value={profiles[scenario].weights[key]}
              onChange={(v) => updateWeight(scenario, key, v)}
            />
          </Col>
        ))}
        <Col xs={24} sm={12} md={8}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('pages.system.configCenter.scoreProfiles.kittingSemantic')}
          </Typography.Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={profiles[scenario].kitting_mode}
            options={[
              { value: 'direct', label: t('pages.system.configCenter.scoreProfiles.kittingMode.direct') },
              { value: 'invert', label: t('pages.system.configCenter.scoreProfiles.kittingMode.invert') },
            ]}
            onChange={(v) =>
              setProfiles((prev) => ({
                ...prev,
                [scenario]: { ...prev[scenario], kitting_mode: v },
              }))
            }
          />
        </Col>
      </Row>
      <Typography.Text type={Math.abs(sum - 1) > 0.01 ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
        {t('pages.system.configCenter.scoreProfiles.weightSum', { sum: sum.toFixed(2) })}
      </Typography.Text>
    </Card>
  );

  return (
    <Card size="small" style={{ marginTop: 16 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size={0}>
        <Typography.Text strong>{t('pages.system.configCenter.scoreProfiles.title')}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          {t('pages.system.configCenter.scoreProfiles.desc')}
        </Typography.Paragraph>
      </Space>
      {renderProfileCard(
        'scheduling',
        t('pages.system.configCenter.scoreProfiles.schedulingTitle'),
        t('pages.system.configCenter.scoreProfiles.schedulingDesc'),
        schedulingSum,
      )}
      {renderProfileCard(
        'picking',
        t('pages.system.configCenter.scoreProfiles.pickingTitle'),
        t('pages.system.configCenter.scoreProfiles.pickingDesc'),
        pickingSum,
      )}
      <Button type="primary" loading={saving} onClick={handleSave}>
        {t('pages.system.configCenter.scoreProfiles.saveButton')}
      </Button>
    </Card>
  );
};

export default WorkOrderScoreProfilesPanel;
