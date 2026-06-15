import type { OutboundIssueType } from './outboundHubTypes';

export type OutboundPullDirectConfirmTarget = {
  id: number;
  outbound_type: OutboundIssueType;
};

export type OutboundPullEntryNavigationState = {
  outboundDirectConfirm?: OutboundPullDirectConfirmTarget;
};
