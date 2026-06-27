/**
 * 菜单管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的菜单。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 * 布局与部门管理对齐。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../components/uni-action';
import { ProFormText, ProFormSwitch, ProColumns, ProFormTreeSelect, ProFormSelect, ProFormItem, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import {
  DeleteOutlined,
  PlusOutlined,
  AppstoreOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { App, Button, Tag, Space, Popconfirm, Tooltip, Descriptions, Col, Modal, Spin } from 'antd';
import { flushDrawerOpen, ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../components/uni-detail';
import { UniTable } from '../../../components/uni-table';
import MenuIconPicker, { renderMenuIconByKey } from '../../../components/MenuIconPicker';
import {
  getMenuTree,
  getMenuDetail,
  createMenu,
  updateMenu,
  deleteMenu,
  Menu,
  MenuTree,
  getTenantBackendHome,
  setMenuAsBackendHome,
  clearTenantBackendHome,
  TENANT_BACKEND_HOME_QUERY_KEY,
  EFFECTIVE_HOME_QUERY_KEY,
  getMenuCustomLayout,
  updateMenuCustomLayout,
  getNavigationMenuTree,
} from '../../../services/menu';
import { getApplicationList } from '../../../services/application';
import { useGlobalStore } from '../../../stores';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  mapMenuTreeWithTranslatedLabels,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import CustomMenuLayoutEditor, {
  buildCustomLayoutPayload,
  parseCustomLayoutEditorState,
  type CustomLayoutEditorState,
} from './CustomMenuLayoutEditor';

// 菜单图标展示（与侧栏 ManufacturingIcons 一致）
const IconItem = ({ icon }: { icon?: string }) => renderMenuIconByKey(icon, 16);

function findMenuInTree(uuid: string | undefined | null, nodes: MenuTree[]): MenuTree | undefined {
  if (!uuid) return undefined;
  for (const node of nodes) {
    if (node.uuid === uuid) return node;
    if (node.children?.length) {
      const found = findMenuInTree(uuid, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

const trimField = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const CUSTOM_LAYOUT_QUERY_KEY = ['menuCustomLayout'] as const;

  /**
   * 递归获取所有菜单 UUID（用于一键展开）
   */
  const getAllKeys = (data: MenuTree[]): string[] => {
    let keys: string[] = [];
    data.forEach((item) => {
      keys.push(item.uuid);
      if (item.children && item.children.length > 0) {
        keys.push(...getAllKeys(item.children));
      }
    });
    return keys;
  };
  
const MenuListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: backendHome } = useQuery({
    queryKey: TENANT_BACKEND_HOME_QUERY_KEY,
    queryFn: getTenantBackendHome,
    enabled: !!currentUser,
    staleTime: 30 * 1000,
  });
  const actionRef = useRef<any>();
  const menuFormRef = useRef<ProFormInstance>();
  const menuDetailReqRef = useRef(0);

  const menuDetailDescColumns = useMemo<ProDescriptionsItemProps<Menu>[]>(
    () => [
      {
        title: t('pages.system.menus.name'),
        dataIndex: 'name',
        render: (_: unknown, row: Menu) =>
          translateAppMenuItemName(row?.name, row?.path, t, (row as any)?.children),
      },
      { title: t('pages.system.menus.path'), dataIndex: 'path' },
      {
        title: t('pages.system.menus.icon'),
        dataIndex: 'icon',
        render: (_: unknown, row: Menu) =>
          row?.icon ? (
            <Space size={6}>
              {renderMenuIconByKey(row.icon, 16)}
              <span>{row.icon}</span>
            </Space>
          ) : (
            '—'
          ),
      },
      { title: t('pages.system.menus.component'), dataIndex: 'component' },
      { title: t('pages.system.menus.permissionCode'), dataIndex: 'permission_code' },
      { title: t('pages.system.menus.sort'), dataIndex: 'sort_order' },
      {
        title: t('pages.system.menus.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: Menu) => (
          <Tag color={entity?.is_active ? 'success' : 'default'}>
            {entity?.is_active ? t('pages.system.menus.enabled') : t('pages.system.menus.disabled')}
          </Tag>
        ),
      },
      {
        title: t('pages.system.menus.externalLink'),
        dataIndex: 'is_external',
        render: (_: unknown, entity: Menu) => (
          <Tag color={entity?.is_external ? 'blue' : 'default'}>
            {entity?.is_external ? t('pages.system.menus.externalYes') : t('pages.system.menus.externalNo')}
          </Tag>
        ),
      },
      { title: t('pages.system.menus.externalUrl'), dataIndex: 'external_url' },
      { title: t('pages.system.menus.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('pages.system.menus.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  // 统计数据状态
  const [stats, setStats] = useState({
    totalCount: 0,
    activeCount: 0,
    externalCount: 0,
  });

  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMenuUuid, setCurrentMenuUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // 菜单树数据缓存（用于父菜单选择）
  const [menuTreeData, setMenuTreeData] = useState<MenuTree[]>([]);
  /** 父菜单 TreeSelect：展示译文，与列表列 translateAppMenuItemName 一致 */
  const parentMenuTreeData = useMemo(
    () => mapMenuTreeWithTranslatedLabels(menuTreeData, t),
    [menuTreeData, t, i18n.language],
  );
  // 应用列表
  const [applications, setApplications] = useState<Array<{ label: string; value: string }>>([]);

  // 展开/收起状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  // 选中行状态（用于批量删除）
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // 缓存扁平化数据
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [customLayoutModalOpen, setCustomLayoutModalOpen] = useState(false);
  const [customLayoutLoading, setCustomLayoutLoading] = useState(false);
  const [customLayoutSaving, setCustomLayoutSaving] = useState(false);
  const [customLayoutEditorState, setCustomLayoutEditorState] = useState<CustomLayoutEditorState>({
    enabled: false,
    appGroups: [],
    menuOverrides: {},
  });
  const [customLayoutSourceTree, setCustomLayoutSourceTree] = useState<MenuTree[]>([]);
  const [customLayoutMenuSearch, setCustomLayoutMenuSearch] = useState('');
  const [customLayoutActiveGroupId, setCustomLayoutActiveGroupId] = useState<string | undefined>(undefined);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Menu | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /** 菜单变更后刷新侧边栏/UniTabs/面包屑（统一数据源） */
  const refreshLayoutMenus = useCallback(() => {
    useGlobalStore.getState().incrementApplicationMenuVersion();
    queryClient.invalidateQueries({ queryKey: ['navigationMenuTree'] });
    queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    queryClient.invalidateQueries({ queryKey: [...CUSTOM_LAYOUT_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [...TENANT_BACKEND_HOME_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [...EFFECTIVE_HOME_QUERY_KEY] });
  }, [queryClient]);

  const customLayoutMenuLookup = useMemo(() => {
    const byUuid = new Map<string, MenuTree>();
    const walk = (nodes: MenuTree[]) => {
      nodes.forEach((node) => {
        byUuid.set(node.uuid, node);
        if (node.children?.length) walk(node.children);
      });
    };
    walk(customLayoutSourceTree);
    return byUuid;
  }, [customLayoutSourceTree]);

  const handleOpenCustomLayoutModal = useCallback(async () => {
    try {
      setCustomLayoutLoading(true);
      setCustomLayoutModalOpen(true);
      const [layout, sourceTree] = await Promise.all([
        getMenuCustomLayout(),
        getNavigationMenuTree(),
      ]);
      setCustomLayoutSourceTree(sourceTree);
      const parsed = parseCustomLayoutEditorState(layout.nodes || [], t);
      setCustomLayoutEditorState({ ...parsed, enabled: !!layout.enabled });
      setCustomLayoutActiveGroupId(parsed.appGroups[0]?.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.menus.customLayoutLoadFailed'));
    } finally {
      setCustomLayoutLoading(false);
    }
  }, [messageApi, t]);

  const handleSaveCustomLayout = useCallback(async () => {
    try {
      setCustomLayoutSaving(true);
      const payload = buildCustomLayoutPayload(customLayoutEditorState, customLayoutMenuLookup);
      await updateMenuCustomLayout(payload);
      messageApi.success(t('pages.system.menus.customLayoutSaveSuccess'));
      setCustomLayoutModalOpen(false);
      refreshLayoutMenus();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.menus.customLayoutSaveFailed'));
    } finally {
      setCustomLayoutSaving(false);
    }
  }, [customLayoutEditorState, customLayoutMenuLookup, messageApi, refreshLayoutMenus, t]);

  const handleSetBackendHome = useCallback(
    async (record: Menu) => {
      try {
        await setMenuAsBackendHome(record.uuid);
        messageApi.success(t('pages.system.menus.setBackendHomeSuccess'));
        await queryClient.invalidateQueries({ queryKey: [...TENANT_BACKEND_HOME_QUERY_KEY] });
        await queryClient.invalidateQueries({ queryKey: [...EFFECTIVE_HOME_QUERY_KEY] });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('pages.system.menus.setBackendHomeFailed'));
      }
    },
    [messageApi, queryClient, t],
  );

  const handleClearBackendHome = useCallback(async () => {
    try {
      await clearTenantBackendHome();
      messageApi.success(t('pages.system.menus.clearBackendHomeSuccess'));
      await queryClient.invalidateQueries({ queryKey: [...TENANT_BACKEND_HOME_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [...EFFECTIVE_HOME_QUERY_KEY] });
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('pages.system.menus.clearBackendHomeFailed'));
    }
  }, [messageApi, queryClient, t]);

  /**
   * 加载应用列表（用于新建/编辑表单的关联应用下拉）
   * 页面挂载时即请求，与菜单树并行，不阻塞首屏
   */
  const loadApplications = useCallback(async () => {
    try {
      const apps = await getApplicationList();
      setApplications(
        apps.map(app => ({
          label: app.name,
          value: app.uuid,
        }))
      );
    } catch (error: any) {
      console.warn('Failed to load applications:', error);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.uuid && applications.length === 0) {
      loadApplications();
    }
  }, [currentUser, applications.length, loadApplications]);

  /**
   * 加载数据（仅请求菜单树，应用列表已在上方并行加载）
   */
  const loadData = useCallback(async (_params: any, _sort: any, _filter: any, searchFormValues?: any) => {
    if (!currentUser) return { data: [], success: false, total: 0 };

    try {
      const response = await getMenuTree({
          is_active: searchFormValues?.is_active === 'true' ? true : (searchFormValues?.is_active === 'false' ? false : undefined),
      });

      // 客户端过滤 (因为 getMenuTree API 可能不支持 keyword)
      const keyword = searchFormValues?.keyword || searchFormValues?.name;
      
      const filterTree = (nodes: MenuTree[]): MenuTree[] => {
        if (!keyword) return nodes;
        return nodes.reduce((acc: MenuTree[], node) => {
          const matches = node.name.toLowerCase().includes(keyword.toLowerCase()) || 
                          (node.path && node.path.toLowerCase().includes(keyword.toLowerCase()));
          const filteredChildren = node.children ? filterTree(node.children) : [];
          
          if (matches || filteredChildren.length > 0) {
             acc.push({ ...node, children: filteredChildren });
          }
          return acc;
        }, []);
      };

      const finalData = filterTree(response);

      // 统计和扁平化 (基于完整数据 response)
      let active = 0;
      let external = 0;
      let total = 0;
      const flatList: Menu[] = [];
      
      const traverse = (nodes: MenuTree[]) => {
        nodes.forEach(node => {
           total++;
           if (node.is_active) active++;
           if (node.is_external) external++;
           
           const { children, ...rest } = node;
           flatList.push(rest as Menu);
           
           if (children) traverse(children);
        });
      };
      traverse(response);

      setStats({
        totalCount: total,
        activeCount: active,
        externalCount: external,
      });
      setAllMenus(flatList);
      setMenuTreeData(response);

      // 默认只展开一级，避免整树展开导致大量 DOM 渲染卡顿；有关键词时展开过滤后的整树便于查看
      if (expandedRowKeys.length === 0 && !keyword) {
        setExpandedRowKeys(finalData.map((node: MenuTree) => node.uuid));
      } else if (keyword) {
        setExpandedRowKeys(getAllKeys(finalData));
      }

      return {
        data: finalData,
        success: true,
        total: finalData.length,
      };
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.menus.loadMenuFailed'));
      return { data: [], success: false, total: 0 };
    }
  }, [currentUser, expandedRowKeys.length, messageApi, t]);

  /**
   * 校验是否可删除
   */
  const checkCanDelete = useCallback((record: Menu): { can: boolean; reason?: string } => {
     // UniTable 的 record 是来自 loadData 返回的 tree items
     const item = record as unknown as MenuTree; 
     if (item.children && item.children.length > 0) {
         return { can: false, reason: t('pages.system.menus.deleteChildFirst') };
     }
     return { can: true };
  }, [t]);

  /**
   * 处理删除
   */
  const handleDelete = useCallback(async (record: Menu) => {
    try {
      await deleteMenu(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      refreshLayoutMenus();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  }, [messageApi, refreshLayoutMenus, t]);

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    const canDeleteKeys: string[] = [];
    const cannotDeleteNames: string[] = [];

    keys.forEach((key) => {
      const menu = allMenus.find((m) => m.uuid === key);
      if (menu) {
        if (menu.application_uuid) {
          cannotDeleteNames.push(menu.name + '(' + t('pages.system.menus.appMenuSuffix') + ')');
        } else if (allMenus.some((m) => m.parent_uuid === menu.uuid)) {
          cannotDeleteNames.push(menu.name);
        } else {
          canDeleteKeys.push(menu.uuid);
        }
      }
    });

    if (cannotDeleteNames.length > 0) {
      messageApi.warning(t('pages.system.menus.cannotDeleteMenus', { names: cannotDeleteNames.join(', ') }));
      return;
    }

    try {
      await Promise.all(canDeleteKeys.map((key) => deleteMenu(key)));
      messageApi.success(t('pages.system.menus.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      refreshLayoutMenus();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e.message || t('pages.system.menus.batchDeleteFailed'));
    }
  }, [allMenus, messageApi, refreshLayoutMenus, t]);

  const handleCreate = useCallback((parentUuid?: string) => {
    const parent = findMenuInTree(parentUuid, menuTreeData);
    setIsEdit(false);
    setCurrentMenuUuid(null);
    setFormInitialValues({
      parent_uuid: parentUuid || null,
      application_uuid: parent?.application_uuid || undefined,
      is_active: true,
      is_external: false,
      sort_order: 0,
    });
    setModalVisible(true);
  }, [menuTreeData]);

  const handleEdit = useCallback(async (record: Menu) => {
    try {
        setIsEdit(true);
        setCurrentMenuUuid(record.uuid);
        const detail = await getMenuDetail(record.uuid);
        
        const { meta: _meta, ...detailWithoutMeta } = detail;
        setFormInitialValues(detailWithoutMeta);
        setModalVisible(true);
    } catch (error: any) {
        messageApi.error(error.message || t('pages.system.menus.getDetailFailed'));
    }
  }, [messageApi, t]);
  
  const handleView = useCallback(
    async (record: Menu) => {
      const req = ++menuDetailReqRef.current;
      flushDrawerOpen(() => {
        setDrawerVisible(true);
        setDetailData(null);
        setDetailLoading(true);
      });
      try {
        const detail = await getMenuDetail(record.uuid);
        if (menuDetailReqRef.current !== req) return;
        setDetailData(detail);
      } catch (error: any) {
        if (menuDetailReqRef.current === req) {
          messageApi.error(error.message || t('pages.system.menus.getDetailFailed'));
        }
      } finally {
        if (menuDetailReqRef.current === req) {
          setDetailLoading(false);
        }
      }
    },
    [messageApi, t]
  );

  const handleSubmit = useCallback(async (values: any) => {
    try {
        setFormLoading(true);
        // 只提交后端支持的字段，去掉详情里可能混入的只读字段；meta 由 manifest 同步维护，不在此编辑
        const payload: Record<string, any> = {
          name: values.name,
          path: values.path,
          icon: values.icon,
          component: values.component,
          permission_code: values.permission_code,
          application_uuid: values.application_uuid,
          parent_uuid: values.parent_uuid,
          sort_order: values.sort_order,
          is_active: values.is_active,
          is_external: values.is_external,
          external_url: values.external_url,
        };
        Object.keys(payload).forEach((k) => {
          const v = payload[k];
          if (v === undefined) delete payload[k];
        });
        if (!isEdit) {
          const parent = findMenuInTree(values.parent_uuid, menuTreeData);
          if (parent?.application_uuid) {
            payload.application_uuid = parent.application_uuid;
          } else {
            delete payload.application_uuid;
          }
        }
        
        if (isEdit && currentMenuUuid) {
            await updateMenu(currentMenuUuid, payload as any);
            messageApi.success(t('pages.system.updateSuccess'));
        } else {
            await createMenu(payload as any);
            messageApi.success(t('pages.system.createSuccess'));
        }
        setModalVisible(false);
        refreshLayoutMenus();
        actionRef.current?.reload();
    } catch (error: any) {
        messageApi.error(error.message || t('pages.system.operationFailed'));
    } finally {
        setFormLoading(false);
    }
  }, [currentMenuUuid, isEdit, menuTreeData, messageApi, refreshLayoutMenus, t]);

  const columns: ProColumns<Menu>[] = useMemo(() => [
    {
        title: t('pages.system.menus.menuName'),
        dataIndex: 'name',
        width: 250,
        fixed: 'left',
        render: (_: any, record: Menu) => {
             const treeItem = record as unknown as MenuTree;
             const displayName = translateAppMenuItemName(
               record.name,
               record.path,
               t,
               treeItem.children
             );
             return (
               <Space size={6}>
                 <IconItem icon={record.icon} />
                 <span style={{ fontWeight: 500 }}>{displayName}</span>
                 {backendHome?.menu_uuid === record.uuid ? (
                   <Tag color="gold">{t('pages.system.menus.backendHomeCurrent')}</Tag>
                 ) : null}
               </Space>
             );
        }
    },
    {
        title: t('pages.system.menus.path'),
        dataIndex: 'path',
        copyable: true,
        ellipsis: true,
    },
    {
        title: t('pages.system.menus.icon'),
        dataIndex: 'icon',
        width: 100,
        hideInSearch: true,
        render: (_: any, record: Menu) =>
          record.icon ? (
            <Space size={4}>
              {renderMenuIconByKey(record.icon, 14)}
              <Tag>{record.icon}</Tag>
            </Space>
          ) : (
            '-'
          ),
    },
    {
        title: t('pages.system.menus.component'),
        dataIndex: 'component',
        ellipsis: true,
        hideInSearch: true,
    },
    {
        title: t('pages.system.menus.sort'),
        dataIndex: 'sort_order',
        width: 80,
        valueType: 'digit',
        hideInSearch: true,
        sorter: (a: Menu, b: Menu) => a.sort_order - b.sort_order,
    },
    {
        title: t('pages.system.menus.status'),
        dataIndex: 'is_active',
        width: 100,
        valueType: 'select',
        valueEnum: {
            true: { text: t('pages.system.applications.enabled'), status: 'Success' },
            false: { text: t('pages.system.applications.disabled'), status: 'Default' },
        },
        render: (_: any, record: Menu) => (
            <Tag color={record.is_active ? 'success' : 'default'}>
                {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
            </Tag>
        )
    },
    {
        title: t('pages.system.menus.source'),
        dataIndex: 'application_uuid',
        width: 100,
        hideInSearch: true,
        render: (_: any, record: Menu) =>
          record.application_uuid ? (
            <Tooltip title={t('menu.system.appMenuSyncTip')}>
              <Tag color="blue" icon={<SyncOutlined />}>
                {t('menu.system.appMenu')}
              </Tag>
            </Tooltip>
          ) : (
            <Tag color="geekblue" icon={<SettingOutlined />}>
              {t('menu.system.systemMenu')}
            </Tag>
          ),
    },
    {
        title: t('common.actions'),
        valueType: 'option',
        minWidth: 120,
        fixed: 'right',
        render: (_: any, record: Menu) => {
            const isAppMenu = !!record.application_uuid;
            const deleteCheck = checkCanDelete(record);
            const canDelete = !isAppMenu && deleteCheck.can;
            const canSetHome =
              record.is_active && !record.is_external && !!(record.path && String(record.path).trim());
            const actions: React.ReactNode[] = [
              <Button {...rowActionKind('read')} key="detail" type="default" onClick={() => handleView(record)}>
                {t('common.detail')}
              </Button>,
              <Button {...rowActionKind('update')} key="edit" type="primary" onClick={() => handleEdit(record)}>
                {t('pages.system.menus.edit')}
              </Button>,
              <Tooltip {...rowActionKind('update')}
                key="setHome"
                title={canSetHome ? undefined : t('pages.system.menus.setBackendHomeDisabled')}
              >
                <span>
                  <Button
                    type="default"
                    size="small"
                    icon={<HomeOutlined />}
                    disabled={!canSetHome}
                    onClick={() => void handleSetBackendHome(record)}
                  >
                    {t('pages.system.menus.setAsBackendHome')}
                  </Button>
                </span>
              </Tooltip>,
              <Popconfirm {...rowActionKind('delete')}
                key="delete"
                title={t('pages.system.menus.deleteConfirm')}
                onConfirm={() => handleDelete(record)}
                disabled={!canDelete}
              >
                <Tooltip
                  title={
                    isAppMenu
                      ? t('menu.system.appMenuDeleteDisabled')
                      : deleteCheck.reason
                  }
                >
                  <span>
                    <Button type="default" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                      {t('pages.system.menus.delete')}
                    </Button>
                  </span>
                </Tooltip>
              </Popconfirm>,
              <Button {...rowActionKind('create')}
                key="addChild"
                type="default"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleCreate(record.uuid)}
              >
                {t('pages.system.menus.addChild')}
              </Button>,
            ];
            return actions;
        }
    }
  ], [backendHome?.menu_uuid, checkCanDelete, handleCreate, handleDelete, handleEdit, handleSetBackendHome, handleView, t]);

  if (!currentUser) return null;

  return (
    <ListPageTemplate>
        <UniTable<Menu>
            columnPersistenceId="pages.system.menus"
            actionRef={actionRef}
            headerTitle={t('pages.system.menus.listTitle')}
            rowKey="uuid"
            columns={columns}
            request={loadData}
            showCreateButton
            createButtonText={t('pages.system.menus.createMenu')}
            onCreate={() => handleCreate()}
            showDeleteButton
            onDelete={handleBatchDelete}
            deleteButtonText={t('pages.system.menus.batchDelete')}
            deleteConfirmTitle={t('pages.system.menus.batchDeleteTitle')}
            deleteConfirmDescription={(c) => t('pages.system.menus.batchDeleteDescription', { count: c })}
            enableRowSelection
            selectedRowKeys={selectedRowKeys}
            onRowSelectionChange={setSelectedRowKeys}
            showImportButton={false}
            showExportButton={true}
            onExport={async (type, keys, pageData) => {
              const flattenTree = (nodes: any[]): Menu[] =>
                nodes.flatMap((n) => {
                  const { children, ...rest } = n;
                  return [rest as Menu, ...(children ? flattenTree(children) : [])];
                });
              let items: Menu[] = [];
              if (type === 'currentPage' && pageData?.length) {
                items = flattenTree(pageData);
              } else if (type === 'selected' && keys?.length) {
                items = allMenus.filter((d) => keys.includes(d.uuid));
              } else {
                items = allMenus;
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.menus.noDataToExport'));
                return;
              }
              const blob = new window.Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `menus-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.menus.exportedCount', { count: items.length }));
            }}
            toolBarRender={() => [
              <Button
                key="customLayout"
                icon={<AppstoreOutlined />}
                onClick={() => void handleOpenCustomLayoutModal()}
              >
                {t('pages.system.menus.customLayoutButton')}
              </Button>,
              ...(backendHome?.menu_uuid
                ? [
                    <Popconfirm {...rowActionKind('update')}
                      key="clearBackendHome"
                      title={t('pages.system.menus.clearBackendHomeConfirm')}
                      onConfirm={() => void handleClearBackendHome()}
                    >
                      <Button icon={<HomeOutlined />}>{t('pages.system.menus.restoreDefaultBackendHome')}</Button>
                    </Popconfirm>,
                  ]
                : []),
                 <Button {...rowActionKind('skip')}
                    key="toggleExpand"
                    onClick={() => {
                    if (expandedRowKeys.length > 0) {
                        setExpandedRowKeys([]);
                    } else {
                        setExpandedRowKeys(getAllKeys(menuTreeData));
                    }
                    }}
                >
                    {expandedRowKeys.length > 0 ? t('pages.system.menus.collapseAll') : t('pages.system.menus.expandAll')}
                </Button>,
            ]}
            pagination={{ defaultPageSize: 50, showSizeChanger: true }}
             expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
            }}
            search={{ labelWidth: 'auto' }}
            showAdvancedSearch={true}
        />

        <FormModalTemplate
            title={isEdit ? t('pages.system.menus.editMenu') : t('pages.system.menus.createMenu')}
            open={modalVisible}
            onClose={() => setModalVisible(false)}
            onFinish={handleSubmit}
            isEdit={isEdit}
            initialValues={formInitialValues}
            loading={formLoading}
            width={MODAL_CONFIG.STANDARD_WIDTH}
            grid
            formRef={menuFormRef}
            onValuesChange={(changed, all) => {
              if (!('parent_uuid' in changed)) return;
              const parent = findMenuInTree(all.parent_uuid, menuTreeData);
              menuFormRef.current?.setFieldValue(
                'application_uuid',
                parent?.application_uuid ?? undefined,
              );
            }}
        >
             <ProFormText
               name="name"
               label={t('pages.system.menus.menuName')}
               rules={[{ required: true, message: t('pages.system.menus.menuNameRequired') }]}
               placeholder={t('pages.system.menus.menuNamePlaceholder')}
               colProps={{ span: 12 }}
             />
             <ProFormText name="path" label={t('pages.system.menus.path')} placeholder={t('pages.system.menus.pathPlaceholder')} colProps={{ span: 12 }} />
             <Col span={12}>
               <ProFormItem name="icon" label={t('pages.system.menus.icon')}>
                 <MenuIconPicker
                   placeholder={t('pages.system.menus.iconPickerPlaceholder')}
                   searchPlaceholder={t('pages.system.menus.iconSearchPlaceholder')}
                   clearText={t('common.clear')}
                   emptyText={t('pages.system.menus.iconSearchEmpty')}
                 />
               </ProFormItem>
             </Col>
             <ProFormText name="component" label={t('pages.system.menus.componentPath')} placeholder={t('pages.system.menus.componentPathPlaceholder')} colProps={{ span: 12 }} />
             <ProFormTreeSelect
                name="parent_uuid"
                label={t('pages.system.menus.parentMenu')}
                placeholder={t('pages.system.menus.parentMenuPlaceholder')}
                fieldProps={{
                    treeData: parentMenuTreeData,
                    fieldNames: { label: 'name', value: 'uuid', children: 'children' },
                    showSearch: true,
                    allowClear: true,
                    treeDefaultExpandAll: true,
                    variant: 'outlined',
                }}
                colProps={{ span: 24 }}
             />
             <ProFormSelect
                name="application_uuid"
                label={t('pages.system.menus.relatedApp')}
                options={applications}
                placeholder={t('pages.system.menus.relatedAppPlaceholder')}
                disabled
                tooltip={t('pages.system.menus.relatedAppInheritedHint')}
                fieldProps={{ variant: 'outlined' }}
                colProps={{ span: 12 }}
             />
             <ProFormText
               name="permission_code"
               label={t('pages.system.menus.permissionCode')}
               dependencies={['is_external', 'path']}
               rules={[
                 ({ getFieldValue }) => ({
                   validator: async (_, value) => {
                     if (getFieldValue('is_external')) return;
                     const path = trimField(getFieldValue('path'));
                     if (path && !trimField(value)) {
                       throw new Error(t('pages.system.menus.permissionCodeRequired'));
                     }
                   },
                 }),
               ]}
               colProps={{ span: 12 }}
             />
             <ProFormText
               name="sort_order"
               label={t('pages.system.menus.sort')}
               tooltip={t('pages.system.menus.sortOrderAppMenuHint')}
               fieldProps={{ type: 'number' }}
               colProps={{ span: 12 }}
             />
             <ProFormSwitch name="is_active" label={t('pages.system.menus.enabled')} colProps={{ span: 12 }} />
             <ProFormSwitch name="is_external" label={t('pages.system.menus.externalLink')} colProps={{ span: 12 }} />
             <ProFormText
               name="external_url"
               label={t('pages.system.menus.externalUrl')}
               dependencies={['is_external']}
               rules={[
                 ({ getFieldValue }) => ({
                   validator: async (_, value) => {
                     if (!getFieldValue('is_external')) return;
                     if (!trimField(value)) {
                       throw new Error(t('pages.system.menus.externalUrlRequired'));
                     }
                   },
                 }),
               ]}
               colProps={{ span: 12 }}
             />
        </FormModalTemplate>

        <UniDetail
            title={t('pages.system.menus.detailTitle')}
            open={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            loading={detailLoading}
            width={DRAWER_CONFIG.STANDARD_WIDTH}
            basic={
              detailData ? (
                <Descriptions
                  column={1}
                  items={detailDrawerDescriptionItems(menuDetailDescColumns, detailData)}
                />
              ) : null
            }
        />

        <Modal
          title={t('pages.system.menus.customLayoutTitle')}
          open={customLayoutModalOpen}
          onCancel={() => setCustomLayoutModalOpen(false)}
          onOk={() => void handleSaveCustomLayout()}
          width={1200}
          confirmLoading={customLayoutSaving}
          destroyOnHidden
        >
          <Spin spinning={customLayoutLoading}>
            <CustomMenuLayoutEditor
              sourceTree={customLayoutSourceTree}
              state={customLayoutEditorState}
              activeGroupId={customLayoutActiveGroupId}
              menuSearch={customLayoutMenuSearch}
              onStateChange={(patch) => setCustomLayoutEditorState((prev) => ({ ...prev, ...patch }))}
              onActiveGroupIdChange={setCustomLayoutActiveGroupId}
              onMenuSearchChange={setCustomLayoutMenuSearch}
            />
          </Spin>
        </Modal>
    </ListPageTemplate>
  );
};

export default MenuListPage;
