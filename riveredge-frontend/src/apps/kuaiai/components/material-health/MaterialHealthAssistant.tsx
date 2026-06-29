/**
 * KU-AI · 物料健康助手 — 检查物料完备度与疑似重复编码
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  List,
  Progress,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail } from '../../../../components/uni-detail';
import { UniAiButton, UniAiLottieIcon } from '../../../../components/uni-ai-button';
import { formatApiErrorDetail } from '../../../../services/api';
import { materialApi } from '../../../master-data/services/material';
import type {
  MaterialHealthCategory,
  MaterialHealthCheckResult,
  MaterialHealthIssue,
  MaterialHealthMaterialRef,
  MaterialHealthSeverity,
} from '../../../master-data/types/materialHealth';
import { useKuaiaiEntryAvailable } from '../../hooks/useKuaiaiEntryAvailable';
import './MaterialHealthAssistant.less';

const { Text, Paragraph } = Typography;
const I18N = 'app.kuaiai.materialHealth';

export interface MaterialHealthAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  groupId?: number | null;
  onOpenMaterial?: (uuid: string) => void;
}

type FilterCategory = 'all' | 'completeness' | 'duplicate';

const SEVERITY_RANK: Record<MaterialHealthSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

interface MaterialIssueGroup {
  material: MaterialHealthMaterialRef;
  issues: MaterialHealthIssue[];
  maxSeverity: MaterialHealthSeverity;
}

function worstSeverity(issues: MaterialHealthIssue[]): MaterialHealthSeverity {
  return issues.reduce<MaterialHealthSeverity>(
    (worst, issue) =>
      SEVERITY_RANK[issue.severity] < SEVERITY_RANK[worst] ? issue.severity : worst,
    'info',
  );
}

function groupIssuesByMaterial(issues: MaterialHealthIssue[]): MaterialIssueGroup[] {
  const map = new Map<string, MaterialIssueGroup>();

  for (const issue of issues) {
    for (const mat of issue.materials) {
      let group = map.get(mat.uuid);
      if (!group) {
        group = { material: mat, issues: [], maxSeverity: 'info' };
        map.set(mat.uuid, group);
      }
      if (!group.issues.some((item) => item.id === issue.id)) {
        group.issues.push(issue);
      }
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      maxSeverity: worstSeverity(group.issues),
    }))
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.maxSeverity] - SEVERITY_RANK[b.maxSeverity];
      if (bySeverity !== 0) return bySeverity;
      return a.material.mainCode.localeCompare(b.material.mainCode, undefined, { numeric: true });
    });
}

function severityTag(severity: string, t: (k: string) => string) {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    error: { color: 'error', icon: <ExclamationCircleOutlined />, label: t(`${I18N}.severityError`) },
    warning: { color: 'warning', icon: <WarningOutlined />, label: t(`${I18N}.severityWarning`) },
    info: { color: 'default', icon: <InfoCircleOutlined />, label: t(`${I18N}.severityInfo`) },
  };
  const item = map[severity] ?? map.info;
  return (
    <Tag icon={item.icon} color={item.color}>
      {item.label}
    </Tag>
  );
}

function categoryLabel(category: MaterialHealthCategory, t: (k: string) => string) {
  return t(`${I18N}.category.${category}`);
}

export function MaterialHealthAssistantDrawer({
  open,
  onClose,
  groupId,
  onOpenMaterial,
}: MaterialHealthAssistantDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MaterialHealthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCategory>('all');

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await materialApi.healthCheck({
        groupId: groupId ?? undefined,
        mastersOnly: true,
      });
      setResult(data);
    } catch (err: unknown) {
      setResult(null);
      const detail =
        formatApiErrorDetail((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) ||
        (err instanceof Error ? err.message : '');
      const msg = detail || t(`${I18N}.checkFailed`);
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [groupId, message, t]);

  React.useEffect(() => {
    if (open) {
      setFilter('all');
      void runCheck();
    } else {
      setResult(null);
      setError(null);
    }
  }, [open, runCheck]);

  const filteredIssues = useMemo(() => {
    if (!result) return [];
    if (filter === 'all') return result.issues;
    if (filter === 'completeness') {
      return result.issues.filter((i) => i.category === 'completeness' || i.category === 'reasonableness');
    }
    if (filter === 'duplicate') {
      return result.issues.filter((i) => i.category.startsWith('duplicate'));
    }
    return result.issues;
  }, [result, filter]);

  const groupedByMaterial = useMemo(
    () => groupIssuesByMaterial(filteredIssues),
    [filteredIssues],
  );

  const scoreColor =
    (result?.summary.healthScore ?? 0) >= 85
      ? token.colorSuccess
      : (result?.summary.healthScore ?? 0) >= 60
        ? token.colorWarning
        : token.colorError;

  const handleMaterialCodeClick = useCallback(
    (uuid: string) => {
      onOpenMaterial?.(uuid);
      onClose();
    },
    [onClose, onOpenMaterial],
  );

  return (
    <UniDetail
      title={
        <span className="material-health-drawer-title">
          <UniAiLottieIcon size={22} />
          <span>{t(`${I18N}.title`)}</span>
        </span>
      }
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      styles={{
        title: {
          display: 'flex',
          alignItems: 'center',
          margin: 0,
        },
      }}
      extra={
        <Button type="link" size="small" onClick={() => void runCheck()} loading={loading}>
          {t('common.refresh')}
        </Button>
      }
      plainBody={
        loading && !result ? (
          <div style={{ padding: '8px 0' }}>
            <Spin tip={t(`${I18N}.analyzing`)} />
          </div>
        ) : result ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div
              style={{
                padding: 16,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary">{t(`${I18N}.scoreLabel`)}</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor, lineHeight: 1.2 }}>
                    {result.summary.healthScore}
                  </div>
                </div>
                <Progress
                  type="circle"
                  percent={result.summary.healthScore}
                  size={72}
                  strokeColor={scoreColor}
                  format={(p) => `${p}`}
                />
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 12, fontSize: 12 }}>
                {t(`${I18N}.summaryStats`, {
                  total: result.summary.totalMaterials,
                  issues: result.summary.issueCount,
                  completeness: result.summary.completenessCount,
                  duplicate: result.summary.duplicateCount,
                })}
              </Paragraph>
            </div>

            <Segmented
              block
              value={filter}
              onChange={(v) => setFilter(v as FilterCategory)}
              options={[
                { label: t(`${I18N}.filterAll`), value: 'all' },
                { label: t(`${I18N}.filterCompleteness`), value: 'completeness' },
                { label: t(`${I18N}.filterDuplicate`), value: 'duplicate' },
              ]}
            />

            {groupedByMaterial.length === 0 ? (
              <Empty
                image={<CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess }} />}
                description={t(`${I18N}.noIssues`)}
              />
            ) : (
              <List
                className="material-health-issue-list"
                split
                dataSource={groupedByMaterial}
                renderItem={(group) => (
                  <List.Item key={group.material.uuid}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div className="material-health-material-header">
                        {onOpenMaterial ? (
                          <Button
                            type="link"
                            className="material-health-issue-code-link"
                            onClick={() => handleMaterialCodeClick(group.material.uuid)}
                          >
                            {group.material.mainCode}
                          </Button>
                        ) : (
                          <Text strong>{group.material.mainCode}</Text>
                        )}
                        {group.material.name ? (
                          <Text type="secondary" ellipsis className="material-health-material-name">
                            {group.material.name}
                          </Text>
                        ) : null}
                        <Tag>{t(`${I18N}.issueCount`, { count: group.issues.length })}</Tag>
                      </div>
                      <ul className="material-health-material-issues">
                        {group.issues.map((issue) => (
                          <li key={issue.id} className="material-health-material-issue">
                            <Space wrap size={[4, 4]} align="start">
                              {severityTag(issue.severity, t)}
                              <Tag>{categoryLabel(issue.category, t)}</Tag>
                              <Text type="secondary">{issue.title}</Text>
                            </Space>
                          </li>
                        ))}
                      </ul>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Space>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            message={t(`${I18N}.checkFailed`)}
            description={error}
            action={
              <Button size="small" type="primary" onClick={() => void runCheck()} loading={loading}>
                {t(`${I18N}.retry`)}
              </Button>
            }
          />
        ) : (
          <Empty description={t(`${I18N}.empty`)} />
        )
      }
    />
  );
}

export interface MaterialHealthAssistantTriggerProps {
  groupId?: number | null;
  onOpenMaterial?: (uuid: string) => void;
}

export function MaterialHealthAssistantTrigger({
  groupId,
  onOpenMaterial,
}: MaterialHealthAssistantTriggerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const kuaiaiAvailable = useKuaiaiEntryAvailable();

  if (!kuaiaiAvailable) {
    return null;
  }

  return (
    <>
      <UniAiButton onClick={() => setOpen(true)}>
        {t(`${I18N}.trigger`)}
      </UniAiButton>
      <MaterialHealthAssistantDrawer
        open={open}
        onClose={() => setOpen(false)}
        groupId={groupId}
        onOpenMaterial={onOpenMaterial}
      />
    </>
  );
}

export default MaterialHealthAssistantTrigger;
