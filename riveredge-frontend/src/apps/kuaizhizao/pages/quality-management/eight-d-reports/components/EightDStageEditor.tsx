import React, { useCallback, useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Space, Typography, theme } from 'antd';
import { EditOutlined, FileTextOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { Quality8DReport } from '../../../../services/quality-improvement';
import { useTranslation } from 'react-i18next';
import {
  EIGHT_D_STAGE_FIELDS,
  canRequestEightDStageUnlock,
  getEightDStageHintKey,
  getEightDStatusText,
  isEightDStageEditable,
  parseEightDStageLabel,
  normalizeEightDStageHtml,
  stripEightDHtml,
  type EightDStageUnlockMap,
} from './eightDMeta';
import { getEightDStageOutlineHtml, hasEightDStageOutline } from './eightDStageOutlineTemplates';
import { LoginRichTextEditor } from '../../../../../../components/login-page-editor';

function EightDStageFieldLabel({ text }: { text: string }) {
  const { token } = theme.useToken();
  const parsed = parseEightDStageLabel(text);
  if (!parsed) {
    return <span>{text}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, lineHeight: 1.5 }}>
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          lineHeight: '24px',
          color: token.colorPrimary,
        }}
      >
        {parsed.code}
      </span>
      <span
        style={{
          fontSize: token.fontSize,
          fontWeight: 500,
          lineHeight: `${token.lineHeight}px`,
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
  activeStageKey: string;
  saving: boolean;
  unlocking?: boolean;
  canUpdate?: boolean;
  onSaveClick: () => void;
  onRequestUnlock?: (stageKey: string, reason: string) => Promise<void>;
}

export const EightDStageEditor: React.FC<EightDStageEditorProps> = ({
  form,
  report,
  activeStageKey,
  saving,
  unlocking = false,
  canUpdate = false,
  onSaveClick,
  onRequestUnlock,
}) => {
  const { t } = useTranslation();
  const { modal: modalApi, message: messageApi } = App.useApp();
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const fieldName = EIGHT_D_STAGE_FIELDS[activeStageKey];
  const stageLabel = getEightDStatusText(t, activeStageKey);
  const stageUnlocks = (report.stage_unlocks ?? undefined) as EightDStageUnlockMap | undefined;
  const isWorkflowStage = Boolean(fieldName);
  const editable = isEightDStageEditable(report.status, activeStageKey, stageUnlocks);
  const canRequestUnlock =
    canUpdate && canRequestEightDStageUnlock(report.status, activeStageKey, stageUnlocks);
  const isCurrentStage = report.status === activeStageKey;
  const hintKey = getEightDStageHintKey(activeStageKey);
  const hint = t(hintKey, { defaultValue: '' });
  const outlineAvailable = hasEightDStageOutline(t, activeStageKey);

  const insertOutline = useCallback(() => {
    const template = getEightDStageOutlineHtml(t, activeStageKey);
    if (!template) return;
    const current = stripEightDHtml(String(form.getFieldValue(fieldName) ?? ''));
    const apply = (html: string) => {
      form.setFieldValue(fieldName, normalizeEightDStageHtml(html));
    };
    if (!current) {
      apply(template);
      return;
    }
    modalApi.confirm({
      title: t('app.kuaizhizao.eightD.outline.replaceConfirmTitle'),
      content: t('app.kuaizhizao.eightD.outline.replaceConfirmContent'),
      okText: t('app.kuaizhizao.eightD.outline.replaceConfirmOk'),
      cancelText: t('common.cancel'),
      onOk: () => apply(template),
    });
  }, [activeStageKey, fieldName, form, modalApi, t]);

  const submitUnlockRequest = async () => {
    const reason = unlockReason.trim();
    if (!reason) {
      messageApi.warning(t('app.kuaizhizao.eightD.stageUnlock.reasonRequired'));
      return;
    }
    if (!onRequestUnlock) return;
    await onRequestUnlock(activeStageKey, reason);
    setUnlockModalOpen(false);
    setUnlockReason('');
  };

  if (!isWorkflowStage) {
    return (
      <Typography.Text type="secondary">
        {t('app.kuaizhizao.eightD.workbench.closedReadonly')}
      </Typography.Text>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {hint ? <Alert type="info" showIcon title={hint} /> : null}

      {!editable ? (
        <Alert
          type="warning"
          showIcon
          title={
            canRequestUnlock
              ? t('app.kuaizhizao.eightD.workbench.stageLockedCompleted', { stage: stageLabel })
              : t('app.kuaizhizao.eightD.workbench.stageLocked', { stage: stageLabel })
          }
          action={
            canRequestUnlock ? (
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                loading={unlocking}
                onClick={() => setUnlockModalOpen(true)}
              >
                {t('app.kuaizhizao.eightD.stageUnlock.request')}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <Form.Item
        name={fieldName}
        label={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <EightDStageFieldLabel text={stageLabel} />
            {editable && outlineAvailable ? (
              <Button size="small" icon={<FileTextOutlined />} onClick={insertOutline}>
                {t('app.kuaizhizao.eightD.outline.insert')}
              </Button>
            ) : null}
          </span>
        }
        getValueFromEvent={(value: string) => normalizeEightDStageHtml(value ?? '')}
        rules={
          isCurrentStage && editable
            ? [
                {
                  validator: async (_rule, value) => {
                    if (stripEightDHtml(typeof value === 'string' ? value : '')) {
                      return;
                    }
                    throw new Error(
                      t('app.kuaizhizao.eightD.currentStageRequired', { stage: stageLabel }),
                    );
                  },
                },
              ]
            : undefined
        }
      >
        {editable ? (
          <LoginRichTextEditor mode="visual" minHeight={320} />
        ) : (
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev[fieldName] !== cur[fieldName]}>
            {() => (
              <div
                className="eight-d-stage-readonly"
                dangerouslySetInnerHTML={{
                  __html:
                    normalizeEightDStageHtml(form.getFieldValue(fieldName)) ||
                    `<p>${t('app.kuaizhizao.eightD.notFilled')}</p>`,
                }}
              />
            )}
          </Form.Item>
        )}
      </Form.Item>

      {(report.status === 'd8_team_congratulation' || report.status === 'closed') &&
      activeStageKey === 'd8_team_congratulation' ? (
        <Form.Item name="verification_result" label={t('app.kuaizhizao.eightD.columns.verificationResult')}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            readOnly={report.status === 'closed'}
            placeholder={t('app.kuaizhizao.eightD.placeholders.verificationResult')}
          />
        </Form.Item>
      ) : null}

      <Form.Item name="remarks" label={t('common.remark')} hidden={report.status === 'closed'}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          readOnly={report.status === 'closed'}
          placeholder={t('app.kuaizhizao.eightD.placeholders.remarks')}
        />
      </Form.Item>

      {editable ? (
        <Space wrap align="center" style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Typography.Text type="secondary" style={{ textAlign: 'right' }}>
            {t('app.kuaizhizao.eightD.saveHint')}
          </Typography.Text>
          <Button type="primary" loading={saving} onClick={onSaveClick}>
            {t('common.save')}
          </Button>
        </Space>
      ) : null}

      <EightDStageUnlockModal
        open={unlockModalOpen}
        stageLabel={stageLabel}
        reason={unlockReason}
        loading={unlocking}
        onReasonChange={setUnlockReason}
        onCancel={() => {
          setUnlockModalOpen(false);
          setUnlockReason('');
        }}
        onSubmit={() => void submitUnlockRequest()}
      />
    </div>
  );
};

function EightDStageUnlockModal(props: {
  open: boolean;
  stageLabel: string;
  reason: string;
  loading: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={props.open}
      title={t('app.kuaizhizao.eightD.stageUnlock.modalTitle', { stage: props.stageLabel })}
      okText={t('app.kuaizhizao.eightD.stageUnlock.submit')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onCancel}
      onOk={props.onSubmit}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t('app.kuaizhizao.eightD.stageUnlock.modalHint')}
      </Typography.Paragraph>
      <Input.TextArea
        autoSize={{ minRows: 3, maxRows: 6 }}
        value={props.reason}
        placeholder={t('app.kuaizhizao.eightD.stageUnlock.reasonPlaceholder')}
        onChange={(event) => props.onReasonChange(event.target.value)}
      />
    </Modal>
  );
}
