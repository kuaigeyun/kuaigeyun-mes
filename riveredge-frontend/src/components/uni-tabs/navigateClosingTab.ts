import { useCallback } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';

/** 与 UniTabs 激活 key 一致：pathname + search */
export function uniTabKey(pathname: string, search = ''): string {
  return pathname + (search || '');
}

/**
 * 离开当前标签并关闭它（保存 / 取消 / 加载失败回到列表）。
 * UniTabs 会剥离 closeTab，其余 state 保留。
 */
export function navigateClosingTab(
  navigate: NavigateFunction,
  toPath: string,
  tabKey: string,
  extraState?: Record<string, unknown>,
): void {
  navigate(toPath, {
    state: {
      closeTab: tabKey,
      ...(extraState ?? {}),
    },
  });
}

/** 独立新建/编辑/详情标签：返回列表时关闭本标签 */
export function useLeaveFormTab(listPath: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    navigateClosingTab(navigate, listPath, uniTabKey(location.pathname, location.search));
  }, [navigate, listPath, location.pathname, location.search]);
}
