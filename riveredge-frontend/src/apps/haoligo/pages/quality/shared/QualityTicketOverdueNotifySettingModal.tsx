import React, { useEffect, useRef, useState } from 'react';
import { ModalForm, type ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Typography } from 'antd';
import { getBusinessConfig, updateProcessParameter } from '../../../../../services/businessConfig';
import { FormNotifyUsersSelect, type NotifyUsersSearchFn } from '../../../components/FormNotifyUsersSelect';
import { QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY } from '../../../utils/qualityComplaintOverdueNotifyDefaults';
import {
  parseQualityIssueOverdueNotifyByKind,
  QUALITY_ISSUE_OVERDUE_NOTIFY_BY_KIND_KEY,
  type QualityIssueOverdueNotifyByKindConfig,
} from '../../../utils/qualityIssueOverdueNotifyDefaults';
import {
  parseQualityLineStopOverdueNotifyByKind,
  QUALITY_LINE_STOP_OVERDUE_NOTIFY_BY_KIND_KEY,
  type QualityLineStopOverdueNotifyByKindConfig,
} from '../../../utils/qualityLineStopOverdueNotifyDefaults';
import {
  QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS,
  QUALITY_ISSUE_KIND_OPTIONS,
  QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS,
  QUALITY_LINE_STOP_KIND_OPTIONS,
  QUALITY_LINE_STOP_OVERDUE_MINISTER_KEYWORDS,
} from '../../../utils/qualityMeta';
import { resolveMinisterUserIdsByKeywords } from '../../../utils/qualityOverdueNotify';

export type QualityTicketFormProfile = 'default' | 'complaint' | 'line-stop';

type Props = {
  profile: QualityTicketFormProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchUsers: NotifyUsersSearchFn;
  onSaved?: (haoligoParameters: Record<string, unknown>) => void;
};

function normalizeIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

export function QualityTicketOverdueNotifySettingModal({
  profile,
  open,
  onOpenChange,
  searchUsers,
  onSaved,
}: Props) {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance>(null);
  const [initLoading, setInitLoading] = useState(false);

  const title =
    profile === 'complaint'
      ? '设定客户投诉固定逾期提醒人'
      : profile === 'line-stop'
        ? '按停线类型设定固定逾期提醒人'
        : '按问题类型设定固定逾期提醒人';

  useEffect(() => {
    if (!open) return;
    setInitLoading(true);
    void getBusinessConfig()
      .then((cfg) => {
        const haoligo = cfg?.parameters?.haoligo ?? {};
        if (profile === 'complaint') {
          formRef.current?.setFieldsValue({
            complaint_overdue_notify_user_ids: normalizeIds(
              haoligo[QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY],
            ),
          });
          return;
        }
        if (profile === 'line-stop') {
          const parsed = parseQualityLineStopOverdueNotifyByKind(haoligo);
          formRef.current?.setFieldsValue({
            equipment_overdue_notify_user_ids: parsed.equipment ?? [],
            quality_overdue_notify_user_ids: parsed.quality ?? [],
          });
          return;
        }
        const parsed = parseQualityIssueOverdueNotifyByKind(haoligo);
        formRef.current?.setFieldsValue({
          equipment_overdue_notify_user_ids: parsed.equipment ?? [],
          product_overdue_notify_user_ids: parsed.product ?? [],
        });
      })
      .catch((e) => {
        message.error((e as Error).message || '加载设定失败');
      })
      .finally(() => setInitLoading(false));
  }, [message, open, profile]);

  return (
    <ModalForm
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      formRef={formRef}
      loading={initLoading}
      modalProps={{ destroyOnClose: true, width: 640 }}
      submitter={{ searchConfig: { submitText: '保存设定', resetText: '取消' } }}
      onFinish={async (values) => {
        const cfg = await getBusinessConfig();
        const haoligoParameters: Record<string, unknown> = { ...(cfg?.parameters?.haoligo ?? {}) };
        if (profile === 'complaint') {
          const ids = normalizeIds(values.complaint_overdue_notify_user_ids);
          await updateProcessParameter({
            category: 'haoligo',
            parameter_key: QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY,
            value: ids,
          });
          haoligoParameters[QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY] = ids;
        } else if (profile === 'line-stop') {
          const config: QualityLineStopOverdueNotifyByKindConfig = {
            equipment: normalizeIds(values.equipment_overdue_notify_user_ids),
            quality: normalizeIds(values.quality_overdue_notify_user_ids),
          };
          await updateProcessParameter({
            category: 'haoligo',
            parameter_key: QUALITY_LINE_STOP_OVERDUE_NOTIFY_BY_KIND_KEY,
            value: config,
          });
          haoligoParameters[QUALITY_LINE_STOP_OVERDUE_NOTIFY_BY_KIND_KEY] = config;
        } else {
          const config: QualityIssueOverdueNotifyByKindConfig = {
            equipment: normalizeIds(values.equipment_overdue_notify_user_ids),
            product: normalizeIds(values.product_overdue_notify_user_ids),
          };
          await updateProcessParameter({
            category: 'haoligo',
            parameter_key: QUALITY_ISSUE_OVERDUE_NOTIFY_BY_KIND_KEY,
            value: config,
          });
          haoligoParameters[QUALITY_ISSUE_OVERDUE_NOTIFY_BY_KIND_KEY] = config;
        }
        onSaved?.(haoligoParameters);
        message.success('已保存固定逾期提醒人设定');
        return true;
      }}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        保存后处理措施表单将自动预填固定提醒人；未设定时按部长职位关键词匹配。
      </Typography.Paragraph>
      {profile === 'complaint' ? (
        <div style={{ marginBottom: 8 }}>
          <Space style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>客户投诉</Typography.Text>
            <Button
              type="link"
              size="small"
              onClick={() => {
                void resolveMinisterUserIdsByKeywords(QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS).then((ids) => {
                  formRef.current?.setFieldsValue({ complaint_overdue_notify_user_ids: ids });
                });
              }}
            >
              按{QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS.join('、')}匹配
            </Button>
          </Space>
          <FormNotifyUsersSelect
            name="complaint_overdue_notify_user_ids"
            label={`固定逾期提醒人（${QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS.join('、')}）`}
            searchUsers={searchUsers}
            colSpan={24}
          />
        </div>
      ) : null}
      {profile === 'line-stop'
        ? QUALITY_LINE_STOP_KIND_OPTIONS.map((opt) => {
            const keywords = QUALITY_LINE_STOP_OVERDUE_MINISTER_KEYWORDS[opt.value].join('、');
            const fieldName =
              opt.value === 'quality' ? 'quality_overdue_notify_user_ids' : 'equipment_overdue_notify_user_ids';
            return (
              <div key={opt.value} style={{ marginBottom: 8 }}>
                <Space style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text strong>{opt.label}</Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      void resolveMinisterUserIdsByKeywords(QUALITY_LINE_STOP_OVERDUE_MINISTER_KEYWORDS[opt.value]).then(
                        (ids) => {
                          formRef.current?.setFieldsValue({ [fieldName]: ids });
                        },
                      );
                    }}
                  >
                    按{keywords}匹配
                  </Button>
                </Space>
                <FormNotifyUsersSelect
                  name={fieldName}
                  label={`固定逾期提醒人（${keywords}）`}
                  searchUsers={searchUsers}
                  colSpan={24}
                />
              </div>
            );
          })
        : null}
      {profile === 'default'
        ? QUALITY_ISSUE_KIND_OPTIONS.map((opt) => {
            const keywords = QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS[opt.value].join('、');
            const fieldName = `${opt.value}_overdue_notify_user_ids`;
            return (
              <div key={opt.value} style={{ marginBottom: 8 }}>
                <Space style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text strong>{opt.label}</Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      void resolveMinisterUserIdsByKeywords(QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS[opt.value]).then(
                        (ids) => {
                          formRef.current?.setFieldsValue({ [fieldName]: ids });
                        },
                      );
                    }}
                  >
                    按{keywords}匹配
                  </Button>
                </Space>
                <FormNotifyUsersSelect
                  name={fieldName}
                  label={`固定逾期提醒人（${keywords}）`}
                  searchUsers={searchUsers}
                  colSpan={24}
                />
              </div>
            );
          })
        : null}
    </ModalForm>
  );
}

/** @deprecated 使用 QualityTicketOverdueNotifySettingModal */
export const QualityIssueOverdueNotifySettingModal = QualityTicketOverdueNotifySettingModal;
