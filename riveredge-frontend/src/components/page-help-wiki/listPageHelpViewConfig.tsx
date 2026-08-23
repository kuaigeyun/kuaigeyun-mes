import React from 'react';
import RichListPageHelpView from './RichListPageHelpView';
import { isRichListPageHelpKey, type RichListPageHelpKey } from './richListPageHelpRegistry';

export function buildListPageHelpViewConfig(pageKey: RichListPageHelpKey) {
  if (!isRichListPageHelpKey(pageKey)) {
    return undefined;
  }
  return {
    content: <RichListPageHelpView pageKey={pageKey} />,
  };
}
