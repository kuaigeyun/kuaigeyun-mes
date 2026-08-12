/**
 * 关联单据单号：点击后在当前页打开嵌套详情抽屉（不跳转列表）。
 *
 * 禁止用 Typography.Text(ellipsis) 包裹 Typography.Link：antd 量宽会把链接字收成空，
 * 表格窄列里只剩复制图标（「单号完全折叠」）。
 */

import React, { useCallback, useMemo } from 'react';
import { Typography } from 'antd';
import {
  canOpenLinkedDocumentDetail,
  normalizeLinkedDocumentType,
} from '../../apps/kuaizhizao/utils/linkedDocumentDetail';
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

const codeTextStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'inherit',
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
  const normalizedType = useMemo(() => normalizeLinkedDocumentType(documentType), [documentType]);
  const canOpen =
    Boolean(text) &&
    Number.isFinite(id) &&
    id > 0 &&
    canOpenLinkedDocumentDetail(normalizedType) &&
    Boolean(linked);

  const onOpen = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      if (!canOpen || !linked) return;
      linked.openLinkedDocumentDetail(normalizedType, id);
    },
    [canOpen, normalizedType, id, linked],
  );

  if (!text) {
    return <span style={style}>{emptyText}</span>;
  }

  const wrapStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    minWidth: 0,
    verticalAlign: 'bottom',
    ...style,
  };

  const textNode = canOpen ? (
    <Typography.Link
      onClick={onOpen}
      title={ellipsis ? text : undefined}
      style={ellipsis ? codeTextStyle : { fontSize: 'inherit' }}
    >
      {text}
    </Typography.Link>
  ) : (
    <span title={ellipsis ? text : undefined} style={ellipsis ? codeTextStyle : undefined}>
      {text}
    </span>
  );

  return (
    <span style={wrapStyle}>
      {textNode}
      {copyable ? (
        <Typography.Text
          copyable={{ text, tooltips: true }}
          style={{ flex: '0 0 auto', margin: 0, lineHeight: 1 }}
        />
      ) : null}
    </span>
  );
}
