/**
 * 用户新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProFormSelect, ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import {
  getUserByUuid,
  getUserDataScopeBindings,
  createUser,
  replaceUserDataScopeBindings,
  updateUser,
  CreateUserData,
  UpdateUserData,
} from '../../../../services/user';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';
import { getPositionList } from '../../../../services/position';
import { getRoleList } from '../../../../services/role';
import { searchReferenceDisplay } from '../../../../utils/referenceDisplay';

/** 账户用户名：2-50 字符，支持中文、字母、数字、下划线、连字符 */
const USERNAME_PATTERN = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;

export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入用户 uuid，为 null 时为新建 */
  editUuid: string | null;
  onSuccess: () => void;
}

function parseErrorMessage(error: any, t: (key: string) => string): string {
  const message = error.message || error.detail || t('pages.system.deleteFailed');

  if (message.includes('用户名') && message.includes('已存在')) {
    return t('field.user.errorUsernameExists');
  }
  if (message.includes('部门不存在') || message.includes('部门')) {
    return t('field.user.errorDepartmentInvalid');
  }
  if (message.includes('职位不存在') || message.includes('职位')) {
    return t('field.user.errorPositionInvalid');
  }
  if (message.includes('角色') && (message.includes('不存在') || message.includes('无效'))) {
    return t('field.user.errorRoleInvalid');
  }
  if (message.includes('手机号') || message.includes('phone')) {
    return t('field.user.errorPhoneInvalid');
  }
  if (message.includes('邮箱') || message.includes('email')) {
    return t('field.user.errorEmailInvalid');
  }
  if (message.includes('权限') || message.includes('permission')) {
    return t('field.user.errorNoPermission');
  }
  return message;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [roleUuidsDraft, setRoleUuidsDraft] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleMetaByUuid, setRoleMetaByUuid] = useState<Record<string, { role_type?: string; external_partner_type?: string }>>({});
  const [customerOptions, setCustomerOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ label: string; value: string }>>([]);

  const isEdit = Boolean(editUuid);

  const selectedExternalPartnerTypes = useMemo(() => {
    const types = new Set<string>();
    roleUuidsDraft.forEach((uuid) => {
      const role = roleMetaByUuid[uuid];
      if (role?.role_type === 'external' && role.external_partner_type) {
        types.add(role.external_partner_type);
      }
    });
    return types;
  }, [roleUuidsDraft, roleMetaByUuid]);

  const loadReferenceOptions = useCallback(async () => {
    const [deptResponse, posResponse, roleResponse, supplierDisplay, customerDisplay] = await Promise.all([
      getDepartmentTree(),
      getPositionList({ page_size: 100 }),
      getRoleList({ page_size: 100 }),
      searchReferenceDisplay({
        resource: 'master-data:supply-chain:supplier',
        hostResource: 'system:user',
        pageSize: 1000,
      }),
      searchReferenceDisplay({
        resource: 'master-data:supply-chain:customer',
        hostResource: 'system:user',
        pageSize: 1000,
      }),
    ]);

    const buildDeptOptions = (items: DepartmentTreeItem[], level = 0): Array<{ label: string; value: string }> => {
      const options: Array<{ label: string; value: string }> = [];
      items.forEach((item) => {
        const prefix = '  '.repeat(level);
        options.push({
          label: `${prefix}${item.name}`,
          value: item.uuid,
        });
        if (item.children && item.children.length > 0) {
          options.push(...buildDeptOptions(item.children, level + 1));
        }
      });
      return options;
    };

    setDepartmentOptions(buildDeptOptions(deptResponse.items));
    setPositionOptions(posResponse.items.map((pos) => ({
      label: pos.name,
      value: pos.uuid,
    })));
    setRoleOptions(roleResponse.items.map((role) => ({
      label: role.name,
      value: role.uuid,
    })));
    setRoleMetaByUuid(
      roleResponse.items.reduce((acc, role) => {
        acc[role.uuid] = {
          role_type: role.role_type,
          external_partner_type: role.external_partner_type,
        };
        return acc;
      }, {} as Record<string, { role_type?: string; external_partner_type?: string }>),
    );
    setCustomerOptions(
      customerDisplay.items
        .map((x) => ({
          label: x.label || `${x.name ?? ''}${x.code ? ` (${x.code})` : ''}`,
          value: x.code ?? '',
        }))
        .filter((x) => !!x.value),
    );
    setSupplierOptions(
      supplierDisplay.items
        .map((x) => ({
          label: x.label || `${x.name ?? ''}${x.code ? ` (${x.code})` : ''}`,
          value: x.code ?? '',
        }))
        .filter((x) => !!x.value),
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadReferenceOptions().catch((error) => {
      if (typeof window !== 'undefined') {
        window.console.error('加载选项数据失败:', error);
      }
    });
  }, [open, loadReferenceOptions]);

  useEffect(() => {
    if (!open) {
      setFormInitialValues(undefined);
      setRoleUuidsDraft([]);
      return;
    }

    if (!editUuid) {
      setRoleUuidsDraft([]);
      setFormInitialValues({
        is_active: true,
        is_tenant_admin: false,
        supplier_scope_codes: [],
        customer_scope_codes: [],
      });
      return;
    }

    void (async () => {
      try {
        const detail = await getUserByUuid(editUuid);
        const userUuid = detail.uuid || editUuid;
        const [supplierBindings, customerBindings] = await Promise.all([
          getUserDataScopeBindings(userUuid, 'supplier'),
          getUserDataScopeBindings(userUuid, 'customer'),
        ]);
        const supplierCodes = supplierBindings.map((x) => x.scope_code).filter(Boolean);
        const customerCodes = customerBindings.map((x) => x.scope_code).filter(Boolean);
        const editRoleUuids = detail.roles?.map((r) => r.uuid) || [];
        setRoleUuidsDraft(editRoleUuids);
        setFormInitialValues({
          username: detail.username,
          email: detail.email,
          full_name: detail.full_name,
          phone: detail.phone,
          department_uuid: detail.department_uuid,
          position_uuid: detail.position_uuid,
          role_uuids: editRoleUuids,
          is_active: detail.is_active,
          is_tenant_admin: detail.is_tenant_admin,
          supplier_scope_codes: supplierCodes,
          customer_scope_codes: customerCodes,
        });
      } catch (error: any) {
        messageApi.error(error.message || t('field.user.fetchDetailFailed'));
        onClose();
      }
    })();
  }, [open, editUuid, messageApi, onClose, t]);

  const handleClose = () => {
    onClose();
    setFormInitialValues(undefined);
    setRoleUuidsDraft([]);
  };

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);

      const submitData = { ...values };
      delete submitData.confirmPassword;
      const supplierCodes = (Array.isArray(submitData.supplier_scope_codes) ? submitData.supplier_scope_codes : [])
        .map((v: any) => String(v || '').trim())
        .filter(Boolean);
      const customerCodes = (Array.isArray(submitData.customer_scope_codes) ? submitData.customer_scope_codes : [])
        .map((v: any) => String(v || '').trim())
        .filter(Boolean);
      delete submitData.supplier_scope_codes;
      delete submitData.customer_scope_codes;
      if (!submitData.password) {
        delete submitData.password;
      }

      const latestRoleValue = formRef.current?.getFieldValue?.('role_uuids');
      const draftRoleValue = roleUuidsDraft;
      const rawRoleValue =
        (Array.isArray(draftRoleValue) ? draftRoleValue : undefined) ??
        submitData.role_uuids ??
        latestRoleValue ??
        (isEdit ? formInitialValues?.role_uuids : undefined);
      const normalizedRoleUuids = (Array.isArray(rawRoleValue) ? rawRoleValue : rawRoleValue != null ? [rawRoleValue] : [])
        .map((v: any) => (typeof v === 'string' ? v : v?.value || v?.uuid || ''))
        .filter(Boolean);
      if (isEdit || normalizedRoleUuids.length > 0 || rawRoleValue !== undefined) {
        submitData.role_uuids = normalizedRoleUuids;
      }

      if (isEdit && editUuid) {
        const updated = await updateUser(editUuid, submitData as UpdateUserData);
        await Promise.all([
          replaceUserDataScopeBindings(updated.uuid, {
            dimension: 'supplier',
            items: supplierCodes.map((code: string) => ({ dimension: 'supplier', scope_code: code })),
          }),
          replaceUserDataScopeBindings(updated.uuid, {
            dimension: 'customer',
            items: customerCodes.map((code: string) => ({ dimension: 'customer', scope_code: code })),
          }),
        ]);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        if (!submitData.password) {
          messageApi.error(t('field.user.passwordRequired'));
          return;
        }
        const created = await createUser(submitData as CreateUserData);
        await Promise.all([
          replaceUserDataScopeBindings(created.uuid, {
            dimension: 'supplier',
            items: supplierCodes.map((code: string) => ({ dimension: 'supplier', scope_code: code })),
          }),
          replaceUserDataScopeBindings(created.uuid, {
            dimension: 'customer',
            items: customerCodes.map((code: string) => ({ dimension: 'customer', scope_code: code })),
          }),
        ]);
        messageApi.success(t('pages.system.createSuccess'));
      }

      handleClose();
      onSuccess();
    } catch (error: any) {
      messageApi.error(parseErrorMessage(error, t));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.user.editTitle') : t('field.user.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      initialValues={formInitialValues}
      loading={formLoading}
      formRef={formRef}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      grid={true}
    >
      <ProFormText
        name="username"
        label={t('field.user.username')}
        rules={[
          { required: true, message: t('field.user.usernameRequired') },
          { min: 2, message: t('field.user.usernameMin') },
          { max: 50, message: t('field.user.usernameMax') },
          { pattern: USERNAME_PATTERN, message: t('field.user.usernamePattern') },
        ]}
        placeholder={t('field.user.usernamePlaceholder')}
        fieldProps={{
          autoComplete: 'off',
        }}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="full_name"
        label={t('field.user.fullName')}
        rules={[
          { max: 100, message: t('field.user.fullNameMax') },
        ]}
        placeholder={t('field.user.fullNamePlaceholder')}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="phone"
        label={t('field.user.phone')}
        rules={[
          { required: true, message: t('field.user.phoneRequired') },
          { pattern: /^1[3-9]\d{9}$/, message: t('field.user.phonePattern') },
        ]}
        placeholder={t('field.user.phonePlaceholder')}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="email"
        label={t('field.user.email')}
        rules={[
          { type: 'email', message: t('field.user.emailInvalid') },
        ]}
        placeholder={t('field.user.emailPlaceholder')}
        fieldProps={{ autoComplete: 'email' }}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="password"
        label={t('field.user.password')}
        rules={isEdit ? [] : [
          { required: true, message: t('field.user.passwordRequiredPlaceholder') },
          { min: 8, message: t('field.user.passwordMin') },
          { max: 128, message: t('field.user.passwordMax') },
        ]}
        placeholder={isEdit ? t('field.user.passwordPlaceholderEdit') : t('field.user.passwordPlaceholder')}
        fieldProps={{
          type: 'password',
          autoComplete: 'new-password',
        }}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="confirmPassword"
        label={t('field.user.confirmPassword')}
        rules={isEdit ? [] : [
          { required: true, message: t('field.user.confirmPasswordRequired') },
          { min: 8, message: t('field.user.passwordMin') },
          { max: 128, message: t('field.user.passwordMax') },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error(t('field.user.passwordMismatch')));
            },
          }),
        ]}
        placeholder={isEdit ? t('field.user.passwordPlaceholderEdit') : t('field.user.confirmPasswordPlaceholder')}
        fieldProps={{
          type: 'password',
          autoComplete: 'new-password',
        }}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="department_uuid"
        label={t('field.user.department')}
        placeholder={t('field.user.departmentPlaceholder')}
        allowClear
        options={departmentOptions}
        fieldProps={{ showSearch: true }}
        colProps={{ span: 8 }}
      />
      <ProFormSelect
        name="position_uuid"
        label={t('field.user.position')}
        placeholder={t('field.user.positionPlaceholder')}
        options={positionOptions}
        fieldProps={{
          showSearch: true,
        }}
        colProps={{ span: 8 }}
      />
      <ProFormSelect
        name="role_uuids"
        label={t('field.user.roles')}
        placeholder={t('field.user.rolesPlaceholder')}
        options={roleOptions}
        fieldProps={{
          mode: 'multiple',
          showSearch: true,
          onChange: (value: any) => {
            const next = (Array.isArray(value) ? value : [value])
              .map((v: any) => (typeof v === 'string' ? v : v?.value || v?.uuid || ''))
              .filter(Boolean);
            setRoleUuidsDraft(next);
          },
        }}
        colProps={{ span: 8 }}
      />
      {selectedExternalPartnerTypes.has('supplier') && (
        <ProFormSelect
          name="supplier_scope_codes"
          label="外部角色-供应商绑定"
          placeholder="请选择该账号可访问的供应商（按编码）"
          options={supplierOptions}
          fieldProps={{
            mode: 'multiple',
            showSearch: true,
            optionFilterProp: 'label',
          }}
          extra="根据所选外部角色自动显示；用于供应商数据隔离"
          colProps={{ span: 24 }}
        />
      )}
      {selectedExternalPartnerTypes.has('customer') && (
        <ProFormSelect
          name="customer_scope_codes"
          label="外部角色-客户绑定"
          placeholder="请选择该账号可访问的客户（按编码）"
          options={customerOptions}
          fieldProps={{
            mode: 'multiple',
            showSearch: true,
            optionFilterProp: 'label',
          }}
          extra="根据所选外部角色自动显示；用于客户数据隔离"
          colProps={{ span: 24 }}
        />
      )}
      <ProFormSwitch
        name="is_active"
        label={t('field.user.isActiveLabel')}
        colProps={{ span: 12 }}
      />
      <ProFormSwitch
        name="is_tenant_admin"
        label={t('field.user.isTenantAdminLabel')}
        colProps={{ span: 12 }}
      />
    </FormModalTemplate>
  );
};
