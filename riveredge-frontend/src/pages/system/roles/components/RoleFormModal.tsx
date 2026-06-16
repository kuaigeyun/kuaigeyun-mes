/**
 * 角色新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import { getMenuTree, EFFECTIVE_HOME_QUERY_KEY, type MenuTree } from '../../../../services/menu';
import { RoleHomePathSelect } from './RoleHomePathSelect';
import { useQueryClient } from '@tanstack/react-query';
import {
  isPresetEntityCode,
  localizedPresetFormFields,
  omitPresetLocalizedPayloadFields,
} from '../../../../utils/presetEntityI18n';

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
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [menuTree, setMenuTree] = useState<MenuTree[]>([]);
  const [editPresetCode, setEditPresetCode] = useState<string | null>(null);

  const isEdit = Boolean(editUuid);
  const presetDisabledFields = useMemo(
    () =>
      isEdit && editPresetCode && isPresetEntityCode('role', editPresetCode)
        ? ['name', 'description']
        : [],
    [isEdit, editPresetCode],
  );

  useEffect(() => {
    if (!open) return;
    void getMenuTree({ is_active: true })
      .then((trees) => setMenuTree(trees || []))
      .catch(() => setMenuTree([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEditPresetCode(null);
      return;
    }
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
      role_type: 'internal',
      create_position: false,
    });
    if (!editUuid) {
      setEditPresetCode(null);
      return;
    }
    getRoleByUuid(editUuid)
      .then((detail: Role) => {
        const localized = localizedPresetFormFields('role', detail, t);
        setEditPresetCode(detail.code ?? null);
        formRef.current?.setFieldsValue({
          name: localized.name,
          code: detail.code,
          description: localized.description ?? detail.description,
          role_type: detail.role_type || 'internal',
          external_partner_type: detail.external_partner_type,
          is_active: detail.is_active ?? true,
          home_path: detail.home_path || undefined,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('common.loadFailed'));
      });
  }, [open, editUuid, messageApi, t, i18n.language]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      let payload = { ...values };
      if (payload.role_type === 'external' && !payload.external_partner_type) {
        messageApi.warning(t('pages.system.roles.externalRoleTypeRequired', { defaultValue: '外部角色必须选择绑定类型（客户或供应商）' }));
        return;
      }
      if (payload.role_type !== 'external') {
        payload.external_partner_type = undefined;
      }
      if (payload.home_path === undefined || payload.home_path === '') {
        payload.home_path = null;
      }
      const createPosition = Boolean(payload.create_position);
      delete payload.create_position;
      if (isEdit && editUuid) {
        payload = omitPresetLocalizedPayloadFields('role', editPresetCode, payload);
        await updateRole(editUuid, payload as UpdateRoleData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createRole({ ...payload, create_position: createPosition } as CreateRoleData);
        messageApi.success(
          createPosition
            ? t('field.role.createSuccessWithPosition')
            : t('pages.system.createSuccess'),
        );
      }
      void queryClient.invalidateQueries({ queryKey: EFFECTIVE_HOME_QUERY_KEY });
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
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, role_type: 'internal', create_position: false }}
      layout="vertical"
      grid
      onValuesChange={(changed) => {
        if ('role_type' in changed && changed.role_type !== 'external') {
          formRef.current?.setFieldsValue({ external_partner_type: undefined });
        }
      }}
    >
      <SchemaFormRenderer
        schema={roleFormSchema}
        isEdit={isEdit}
        slots={{ homePath: <RoleHomePathSelect menuTree={menuTree} /> }}
        disabledFields={presetDisabledFields}
      />
    </FormModalTemplate>
  );
};
