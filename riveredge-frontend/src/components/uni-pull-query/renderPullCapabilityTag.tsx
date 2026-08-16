import React from 'react';
import { MarkerTag } from '../../constants/statusBadges';

/**
 * 取单「可取单 / 不可取单」徽章（非流程状态，用 MarkerTag）。
 */
export function renderPullCapabilityTag(
  allowed: boolean,
  allowedLabel: React.ReactNode,
  blockedLabel: React.ReactNode,
): React.ReactNode {
  if (allowed) {
    return <MarkerTag color="success">{allowedLabel}</MarkerTag>;
  }
  return <MarkerTag color="warning">{blockedLabel}</MarkerTag>;
}
