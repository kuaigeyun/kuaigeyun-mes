/**
 * 平台客户端发布管理（移动端 / 触屏终端 / PDA）
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import { CloudUploadOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
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

const ClientReleasesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [searchParams] = useSearchParams();
  const initialApp = searchParams.get('app_code') ?? undefined;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceRelease, setReplaceRelease] = useState<ClientRelease | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [detailRelease, setDetailRelease] = useState<ClientRelease | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const tableRowsRef = useRef<ClientRelease[]>([]);

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
    setReplaceRelease(null);
    setUploadOpen(true);
  };

  const handleReplacePackage = (record: ClientRelease) => {
    setReplaceRelease(record);
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
      messageApi.error(e instanceof Error ? e.message : t('pages.infra.clientReleases.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ProColumns<ClientRelease>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
      hideInSearch: true,
    },
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
      title: t('pages.infra.clientReleases.columnPackage'),
      width: 96,
      hideInSearch: true,
      render: (_, record) =>
        record.package?.url || record.apk?.url ? (
          <Tag color="success">{t('pages.infra.clientReleases.packageUploaded')}</Tag>
        ) : (
          <Tag>{t('pages.infra.clientReleases.packageMissing')}</Tag>
        ),
    },
    {
      title: t('pages.infra.clientReleases.columnStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.infra.clientReleases.statusActive'), status: 'Success' },
        false: { text: t('pages.infra.clientReleases.statusHistory'), status: 'Default' },
      },
      render: (_, record) =>
        record.is_active ? (
          <Tag color="success">{t('pages.infra.clientReleases.statusActive')}</Tag>
        ) : (
          <Tag>{t('pages.infra.clientReleases.statusHistory')}</Tag>
        ),
    },
    {
      title: t('pages.infra.clientReleases.columnRollout'),
      dataIndex: 'rollout_percent',
      width: 80,
      hideInSearch: true,
      render: (v) => `${v ?? 100}%`,
    },
    {
      title: t('pages.infra.clientReleases.columnNotes'),
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
      title: t('common.actions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const packageUrl = record.package?.url || record.apk?.url;
        const hasPackage = Boolean(packageUrl);
        const isPackageRelease = record.update_type === 'package' || record.update_type === 'both';
        const actions: React.ReactNode[] = [];

        actions.push(
          <Button
            {...rowActionKind('read')}
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          />,
        );

        if (hasPackage && packageUrl) {
          actions.push(
            <Button
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              key="download"
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(packageUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('pages.infra.clientReleases.downloadPackage')}
            </Button>,
          );
        }

        if (isPackageRelease) {
          actions.push(
            <Button
              {...rowActionKind('update')}
              key="upload"
              type="link"
              size="small"
              icon={<CloudUploadOutlined />}
              onClick={() => handleReplacePackage(record)}
            >
              {hasPackage
                ? t('pages.infra.clientReleases.replacePackageExisting')
                : t('pages.infra.clientReleases.replacePackage')}
            </Button>,
          );
        }

        if (!record.is_active) {
          actions.push(
            <Button
              {...rowActionKind('update')}
              key="activate"
              type="link"
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
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        );

        return actions.length ? <Space size={0} wrap>{actions}</Space> : '—';
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ClientRelease>
          columnPersistenceId="pages.infra.client-releases"
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

              tableRowsRef.current = list;

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
          showDeleteButton={false}
          toolBarActionsAfterCreate={[
            <Button key="client-config" icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>
              {t('pages.infra.clientReleases.clientConfigButton')}
            </Button>,
          ]}
          onDetail={(keys) => {
            const row = tableRowsRef.current.find((r) => r.id === keys[0]);
            if (row) handleOpenDetail(row);
          }}
          search={{ labelWidth: 'auto' }}
        />
      </ListPageTemplate>

      <ClientReleaseUploadModal
        open={uploadOpen}
        products={products ?? []}
        defaultClientKey={initialClientKey}
        existingRelease={replaceRelease}
        onClose={() => {
          setUploadOpen(false);
          setReplaceRelease(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
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
    </>
  );
};

export default ClientReleasesPage;
