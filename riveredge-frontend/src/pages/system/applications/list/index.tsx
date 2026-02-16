/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Switch, Card, Dropdown } from 'antd';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { theme } from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  StopOutlined,
  MoreOutlined,
  SettingOutlined,
  AppstoreOutlined,
  UserOutlined,
  ShopOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { ManufacturingIcons } from '../../../../utils/manufacturingIcons';
import {
  getApplicationList,
  getApplicationByUuid,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  updateApplication,
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
  // 编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);


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
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };

  /**
   * 处理更新应用配置（名称、排序等）
   */
  const handleUpdateAppConfig = async (record: Application, updateData: Partial<Application>) => {
    try {
      setSubmitting(true);
      await updateApplication(record.uuid, updateData);
      messageApi.success('应用配置更新成功');
      setEditModalVisible(false);
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      // 触发自定义事件，通知菜单立即刷新
      window.dispatchEvent(new CustomEvent('application-status-changed', {
        detail: { application: { ...record, ...updateData } }
      }));
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
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
      title: '排序顺序',
      dataIndex: 'sort_order',
      width: 100,
      sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
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
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const renderApplicationCard = (application: Application, _index: number) => {
    const menuItems = [
      {
        key: 'view',
        label: '查看详情',
        icon: <EyeOutlined />,
        onClick: () => handleView(application),
      },
      {
        key: 'sync-manifest',
        label: '菜单同步',
        icon: <AppstoreOutlined />,
        onClick: async () => {
          try {
            Modal.confirm({
              title: '菜单同步',
              content: `确定要从 manifest.json 同步应用菜单配置吗？`,
              onOk: async () => {
                messageApi.loading({ content: '正在同步菜单...', key: 'sync-manifest' });
                try {
                  const result = await syncApplicationManifest(application.code);

                  if (result.success) {
                    messageApi.success({
                      content: result.message || '菜单同步成功',
                      key: 'sync-manifest'
                    });

                    // 刷新应用列表
                    actionRef.current?.reload();

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
        key: 'edit-app',
        label: '应用设置',
        icon: <SettingOutlined />,
        onClick: () => {
          setEditingApp(application);
          setEditModalVisible(true);
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
          danger: true,
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
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: application.is_active && application.is_installed ? '#fff' : '#f5f5f5',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}
            >
              {(() => {
                const iconElement = getApplicationIcon(application.code, application.icon);
                if (React.isValidElement(iconElement) && iconElement.type === 'img') {
                  return React.cloneElement(iconElement as React.ReactElement, {
                    style: { width: '100%', height: '100%', objectFit: 'cover' },
                  });
                }
                return React.cloneElement(iconElement as React.ReactElement, {
                  style: {
                    fontSize: 48,
                    color: application.is_active && application.is_installed ? '#1890ff' : '#d9d9d9',
                  },
                });
              })()}
            </div>
          </div>
        }
        actions={[
          <div key="active" style={{ padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>启用状态</span>
            <Switch
              checked={application.is_active}
              onChange={(checked) => handleToggleActive(application, checked)}
              disabled={!application.is_installed}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </div>,
          <div key="more" style={{ padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />} style={{ width: '100%' }}>
                更多操作
              </Button>
            </Dropdown>
          </div>,
        ]}
      >
        <Card.Meta
          title={
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#262626', display: 'flex', alignItems: 'center' }}>
                  {application.name}
                  {application.is_custom_name && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', color: '#faad14' }} title="已自定义名称">
                      (已修改)
                    </span>
                  )}
                  {application.code === 'master-data' && (
                     <Tag color="geekblue" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>BASE</Tag>
                  )}
                  {(application.code === 'kuaimes' || application.code === 'kuaizhizao') && (
                     <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>LITE</Tag>
                  )}
                  {(application.code === 'bi' || application.code === 'kuaireport') && (
                     <Tag color="cyan" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>BI</Tag>
                  )}
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
    { title: '应用版本', dataIndex: 'version' },
    { title: '路由路径', dataIndex: 'route_path' },
    { title: '入口点', dataIndex: 'entry_point' },
    { title: '权限代码', dataIndex: 'permission_code' },
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
          request={async (params, _sort, _filter, searchFormValues) => {
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
          viewTypes={['table', 'help']}
          defaultViewType="table"
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
        dataSource={detailData || undefined}
        columns={detailColumns}
        column={1}
      />

      {/* 编辑应用 Modal */}
      <Modal
        title={`应用设置 - ${editingApp?.name}`}
        open={editModalVisible}
        onOk={() => {
          const form = document.getElementById('edit-app-form') as HTMLFormElement;
          const formData = new FormData(form);
          const name = formData.get('name') as string;
          const sortOrder = parseInt(formData.get('sort_order') as string, 10);

          if (editingApp) {
            const isCustomName = name !== editingApp.name || editingApp.is_custom_name;
            const isCustomSort = sortOrder !== (editingApp.sort_order || 0) || editingApp.is_custom_sort;
            handleUpdateAppConfig(editingApp, {
              name,
              sort_order: sortOrder,
              is_custom_name: isCustomName,
              is_custom_sort: isCustomSort
            });
          }
        }}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="restore"
            danger
            onClick={async () => {
              if (editingApp) {
                Modal.confirm({
                  title: '恢复默认设置',
                  content: '确定要恢复应用的默认名称和配置吗？这将从manifest.json重新同步。',
                  onOk: async () => {
                    setSubmitting(true);
                    try {
                      // 1. 先把自定义名称和排序标志位设为 false
                      await updateApplication(editingApp.uuid, {
                        is_custom_name: false,
                        is_custom_sort: false
                      });
                      // 2. 触发同步
                      await syncApplicationManifest(editingApp.code);
                      messageApi.success('已恢复默认设置');
                      setEditModalVisible(false);
                      actionRef.current?.reload();
                    } catch (error: any) {
                      messageApi.error(error.message || '恢复失败');
                    } finally {
                      setSubmitting(false);
                    }
                  }
                });
              }
            }}
          >
            恢复默认
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => {
            const form = document.getElementById('edit-app-form') as HTMLFormElement;
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }}>
            保存
          </Button>
        ]}
        destroyOnHidden
      >
        <form
          id="edit-app-form"
          style={{ padding: '20px 0' }}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name') as string;
            const sortOrder = parseInt(formData.get('sort_order') as string, 10);
            if (editingApp) {
              // 如果名称或排序变了，设为自定义标志
              const isCustomName = name !== editingApp.name || editingApp.is_custom_name;
              const isCustomSort = sortOrder !== (editingApp.sort_order || 0) || editingApp.is_custom_sort;
              handleUpdateAppConfig(editingApp, {
                name,
                sort_order: sortOrder,
                is_custom_name: isCustomName,
                is_custom_sort: isCustomSort
              });
            }
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>应用名称:</label>
            <input
              type="text"
              name="name"
              defaultValue={editingApp?.name}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>排序顺序 (越小越靠前):</label>
            <input
              type="number"
              name="sort_order"
              defaultValue={editingApp?.sort_order || 0}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
              }}
            />
          </div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
            提示：您可以自定义应用显示的名称。点击“恢复默认”将重新应用来自 manifest.json 的原始名称。
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ApplicationListPage;

