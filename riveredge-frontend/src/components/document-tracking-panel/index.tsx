/**
 * 单据跟踪中心面板
 * 展示单据操作记录时间线及上下游关联
 * 状态以徽标形式展示，支持多语言
 */

import React, { useEffect, useState } from 'react';
import { Timeline, Empty, Spin, Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { SwapOutlined, CheckCircleOutlined, ArrowRightOutlined, LinkOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type {
  DocumentTrackingResponse,
  DocumentTrackingTimelineItem,
  DocumentTrackingRelation,
  DocumentTrackingFieldChange,
} from '../../services/documentTracking';
import { getDocumentTracking } from '../../services/documentTracking';

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
  const [data, setData] = useState<DocumentTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const typeLabel: Record<string, string> = {
    create: t('components.documentTrackingPanel.typeCreate'),
    state_transition: t('components.documentTrackingPanel.typeStateTransition'),
    edit: t('components.documentTrackingPanel.typeEdit'),
    approve: t('components.documentTrackingPanel.typeApprove'),
    push: t('components.documentTrackingPanel.typePush'),
    pull: t('components.documentTrackingPanel.typePull'),
    from: t('components.documentTrackingPanel.typeFrom'),
  };

  useEffect(() => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError(null);
    getDocumentTracking(documentType, documentId)
      .then(setData)
      .catch((e) => setError(e?.message || t('components.documentTrackingPanel.loadFailed')))
      .finally(() => setLoading(false));
  }, [documentType, documentId, refreshKey, t]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin tip={t('components.documentTrackingPanel.loadingTip')} />
      </div>
    );
  }
  if (error) {
    return (
      <Card size="small">
        <Empty description={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card size="small">
        <Empty description={t('components.documentTrackingPanel.noData')} />
      </Card>
    );
  }

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
      ) : item.type === 'push' || item.type === 'from' ? (
        <ArrowRightOutlined />
      ) : (
        <LinkOutlined />
      );
    const label = typeLabel[item.type] || item.type;
    const time = item.at ? new Date(item.at).toLocaleString() : '';
    const fieldChanges = item.type === 'edit' && item.field_changes && item.field_changes.length > 0;

    const isStateTransition = item.type === 'state_transition' && item.from_state != null && item.to_state != null;
    const detailContent = isStateTransition ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {renderStatusBadge(item.from_state!)}
        <span style={{ color: '#1890ff' }}>→</span>
        {renderStatusBadge(item.to_state!)}
        {item.is_auto_approve && (
          <Tag color="blue" style={{ marginLeft: 4 }}>{t('components.documentTrackingPanel.autoApprove')}</Tag>
        )}
      </span>
    ) : (
      item.detail
    );

    return {
      dot: icon,
      children: (
        <div>
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ color: '#666', fontSize: 12 }}>{detailContent}</div>
          {fieldChanges && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {item.field_changes!.map((c: DocumentTrackingFieldChange, i: number) => (
                <div key={i} style={{ color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ color: '#333' }}>{c.label}</span>
                  <span style={{ margin: '0 4px' }}>：</span>
                  <span style={{ color: '#999', textDecoration: 'line-through' }}>
                    {typeof (c.from || '空') === 'string' && (c.field === 'status' || c.field === 'review_status')
                      ? renderStatusBadge(c.from || '')
                      : (c.from || '空')}
                  </span>
                  <span style={{ margin: '0 4px', color: '#1890ff' }}>→</span>
                  <span>{renderFieldChangeValue(c.to || '', c.field)}</span>
                </div>
              ))}
            </div>
          )}
          {(item.by || time) && (
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
              {item.by && <span>{item.by}</span>}
              {time && <span style={{ marginLeft: 8 }}>{time}</span>}
            </div>
          )}
        </div>
      ),
    };
  };

  const renderRelation = (rel: DocumentTrackingRelation, dir: 'up' | 'down') => (
    <div
      key={`${rel.type}-${rel.id}`}
      style={{
        padding: '4px 8px',
        marginBottom: 4,
        background: '#fafafa',
        borderRadius: 4,
        cursor: onDocumentClick ? 'pointer' : 'default',
      }}
      onClick={() => onDocumentClick?.(rel.type, rel.id)}
      role={onDocumentClick ? 'button' : undefined}
    >
      {dir === 'down' ? <ArrowRightOutlined style={{ marginRight: 4 }} /> : null}
      <span>{rel.code || `${rel.type}#${rel.id}`}</span>
      {rel.name && <span style={{ color: '#666', marginLeft: 4 }}>({rel.name})</span>}
      {dir === 'up' ? <ArrowRightOutlined style={{ marginLeft: 4 }} /> : null}
    </div>
  );

  return (
    <div style={{ padding: 0 }}>
      {(data.relations.upstream.length > 0 || data.relations.downstream.length > 0) && (
        <Card size="small" title={t('components.documentTrackingPanel.relationsTitle')} style={{ marginBottom: 16 }}>
          {data.relations.upstream.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('components.documentTrackingPanel.upstream')}</div>
              {data.relations.upstream.map((r) => renderRelation(r, 'up'))}
            </div>
          )}
          {data.relations.downstream.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('components.documentTrackingPanel.downstream')}</div>
              {data.relations.downstream.map((r) => renderRelation(r, 'down'))}
            </div>
          )}
        </Card>
      )}

      <Card size="small" title={t('components.documentTrackingPanel.operationsTitle')}>
        {data.timeline.length === 0 ? (
          <Empty description={t('components.documentTrackingPanel.noOperations')} />
        ) : (
          <Timeline items={data.timeline.map(renderTimelineItem)} />
        )}
      </Card>
    </div>
  );
};

export default DocumentTrackingPanel;
