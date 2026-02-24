/**
 * 邀请码管理列表页面
 *
 * 用于系统管理员查看和管理组织内的邀请码。
 * 支持邀请码的 CRUD 操作。
 * Schema 驱动 + 国际化
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { InvitationCodeFormModal } from '../components/InvitationCodeFormModal';
import {
  getInvitationCodeList,
  getInvitationCodeByUuid,
  deleteInvitationCode,
  InvitationCode,
} from '../../../../services/invitationCode';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';

const InvitationCodeListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentCodeUuid, setCurrentCodeUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<InvitationCode | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleCreate = () => {
    setCurrentCodeUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: InvitationCode) => {
    setCurrentCodeUuid(record.uuid);
    setModalVisible(true);
  };

  const handleView = async (record: InvitationCode) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getInvitationCodeByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: InvitationCode) => {
    try {
      await deleteInvitationCode(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    Modal.confirm({
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
              errors.push(error.message || t('pages.system.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('pages.system.deleteSuccess'));
          if (failCount > 0) {
            messageApi.error(
              `${t('pages.system.deleteFailed')} ${failCount} ${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            );
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
        }
      },
    });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => messageApi.success(t('field.invitationCode.copySuccess')))
      .catch(() => messageApi.error(t('common.copyFailed')));
  };

  const isCodeValid = (record: InvitationCode): boolean => {
    if (!record.is_active) return false;
    if (record.used_count >= record.max_uses) return false;
    if (record.expires_at) {
      if (new Date(record.expires_at) < new Date()) return false;
    }
    return true;
  };

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
      title: t('field.role.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.enabled'), status: 'Success' },
        false: { text: t('field.role.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Space>
          <Tag color={record.is_active ? 'success' : 'default'}>
            {record.is_active ? t('field.role.enabled') : t('field.role.disabled')}
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            {t('field.invitationCode.view')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('field.invitationCode.edit')}
          </Button>
          <Popconfirm
            title={t('field.invitationCode.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              {t('field.invitationCode.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<InvitationCode>
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
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
          deleteButtonText={t('pages.system.batchDelete')}
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
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `invitation-codes-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
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

      <DetailDrawerTemplate
        title={t('field.invitationCode.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: t('field.invitationCode.code'),
            dataIndex: 'code',
            render: (value: string) => (
              <Space>
                <span style={{ fontFamily: CODE_FONT_FAMILY, fontSize: '16px', fontWeight: 'bold' }}>{value}</span>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(value)}
                >
                  {t('field.invitationCode.copy')}
                </Button>
              </Space>
            ),
          },
          {
            title: t('field.invitationCode.email'),
            dataIndex: 'email',
            render: (value: string) => value || '-',
          },
          {
            title: t('field.invitationCode.roleId'),
            dataIndex: 'role_id',
            render: (value: number) => value ?? '-',
          },
          {
            title: t('field.invitationCode.usedCount'),
            dataIndex: 'used_count',
            render: (_: any, record: InvitationCode) => `${record.used_count} / ${record.max_uses}`,
          },
          {
            title: t('field.invitationCode.expiresAt'),
            dataIndex: 'expires_at',
            render: (value: string) => value || t('field.invitationCode.neverExpires'),
          },
          {
            title: t('field.role.status'),
            dataIndex: 'is_active',
            render: (value: boolean, record: InvitationCode) => {
              const valid = isCodeValid(record);
              return (
                <Space>
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? t('field.role.enabled') : t('field.role.disabled')}
                  </Tag>
                  {!valid && value && <Tag color="error">{t('field.invitationCode.invalid')}</Tag>}
                </Space>
              );
            },
          },
          { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default InvitationCodeListPage;
