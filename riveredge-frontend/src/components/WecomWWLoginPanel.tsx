import {
  createWWLoginPanel,
  WWLoginLangType,
  WWLoginPanelSizeType,
  WWLoginRedirectType,
  WWLoginType,
} from '@wecom/jssdk';
import { Spin } from 'antd';
import { useLayoutEffect, useRef, useState } from 'react';

export interface WecomWWLoginPanelProps {
  corpId: string;
  agentId: number;
  redirectUri: string;
  state: string;
  lang: WWLoginLangType;
  onSuccess: (code: string) => void;
  onFail: (err: unknown) => void;
  onInitError: (err: unknown) => void;
}

/**
 * 企业微信 PC 端 WWLogin 扫码面板（iframe）。
 * 须在 Modal 子树挂载后再渲染，由 useLayoutEffect 同步初始化。
 */
export function WecomWWLoginPanel({
  corpId,
  agentId,
  redirectUri,
  state,
  lang,
  onSuccess,
  onFail,
  onInitError,
}: WecomWWLoginPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onFailRef = useRef(onFail);
  const onInitErrorRef = useRef(onInitError);
  const [initializing, setInitializing] = useState(true);

  onSuccessRef.current = onSuccess;
  onFailRef.current = onFail;
  onInitErrorRef.current = onInitError;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      onInitErrorRef.current(new Error('WeCom WWLogin container is not mounted'));
      setInitializing(false);
      return;
    }

    el.innerHTML = '';
    setInitializing(true);

    let panel: { unmount: () => void } | null = null;
    try {
      panel = createWWLoginPanel({
        el,
        params: {
          login_type: WWLoginType.corpApp,
          appid: corpId,
          agentid: String(agentId),
          redirect_uri: redirectUri,
          state,
          redirect_type: WWLoginRedirectType.callback,
          panel_size: WWLoginPanelSizeType.small,
          lang,
        },
        onLoginSuccess: ({ code }) => {
          onSuccessRef.current(code);
        },
        onLoginFail: (err) => {
          onFailRef.current(err);
        },
      });
      setInitializing(false);
    } catch (error) {
      onInitErrorRef.current(error);
      setInitializing(false);
    }

    return () => {
      try {
        panel?.unmount();
      } catch {
        // 关闭弹窗时忽略清理异常。
      }
    };
  }, [agentId, corpId, lang, redirectUri, state]);

  return (
    <div style={{ position: 'relative', minHeight: 380 }}>
      {initializing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Spin />
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          minHeight: 380,
        }}
      />
    </div>
  );
}
