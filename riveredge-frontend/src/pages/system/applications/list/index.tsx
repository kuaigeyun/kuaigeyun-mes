/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProFormInstance, ProFormText, ProFormTextArea, ProFormDigit, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Switch, Card, Dropdown, Modal } from 'antd';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../components/layout-templates';
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
  ArrowUpOutlined,
  LockOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { ManufacturingIcons } from '../../../../utils/manufacturingIcons';
import { useGlobalStore } from '../../../../stores';
import {
  getApplicationList,
  getApplicationByUuid,
  getInstalledApplicationList,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  updateApplication,
  syncApplicationManifest,
  scanApplications,
  Application,
} from '../../../../services/application';
import { syncAllMenus } from '../../../../services/menu';

/** 卡片内图标尺寸（缩小以显得更精致，圆角背景保持 88x88） */
const CARD_ICON_SIZE = 52;

/**
 * 根据应用代码和图标配置获取图标组件
 *
 * @param code - 应用代码
 * @param icon - 图标配置（可以是图片路径或 lucide 图标名称）
 * @param size - 图标尺寸（默认 72，卡片内使用 CARD_ICON_SIZE）
 */
const getApplicationIcon = (code: string, icon?: string | null, size: number = 72) => {
  if (icon && (icon.startsWith('/') || icon.startsWith('http'))) {
    return <img src={icon} alt={code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (icon && ManufacturingIcons[icon as keyof typeof ManufacturingIcons]) {
    const IconComponent = ManufacturingIcons[icon as keyof typeof ManufacturingIcons];
    return React.createElement(IconComponent, { size });
  }
  const iconMap: Record<string, React.ReactNode> = {
    kuaimes: React.createElement(ManufacturingIcons.production, { size }),
    kuaicrm: React.createElement(ManufacturingIcons.users, { size }),
    kuaipdm: React.createElement(ManufacturingIcons.layers, { size }),
    kuaizhizao: React.createElement(ManufacturingIcons.production, { size }),
    kuaichain: React.createElement(ManufacturingIcons.gitBranch, { size }),
    kuaicaiwu: React.createElement(ManufacturingIcons.wallet, { size }),
    kuaireport: React.createElement(ManufacturingIcons.fileBarChart, { size }),
    'master-data': React.createElement(ManufacturingIcons.database, { size }),
    kuaiai: React.createElement(ManufacturingIcons.sparkles, { size }),
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

/** 各应用卡片渐变背景（素雅略深、契合主题，避免蓝紫 AI 风） */
const getCardGradient = (code: string, isActive: boolean): string => {
  if (!isActive) return 'linear-gradient(135deg, #e8e8e8 0%, #f2f2f2 100%)';
  const gradients: Record<string, string> = {
    kuaicrm: 'linear-gradient(135deg, #f8e4dc 0%, #f5ede8 100%)',      // 暖珊瑚
    kuaipdm: 'linear-gradient(135deg, #dceee6 0%, #eaf5f0 100%)',      // 青绿
    kuaizhizao: 'linear-gradient(135deg, #e5e2de 0%, #eeebe8 100%)',   // 暖灰
    kuaichain: 'linear-gradient(135deg, #d8ebe8 0%, #e8f4f1 100%)',    // 薄荷
    kuaicaiwu: 'linear-gradient(135deg, #f5ecd8 0%, #f0ebe0 100%)',    // 暖金
    kuaireport: 'linear-gradient(135deg, #dce4f0 0%, #e8eef6 100%)',   // 淡天青
    'master-data': 'linear-gradient(135deg, #dce0e6 0%, #e8ecf2 100%)', // 石板灰
    kuaiai: 'linear-gradient(135deg, #f8e8e0 0%, #f2ebe6 100%)',       // 暖杏
    kuaimes: 'linear-gradient(135deg, #e5e2de 0%, #eeebe8 100%)',      // 暖灰
    bi: 'linear-gradient(135deg, #dce4f0 0%, #e8eef6 100%)',          // 淡天青
  };
  return gradients[code] || 'linear-gradient(135deg, #e8e8e8 0%, #f0f0f0 100%)';
};

/**
 * 应用中心列表页面组件
 */
const ApplicationListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const editFormRef = useRef<ProFormInstance>(null);
  const upgradeFormRef = useRef<ProFormInstance>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 升版相关状态
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradingApp, setUpgradingApp] = useState<Application | null>(null);
  const [scanning, setScanning] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetApp, setResetTargetApp] = useState<Application | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStage, setResetStage] = useState(1); // 1, 2, 3

  /**
   * 处理扫描应用（从 src/apps 发现并注册）
   */
  const handleScanApplications = async () => {
    try {
      setScanning(true);
      const apps = await scanApplications();
      messageApi.success(t('pages.system.applications.scanSuccess', { count: apps?.length ?? 0, defaultValue: `已扫描并注册 ${apps?.length ?? 0} 个应用` }));
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
      useGlobalStore.getState().incrementApplicationMenuVersion();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.scanFailed', { defaultValue: '扫描应用失败' }));
    } finally {
      setScanning(false);
    }
  };

  /**
   * 一键同步所有已安装应用的菜单
   */
  const handleSyncAllMenus = async () => {
    try {
      setSyncAllLoading(true);
      const apps = await getInstalledApplicationList({ is_active: true });
      const codes = apps.map((a) => a.code).filter(Boolean);
      if (codes.length === 0) {
        messageApi.info(t('pages.system.applications.syncAllNoApps', { defaultValue: '暂无已安装的应用' }));
        return;
      }
      messageApi.loading({ content: t('pages.system.applications.syncAllLoading', { defaultValue: '正在同步菜单...' }), key: 'sync-all' });
      let successCount = 0;
      const errors: string[] = [];
      for (const code of codes) {
        try {
          const result = await syncApplicationManifest(code);
          if (result.success) successCount += 1;
          else errors.push(`${code}: ${result.message || ''}`);
        } catch (e: any) {
          errors.push(`${code}: ${e?.message || String(e)}`);
        }
      }
      // 再执行一次「同步全部菜单」，确保菜单与数据库完全一致（解决 manifest 更新后菜单未显示的问题）
      try {
        await syncAllMenus();
      } catch (e: any) {
        errors.push(`sync-all: ${e?.message || String(e)}`);
      }
      if (errors.length > 0) {
        messageApi.warning({
          content: t('pages.system.applications.syncAllPartial', {
            success: successCount,
            total: codes.length,
            errors: errors.slice(0, 3).join('; '),
            defaultValue: `已同步 ${successCount}/${codes.length} 个应用，部分失败: ${errors.slice(0, 3).join('; ')}`,
          }),
          key: 'sync-all',
        });
      } else {
        messageApi.success({
          content: t('pages.system.applications.syncAllSuccess', {
            count: successCount,
            defaultValue: `已同步 ${successCount} 个应用菜单`,
          }),
          key: 'sync-all',
        });
      }
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
      useGlobalStore.getState().incrementApplicationMenuVersion();
    } catch (error: any) {
      messageApi.error({
        content: error?.message || t('pages.system.applications.syncAllFailed', { defaultValue: '一键同步菜单失败' }),
        key: 'sync-all',
      });
    } finally {
      setSyncAllLoading(false);
    }
  };

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
      messageApi.error(error.message || t('pages.system.applications.getDetailFailed'));
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
      messageApi.success(t('pages.system.applications.installSuccess'));
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      useGlobalStore.getState().incrementApplicationMenuVersion();
      console.log(`📢 已触发应用安装事件: ${record.name}`);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.installFailed'));
    }
  };

  /**
   * 处理卸载应用
   */
  const handleUninstall = async (record: Application) => {
    try {
      await uninstallApplication(record.uuid);
      messageApi.success(t('pages.system.applications.uninstallSuccess'));
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      useGlobalStore.getState().incrementApplicationMenuVersion();
      console.log(`📢 已触发应用卸载事件: ${record.name}`);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.uninstallFailed'));
    }
  };

  /**
   * 处理启用/禁用应用
   */
  const handleToggleActive = async (record: Application, checked: boolean) => {
    try {
      if (checked) {
        await enableApplication(record.uuid);
        messageApi.success(t('pages.system.applications.enableSuccess'));
      } else {
        await disableApplication(record.uuid);
        messageApi.success(t('pages.system.applications.disableSuccess'));
      }
      actionRef.current?.reload();

      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      useGlobalStore.getState().incrementApplicationMenuVersion();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.operationFailed'));
    }
  };

  /**
   * 处理更新应用配置（名称、排序等）
   */
  const handleUpdateAppConfig = async (record: Application, updateData: Partial<Application>) => {
    try {
      setSubmitting(true);
      await updateApplication(record.uuid, updateData);
      messageApi.success(t('pages.system.applications.configUpdateSuccess'));
      setEditModalVisible(false);
      actionRef.current?.reload();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });

      useGlobalStore.getState().incrementApplicationMenuVersion();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };



  /**
   * 处理应用升版
   */
  const handleUpgradeApp = async (record: Application, version: string, changelog: string) => {
    try {
      setSubmitting(true);
      await updateApplication(record.uuid, { version, changelog });
      messageApi.success(t('pages.system.applications.upgradeSuccess'));
      setUpgradeModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };


  /**
   * 表格列定义
   */
  const columns: ProColumns<Application>[] = [
    {
      title: t('pages.system.applications.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.applications.code'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.system.applications.description'),
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.applications.sortOrder'),
      dataIndex: 'sort_order',
      width: 100,
      sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    },
    {
      title: t('pages.system.applications.isSystem'),
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Default' },
        false: { text: t('field.customField.no'), status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.installStatus'),
      dataIndex: 'is_installed',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.installed'), status: 'Success' },
        false: { text: t('pages.system.applications.notInstalled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_installed ? 'success' : 'default'}>
          {record.is_installed ? t('pages.system.applications.installed') : t('pages.system.applications.notInstalled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.enabled'), status: 'Success' },
        false: { text: t('pages.system.applications.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.version'),
      dataIndex: 'version',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('pages.system.applications.actions'),
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
            {t('pages.system.applications.view')}
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
        label: t('pages.system.applications.viewDetail'),
        icon: <EyeOutlined />,
        onClick: () => handleView(application),
      },
      {
        key: 'sync-manifest',
        label: t('pages.system.applications.syncMenu'),
        icon: <AppstoreOutlined />,
        onClick: async () => {
          try {
            modalApi.confirm({
              title: t('pages.system.applications.syncMenu'),
              content: t('pages.system.applications.syncMenuConfirm'),
              onOk: async () => {
                messageApi.loading({ content: t('pages.system.applications.syncMenuLoading'), key: 'sync-manifest' });
                try {
                  const result = await syncApplicationManifest(application.code);

                  if (result.success) {
                    messageApi.success({
                      content: result.message || t('pages.system.applications.syncMenuSuccess'),
                      key: 'sync-manifest'
                    });

                    actionRef.current?.reload();

                    useGlobalStore.getState().incrementApplicationMenuVersion();
                  } else {
                    throw new Error(result.message || t('pages.system.applications.syncFailed'));
                  }

                } catch (error: any) {
                  messageApi.error({
                    content: error.message || t('pages.system.applications.syncFailed'),
                    key: 'sync-manifest'
                  });
                }
              },
            });
          } catch (error: any) {
            messageApi.error(error.message || t('pages.system.applications.operationFailed'));
          }
        },
      },
      {
        key: 'edit-app',
        label: t('pages.system.applications.appSettings'),
        icon: <SettingOutlined />,
        onClick: () => {
          setEditingApp(application);
          setEditModalVisible(true);
        },
      },
      {
        key: 'upgrade-app',
        label: t('pages.system.applications.appUpgrade'),
        icon: <ArrowUpOutlined />,
        onClick: () => {
          setUpgradingApp(application);
          setUpgradeModalVisible(true);
        },
      },
      application.code === "kuaizhizao" ? {
        key: 'reset-data',
        label: t('pages.system.applications.resetData', { defaultValue: '重置数据' }),
        icon: <SyncOutlined />,
        danger: true,
        onClick: () => {
          setResetTargetApp(application);
          setResetStage(1);
          setResetConfirmText('');
          setResetModalVisible(true);
        },
      } : null,
      {
        type: 'divider' as const,
      },
      !application.is_installed
        ? {
          key: 'install',
          label: t('pages.system.applications.install'),
          icon: <DownloadOutlined />,
          onClick: () => {
            modalApi.confirm({
              title: t('pages.system.applications.installConfirm'),
              onOk: () => handleInstall(application),
            });
          },
        }
        : {
          key: 'uninstall',
          label: t('pages.system.applications.uninstall'),
          icon: <StopOutlined />,
          danger: true,
          disabled: application.is_system,
          onClick: () => {
            if (application.is_system) return;
            modalApi.confirm({
              title: t('pages.system.applications.uninstallConfirm'),
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
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          overflow: 'hidden',
        }}
        cover={
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: getCardGradient(application.code, !!(application.is_active && application.is_installed)),
              padding: '16px',
              borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
              borderTopLeftRadius: themeToken.borderRadiusLG,
              borderTopRightRadius: themeToken.borderRadiusLG,
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
                const iconElement = getApplicationIcon(application.code, application.icon, CARD_ICON_SIZE);
                if (React.isValidElement(iconElement) && iconElement.type === 'img') {
                  return React.cloneElement(iconElement as React.ReactElement, {
                    style: { width: CARD_ICON_SIZE, height: CARD_ICON_SIZE, objectFit: 'contain' },
                  });
                }
                return React.cloneElement(iconElement as React.ReactElement, {
                  style: {
                    fontSize: CARD_ICON_SIZE,
                    color: application.is_active && application.is_installed ? '#1890ff' : '#d9d9d9',
                  },
                });
              })()}
            </div>
          </div>
        }
        actions={[
          <div key="active" style={{ padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{t('pages.system.applications.activeStatus')}</span>
            <Switch
              checked={application.is_active}
              onChange={(checked) => handleToggleActive(application, checked)}
              disabled={!application.is_installed}
              checkedChildren={t('pages.system.applications.enabled')}
              unCheckedChildren={t('pages.system.applications.disabled')}
            />
          </div>,
          <div key="more" style={{ padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />} style={{ width: '100%' }}>
                {t('pages.system.applications.moreActions')}
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
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', color: '#faad14' }} title={t('pages.system.applications.customNameTag')}>
                      ({t('pages.system.applications.customNameTag')})
                    </span>
                  )}
                  {application.code === 'master-data' && (
                     <Tag color="geekblue" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>Base</Tag>
                  )}
                  {(application.code === 'kuaimes' || application.code === 'kuaizhizao') && (
                     <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>Lite</Tag>
                  )}
                  {['kuaicrm', 'kuaipdm', 'kuaichain', 'kuaicaiwu'].includes(application.code) && (
                     <>
                       <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>Lite</Tag>
                       <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>{t('pages.system.applications.planningTag')}</Tag>
                     </>
                  )}
                  {(application.code === 'bi' || application.code === 'kuaireport') && (
                     <Tag color="cyan" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>BI</Tag>
                  )}
                  {application.is_pro && (
                     <Tag color="gold" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>PRO</Tag>
                  )}
                  {application.is_pro && !application.can_access && (
                     <Tag icon={<LockOutlined />} color="default" style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px', transform: 'scale(0.9)' }}>
                       {t('pages.system.applications.proLockedTag')}
                     </Tag>
                  )}
                </span>
                <Space size={4}>
                  {application.is_system && (
                    <Tag color="default" style={{ margin: 0 }}>{t('pages.system.applications.systemTag')}</Tag>
                  )}
                  {application.is_installed ? (
                    <Tag color="success" style={{ margin: 0 }}>{t('pages.system.applications.installed')}</Tag>
                  ) : (
                    <Tag style={{ margin: 0 }}>{t('pages.system.applications.notInstalled')}</Tag>
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
                {application.description || t('pages.system.applications.noDescription')}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#8c8c8c',
                  paddingTop: 8,
                  borderTop: `1px solid ${themeToken.colorBorderSecondary}`,
                }}
              >
                <span>{t('pages.system.applications.codeLabel')}: {application.code}</span>
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
  const detailColumns: ProDescriptionsItemProps<Application>[] = [
    { title: t('pages.system.applications.name'), dataIndex: 'name' },
    { title: t('pages.system.applications.code'), dataIndex: 'code' },
    { title: t('pages.system.applications.description'), dataIndex: 'description' },
    { title: t('pages.system.applications.version'), dataIndex: 'version' },
    { title: t('pages.system.applications.changelog'), dataIndex: 'changelog', render: (val: any) => <span>{val || '-'}</span> },
    { title: t('pages.system.applications.routePath'), dataIndex: 'route_path' },
    { title: t('pages.system.applications.entryPoint'), dataIndex: 'entry_point' },
    { title: t('pages.system.applications.permissionCode'), dataIndex: 'permission_code' },
    {
      title: t('pages.system.applications.isSystem'),
      dataIndex: 'is_system',
      render: (dom: any) => (dom ? t('field.customField.yes') : t('field.customField.no')),
    },
    {
      title: t('pages.system.applications.installStatus'),
      dataIndex: 'is_installed',
      render: (dom: any) => (
        <Tag color={dom ? 'success' : 'default'}>
          {dom ? t('pages.system.applications.installed') : t('pages.system.applications.notInstalled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.activeStatus'),
      dataIndex: 'is_active',
      render: (dom: any) => (
        <Tag color={dom ? 'success' : 'default'}>
          {dom ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    { title: t('pages.system.applications.sortOrder'), dataIndex: 'sort_order' },
    { title: t('pages.system.applications.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.applications.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Application>
          headerTitle={t('pages.system.applications.headerTitle')}
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
              messageApi.error(error?.message || t('pages.system.applications.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const apiParams: any = { skip: 0, limit: 10000 };
              const allData = await getApplicationList(apiParams);
              let items = allData || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.applications.noDataExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `applications-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.applications.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.applications.exportFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 12,
            showSizeChanger: true,
            pageSizeOptions: ['12', '24', '48', '96'],
          }}
          toolBarRender={() => [
            <Button
              key="scan"
              type="primary"
              icon={<AppstoreOutlined />}
              loading={scanning}
              onClick={handleScanApplications}
            >
              {t('pages.system.applications.scanApplications', { defaultValue: '扫描应用' })}
            </Button>,
            <Button
              key="sync-all"
              icon={<SyncOutlined />}
              loading={syncAllLoading}
              onClick={handleSyncAllMenus}
            >
              {t('pages.system.applications.syncAllMenus', { defaultValue: '一键同步菜单' })}
            </Button>,
          ]}
          viewTypes={['card', 'table', 'help']}
          defaultViewType="card"
          cardViewConfig={{
            renderCard: renderApplicationCard,
            columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
          }}
        />
      </ListPageTemplate>

      <Modal
        title={t('pages.system.applications.resetData', { defaultValue: '重置数据' })}
        open={resetModalVisible}
        onCancel={() => setResetModalVisible(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          {resetStage === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 500, color: '#ff4d4f' }}>
                {t('pages.system.applications.resetWarnTitle', { defaultValue: '⚠️ 极大风险操作：数据重置' })}
              </div>
              <p style={{ color: '#666', marginBottom: 24, padding: '0 20px', lineHeight: '1.6' }}>
                {t('pages.system.applications.resetWarn1', { defaultValue: '重置操作将物理抹除“快制造”应用下所有的销售订单、生产工单、库存流水、需求计划等业务数据。此操作不可撤销！' })}
              </p>
              <Button 
                type="primary" 
                danger 
                size="large" 
                block
                onClick={() => setResetStage(2)}
              >
                {t('pages.system.applications.resetNext', { defaultValue: '我已了解风险，下一步' })}
              </Button>
            </div>
          )}

          {resetStage === 2 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#f5222d' }}>
                {t('pages.system.applications.resetWarnTitle2', { defaultValue: '再次确认：您确定要继续吗？' })}
              </div>
              <p style={{ color: '#333', marginBottom: 24, fontWeight: 500 }}>
                {t('pages.system.applications.resetWarn2', { defaultValue: '一旦点击下一步，数据将无法通过常规手段恢复。建议您确保当前没有正在进行的业务，并告知相关团队成员。' })}
              </p>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button 
                  type="primary" 
                  danger 
                  size="large" 
                  block
                  onClick={() => setResetStage(3)}
                >
                  {t('pages.system.applications.resetConfirmNext', { defaultValue: '我很确定，继续重置' })}
                </Button>
                <Button block onClick={() => setResetModalVisible(false)}>
                  {t('pages.system.applications.resetCancel', { defaultValue: '我再想想，取消重置' })}
                </Button>
              </Space>
            </div>
          )}

          {resetStage === 3 && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 500, color: '#262626' }}>
                {t('pages.system.applications.resetFinalCheck', { defaultValue: '终极安全校验' })}
              </div>
              <p style={{ color: '#666', marginBottom: 12 }}>
                {t('pages.system.applications.resetTypeConfirm', { defaultValue: '请在下方准确输入以下内容以确认操作：' })}
              </p>
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontWeight: 'bold', color: '#856404' }}>
                我已知晓重置数据会造成的影响
              </div>
              <ProFormText
                placeholder={t('pages.system.applications.resetInputPlaceholder', { defaultValue: '请输入确认文本' })}
                fieldProps={{
                  value: resetConfirmText,
                  onChange: (e) => setResetConfirmText(e.target.value),
                }}
              />
              <div style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  danger 
                  size="large" 
                  block
                  loading={submitting}
                  disabled={resetConfirmText !== '我已知晓重置数据会造成的影响'}
                  onClick={async () => {
                    if (resetConfirmText !== '我已知晓重置数据会造成的影响') return;
                    try {
                      setSubmitting(true);
                      // Call the new API
                      const response = await fetch(`/api/apps/kuaizhizao/management/reset-data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      const result = await response.json();
                      if (result.success) {
                        messageApi.success(result.message || '重置成功并已自动备份');
                        setResetModalVisible(false);
                      } else {
                        messageApi.error(result.message || '重置失败');
                      }
                    } catch (error: any) {
                      messageApi.error('通讯失败: ' + error.message);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {t('pages.system.applications.resetStart', { defaultValue: '启动全量物理重置（且自动备份）' })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<Application>
        title={t('pages.system.applications.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns}
        column={1}
      />

      {/* 应用设置 Modal - 使用 FormModalTemplate */}
      <FormModalTemplate
        key={editingApp?.uuid ?? 'edit'}
        title={t('pages.system.applications.editModalTitle', { name: editingApp?.name ?? '' })}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onFinish={async (values: any) => {
          if (editingApp) {
            const isCustomName = values.name !== editingApp.name || editingApp.is_custom_name;
            const isCustomSort = values.sort_order !== (editingApp.sort_order ?? 0) || editingApp.is_custom_sort;
            await handleUpdateAppConfig(editingApp, {
              name: values.name,
              description: values.description?.trim() || undefined,
              sort_order: values.sort_order,
              is_custom_name: isCustomName,
              is_custom_sort: isCustomSort,
            });
          }
        }}
        isEdit={true}
        loading={submitting}
        formRef={editFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={
          editingApp
            ? {
                name: editingApp.name,
                description: editingApp.description ?? '',
                sort_order: editingApp.sort_order ?? 0,
              }
            : undefined
        }
        extraFooter={
          editingApp ? (
            <Button
              danger
              onClick={() => {
                modalApi.confirm({
                  title: t('pages.system.applications.restoreDefault'),
                  content: t('pages.system.applications.restoreDefaultConfirm'),
                  onOk: async () => {
                    setSubmitting(true);
                    try {
                      await updateApplication(editingApp.uuid, {
                        is_custom_name: false,
                        is_custom_sort: false,
                      });
                      await syncApplicationManifest(editingApp.code);
                      messageApi.success(t('pages.system.applications.restoreSuccess'));
                      setEditModalVisible(false);
                      actionRef.current?.reload();
                    } catch (error: any) {
                      messageApi.error(error.message || t('pages.system.applications.restoreFailed'));
                    } finally {
                      setSubmitting(false);
                    }
                  },
                });
              }}
            >
              {t('pages.system.applications.restoreDefault')}
            </Button>
          ) : null
        }
      >
        <ProFormText
          name="name"
          label={t('pages.system.applications.nameLabel')}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.applications.descriptionLabel')}
          placeholder={t('pages.system.applications.descriptionPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
        <ProFormDigit
          name="sort_order"
          label={t('pages.system.applications.sortOrderHint')}
          fieldProps={{ min: 0 }}
        />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
          {t('pages.system.applications.editHint')}
        </div>
      </FormModalTemplate>

      {/* 应用升版 Modal - 使用 FormModalTemplate */}
      <FormModalTemplate
        key={upgradingApp?.uuid ?? 'upgrade'}
        title={t('pages.system.applications.upgradeModalTitle', { name: upgradingApp?.name ?? '' })}
        open={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        onFinish={async (values: any) => {
          if (upgradingApp) {
            await handleUpgradeApp(upgradingApp, values.version, values.changelog ?? '');
          }
        }}
        isEdit={true}
        loading={submitting}
        formRef={upgradeFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={
          upgradingApp
            ? {
                version: upgradingApp.version ?? '',
                changelog: upgradingApp.changelog ?? '',
              }
            : undefined
        }
      >
        <ProFormText
          name="version"
          label={t('pages.system.applications.newVersionLabel')}
          placeholder={t('pages.system.applications.newVersionPlaceholder')}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
        />
        <ProFormTextArea
          name="changelog"
          label={t('pages.system.applications.changelogLabel')}
          placeholder={t('pages.system.applications.changelogPlaceholder')}
          fieldProps={{ rows: 5 }}
        />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
          {t('pages.system.applications.upgradeHint')}
        </div>
      </FormModalTemplate>
    </>
  );
};

export default ApplicationListPage;

