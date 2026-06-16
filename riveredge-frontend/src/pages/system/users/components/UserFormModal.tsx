/**
 * 用户新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import {
  getUserFormCoreReferenceOptions,
  getUserFormPartnerOptions,
  roleUuidsNeedPartnerDimension,
  type UserFormSelectOption,
  type UserFormRoleMeta,
} from '../userFormReferenceOptions';

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

function applyFormValues(formRef: React.RefObject<ProFormInstance | undefined>, values: Record<string, unknown>) {
  requestAnimationFrame(() => {
    formRef.current?.setFieldsValue(values);
  });
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
  const onCloseRef = useRef(onClose);
  const tRef = useRef(t);
  const messageApiRef = useRef(messageApi);
  const [formLoading, setFormLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [roleUuidsDraft, setRoleUuidsDraft] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<UserFormSelectOption[]>([]);
  const [positionOptions, setPositionOptions] = useState<UserFormSelectOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<UserFormSelectOption[]>([]);
  const [roleMetaByUuid, setRoleMetaByUuid] = useState<Record<string, UserFormRoleMeta>>({});
  const [customerOptions, setCustomerOptions] = useState<UserFormSelectOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<UserFormSelectOption[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    messageApiRef.current = messageApi;
  }, [messageApi]);

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

  const applyCoreReferenceOptions = (core: Awaited<ReturnType<typeof getUserFormCoreReferenceOptions>>) => {
    setDepartmentOptions(core.departmentOptions);
    setPositionOptions(core.positionOptions);
    setRoleOptions(core.roleOptions);
    setRoleMetaByUuid(core.roleMetaByUuid);
  };

  useEffect(() => {
    if (!open) {
      setFormInitialValues(undefined);
      setRoleUuidsDraft([]);
      setDetailLoading(false);
      setCustomerOptions([]);
      setSupplierOptions([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        formRef.current?.resetFields();

        if (!editUuid) {
          const core = await getUserFormCoreReferenceOptions(tRef.current);
          if (cancelled) return;
          applyCoreReferenceOptions(core);
          const defaults = {
            is_active: true,
            is_tenant_admin: false,
            supplier_scope_codes: [],
            customer_scope_codes: [],
          };
          setRoleUuidsDraft([]);
          setFormInitialValues(defaults);
          applyFormValues(formRef, defaults);
          return;
        }

        setDetailLoading(true);
        const [detail, core] = await Promise.all([
          getUserByUuid(editUuid),
          getUserFormCoreReferenceOptions(tRef.current),
        ]);
        if (cancelled) return;

        applyCoreReferenceOptions(core);
        const editRoleUuids = detail.roles?.map((r) => r.uuid) || [];
        const baseValues = {
          username: detail.username,
          email: detail.email,
          full_name: detail.full_name,
          phone: detail.phone,
          department_uuid: detail.department_uuid,
          position_uuid: detail.position_uuid,
          role_uuids: editRoleUuids,
          is_active: detail.is_active,
          is_tenant_admin: detail.is_tenant_admin,
          supplier_scope_codes: [] as string[],
          customer_scope_codes: [] as string[],
        };
        setRoleUuidsDraft(editRoleUuids);
        setFormInitialValues(baseValues);
        applyFormValues(formRef, baseValues);
        setDetailLoading(false);

        const userUuid = detail.uuid || editUuid;
        const needsSupplier = roleUuidsNeedPartnerDimension(editRoleUuids, core.roleMetaByUuid, 'supplier');
        const needsCustomer = roleUuidsNeedPartnerDimension(editRoleUuids, core.roleMetaByUuid, 'customer');
        if (!needsSupplier && !needsCustomer) return;

        const [supplierBindings, customerBindings, supplierOpts, customerOpts] = await Promise.all([
          needsSupplier ? getUserDataScopeBindings(userUuid, 'supplier') : Promise.resolve([]),
          needsCustomer ? getUserDataScopeBindings(userUuid, 'customer') : Promise.resolve([]),
          needsSupplier ? getUserFormPartnerOptions('supplier') : Promise.resolve([]),
          needsCustomer ? getUserFormPartnerOptions('customer') : Promise.resolve([]),
        ]);
        if (cancelled) return;

        if (needsSupplier) {
          setSupplierOptions(supplierOpts);
        }
        if (needsCustomer) {
          setCustomerOptions(customerOpts);
        }
        const scopePatch = {
          supplier_scope_codes: supplierBindings.map((x) => x.scope_code).filter(Boolean),
          customer_scope_codes: customerBindings.map((x) => x.scope_code).filter(Boolean),
        };
        setFormInitialValues((prev) => ({ ...(prev || {}), ...scopePatch }));
        applyFormValues(formRef, scopePatch);
      } catch (error: any) {
        if (cancelled) return;
        messageApiRef.current.error(error.message || tRef.current('field.user.fetchDetailFailed'));
        onCloseRef.current();
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editUuid, t]);

  useEffect(() => {
    if (!open) return;
    if (selectedExternalPartnerTypes.has('supplier') && supplierOptions.length === 0) {
      void getUserFormPartnerOptions('supplier')
        .then(setSupplierOptions)
        .catch(() => {});
    }
    if (selectedExternalPartnerTypes.has('customer') && customerOptions.length === 0) {
      void getUserFormPartnerOptions('customer')
        .then(setCustomerOptions)
        .catch(() => {});
    }
  }, [open, selectedExternalPartnerTypes, supplierOptions.length, customerOptions.length]);

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
      loading={formLoading || detailLoading}
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
