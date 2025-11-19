/**
 * 用户列表页面
 * 
 * 用于展示用户列表，支持搜索、筛选、分页等功能。
 * 自动显示当前租户的用户（后端已过滤）。
 */

import React, { useRef } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { message, Popconfirm, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getUserList, deleteUser, toggleUserStatus, User } from '@/services/user';

/**
 * 用户列表页面组件
 */
const UserList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();

  /**
   * 处理删除用户
   */
  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  /**
   * 处理切换用户状态
   */
  const handleToggleStatus = async (userId: number) => {
    try {
      await toggleUserStatus(userId);
      message.success('状态切换成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '状态切换失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<User>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
    {
      title: '全名',
      dataIndex: 'full_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '激活', status: 'Success' },
        false: { text: '停用', status: 'Error' },
      },
      render: (_, record) => (
        <span style={{ color: record.is_active ? '#52c41a' : '#ff4d4f' }}>
          {record.is_active ? '激活' : '停用'}
        </span>
      ),
    },
    {
      title: '超级用户',
      dataIndex: 'is_superuser',
      width: 100,
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
    },
    {
      title: '租户管理员',
      dataIndex: 'is_tenant_admin',
      width: 120,
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      width: 180,
      hideInSearch: true,
      valueType: 'dateTime',
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
      width: 200,
      render: (_, record) => [
        <a
          key="edit"
          onClick={() => {
            navigate(`/user/form?id=${record.id}`);
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="toggle"
          title={`确定要${record.is_active ? '停用' : '激活'}该用户吗？`}
          onConfirm={() => handleToggleStatus(record.id)}
        >
          <a>{record.is_active ? '停用' : '激活'}</a>
        </Popconfirm>,
        <Popconfirm
          key="delete"
          title="确定要删除该用户吗？"
          onConfirm={() => handleDelete(record.id)}
        >
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<User>
      headerTitle="用户列表"
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
            navigate('/user/form');
          }}
        >
          新建用户
        </Button>,
      ]}
      request={async (params) => {
        const result = await getUserList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          keyword: params.keyword,
          is_active: params.is_active,
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

export default UserList;

