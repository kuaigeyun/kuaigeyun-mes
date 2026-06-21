/**
 * 班次新建/编辑弹窗
 */

import React, { useEffect, useRef, useState } from 'react';
import { ProFormDigit, ProFormInstance, ProFormSwitch, ProFormText, ProFormTimePicker } from '@ant-design/pro-components';
import { App } from 'antd';
import dayjs from 'dayjs';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { shiftApi } from '../services/performance';
import type { Shift, ShiftCreate, ShiftUpdate } from '../types/performance';
import {
  modalDateFieldProps,
  modalFieldLayoutFromColSpan,
  PERFORMANCE_FORM_MODAL_CLASS,
} from '../utils/performanceFormLayout';

export interface ShiftFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: () => void;
}

export const ShiftFormModal: React.FC<ShiftFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      standardHours: 8,
      crossesMidnight: false,
    });
    if (!editUuid) return;
    shiftApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          startTime: detail.startTime ? dayjs(detail.startTime, 'HH:mm:ss') : undefined,
          endTime: detail.endTime ? dayjs(detail.endTime, 'HH:mm:ss') : undefined,
          crossesMidnight: detail.crossesMidnight,
          standardHours: Number(detail.standardHours ?? 8),
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => messageApi.error(err?.message || '加载班次失败'));
  }, [open, editUuid, messageApi]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      setLoading(true);
      const payload = {
        ...values,
        startTime: dayjs.isDayjs(values.startTime)
          ? values.startTime.format('HH:mm:ss')
          : values.startTime,
        endTime: dayjs.isDayjs(values.endTime) ? values.endTime.format('HH:mm:ss') : values.endTime,
      };
      if (isEdit && editUuid) {
        await shiftApi.update(editUuid, payload as ShiftUpdate);
        messageApi.success('更新成功');
      } else {
        await shiftApi.create(payload as ShiftCreate);
        messageApi.success('创建成功');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      messageApi.error(err?.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={isEdit ? '编辑班次' : '新建班次'}
      open={open}
      onClose={onClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={loading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      className={PERFORMANCE_FORM_MODAL_CLASS}
      formRef={formRef}
      layout="vertical"
      grid={false}
    >
      <ProFormText name="code" label="班次编码" rules={[{ required: true }]} formItemProps={modalFieldLayoutFromColSpan(12)} />
      <ProFormText name="name" label="班次名称" rules={[{ required: true }]} formItemProps={modalFieldLayoutFromColSpan(12)} />
      <ProFormTimePicker name="startTime" label="开始时间" rules={[{ required: true }]} {...modalDateFieldProps()} />
      <ProFormTimePicker name="endTime" label="结束时间" rules={[{ required: true }]} {...modalDateFieldProps()} />
      <ProFormDigit name="standardHours" label="标准工时(小时)" min={0} max={24} fieldProps={{ precision: 2 }} formItemProps={modalFieldLayoutFromColSpan(12)} />
      <ProFormSwitch name="crossesMidnight" label="跨天" formItemProps={modalFieldLayoutFromColSpan(12)} />
      <ProFormSwitch name="isActive" label="启用" formItemProps={modalFieldLayoutFromColSpan(12)} />
    </FormModalTemplate>
  );
};
