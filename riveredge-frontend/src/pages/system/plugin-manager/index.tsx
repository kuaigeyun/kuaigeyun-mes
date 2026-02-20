/**
 * 插件管理页面
 *
 * 提供插件的发现、注册、启用/停用等管理功能。
 */

import React, { useState, useEffect } from 'react';
import {
  ProColumns,
  ActionType,
} from '@ant-design/pro-components';
import { Button, message, Tag, Space, Popconfirm, Card, Tooltip } from 'antd';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate } from '../../../components/layout-templates';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { api } from '../../../services/api';

interface PluginInfo {
  code: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  author: string;
  is_valid: boolean;
  error_message?: string;
  is_registered: boolean;
  is_active: boolean;
  is_installed: boolean;
  sort_order: number;
}

const PluginManagerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const actionRef = React.useRef<ActionType>();

  // 获取插件列表
  const fetchPlugins = async (): Promise<{ data: PluginInfo[]; success: boolean }> => {
    try {
      const response = await api.get('/api/v1/core/plugin-manager/plugins');
      return {
        data: response,
        success: true,
      };
    } catch (error) {
      console.error('获取插件列表失败:', error);
      message.error('获取插件列表失败');
      return {
        data: [],
        success: false,
      };
    }
  };

  // 发现并注册插件
  const handleDiscoverPlugins = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/v1/core/plugin-manager/discover', {});

      if (response.success) {
        message.success(
          `插件发现完成：注册 ${response.data.registered} 个，更新 ${response.data.updated} 个`
        );
        actionRef.current?.reload();
      } else {
        message.error('插件发现失败');
      }
    } catch (error) {
      console.error('插件发现失败:', error);
      message.error('插件发现失败');
    } finally {
      setLoading(false);
    }
  };

  // 启用插件
  const handleEnablePlugin = async (pluginCode: string) => {
    try {
      const response = await api.post(`/api/v1/core/plugin-manager/plugins/${pluginCode}/enable`, {});

      if (response.success) {
        message.success(response.message);
        actionRef.current?.reload();
      } else {
        message.error(response.message || '启用插件失败');
      }
    } catch (error) {
      console.error('启用插件失败:', error);
      message.error('启用插件失败');
    }
  };

  // 停用插件
  const handleDisablePlugin = async (pluginCode: string) => {
    try {
      const response = await api.post(`/api/v1/core/plugin-manager/plugins/${pluginCode}/disable`, {});

      if (response.success) {
        message.success(response.message);
        actionRef.current?.reload();
      } else {
        message.error(response.message || '停用插件失败');
      }
    } catch (error) {
      console.error('停用插件失败:', error);
      message.error('停用插件失败');
    }
  };

  // 表格列定义
  const columns: ProColumns<PluginInfo>[] = [
    {
      title: '插件信息',
      dataIndex: 'name',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div style={{ fontWeight: 'bold' }}>
            {record.icon && <span style={{ marginRight: 8 }}>{record.icon}</span>}
            {record.name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            代码: {record.code} | 版本: {record.version}
          </div>
          {record.author && (
            <div style={{ fontSize: '12px', color: '#999' }}>
              作者: {record.author}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      render: (text) => (
        <Tooltip title={text}>
          <div style={{
            maxWidth: '240px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {text || '暂无描述'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          {/* 有效性状态 */}
          <div>
            {record.is_valid ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                有效
              </Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>
                无效
              </Tag>
            )}
          </div>

          {/* 注册状态 */}
          <div>
            {record.is_registered ? (
              <Tag color="blue">已注册</Tag>
            ) : (
              <Tag color="orange">未注册</Tag>
            )}
          </div>

          {/* 启用状态 */}
          <div>
            {record.is_active ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                已启用
              </Tag>
            ) : (
              <Tag color="default" icon={<CloseCircleOutlined />}>
                未启用
              </Tag>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.is_registered && record.is_valid && (
            <>
              {record.is_active ? (
                <Popconfirm
                  title={`确定要停用插件 "${record.name}" 吗？`}
                  description="停用后，该插件的功能将不再可用。"
                  onConfirm={() => handleDisablePlugin(record.code)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger>
                    停用
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={`确定要启用插件 "${record.name}" 吗？`}
                  description="启用后，该插件的功能将立即可用。"
                  onConfirm={() => handleEnablePlugin(record.code)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" type="primary">
                    启用
                  </Button>
                </Popconfirm>
              )}
            </>
          )}

          {!record.is_valid && record.error_message && (
            <Tooltip title={record.error_message}>
              <Button size="small" icon={<ExclamationCircleOutlined />} danger>
                查看错误
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <Card>
        <UniTable<PluginInfo>
          headerTitle="插件管理"
          actionRef={actionRef}
          rowKey="code"
          request={fetchPlugins}
          columns={columns}
          search={false}
          pagination={false}
          showAdvancedSearch={false}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const data = await fetchPlugins();
              const items = (data?.data || []) as any[];
              let toExport = items;
              if (type === 'currentPage' && pageData?.length) {
                toExport = pageData;
              } else if (type === 'selected' && keys?.length) {
                toExport = items.filter((d) => keys.includes(d.code));
              }
              if (toExport.length === 0) {
                message.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `plugins-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              message.success(`已导出 ${toExport.length} 条记录`);
            } catch (error: any) {
              message.error('导出失败');
            }
          }}
          toolBarActions={[
            <Button
              key="discover"
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={handleDiscoverPlugins}
            >
              发现插件
            </Button>,
            <Button
              key="reload"
              icon={<ReloadOutlined />}
              onClick={() => actionRef.current?.reload()}
            >
              刷新
            </Button>,
          ]}
        />
      </Card>
    </ListPageTemplate>
  );
};

export default PluginManagerPage;
