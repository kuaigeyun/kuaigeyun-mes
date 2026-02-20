/**
 * 单据跟踪中心面板
 * 展示单据操作记录时间线及上下游关联
 */

import React, { useEffect, useState } from 'react';
import { Timeline, Empty, Spin, Card } from 'antd';
import { SwapOutlined, CheckCircleOutlined, ArrowRightOutlined, LinkOutlined } from '@ant-design/icons';
import type {
  DocumentTrackingResponse,
  DocumentTrackingTimelineItem,
  DocumentTrackingRelation,
} from '../../services/documentTracking';
import { getDocumentTracking } from '../../services/documentTracking';

interface DocumentTrackingPanelProps {
  documentType: string;
  documentId: number;
  onDocumentClick?: (type: string, id: number) => void;
}

const typeLabel: Record<string, string> = {
  state_transition: '状态变更',
  approve: '审核',
  push: '下推',
  pull: '上拉',
  from: '关联',
};

export const DocumentTrackingPanel: React.FC<DocumentTrackingPanelProps> = ({
  documentType,
  documentId,
  onDocumentClick,
}) => {
  const [data, setData] = useState<DocumentTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError(null);
    getDocumentTracking(documentType, documentId)
      .then(setData)
      .catch((e) => setError(e?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [documentType, documentId]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin tip="加载操作记录..." />
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
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const renderTimelineItem = (item: DocumentTrackingTimelineItem) => {
    const icon =
      item.type === 'state_transition' ? (
        <SwapOutlined />
      ) : item.type === 'approve' ? (
        <CheckCircleOutlined />
      ) : item.type === 'push' || item.type === 'from' ? (
        <ArrowRightOutlined />
      ) : (
        <LinkOutlined />
      );
    const label = typeLabel[item.type] || item.type;
    const time = item.at ? new Date(item.at).toLocaleString('zh-CN') : '';
    return {
      dot: icon,
      children: (
        <div>
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ color: '#666', fontSize: 12 }}>{item.detail}</div>
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
    <div style={{ padding: '0 16px 16px' }}>
      {(data.relations.upstream.length > 0 || data.relations.downstream.length > 0) && (
        <Card size="small" title="上下游关联" style={{ marginBottom: 16 }}>
          {data.relations.upstream.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>上游</div>
              {data.relations.upstream.map((r) => renderRelation(r, 'up'))}
            </div>
          )}
          {data.relations.downstream.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>下游</div>
              {data.relations.downstream.map((r) => renderRelation(r, 'down'))}
            </div>
          )}
        </Card>
      )}

      <Card size="small" title="操作记录">
        {data.timeline.length === 0 ? (
          <Empty description="暂无操作记录" />
        ) : (
          <Timeline items={data.timeline.map(renderTimelineItem)} />
        )}
      </Card>
    </div>
  );
};

export default DocumentTrackingPanel;
