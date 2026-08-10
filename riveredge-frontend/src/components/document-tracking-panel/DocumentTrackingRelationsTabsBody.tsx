/**
 * 全链路关联图入口。
 * FlowGraph / @ant-design/graphs 仅在本组件挂载时异步加载，避免单据列表首屏拉取 G6。
 */

import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';

const LazyDocumentTraceFlowGraph = lazy(() =>
  import('./DocumentTraceFlowGraph').then((m) => ({ default: m.DocumentTraceFlowGraph })),
);

export const DocumentTrackingRelationsTabsBody: React.FC<{
  documentType: string;
  documentId: number;
  refreshKey?: number;
  onDocumentClick?: (type: string, id: number) => void;
  compact?: boolean;
  hideInlineRefresh?: boolean;
  onTraceLoadingChange?: (loading: boolean) => void;
}> = ({
  documentType,
  documentId,
  refreshKey,
  onDocumentClick,
  compact,
  hideInlineRefresh,
  onTraceLoadingChange,
}) => (
  <Suspense
    fallback={
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    }
  >
    <LazyDocumentTraceFlowGraph
      documentType={documentType}
      documentId={documentId}
      enabled
      refreshKey={refreshKey}
      onDocumentClick={onDocumentClick}
      compact={compact}
      hideInlineRefresh={hideInlineRefresh}
      onTraceLoadingChange={onTraceLoadingChange}
    />
  </Suspense>
);
