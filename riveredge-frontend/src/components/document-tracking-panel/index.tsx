/**
 * 单据跟踪中心面板
 * 展示单据操作记录时间线及上下游关联
 * 状态以徽标形式展示，支持多语言
 */

import React, { useMemo } from 'react';
import { Timeline, Empty, Spin, Card, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SwapOutlined, CheckCircleOutlined, ArrowRightOutlined, LinkOutlined, EditOutlined, PlusOutlined, FormOutlined } from '@ant-design/icons';
import { RelationLayout } from './RelationLayout';
import { DocumentTraceFlowGraph } from './DocumentTraceFlowGraph';
import type { DocumentTrackingResponse, DocumentTrackingTimelineItem, DocumentTrackingFieldChange } from '../../services/documentTracking';
import { useDocumentTracking } from './useDocumentTracking';
import { getDocumentLifecycleStageTagProps } from '../../utils/documentLifecycleStatusTag';

/**
 * 原始状态值 -> lifecycle 阶段 i18n key
 * 状态变更直接显示 lifecycle 的阶段名称（草稿、待审核、已审核、已生效、执行中、已交货、已完成等），
 * 与 UniLifecycleStepper 保持一致。
 */
const STATUS_TO_LIFECYCLE_I18N: Record<string, string> = {
  DRAFT: 'documentStatus.draft',
  草稿: 'documentStatus.draft',
  PENDING_REVIEW: 'documentStatus.pending_review',
  待审核: 'documentStatus.pending_review',
  PENDING: 'documentStatus.pending_review',
  已提交: 'documentStatus.pending_review',
  SUBMITTED: 'documentStatus.pending_review',
  AUDITED: 'documentStatus.audited',
  已审核: 'documentStatus.audited',
  APPROVED: 'documentStatus.audited',
  审核通过: 'documentStatus.audited',
  通过: 'documentStatus.audited',
  已通过: 'documentStatus.audited',
  REJECTED: 'documentStatus.rejected',
  已驳回: 'documentStatus.rejected',
  审核驳回: 'documentStatus.rejected',
  CONFIRMED: 'documentStatus.effective',
  已确认: 'documentStatus.effective',
  CANCELLED: 'documentStatus.cancelled',
  已取消: 'documentStatus.cancelled',
  EFFECTIVE: 'documentStatus.effective',
  已生效: 'documentStatus.effective',
  IN_PROGRESS: 'documentStatus.in_progress',
  执行中: 'documentStatus.in_progress',
  DELIVERED: 'documentStatus.delivered',
  已交货: 'documentStatus.delivered',
  COMPLETED: 'documentStatus.completed',
  已完成: 'documentStatus.completed',
};

/** 兼容旧逻辑：STATUS_TO_I18N 别名，统一使用 lifecycle 映射 */
const STATUS_TO_I18N = STATUS_TO_LIFECYCLE_I18N;

function useTrackingStatusRender(t: TFunction) {
  const renderStatusBadge = (raw: string) => {
    if (!raw || raw === '空') return raw || '—';
    const i18nKey = STATUS_TO_I18N[raw] || STATUS_TO_I18N[raw.trim()];
    const text = i18nKey ? t(i18nKey) : raw;
    const tagProps = getDocumentLifecycleStageTagProps(raw);
    return <Tag {...tagProps}>{text}</Tag>;
  };

  const renderFieldChangeValue = (val: string, field: string) => {
    const isStatusField = field === 'status' || field === 'review_status';
    const isKnownStatus = isStatusField || (val && STATUS_TO_I18N[val] != null) || (val && STATUS_TO_I18N[val.trim()] != null);
    if (isKnownStatus && val && val !== '空') {
      return renderStatusBadge(val);
    }
    return val || '—';
  };

  return { renderStatusBadge, renderFieldChangeValue };
}

/** 上下游单据（无外层 Card，用于详情抽屉与其它 Card 并列、避免框套框） */
export const DocumentTrackingRelationsBody = RelationLayout;

/** 全链路关联图（无外层 Card，供抽屉 collaborationRelations、跟踪面板嵌入） */
export const DocumentTrackingRelationsTabsBody: React.FC<{
  documentType: string;
  documentId: number;
  refreshKey?: number;
  onDocumentClick?: (type: string, id: number) => void;
  compact?: boolean;
  hideInlineRefresh?: boolean;
  onTraceLoadingChange?: (loading: boolean) => void;
}> = ({ documentType, documentId, refreshKey, onDocumentClick, compact, hideInlineRefresh, onTraceLoadingChange }) => (
  <DocumentTraceFlowGraph
    documentType={documentType}
    documentId={documentId}
    enabled
    refreshKey={refreshKey}
    onDocumentClick={onDocumentClick}
    compact={compact}
    hideInlineRefresh={hideInlineRefresh}
    onTraceLoadingChange={onTraceLoadingChange}
  />
);

/** 操作时间线（无外层 Card） */
export const DocumentTrackingTimelineBody: React.FC<{
  data: DocumentTrackingResponse;
}> = ({ data }) => {
  const { t } = useTranslation();
  const { renderStatusBadge, renderFieldChangeValue } = useTrackingStatusRender(t);
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];

  const typeLabel: Record<string, string> = useMemo(
    () => ({
      create: t('components.documentTrackingPanel.typeCreate'),
      state_transition: t('components.documentTrackingPanel.typeStateTransition'),
      edit: t('components.documentTrackingPanel.typeEdit'),
      approve: t('components.documentTrackingPanel.typeApprove'),
      push: t('components.documentTrackingPanel.typePush'),
      pull: t('components.documentTrackingPanel.typePull'),
      from: t('components.documentTrackingPanel.typeFrom'),
      report: t('components.documentTrackingPanel.typeReport'),
    }),
    [t]
  );

  const renderTimelineItem = (item: DocumentTrackingTimelineItem) => {
    const icon =
      item.type === 'create' ? (
        <PlusOutlined />
      ) : item.type === 'state_transition' ? (
        <SwapOutlined />
      ) : item.type === 'edit' ? (
        <EditOutlined />
      ) : item.type === 'approve' ? (
        <CheckCircleOutlined />
      ) : item.type === 'report' ? (
        <FormOutlined />
      ) : item.type === 'push' || item.type === 'from' ? (
        <ArrowRightOutlined />
      ) : (
        <LinkOutlined />
      );
    const label = typeLabel[item.type] || item.type;
    const time = item.at ? new Date(item.at).toLocaleString() : '';
    const fieldChanges = item.type === 'edit' && item.field_changes && item.field_changes.length > 0;
    const metaStr = [item.by, time].filter(Boolean).join(' · ');

    const isStateTransition = item.type === 'state_transition' && item.from_state != null && item.to_state != null;
    const isSameStateWithReason = isStateTransition && item.from_state === item.to_state && item.detail;
    const detailContent = isStateTransition && !isSameStateWithReason ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {renderStatusBadge(item.from_state!)}
        <span style={{ color: 'var(--ant-color-primary)' }}>→</span>
        {renderStatusBadge(item.to_state!)}
        {item.is_auto_approve && (
          <Tag color="blue" style={{ marginInlineStart: 0 }}>
            {t('components.documentTrackingPanel.autoApprove')}
          </Tag>
        )}
      </span>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{item.detail}</span>
        {item.is_auto_created && (
          <Tag color="blue" style={{ marginInlineStart: 0 }}>
            {t('components.documentTrackingPanel.autoGenerated')}
          </Tag>
        )}
      </span>
    );

    /** 单行主轴：类型 · 详情 · 操作人 · 时间（窄屏自动折行） */
    const mainRow = (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 10,
          rowGap: 4,
          minWidth: 0,
        }}
      >
        <Typography.Text strong style={{ flexShrink: 0 }}>
          {label}
        </Typography.Text>
        <span
          style={{
            flex: '1 1 140px',
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {detailContent}
        </span>
        {metaStr ? (
          <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
            {metaStr}
          </Typography.Text>
        ) : null}
      </div>
    );

    return {
      icon,
      content: (
        <div>
          {mainRow}
          {fieldChanges ? (
            <div style={{ marginTop: 6, fontSize: 12, paddingLeft: 0 }}>
              {item.field_changes!.map((c: DocumentTrackingFieldChange, i: number) => (
                <div
                  key={i}
                  style={{
                    color: 'var(--ant-color-text-secondary)',
                    marginBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  <span style={{ color: 'var(--ant-color-text)' }}>{c.label}</span>
                  <span style={{ margin: '0 2px' }}>：</span>
                  <span style={{ color: 'var(--ant-color-text-tertiary)', textDecoration: 'line-through' }}>
                    {typeof (c.from || '空') === 'string' && (c.field === 'status' || c.field === 'review_status')
                      ? renderStatusBadge(c.from || '')
                      : (c.from || '空')}
                  </span>
                  <span style={{ margin: '0 4px', color: 'var(--ant-color-primary)' }}>→</span>
                  <span>{renderFieldChangeValue(c.to || '', c.field)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
    };
  };

  if (timeline.length === 0) {
    return <Empty description={t('components.documentTrackingPanel.noOperations')} />;
  }
  return (
    <Timeline
      styles={{ item: { paddingBottom: 10 } }}
      items={timeline.map(renderTimelineItem)}
    />
  );
};

export { useDocumentTracking } from './useDocumentTracking';
export { TraceLinkedDocumentBrief } from './TraceLinkedDocumentBrief';

interface DocumentTrackingPanelProps {
  documentType: string;
  documentId: number;
  /** 变更时触发重新拉取，用于操作成功后刷新记录 */
  refreshKey?: number;
  onDocumentClick?: (type: string, id: number) => void;
}

export const DocumentTrackingPanel: React.FC<DocumentTrackingPanelProps> = ({
  documentType,
  documentId,
  refreshKey,
  onDocumentClick,
}) => {
  const { t } = useTranslation();
  const { data, loading, error } = useDocumentTracking(documentType, documentId, refreshKey);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
        <div style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)' }}>
          {t('components.documentTrackingPanel.loadingTip')}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <Card size="small" styles={{ root: { borderColor: 'var(--ant-color-border)' } }}>
        <Empty description={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card size="small" styles={{ root: { borderColor: 'var(--ant-color-border)' } }}>
        <Empty description={t('components.documentTrackingPanel.noData')} />
      </Card>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <Card
        size="small"
        title={t('components.documentTrackingPanel.relationsFullChainTitle')}
        style={{ marginBottom: 16 }}
        styles={{ root: { borderColor: 'var(--ant-color-border)' } }}
      >
        <DocumentTrackingRelationsTabsBody
          documentType={documentType}
          documentId={documentId}
          refreshKey={refreshKey}
          onDocumentClick={onDocumentClick}
        />
      </Card>

      <Card
        size="small"
        title={t('components.documentTrackingPanel.operationsTitle')}
        styles={{ root: { borderColor: 'var(--ant-color-border)' } }}
      >
        <DocumentTrackingTimelineBody data={data} />
      </Card>
    </div>
  );
};

export default DocumentTrackingPanel;
