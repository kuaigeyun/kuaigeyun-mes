/**
 * 平台许可证管理
 * 列表布局与物流「车辆管理」同构：一列 RemainderFlex 吃余量，其余 KeepWidth/Marker；
 * 禁止全 KeepWidth（filler 夹在状态/操作间）；操作仅目录双字，禁止 LabelKeep 四字文案。
 */

import { rowActionCopyCreate, rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { FormModalTemplate, ListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import { UniBatchButton } from '../../../components/uni-batch';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';
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
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';

const GLOBAL_SCOPE = '*';

export default function LicenseManagementPage() {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const appCodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(GLOBAL_SCOPE, t('pages.infra.licenseCenter.globalScope'));
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

  const columns: ProColumns<PlatformLicenseItem>[] = useMemo(
    () => [
      {
        // 余量列（同车辆「车型」）：禁止全表 KeepWidth，否则右固定前 filler 留巨空白 / 假横滚
        title: t('pages.infra.licenseCenter.scope'),
        dataIndex: 'app_code',
        key: 'app_code',
        minWidth: 120,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        valueType: 'select',
        valueEnum: scopeValueEnum,
        render: (_, record) => {
          const label = appCodeLabelMap.get(record.app_code) || record.app_code;
          return <MarkerTag color="processing">{label}</MarkerTag>;
        },
      },
      {
        title: t('pages.infra.licenseCenter.alias'),
        dataIndex: 'alias',
        key: 'alias',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, record) => record.alias || '-',
      },
      {
        title: t('pages.infra.licenseCenter.last4'),
        dataIndex: 'key_last4',
        key: 'key_last4',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, record) => `****${record.key_last4}`,
      },
      {
        title: t('pages.infra.licenseCenter.activationUsage'),
        dataIndex: 'current_activations',
        key: 'current_activations',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => `${record.current_activations}/${record.max_activations}`,
      },
      {
        title: t('common.remark'),
        dataIndex: 'remark',
        key: 'remark',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, record) => record.remark || '-',
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        key: 'lifecycle',
        fixed: 'right',
        hideInSearch: true,
        valueType: 'select',
        valueEnum: {
          true: { text: t('pages.infra.licenseCenter.active') },
          false: { text: t('pages.infra.licenseCenter.revoked') },
        },
        render: (_, record) =>
          record.is_active ? (
            <StatusTag color="success">{t('pages.infra.licenseCenter.active')}</StatusTag>
          ) : (
            <StatusTag color="default">{t('pages.infra.licenseCenter.revoked')}</StatusTag>
          ),
      },
      {
        title: t('common.action'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          // 目录「撤销审核」四字会撑操作列；仅此处 LabelKeep 收成双字「撤销」（车辆页本身无四字 kind）
          const nodes: React.ReactNode[] = [
            <Button
              key="copy"
              {...rowActionCopyCreate('skip')}
              onClick={async () => {
                try {
                  const resp = await getPlatformLicensePlainKey(record.uuid);
                  await copyTextToClipboard(resp.license_key);
                  messageApi.success(t('pages.infra.licenseCenter.copySuccess'));
                } catch (error: any) {
                  messageApi.error(
                    error?.message &&
                      !String(error.message).startsWith('clipboard_') &&
                      error.message !== 'empty_clipboard_text'
                      ? error.message
                      : t('pages.infra.licenseCenter.copyFailed'),
                  );
                }
              }}
            />,
          ];
          if (record.is_active) {
            nodes.push(
              <Button
                key="revoke"
                {...rowActionKind('revoke')}
                {...rowActionLabelKeep()}
                onClick={() => {
                  getAntdModal().confirm({
                    title: t('pages.infra.licenseCenter.revokeTitle'),
                    content: t('pages.infra.licenseCenter.revokeConfirm'),
                    onOk: async () => {
                      await revokePlatformLicense(record.uuid);
                      messageApi.success(t('pages.infra.licenseCenter.revokeSuccess'));
                      actionRef.current?.reload();
                    },
                  });
                }}
              >
                {t('pages.infra.licenseCenter.revoke')}
              </Button>,
            );
          }
          return nodes;
        },
      },
    ],
    [appCodeLabelMap, messageApi, scopeValueEnum, t],
  );

  const handleBatchRevoke = async (keys: React.Key[]) => {
    if (!keys.length) {
      return;
    }
    const results = await Promise.allSettled(
      keys.map((key) => revokePlatformLicense(String(key))),
    );
    const failed = results.filter((item) => item.status === 'rejected').length;
    const success = keys.length - failed;
    if (success > 0) {
      messageApi.success(t('pages.infra.licenseCenter.batchRevokeSuccess', { count: success }));
      actionRef.current?.clearSelected?.();
      actionRef.current?.reload();
    }
    if (failed > 0) {
      messageApi.error(t('pages.infra.licenseCenter.batchRevokeFailed', { count: failed }));
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<PlatformLicenseItem>
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('infra.licenseManagement')}
        columnPersistenceId="pages.infra.license-management-v8"
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        rowSelectionGetCheckboxProps={(record) => ({
          disabled: !record.is_active,
        })}
        request={async (params, _sort, _filter, searchFormValues) => {
          const form = (searchFormValues || {}) as Record<string, unknown>;
          const merged = { ...params, ...form } as Record<string, unknown>;
          const list = await listPlatformLicenses({
            app_code: (merged.app_code as string) || undefined,
            is_active:
              merged.is_active === undefined || merged.is_active === ''
                ? undefined
                : merged.is_active === 'true' || merged.is_active === true,
          });
          return { data: list, success: true, total: list.length };
        }}
        showAdvancedSearch
        showExportButton={false}
        showImportButton={false}
        showCreateButton
        createButtonText={t('pages.infra.licenseCenter.createButton')}
        onCreate={() => setModalOpen(true)}
        toolBarActionsAfterCreate={[
          <UniBatchButton
            key="batch-revoke"
            danger
            selectedRowKeys={selectedRowKeys}
            requireConfirm
            confirmTitle={(count) =>
              t('pages.infra.licenseCenter.batchRevokeConfirm', { count })
            }
            onAction={handleBatchRevoke}
          >
            {t('pages.infra.licenseCenter.batchRevoke')}
          </UniBatchButton>,
        ]}
      />

      <FormModalTemplate
        title={t('pages.infra.licenseCenter.createTitle')}
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
            messageApi.success(t('pages.infra.licenseCenter.createSuccess'));
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
                messageApi.success(t('pages.infra.licenseCenter.generateSuccess'));
              } finally {
                setGenerating(false);
              }
            }}
          >
            {t('pages.infra.licenseCenter.generateButton')}
          </Button>
        </div>
        <ProFormText.Password
          name="license_key"
          label={t('pages.infra.licenseCenter.licenseKey')}
          placeholder={t('pages.infra.licenseCenter.licenseKeyPlaceholder')}
          rules={[
            { required: true, message: t('common.required') },
            { min: 8, message: t('pages.infra.licenseCenter.licenseKeyMinLength') },
          ]}
          fieldProps={{ autoComplete: 'off' }}
        />
        <ProFormSelect
          name="app_code"
          label={t('pages.infra.licenseCenter.scope')}
          options={appCodeOptions}
          initialValue={GLOBAL_SCOPE}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormDigit
          name="max_activations"
          label={t('pages.infra.licenseCenter.maxActivations')}
          initialValue={1}
          fieldProps={{ min: 1, precision: 0 }}
          rules={[{ required: true, message: t('common.required') }]}
          extra={t('pages.infra.licenseCenter.maxActivationsHint')}
        />
        <ProFormText
          name="alias"
          label={t('pages.infra.licenseCenter.alias')}
          placeholder={t('pages.infra.licenseCenter.aliasPlaceholder')}
        />
        <ProFormTextArea
          name="remark"
          label={t('common.remark')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
}
