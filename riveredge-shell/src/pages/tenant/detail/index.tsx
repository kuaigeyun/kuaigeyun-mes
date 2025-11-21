/**
 * 组织详情页面
 * 
 * 用于展示组织详细信息。
 * 注意：此页面通常需要超级管理员权限。
 */

import React, { useEffect, useState, useRef } from 'react';
import { ProDescriptions, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Tag, message, Card, Row, Col, Statistic, Progress, Alert, Tabs } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTenantById,
  activateTenant,
  deactivateTenant,
  getTenantUsage,
  getTenantActivityLogs,
  Tenant,
  TenantStatus,
  TenantPlan,
  TenantUsage,
  TenantActivityLog,
} from '@/services/tenant';

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
  [TenantPlan.BASIC]: { color: 'default', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'processing', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'success', text: '企业版' },
};

/**
 * 组织详情页面组件
 */
const TenantDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const activityLogActionRef = useRef<ActionType>();

  /**
   * 加载组织数据
   */
  useEffect(() => {
    if (tenantId) {
      setLoading(true);
      getTenantById(Number(tenantId))
        .then((data) => {
          setTenant(data);
        })
        .catch((error: any) => {
          message.error(error.message || '加载组织信息失败');
          navigate('/tenant/list');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      message.error('缺少组织 ID');
      navigate('/tenant/list');
    }
  }, [tenantId]);

  /**
   * 加载组织使用量统计
   */
  useEffect(() => {
    if (tenantId) {
      setUsageLoading(true);
      getTenantUsage(Number(tenantId))
        .then((data) => {
          setUsage(data);
        })
        .catch((error: any) => {
          console.error('加载使用量统计失败:', error);
          // 不显示错误提示，因为使用量统计不是必须的
        })
        .finally(() => {
          setUsageLoading(false);
        });
    }
  }, [tenantId]);

  /**
   * 处理激活组织
   */
  const handleActivate = async () => {
    if (!tenant) return;
    try {
      await activateTenant(tenant.id);
      message.success('激活成功');
      // 重新加载数据
      const updatedTenant = await getTenantById(tenant.id);
      setTenant(updatedTenant);
    } catch (error: any) {
      message.error(error.message || '激活失败');
    }
  };

  /**
   * 处理停用组织
   */
  const handleDeactivate = async () => {
    if (!tenant) return;
    try {
      await deactivateTenant(tenant.id);
      message.success('停用成功');
      // 重新加载数据
      const updatedTenant = await getTenantById(tenant.id);
      setTenant(updatedTenant);
    } catch (error: any) {
      message.error(error.message || '停用失败');
    }
  };

  if (!tenant) {
    return null;
  }

  const statusInfo = statusTagMap[tenant.status];
  const planInfo = planTagMap[tenant.plan];

  return (
    <PageContainer
      title="组织详情"
      loading={loading}
      extra={[
        <Button key="edit" onClick={() => navigate(`/tenant/form?id=${tenant.id}`)}>
          编辑
        </Button>,
        tenant.status === TenantStatus.ACTIVE ? (
          <Button key="deactivate" danger onClick={handleDeactivate}>
            停用
          </Button>
        ) : (
          <Button key="activate" type="primary" onClick={handleActivate}>
            激活
          </Button>
        ),
      ]}
    >
      <ProDescriptions<Tenant>
        column={2}
        title="基本信息"
        dataSource={tenant}
        columns={[
          {
            title: '组织 ID',
            dataIndex: 'id',
          },
          {
            title: '组织名称',
            dataIndex: 'name',
          },
          {
            title: '域名',
            dataIndex: 'domain',
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: () => <Tag color={statusInfo.color}>{statusInfo.text}</Tag>,
          },
          {
            title: '套餐',
            dataIndex: 'plan',
            render: () => <Tag color={planInfo.color}>{planInfo.text}</Tag>,
          },
          {
            title: '最大用户数',
            dataIndex: 'max_users',
          },
          {
            title: '最大存储空间（MB）',
            dataIndex: 'max_storage',
          },
          {
            title: '过期时间',
            dataIndex: 'expires_at',
            valueType: 'dateTime',
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: '更新时间',
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />

      {/* 使用量统计卡片 */}
      {usage && (
        <Card title="使用量统计" style={{ marginTop: 24 }} loading={usageLoading}>
          {/* 配额预警提示 */}
          {usage.warnings && usage.warnings.length > 0 && (
            <Alert
              message="配额预警"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {usage.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="用户数"
                value={usage.user_count}
                suffix={`/ ${usage.max_users}`}
              />
              <Progress
                percent={usage.user_usage_percent}
                status={usage.user_usage_percent >= 80 ? 'exception' : usage.user_usage_percent >= 60 ? 'active' : 'success'}
                strokeColor={usage.user_usage_percent >= 80 ? '#ff4d4f' : usage.user_usage_percent >= 60 ? '#faad14' : '#52c41a'}
                style={{ marginTop: 8 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="存储空间"
                value={usage.storage_used_mb}
                suffix={`MB / ${usage.max_storage_mb} MB`}
              />
              <Progress
                percent={usage.storage_usage_percent}
                status={usage.storage_usage_percent >= 80 ? 'exception' : usage.storage_usage_percent >= 60 ? 'active' : 'success'}
                strokeColor={usage.storage_usage_percent >= 80 ? '#ff4d4f' : usage.storage_usage_percent >= 60 ? '#faad14' : '#52c41a'}
                style={{ marginTop: 8 }}
              />
            </Col>
          </Row>
        </Card>
      )}
      
      {/* 使用 Tabs 组织内容 */}
      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: '基本信息',
            children: (
              <>
                {tenant.settings && Object.keys(tenant.settings).length > 0 && (
                  <ProDescriptions
                    column={1}
                    title="组织配置"
                    style={{ marginTop: 24 }}
                  >
                    <ProDescriptions.Item label="配置信息">
                      <pre>{JSON.stringify(tenant.settings, null, 2)}</pre>
                    </ProDescriptions.Item>
                  </ProDescriptions>
                )}
              </>
            ),
          },
          {
            key: 'logs',
            label: '活动日志',
            children: (
              <ProTable<TenantActivityLog>
                headerTitle="活动日志"
                actionRef={activityLogActionRef}
                search={false}
                request={async (params) => {
                  const result = await getTenantActivityLogs(Number(tenantId), {
                    page: params.current || 1,
                    page_size: params.pageSize || 10,
                    action: params.action as string,
                  });
                  return {
                    data: result.items,
                    success: true,
                    total: result.total,
                  };
                }}
                columns={[
                  {
                    title: '操作时间',
                    dataIndex: 'created_at',
                    valueType: 'dateTime',
                    width: 180,
                    sorter: true,
                    defaultSortOrder: 'descend',
                  },
                  {
                    title: '操作类型',
                    dataIndex: 'action',
                    width: 120,
                    valueEnum: {
                      create: { text: '创建', status: 'Success' },
                      update: { text: '更新', status: 'Processing' },
                      activate: { text: '激活', status: 'Success' },
                      deactivate: { text: '停用', status: 'Warning' },
                      delete: { text: '删除', status: 'Error' },
                    },
                  },
                  {
                    title: '操作描述',
                    dataIndex: 'description',
                    ellipsis: true,
                  },
                  {
                    title: '操作人',
                    dataIndex: 'operator_name',
                    width: 120,
                    render: (text: string) => text || '-',
                  },
                ]}
                rowKey="id"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                }}
              />
            ),
          },
        ]}
      />
    </PageContainer>
  );
};

export default TenantDetail;

