/**
 * 菜单管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的菜单。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 * 布局与部门管理对齐。
 */

import React, { useRef, useState } from 'react';
import { ProFormText, ProFormTextArea, ProFormSwitch, ProColumns, ProFormTreeSelect, ProFormSelect } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, PlusOutlined, AppstoreOutlined, LinkOutlined, CheckCircleOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import { App, Button, Tag, Space, Popconfirm, Tooltip } from 'antd';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import * as Icons from '@ant-design/icons';
import {
  getMenuTree,
  getMenuDetail,
  createMenu,
  updateMenu,
  deleteMenu,
  Menu,
  MenuTree,
} from '../../../services/menu';
import { getApplicationList } from '../../../services/application';
import { useGlobalStore } from '../../../stores';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { translateAppMenuItemName } from '../../../utils/menuTranslation';

// 动态图标组件
const IconItem = ({ icon }: { icon?: string }) => {
  if (!icon) return null;
  const Icon = (Icons as any)[icon];
  return Icon ? <Icon /> : null;
};

const MenuListPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const actionRef = useRef<any>();

  /** 菜单变更后刷新侧边栏/UniTabs/面包屑（统一数据源） */
  const refreshLayoutMenus = () => {
    useGlobalStore.getState().incrementApplicationMenuVersion();
    queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
  };
  
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
  // 应用列表
  const [applications, setApplications] = useState<Array<{ label: string; value: string }>>([]);

  // 展开/收起状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  // 选中行状态（用于批量删除）
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // 缓存扁平化数据
  const [allMenus, setAllMenus] = useState<Menu[]>([]);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Menu | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  /**
   * 加载应用列表
   */
  const loadApplications = async () => {
    try {
      const apps = await getApplicationList();
      setApplications(
        apps.map(app => ({
          label: app.name,
          value: app.uuid,
        }))
      );
    } catch (error: any) {
      console.warn('加载应用列表失败:', error);
    }
  };

  /**
   * 加载数据
   */
  const loadData = async (_params: any, _sort: any, _filter: any, searchFormValues?: any) => {
     if (!currentUser) return { data: [], success: false, total: 0 };

    try {
      // 获取应用列表（如果是首次）
      if (applications.length === 0) {
        loadApplications();
      }

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

      // 默认展开
      if (expandedRowKeys.length === 0 && !keyword) {
         setExpandedRowKeys(getAllKeys(finalData));
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
  };

  /**
   * 校验是否可删除
   */
  const checkCanDelete = (record: Menu): { can: boolean; reason?: string } => {
     // UniTable 的 record 是来自 loadData 返回的 tree items
     const item = record as any as MenuTree; 
     if (item.children && item.children.length > 0) {
         return { can: false, reason: t('pages.system.menus.deleteChildFirst') };
     }
     return { can: true };
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: Menu) => {
    try {
      await deleteMenu(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      refreshLayoutMenus();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    
    // 简单校验
    const canDeleteKeys: string[] = [];
    const cannotDeleteNames: string[] = [];
    
    selectedRowKeys.forEach(key => {
        const menu = allMenus.find(m => m.uuid === key);
        if (menu) {
            if (menu.application_uuid) {
                cannotDeleteNames.push(menu.name + '(' + t('pages.system.menus.appMenuSuffix') + ')');
            } else if (allMenus.some(m => m.parent_uuid === menu.uuid)) {
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

    modal.confirm({
      title: t('pages.system.menus.batchDeleteConfirm'),
      content: t('pages.system.menus.batchDeleteCountConfirm', { count: canDeleteKeys.length }),
      onOk: async () => {
         try {
             await Promise.all(canDeleteKeys.map(key => deleteMenu(key)));
             messageApi.success(t('pages.system.menus.batchDeleteSuccess'));
             setSelectedRowKeys([]);
             refreshLayoutMenus();
             actionRef.current?.reload();
         } catch (e: any) {
             messageApi.error(e.message || t('pages.system.menus.batchDeleteFailed'));
         }
      }
    });
  };

  const handleCreate = (parentUuid?: string) => {
    setIsEdit(false);
    setCurrentMenuUuid(null);
    setFormInitialValues({
      parent_uuid: parentUuid || null,
      is_active: true,
      is_external: false,
      sort_order: 0,
    });
    setModalVisible(true);
  };

  const handleEdit = async (record: Menu) => {
    try {
        setIsEdit(true);
        setCurrentMenuUuid(record.uuid);
        const detail = await getMenuDetail(record.uuid);
        
        setFormInitialValues({
            ...detail,
            meta: detail.meta ? JSON.stringify(detail.meta, null, 2) : '',
        });
        setModalVisible(true);
    } catch (error: any) {
        messageApi.error(error.message || t('pages.system.menus.getDetailFailed'));
    }
  };
  
    const handleView = async (record: Menu) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMenuDetail(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.menus.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
        setFormLoading(true);
         // 处理 meta
        if (values.meta && typeof values.meta === 'string') {
            try {
                values.meta = JSON.parse(values.meta);
            } catch {
                values.meta = {};
            }
        }
        
        if (isEdit && currentMenuUuid) {
            await updateMenu(currentMenuUuid, values);
            messageApi.success(t('pages.system.updateSuccess'));
        } else {
            await createMenu(values);
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
  };

  const columns: ProColumns<Menu>[] = [
    {
        title: t('pages.system.menus.menuName'),
        dataIndex: 'name',
        width: 250,
        fixed: 'left',
        render: (_, record) => {
             const treeItem = record as MenuTree;
             const displayName = translateAppMenuItemName(
               record.name,
               record.path,
               t,
               treeItem.children
             );
             return (
               <Space>
                 <IconItem icon={record.icon} />
                 <span style={{ fontWeight: 500 }}>{displayName}</span>
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
        render: (_, record) => record.icon ? <Tag>{record.icon}</Tag> : '-'
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
        sorter: (a, b) => a.sort_order - b.sort_order,
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
        render: (_, record) => (
            <Tag color={record.is_active ? 'success' : 'default'}>
                {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
            </Tag>
        )
    },
    {
        title: t('pages.system.menus.externalLink'),
      dataIndex: 'is_external',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        record.is_external ? <Tag color="orange">{t('pages.system.menus.externalYes')}</Tag> : <span style={{color: '#ccc'}}>-</span>
      ),
    },
    {
        title: t('pages.system.menus.source'),
        dataIndex: 'application_uuid',
        width: 100,
        hideInSearch: true,
        render: (_, record) =>
          record.application_uuid ? (
            <Tooltip title={t('menu.system.appMenuSyncTip', { defaultValue: '应用菜单由 manifest 同步，在应用中心同步菜单可更新' })}>
              <Tag color="blue" icon={<SyncOutlined />}>
                {t('menu.system.appMenu', { defaultValue: '应用' })}
              </Tag>
            </Tooltip>
          ) : (
            <Tag>{t('menu.system.systemMenu', { defaultValue: '系统' })}</Tag>
          ),
    },
    {
        title: t('common.actions'),
        valueType: 'option',
        width: 220,
        fixed: 'right',
        render: (_, record) => {
            const isAppMenu = !!record.application_uuid;
            const deleteCheck = checkCanDelete(record);
            const canDelete = !isAppMenu && deleteCheck.can;
            return (
            <Space size="small">
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>{t('pages.system.menus.view')}</Button>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>{t('pages.system.menus.edit')}</Button>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleCreate(record.uuid)}>{t('pages.system.menus.addChild')}</Button>
                <Popconfirm
                    title={t('pages.system.menus.deleteConfirm')}
                    onConfirm={() => handleDelete(record)}
                    disabled={!canDelete}
                >
                    <Tooltip title={isAppMenu ? t('menu.system.appMenuDeleteDisabled', { defaultValue: '应用菜单不可删除，请在应用中心同步更新' }) : deleteCheck.reason}>
                        <span>
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>{t('pages.system.menus.delete')}</Button>
                        </span>
                    </Tooltip>
                </Popconfirm>
            </Space>
            );
        }
    }
  ];

  if (!currentUser) return null;

  return (
    <ListPageTemplate
        statCards={[
            {
                title: t('pages.system.menus.totalCount'),
                value: stats.totalCount,
                prefix: <AppstoreOutlined />,
                valueStyle: { color: '#1890ff' },
            },
            {
                title: t('pages.system.menus.activeCount'),
                value: stats.activeCount,
                prefix: <CheckCircleOutlined />,
                valueStyle: { color: '#52c41a' },
            },
            {
                title: t('pages.system.menus.externalCount'),
                value: stats.externalCount,
                prefix: <LinkOutlined />,
                valueStyle: { color: '#faad14' },
            },
        ]}
    >
        <UniTable<Menu>
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
            enableRowSelection
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
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `menus-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.menus.exportedCount', { count: items.length }));
            }}
            toolBarRender={() => [
                 <Button
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
        >
             <ProFormText name="name" label={t('pages.system.menus.menuName')} rules={[{ required: true }]} placeholder={t('pages.system.menus.menuNamePlaceholder')} colProps={{ span: 12 }} />
             <ProFormText name="path" label={t('pages.system.menus.path')} placeholder={t('pages.system.menus.pathPlaceholder')} colProps={{ span: 12 }} />
             <ProFormText name="icon" label={t('pages.system.menus.icon')} placeholder={t('pages.system.menus.iconPlaceholder')} colProps={{ span: 12 }} />
             <ProFormText name="component" label={t('pages.system.menus.componentPath')} placeholder={t('pages.system.menus.componentPathPlaceholder')} colProps={{ span: 12 }} />
             <ProFormTreeSelect
                name="parent_uuid"
                label={t('pages.system.menus.parentMenu')}
                placeholder={t('pages.system.menus.parentMenuPlaceholder')}
                fieldProps={{
                    treeData: menuTreeData,
                    fieldNames: { label: 'name', value: 'uuid', children: 'children' },
                    showSearch: true,
                    allowClear: true,
                    treeDefaultExpandAll: false, // 禁用默认展开以优化性能
                    variant: 'outlined',
                }}
                colProps={{ span: 24 }}
             />
             <ProFormSelect
                name="application_uuid"
                label={t('pages.system.menus.relatedApp')}
                options={applications}
                placeholder={t('pages.system.menus.relatedAppPlaceholder')}
                fieldProps={{ variant: 'outlined' }}
                colProps={{ span: 12 }}
             />
             <ProFormText name="permission_code" label={t('pages.system.menus.permissionCode')} colProps={{ span: 12 }} />
             <ProFormText name="sort_order" label={t('pages.system.menus.sort')} fieldProps={{ type: 'number' }} colProps={{ span: 12 }} />
             <ProFormSwitch name="is_active" label={t('pages.system.menus.enabled')} colProps={{ span: 6 }} />
             <ProFormSwitch name="is_external" label={t('pages.system.menus.externalLink')} colProps={{ span: 6 }} />
             <ProFormText name="external_url" label={t('pages.system.menus.externalUrl')} colProps={{ span: 24 }} />
             <ProFormTextArea name="meta" label={t('pages.system.menus.metadataJson')} fieldProps={{ rows: 3 }} colProps={{ span: 24 }} />
        </FormModalTemplate>

        <DetailDrawerTemplate
            title={t('pages.system.menus.detailTitle')}
            open={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            dataSource={detailData || {}}
            loading={detailLoading}
            width={DRAWER_CONFIG.STANDARD_WIDTH}
            columns={[
                {
                  title: t('pages.system.menus.name'),
                  dataIndex: 'name',
                  render: (_: any, row: any) =>
                    translateAppMenuItemName(row?.name, row?.path, t, row?.children),
                },
                { title: t('pages.system.menus.path'), dataIndex: 'path' },
                { title: t('pages.system.menus.icon'), dataIndex: 'icon' },
                { title: t('pages.system.menus.component'), dataIndex: 'component' },
                { title: t('pages.system.menus.permissionCode'), dataIndex: 'permission_code' },
                { title: t('pages.system.menus.sort'), dataIndex: 'sort_order' },
                { title: t('pages.system.menus.status'), dataIndex: 'is_active', render: (_: any, entity: any) => (entity?.is_active ? t('pages.system.menus.enabled') : t('pages.system.menus.disabled')) },
                { title: t('pages.system.menus.externalLink'), dataIndex: 'is_external', render: (_: any, entity: any) => (entity?.is_external ? t('pages.system.menus.externalYes') : t('pages.system.menus.externalNo')) },
                { title: t('pages.system.menus.externalUrl'), dataIndex: 'external_url' },
                { title: t('pages.system.menus.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
                { title: t('pages.system.menus.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
                { title: t('pages.system.menus.metadata'), dataIndex: 'meta', render: (_: any, entity: any) => <pre>{JSON.stringify(entity?.meta, null, 2)}</pre> }
            ]}
        />
    </ListPageTemplate>
  );
};

export default MenuListPage;
