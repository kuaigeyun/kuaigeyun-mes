import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../../../components/sync-from-source-modal/types';
import { createPurchaseOrderSyncConfig } from './purchaseOrderSyncConfig';

export interface PurchaseOrderSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const PurchaseOrderSyncFromSourceModal: React.FC<PurchaseOrderSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createPurchaseOrderSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default PurchaseOrderSyncFromSourceModal;
