/**
 * 程序式导航工具
 *
 * 供非组件代码（如 QuickNavigation）使用 React Router 的 navigate。
 * 需在 App 根组件内通过 setNavigateRef 注入 useNavigate 返回值。
 */

type NavigateFn = (to: string | number, options?: { replace?: boolean }) => void;

let navigateRef: NavigateFn | null = null;

export function setNavigateRef(navigate: NavigateFn): void {
  navigateRef = navigate;
}

export function getNavigate(): NavigateFn | null {
  return navigateRef;
}

export function navigateTo(path: string, options?: { replace?: boolean }): void {
  if (navigateRef) {
    navigateRef(path, options);
  } else {
    // 降级：Router 尚未挂载时使用原生导航
    window.location.href = path.startsWith('/') ? path : `/${path}`;
  }
}
