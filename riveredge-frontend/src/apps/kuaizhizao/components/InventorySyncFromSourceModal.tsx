import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';
import { createInventorySyncConfig } from '../inventorySyncConfig';

export interface InventorySyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
  /** 内嵌 SyncPushHub 时不渲染独立 Modal 壳 */
  contentOnly?: boolean;
}

export const InventorySyncFromSourceModal: React.FC<InventorySyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createInventorySyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default InventorySyncFromSourceModal;