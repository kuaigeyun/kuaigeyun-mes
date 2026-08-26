/**
 * 工作小组绩效分配弹窗（调用已有 distribute API）
 */

import React, { useEffect, useState } from 'react';
import { App, Form, InputNumber, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../../../hooks/useNumericPrecision';
import { workGroupApi } from '../../../../../master-data/services/factory';
import type { WorkGroup } from '../../../../../master-data/types/factory';
import { employeePerformanceApi } from '../../../../services/performance';
import { getApiErrorMessage } from '../../../../../../utils/errorHandler';

export type WorkGroupDistributeModalProps = {
  open: boolean;
  period: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export const WorkGroupDistributeModal: React.FC<WorkGroupDistributeModalProps> = ({
  open,
  period,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const amountDecimals = useNumericPrecisionPlaces('amount');
  const { message } = App.useApp();
  const [form] = Form.useForm<{ workGroupUuid: string; totalAmount: number }>();
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    setLoadingGroups(true);
    workGroupApi
      .list({ limit: 500, is_active: true })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setGroups(items.filter((g) => g.isActive !== false));
      })
      .catch(() => {
        setGroups([]);
        message.error(t('app.kuaizhizao.performance.summaries.messages.loadWorkGroupsFailed'));
      })
      .finally(() => setLoadingGroups(false));
  }, [open, form, message, t]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await employeePerformanceApi.distributeByWorkGroup(values.workGroupUuid, {
        period,
        total_amount: values.totalAmount,
      });
      message.success(t('app.kuaizhizao.performance.summaries.messages.distributeSuccess'));
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(
        getApiErrorMessage(e, t('app.kuaizhizao.performance.summaries.messages.distributeFailed')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('app.kuaizhizao.performance.summaries.distributeModal.title')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      confirmLoading={submitting}
      destroyOnHidden
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="workGroupUuid"
          label={t('app.kuaizhizao.performance.summaries.distributeModal.workGroup')}
          rules={[{ required: true, message: t('app.kuaizhizao.performance.summaries.distributeModal.workGroupRequired') }]}
        >
          <Select
            showSearch
            loading={loadingGroups}
            placeholder={t('app.kuaizhizao.performance.summaries.distributeModal.workGroupPlaceholder')}
            optionFilterProp="label"
            options={groups.map((g) => ({
              value: g.uuid,
              label: `${g.code} ${g.name}`.trim(),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="totalAmount"
          label={t('app.kuaizhizao.performance.summaries.distributeModal.totalAmount')}
          rules={[{ required: true, message: t('app.kuaizhizao.performance.summaries.distributeModal.totalAmountRequired') }]}
        >
          <InputNumber min={0.01} precision={amountDecimals} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label={t('app.kuaizhizao.performance.summaries.distributeModal.period')}>
          <span>{period || '-'}</span>
        </Form.Item>
      </Form>
    </Modal>
  );
};
