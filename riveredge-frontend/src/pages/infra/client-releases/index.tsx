/**
 * 平台客户端发布管理（移动端 / 触屏终端 / PDA）
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, QrcodeOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import { StatusTag } from '../../../constants/statusBadges';
import {
  activateClientRelease,
  deleteClientRelease,
  listClientProducts,
  listClientReleases,
  type ClientRelease,
} from '../../../services/clientRelease';
import { ClientReleaseUploadModal } from './ClientReleaseUploadModal';
import { ClientReleaseDetailDrawer } from './ClientReleaseDetailDrawer';
import { ClientProductConfigDrawer } from './ClientProductConfigDrawer';
import { ClientMiniprogramQrModal } from './ClientMiniprogramQrModal';
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';

const ClientReleasesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const [searchParams] = useSearchParams();
  const initialApp = searchParams.get('app_code') ?? undefined;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ClientRelease | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [detailRelease, setDetailRelease] = useState<ClientRelease | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [miniprogramQrOpen, setMiniprogramQrOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['clientProducts'],
    queryFn: () => listClientProducts(),
  });

  const initialClientKey = useMemo(() => {
    if (!initialApp || !products?.length) return undefined;
    return products.find((p) => p.app_code === initialApp)?.client_key;
  }, [initialApp, products]);

  const productMap = useMemo(
    () => new Map((products ?? []).map((p) => [p.client_key, p.display_name])),
    [products],
  );

  const clientSearchOptions = useMemo(
    () =>
      (products ?? []).map((p) => ({
        label: `${p.display_name} (${p.client_key})`,
        value: p.client_key,
      })),
    [products],
  );

  const handleCreate = () => {
    setEditingRelease(null);
    setUploadOpen(true);
  };

  const handleEdit = (record: ClientRelease) => {
    setEditingRelease(record);
    setUploadOpen(true);
  };

  const handleOpenDetail = (record: ClientRelease) => {
    setDetailRelease(record);
  };

  const handleActivate = async (record: ClientRelease) => {
    try {
      setActivatingId(record.id);
      await activateClientRelease(record.id);
      messageApi.success(t('pages.infra.clientReleases.activateSuccess'));
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : t('pages.infra.clientReleases.activateFailed'));
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (record: ClientRelease) => {
    try {
      setDeletingId(record.id);
      await deleteClientRelease(record.id);
      messageApi.success(t('pages.infra.clientReleases.deleteSuccess'));
      if (detailRelease?.id === record.id) {
        setDetailRelease(null);
      }
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : t('common.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) {
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => deleteClientRelease(id)));
    const failed = results.filter((item) => item.status === 'rejected').length;
    const success = ids.length - failed;
    if (success > 0) {
      messageApi.success(t('common.batchDeleteSuccess', { count: success }));
      actionRef.current?.clearSelected?.();
      actionRef.current?.reload();
    }
    if (failed > 0) {
      messageApi.error(t('common.batchDeletePartial', { count: failed, errors: '' }));
    }
  };

  const columns: ProColumns<ClientRelease>[] = [
    {
      title: t('pages.infra.clientReleases.columnClient'),
      dataIndex: 'client_key',
      valueType: 'select',
      fieldProps: { options: clientSearchOptions, allowClear: true },
      initialValue: initialClientKey,
      render: (_, record) => productMap.get(record.client_key) ?? record.client_key,
    },
    {
      title: t('pages.infra.clientReleases.columnPlatform'),
      dataIndex: 'platform',
      width: 100,
      valueType: 'select',
      valueEnum: {
        android: { text: 'Android' },
        ios: { text: 'iOS' },
        windows: { text: 'Windows' },
      },
    },
    {
      title: t('pages.infra.clientReleases.columnVersion'),
      dataIndex: 'app_version',
      hideInSearch: true,
      render: (_, record) =>
        `${record.app_version}${record.version_code ? ` (${record.version_code})` : ''}`,
    },
    {
      title: t('pages.infra.clientReleases.columnUpdateType'),
      dataIndex: 'update_type',
      width: 96,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.clientReleases.columnRollout'),
      dataIndex: 'rollout_percent',
      width: 80,
      hideInSearch: true,
      render: (v) => `${v ?? 100}%`,
    },
    {
      title: t('common.remark'),
      dataIndex: 'release_notes',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.infra.clientReleases.columnPublishedAt'),
      dataIndex: 'published_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'lifecycle',
      width: 100,
      fixed: 'right',
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.infra.clientReleases.statusActive'), status: 'Success' },
        false: { text: t('pages.infra.clientReleases.statusHistory'), status: 'Default' },
      },
      render: (_, record) =>
        record.is_active ? (
          <StatusTag color="success">{t('pages.infra.clientReleases.statusActive')}</StatusTag>
        ) : (
          <StatusTag color="default">{t('pages.infra.clientReleases.statusHistory')}</StatusTag>
        ),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const packageUrl = record.package?.url || record.apk?.url;
        const actions: React.ReactNode[] = [];

        actions.push(
          <Button
            {...rowActionKind('read')}
            key="detail"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          />,
        );

        actions.push(
          <Button
            {...rowActionKind('update')}
            key="edit"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>,
        );

        if (packageUrl) {
          actions.push(
            <Button
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              key="download"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(packageUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('pages.infra.clientReleases.downloadPackage')}
            </Button>,
          );
        }

        if (!record.is_active) {
          actions.push(
            <Button
              {...rowActionKind('update')}
              key="activate"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={activatingId === record.id}
              onClick={() => void handleActivate(record)}
            >
              {t('pages.infra.clientReleases.activate')}
            </Button>,
          );
        }

        actions.push(
          <Popconfirm
            {...rowActionKind('delete')}
            key="delete"
            title={t('pages.infra.clientReleases.deleteConfirmTitle')}
            description={t('pages.infra.clientReleases.deleteConfirmDesc', {
              version: record.app_version,
              code: record.version_code,
            })}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleDelete(record)}
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        );

        return actions.length ? actions : '—';
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ClientRelease>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('infra.clientReleases')}
          columnPersistenceId="pages.infra.client-releases-v4"
          actionRef={actionRef}
          columns={columns}
          rowKey="id"
          request={async (_params, _sort, _filter, searchFormValues) => {
            try {
              const clientKey = searchFormValues?.client_key as string | undefined;
              const platform = searchFormValues?.platform as string | undefined;
              const isActive = searchFormValues?.is_active;

              let list = await listClientReleases({
                client_key: clientKey || undefined,
                platform: platform || undefined,
              });

              if (isActive !== undefined && isActive !== '' && isActive !== null) {
                const active = isActive === true || isActive === 'true';
                list = list.filter((row) => row.is_active === active);
              }

              return {
                data: list,
                success: true,
                total: list.length,
              };
            } catch (error: unknown) {
              messageApi.error(
                error instanceof Error ? error.message : t('pages.infra.clientReleases.fetchFailed'),
              );
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('pages.infra.clientReleases.createButton')}
          onCreate={handleCreate}
          showImportButton={false}
          showExportButton={false}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('common.batchDelete')}
          enableRowSelection
          toolBarActionsAfterCreate={[
            <Button key="miniprogram-qr" icon={<QrcodeOutlined />} onClick={() => setMiniprogramQrOpen(true)}>
              {t('pages.infra.clientReleases.miniprogramQrButton')}
            </Button>,
            <Button key="client-config" icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>
              {t('pages.infra.clientReleases.clientConfigButton')}
            </Button>,
          ]}
          search={{ labelWidth: 'auto' }}
        />
      </ListPageTemplate>

      <ClientReleaseUploadModal
        key={editingRelease ? `edit-${editingRelease.id}` : 'create'}
        open={uploadOpen}
        products={products ?? []}
        defaultClientKey={initialClientKey}
        existingRelease={editingRelease}
        onClose={() => {
          setUploadOpen(false);
          setEditingRelease(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
          void queryClient.invalidateQueries({ queryKey: ['clientProducts'] });
        }}
      />

      <ClientReleaseDetailDrawer
        open={detailRelease != null}
        release={detailRelease}
        clientLabel={
          detailRelease ? productMap.get(detailRelease.client_key) ?? detailRelease.client_key : undefined
        }
        onClose={() => setDetailRelease(null)}
      />

      <ClientProductConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />

      <ClientMiniprogramQrModal open={miniprogramQrOpen} onClose={() => setMiniprogramQrOpen(false)} />
    </>
  );
};

export default ClientReleasesPage;
