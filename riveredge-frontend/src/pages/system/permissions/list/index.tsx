/**
 * 权限管理列表页面
 * 
 * 用于系统管理员查看组织内的权限列表。
 * 权限主要用于分配给角色，通常由系统初始化创建。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Drawer } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  getPermissionList,
  getPermissionByUuid,
  Permission,
} from '../../../../services/permission';

/**
 * 权限管理列表页面组件
 */
const PermissionListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Permission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理查看详情
   */
  const handleView = async (record: Permission) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPermissionByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取权限详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 新建权限
  const handleCreate = () => {
    message.info('新建权限功能开发中...');
  };

  // 导入处理函数
  const handleImport = async (data: any[][]) => {
    message.info('导入功能开发中...');
    console.log('导入数据:', data);
  };

  // 导出处理函数
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Permission[]
  ) => {
    message.info('导出功能开发中...');
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Permission>[] = [
    {
      title: '权限名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      width: 200,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 150,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 150,
    },
    {
      title: '权限类型',
      dataIndex: 'permission_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        function: { text: '功能权限', status: 'Success' },
        data: { text: '数据权限', status: 'Processing' },
        field: { text: '字段权限', status: 'Warning' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          function: { color: 'success', text: '功能权限' },
          data: { color: 'processing', text: '数据权限' },
          field: { color: 'warning', text: '字段权限' },
        };
        const type = typeMap[record.permission_type] || { color: 'default', text: record.permission_type };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '系统权限',
      dataIndex: 'is_system',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <>
      <UniTable<Permission>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, filter, searchFormValues) => {
          const response = await getPermissionList({
            page: params.current || 1,
            page_size: params.pageSize || 20,
            keyword: searchFormValues?.keyword,
            resource: searchFormValues?.resource,
            permission_type: searchFormValues?.permission_type,
          });
          return {
            data: response.items,
            success: true,
            total: response.total,
          };
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={handleCreate}>
            新建权限
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        showExportButton={true}
        onExport={handleExport}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="权限详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions
            column={2}
            dataSource={detailData}
            columns={[
              { title: '权限名称', dataIndex: 'name' },
              { title: '权限代码', dataIndex: 'code' },
              { title: '资源', dataIndex: 'resource' },
              { title: '操作', dataIndex: 'action' },
              {
                title: '权限类型',
                dataIndex: 'permission_type',
                render: (value) => {
                  const typeMap: Record<string, string> = {
                    function: '功能权限',
                    data: '数据权限',
                    field: '字段权限',
                  };
                  return typeMap[value] || value;
                },
              },
              {
                title: '系统权限',
                dataIndex: 'is_system',
                render: (value) => (value ? '是' : '否'),
              },
              { title: '描述', dataIndex: 'description', span: 2 },
              { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
            ]}
          />
        )}
      </Drawer>
    </>
  );
};

export default PermissionListPage;

