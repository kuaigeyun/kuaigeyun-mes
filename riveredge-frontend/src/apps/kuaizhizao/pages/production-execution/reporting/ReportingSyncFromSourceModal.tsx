import React, { useMemo } from 'react';
import SyncFromSourceModal from '../../../../../components/sync-from-source-modal';
import type { SyncFromSourceResult } from '../../../../../components/sync-from-source-modal/types';
import { createReportingSyncConfig } from './reportingSyncConfig';

export interface ReportingSyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (result: SyncFromSourceResult) => void;
  contentOnly?: boolean;
}

export const ReportingSyncFromSourceModal: React.FC<ReportingSyncFromSourceModalProps> = (props) => {
  const config = useMemo(() => createReportingSyncConfig(), []);
  return <SyncFromSourceModal {...props} config={config} />;
};

export default ReportingSyncFromSourceModal;
