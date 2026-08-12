/**
 * UniTable / Descriptions 全局自动挂链单元格（由列 dataIndex 约定驱动）。
 */

import React from 'react';
import { LinkedDocumentCode } from './LinkedDocumentCode';
import {
  resolveLinkedDocumentFromRecord,
  type LinkedCodeBinding,
} from '../../apps/kuaizhizao/utils/linkedDocumentAutoLink';

export function LinkedDocumentAutoCell({
  binding,
  record,
  emptyText = '-',
  ellipsis = true,
}: {
  binding: LinkedCodeBinding;
  record: Record<string, unknown> | null | undefined;
  emptyText?: string;
  /** 与 UniTable 列 ellipsis 对齐；false 时完整展示单号 */
  ellipsis?: boolean;
}) {
  const resolved = resolveLinkedDocumentFromRecord(binding, record);
  if (!resolved) {
    const code = String(record?.[binding.codeField] ?? '').trim();
    return <>{code || emptyText}</>;
  }
  return (
    <LinkedDocumentCode
      documentType={resolved.documentType}
      documentId={resolved.documentId}
      code={resolved.code}
      emptyText={emptyText}
      ellipsis={ellipsis}
    />
  );
}
