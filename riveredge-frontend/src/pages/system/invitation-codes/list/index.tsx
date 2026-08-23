/**
 * 邀请码管理列表页面
 *
 * 用于系统管理员查看和管理组织内的邀请码。
 * 支持邀请码的 CRUD 操作。
 * Schema 驱动 + 国际化
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import { renderSystemActiveTag } from '../../utils/systemListPresentation';
import { InvitationCodeFormModal } from '../components/InvitationCodeFormModal';
import {
  getInvitationCodeList,
  getInvitationCodeByUuid,
  deleteInvitationCode,
  InvitationCode,
} from '../../../../services/invitationCode';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { pickListSearchKeyword } from '../../../../utils/tableQueryKey';
import { getAntdModal } from '../../../../utils/antdAppApis';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';
const InvitationCodeListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentCodeUuid, setCurrentCodeUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<InvitationCode | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const handleCreate = () => {
    setCurrentCodeUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: InvitationCode) => {
    setCurrentCodeUuid(record.uuid);
    setModalVisible(true);
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getInvitationCodeByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: InvitationCode) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleDelete = async (record: InvitationCode) => {
    try {
      await deleteInvitationCode(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    getAntdModal().confirm({
      title: t('common.confirm'),
      content: t('field.invitationCode.batchDeleteConfirm', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const key of keys) {
            try {
              await deleteInvitationCode(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('common.deleteSuccess'));
          if (failCount > 0) {
            messageApi.error(
              `${t('common.deleteFailed')} ${failCount} ${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            );
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleCopy = useCallback(
    (code: string) => {
      navigator.clipboard
        .writeText(code)
        .then(() => messageApi.success(t('field.invitationCode.copySuccess')))
        .catch(() => messageApi.error(t('common.copyFailed')));
    },
    [messageApi, t]
  );

  const isCodeValid = useCallback((record: InvitationCode): boolean => {
    if (!record.is_active) return false;
    if (record.used_count >= record.max_uses) return false;
    if (record.expires_at) {
      if (new Date(record.expires_at) < new Date()) return false;
    }
    return true;
  }, []);

  const invitationDetailDescColumns = useMemo<ProDescriptionsItemProps<InvitationCode>[]>(
    () => [
      {
        title: t('field.invitationCode.code'),
        dataIndex: 'code',
        render: (_, record) => (
          <Space>
            <span style={{ fontFamily: CODE_FONT_FAMILY, fontSize: '16px', fontWeight: 'bold' }}>{record.code}</span>
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.code || '')}>
              {t('field.invitationCode.copy')}
            </Button>
          </Space>
        ),
      },
      {
        title: t('field.invitationCode.email'),
        dataIndex: 'email',
        render: (_, record) => record.email || '-',
      },
      {
        title: t('field.invitationCode.roleId'),
        dataIndex: 'role_id',
        render: (_, record) => record.role_id ?? '-',
      },
      {
        title: t('field.invitationCode.usedCount'),
        dataIndex: 'used_count',
        render: (_: unknown, record: InvitationCode) => `${record.used_count} / ${record.max_uses}`,
      },
      {
        title: t('field.invitationCode.expiresAt'),
        dataIndex: 'expires_at',
        valueType: 'dateTime',
        render: (_, record) => record.expires_at || t('field.invitationCode.neverExpires'),
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        render: (_, record) => {
          const value = !!record.is_active;
          const valid = isCodeValid(record);
          return (
            <Space>
              {renderSystemActiveTag(t, value, 'common.enabled', 'common.disabled')}
              {!valid && value && <Tag color="error">{t('field.invitationCode.invalid')}</Tag>}
            </Space>
          );
        },
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t, handleCopy, isCodeValid]
  );

  const columns: ProColumns<InvitationCode>[] = [
    {
      title: t('field.invitationCode.code'),
      dataIndex: 'code',
      width: 200,
      fixed: 'left',
      render: (_, record) => (
        <Space>
          <span style={{ fontFamily: CODE_FONT_FAMILY, fontSize: '14px' }}>{record.code}</span>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record.code)}
          >
            {t('field.invitationCode.copy')}
          </Button>
        </Space>
      ),
    },
    {
      title: t('field.invitationCode.email'),
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: t('field.invitationCode.usedCount'),
      dataIndex: 'used_count',
      width: 120,
      hideInSearch: true,
      render: (_, record) => `${record.used_count} / ${record.max_uses}`,
    },
    {
      title: t('field.invitationCode.expiresAt'),
      dataIndex: 'expires_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      render: (_, record) => record.expires_at || t('field.invitationCode.neverExpires'),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Space>
          <Tag color={record.is_active ? 'success' : 'default'}>
            {record.is_active ? t('common.enabled') : t('common.disabled')}
          </Tag>
          {!isCodeValid(record) && record.is_active && (
            <Tag color="error">{t('field.invitationCode.invalid')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('common.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('field.invitationCode.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('common.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<InvitationCode>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.invitationCodes')}
          columnPersistenceId="pages.system.invitation-codes.list"
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            const keyword = pickListSearchKeyword(searchFormValues);
            if (keyword) {
              apiParams.keyword = keyword;
            }
            if (
              searchFormValues?.is_active !== undefined &&
              searchFormValues.is_active !== '' &&
              searchFormValues.is_active !== null
            ) {
              apiParams.is_active = searchFormValues.is_active;
            }
            try {
              const response = await getInvitationCodeList(apiParams);
              return { data: response.items, success: true, total: response.total };
            } catch (error: any) {
              messageApi.error(error?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('field.invitationCode.createTitle')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('common.batchDelete')}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getInvitationCodeList({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `invitation-codes-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.operationFailed'));
            }
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
      </ListPageTemplate>

      <InvitationCodeFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentCodeUuid(null);
        }}
        editUuid={currentCodeUuid}
        onSuccess={() => actionRef.current?.reload()}
      />

      <SystemMasterDetailDrawer
        title={t('field.invitationCode.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
          setDetailError(null);
        }}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryUuidRef.current;
          if (id) void loadDetail(id);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(detailData), () => {
          if (!detailData) return;
          handleEdit(detailData);
        })}
        detail={detailData}
        detailColumns={invitationDetailDescColumns}
      />
    </>
  );
};

export default InvitationCodeListPage;
