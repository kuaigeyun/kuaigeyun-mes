import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getToken, setToken, setTenantId } from '../../../utils/auth';
import { applySessionUserAfterLogin } from '../../../utils/restoredUser';
import {
  getWecomAuthorizeUrl,
  wecomLoginCallback,
  tenantNameFromLoginResponse,
} from '../../../services/publicAuth';
import {
  consumeWecomOAuthState,
  decodeWecomOAuthState,
  isWeComBrowser,
  saveWecomOAuthState,
  stripOAuthQueryFromUrl,
} from '../../../utils/wecomAuth';

interface MobileAuthGuardProps {
  children: React.ReactNode;
}

const WECOM_TENANT_KEY = 'wecom_mobile_tenant_id';

/** 企微 H5：OAuth 静默登录 + JWT 守卫 */
export const MobileAuthGuard: React.FC<MobileAuthGuardProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [ready, setReady] = useState(() => Boolean(getToken()));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (getToken()) {
        if (!cancelled) setReady(true);
        return;
      }

      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const tenantFromQuery = params.get('tenant_id');

      if (tenantFromQuery) {
        sessionStorage.setItem(WECOM_TENANT_KEY, tenantFromQuery);
      }

      if (code) {
        try {
          const tenantIdFromState = state ? decodeWecomOAuthState(state)?.tenant_id : undefined;
          const tenantIdRaw = tenantIdFromState ?? sessionStorage.getItem(WECOM_TENANT_KEY);
          const tenantId = tenantIdRaw ? Number(tenantIdRaw) : undefined;
          if (state && !consumeWecomOAuthState(state)) {
            throw new Error(t('pages.login.wecomVerifyFailed'));
          }
          const response = await wecomLoginCallback({
            code,
            state: state ?? undefined,
            tenant_id: tenantId,
          });
          setToken(response.access_token);
          if (response.default_tenant_id) {
            setTenantId(response.default_tenant_id);
          } else if (tenantId) {
            setTenantId(tenantId);
          }
          const tenantName = tenantNameFromLoginResponse(response);
          applySessionUserAfterLogin({
            id: response.user.id,
            uuid: response.user.uuid,
            username: response.user.username,
            email: response.user.email,
            full_name: response.user.full_name,
            is_infra_admin: response.user.is_infra_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            permissions: response.user.permissions || [],
            permission_version: response.user.permission_version || 1,
            department: response.user.department,
            position: response.user.position,
            roles: response.user.roles || [],
            tenant_id: response.default_tenant_id ?? tenantId,
            tenant_name: tenantName,
            user_type: 'user',
          });
          stripOAuthQueryFromUrl();
          if (!cancelled) setReady(true);
          return;
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : t('pages.login.wecomLoginFailed');
          message.error(errMsg);
          stripOAuthQueryFromUrl();
          if (!cancelled) setFailed(true);
          return;
        }
      }

      const tenantIdRaw = sessionStorage.getItem(WECOM_TENANT_KEY) ?? tenantFromQuery;
      const tenantId = tenantIdRaw ? Number(tenantIdRaw) : NaN;
      if (isWeComBrowser() && Number.isFinite(tenantId) && tenantId > 0) {
        try {
          const redirectPath = location.pathname;
          const redirectUri = `${window.location.origin}${redirectPath}?tenant_id=${tenantId}`;
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
          if (!cancelled) setFailed(true);
          return;
        }
      }

      if (!cancelled) setFailed(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, t]);

  if (ready && getToken()) {
    return <>{children}</>;
  }

  if (failed || !getToken()) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin size="large" />
    </div>
  );
};

export const MobileAuthLoading: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin size="large" />
  </div>
);
