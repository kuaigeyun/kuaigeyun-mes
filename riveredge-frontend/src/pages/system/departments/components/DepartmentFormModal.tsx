/**
 * 部门新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';
import { SchemaFormRenderer } from '../../../../components/schema-form';
import { departmentFormSchema } from '../schemas/department';
import {
  getDepartmentByUuid,
  createDepartment,
  updateDepartment,
  Department,
  DepartmentTreeItem,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../../../../services/department';

function toTreeData(items: DepartmentTreeItem[]): Array<{ title: string; value: string; key: string; children?: any[] }> {
  return items.map((item) => ({
    title: item.name,
    value: item.uuid,
    key: item.uuid,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));
}

export interface DepartmentFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  /** 新建时指定父部门（添加子部门场景） */
  initialParentUuid?: string | null;
  onSuccess: () => void;
  /** 部门树数据（由父组件传入，避免重复请求） */
  deptTreeItems: DepartmentTreeItem[];
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  open,
  onClose,
  editUuid,
  initialParentUuid,
  onSuccess,
  deptTreeItems,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  const isEdit = Boolean(editUuid);
  const deptTreeData = toTreeData(deptTreeItems);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
      sort_order: 0,
      parent_uuid: initialParentUuid || undefined,
    });
    if (!editUuid) return;
    getDepartmentByUuid(editUuid)
      .then((detail: Department) => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          code: detail.code,
          description: detail.description,
          parent_uuid: detail.parent_uuid || undefined,
          sort_order: detail.sort_order ?? 0,
          is_active: detail.is_active ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('common.loadFailed'));
      });
  }, [open, editUuid, initialParentUuid, messageApi, t]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const payload = { ...values };
      if (payload.parent_uuid === undefined || payload.parent_uuid === null || payload.parent_uuid === '') {
        payload.parent_uuid = undefined;
      }
      if (isEdit && editUuid) {
        await updateDepartment(editUuid, payload as UpdateDepartmentData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createDepartment(payload as CreateDepartmentData);
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
      title={isEdit ? t('field.department.editTitle') : t('field.department.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, sort_order: 0, parent_uuid: initialParentUuid || undefined }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={departmentFormSchema}
        isEdit={isEdit}
        treeDataMap={{ parent_uuid: deptTreeData }}
      />
    </FormModalTemplate>
  );
};
