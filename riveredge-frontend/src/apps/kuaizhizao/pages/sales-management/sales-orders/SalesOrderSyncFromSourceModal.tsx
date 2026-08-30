import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../../../components/sync-from-source-modal/types';
import { createSalesOrderSyncConfig } from './salesOrderSyncConfig';

export interface SalesOrderSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const SalesOrderSyncFromSourceModal: React.FC<SalesOrderSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createSalesOrderSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default SalesOrderSyncFromSourceModal;
