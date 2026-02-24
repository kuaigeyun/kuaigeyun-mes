/**
 * 插件管理页面
 *
 * 提供插件的发现、注册、启用/停用等管理功能。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      message.error(t('pages.system.pluginManager.fetchFailed'));
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
          t('pages.system.pluginManager.discoverSuccess', { registered: response.data.registered, updated: response.data.updated })
        );
        actionRef.current?.reload();
      } else {
        message.error(t('pages.system.pluginManager.discoverFailed'));
      }
    } catch (error) {
      console.error('插件发现失败:', error);
      message.error(t('pages.system.pluginManager.discoverFailed'));
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
        message.error(response.message || t('pages.system.pluginManager.enableFailed'));
      }
    } catch (error) {
      console.error('启用插件失败:', error);
      message.error(t('pages.system.pluginManager.enableFailed'));
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
        message.error(response.message || t('pages.system.pluginManager.disableFailed'));
      }
    } catch (error) {
      console.error('停用插件失败:', error);
      message.error(t('pages.system.pluginManager.disableFailed'));
    }
  };

  // 表格列定义
  const columns: ProColumns<PluginInfo>[] = [
    {
      title: t('pages.system.pluginManager.columnInfo'),
      dataIndex: 'name',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div style={{ fontWeight: 'bold' }}>
            {record.icon && <span style={{ marginRight: 8 }}>{record.icon}</span>}
            {record.name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {t('pages.system.pluginManager.codeVersion', { code: record.code, version: record.version })}
          </div>
          {record.author && (
            <div style={{ fontSize: '12px', color: '#999' }}>
              {t('pages.system.pluginManager.author', { author: record.author })}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.pluginManager.columnDesc'),
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
            {text || t('pages.system.pluginManager.noDesc')}
          </div>
        </Tooltip>
      ),
    },
    {
      title: t('pages.system.pluginManager.columnStatus'),
      dataIndex: 'is_active',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <div>
            {record.is_valid ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {t('pages.system.pluginManager.valid')}
              </Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>
                {t('pages.system.pluginManager.invalid')}
              </Tag>
            )}
          </div>
          <div>
            {record.is_registered ? (
              <Tag color="blue">{t('pages.system.pluginManager.registered')}</Tag>
            ) : (
              <Tag color="orange">{t('pages.system.pluginManager.unregistered')}</Tag>
            )}
          </div>
          <div>
            {record.is_active ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {t('pages.system.pluginManager.enabled')}
              </Tag>
            ) : (
              <Tag color="default" icon={<CloseCircleOutlined />}>
                {t('pages.system.pluginManager.disabled')}
              </Tag>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: t('pages.system.pluginManager.actions'),
      width: 200,
      render: (_, record) => (
        <Space>
          {record.is_registered && record.is_valid && (
            <>
              {record.is_active ? (
                <Popconfirm
                  title={t('pages.system.pluginManager.disableConfirmTitle', { name: record.name })}
                  description={t('pages.system.pluginManager.disableConfirmDesc')}
                  onConfirm={() => handleDisablePlugin(record.code)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button size="small" danger>
                    {t('pages.system.pluginManager.disable')}
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={t('pages.system.pluginManager.enableConfirmTitle', { name: record.name })}
                  description={t('pages.system.pluginManager.enableConfirmDesc')}
                  onConfirm={() => handleEnablePlugin(record.code)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button size="small" type="primary">
                    {t('pages.system.pluginManager.enable')}
                  </Button>
                </Popconfirm>
              )}
            </>
          )}

          {!record.is_valid && record.error_message && (
            <Tooltip title={record.error_message}>
              <Button size="small" icon={<ExclamationCircleOutlined />} danger>
                {t('pages.system.pluginManager.viewError')}
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
          headerTitle={t('pages.system.pluginManager.title')}
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
                message.warning(t('pages.system.pluginManager.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `plugins-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              message.success(t('pages.system.pluginManager.exportSuccess', { count: toExport.length }));
            } catch (error: any) {
              message.error(t('pages.system.pluginManager.exportFailed'));
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
              {t('pages.system.pluginManager.discover')}
            </Button>,
            <Button
              key="reload"
              icon={<ReloadOutlined />}
              onClick={() => actionRef.current?.reload()}
            >
              {t('pages.system.pluginManager.refresh')}
            </Button>,
          ]}
        />
      </Card>
    </ListPageTemplate>
  );
};

export default PluginManagerPage;
