/**
 * 菜单管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的菜单。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 * 布局与部门管理对齐。
 */

import React, { useRef, useState } from 'react';
import { ProFormText, ProFormTextArea, ProFormSwitch, ProColumns, ProFormTreeSelect, ProFormSelect } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, PlusOutlined, AppstoreOutlined, LinkOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
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
  const actionRef = useRef<any>();
  
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
      messageApi.error(error.message || '加载菜单数据失败');
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
         return { can: false, reason: '包含子菜单，请先删除子菜单' };
     }
     return { can: true };
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: Menu) => {
    try {
      await deleteMenu(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
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
            // 通过查 allMenus 里是否有 parent_uuid === key 来判断
            const hasChildren = allMenus.some(m => m.parent_uuid === menu.uuid);
            if (hasChildren) {
                cannotDeleteNames.push(menu.name);
            } else {
                canDeleteKeys.push(menu.uuid);
            }
        }
    });

    if (cannotDeleteNames.length > 0) {
        messageApi.warning(`以下菜单包含子菜单，无法批量删除: ${cannotDeleteNames.join(', ')}`);
        return;
    }

    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${canDeleteKeys.length} 个菜单吗？`,
      onOk: async () => {
         try {
             await Promise.all(canDeleteKeys.map(key => deleteMenu(key)));
             messageApi.success('批量删除成功');
             setSelectedRowKeys([]);
             actionRef.current?.reload();
         } catch (e: any) {
             messageApi.error(e.message || '批量删除失败');
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
        messageApi.error(error.message || '获取详情失败');
    }
  };
  
    const handleView = async (record: Menu) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMenuDetail(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取菜单详情失败');
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
            messageApi.success('更新成功');
        } else {
            await createMenu(values);
            messageApi.success('创建成功');
        }
        setModalVisible(false);
        actionRef.current?.reload();
    } catch (error: any) {
        messageApi.error(error.message || '操作失败');
    } finally {
        setFormLoading(false);
    }
  };

  const columns: ProColumns<Menu>[] = [
    {
        title: '菜单名称',
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
        title: '路径',
        dataIndex: 'path',
        copyable: true,
        ellipsis: true,
    },
    {
        title: '图标',
        dataIndex: 'icon',
        width: 100,
        hideInSearch: true,
        render: (_, record) => record.icon ? <Tag>{record.icon}</Tag> : '-'
    },
    {
        title: '组件',
        dataIndex: 'component',
        ellipsis: true,
        hideInSearch: true,
    },
    {
        title: '排序',
        dataIndex: 'sort_order',
        width: 80,
        valueType: 'digit',
        hideInSearch: true,
        sorter: (a, b) => a.sort_order - b.sort_order,
    },
    {
        title: '状态',
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
        )
    },
        {
      title: '外部链接',
      dataIndex: 'is_external',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        record.is_external ? <Tag color="orange">是</Tag> : <span style={{color: '#ccc'}}>-</span>
      ),
    },
    {
        title: '操作',
        valueType: 'option',
        width: 220,
        fixed: 'right',
        render: (_, record) => (
            <Space size="small">
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleCreate(record.uuid)}>添加子项</Button>
                 <Popconfirm
                    title="确定删除?"
                    onConfirm={() => handleDelete(record)}
                    disabled={!checkCanDelete(record).can}
                 >
                     <Tooltip title={checkCanDelete(record).reason}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!checkCanDelete(record).can}>删除</Button>
                     </Tooltip>
                 </Popconfirm>
            </Space>
        )
    }
  ];

  if (!currentUser) return null;

  return (
    <ListPageTemplate
        statCards={[
            {
                title: '菜单总数',
                value: stats.totalCount,
                prefix: <AppstoreOutlined />,
                valueStyle: { color: '#1890ff' },
            },
            {
                title: '启用菜单',
                value: stats.activeCount,
                prefix: <CheckCircleOutlined />,
                valueStyle: { color: '#52c41a' },
            },
            {
                title: '外部链接',
                value: stats.externalCount,
                prefix: <LinkOutlined />,
                valueStyle: { color: '#faad14' },
            },
        ]}
    >
        <UniTable<Menu>
            actionRef={actionRef}
            headerTitle="菜单列表"
            rowKey="uuid"
            columns={columns}
            request={loadData}
            showCreateButton={false}
            toolBarRender={() => [
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>新建菜单</Button>,
                <Button key="batchDelete" danger icon={<DeleteOutlined />} onClick={handleBatchDelete} disabled={selectedRowKeys.length === 0}>批量删除</Button>,
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
                    {expandedRowKeys.length > 0 ? '一键收起' : '一键展开'}
                </Button>,
            ]}
            pagination={{ defaultPageSize: 50, showSizeChanger: true }}
             expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
            }}
            rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
            }}
            search={{ labelWidth: 'auto' }}
            showAdvancedSearch={true}
        />

        <FormModalTemplate
            title={isEdit ? '编辑菜单' : '新建菜单'}
            open={modalVisible}
            onClose={() => setModalVisible(false)}
            onFinish={handleSubmit}
            isEdit={isEdit}
            initialValues={formInitialValues}
            loading={formLoading}
            width={MODAL_CONFIG.STANDARD_WIDTH}
        >
             <ProFormText name="name" label="菜单名称" rules={[{ required: true }]} placeholder="请输入菜单名称" colProps={{ span: 12 }} />
             <ProFormText name="path" label="菜单路径" placeholder="/system/example" colProps={{ span: 12 }} />
             <ProFormText name="icon" label="图标" placeholder="Antd Icon Name" colProps={{ span: 12 }} />
             <ProFormText name="component" label="组件路径" placeholder="src/pages/..." colProps={{ span: 12 }} />
             <ProFormTreeSelect
                name="parent_uuid"
                label="父菜单"
                placeholder="请选择父菜单"
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
                label="关联应用"
                options={applications}
                placeholder="请选择应用"
                fieldProps={{ variant: 'outlined' }}
                colProps={{ span: 12 }}
             />
             <ProFormText name="permission_code" label="权限代码" colProps={{ span: 12 }} />
             <ProFormText name="sort_order" label="排序" fieldProps={{ type: 'number' }} colProps={{ span: 12 }} />
             <ProFormSwitch name="is_active" label="启用" colProps={{ span: 6 }} />
             <ProFormSwitch name="is_external" label="外部链接" colProps={{ span: 6 }} />
             <ProFormText name="external_url" label="外部链接URL" colProps={{ span: 24 }} />
             <ProFormTextArea name="meta" label="元数据(JSON)" fieldProps={{ rows: 3 }} colProps={{ span: 24 }} />
        </FormModalTemplate>

        <DetailDrawerTemplate
            title="菜单详情"
            open={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            dataSource={detailData || {}}
            loading={detailLoading}
            width={DRAWER_CONFIG.STANDARD_WIDTH}
            columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  render: (_: any, row: any) =>
                    translateAppMenuItemName(row?.name, row?.path, t, row?.children),
                },
                { title: '路径', dataIndex: 'path' },
                { title: '图标', dataIndex: 'icon' },
                { title: '组件', dataIndex: 'component' },
                { title: '权限代码', dataIndex: 'permission_code' },
                { title: '排序', dataIndex: 'sort_order' },
                { title: '状态', dataIndex: 'is_active', render: (_: any, entity: any) => (entity?.is_active ? '启用' : '禁用') },
                { title: '外部链接', dataIndex: 'is_external', render: (_: any, entity: any) => (entity?.is_external ? '是' : '否') },
                { title: '外部URL', dataIndex: 'external_url' },
                { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
                { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
                { title: '元数据', dataIndex: 'meta', render: (_: any, entity: any) => <pre>{JSON.stringify(entity?.meta, null, 2)}</pre> }
            ]}
        />
    </ListPageTemplate>
  );
};

export default MenuListPage;
