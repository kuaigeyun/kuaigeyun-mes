/**
 * uni-detail 协作区：内嵌全链路图 + 节点点击后的关联单据简览（替代抽屉外左侧浮层）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Space, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  DocumentTrackingRelationsTabsBody,
  TraceLinkedDocumentBrief,
} from '../document-tracking-panel';

export interface TraceBriefDocument {
  document_type: string;
  document_id: number;
}

export const DETAIL_DRAWER_INLINE_FULL_CHAIN_HEIGHT = 360;

export interface DetailDrawerInlineFullChainProps {
  documentType: string;
  documentId: number;
  /** 抽屉关闭时清空节点简览 */
  active?: boolean;
  /** 再次点击当前单据节点时收起简览 */
  selfDocumentId?: number;
  height?: number;
  renderBriefActions?: (doc: TraceBriefDocument) => ReactNode;
}

export const DetailDrawerInlineFullChain: React.FC<DetailDrawerInlineFullChainProps> = ({
  documentType,
  documentId,
  active = true,
  selfDocumentId,
  height = DETAIL_DRAWER_INLINE_FULL_CHAIN_HEIGHT,
  renderBriefActions,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [briefDoc, setBriefDoc] = useState<TraceBriefDocument | null>(null);

  useEffect(() => {
    if (!active) setBriefDoc(null);
  }, [active]);

  useEffect(() => {
    setBriefDoc(null);
  }, [documentType, documentId]);

  const onDocumentClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (selfDocumentId != null && id === selfDocumentId && type === documentType) {
        setBriefDoc(null);
        return;
      }
      setBriefDoc({ document_type: type, document_id: id });
    },
    [documentType, selfDocumentId]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div
        style={{
          width: '100%',
          height,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <DocumentTrackingRelationsTabsBody
          documentType={documentType}
          documentId={documentId}
          onDocumentClick={onDocumentClick}
          compact
          hideInlineRefresh
        />
      </div>
      {briefDoc ? (
        <div
          style={{
            border: '1px solid var(--ant-color-border-secondary)',
            borderRadius: token.borderRadiusLG,
            padding: 12,
            background: 'var(--ant-color-bg-container)',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 8,
              color: 'var(--ant-color-text)',
            }}
          >
            {t('components.documentTrackingPanel.traceBriefTitle')}
          </div>
          <TraceLinkedDocumentBrief
            documentType={briefDoc.document_type}
            documentId={briefDoc.document_id}
            compactChrome
          />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Space wrap>
              <Button size="small" onClick={() => setBriefDoc(null)}>
                {t('components.documentTrackingPanel.traceBriefDismiss')}
              </Button>
              {renderBriefActions?.(briefDoc)}
            </Space>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DetailDrawerInlineFullChain;
