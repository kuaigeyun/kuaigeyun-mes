import React from 'react';
import RichModuleCenterHelpView from './RichModuleCenterHelpView';
import {
  isRichModuleCenterHelpKey,
  type RichModuleCenterHelpKey,
} from './richModuleCenterHelpRegistry';

export function buildModuleCenterHelpViewConfig(moduleKey: RichModuleCenterHelpKey) {
  if (!isRichModuleCenterHelpKey(moduleKey)) {
    return undefined;
  }
  return {
    content: <RichModuleCenterHelpView moduleKey={moduleKey} />,
  };
}
