/**
 * 组织应用中心权限抽屉（平台）— UniDetail 壳
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Descriptions, Space, Switch, Typography } from 'antd';
import { DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail } from '../../../../components/uni-detail';
import {
  getTenantApplicationCenterPermissions,
  updateTenantApplicationCenterPermissions,
  type ApplicationCenterPermissionsPayload,
  type ApplicationCenterPermissionsResponse,
  type Tenant,
} from '../../../../services/tenant';
import { getApiErrorMessage } from '../../../../utils/errorHandler';

type CategoryKey = keyof ApplicationCenterPermissionsPayload;

const CATEGORY_KEYS: CategoryKey[] = ['basic', 'industry', 'pro', 'dedicated'];

const EMPTY_DRAFT: ApplicationCenterPermissionsPayload = {
  basic: { allow_self_service_toggle: false },
  pro: { allow_self_service_toggle: false },
  industry: { allow_self_service_toggle: false },
  dedicated: { allow_self_service_toggle: false },
};

function previewCanSelfServiceToggle(
  key: CategoryKey,
  orgAllowed: boolean,
  allowProApps: boolean,
): boolean {
  if (!orgAllowed) return false;
  if (key === 'pro') return allowProApps;
  return true;
}

export interface TenantApplicationCenterPermissionsDrawerProps {
  tenant: Tenant | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TenantApplicationCenterPermissionsDrawer({
  tenant,
  open,
  onClose,
  onSaved,
}: TenantApplicationCenterPermissionsDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permData, setPermData] = useState<ApplicationCenterPermissionsResponse | null>(null);
  const [draft, setDraft] = useState<ApplicationCenterPermissionsPayload | null>(null);

  const categoryLabels = useMemo(
    () =>
      ({
        basic: t('pages.system.applications.categoryBasic'),
        pro: t('pages.system.applications.categoryPro'),
        industry: t('pages.system.applications.categoryIndustry'),
        dedicated: t('pages.system.applications.categoryDedicated'),
      }) as Record<CategoryKey, string>,
    [t],
  );

  const allowProApps = Boolean(permData?.package?.allow_pro_apps);

  const loadPermissions = useCallback(async (tenantId: number) => {
    setLoading(true);
    setPermData(null);
    setDraft(null);
    try {
      const res = await getTenantApplicationCenterPermissions(tenantId);
      setPermData(res);
      setDraft(res.category_permissions);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('common.loadFailed')));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [message, onClose, t]);

  React.useEffect(() => {
    if (open && tenant?.id) {
      void loadPermissions(tenant.id);
    }
    if (!open) {
      setPermData(null);
      setDraft(null);
    }
  }, [loadPermissions, open, tenant?.id]);

  const handleSave = async () => {
    if (!tenant || !draft) return;
    setSaving(true);
    try {
      const res = await updateTenantApplicationCenterPermissions(tenant.id, draft);
      setPermData(res);
      setDraft(res.category_permissions);
      message.success(t('common.saveSuccess'));
      onSaved?.();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('common.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const categoryPanel = (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {CATEGORY_KEYS.map((key) => {
        const orgAllowed = draft?.[key]?.allow_self_service_toggle ?? false;
        const canToggle = previewCanSelfServiceToggle(key, orgAllowed, allowProApps);
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 0',
              borderBottom: '1px solid var(--ant-color-border-secondary)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text strong>{categoryLabels[key]}</Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {t(`pages.infra.tenantApplicationCenterPermissions.categoryDesc.${key}`)}
                </Typography.Text>
              </div>
              {key === 'pro' && orgAllowed && !allowProApps && (
                <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {t('pages.infra.tenantApplicationCenterPermissions.blockedByPackagePro')}
                </Typography.Text>
              )}
              {key === 'industry' && !allowProApps && (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {t('pages.infra.tenantApplicationCenterPermissions.industryProNote')}
                </Typography.Text>
              )}
              {draft && (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {t('pages.infra.tenantApplicationCenterPermissions.effectiveLabel', {
                    value: canToggle ? t('common.enabled') : t('common.disabled'),
                  })}
                </Typography.Text>
              )}
            </div>
            <Switch
              checked={orgAllowed}
              checkedChildren={t('common.enabled')}
              unCheckedChildren={t('common.disabled')}
              disabled={loading}
              onChange={(checked) => {
                setDraft((prev) => ({
                  ...(prev ?? EMPTY_DRAFT),
                  [key]: { allow_self_service_toggle: checked },
                }));
              }}
            />
          </div>
        );
      })}
    </Space>
  );

  return (
    <UniDetail
      title={
        tenant
          ? t('pages.infra.tenantApplicationCenterPermissions.drawerTitle', { name: tenant.name })
          : t('pages.infra.tenantApplicationCenterPermissions.title')
      }
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      loading={loading}
      extra={
        <Button type="primary" loading={saving} disabled={!draft || loading} onClick={() => void handleSave()}>
          {t('common.save')}
        </Button>
      }
      banner={
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('pages.infra.tenantApplicationCenterPermissions.hint')}
        </Typography.Paragraph>
      }
      basicTitle={t('pages.infra.tenantApplicationCenterPermissions.packageHintTitle')}
      basic={
        permData ? (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label={t('pages.infra.tenantApplicationCenterPermissions.allowProApps')}>
              {permData.package.allow_pro_apps ? t('common.yes') : t('common.no')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.infra.tenantApplicationCenterPermissions.allowedAppCodes')}>
              {(permData.package.allowed_app_codes?.length ?? 0) > 0
                ? permData.package.allowed_app_codes.join(', ')
                : t('pages.infra.tenantApplicationCenterPermissions.noAppWhitelist')}
            </Descriptions.Item>
          </Descriptions>
        ) : null
      }
      supplementaryTitle={t('pages.infra.tenantApplicationCenterPermissions.categorySectionTitle')}
      supplementary={draft ? categoryPanel : null}
    />
  );
}
