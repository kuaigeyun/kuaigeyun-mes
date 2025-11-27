/**
 * 超级管理员组织列表页面
 * 
 * 用于超级管理员查看和管理所有组织。
 * 支持组织注册审核、启用/禁用等功能。
 */

import React, { useRef, useLayoutEffect, useState } from 'react';
import { ProTable, ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { message, Popconfirm, Button, Tag, Space } from 'antd';
import { CheckOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { QuerySearchButton } from '@/components/riveredge-query';
import { ColumnHeaderSearch } from '@/components/ColumnHeaderSearch';
import {
  getTenantList,
  Tenant,
  TenantStatus,
  TenantPlan,
  activateTenant,
  deactivateTenant,
} from '@/services/tenant';
// 使用 apiRequest 统一处理 HTTP 请求

// @ts-ignore
import { apiRequest } from '@/services/api';

/**
 * 组织状态标签映射
 */
const statusTagMap: Record<TenantStatus, { color: string; text: string }> = {
  [TenantStatus.ACTIVE]: { color: 'success', text: '激活' },
  [TenantStatus.INACTIVE]: { color: 'default', text: '未激活' },
  [TenantStatus.EXPIRED]: { color: 'warning', text: '已过期' },
  [TenantStatus.SUSPENDED]: { color: 'error', text: '已暂停' },
};

/**
 * 组织套餐标签映射
 */
const planTagMap: Record<TenantPlan, { color: string; text: string }> = {
  [TenantPlan.TRIAL]: { color: 'default', text: '体验套餐' },
  [TenantPlan.BASIC]: { color: 'blue', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'purple', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'gold', text: '企业版' },
};

/**
 * 审核通过组织注册
 * 
 * @param tenantId - 组织 ID
 */
const approveTenant = async (tenantId: number) => {
  try {
    await apiRequest(`/superadmin/tenants/${tenantId}/approve`, {
      method: 'POST',
    });
    message.success('审核通过成功');
    return true;
  } catch (error: any) {
    message.error(error.message || '审核通过失败');
    return false;
  }
};

/**
 * 审核拒绝组织注册
 * 
 * @param tenantId - 组织 ID
 * @param reason - 拒绝原因
 */
const rejectTenant = async (tenantId: number, reason?: string) => {
  try {
    await apiRequest(`/superadmin/tenants/${tenantId}/reject`, {
      method: 'POST',
      data: { reason },
    });
    message.success('审核拒绝成功');
    return true;
  } catch (error: any) {
    message.error(error.message || '审核拒绝失败');
    return false;
  }
};

/**
 * 超级管理员组织列表页面组件
 */
const SuperAdminTenantList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string | number>>({});

  /**
   * 将按钮容器移动到 ant-pro-table 内部
   */
  useLayoutEffect(() => {
    if (containerRef.current && buttonContainerRef.current) {
      const proTable = containerRef.current.querySelector('.ant-pro-table');
      if (proTable && buttonContainerRef.current.parentElement !== proTable) {
        proTable.insertBefore(buttonContainerRef.current, proTable.firstChild);
      }
    }
  }, []);

  /**
   * 处理导出数据
   */
  const handleExport = () => {
    const selectedRows = selectedRowKeys.length > 0 
      ? selectedRowKeys.join(',')
      : 'all';
    message.info(`导出功能开发中，将导出：${selectedRows}`);
    // TODO: 实现导出功能
  };

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (selectedKeys: React.Key[]) => {
    setSelectedRowKeys(selectedKeys);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Tenant>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: (_, type, sortOrder) => (
        <ColumnHeaderSearch
          title="组织名称"
          value={columnFilters.name}
          sortOrder={sortOrder}
          onChange={(value) => setColumnFilters({ ...columnFilters, name: value as string })}
          onConfirm={(value) => {
            setColumnFilters({ ...columnFilters, name: value as string });
            if (formRef.current) {
              formRef.current.setFieldsValue({ name: value });
            }
            actionRef.current?.reload();
          }}
          onReset={() => {
            const newFilters = { ...columnFilters };
            delete newFilters.name;
            setColumnFilters(newFilters);
            if (formRef.current) {
              formRef.current.setFieldsValue({ name: undefined });
            }
            actionRef.current?.reload();
          }}
        />
      ),
      dataIndex: 'name',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
    },
    {
      title: (_, type, sortOrder) => (
        <ColumnHeaderSearch
          title="域名"
          value={columnFilters.domain}
          sortOrder={sortOrder}
          onChange={(value) => setColumnFilters({ ...columnFilters, domain: value as string })}
          onConfirm={(value) => {
            setColumnFilters({ ...columnFilters, domain: value as string });
            if (formRef.current) {
              formRef.current.setFieldsValue({ domain: value });
            }
            actionRef.current?.reload();
          }}
          onReset={() => {
            const newFilters = { ...columnFilters };
            delete newFilters.domain;
            setColumnFilters(newFilters);
            if (formRef.current) {
              formRef.current.setFieldsValue({ domain: undefined });
            }
            actionRef.current?.reload();
          }}
        />
      ),
      dataIndex: 'domain',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
    },
    {
      title: (_, type, sortOrder) => (
        <ColumnHeaderSearch
          title="状态"
          value={columnFilters.status}
          sortOrder={sortOrder}
          searchType="select"
          options={[
            { label: '激活', value: TenantStatus.ACTIVE },
            { label: '未激活', value: TenantStatus.INACTIVE },
            { label: '已过期', value: TenantStatus.EXPIRED },
            { label: '已暂停', value: TenantStatus.SUSPENDED },
          ]}
          onChange={(value) => setColumnFilters({ ...columnFilters, status: value as string })}
          onConfirm={(value) => {
            setColumnFilters({ ...columnFilters, status: value as string });
            if (formRef.current) {
              formRef.current.setFieldsValue({ status: value });
            }
            actionRef.current?.reload();
          }}
          onReset={() => {
            const newFilters = { ...columnFilters };
            delete newFilters.status;
            setColumnFilters(newFilters);
            if (formRef.current) {
              formRef.current.setFieldsValue({ status: undefined });
            }
            actionRef.current?.reload();
          }}
        />
      ),
      dataIndex: 'status',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantStatus.ACTIVE]: { text: '激活' },
        [TenantStatus.INACTIVE]: { text: '未激活' },
        [TenantStatus.EXPIRED]: { text: '已过期' },
        [TenantStatus.SUSPENDED]: { text: '已暂停' },
      },
      render: (_, record) => {
        const statusInfo = statusTagMap[record.status];
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: (_, type, sortOrder) => (
        <ColumnHeaderSearch
          title="套餐"
          value={columnFilters.plan}
          sortOrder={sortOrder}
          searchType="select"
          options={[
            { label: '体验套餐', value: TenantPlan.TRIAL },
            { label: '基础版', value: TenantPlan.BASIC },
            { label: '专业版', value: TenantPlan.PROFESSIONAL },
            { label: '企业版', value: TenantPlan.ENTERPRISE },
          ]}
          onChange={(value) => setColumnFilters({ ...columnFilters, plan: value as string })}
          onConfirm={(value) => {
            setColumnFilters({ ...columnFilters, plan: value as string });
            if (formRef.current) {
              formRef.current.setFieldsValue({ plan: value });
            }
            actionRef.current?.reload();
          }}
          onReset={() => {
            const newFilters = { ...columnFilters };
            delete newFilters.plan;
            setColumnFilters(newFilters);
            if (formRef.current) {
              formRef.current.setFieldsValue({ plan: undefined });
            }
            actionRef.current?.reload();
          }}
        />
      ),
      dataIndex: 'plan',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantPlan.TRIAL]: { text: '体验套餐' },
        [TenantPlan.BASIC]: { text: '基础版' },
        [TenantPlan.PROFESSIONAL]: { text: '专业版' },
        [TenantPlan.ENTERPRISE]: { text: '企业版' },
      },
      render: (_, record) => {
        const planInfo = planTagMap[record.plan];
        return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
      },
    },
    {
      title: '最大用户数',
      dataIndex: 'max_users',
      width: 120,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '最大存储空间 (MB)',
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
      sorter: true,
      responsive: ['xl'],
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const isInactive = record.status === TenantStatus.INACTIVE;
        const isActive = record.status === TenantStatus.ACTIVE;
        const isSuspended = record.status === TenantStatus.SUSPENDED;

        return (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                navigate(`/operations/tenants/detail?id=${record.id}`);
              }}
            >
              详情
            </Button>
            {isInactive && (
              <Popconfirm
                title="确定要审核通过此组织吗？"
                onConfirm={async () => {
                  const success = await approveTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  审核通过
                </Button>
              </Popconfirm>
            )}
            {isInactive && (
              <Popconfirm
                title="确定要拒绝此组织注册吗？"
                onConfirm={async () => {
                  const success = await rejectTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  审核拒绝
                </Button>
              </Popconfirm>
            )}
            {isSuspended && (
              <Popconfirm
                title="确定要激活此组织吗？"
                onConfirm={async () => {
                  const success = await activateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                  激活
                </Button>
              </Popconfirm>
            )}
            {isActive && (
              <Popconfirm
                title="确定要停用此组织吗？"
                onConfirm={async () => {
                  const success = await deactivateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>
                  停用
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div 
        ref={buttonContainerRef} 
        className="pro-table-button-container"
      >
        <QuerySearchButton
          columns={columns}
          formRef={formRef}
          actionRef={actionRef}
        />
      </div>
      <ProTable<Tenant>
        headerTitle="组织列表（超级管理员）"
        actionRef={actionRef}
        formRef={formRef}
        rowKey="id"
        search={false}
        request={async (params, sort, filter) => {
          // 处理排序参数
          let sortField: string | undefined;
          let sortOrder: 'asc' | 'desc' | undefined;
          
          if (sort && Object.keys(sort).length > 0) {
            // 获取第一个排序字段
            const firstSortKey = Object.keys(sort)[0];
            const firstSortValue = sort[firstSortKey];
            sortField = firstSortKey;
            sortOrder = firstSortValue === 'ascend' ? 'asc' : 'desc';
          }

          const result = await getTenantList({
            page: params.current || 1,
            page_size: params.pageSize || 10,
            status: params.status as TenantStatus,
            plan: params.plan as TenantPlan,
            keyword: params.keyword,
            sort: sortField,
            order: sortOrder,
          });
          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        columns={columns}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: handleRowSelectionChange,
        }}
        editable={{
          type: 'multiple',
          onSave: async (_key, _row) => {
            message.info('可编辑功能开发中');
            // TODO: 实现编辑功能
          },
        }}
        toolBarRender={(_action, { selectedRowKeys: keys }) => [
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={keys && keys.length === 0}
          >
            导出
          </Button>,
        ]}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default SuperAdminTenantList;

