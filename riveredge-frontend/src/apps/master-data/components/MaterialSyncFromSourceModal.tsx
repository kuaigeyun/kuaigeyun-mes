import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';
import { createMaterialSyncConfig } from '../materialSyncConfig';

export interface MaterialSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const MaterialSyncFromSourceModal: React.FC<MaterialSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createMaterialSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default MaterialSyncFromSourceModal;
