/**
 * APS-Lite 工单综合打分权重模板编辑
 */
import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, InputNumber, Row, Select, Space, Typography } from 'antd';
import { batchUpdateProcessParameters } from '../../../services/businessConfig';

const WEIGHT_KEYS = [
  'manual_priority',
  'due_urgency',
  'demand_urgency',
  'kitting_readiness',
  'plan_fidelity',
] as const;

const WEIGHT_LABELS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  manual_priority: '人工优先级',
  due_urgency: '交期紧迫度',
  demand_urgency: '需求交期',
  kitting_readiness: '齐套就绪',
  plan_fidelity: '计划一致性',
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
      message.error('各场景权重之和须大于 0');
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
      message.success('打分权重模板已保存');
      await onSaved?.();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
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
              {WEIGHT_LABELS[key]}
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
            齐套语义
          </Typography.Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={profiles[scenario].kitting_mode}
            options={[
              { value: 'direct', label: '齐套高优先（排程开产）' },
              { value: 'invert', label: '缺料多优先（备料）' },
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
        权重合计 {sum.toFixed(2)}（保存后引擎会自动归一化）
      </Typography.Text>
    </Card>
  );

  return (
    <Card size="small" style={{ marginTop: 16 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size={0}>
        <Typography.Text strong>APS-Lite 综合打分权重模板</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          分别配置排程（scheduling）与备料（picking）场景的维度权重；消费端包括甘特排序、配料中心与出库领料队列。
        </Typography.Paragraph>
      </Space>
      {renderProfileCard(
        'scheduling',
        '排程场景 scheduling',
        '用于智能排产、甘特默认序与控制塔风险参考。',
        schedulingSum,
      )}
      {renderProfileCard(
        'picking',
        '备料场景 picking',
        '用于配料中心提醒与出库管理生产领料排序（缺料多先备）。',
        pickingSum,
      )}
      <Button type="primary" loading={saving} onClick={handleSave}>
        保存权重模板
      </Button>
    </Card>
  );
};

export default WorkOrderScoreProfilesPanel;
