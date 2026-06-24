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
import { App, Button, Tag, Space, Popconfirm, Tooltip, Descriptions, Col, Modal, Switch, Card, Input, Select, Typography, Empty, Row } from 'antd';
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
  CustomMenuLayoutNode,
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
} from '../../../utils/menuTranslation';

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

type CustomLayoutGroup = {
  id: string;
  type: 'app_group' | 'custom_group';
  title: string;
  icon?: string;
  menuUuids: string[];
};

type MenuOverride = {
  title?: string;
  icon?: string;
};

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
  const [customLayoutEnabled, setCustomLayoutEnabled] = useState(false);
  const [customLayoutGroups, setCustomLayoutGroups] = useState<CustomLayoutGroup[]>([]);
  const [customLayoutMenuOverrides, setCustomLayoutMenuOverrides] = useState<Record<string, MenuOverride>>({});
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

  const customLayoutMenuLibrary = useMemo(() => {
    const rows: Array<{ key: string; title: string; description: string }> = [];
    const walk = (nodes: MenuTree[], appLabel?: string) => {
      nodes.forEach((node) => {
        const currentAppLabel = appLabel || (node.path?.split('/')?.[2] || node.name);
        if (node.path) {
          const translated = translateAppMenuItemName(node.name, node.path, t, node.children);
          rows.push({
            key: node.uuid,
            title: translated || node.name,
            description: `${currentAppLabel} · ${node.path}`,
          });
        }
        if (node.children?.length) walk(node.children, currentAppLabel);
      });
    };
    walk(customLayoutSourceTree);
    return rows;
  }, [customLayoutSourceTree, t]);

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

  const parseCustomLayoutToState = useCallback((nodes: CustomMenuLayoutNode[]) => {
    const groups: CustomLayoutGroup[] = [];
    const menuOverrides: Record<string, MenuOverride> = {};

    nodes.forEach((root, idx) => {
      const groupId = root.id || `group-${idx + 1}`;
      const groupType = root.type === 'app_group' ? 'app_group' : 'custom_group';
      const group: CustomLayoutGroup = {
        id: groupId,
        type: groupType,
        title: root.title || (groupType === 'app_group' ? t('pages.system.menus.customLayoutDefaultAppGroup') : t('pages.system.menus.customLayoutDefaultGroup')),
        icon: root.icon,
        menuUuids: [],
      };
      (root.children || []).forEach((child) => {
        if (child.type !== 'menu_ref' || !child.menu_uuid) return;
        const menuUuid = String(child.menu_uuid);
        group.menuUuids.push(menuUuid);
        if (child.title || child.icon) {
          menuOverrides[menuUuid] = {
            title: child.title || undefined,
            icon: child.icon || undefined,
          };
        }
      });
      groups.push(group);
    });
    return { groups, menuOverrides };
  }, [t]);

  const buildCustomLayoutPayload = useCallback((): { enabled: boolean; nodes: CustomMenuLayoutNode[] } => {
    const groups = [...customLayoutGroups];
    const assignedMenuUuids = groups.flatMap((g) => g.menuUuids);
    if (assignedMenuUuids.length > 0 && groups.length === 0) {
      groups.push({
        id: 'app-group-auto',
        type: 'app_group',
        title: t('pages.system.menus.customLayoutDefaultAppGroup'),
        menuUuids: assignedMenuUuids,
      });
    }
    const nodes: CustomMenuLayoutNode[] = groups.map((group) => ({
      id: group.id,
      type: group.type,
      title: group.title,
      icon: group.icon,
      children: (group.menuUuids || [])
        .map((uuid) => {
          const source = customLayoutMenuLookup.get(uuid);
          const override = customLayoutMenuOverrides[uuid] || {};
          return {
            id: `${group.id}-${uuid}`,
            type: 'menu_ref',
            menu_uuid: uuid,
            menu_path: source?.path,
            title: override.title || undefined,
            icon: override.icon || undefined,
            children: [],
          } as CustomMenuLayoutNode;
        }),
    }));
    return {
      enabled: customLayoutEnabled,
      nodes,
    };
  }, [
    customLayoutEnabled,
    customLayoutGroups,
    customLayoutMenuLookup,
    customLayoutMenuOverrides,
    t,
  ]);

  const handleOpenCustomLayoutModal = useCallback(async () => {
    try {
      setCustomLayoutLoading(true);
      setCustomLayoutModalOpen(true);
      const [layout, sourceTree] = await Promise.all([
        getMenuCustomLayout(),
        getNavigationMenuTree(),
      ]);
      setCustomLayoutSourceTree(sourceTree);
      const parsed = parseCustomLayoutToState(layout.nodes || []);
      setCustomLayoutEnabled(!!layout.enabled);
      setCustomLayoutGroups(parsed.groups);
      setCustomLayoutMenuOverrides(parsed.menuOverrides);
      setCustomLayoutActiveGroupId(parsed.groups[0]?.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.menus.customLayoutLoadFailed'));
    } finally {
      setCustomLayoutLoading(false);
    }
  }, [messageApi, parseCustomLayoutToState, t]);

  const handleSaveCustomLayout = useCallback(async () => {
    try {
      setCustomLayoutSaving(true);
      const payload = buildCustomLayoutPayload();
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
  }, [buildCustomLayoutPayload, messageApi, refreshLayoutMenus, t]);

  const handleAddCustomLayoutGroup = useCallback((type: 'app_group' | 'custom_group') => {
    const id = `${type}-${Date.now()}`;
    setCustomLayoutGroups((prev) => [
      ...prev,
      {
        id,
        type,
        title: type === 'app_group' ? t('pages.system.menus.customLayoutDefaultAppGroup') : t('pages.system.menus.customLayoutDefaultGroup'),
        menuUuids: [],
      },
    ]);
    setCustomLayoutActiveGroupId(id);
  }, [t]);

  const assignedMenuUuids = useMemo(
    () => new Set(customLayoutGroups.flatMap((g) => g.menuUuids)),
    [customLayoutGroups],
  );

  const customLayoutAvailableMenus = useMemo(() => {
    const kw = customLayoutMenuSearch.trim().toLowerCase();
    return customLayoutMenuLibrary.filter((item) => {
      if (assignedMenuUuids.has(item.key)) return false;
      if (!kw) return true;
      return `${item.title} ${item.description}`.toLowerCase().includes(kw);
    });
  }, [assignedMenuUuids, customLayoutMenuLibrary, customLayoutMenuSearch]);

  const handleQuickAddMenuToActiveGroup = useCallback((menuUuid: string) => {
    let targetGroupId = customLayoutActiveGroupId;
    if (!targetGroupId) {
      const id = `custom_group-${Date.now()}`;
      const nextGroup: CustomLayoutGroup = {
        id,
        type: 'custom_group',
        title: t('pages.system.menus.customLayoutDefaultGroup'),
        menuUuids: [menuUuid],
      };
      setCustomLayoutGroups((prev) => [...prev, nextGroup]);
      setCustomLayoutActiveGroupId(id);
      return;
    }
    setCustomLayoutGroups((prev) =>
      prev.map((group) => {
        if (group.id !== targetGroupId) return group;
        if (group.menuUuids.includes(menuUuid)) return group;
        return { ...group, menuUuids: [...group.menuUuids, menuUuid] };
      }),
    );
  }, [customLayoutActiveGroupId, t]);

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
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space align="center" size={12}>
              <Typography.Text>{t('pages.system.menus.customLayoutEnabled')}</Typography.Text>
              <Switch checked={customLayoutEnabled} onChange={setCustomLayoutEnabled} />
            </Space>
            <Row gutter={12}>
              <Col span={10}>
                <Card title={t('pages.system.menus.customLayoutTransferSource')} size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Select
                      allowClear
                      placeholder={t('pages.system.menus.customLayoutGroupSelectForQuickAdd')}
                      value={customLayoutActiveGroupId}
                      onChange={(value) => setCustomLayoutActiveGroupId(value)}
                      options={customLayoutGroups.map((g) => ({
                        value: g.id,
                        label: `${g.type === 'app_group'
                          ? t('pages.system.menus.customLayoutGroupTypeApp')
                          : t('pages.system.menus.customLayoutGroupTypeCustom')} · ${g.title || g.id}`,
                      }))}
                    />
                    <Input
                      value={customLayoutMenuSearch}
                      onChange={(e) => setCustomLayoutMenuSearch(e.target.value)}
                      placeholder={t('pages.system.menus.customLayoutSearchMenuPlaceholder')}
                    />
                    <div style={{ maxHeight: 460, overflowY: 'auto' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size={6}>
                        {customLayoutAvailableMenus.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.system.menus.customLayoutNoAvailableMenus')} />
                        ) : customLayoutAvailableMenus.map((item) => (
                          <Card key={item.key} size="small" styles={{ body: { padding: 10 } }}>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                              <div style={{ minWidth: 0 }}>
                                <Typography.Text ellipsis>{item.title}</Typography.Text>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                                  {item.description}
                                </Typography.Text>
                              </div>
                              <Button size="small" type="primary" onClick={() => handleQuickAddMenuToActiveGroup(item.key)}>
                                {t('pages.system.menus.customLayoutQuickAdd')}
                              </Button>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </div>
                  </Space>
                </Card>
              </Col>
              <Col span={14}>
                <Space style={{ marginBottom: 8 }}>
                  <Button onClick={() => handleAddCustomLayoutGroup('app_group')}>
                    {t('pages.system.menus.customLayoutAddAppGroup')}
                  </Button>
                  <Button onClick={() => handleAddCustomLayoutGroup('custom_group')}>
                    {t('pages.system.menus.customLayoutAddGroup')}
                  </Button>
                </Space>
                {customLayoutGroups.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.system.menus.customLayoutNoGroups')} />
                ) : (
                  <Space direction="vertical" style={{ width: '100%', maxHeight: 500, overflowY: 'auto' }} size={8}>
                    {customLayoutGroups.map((group, groupIndex) => (
                      <Card
                        key={group.id}
                        size="small"
                        title={
                          <Space>
                            <Tag color={group.type === 'app_group' ? 'blue' : 'default'}>
                              {group.type === 'app_group'
                                ? t('pages.system.menus.customLayoutGroupTypeApp')
                                : t('pages.system.menus.customLayoutGroupTypeCustom')}
                            </Tag>
                            <Input
                              value={group.title}
                              onChange={(e) =>
                                setCustomLayoutGroups((prev) =>
                                  prev.map((g) => (g.id === group.id ? { ...g, title: e.target.value } : g)),
                                )
                              }
                              style={{ width: 220 }}
                              placeholder={t('pages.system.menus.customLayoutGroupTitle')}
                            />
                            <MenuIconPicker
                              value={group.icon}
                              onChange={(icon) =>
                                setCustomLayoutGroups((prev) =>
                                  prev.map((g) => (g.id === group.id ? { ...g, icon } : g)),
                                )
                              }
                            />
                          </Space>
                        }
                        extra={
                          <Space>
                            <Button
                              size="small"
                              disabled={groupIndex === 0}
                              onClick={() =>
                                setCustomLayoutGroups((prev) => {
                                  const next = [...prev];
                                  if (groupIndex <= 0) return next;
                                  [next[groupIndex - 1], next[groupIndex]] = [next[groupIndex], next[groupIndex - 1]];
                                  return next;
                                })
                              }
                            >
                              ↑
                            </Button>
                            <Button
                              size="small"
                              disabled={groupIndex === customLayoutGroups.length - 1}
                              onClick={() =>
                                setCustomLayoutGroups((prev) => {
                                  const next = [...prev];
                                  if (groupIndex >= next.length - 1) return next;
                                  [next[groupIndex + 1], next[groupIndex]] = [next[groupIndex], next[groupIndex + 1]];
                                  return next;
                                })
                              }
                            >
                              ↓
                            </Button>
                            <Button
                              size="small"
                              danger
                              onClick={() => {
                                setCustomLayoutGroups((prev) => prev.filter((g) => g.id !== group.id));
                                setCustomLayoutActiveGroupId((prev) => (prev === group.id ? undefined : prev));
                              }}
                            >
                              {t('common.delete')}
                            </Button>
                          </Space>
                        }
                      >
                        <Select
                          mode="multiple"
                          style={{ width: '100%' }}
                          value={group.menuUuids}
                          onChange={(value) =>
                            setCustomLayoutGroups((prev) =>
                              prev.map((g) =>
                                g.id === group.id ? { ...g, menuUuids: value as string[] } : g,
                              ),
                            )
                          }
                          options={customLayoutMenuLibrary.map((item) => ({ value: item.key, label: item.title }))}
                          placeholder={t('pages.system.menus.customLayoutGroupMenus')}
                        />
                        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={6}>
                          {group.menuUuids.map((menuUuid, menuIndex) => {
                            const source = customLayoutMenuLookup.get(menuUuid);
                            if (!source) return null;
                            const override = customLayoutMenuOverrides[menuUuid] || {};
                            return (
                              <Space key={`${group.id}-${menuUuid}`} style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                                <Space align="center">
                                  <Button
                                    size="small"
                                    disabled={menuIndex === 0}
                                    onClick={() =>
                                      setCustomLayoutGroups((prev) =>
                                        prev.map((g) => {
                                          if (g.id !== group.id) return g;
                                          const nextMenus = [...g.menuUuids];
                                          [nextMenus[menuIndex - 1], nextMenus[menuIndex]] = [nextMenus[menuIndex], nextMenus[menuIndex - 1]];
                                          return { ...g, menuUuids: nextMenus };
                                        }),
                                      )
                                    }
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    size="small"
                                    disabled={menuIndex === group.menuUuids.length - 1}
                                    onClick={() =>
                                      setCustomLayoutGroups((prev) =>
                                        prev.map((g) => {
                                          if (g.id !== group.id) return g;
                                          const nextMenus = [...g.menuUuids];
                                          [nextMenus[menuIndex + 1], nextMenus[menuIndex]] = [nextMenus[menuIndex], nextMenus[menuIndex + 1]];
                                          return { ...g, menuUuids: nextMenus };
                                        }),
                                      )
                                    }
                                  >
                                    ↓
                                  </Button>
                                  <Typography.Text style={{ width: 220 }} ellipsis>
                                    {translateAppMenuItemName(source.name, source.path, t, source.children)}
                                  </Typography.Text>
                                </Space>
                                <Space>
                                  <Input
                                    value={override.title}
                                    onChange={(e) =>
                                      setCustomLayoutMenuOverrides((prev) => ({
                                        ...prev,
                                        [menuUuid]: { ...prev[menuUuid], title: e.target.value || undefined },
                                      }))
                                    }
                                    placeholder={t('pages.system.menus.customLayoutMenuTitleOverride')}
                                    style={{ width: 200 }}
                                  />
                                  <MenuIconPicker
                                    value={override.icon}
                                    onChange={(icon) =>
                                      setCustomLayoutMenuOverrides((prev) => ({
                                        ...prev,
                                        [menuUuid]: { ...prev[menuUuid], icon: icon || undefined },
                                      }))
                                    }
                                  />
                                  <Button
                                    size="small"
                                    danger
                                    onClick={() =>
                                      setCustomLayoutGroups((prev) =>
                                        prev.map((g) =>
                                          g.id === group.id
                                            ? { ...g, menuUuids: g.menuUuids.filter((id) => id !== menuUuid) }
                                            : g,
                                        ),
                                      )
                                    }
                                  >
                                    {t('common.remove')}
                                  </Button>
                                </Space>
                              </Space>
                            );
                          })}
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </Col>
            </Row>
          </Space>
        </Modal>
    </ListPageTemplate>
  );
};

export default MenuListPage;
