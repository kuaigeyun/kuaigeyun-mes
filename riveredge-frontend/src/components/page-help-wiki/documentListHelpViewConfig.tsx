import React from 'react';
import RichDocumentHelpView from './RichDocumentHelpView';
import type { DocumentListHelpKey } from './documentListHelpRegistry';
import { isRichDocumentHelpKey } from './richDocumentHelpRegistry';

/** UniTable helpViewConfig 统一接入：已编写富文本的单据走 RichDocumentHelpView */
export function buildDocumentListHelpViewConfig(docKey: DocumentListHelpKey) {
  if (!isRichDocumentHelpKey(docKey)) {
    return undefined;
  }
  return {
    content: <RichDocumentHelpView docKey={docKey} />,
  };
}
