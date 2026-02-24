/**
 * 职位新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';
import { SchemaFormRenderer } from '../../../../components/schema-form';
import { positionFormSchema } from '../schemas/position';
import {
  getPositionByUuid,
  createPosition,
  updatePosition,
  Position,
  CreatePositionData,
  UpdatePositionData,
} from '../../../../services/position';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';

function toTreeData(items: DepartmentTreeItem[]): Array<{ title: string; value: string; key: string; children?: any[] }> {
  return items.map((item) => ({
    title: item.name,
    value: item.uuid,
    key: item.uuid,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));
}

export interface PositionFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: () => void;
}

export const PositionFormModal: React.FC<PositionFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [deptTreeData, setDeptTreeData] = useState<Array<{ title: string; value: string; key: string; children?: any[] }>>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    getDepartmentTree()
      .then((res) => setDeptTreeData(toTreeData(res.items)))
      .catch(() => setDeptTreeData([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ is_active: true, sort_order: 0 });
    if (!editUuid) return;
    getPositionByUuid(editUuid)
      .then((detail: Position) => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          code: detail.code,
          description: detail.description,
          department_uuid: detail.department_uuid,
          sort_order: detail.sort_order ?? 0,
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
        await updatePosition(editUuid, values as UpdatePositionData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createPosition(values as CreatePositionData);
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
      title={isEdit ? t('field.position.editTitle') : t('field.position.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, sort_order: 0 }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={positionFormSchema}
        isEdit={isEdit}
        treeDataMap={{ department_uuid: deptTreeData }}
      />
    </FormModalTemplate>
  );
};
