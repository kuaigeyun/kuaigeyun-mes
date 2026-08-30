import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';
import { createCustomerSyncConfig } from '../customerSyncConfig';

export interface CustomerSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const CustomerSyncFromSourceModal: React.FC<CustomerSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createCustomerSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default CustomerSyncFromSourceModal;
