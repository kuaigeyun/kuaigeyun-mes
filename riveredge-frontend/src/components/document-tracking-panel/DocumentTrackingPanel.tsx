/**
 * 单据跟踪中心面板：全链路关联图 + 操作时间线
 */

import React from 'react';
import { Card, Empty, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { DocumentTrackingRelationsTabsBody } from './DocumentTrackingRelationsTabsBody';
import { DocumentTrackingTimelineBody } from './DocumentTrackingTimelineBody';
import { useDocumentTracking } from './useDocumentTracking';

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
