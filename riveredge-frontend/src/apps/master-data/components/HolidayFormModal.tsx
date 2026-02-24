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

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) return;
    holidayApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          holidayDate: detail.holidayDate ? dayjs(detail.holidayDate) : undefined,
          holidayType: detail.holidayType,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取假期详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const payload = { ...values };
      if (payload.holidayDate && dayjs.isDayjs(payload.holidayDate)) {
        payload.holidayDate = payload.holidayDate.format('YYYY-MM-DD');
      }
      if (isEdit && editUuid) {
        await holidayApi.update(editUuid, payload as HolidayUpdate);
        messageApi.success('更新成功');
        const updated = await holidayApi.get(editUuid);
        onSuccess(updated);
      } else {
        if (payload.isActive === undefined) {
          payload.isActive = true;
        }
        const created = await holidayApi.create(payload as HolidayCreate);
        messageApi.success('创建成功');
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
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
      title={isEdit ? t('field.holiday.editTitle') : t('field.holiday.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer schema={holidayFormSchema} isEdit={isEdit} />
    </FormModalTemplate>
  );
};
