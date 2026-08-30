import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';
import { createWarehouseSyncConfig } from '../warehouseSyncConfig';

export interface WarehouseSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const WarehouseSyncFromSourceModal: React.FC<WarehouseSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createWarehouseSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default WarehouseSyncFromSourceModal;
