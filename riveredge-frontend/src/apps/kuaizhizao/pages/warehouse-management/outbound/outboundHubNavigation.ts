import type { NavigateFunction } from 'react-router-dom';
import { OUTBOUND_LIST_PATH } from './outboundPaths';
import type { OutboundPullEntryNavigationState } from './outboundPullEntryTypes';

export function buildOutboundHubAfterBatchPickingNavState(options?: {
  toastMessage?: string;
}): OutboundPullEntryNavigationState {
  return {
    outboundHubEntry: {
      outboundTypeFilter: 'production_picking',
      toastMessage: options?.toastMessage,
    },
  };
}

export function navigateToOutboundHubAfterBatchPicking(
  navigate: NavigateFunction,
  options?: { toastMessage?: string },
) {
  navigate(OUTBOUND_LIST_PATH, {
    state: buildOutboundHubAfterBatchPickingNavState(options),
  });
}
