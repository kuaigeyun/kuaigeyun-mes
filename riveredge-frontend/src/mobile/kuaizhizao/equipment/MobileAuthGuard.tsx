import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getToken, getTenantId } from '../../../utils/auth';
import {
  getWecomAuthorizeUrl,
  wecomLoginCallback,
} from '../../../services/publicAuth';
import {
  buildWecomMobileOAuthRedirectUri,
  consumeWecomOAuthState,
  decodeWecomOAuthState,
  saveWecomOAuthState,
  shouldAutoWecomOAuth,
  stripOAuthQueryFromUrl,
} from '../../../utils/wecomAuth';
import {
  applyWecomMobileLogin,
  resolveWecomMobileTenantId,
} from './wecomMobileSession';

interface MobileAuthGuardProps {
  children: React.ReactNode;
}

/** 企微 H5：OAuth 静默登录 + JWT 守卫 */
export const MobileAuthGuard: React.FC<MobileAuthGuardProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [ready, setReady] = useState(() => Boolean(getToken()));
  const [failed, setFailed] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(() => !getToken());

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (getToken()) {
        if (!cancelled) {
          setReady(true);
          setBootstrapping(false);
        }
        return;
      }

      setBootstrapping(true);
      setFailed(false);

      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const tenantId = resolveWecomMobileTenantId(location.search, getTenantId);

      if (tenantId) {
        sessionStorage.setItem('wecom_mobile_tenant_id', String(tenantId));
      }

      if (code) {
        try {
          const tenantIdFromState = state ? decodeWecomOAuthState(state)?.tenant_id : undefined;
          const callbackTenantId = tenantIdFromState ?? tenantId ?? undefined;
          if (state && !consumeWecomOAuthState(state)) {
            throw new Error(t('pages.login.wecomVerifyFailed'));
          }
          const response = await wecomLoginCallback({
            code,
            state: state ?? undefined,
            tenant_id: callbackTenantId,
          });
          await applyWecomMobileLogin(response, callbackTenantId);
          stripOAuthQueryFromUrl();
          if (!cancelled) {
            setReady(true);
            setBootstrapping(false);
          }
          return;
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : t('pages.login.wecomLoginFailed');
          message.error(errMsg);
          stripOAuthQueryFromUrl();
          if (!cancelled) {
            setFailed(true);
            setBootstrapping(false);
          }
          return;
        }
      }

      if (tenantId && shouldAutoWecomOAuth(location.pathname)) {
        try {
          const redirectPath = location.pathname;
          const redirectUri = buildWecomMobileOAuthRedirectUri(redirectPath);
          const { authorize_url, state: oauthState } = await getWecomAuthorizeUrl({
            redirect_uri: redirectUri,
            tenant_id: tenantId,
            redirect: redirectPath,
          });
          saveWecomOAuthState(oauthState);
          window.location.href = authorize_url;
          return;
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : t('pages.login.wecomRedirectFailed');
          message.error(errMsg);
          if (!cancelled) {
            setFailed(true);
            setBootstrapping(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setFailed(true);
        setBootstrapping(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, t]);

  if (ready && getToken()) {
    return <>{children}</>;
  }

  if (failed) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (bootstrapping) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate to={`/login?redirect=${redirect}`} replace />;
};

export const MobileAuthLoading: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin size="large" />
  </div>
);
