import type { NavigateFunction } from 'react-router-dom';

/** 与 UniTabs 激活 key 一致：pathname + search */
export function pullEntryTabKey(pathname: string, search = ''): string {
  return pathname + (search || '');
}

/**
 * 离开加载录入页并关闭其标签。extraState 可带 inboundDirectConfirm / outboundDirectConfirm；
 * UniTabs 会剥离 closeTab 并保留其余 state。
 */
export function navigateLeavingPullEntry(
  navigate: NavigateFunction,
  listPath: string,
  tabKey: string,
  extraState?: Record<string, unknown>,
): void {
  navigate(listPath, {
    state: {
      closeTab: tabKey,
      ...(extraState ?? {}),
    },
  });
}
