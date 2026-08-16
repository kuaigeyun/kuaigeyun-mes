/**
 * 平台许可证管理
 */

import { rowActionKind } from '../../../components/uni-action';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { FormModalTemplate, ListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import {
  PRO_APP_CODES,
  PRO_PLACEHOLDER_META,
} from '../../system/applications/proAppCatalog';
import {
  createPlatformLicense,
  generatePlatformLicenseKey,
  getPlatformLicensePlainKey,
  listPlatformLicenses,
  revokePlatformLicense,
  type PlatformLicenseItem,
} from '../../../services/licenseCenter';
import { getAntdModal } from '../../../utils/antdAppApis';
import { copyTextToClipboard } from '../../../utils/clipboard';

const GLOBAL_SCOPE = '*';

export default function LicenseManagementPage() {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const appCodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(
      GLOBAL_SCOPE,
      t('pages.infra.licenseCenter.globalScope', { defaultValue: '全部 PRO 应用' }),
    );
    for (const code of PRO_APP_CODES) {
      const meta = PRO_PLACEHOLDER_META[code];
      map.set(code, t(meta.nameKey, { defaultValue: meta.nameDefault }));
    }
    return map;
  }, [t]);

  const appCodeOptions = useMemo(
    () =>
      Array.from(appCodeLabelMap.entries()).map(([value, label]) => ({
        label,
        value,
      })),
    [appCodeLabelMap],
  );

  const scopeValueEnum = useMemo(() => {
    const valueEnum: Record<string, { text: string }> = {};
    for (const [value, label] of appCodeLabelMap.entries()) {
      valueEnum[value] = { text: label };
    }
    return valueEnum;
  }, [appCodeLabelMap]);

  const columns: ProColumns<PlatformLicenseItem>[] = [
    {
      title: t('pages.infra.licenseCenter.scope', { defaultValue: '适用范围' }),
      dataIndex: 'app_code',
      width: 180,
      valueType: 'select',
      valueEnum: scopeValueEnum,
      render: (_, record) => appCodeLabelMap.get(record.app_code) || record.app_code,
    },
    {
      title: t('pages.infra.licenseCenter.alias', { defaultValue: '别名' }),
      dataIndex: 'alias',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.alias || '-',
    },
    {
      title: t('pages.infra.licenseCenter.last4', { defaultValue: '密钥尾号' }),
      dataIndex: 'key_last4',
      width: 120,
      render: (_, record) => `****${record.key_last4}`,
    },
    {
      title: t('pages.infra.licenseCenter.status', { defaultValue: '状态' }),
      dataIndex: 'is_active',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.infra.licenseCenter.active', { defaultValue: '生效中' }), status: 'Success' },
        false: { text: t('pages.infra.licenseCenter.revoked', { defaultValue: '已撤销' }), status: 'Default' },
      },
      render: (_, record) =>
        record.is_active ? (
          <Tag color="success">{t('pages.infra.licenseCenter.active', { defaultValue: '生效中' })}</Tag>
        ) : (
          <Tag>{t('pages.infra.licenseCenter.revoked', { defaultValue: '已撤销' })}</Tag>
        ),
    },
    {
      title: t('pages.infra.licenseCenter.activationUsage', { defaultValue: '激活使用' }),
      dataIndex: 'current_activations',
      width: 140,
      hideInSearch: true,
      render: (_, record) => `${record.current_activations}/${record.max_activations}`,
    },
    {
      title: t('pages.infra.licenseCenter.remark', { defaultValue: '备注' }),
      dataIndex: 'remark',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.remark || '-',
    },
    {
      title: t('common.updatedAt', { defaultValue: '更新时间' }),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 180,
      hideInSearch: true,
    },
    {
      title: t('common.actions', { defaultValue: '操作' }),
      valueType: 'option',
      render: (_, record) => (
        <Space>
          <Button
            key="copy"
            {...rowActionKind('read')}
            size="small"
            icon={<CopyOutlined />}
            onClick={async () => {
              try {
                const resp = await getPlatformLicensePlainKey(record.uuid);
                await copyTextToClipboard(resp.license_key);
                messageApi.success(t('pages.infra.licenseCenter.copySuccess', { defaultValue: 'License Key 已复制' }));
              } catch (error: any) {
                messageApi.error(
                  error?.message && !String(error.message).startsWith('clipboard_') && error.message !== 'empty_clipboard_text'
                    ? error.message
                    : t('pages.infra.licenseCenter.copyFailed', { defaultValue: '复制失败，请重试' }),
                );
              }
            }}
          >
            {t('pages.infra.licenseCenter.copyKey', { defaultValue: '复制KEY' })}
          </Button>
          <Button
            key="revoke"
            {...rowActionKind('revoke')}
            size="small"
            danger
            disabled={!record.is_active}
            onClick={() => {
              getAntdModal().confirm({
                title: t('pages.infra.licenseCenter.revokeTitle', { defaultValue: '撤销许可证' }),
                content: t('pages.infra.licenseCenter.revokeConfirm', { defaultValue: '撤销后将不能再用于新激活，是否继续？' }),
                onOk: async () => {
                  await revokePlatformLicense(record.uuid);
                  messageApi.success(t('pages.infra.licenseCenter.revokeSuccess', { defaultValue: '许可证已撤销' }));
                  actionRef.current?.reload();
                },
              });
            }}
          >
            {t('pages.infra.licenseCenter.revoke', { defaultValue: '撤销' })}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<PlatformLicenseItem>
        columnPersistenceId="pages.infra.license-management"
        headerTitle={t('menu.infra.license-management')}
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        request={async (params) => {
          const list = await listPlatformLicenses({
            app_code: (params as any).app_code || undefined,
            is_active:
              (params as any).is_active === undefined || (params as any).is_active === ''
                ? undefined
                : (params as any).is_active === 'true' || (params as any).is_active === true,
          });
          return { data: list, success: true, total: list.length };
        }}
        showAdvancedSearch
        showExportButton={false}
        showImportButton={false}
        toolBarRender={() => [
          <Button {...rowActionKind('create')} key="create" type="primary" onClick={() => setModalOpen(true)}>
            {t('pages.infra.licenseCenter.createButton', { defaultValue: '新增许可证' })}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title={t('pages.infra.licenseCenter.createTitle', { defaultValue: '新增许可证密钥' })}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onFinish={async (values: any) => {
          try {
            setSubmitting(true);
            await createPlatformLicense({
              license_key: values.license_key,
              app_code: values.app_code || GLOBAL_SCOPE,
              max_activations: values.max_activations || 1,
              alias: values.alias?.trim() || undefined,
              remark: values.remark?.trim() || undefined,
            });
            messageApi.success(t('pages.infra.licenseCenter.createSuccess', { defaultValue: '许可证创建成功' }));
            setModalOpen(false);
            actionRef.current?.reload();
            return;
          } finally {
            setSubmitting(false);
          }
        }}
        isEdit={false}
        loading={submitting}
        formRef={formRef}
      >
        <div style={{ marginBottom: 12 }}>
          <Button
            icon={<ReloadOutlined />}
            loading={generating}
            onClick={async () => {
              try {
                setGenerating(true);
                const appCode = formRef.current?.getFieldValue?.('app_code') || GLOBAL_SCOPE;
                const generated = await generatePlatformLicenseKey(appCode);
                formRef.current?.setFieldsValue({
                  license_key: generated.license_key,
                });
                messageApi.success(t('pages.infra.licenseCenter.generateSuccess', { defaultValue: 'License Key 已自动生成' }));
              } finally {
                setGenerating(false);
              }
            }}
          >
            {t('pages.infra.licenseCenter.generateButton', { defaultValue: '自动生成 License Key' })}
          </Button>
        </div>
        <ProFormText.Password
          name="license_key"
          label={t('pages.infra.licenseCenter.licenseKey', { defaultValue: 'License Key（许可证密钥）' })}
          placeholder={t('pages.infra.licenseCenter.licenseKeyPlaceholder', { defaultValue: '请输入 License Key' })}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }, { min: 8, message: '至少 8 位' }]}
          fieldProps={{ autoComplete: 'off' }}
        />
        <ProFormSelect
          name="app_code"
          label={t('pages.infra.licenseCenter.scope', { defaultValue: '适用范围' })}
          options={appCodeOptions}
          initialValue={GLOBAL_SCOPE}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
        />
        <ProFormDigit
          name="max_activations"
          label={t('pages.infra.licenseCenter.maxActivations', { defaultValue: '最大激活租户数' })}
          initialValue={1}
          fieldProps={{ min: 1, precision: 0 }}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          extra={t('pages.infra.licenseCenter.maxActivationsHint', { defaultValue: '默认 1，表示该 Key 仅允许 1 个租户激活。' })}
        />
        <ProFormText
          name="alias"
          label={t('pages.infra.licenseCenter.alias', { defaultValue: '别名' })}
          placeholder={t('pages.infra.licenseCenter.aliasPlaceholder', { defaultValue: '例如：AI 演示许可' })}
        />
        <ProFormTextArea
          name="remark"
          label={t('pages.infra.licenseCenter.remark', { defaultValue: '备注' })}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
}
