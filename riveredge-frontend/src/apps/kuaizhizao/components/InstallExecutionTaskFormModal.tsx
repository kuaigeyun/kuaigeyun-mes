/**
 * 安装执行任务登记弹窗
 */

import React, { useEffect } from 'react';
import { Form } from 'antd';
import {
  ProFormDateTimePicker,
  ProFormItem,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { UniUserSelect } from '../../../components/uni-user-select';
import {
  INSTALL_TASK_STATUSES,
  MAX_TASK_ATTACHMENTS,
  type InstallExecution,
  type InstallExecutionTaskPayload,
} from '../services/install-execution';
import LineAttachmentsUpload from './LineAttachmentsUpload';
import { normalizeDocumentAttachments } from '../utils/documentAttachments';

interface Props {
  open: boolean;
  job: InstallExecution | null;
  onClose: () => void;
  onSaved: (row: InstallExecution) => void;
  onSubmit: (jobId: number, payload: InstallExecutionTaskPayload) => Promise<InstallExecution>;
}

export const InstallExecutionTaskFormModal: React.FC<Props> = ({
  open,
  job,
  onClose,
  onSaved,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open || !job) return;
    const defaultStage =
      job.current_stage_key ?? job.stages?.find((s) => s.status !== '已完成')?.stage_key;
    form.setFieldsValue({
      stage_key: defaultStage,
      status: '待处理',
      executor_uuid: undefined,
      executor_id: undefined,
      executor_name: undefined,
      attachments: [],
    });
  }, [open, job, form]);

  const stageOptions = (job?.stages ?? []).map((s) => ({
    label: s.stage_name || s.stage_key,
    value: s.stage_key,
  }));

  return (
    <FormModalTemplate
      title={t('app.kuaizhizao.installExecution.taskRegisterTitle')}
      open={open}
      onClose={onClose}
      form={form}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      grid
      onFinish={async (values) => {
        if (!job) return;
        const row = await onSubmit(job.id, {
          stage_key: values.stage_key,
          task_title: values.task_title,
          executor_id: values.executor_id,
          executor_name: values.executor_name,
          status: values.status,
          planned_at: values.planned_at
            ? dayjs(values.planned_at).format('YYYY-MM-DD HH:mm:ss')
            : undefined,
          actual_at: values.actual_at
            ? dayjs(values.actual_at).format('YYYY-MM-DD HH:mm:ss')
            : undefined,
          notes: values.notes,
          attachments: normalizeDocumentAttachments(values.attachments),
        });
        onSaved(row);
        onClose();
      }}
    >
      <ProFormSelect
        name="stage_key"
        label={t('app.kuaizhizao.installExecution.taskStage')}
        rules={[{ required: true, message: t('app.kuaizhizao.installExecution.taskStageRequired') }]}
        options={stageOptions}
      />
      <ProFormText
        name="task_title"
        label={t('app.kuaizhizao.installExecution.taskTitle')}
        rules={[{ required: true, message: t('app.kuaizhizao.installExecution.taskTitleRequired') }]}
      />
      <UniUserSelect
        name="executor_uuid"
        label={t('app.kuaizhizao.installExecution.taskExecutor')}
        onChange={(_value, user) => {
          const picked = Array.isArray(user) ? user[0] : user;
          form.setFieldsValue({
            executor_id: picked?.id ?? undefined,
            executor_name: picked?.full_name || picked?.username || undefined,
          });
        }}
      />
      <ProFormText name="executor_id" hidden />
      <ProFormText name="executor_name" hidden />
      <ProFormSelect
        name="status"
        label={t('app.kuaizhizao.installExecution.taskStatus')}
        options={INSTALL_TASK_STATUSES.map((s) => ({ label: s, value: s }))}
      />
      <ProFormDateTimePicker
        name="planned_at"
        label={t('app.kuaizhizao.installExecution.taskPlannedAt')}
        colProps={{ span: 12 }}
      />
      <ProFormDateTimePicker
        name="actual_at"
        label={t('app.kuaizhizao.installExecution.taskActualAt')}
        colProps={{ span: 12 }}
      />
      <ProFormTextArea
        name="notes"
        label={t('common.remark')}
        colProps={{ span: 24 }}
        fieldProps={{ rows: 3 }}
      />
      <ProFormItem
        name="attachments"
        label={t('app.kuaizhizao.installExecution.taskPhotos')}
        colProps={{ span: 24 }}
      >
        <LineAttachmentsUpload
          category="install_execution_task_attachments"
          maxCount={MAX_TASK_ATTACHMENTS}
        />
      </ProFormItem>
    </FormModalTemplate>
  );
};

export default InstallExecutionTaskFormModal;
