/**
 * 数据字典新建/编辑弹窗（Schema 驱动）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';
import { SchemaFormRenderer } from '../../../../components/schema-form';
import { dataDictionaryFormSchema } from '../schemas/data-dictionary';
import {
  getDataDictionaryByUuid,
  createDataDictionary,
  updateDataDictionary,
  DataDictionary,
  CreateDataDictionaryData,
  UpdateDataDictionaryData,
} from '../../../../services/dataDictionary';

export interface DataDictionaryFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: () => void;
}

export const DataDictionaryFormModal: React.FC<DataDictionaryFormModalProps> = ({
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
    formRef.current?.setFieldsValue({ is_active: true, is_system: false });
    if (!editUuid) return;
    getDataDictionaryByUuid(editUuid)
      .then((detail: DataDictionary) => {
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
        await updateDataDictionary(editUuid, values as UpdateDataDictionaryData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createDataDictionary(values as CreateDataDictionaryData);
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
      title={isEdit ? t('field.dataDictionary.editTitle') : t('field.dataDictionary.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true, is_system: false }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={dataDictionaryFormSchema}
        codeField="code"
        isEdit={isEdit}
      />
    </FormModalTemplate>
  );
};
