/**
 * 假期新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import dayjs from 'dayjs';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { holidayApi } from '../services/performance';
import type { Holiday, HolidayCreate, HolidayUpdate } from '../types/performance';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { holidayFormSchema } from '../schemas/holiday';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { PERFORMANCE_FORM_MODAL_CLASS } from '../utils/performanceFormLayout';

const CUSTOM_FIELD_TABLE = 'master_data_holidays';

export interface HolidayFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (holiday: Holiday) => void;
}

export const HolidayFormModal: React.FC<HolidayFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    resetFieldValues();
    if (!editUuid) return;
    holidayApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          holidayDate: detail.holidayDate ? dayjs(detail.holidayDate) : undefined,
          holidayType: detail.holidayType,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.holidays.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);
      const payload = { ...standardValues };
      if (payload.holidayDate && dayjs.isDayjs(payload.holidayDate)) {
        payload.holidayDate = payload.holidayDate.format('YYYY-MM-DD');
      }
      if (isEdit && editUuid) {
        await holidayApi.update(editUuid, payload as HolidayUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await holidayApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        if (payload.isActive === undefined) {
          payload.isActive = true;
        }
        const created = await holidayApi.create(payload as HolidayCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      resetFieldValues();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    resetFieldValues();
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.holiday.editTitle') : t('field.holiday.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      className={PERFORMANCE_FORM_MODAL_CLASS}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid={false}
    >
      <SchemaFormRenderer
        schema={holidayFormSchema}
        isEdit={isEdit}
        modalHalfWidthLayout
        slots={{
          customFields: (
            <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} />
          ),
        }}
      />
    </FormModalTemplate>
  );
};
