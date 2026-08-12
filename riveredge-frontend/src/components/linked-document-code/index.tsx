/**
 * 关联单据单号：点击后在当前页打开嵌套详情抽屉（不跳转列表）。
 */

import React, { useCallback } from 'react';
import { Typography } from 'antd';
import { canOpenLinkedDocumentDetail } from '../../apps/kuaizhizao/utils/linkedDocumentDetail';
import { useOptionalLinkedDocumentDetail } from '../linked-document-detail';

export type LinkedDocumentCodeProps = {
  documentType: string;
  documentId?: number | null;
  code?: string | null;
  emptyText?: string;
  copyable?: boolean;
  ellipsis?: boolean;
  style?: React.CSSProperties;
};

export function LinkedDocumentCode({
  documentType,
  documentId,
  code,
  emptyText = '-',
  copyable = true,
  ellipsis = true,
  style,
}: LinkedDocumentCodeProps) {
  const linked = useOptionalLinkedDocumentDetail();
  const text = String(code ?? '').trim();
  const id = documentId != null ? Number(documentId) : NaN;
  const canOpen =
    Boolean(text) &&
    Number.isFinite(id) &&
    id > 0 &&
    canOpenLinkedDocumentDetail(documentType) &&
    Boolean(linked);

  const onOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canOpen || !linked) return;
      linked.openLinkedDocumentDetail(documentType, id);
    },
    [canOpen, documentType, id, linked],
  );

  if (!text) {
    return <span style={style}>{emptyText}</span>;
  }

  if (!canOpen) {
    return (
      <Typography.Text
        copyable={copyable ? { text } : false}
        ellipsis={ellipsis ? { tooltip: text } : false}
        style={style}
      >
        {text}
      </Typography.Text>
    );
  }

  return (
    <Typography.Text
      copyable={copyable ? { text } : false}
      ellipsis={ellipsis ? { tooltip: text } : false}
      style={{ margin: 0, ...style }}
    >
      <Typography.Link onClick={onOpen} style={{ fontSize: 'inherit' }}>
        {text}
      </Typography.Link>
    </Typography.Text>
  );
}
