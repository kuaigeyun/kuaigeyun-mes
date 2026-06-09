/**
 * 权限管理列表页面
 *
 * 用于系统管理员查看组织内的权限列表。
 * 权限主要用于分配给角色，通常由系统初始化创建。
 * 国际化
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, message, Descriptions } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, ListPageTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import {
  getPermissionList,
  getPermissionByUuid,
  Permission,
} from '../../../../services/permission';
import { extractProTableSort, mergeListKeyword, mapPermissionListSortField } from '../../../../utils/tableQueryKey';

const PermissionListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const permissionDetailReqRef = useRef(0);

  const permissionDetailDescColumns = useMemo<ProDescriptionsItemProps<Permission>[]>(
    () => [
      { title: t('field.permission.name'), dataIndex: 'name' },
      { title: t('field.permission.code'), dataIndex: 'code' },
      { title: t('field.permission.resource'), dataIndex: 'resource' },
      { title: t('field.permission.action'), dataIndex: 'action' },
      {
        title: t('field.permission.type'),
        dataIndex: 'permission_type',
        render: (_: unknown, entity: Permission) => {
          const typeMap: Record<string, string> = {
            function: t('field.permission.typeFunction'),
            data: t('field.permission.typeData'),
            field: t('field.permission.typeField'),
          };
          const value = entity.permission_type;
          return typeMap[value] || value;
        },
      },
      {
        title: t('field.permission.systemPermission'),
        dataIndex: 'is_system',
        render: (_: unknown, entity: Permission) =>
          entity?.is_system ? (
            <Tag color="purple">{t('field.role.yes')}</Tag>
          ) : (
            <Tag>{t('field.role.no')}</Tag>
          ),
      },
      { title: t('field.permission.description'), dataIndex: 'description', span: 2 },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Permission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleView = async (record: Permission) => {
    const req = ++permissionDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getPermissionByUuid(record.uuid);
      if (permissionDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (permissionDetailReqRef.current === req) {
        messageApi.error(error.message || t('common.loadFailed'));
      }
    } finally {
      if (permissionDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const handleCreate = () => {
    message.info(t('field.permission.createDeveloping'));
  };

  const handleImport = async (data: any[][]) => {
    message.info(t('pages.system.importDeveloping'));
    console.log('导入数据:', data);
  };

  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Permission[]
  ) => {
    message.info(t('pages.system.exportDeveloping'));
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  const columns: ProColumns<Permission>[] = [
    {
      title: t('field.permission.name'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('field.permission.code'),
      dataIndex: 'code',
      width: 200,
    },
    {
      title: t('field.permission.resource'),
      dataIndex: 'resource',
      width: 150,
    },
    {
      title: t('field.permission.action'),
      dataIndex: 'action',
      width: 150,
    },
    {
      title: t('field.permission.type'),
      dataIndex: 'permission_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        function: { text: t('field.permission.typeFunction'), status: 'Success' },
        data: { text: t('field.permission.typeData'), status: 'Processing' },
        field: { text: t('field.permission.typeField'), status: 'Warning' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          function: { color: 'success', text: t('field.permission.typeFunction') },
          data: { color: 'processing', text: t('field.permission.typeData') },
          field: { color: 'warning', text: t('field.permission.typeField') },
        };
        const type = typeMap[record.permission_type] || { color: 'default', text: record.permission_type };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: t('field.permission.systemPermission'),
      dataIndex: 'is_system',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.role.yes') : t('field.role.no')}
        </Tag>
      ),
    },
    {
      title: t('field.permission.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
              {t('field.permission.view')}
            </Button>,
          ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Permission>
          columnPersistenceId="pages.system.permissions.list"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const keyword = mergeListKeyword(searchFormValues);
            const response = await getPermissionList({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              keyword: keyword || undefined,
              name: searchFormValues?.name as string | undefined,
              code: searchFormValues?.code as string | undefined,
              resource: searchFormValues?.resource as string | undefined,
              permission_type: searchFormValues?.permission_type as string | undefined,
              sort_by: mapPermissionListSortField(sortBy),
              sort_order: sortOrder,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('field.permission.createTitle')}
          onCreate={handleCreate}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          showImportButton={true}
          onImport={handleImport}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <UniDetail
        title={t('field.permission.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(permissionDetailDescColumns, detailData)}
            />
          ) : null
        }
      />
    </>
  );
};

export default PermissionListPage;
