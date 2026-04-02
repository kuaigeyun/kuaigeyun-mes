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
import type {
  DocumentTrackingResponse,
  DocumentTrackingTimelineItem,
  DocumentTrackingRelation,
  DocumentTrackingFieldChange,
} from '../../services/documentTracking';
import { useDocumentTracking } from './useDocumentTracking';

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

const STATUS_COLOR: Record<string, string> = {
  documentStatus_draft: 'default',
  documentStatus_pending_review: 'warning',
  documentStatus_audited: 'green',
  documentStatus_rejected: 'error',
  documentStatus_approved: 'green',
  documentStatus_confirmed: 'blue',
  documentStatus_cancelled: 'default',
  documentStatus_effective: 'purple',
  documentStatus_in_progress: 'cyan',
  documentStatus_delivered: 'orange',
  documentStatus_completed: 'gold',
  documentStatus_pending: 'warning',
  documentStatus_submitted: 'warning',
  reviewStatus_pending: 'warning',
  reviewStatus_approved: 'green',
  reviewStatus_rejected: 'error',
};

function useTrackingStatusRender(t: TFunction) {
  const renderStatusBadge = (raw: string) => {
    if (!raw || raw === '空') return raw || '—';
    const i18nKey = STATUS_TO_I18N[raw] || STATUS_TO_I18N[raw.trim()];
    const colorKey = i18nKey ? i18nKey.replace('.', '_') : '';
    const color = colorKey ? (STATUS_COLOR[colorKey] ?? 'default') : 'default';
    const text = i18nKey ? t(i18nKey) : raw;
    return <Tag color={color}>{text}</Tag>;
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
export const DocumentTrackingRelationsBody: React.FC<{
  data: DocumentTrackingResponse;
  onDocumentClick?: (type: string, id: number) => void;
}> = ({ data, onDocumentClick }) => {
  const { t } = useTranslation();
  const up = data.relations.upstream;
  const down = data.relations.downstream;
  if (up.length === 0 && down.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {t('components.documentTrackingPanel.noRelations')}
      </Typography.Text>
    );
  }

  const renderRelation = (rel: DocumentTrackingRelation, dir: 'up' | 'down') => {
    const clickable = !!onDocumentClick && !(dir === 'down' && rel.is_deleted);
    const code = (rel.code || '').trim() || `#${rel.id}`;
    const typeLabel = t(`components.documentTrackingPanel.docType.${rel.type}`, { defaultValue: rel.type });
    const primary = `${typeLabel}（${code}）`;
    const nameTrim = (rel.name || '').trim();
    const showExtraName = nameTrim && nameTrim !== code;
    return (
      <div
        key={`${rel.type}-${rel.id}`}
        style={{
          padding: '6px 10px',
          background: 'var(--ant-color-fill-alter)',
          borderRadius: 6,
          border: '1px solid var(--ant-color-border-secondary)',
          cursor: clickable ? 'pointer' : 'default',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onClick={() => {
          if (!clickable) return;
          onDocumentClick?.(rel.type, rel.id);
        }}
        role={clickable ? 'button' : undefined}
      >
        <span>{primary}</span>
        {showExtraName ? (
          <span style={{ color: 'var(--ant-color-text-secondary)', marginLeft: 6 }}>{nameTrim}</span>
        ) : null}
        {dir === 'down' && rel.is_deleted ? (
          <Tag color="error" style={{ marginLeft: 8 }}>
            {t('components.documentTrackingPanel.relationDeleted')}
          </Tag>
        ) : null}
        {dir === 'down' && !rel.is_deleted && rel.is_auto_created ? (
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {t('components.documentTrackingPanel.autoGenerated')}
          </Tag>
        ) : null}
        {dir === 'down' && !rel.is_deleted && rel.is_changed_after_link ? (
          <Tag color="warning" style={{ marginLeft: 8 }}>
            {t('components.documentTrackingPanel.relationChangedAfterLink')}
          </Tag>
        ) : null}
      </div>
    );
  };

  const currentTypeLabel = t(`components.documentTrackingPanel.docType.${data.document_type}`, {
    defaultValue: data.document_type,
  });
  const currentCode = (data.document_code || '').trim() || `#${data.document_id}`;
  const currentNode = (
    <div
      key={`current-${data.document_type}-${data.document_id}`}
      style={{
        padding: '6px 10px',
        background: 'var(--ant-color-bg-container)',
        borderRadius: 6,
        border: '1px solid var(--ant-color-border)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <span style={{ fontWeight: 600 }}>{`${currentTypeLabel}（${currentCode}）`}</span>
    </div>
  );

  const chainNodes: React.ReactNode[] = [
    ...up.map((r) => renderRelation(r, 'up')),
    currentNode,
    ...down.map((r) => renderRelation(r, 'down')),
  ];

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minWidth: 'max-content' }}>
        {chainNodes.map((node, index) => (
          <React.Fragment key={`chain-${index}`}>
            {index > 0 ? <ArrowRightOutlined style={{ color: 'var(--ant-color-text-secondary)' }} /> : null}
            {node}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** 操作时间线（无外层 Card） */
export const DocumentTrackingTimelineBody: React.FC<{
  data: DocumentTrackingResponse;
}> = ({ data }) => {
  const { t } = useTranslation();
  const { renderStatusBadge, renderFieldChangeValue } = useTrackingStatusRender(t);

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

    const isStateTransition = item.type === 'state_transition' && item.from_state != null && item.to_state != null;
    const isSameStateWithReason = isStateTransition && item.from_state === item.to_state && item.detail;
    const detailContent = isStateTransition && !isSameStateWithReason ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {renderStatusBadge(item.from_state!)}
        <span style={{ color: 'var(--ant-color-primary)' }}>→</span>
        {renderStatusBadge(item.to_state!)}
        {item.is_auto_approve && (
          <Tag color="blue" style={{ marginLeft: 4 }}>
            {t('components.documentTrackingPanel.autoApprove')}
          </Tag>
        )}
      </span>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{item.detail}</span>
        {item.is_auto_created && (
          <Tag color="blue" style={{ marginLeft: 4 }}>
            {t('components.documentTrackingPanel.autoGenerated')}
          </Tag>
        )}
      </span>
    );

    return {
      dot: icon,
      children: (
        <div>
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>{detailContent}</div>
          {fieldChanges && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {item.field_changes!.map((c: DocumentTrackingFieldChange, i: number) => (
                <div
                  key={i}
                  style={{
                    color: 'var(--ant-color-text-secondary)',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  <span style={{ color: 'var(--ant-color-text)' }}>{c.label}</span>
                  <span style={{ margin: '0 4px' }}>：</span>
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
          )}
          {(item.by || time) && (
            <div style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12, marginTop: 4 }}>
              {item.by && <span>{item.by}</span>}
              {time && <span style={{ marginLeft: 8 }}>{time}</span>}
            </div>
          )}
        </div>
      ),
    };
  };

  if (data.timeline.length === 0) {
    return <Empty description={t('components.documentTrackingPanel.noOperations')} />;
  }
  return <Timeline items={data.timeline.map(renderTimelineItem)} />;
};

export { useDocumentTracking } from './useDocumentTracking';

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
        <Spin tip={t('components.documentTrackingPanel.loadingTip')} />
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

  const hasRelations = data.relations.upstream.length > 0 || data.relations.downstream.length > 0;

  return (
    <div style={{ padding: 0 }}>
      {hasRelations && (
        <Card
          size="small"
          title={t('components.documentTrackingPanel.relationsTitle')}
          style={{ marginBottom: 16 }}
          styles={{ root: { borderColor: 'var(--ant-color-border)' } }}
        >
          <DocumentTrackingRelationsBody data={data} onDocumentClick={onDocumentClick} />
        </Card>
      )}

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
