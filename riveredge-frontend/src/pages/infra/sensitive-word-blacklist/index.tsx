/**
 * 平台敏感词黑名单管理（仅对开启敏感词控制的组织生效）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Alert, Button, Form, Input, Popconfirm, Select, Space, Spin } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { UnlockOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import { UniBatchButton } from '../../../components/uni-batch';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import { formatDateTimeBySiteSetting } from '../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';
import {
  addTenantSensitiveWordAllowlist,
  getSensitiveWordBlacklistMeta,
  listSensitiveWordBans,
  listTenantSensitiveWordAllowlist,
  removeTenantSensitiveWordAllowlist,
  unbanSensitiveWordSubject,
  type SensitiveWordBanItem,
  type SensitiveWordBlacklistMeta,
  type TenantSensitiveWordAllowlistItem,
} from '../../../services/sensitiveWordBlacklist';

const SensitiveWordBlacklistPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const banActionRef = useRef<ActionType>(null);
  const allowlistActionRef = useRef<ActionType>(null);
  const [meta, setMeta] = useState<SensitiveWordBlacklistMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bans');
  const [selectedTenantId, setSelectedTenantId] = useState<number | undefined>();
  const [banSelectedRowKeys, setBanSelectedRowKeys] = useState<React.Key[]>([]);
  const [allowlistForm] = Form.useForm();
  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const data = await getSensitiveWordBlacklistMeta();
      setMeta(data);
      setSelectedTenantId((prev) => prev ?? data.enabled_tenants[0]?.id);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('common.loadFailed');
      message.error(errMsg);
      setMeta({ menu_visible: false, enabled_tenant_count: 0, enabled_tenants: [] });
    } finally {
      setMetaLoading(false);
    }
  }, [message, t]);
  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);
  const tenantOptions = useMemo(
    () =>
      (meta?.enabled_tenants ?? []).map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [meta?.enabled_tenants],
  );
  const handleTenantFilterChange = useCallback((value: number | undefined) => {
    setSelectedTenantId(value);
    banActionRef.current?.reload();
    allowlistActionRef.current?.reload();
  }, []);
  const banTenantFilter = useMemo(
    () => (
      <Select
        allowClear
        placeholder={t('pages.infra.sensitiveWordBlacklist.filterTenant')}
        style={{ width: 220 }}
        options={tenantOptions}
        value={selectedTenantId}
        onChange={handleTenantFilterChange}
      />
    ),
    [handleTenantFilterChange, selectedTenantId, t, tenantOptions],
  );
  const handleUnban = async (record: SensitiveWordBanItem) => {
    try {
      await unbanSensitiveWordSubject(record.id);
      message.success(t('pages.infra.sensitiveWordBlacklist.unbanSuccess'));
      banActionRef.current?.reload();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('common.operationFailed');
      message.error(errMsg);
    }
  };
  const handleBatchUnban = async (keys: React.Key[]) => {
    const ids = keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) {
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => unbanSensitiveWordSubject(id)));
    const failed = results.filter((item) => item.status === 'rejected').length;
    const success = ids.length - failed;
    if (success > 0) {
      message.success(t('pages.infra.sensitiveWordBlacklist.batchUnbanSuccess', { count: success }));
      banActionRef.current?.clearSelected?.();
      banActionRef.current?.reload();
    }
    if (failed > 0) {
      message.error(t('pages.infra.sensitiveWordBlacklist.batchUnbanFailed', { count: failed }));
    }
  };
  const handleBatchDeleteAllowlist = async (keys: React.Key[]) => {
    const ids = keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) {
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => removeTenantSensitiveWordAllowlist(id)));
    const failed = results.filter((item) => item.status === 'rejected').length;
    const success = ids.length - failed;
    if (success > 0) {
      message.success(t('pages.infra.sensitiveWordBlacklist.batchDeleteAllowlistSuccess', { count: success }));
      allowlistActionRef.current?.clearSelected?.();
      allowlistActionRef.current?.reload();
    }
    if (failed > 0) {
      message.error(t('common.deleteFailed'));
    }
  };
  const handleAddAllowlist = async () => {
    if (!selectedTenantId) {
      message.warning(t('pages.infra.sensitiveWordBlacklist.selectTenantFirst'));
      return;
    }
    try {
      const values = await allowlistForm.validateFields();
      await addTenantSensitiveWordAllowlist({
        tenant_id: selectedTenantId,
        word: values.word,
        note: values.note,
      });
      message.success(t('common.createSuccess'));
      allowlistForm.resetFields();
      allowlistActionRef.current?.reload();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      const errMsg = error instanceof Error ? error.message : t('common.createFailed');
      message.error(errMsg);
    }
  };
  const allowlistSearchButtons = useMemo(
    () => (
      <Space wrap size={8}>
        <Select
          placeholder={t('pages.infra.sensitiveWordBlacklist.selectTenant')}
          style={{ width: 220 }}
          options={tenantOptions}
          value={selectedTenantId}
          onChange={handleTenantFilterChange}
        />
        <Form form={allowlistForm} layout="inline">
          <Form.Item
            name="word"
            rules={[{ required: true, message: t('pages.infra.sensitiveWordBlacklist.wordRequired') }]}
          >
            <Input placeholder={t('pages.infra.sensitiveWordBlacklist.wordPlaceholder')} maxLength={128} />
          </Form.Item>
          <Form.Item name="note">
            <Input placeholder={t('pages.infra.sensitiveWordBlacklist.notePlaceholder')} maxLength={255} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={() => void handleAddAllowlist()}>
              {t('pages.infra.sensitiveWordBlacklist.addAllowWord')}
            </Button>
          </Form.Item>
        </Form>
      </Space>
    ),
    [allowlistForm, handleAddAllowlist, handleTenantFilterChange, selectedTenantId, t, tenantOptions],
  );
  const banColumns: ProColumns<SensitiveWordBanItem>[] = [
    {
      title: t('pages.infra.sensitiveWordBlacklist.colTenant'),
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colUserId'),
      dataIndex: 'user_id',
      key: 'user_id',
      width: 90,
      minWidth: 90,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colUser'),
      dataIndex: 'username',
      key: 'username',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.full_name || record.username || '-',
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colIp'),
      dataIndex: 'client_ip',
      key: 'client_ip',
      width: 360,
      minWidth: 360,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colBannedAt'),
      dataIndex: 'banned_at',
      key: 'banned_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, record) => formatDateTimeBySiteSetting(record.banned_at),
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colRequestPath'),
      dataIndex: 'trigger_request_path',
      key: 'trigger_request_path',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colField'),
      dataIndex: 'trigger_field_path',
      key: 'trigger_field_path',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colMatchedWord'),
      dataIndex: 'trigger_matched_word',
      key: 'trigger_matched_word',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colContent'),
      dataIndex: 'trigger_content_snippet',
      key: 'trigger_content_snippet',
      minWidth: 160,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Popconfirm
          title={t('pages.infra.sensitiveWordBlacklist.unbanConfirm')}
          onConfirm={() => handleUnban(record)}
        >
          <Button {...rowActionKind('execute')} {...rowActionLabelKeep()}>
            {t('pages.infra.sensitiveWordBlacklist.unban')}
          </Button>
        </Popconfirm>
      ),
    },
  ];
  const allowlistColumns: ProColumns<TenantSensitiveWordAllowlistItem>[] = [
    {
      title: t('pages.infra.sensitiveWordBlacklist.colWord'),
      dataIndex: 'word',
      key: 'word',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
    },
    {
      title: t('pages.infra.sensitiveWordBlacklist.colNote'),
      dataIndex: 'note',
      key: 'note',
      minWidth: 160,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: true,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => formatDateTimeBySiteSetting(record.created_at),
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Popconfirm
          title={t('common.deleteConfirm')}
          onConfirm={async () => {
            try {
              await removeTenantSensitiveWordAllowlist(record.id);
              message.success(t('common.deleteSuccess'));
              allowlistActionRef.current?.reload();
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : t('common.deleteFailed');
              message.error(errMsg);
            }
          }}
        >
          <Button {...rowActionKind('delete')} />
        </Popconfirm>
      ),
    },
  ];
  const pageHeader = !metaLoading && !meta?.enabled_tenant_count
      ? (
        <Alert
          type="info"
          showIcon
          title={t('pages.infra.sensitiveWordBlacklist.emptyTitle')}
          description={t('pages.infra.sensitiveWordBlacklist.emptyDescription')}
        />
      )
      : undefined;
  return (
    <Spin spinning={metaLoading}>
      <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
      preserveMounted
      header={pageHeader}
      tabs={[
        {
          key: 'bans',
          label: t('pages.infra.sensitiveWordBlacklist.tabBans'),
          children: (
            <UniTable<SensitiveWordBanItem>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('infra.sensitiveWordBlacklist')}
              columnPersistenceId="pages.infra.sensitive-word-blacklist.bans-v3"
              actionRef={banActionRef}
              rowKey="id"
              columns={banColumns}
              search={false}
              showFuzzySearch={false}
              showAdvancedSearch={false}
              beforeSearchButtons={banTenantFilter}
              enableRowSelection
              onRowSelectionChange={setBanSelectedRowKeys}
              toolBarActionsAfterDelete={[
                <UniBatchButton
                  key="batch-unban"
                  icon={<UnlockOutlined />}
                  selectedRowKeys={banSelectedRowKeys}
                  requireConfirm
                  confirmTitle={(count) =>
                    t('pages.infra.sensitiveWordBlacklist.batchUnbanConfirm', { count })
                  }
                  onAction={handleBatchUnban}
                >
                  {t('pages.infra.sensitiveWordBlacklist.batchUnban')}
                </UniBatchButton>,
              ]}
              request={async (params) => {
                if (!meta?.enabled_tenant_count) {
                  return { data: [], success: true, total: 0 };
                }
                const res = await listSensitiveWordBans({
                  page: params.current || 1,
                  page_size: params.pageSize || 20,
                  tenant_id: selectedTenantId,
                  active_only: true,
                });
                return { data: res.items, success: true, total: res.total };
              }}
            />
          ),
        },
        {
          key: 'allowlist',
          label: t('pages.infra.sensitiveWordBlacklist.tabAllowlist'),
          children: (
            <UniTable<TenantSensitiveWordAllowlistItem>
              columnPersistenceId="pages.infra.sensitive-word-blacklist.allowlist-v3"
              actionRef={allowlistActionRef}
              rowKey="id"
              columns={allowlistColumns}
              search={false}
              showFuzzySearch={false}
              showAdvancedSearch={false}
              beforeSearchButtons={allowlistSearchButtons}
              enableRowSelection
              showDeleteButton
              deleteButtonText={t('common.batchDelete')}
              deleteConfirmDescription={(count) =>
                t('pages.infra.sensitiveWordBlacklist.batchDeleteAllowlistConfirm', { count })
              }
              onDelete={handleBatchDeleteAllowlist}
              request={async (params) => {
                  if (!selectedTenantId) {
                    return { data: [], success: true, total: 0 };
                  }
                  const res = await listTenantSensitiveWordAllowlist({
                    tenant_id: selectedTenantId,
                    page: params.current || 1,
                    page_size: params.pageSize || 50,
                  });
                  return { data: res.items, success: true, total: res.total };
                }}
            />
          ),
        },
      ]}
    />
    </Spin>
  );
};
export default SensitiveWordBlacklistPage;
