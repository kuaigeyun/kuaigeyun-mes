import React from 'react';
import {
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Upload,
  theme,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { Quality8DReport } from '../../../../services/quality-improvement';
import { useTranslation } from 'react-i18next';
import { uploadMultipleFiles } from '../../../../../../services/file';
import {
  EIGHT_D_SEVERITY_I18N_KEY,
  EIGHT_D_STAGE_FIELDS,
  getEightDStatusText,
  parseEightDStageLabel,
} from './eightDMeta';
import { FutureDatePicker } from '../../../../../../utils/futureDatePickerShortcuts';

const { TextArea } = Input;

function EightDStageFieldLabel({ text, active }: { text: string; active?: boolean }) {
  const { token } = theme.useToken();
  const parsed = parseEightDStageLabel(text);
  if (!parsed) {
    return <span>{text}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
      <span
        style={{
          fontSize: active ? 18 : 16,
          fontWeight: 600,
          lineHeight: 1.2,
          color: token.colorPrimary,
        }}
      >
        {parsed.code}
      </span>
      <span
        style={{
          fontSize: token.fontSize,
          fontWeight: active ? 500 : 400,
          color: token.colorText,
        }}
      >
        {parsed.title}
      </span>
    </span>
  );
}

interface EightDStageEditorProps {
  form: FormInstance;
  report: Quality8DReport;
  saving: boolean;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

export const EightDStageEditor: React.FC<EightDStageEditorProps> = ({ form, report, saving, onSave }) => {
  const { t } = useTranslation();
  const currentStageField = EIGHT_D_STAGE_FIELDS[report.status];

  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={onSave}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '100%' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          width: '100%',
        }}
      >
        <Form.Item name="severity" label={t('app.kuaizhizao.eightD.columns.severity')}>
          <Select
            options={Object.entries(EIGHT_D_SEVERITY_I18N_KEY).map(([value, key]) => ({
              value,
              label: t(key),
            }))}
          />
        </Form.Item>
        <Form.Item name="owner_name" label={t('app.kuaizhizao.eightD.columns.owner')}>
          <Input placeholder={t('app.kuaizhizao.eightD.placeholders.owner')} />
        </Form.Item>
        <Form.Item name="due_date" label={t('app.kuaizhizao.eightD.columns.dueDate')}>
          <FutureDatePicker
            getForm={() => form}
            t={t}
            showTime
            style={{ width: '100%' }}
          />
        </Form.Item>
      </div>

      {Object.entries(EIGHT_D_STAGE_FIELDS).map(([status, fieldName]) => {
        const label = getEightDStatusText(t, status);
        const isActiveStage = currentStageField === fieldName;
        return (
          <Form.Item
            key={fieldName}
            name={fieldName}
            label={<EightDStageFieldLabel text={label} active={isActiveStage} />}
            rules={
              currentStageField === fieldName
                ? [{ required: true, message: t('app.kuaizhizao.eightD.currentStageRequired', { stage: label }) }]
                : undefined
            }
          >
            <TextArea
              autoSize={{ minRows: 3, maxRows: 8 }}
              placeholder={t('app.kuaizhizao.eightD.placeholders.fillStage', { stage: label })}
            />
          </Form.Item>
        );
      })}

      <Form.Item name="verification_result" label={t('app.kuaizhizao.eightD.columns.verificationResult')}>
        <TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t('app.kuaizhizao.eightD.placeholders.verificationResult')} />
      </Form.Item>

      <Form.Item name="remarks" label={t('common.remark')}>
        <TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t('app.kuaizhizao.eightD.placeholders.remarks')} />
      </Form.Item>

      <Form.Item
        name="attachments"
        label={t('common.attachments', '附件')}
        valuePropName="fileList"
        getValueFromEvent={(event) => {
          if (Array.isArray(event)) return event;
          return event?.fileList;
        }}
      >
        <Upload
          multiple
          customRequest={async (options) => {
            try {
              const res = await uploadMultipleFiles([options.file as File], {
                category: 'quality_8d_report_attachments',
              });
              options.onSuccess?.(res[0], options.file as any);
            } catch (err) {
              options.onError?.(err as Error);
            }
          }}
        >
          <Button icon={<UploadOutlined />}>{t('common.upload', '上传')}</Button>
        </Upload>
      </Form.Item>

      <Space wrap align="center" style={{ justifyContent: 'flex-end', width: '100%' }}>
        <Typography.Text type="secondary" style={{ textAlign: 'right' }}>
          {t('app.kuaizhizao.eightD.saveHint')}
        </Typography.Text>
        <Button type="primary" htmlType="submit" loading={saving}>
          {t('common.save')}
        </Button>
      </Space>
    </Form>
  );
};
