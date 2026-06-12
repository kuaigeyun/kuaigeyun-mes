/**
 * 套餐表单项组件（仅渲染字段，不包含 submitter）
 */

import { ProFormText, ProFormDigit, ProFormSwitch, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { useQuery } from '@tanstack/react-query';
import { getApplicationList } from '../../../services/application';
import { getPackageConfigs } from '../../../services/tenant';
import { useTranslation } from 'react-i18next';

interface PackageFormProps {
  isEdit?: boolean;
}

export default function PackageForm({ isEdit = false }: PackageFormProps) {
  const { t } = useTranslation();
  const { data: packageConfigs = {} } = useQuery({
    queryKey: ['package-configs-options'],
    queryFn: async () => getPackageConfigs(),
  });
  const planOptions = Object.entries(packageConfigs)
    .map(([plan, config]) => ({
      label: config?.name || plan,
      value: plan,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const { data: applicationOptions = [], isLoading: appOptionsLoading } = useQuery({
    queryKey: ['package-app-options'],
    queryFn: async () => {
      const apps = await getApplicationList({ limit: 1000 });
      return (apps || [])
        .map((app) => ({
          label: `${app.name} (${app.code})`,
          value: app.code,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  return (
    <>
      <ProFormText
        name="name"
        label={t('pages.infra.package.name')}
        rules={[{ required: true, message: t('pages.infra.package.nameRequired') }]}
      />

      {!isEdit && (
        <SafeProFormSelect
          name="plan"
          label={t('pages.infra.package.plan')}
          options={planOptions}
          rules={[{ required: true, message: t('pages.infra.package.planRequired') }]}
        />
      )}

      <ProFormDigit
        name="max_users"
        label={t('pages.infra.package.maxUsers')}
        min={1}
        rules={[{ required: true, message: t('pages.infra.package.maxUsersRequired') }]}
      />

      <ProFormDigit
        name="max_storage_mb"
        label={t('pages.infra.package.maxStorage')}
        min={1}
        rules={[{ required: true, message: t('pages.infra.package.maxStorageRequired') }]}
      />

      <ProFormDigit
        name="max_branch_organizations"
        label={t('pages.infra.package.maxBranchOrganizations')}
        min={0}
        fieldProps={{ precision: 0 }}
        tooltip={t('pages.infra.package.maxBranchOrganizationsHelp')}
      />

      <ProFormSwitch
        name="allow_pro_apps"
        label={t('pages.infra.package.allowProApps')}
      />

      <ProFormSelect
        name="allowed_app_codes"
        label={t('pages.infra.package.allowedApps')}
        mode="multiple"
        options={applicationOptions}
        loading={appOptionsLoading}
        fieldProps={{
          optionFilterProp: 'label',
          showSearch: true,
        }}
        extra={t('pages.infra.package.allowedAppsHelp')}
      />

      <ProFormText
        name="description"
        label={t('pages.infra.package.description')}
      />

      <ProFormTextArea
        name="features"
        label={t('pages.infra.package.features')}
        placeholder={t('pages.infra.package.featuresPlaceholder')}
        help={t('pages.infra.package.featuresHelp')}
      />

      <ProFormSwitch
        name="is_active"
        label={t('pages.infra.package.isActive')}
        initialValue={true}
      />
    </>
  );
}
