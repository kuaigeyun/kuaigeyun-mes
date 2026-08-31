/**
 * 平台级官方接口库管理
 * 官方库地址默认 https://kuaigeyun.com；本机为官方库真源时可修正/删除接口包。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Space } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { SaveOutlined } from '@ant-design/icons';
import { ListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import { MarkerTag } from '../../../constants/statusBadges';
import { formatDateTimeBySiteSetting } from '../../../utils/format';
import { getAntdModal } from '../../../utils/antdAppApis';
import {
  deleteOfficialApiLibraryAdminPack,
  getOfficialApiLibraryAdminMeta,
  listOfficialApiLibraryAdminPacks,
  updateOfficialApiLibraryAdminMeta,
  updateOfficialApiLibraryAdminPack,
  type OfficialApiLibraryAdminMeta,
  type OfficialApiLibraryPack,
} from '../../../services/officialApiLibraryAdmin';
import { OfficialApiLibraryPackEditModal } from './OfficialApiLibraryPackEditModal';

type StatusFilter = 'all' | 'published' | 'rejected';

const OfficialApiLibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [meta, setMeta] = useState<OfficialApiLibraryAdminMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [hostDraft, setHostDraft] = useState('');
  const [hostSaving, setHostSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const data = await getOfficialApiLibraryAdminMeta();
      setMeta(data);
      setHostDraft(data.host || data.default_host || '');
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.infra.officialApiLibrary.metaLoadFailed'));
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const handleSaveHost = async () => {
    setHostSaving(true);
    try {
      const data = await updateOfficialApiLibraryAdminMeta(hostDraft.trim());
      setMeta(data);
      setHostDraft(data.host || data.default_host || '');
      messageApi.success(t('pages.infra.officialApiLibrary.hostSaveSuccess'));
      if (data.manage_table_visible) {
        actionRef.current?.reload();
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.infra.officialApiLibrary.hostSaveFailed'));
    } finally {
      setHostSaving(false);
    }
  };

  const handleEdit = (record: OfficialApiLibraryPack) => {
    setEditingPackId(record.pack_id);
    setEditOpen(true);
  };

  const handleToggleStatus = async (record: OfficialApiLibraryPack) => {
    const next = record.status === 'published' ? 'rejected' : 'published';
    try {
      await updateOfficialApiLibraryAdminPack(record.pack_id, { status: next });
      messageApi.success(
        next === 'published'
          ? t('pages.infra.officialApiLibrary.publishSuccess')
          : t('pages.infra.officialApiLibrary.rejectSuccess'),
      );
      actionRef.current?.reload();
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.infra.officialApiLibrary.updateFailed'));
    }
  };

  const handleDelete = (record: OfficialApiLibraryPack) => {
    getAntdModal().confirm({
      title: t('pages.infra.officialApiLibrary.deleteConfirmTitle'),
      content: t('pages.infra.officialApiLibrary.deleteConfirmContent', {
        name: record.name,
        packId: record.pack_id,
      }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteOfficialApiLibraryAdminPack(record.pack_id);
          messageApi.success(t('pages.infra.officialApiLibrary.deleteSuccess'));
          actionRef.current?.reload();
        } catch (error: unknown) {
          const err = error as { message?: string };
          messageApi.error(err?.message || t('pages.infra.officialApiLibrary.deleteFailed'));
          throw error;
        }
      },
    });
  };

  const columns: ProColumns<OfficialApiLibraryPack>[] = useMemo(
    () => [
      {
        title: t('pages.infra.officialApiLibrary.packName'),
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        uniTablePrimaryFlex: true,
        render: (_, record) => (
          <a onClick={() => handleEdit(record)}>{record.name}</a>
        ),
      },
      {
        title: t('pages.infra.officialApiLibrary.packId'),
        dataIndex: 'pack_id',
        key: 'pack_id',
        width: 180,
        ellipsis: true,
        copyable: true,
      },
      {
        title: t('pages.infra.officialApiLibrary.connectorType'),
        dataIndex: 'connector_type',
        key: 'connector_type',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('pages.infra.officialApiLibrary.categoryName'),
        dataIndex: 'category_name',
        key: 'category_name',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('pages.infra.officialApiLibrary.apiCount'),
        dataIndex: 'api_count',
        key: 'api_count',
        width: 88,
        uniTableKeepWidth: true,
      },
      {
        title: t('pages.infra.officialApiLibrary.status'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        uniTableKeepWidth: true,
        render: (_, record) =>
          record.status === 'published' ? (
            <MarkerTag color="success">
              {t('pages.infra.officialApiLibrary.statusPublished')}
            </MarkerTag>
          ) : (
            <MarkerTag color="default">
              {t('pages.infra.officialApiLibrary.statusRejected')}
            </MarkerTag>
          ),
      },
      {
        title: t('pages.infra.officialApiLibrary.updatedAt'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 168,
        render: (_, record) =>
          record.updated_at ? formatDateTimeBySiteSetting(record.updated_at) : '—',
      },
      {
        title: t('common.action'),
        key: 'option',
        valueType: 'option',
        fixed: 'right',
        render: (_, record) => [
          <Button
            key="edit"
            type="link"
            size="small"
            {...rowActionKind('update')}
            onClick={() => handleEdit(record)}
          />,
          <Button
            key="toggle"
            type="link"
            size="small"
            {...rowActionKind('update')}
            {...rowActionLabelKeep()}
            onClick={() => void handleToggleStatus(record)}
          >
            {record.status === 'published'
              ? t('pages.infra.officialApiLibrary.actionReject')
              : t('pages.infra.officialApiLibrary.actionPublish')}
          </Button>,
          <Button
            key="delete"
            type="link"
            size="small"
            danger
            {...rowActionKind('delete')}
            onClick={() => handleDelete(record)}
          />,
        ],
      },
    ],
    [t],
  );

  const manageTableVisible = meta?.manage_table_visible === true;
  const defaultHost = meta?.default_host || 'kuaigeyun.com';

  return (
    <ListPageTemplate>
      <UniTable<OfficialApiLibraryPack>
        actionRef={actionRef}
        rowKey="pack_id"
        columns={columns}
        options={false}
        showCreateButton={false}
        showImportButton={false}
        showExportButton={false}
        columnPersistenceId="infra-official-api-library-v3"
        toolBarActions={[
          <Space key="official-host" size={8} align="center">
            <span>{t('pages.infra.officialApiLibrary.hostLabel')}</span>
            <Space.Compact style={{ width: 320 }}>
              <Input
                value={hostDraft}
                placeholder={defaultHost}
                disabled={metaLoading || hostSaving}
                onChange={(e) => setHostDraft(e.target.value)}
                onPressEnter={() => void handleSaveHost()}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={hostSaving}
                disabled={metaLoading}
                onClick={() => void handleSaveHost()}
              >
                {t('pages.infra.officialApiLibrary.hostSave')}
              </Button>
            </Space.Compact>
          </Space>,
        ]}
        beforeSearchButtons={
          <ThemedSegmented
            surfaceBackground
            size="middle"
            value={statusFilter}
            options={[
              { label: t('common.all'), value: 'all' },
              {
                label: t('pages.infra.officialApiLibrary.statusPublished'),
                value: 'published',
              },
              {
                label: t('pages.infra.officialApiLibrary.statusRejected'),
                value: 'rejected',
              },
            ]}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
          />
        }
        params={{ statusFilter, manageTableVisible }}
        request={async () => {
          if (!manageTableVisible) {
            return { data: [], success: true, total: 0 };
          }
          const result = await listOfficialApiLibraryAdminPacks(
            statusFilter === 'all' ? undefined : statusFilter,
          );
          return {
            data: result.items,
            success: true,
            total: result.items.length,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <OfficialApiLibraryPackEditModal
        open={editOpen}
        packId={editingPackId}
        onClose={() => {
          setEditOpen(false);
          setEditingPackId(null);
        }}
        onSaved={() => actionRef.current?.reload()}
      />
    </ListPageTemplate>
  );
};

export default OfficialApiLibraryPage;
