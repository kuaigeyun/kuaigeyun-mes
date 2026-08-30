import React, { useMemo } from 'react';

import SyncFromSourceModal from '../../../components/sync-from-source-modal';

import type { SyncFromSourceResult } from '../../../components/sync-from-source-modal/types';

import { createMaterialGroupSyncConfig } from '../materialGroupSyncConfig';



export interface MaterialGroupSyncFromSourceModalProps {

  open: boolean;

  onClose: () => void;

  onComplete?: (result: SyncFromSourceResult) => void;

  zIndex?: number;

}



export const MaterialGroupSyncFromSourceModal: React.FC<MaterialGroupSyncFromSourceModalProps> = (

  props,

) => {

  const config = useMemo(() => createMaterialGroupSyncConfig(), []);

  return <SyncFromSourceModal {...props} config={config} />;

};



export default MaterialGroupSyncFromSourceModal;

