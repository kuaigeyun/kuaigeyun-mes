/**
 * 全局「来源单号」：source_type + source_id + source_code → 当前页嵌套原版详情抽屉。
 * 各列表/详情应优先用本组件，勿再 navigate 到目标列表。
 */

import React from 'react';
import { LinkedDocumentCode } from './LinkedDocumentCode';
import { normalizeLinkedDocumentType } from '../../apps/kuaizhizao/utils/linkedDocumentDetail';

export type SourceDocumentCodeProps = {
  sourceType?: string | null;
  sourceId?: number | null;
  sourceCode?: string | null;
  emptyText?: string;
  copyable?: boolean;
  ellipsis?: boolean;
  style?: React.CSSProperties;
};

export function SourceDocumentCode({
  sourceType,
  sourceId,
  sourceCode,
  emptyText = '-',
  copyable = true,
  ellipsis = true,
  style,
}: SourceDocumentCodeProps) {
  const documentType = normalizeLinkedDocumentType(sourceType);
  return (
    <LinkedDocumentCode
      documentType={documentType}
      documentId={sourceId}
      code={sourceCode}
      emptyText={emptyText}
      copyable={copyable}
      ellipsis={ellipsis}
      style={style}
    />
  );
}
