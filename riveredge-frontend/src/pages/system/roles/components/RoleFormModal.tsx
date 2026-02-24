/**
 * 角色新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';
import { SchemaFormRenderer } from '../../../../components/schema-form';
import { roleFormSchema } from '../schemas/role';
import {
  getRoleByUuid,
  createRole,
  updateRole,
  Role,
  CreateRoleData,
  UpdateRoleData,
} from '../../../../services/role';

export interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入角色 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调 */
  onSuccess: () => void;
}

export const RoleFormModal: React.FC<RoleFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ is_active: true });
    if (!editUuid) return;
    getRoleByUuid(editUuid)
      .then((detail: Role) => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          code: detail.code,
          description: detail.description,
          is_active: detail.is_active ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('common.loadFailed'));
      });
  }, [open, editUuid, messageApi, t]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await updateRole(editUuid, values as UpdateRoleData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createRole(values as CreateRoleData);
        messageApi.success(t('pages.system.createSuccess'));
      }
      onClose();
      formRef.current?.resetFields();
      onSuccess();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.saveFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.role.editTitle') : t('field.role.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer schema={roleFormSchema} isEdit={isEdit} />
    </FormModalTemplate>
  );
};
