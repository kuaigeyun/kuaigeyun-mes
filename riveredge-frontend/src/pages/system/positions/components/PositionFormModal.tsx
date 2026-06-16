/**
 * 职位新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import {
  isPresetEntityCode,
  localizedPresetFormFields,
  omitPresetLocalizedPayloadFields,
  resolvePresetDepartmentName,
} from '../../../../utils/presetEntityI18n';

function toTreeData(
  items: DepartmentTreeItem[],
  t: TFunction,
): Array<{ title: string; value: string; key: string; children?: any[] }> {
  return items.map((item) => ({
    title: resolvePresetDepartmentName(item, t),
    value: item.uuid,
    key: item.uuid,
    children: item.children?.length ? toTreeData(item.children, t) : undefined,
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
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [deptTreeData, setDeptTreeData] = useState<Array<{ title: string; value: string; key: string; children?: any[] }>>([]);
  const [editPresetCode, setEditPresetCode] = useState<string | null>(null);

  const isEdit = Boolean(editUuid);
  const presetDisabledFields = useMemo(
    () => (isEdit && editPresetCode && isPresetEntityCode('position', editPresetCode) ? ['name'] : []),
    [isEdit, editPresetCode],
  );

  useEffect(() => {
    if (!open) return;
    getDepartmentTree()
      .then((res) => setDeptTreeData(toTreeData(res.items, t)))
      .catch(() => setDeptTreeData([]));
  }, [open, t, i18n.language]);

  useEffect(() => {
    if (!open) {
      setEditPresetCode(null);
      return;
    }
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ is_active: true, sort_order: 0 });
    if (!editUuid) {
      setEditPresetCode(null);
      return;
    }
    getPositionByUuid(editUuid)
      .then((detail: Position) => {
        const localized = localizedPresetFormFields('position', detail, t);
        setEditPresetCode(detail.code ?? null);
        formRef.current?.setFieldsValue({
          name: localized.name,
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
  }, [open, editUuid, messageApi, t, i18n.language]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const payload = isEdit
        ? omitPresetLocalizedPayloadFields('position', editPresetCode, values)
        : values;
      if (isEdit && editUuid) {
        await updatePosition(editUuid, payload as UpdatePositionData);
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
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, sort_order: 0 }}
      layout="vertical"
    >
      <SchemaFormRenderer
        schema={positionFormSchema}
        isEdit={isEdit}
        treeDataMap={{ department_uuid: deptTreeData }}
        disabledFields={presetDisabledFields}
      />
    </FormModalTemplate>
  );
};
