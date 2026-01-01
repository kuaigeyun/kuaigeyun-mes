/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Switch, Card, Dropdown } from 'antd';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { theme } from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  StopOutlined,
  MoreOutlined,
  AppstoreOutlined,
  UserOutlined,
  ShopOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  ApiOutlined,
  CloudOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { ManufacturingIcons } from '../../../../utils/manufacturingIcons';
import {
  getApplicationList,
  getApplicationByUuid,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  syncApplicationManifest,
  Application,
} from '../../../../services/application';

/**
 * 根据应用代码和图标配置获取图标组件
 * 
 * @param code - 应用代码
 * @param icon - 图标配置（可以是图片路径或 lucide 图标名称）
 * @returns React 图标组件
 */
const getApplicationIcon = (code: string, icon?: string | null) => {
  // 如果 icon 是图片路径（以 / 或 http 开头），使用图片
  if (icon && (icon.startsWith('/') || icon.startsWith('http'))) {
    return <img src={icon} alt={code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  
  // 如果 icon 是 lucide 图标名称，使用 ManufacturingIcons
  if (icon && ManufacturingIcons[icon as keyof typeof ManufacturingIcons]) {
    const IconComponent = ManufacturingIcons[icon as keyof typeof ManufacturingIcons];
    return React.createElement(IconComponent, { size: 72 });
  }
  
  // 根据应用代码返回默认图标
  const iconMap: Record<string, React.ReactNode> = {
    kuaimes: React.createElement(ManufacturingIcons.production, { size: 72 }), // 快格轻MES
    kuaizhizao: React.createElement(ManufacturingIcons.production, { size: 72 }), // 快格轻制造
    'master-data': React.createElement(ManufacturingIcons.database, { size: 72 }), // 主数据管理
    crm: <UserOutlined />,
    erp: <ShopOutlined />,
    mes: <DatabaseOutlined />,
    wms: <DatabaseOutlined />,
    oa: <FileTextOutlined />,
    scm: <ApiOutlined />,
    bi: <BarChartOutlined />,
    hr: <TeamOutlined />,
  };
  return iconMap[code] || <AppstoreOutlined />;
};

/**
 * 应用中心列表页面组件
 */
const ApplicationListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);


  /**
   * 处理查看详情
   */
  const handleView = async (record: Application) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApplicationByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取应用详情失败');
    } finally {
      setDetailLoading(false);
    }
  };


  /**
   * 处理安装应用
   */
  const handleInstall = async (record: Application) => {
    try {
      await installApplication(record.uuid);
      messageApi.success('安装成功');
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      // 触发自定义事件，通知菜单立即刷新
      window.dispatchEvent(new CustomEvent('application-status-changed', {
        detail: { application: record, isInstalled: true }
      }));

      console.log(`📢 已触发应用安装事件: ${record.name}`);
    } catch (error: any) {
      messageApi.error(error.message || '安装失败');
    }
  };

  /**
   * 处理卸载应用
   */
  const handleUninstall = async (record: Application) => {
    try {
      await uninstallApplication(record.uuid);
      messageApi.success('卸载成功');
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      // 触发自定义事件，通知菜单立即刷新
      window.dispatchEvent(new CustomEvent('application-status-changed', {
        detail: { application: record, isInstalled: false }
      }));

      console.log(`📢 已触发应用卸载事件: ${record.name}`);
    } catch (error: any) {
      messageApi.error(error.message || '卸载失败');
    }
  };

  /**
   * 处理启用/禁用应用
   */
  const handleToggleActive = async (record: Application, checked: boolean) => {
    try {
      if (checked) {
        await enableApplication(record.uuid);
        messageApi.success('启用成功');
      } else {
        await disableApplication(record.uuid);
        messageApi.success('禁用成功');
      }
      actionRef.current?.reload();

      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      // 触发自定义事件，通知菜单立即刷新
      window.dispatchEvent(new CustomEvent('application-status-changed', {
        detail: { application: record, isActive: checked }
      }));

      console.log(`📢 已触发应用状态变更事件: ${record.name} ${checked ? '启用' : '禁用'}`);
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };



  /**
   * 表格列定义
   */
  const columns: ProColumns<Application>[] = [
    {
      title: '应用名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '应用代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '应用描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '系统应用',
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Default' },
        false: { text: '否', status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '安装状态',
      dataIndex: 'is_installed',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '已安装', status: 'Success' },
        false: { text: '未安装', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_installed ? 'success' : 'default'}>
          {record.is_installed ? '已安装' : '未安装'}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '应用版本',
      dataIndex: 'version',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 渲染应用卡片
   */
  const renderApplicationCard = (application: Application, index: number) => {
    const menuItems = [
      {
        key: 'view',
        label: '查看详情',
        icon: <EyeOutlined />,
        onClick: () => handleView(application),
      },
      {
        key: 'sync-manifest',
        label: '同步清单配置',
        icon: <AppstoreOutlined />,
        onClick: async () => {
          try {
            Modal.confirm({
              title: '同步清单配置',
              content: `确定要从manifest.json同步应用配置吗？这将更新菜单和其他配置信息。`,
              onOk: async () => {
                messageApi.loading({ content: '正在同步配置...', key: 'sync-manifest' });
                try {
                  const result = await syncApplicationManifest(application.code);

                  if (result.success) {
                    messageApi.success({
                      content: result.message || '配置同步成功',
                      key: 'sync-manifest'
                    });

                    // 刷新应用列表
                    loadApplications();

                    // 触发菜单刷新事件
                    window.dispatchEvent(new CustomEvent('application-status-changed', {
                      detail: { application, isActive: application.is_active }
                    }));
                  } else {
                    throw new Error(result.message || '同步失败');
                  }

                } catch (error: any) {
                  messageApi.error({
                    content: error.message || '同步失败',
                    key: 'sync-manifest'
                  });
                }
              },
            });
          } catch (error: any) {
            messageApi.error(error.message || '操作失败');
          }
        },
      },
      {
        type: 'divider' as const,
      },
      !application.is_installed
        ? {
            key: 'install',
            label: '安装',
            icon: <DownloadOutlined />,
            onClick: () => {
              Modal.confirm({
                title: '确定要安装这个应用吗？',
                onOk: () => handleInstall(application),
              });
            },
          }
        : {
            key: 'uninstall',
            label: '卸载',
            icon: <StopOutlined />,
            disabled: application.is_system,
            onClick: () => {
              if (application.is_system) return;
              Modal.confirm({
                title: '确定要卸载这个应用吗？',
                onOk: () => handleUninstall(application),
              });
            },
          },
    ];

    return (
      <Card
        key={application.uuid}
        hoverable
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: themeToken.borderRadiusLG,
        }}
        cover={
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: application.is_active && application.is_installed ? '#f0f9ff' : '#fafafa',
              padding: '16px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {(() => {
              const iconElement = getApplicationIcon(application.code, application.icon);
              // 如果是图片，直接返回
              if (React.isValidElement(iconElement) && iconElement.type === 'img') {
                return iconElement;
              }
              // 如果是图标组件，应用样式
              return React.cloneElement(iconElement as React.ReactElement, {
                style: {
                  fontSize: 72,
                  color: application.is_active && application.is_installed ? '#1890ff' : '#d9d9d9',
                },
              });
            })()}
          </div>
        }
        actions={[
          <div key="active" style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>启用状态</span>
            <Switch
              checked={application.is_active}
              onChange={(checked) => handleToggleActive(application, checked)}
              disabled={!application.is_installed}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </div>,
          <Dropdown
            key="more"
            menu={{ items: menuItems }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} style={{ width: '100%' }}>
              更多操作
            </Button>
          </Dropdown>,
        ]}
      >
        <Card.Meta
          title={
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#262626' }}>
                  {application.name}
                </span>
                <Space size={4}>
                  {application.is_system && (
                    <Tag color="default" style={{ margin: 0 }}>系统</Tag>
                  )}
                  {application.is_installed ? (
                    <Tag color="success" style={{ margin: 0 }}>已安装</Tag>
                  ) : (
                    <Tag style={{ margin: 0 }}>未安装</Tag>
                  )}
                </Space>
              </div>
            </div>
          }
          description={
            <div>
              <div
                style={{
                  marginBottom: 12,
                  color: '#595959',
                  fontSize: 13,
                  lineHeight: '20px',
                  minHeight: 40,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {application.description || '暂无描述'}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#8c8c8c',
                  paddingTop: 8,
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                <span>代码: {application.code}</span>
                {application.version && (
                  <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                    v{application.version}
                  </Tag>
                )}
              </div>
            </div>
          }
        />
      </Card>
    );
  };


  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '应用名称', dataIndex: 'name' },
    { title: '应用代码', dataIndex: 'code' },
    { title: '应用描述', dataIndex: 'description' },
    {
      title: '应用图标',
      dataIndex: 'icon',
      render: (value: string) => value ? <img src={value} alt="图标" style={{ maxWidth: 100, maxHeight: 100 }} /> : '-',
    },
    { title: '应用版本', dataIndex: 'version' },
    { title: '路由路径', dataIndex: 'route_path' },
    { title: '入口点', dataIndex: 'entry_point' },
    { title: '权限代码', dataIndex: 'permission_code' },
    {
      title: '菜单配置',
      dataIndex: 'menu_config',
      render: (value: any) => value ? (
        <pre style={{ 
          margin: 0, 
          fontSize: 12, 
          maxWidth: 600, 
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : '-',
    },
    {
      title: '系统应用',
      dataIndex: 'is_system',
      render: (value: boolean) => (value ? '是' : '否'),
    },
    {
      title: '安装状态',
      dataIndex: 'is_installed',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '已安装' : '未安装'}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    { title: '排序顺序', dataIndex: 'sort_order' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Application>
          headerTitle="应用中心"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              // 构建查询参数
              const apiParams: any = {
                skip: ((params.current || 1) - 1) * (params.pageSize || 12),
                limit: params.pageSize || 12,
              };

              // 添加筛选条件
              if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
                apiParams.is_active = searchFormValues.is_active === 'true' || searchFormValues.is_active === true;
              }
              if (searchFormValues?.is_installed !== undefined && searchFormValues.is_installed !== '' && searchFormValues.is_installed !== null) {
                apiParams.is_installed = searchFormValues.is_installed === 'true' || searchFormValues.is_installed === true;
              }

              const allData = await getApplicationList(apiParams);
              let filteredData = allData || [];

              // 前端筛选（因为后端可能不支持某些筛选）
              if (searchFormValues?.is_system !== undefined && searchFormValues.is_system !== '' && searchFormValues.is_system !== null) {
                filteredData = filteredData.filter(item => item.is_system === (searchFormValues.is_system === 'true' || searchFormValues.is_system === true));
              }

              // 搜索关键词筛选（name 或 code）
              if (searchFormValues?.name) {
                const keyword = String(searchFormValues.name).toLowerCase();
                filteredData = filteredData.filter(item =>
                  item.name.toLowerCase().includes(keyword) ||
                  item.code.toLowerCase().includes(keyword) ||
                  (item.description && item.description.toLowerCase().includes(keyword))
                );
              }

              return {
                data: filteredData,
                success: true,
                total: filteredData.length,
              };
            } catch (error: any) {
              console.error('获取应用列表失败:', error);
              messageApi.error(error?.message || '获取应用列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 12,
            showSizeChanger: true,
            pageSizeOptions: ['12', '24', '48', '96'],
          }}
          toolBarRender={() => []}
          viewTypes={['table', 'card']}
          defaultViewType="card"
          cardViewConfig={{
            renderCard: renderApplicationCard,
            columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
          }}
        />
      </ListPageTemplate>

    {/* 查看详情 Drawer */}
    <DetailDrawerTemplate<Application>
      title="应用详情"
      open={drawerVisible}
      onClose={() => setDrawerVisible(false)}
      loading={detailLoading}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      dataSource={detailData || {}}
      columns={detailColumns}
      column={1}
    />
  </>
  );
};

export default ApplicationListPage;

