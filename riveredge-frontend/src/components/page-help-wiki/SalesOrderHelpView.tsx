import React from 'react';
import RichDocumentHelpView from './RichDocumentHelpView';
import { DOCUMENT_LIST_HELP_KEYS } from './documentListHelpRegistry';

/** @deprecated 请改用 RichDocumentHelpView */
const SalesOrderHelpView: React.FC = () => (
  <RichDocumentHelpView docKey={DOCUMENT_LIST_HELP_KEYS.salesOrder} />
);

export default SalesOrderHelpView;
