/**
 * 资源分类新建/编辑弹窗（接口 / 数据集共用）
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App } from 'antd';
import {
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormDigit,
} from '@ant-design/pro-components';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import {
  createResourceCategory,
  updateResourceCategory,
  type CreateResourceCategoryData,
  type ResourceCategory,
  type ResourceCategoryType,
  type UpdateResourceCategoryData,
} from '../../../services/resourceCategory';

export interface ResourceCategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  resourceType: ResourceCategoryType;
  isEdit?: boolean;
  category?: ResourceCategory | null;
}

export const ResourceCategoryFormModal: React.FC<ResourceCategoryFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  resourceType,
  isEdit = false,
  category = null,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && category) {
      formRef.current?.setFieldsValue({
        name: category.name,
        code: category.code,
        description: category.description,
        sort_order: category.sort_order,
        is_active: category.is_active,
      });
    } else {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        is_active: true,
        sort_order: 0,
      });
    }
  }, [open, isEdit, category]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      setFormLoading(true);
      if (isEdit && category) {
        const payload: UpdateResourceCategoryData = {
          name: values.name as string,
          code: values.code as string,
          description: (values.description as string) || undefined,
          sort_order: values.sort_order as number,
          is_active: values.is_active as boolean,
        };
        await updateResourceCategory(resourceType, category.uuid, payload);
        messageApi.success(t('pages.system.resourceCategory.updateSuccess'));
      } else {
        const payload: CreateResourceCategoryData = {
          name: values.name as string,
          code: values.code as string,
          description: (values.description as string) || undefined,
          sort_order: (values.sort_order as number) ?? 0,
          is_active: values.is_active !== false,
        };
        await createResourceCategory(resourceType, payload);
        messageApi.success(t('pages.system.resourceCategory.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('common.saveFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const titleKey = isEdit
    ? 'pages.system.resourceCategory.editTitle'
    : 'pages.system.resourceCategory.createTitle';

  return (
    <FormModalTemplate
      title={t(titleKey)}
      open={open}
      onClose={onClose}
      formRef={formRef}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      onFinish={handleSubmit}
    >
      <ProFormText
        name="name"
        label={t('pages.system.resourceCategory.fieldName')}
        rules={[{ required: true, message: t('pages.system.resourceCategory.fieldNameRequired') }]}
      />
      <ProFormText
        name="code"
        label={t('pages.system.resourceCategory.fieldCode')}
        rules={[{ required: true, message: t('pages.system.resourceCategory.fieldCodeRequired') }]}
      />
      <ProFormTextArea name="description" label={t('common.remark')} />
      <ProFormDigit
        name="sort_order"
        label={t('pages.system.resourceCategory.fieldSortOrder')}
        min={0}
        fieldProps={{ precision: 0 }}
      />
      <ProFormSwitch name="is_active" label={t('common.enabled')} />
    </FormModalTemplate>
  );
};
