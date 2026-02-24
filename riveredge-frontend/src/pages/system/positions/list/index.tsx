/**
 * 职位管理列表页面
 *
 * 用于系统管理员查看和管理组织内的职位。
 * 支持职位的 CRUD 操作。
 * Schema 驱动 + 国际化
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { PositionFormModal } from '../components/PositionFormModal';
import {
  getPositionList,
  getPositionByUuid,
  deletePosition,
  Position,
} from '../../../../services/position';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';

function toTreeData(items: DepartmentTreeItem[]): Array<{ title: string; value: string; key: string; children?: any[] }> {
  return items.map((item) => ({
    title: item.name,
    value: item.uuid,
    key: item.uuid,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));
}

const PositionListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deptTreeData, setDeptTreeData] = useState<Array<{ title: string; value: string; key: string; children?: any[] }>>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentPositionUuid, setCurrentPositionUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Position | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    getDepartmentTree()
      .then((res) => setDeptTreeData(toTreeData(res.items)))
      .catch(() => setDeptTreeData([]));
  }, []);

  const handleCreate = () => {
    setCurrentPositionUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Position) => {
    setCurrentPositionUuid(record.uuid);
    setModalVisible(true);
  };

  const handleImport = async (data: any[][]) => {
    message.info(t('pages.system.importDeveloping'));
    console.log('导入数据:', data);
  };

  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Position[]
  ) => {
    message.info(t('pages.system.exportDeveloping'));
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  const handleView = async (record: Position) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPositionByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: Position) => {
    try {
      await deletePosition(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    Modal.confirm({
      title: t('common.confirm'),
      content: t('field.position.batchDeleteConfirm', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const key of selectedRowKeys) {
            try {
              await deletePosition(key.toString());
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
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
        }
      },
    });
  };

  const columns: ProColumns<Position>[] = [
    {
      title: t('field.position.name'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.position.code'),
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: t('field.position.departmentUuid'),
      dataIndex: 'department_uuid',
      width: 200,
      valueType: 'treeSelect',
      fieldProps: {
        treeData: deptTreeData,
        fieldNames: { label: 'title', value: 'value' },
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: t('field.position.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.position.userCount'),
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.position.sortOrder'),
      dataIndex: 'sort_order',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.position.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.enabled'), status: 'Success' },
        false: { text: t('field.role.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.role.enabled') : t('field.role.disabled')}
        </Tag>
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
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
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
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            {t('field.position.view')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('field.position.edit')}
          </Button>
          <Popconfirm
            title={t('field.position.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              {t('field.position.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Position>
          viewTypes={['table', 'help']}
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const response = await getPositionList({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              keyword: searchFormValues?.keyword,
              name: searchFormValues?.name,
              code: searchFormValues?.code,
              department_uuid: searchFormValues?.department_uuid,
              is_active: searchFormValues?.is_active,
            });
            return { data: response.items, success: true, total: response.total };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          showCreateButton
          createButtonText={t('field.position.createTitle')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.batchDelete')}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showImportButton={true}
          onImport={handleImport}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <PositionFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPositionUuid(null);
        }}
        editUuid={currentPositionUuid}
        onSuccess={() => actionRef.current?.reload()}
      />

      <DetailDrawerTemplate
        title={t('field.position.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData as any}
        columns={[
          { title: t('field.position.name'), dataIndex: 'name' },
          { title: t('field.position.code'), dataIndex: 'code' },
          { title: t('field.position.description'), dataIndex: 'description', span: 2 },
          {
            title: t('field.position.departmentUuid'),
            dataIndex: ['department', 'name'],
            span: 2,
            render: (_: any, record: any) => record?.department?.name || '-',
          },
          {
            title: t('field.position.status'),
            dataIndex: 'is_active',
            render: (_: any, entity: any) =>
              entity?.is_active ? t('field.role.enabled') : t('field.role.disabled'),
          },
          { title: t('field.position.userCount'), dataIndex: 'user_count' },
          { title: t('field.position.sortOrder'), dataIndex: 'sort_order' },
          { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default PositionListPage;
