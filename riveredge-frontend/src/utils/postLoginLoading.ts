const POST_LOGIN_LOADING_KEY = 'riveredge.post_login_loading';
const POST_LOGIN_LOADING_MAX_MS = 15000;

let postLoginLoadingSafetyTimer: number | undefined;

/** 登录成功、即将跳转首页前标记（仅首屏 lazy 路由使用全屏 Lottie） */
export function markPostLoginLoading(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(POST_LOGIN_LOADING_KEY, '1');
  if (typeof window === 'undefined') return;
  if (postLoginLoadingSafetyTimer != null) {
    window.clearTimeout(postLoginLoadingSafetyTimer);
  }
  postLoginLoadingSafetyTimer = window.setTimeout(() => {
    clearPostLoginLoading();
    postLoginLoadingSafetyTimer = undefined;
  }, POST_LOGIN_LOADING_MAX_MS);
}

export function isPostLoginLoading(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(POST_LOGIN_LOADING_KEY) === '1';
}

export function clearPostLoginLoading(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(POST_LOGIN_LOADING_KEY);
  if (typeof window !== 'undefined' && postLoginLoadingSafetyTimer != null) {
    window.clearTimeout(postLoginLoadingSafetyTimer);
    postLoginLoadingSafetyTimer = undefined;
  }
}
