/**
 * 安装执行费用登记弹窗（追加单行）
 */

import React from 'react';
import {
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  INSTALL_COST_TYPES,
  type InstallExecution,
  type InstallExecutionCostInput,
} from '../services/install-execution';

interface Props {
  open: boolean;
  job: InstallExecution | null;
  onClose: () => void;
  onSaved: (row: InstallExecution) => void;
  onSubmit: (jobId: number, payload: InstallExecutionCostInput) => Promise<InstallExecution>;
}

export const InstallExecutionCostFormModal: React.FC<Props> = ({
  open,
  job,
  onClose,
  onSaved,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <FormModalTemplate
      title={t('app.kuaizhizao.installExecution.costRegisterTitle')}
      open={open}
      onClose={onClose}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      initialValues={{ occurred_at: dayjs(), cost_type: '人工' }}
      onFinish={async (values) => {
        if (!job) return;
        const row = await onSubmit(job.id, {
          cost_type: values.cost_type,
          amount: Number(values.amount),
          occurred_at: dayjs(values.occurred_at).format('YYYY-MM-DD HH:mm:ss'),
          description: values.description,
        });
        onSaved(row);
        onClose();
      }}
    >
      <ProFormSelect
        name="cost_type"
        label={t('app.kuaizhizao.installExecution.costType')}
        rules={[{ required: true }]}
        options={INSTALL_COST_TYPES.map((s) => ({ label: s, value: s }))}
      />
      <ProFormDigit
        name="amount"
        label={t('app.kuaizhizao.installExecution.costAmount')}
        min={0}
        fieldProps={{ precision: 2 }}
        rules={[{ required: true, message: t('app.kuaizhizao.installExecution.costAmountRequired') }]}
      />
      <ProFormDateTimePicker
        name="occurred_at"
        label={t('app.kuaizhizao.installExecution.costOccurredAt')}
        rules={[{ required: true }]}
      />
      <ProFormText name="description" label={t('app.kuaizhizao.installExecution.costDescription')} />
    </FormModalTemplate>
  );
};

export default InstallExecutionCostFormModal;
