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
import { App, Button, Card, Descriptions, Dropdown, Modal, Popconfirm, Space, Switch, Tag } from 'antd';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
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
  activateProApplication,
  updateApplication,
  syncApplicationManifest,
  scanApplications,
  Application,
} from '../../../../services/application';
import { syncAllMenus } from '../../../../services/menu';
import { renderRowActionsOverflow } from '../../../../utils/renderRowActionsOverflow';

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
    kuaizhizao: React.createElement(ManufacturingIcons.production, { size }),
    kuaicaiwu: React.createElement(ManufacturingIcons.wallet, { size }),
    kuaireport: React.createElement(ManufacturingIcons.fileBarChart, { size }),
    'master-data': React.createElement(ManufacturingIcons.database, { size }),
    kuaiai: React.createElement(ManufacturingIcons.sparkles, { size }),
    kuaiiot: React.createElement(ManufacturingIcons.cpu, { size }),
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
  if (!isActive) return 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
  const gradients: Record<string, string> = {
    // 采用更明快、高明度的渐变色，提升活力感
    kuaizhizao: 'linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)',  // 天蓝色
    kuaicaiwu: 'linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)',   // 琥珀金
    kuaireport: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',  // 翡翠绿
    'master-data': 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)', // 丁香紫
    kuaiai: 'linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%)',      // 玫瑰粉
    kuaiiot: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',     // 青绿色
    kuaimes: 'linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)',     // 天蓝色
    bi: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',          // 翡翠绿
  };
  return gradients[code] || 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
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
  const proKeyFormRef = useRef<ProFormInstance>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [proKeyModalVisible, setProKeyModalVisible] = useState(false);
  const [proKeySubmitting, setProKeySubmitting] = useState(false);
  const [proKeyTargetApp, setProKeyTargetApp] = useState<Application | null>(null);
  const [pendingEnableAfterActivation, setPendingEnableAfterActivation] = useState(false);
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
      messageApi.info({
        content: t('pages.system.applications.scanMenuHint', {
          defaultValue: '扫描只更新应用清单。若菜单或权限未刷新，请点击「一键同步菜单」。',
        }),
        duration: 6,
      });
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
      messageApi.loading({
        content: t('pages.system.applications.syncAllLoading', {
          defaultValue: '正在执行：① 各应用清单同步 ② 菜单全量写入数据库…',
        }),
        key: 'sync-all',
      });
      let successCount = 0;
      const errors: string[] = [];
      const unknown = () => t('pages.system.applications.syncAllErrUnknown', { defaultValue: '未知错误' });
      for (const code of codes) {
        try {
          const result = await syncApplicationManifest(code);
          if (result.success) successCount += 1;
          else {
            errors.push(
              t('pages.system.applications.syncAllErrManifest', {
                code,
                detail: (result.message || '').trim() || unknown(),
              })
            );
          }
        } catch (e: any) {
          errors.push(
            t('pages.system.applications.syncAllErrManifest', {
              code,
              detail: (e?.message || String(e)).trim() || unknown(),
            })
          );
        }
      }
      // 再执行一次「同步全部菜单」，确保菜单与数据库完全一致（解决 manifest 更新后菜单未显示的问题）
      try {
        await syncAllMenus();
      } catch (e: any) {
        errors.push(
          t('pages.system.applications.syncAllErrMenusDb', {
            detail: (e?.message || String(e)).trim() || unknown(),
          })
        );
      }
      if (errors.length > 0) {
        messageApi.warning({
          content: (
            <span style={{ whiteSpace: 'pre-line' }}>
              {t('pages.system.applications.syncAllPartial', {
                success: successCount,
                total: codes.length,
                errors: errors.slice(0, 3).join('\n'),
              })}
            </span>
          ),
          key: 'sync-all',
          duration: 10,
        });
      } else {
        messageApi.success({
          content: t('pages.system.applications.syncAllSuccess', {
            count: successCount,
            defaultValue: `第 1 步「应用清单」${successCount} 个已全部同步；第 2 步「菜单入库」已成功。`,
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
        const isProApp = record.is_pro || record.code === 'kuaireport' || record.code === 'bi' || record.code === 'kuaiiot';
        if (isProApp && !record.can_access) {
          setProKeyTargetApp(record);
          setPendingEnableAfterActivation(true);
          setProKeyModalVisible(true);
          setTimeout(() => {
            proKeyFormRef.current?.setFieldsValue({ license_key: '' });
          }, 0);
          return;
        }
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

  const handleActivateProKey = async (values: { license_key: string }) => {
    if (!proKeyTargetApp) return;
    try {
      setProKeySubmitting(true);
      await activateProApplication(proKeyTargetApp.uuid, values.license_key);
      if (pendingEnableAfterActivation) {
        await enableApplication(proKeyTargetApp.uuid);
      }
      messageApi.success(
        pendingEnableAfterActivation
          ? t('pages.system.applications.proActivateAndEnableSuccess', { defaultValue: 'License Key 校验通过，应用已启用' })
          : t('pages.system.applications.proActivateSuccess', { defaultValue: 'License Key 校验通过，已完成授权' })
      );
      setProKeyModalVisible(false);
      setPendingEnableAfterActivation(false);
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
      useGlobalStore.getState().incrementApplicationMenuVersion();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.proActivateFailed', { defaultValue: 'License Key 校验失败' }));
    } finally {
      setProKeySubmitting(false);
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
      width: 250,
      fixed: 'right',
      render: (_, record) => {
        const canSync = record.is_installed && record.is_active;
        const actions: React.ReactNode[] = [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.system.applications.view')}
          </Button>
        ];

        // 更多操作同步自 Card View 的 menuItems 逻辑
        actions.push(
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => {
              setEditingApp(record);
              setEditModalVisible(true);
            }}
          >
            {t('pages.system.applications.appSettings')}
          </Button>
        );

        if (canSync) {
          actions.push(
            <Popconfirm
              key="sync"
              title={t('pages.system.applications.syncMenu')}
              description={t('pages.system.applications.syncMenuConfirm')}
              onConfirm={async () => {
                messageApi.loading({ content: t('pages.system.applications.syncMenuLoading'), key: 'sync-manifest' });
                try {
                  const result = await syncApplicationManifest(record.code);
                  if (result.success) {
                    messageApi.success({ content: result.message || t('pages.system.applications.syncMenuSuccess'), key: 'sync-manifest' });
                    actionRef.current?.reload();
                    useGlobalStore.getState().incrementApplicationMenuVersion();
                  } else {
                    throw new Error(result.message || t('pages.system.applications.syncFailed'));
                  }
                } catch (error: any) {
                  messageApi.error({ content: error.message || t('pages.system.applications.syncFailed'), key: 'sync-manifest' });
                }
              }}
            >
              <Button
                type="link"
                size="small"
                icon={<SyncOutlined />}
              >
                {t('pages.system.applications.syncMenu')}
              </Button>
            </Popconfirm>
          );
        }

        if (record.is_installed) {
          if (record.code === "kuaizhizao") {
            actions.push(
              <Button
                key="reset"
                type="link"
                danger
                size="small"
                icon={<SyncOutlined />}
                onClick={() => {
                  setResetTargetApp(record);
                  setResetStage(1);
                  setResetConfirmText('');
                  setResetModalVisible(true);
                }}
              >
                {t('pages.system.applications.resetData', { defaultValue: '重置数据' })}
              </Button>
            );
          }

          actions.push(
            <Popconfirm
              key="uninstall"
              title={t('pages.system.applications.uninstallConfirm')}
              onConfirm={() => handleUninstall(record)}
              disabled={record.is_system}
            >
              <Button
                type="link"
                danger
                size="small"
                disabled={record.is_system}
                icon={<StopOutlined />}
              >
                {t('pages.system.applications.uninstall')}
              </Button>
            </Popconfirm>
          );
        } else {
          actions.push(
            <Popconfirm
              key="install"
              title={t('pages.system.applications.installConfirm')}
              onConfirm={() => handleInstall(record)}
            >
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
              >
                {t('pages.system.applications.install')}
              </Button>
            </Popconfirm>
          );
        }

        return renderRowActionsOverflow(actions, `app-${record.uuid}`);
      },
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
        key: 'edit-app',
        label: t('pages.system.applications.appSettings'),
        icon: <SettingOutlined />,
        onClick: () => {
          setEditingApp(application);
          setEditModalVisible(true);
        },
      },
      {
        key: 'sync-manifest',
        label: (
          <Popconfirm
            title={t('pages.system.applications.syncMenu')}
            description={t('pages.system.applications.syncMenuConfirm')}
            onConfirm={async () => {
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
            }}
          >
            <div 
              style={{ margin: '-5px -12px', padding: '5px 12px' }} 
              onClick={(e) => e.stopPropagation()}
            >
              {t('pages.system.applications.syncMenu')}
            </div>
          </Popconfirm>
        ),
        icon: <AppstoreOutlined />,
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
          label: (
            <Popconfirm
              title={t('pages.system.applications.installConfirm')}
              onConfirm={() => handleInstall(application)}
            >
              <div 
                style={{ margin: '-5px -12px', padding: '5px 12px' }} 
                onClick={(e) => e.stopPropagation()}
              >
                {t('pages.system.applications.install')}
              </div>
            </Popconfirm>
          ),
          icon: <DownloadOutlined />,
        }
        : {
          key: 'uninstall',
          label: (
            <Popconfirm
              title={t('pages.system.applications.uninstallConfirm')}
              onConfirm={() => handleUninstall(application)}
              disabled={application.is_system}
            >
              <div 
                style={{ margin: '-5px -12px', padding: '5px 12px' }} 
                onClick={(e) => e.stopPropagation()}
              >
                {t('pages.system.applications.uninstall')}
              </div>
            </Popconfirm>
          ),
          icon: <StopOutlined />,
          danger: true,
          disabled: application.is_system,
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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, overflow: 'hidden' }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#262626', whiteSpace: 'nowrap', marginRight: 4, flexShrink: 0 }}>
                  {application.name}
                </span>
                
                {/* 使用统一样式的徽章组 */}
                {(() => {
                  const badgeBaseStyle: React.CSSProperties = {
                    height: 18,
                    padding: '0 5px',
                    fontSize: 10,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    border: 'none',
                    marginLeft: 4,
                    flexShrink: 0,
                  };

                    const renderBadge = (text: string, bg: string, color: string, icon?: React.ReactNode) => (
                      <span style={{ ...badgeBaseStyle, backgroundColor: bg, color }}>
                        {icon && <span style={{ display: 'inline-flex', marginRight: 4 }}>{icon}</span>}
                        {text}
                      </span>
                    );

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                        {/* 左侧组：应用类型、档位、锁定状态 */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 1, overflow: 'hidden' }}>
                          {application.code === 'master-data' && (
                            <>
                              {renderBadge('BASE', '#f0f5ff', '#2f54eb')}
                              {renderBadge('FREE', '#f6ffed', '#52c41a')}
                            </>
                          )}
                          {['kuaizhizao', 'kuaimes', 'kuaicaiwu'].includes(application.code) && (
                            <>
                              {renderBadge('APP', '#f9f0ff', '#722ed1')}
                              {renderBadge('FREE', '#f6ffed', '#52c41a')}
                            </>
                          )}
                          {['kuaireport', 'bi'].includes(application.code) && (
                            <>
                              {renderBadge('APP', '#f9f0ff', '#722ed1')}
                              {renderBadge('PRO', '#fffbe6', '#faad14')}
                            </>
                          )}
                          {application.code === 'kuaiai' && (
                            <>
                              {renderBadge('AI', '#fff7e6', '#fa8c16')}
                              {renderBadge('PRO', '#fffbe6', '#faad14')}
                            </>
                          )}
                          {application.code === 'kuaiiot' && (
                            <>
                              {renderBadge('IOT', '#e6fffb', '#13c2c2')}
                              {renderBadge('PRO', '#fffbe6', '#faad14')}
                            </>
                          )}

                          {/* 锁定提示 */}
                          {(application.is_pro || ['kuaireport', 'bi', 'kuaiiot'].includes(application.code)) && !application.can_access && (
                             renderBadge(t('pages.system.applications.proLockedTag'), '#f5f5f5', '#595959', <LockOutlined style={{ fontSize: 11 }} />)
                          )}
                        </div>

                        {/* 弹性占位，将后续徽章推向右侧 */}
                        <div style={{ flex: 1, minWidth: 8 }} />

                        {/* 右侧组：安装状态、系统状态 */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {application.is_installed ? (
                            renderBadge(t('pages.system.applications.installed'), '#f6ffed', '#52c41a')
                          ) : (
                            renderBadge(t('pages.system.applications.notInstalled'), '#fff1f0', '#f5222d')
                          )}
                          {application.is_system && renderBadge(t('pages.system.applications.systemTag'), '#fafafa', '#8c8c8c')}
                        </div>
                      </div>
                    );
                  })()}
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
              let filteredData = (allData || []).map(app => {
                // 强制将快报表和 BI 识别为非授权 PRO 模式，与 AI 保持一致
                if (['kuaireport', 'bi'].includes(app.code)) {
                  return { ...app, is_pro: true, can_access: false };
                }
                return app;
              });

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
        destroyOnHidden
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
                      const response = await fetch(`/api/v1/apps/kuaizhizao/management/reset-data`, {
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
      <DetailDrawerTemplate
        title={t('pages.system.applications.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detailData)} />
          ) : undefined}
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
        key={proKeyTargetApp?.uuid ?? 'pro-key'}
        title={t('pages.system.applications.proKeyModalTitle', { defaultValue: '输入 License Key（许可证密钥）' })}
        open={proKeyModalVisible}
        onClose={() => {
          setProKeyModalVisible(false);
          setPendingEnableAfterActivation(false);
        }}
        onFinish={handleActivateProKey}
        isEdit={true}
        loading={proKeySubmitting}
        formRef={proKeyFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText.Password
          name="license_key"
          label={t('pages.system.applications.proKeyLabel', { defaultValue: 'License Key（许可证密钥）' })}
          placeholder={t('pages.system.applications.proKeyPlaceholder', { defaultValue: '请输入 License Key' })}
          rules={[
            { required: true, message: t('common.required', { defaultValue: '必填' }) },
            { min: 8, message: t('pages.system.applications.proKeyMinLength', { defaultValue: 'License Key 长度至少 8 位' }) },
          ]}
          fieldProps={{
            autoComplete: 'off',
          }}
        />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
          {t('pages.system.applications.proKeyHint', { defaultValue: '系统仅保存 License Key 摘要（不可逆），用于后续授权校验。' })}
        </div>
      </FormModalTemplate>


    </>
  );
};

export default ApplicationListPage;

