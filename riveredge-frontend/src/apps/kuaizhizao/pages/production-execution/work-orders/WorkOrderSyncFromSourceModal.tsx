import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../../../components/sync-from-source-modal/types';
import { createWorkOrderSyncConfig } from './workOrderSyncConfig';

export interface WorkOrderSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const WorkOrderSyncFromSourceModal: React.FC<WorkOrderSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createWorkOrderSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default WorkOrderSyncFromSourceModal;
