/**
 * 套餐表单组件
 *
 * 用于创建和编辑套餐信息
 */

import { ProForm, ProFormText, ProFormDigit, ProFormSwitch, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/SafeProFormSelect';
import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPackage, updatePackage, type PackageCreate, type PackageUpdate } from '../../../services/tenant';

interface PackageFormProps {
  initialValues?: any;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * 套餐表单组件
 */
export default function PackageForm({ initialValues, onSubmit, onCancel }: PackageFormProps) {
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
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onSubmit();
    },
    onError: (error: any) => {
      message.error(error?.message || '创建失败');
    },
  });

  // 更新套餐
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PackageUpdate }) => updatePackage(id, data),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onSubmit();
    },
    onError: (error: any) => {
      message.error(error?.message || '更新失败');
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
    { label: '体验套餐', value: 'trial' },
    { label: '基础版', value: 'basic' },
    { label: '专业版', value: 'professional' },
    { label: '企业版', value: 'enterprise' },
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
        label="套餐名称"
        rules={[{ required: true, message: '请输入套餐名称' }]}
      />

      <SafeProFormSelect
        name="plan"
        label="套餐类型"
        options={planOptions}
        rules={[{ required: true, message: '请选择套餐类型' }]}
      />

      <ProFormDigit
        name="max_users"
        label="用户数限制"
        min={1}
        rules={[{ required: true, message: '请输入用户数限制' }]}
      />

      <ProFormDigit
        name="max_storage_mb"
        label="存储空间(MB)"
        min={1}
        rules={[{ required: true, message: '请输入存储空间' }]}
      />

      <ProFormSwitch
        name="allow_pro_apps"
        label="允许PRO应用"
      />

      <ProFormText
        name="description"
        label="描述"
      />

      <ProFormTextArea
        name="features"
        label="功能列表"
        placeholder="请输入套餐功能列表，每行一个功能"
        help="支持换行分隔的功能列表，将自动转换为数组格式"
      />

      <ProFormSwitch
        name="is_active"
        label="是否激活"
        initialValue={true}
      />
    </ProForm>
  );
}
