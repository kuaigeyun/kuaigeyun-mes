/**
 * 角色列表页面
 * 
 * 用于展示角色列表，支持搜索、筛选、分页等功能。
 * 自动显示当前组织的角色（后端已过滤）。
 */

import React, { useRef } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { message, Popconfirm, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getRoleList, deleteRole, Role } from '@/services/role';

/**
 * 角色列表页面组件
 */
const RoleList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();

  /**
   * 处理删除角色
   */
  const handleDelete = async (roleId: number) => {
    try {
      await deleteRole(roleId);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Role>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '角色代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '系统角色',
      dataIndex: 'is_system',
      width: 100,
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <span style={{ color: record.is_system ? '#52c41a' : '#999' }}>
          {record.is_system ? '是' : '否'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      hideInSearch: true,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      render: (_, record) => [
        <a
          key="edit"
          onClick={() => {
            navigate(`/role/form?id=${record.id}`);
          }}
        >
          编辑
        </a>,
        <a
          key="permissions"
          onClick={() => {
            navigate(`/role/permissions?id=${record.id}`);
          }}
        >
          权限分配
        </a>,
        record.is_system ? (
          <span key="delete" style={{ color: '#999' }}>
            系统角色不可删除
          </span>
        ) : (
          <Popconfirm
            key="delete"
            title="确定要删除该角色吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        ),
      ],
    },
  ];

  return (
    <ProTable<Role>
      headerTitle="角色列表"
      actionRef={actionRef}
      rowKey="id"
      search={{
        labelWidth: 'auto',
      }}
      toolBarRender={() => [
        <Button
          type="primary"
          key="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            navigate('/role/form');
          }}
        >
          新建角色
        </Button>,
      ]}
      request={async (params) => {
        const result = await getRoleList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          keyword: params.keyword,
        });
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      columns={columns}
    />
  );
};

export default RoleList;

