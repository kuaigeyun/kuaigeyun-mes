import React, { useMemo } from 'react';

import SyncFromSourceModal from '../../../components/sync-from-source-modal';

import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';

import { createUnitSyncConfig } from '../unitSyncConfig';



export interface UnitSyncFromSourceModalProps {

  open: boolean;

  onClose: () => void;

  onComplete?: (result: SyncFromSourceResult) => void;

  zIndex?: number;

}



export const UnitSyncFromSourceModal: React.FC<UnitSyncFromSourceModalProps> = (props) => {

  const config = useMemo(() => createUnitSyncConfig(), []);

  return <SyncFromSourceModal {...props} config={config} />;

};



export default UnitSyncFromSourceModal;

