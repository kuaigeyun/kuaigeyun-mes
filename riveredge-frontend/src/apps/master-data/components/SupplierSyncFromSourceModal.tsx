import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';
import { createSupplierSyncConfig } from '../supplierSyncConfig';

export interface SupplierSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const SupplierSyncFromSourceModal: React.FC<SupplierSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createSupplierSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default SupplierSyncFromSourceModal;
