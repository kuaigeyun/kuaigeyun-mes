/**
 * 套餐表单组件
 *
 * 用于创建和编辑套餐信息
 */

import { ProForm, ProFormText, ProFormDigit, ProFormSwitch, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPackage, updatePackage, type PackageCreate, type PackageUpdate } from '../../../services/tenant';
import { useTranslation } from 'react-i18next';

interface PackageFormProps {
  initialValues?: any;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * 套餐表单组件
 */
export default function PackageForm({ initialValues, onSubmit, onCancel }: PackageFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!initialValues;

  // 处理初始值，将features数组转换为换行分隔的字符串
  const processedInitialValues = initialValues ? {
    ...initialValues,
    features: Array.isArray(initialValues.features)
      ? initialValues.features.join('\n')
      : initialValues.features
  } : undefined;

  // 创建套餐
  const createMutation = useMutation({
    mutationFn: (data: PackageCreate) => createPackage(data),
    onSuccess: () => {
      message.success(t('pages.infra.package.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onSubmit();
    },
    onError: (error: any) => {
      message.error(error?.message || t('pages.infra.package.createFailed'));
    },
  });

  // 更新套餐
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PackageUpdate }) => updatePackage(id, data),
    onSuccess: () => {
      message.success(t('pages.infra.package.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onSubmit();
    },
    onError: (error: any) => {
      message.error(error?.message || t('pages.infra.package.updateFailed'));
    },
  });

  /**
   * 处理提交
   */
  const handleFinish = async (values: any) => {
    // 处理features字段，将换行分隔的字符串转换为数组
    const processedValues = { ...values };
    if (processedValues.features && typeof processedValues.features === 'string') {
      // 将换行符分割，并过滤空行
      processedValues.features = processedValues.features
        .split('\n')
        .map((feature: string) => feature.trim())
        .filter((feature: string) => feature.length > 0);
    }

    if (isEdit) {
      await updateMutation.mutateAsync({
        id: initialValues.id,
        data: processedValues,
      });
    } else {
      await createMutation.mutateAsync(processedValues);
    }
  };

  const planOptions = [
    { label: t('pages.infra.package.planTrial'), value: 'trial' },
    { label: t('pages.infra.package.planBasic'), value: 'basic' },
    { label: t('pages.infra.package.planProfessional'), value: 'professional' },
    { label: t('pages.infra.package.planEnterprise'), value: 'enterprise' },
  ];

  return (
    <ProForm
      initialValues={processedInitialValues}
      onFinish={handleFinish}
      submitter={{
        submitButtonProps: {
          loading: createMutation.isPending || updateMutation.isPending,
        },
      }}
    >
      <ProFormText
        name="name"
        label={t('pages.infra.package.name')}
        rules={[{ required: true, message: t('pages.infra.package.nameRequired') }]}
      />

      <SafeProFormSelect
        name="plan"
        label={t('pages.infra.package.plan')}
        options={planOptions}
        rules={[{ required: true, message: t('pages.infra.package.planRequired') }]}
      />

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

      <ProFormSwitch
        name="allow_pro_apps"
        label={t('pages.infra.package.allowProApps')}
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
    </ProForm>
  );
}
