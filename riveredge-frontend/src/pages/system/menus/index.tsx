/**
 * 菜单管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的菜单。
 * 支持树形结构展示、创建、编辑、删除等功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Drawer, Modal, Tree, Empty, Dropdown, Card } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, MoreOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import {
  getMenuTree,
  getMenuDetail,
  createMenu,
  updateMenu,
  deleteMenu,
  Menu,
  MenuTree,
  CreateMenuData,
  UpdateMenuData,
} from '../../../services/menu';
import { getApplicationList } from '../../../services/application';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

/**
 * 菜单管理列表页面组件
 */
const MenuListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const formRef = useRef<ProFormInstance>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<Menu | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMenuUuid, setCurrentMenuUuid] = useState<string | null>(null);
  const [parentMenuUuid, setParentMenuUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Menu | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 应用列表（用于下拉选择）
  const [applications, setApplications] = useState<Array<{ label: string; value: string }>>([]);

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
      // 静默失败，不影响菜单管理
      console.warn('加载应用列表失败:', error);
    }
  };

  /**
   * 加载菜单树
   */
  const loadMenuTree = async () => {
    if (!currentUser) {
      return;
    }
    
    try {
      const response = await getMenuTree();
      
      // 转换为 Ant Design Tree 原生数据格式
      const convertToTreeData = (items: MenuTree[]): DataNode[] => {
        return items.map(item => {
          // 构建节点标题
          const titleContent = (
            <div className="menu-tree-title-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="menu-tree-title-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span className="menu-tree-text" style={{ fontWeight: 500 }}>{item.name}</span>
                <div className="menu-tree-tags" style={{ display: 'flex', gap: '4px' }}>
                  <Tag color={item.is_active ? 'success' : 'default'}>
                    {item.is_active ? '启用' : '禁用'}
                  </Tag>
                  {item.is_external && (
                    <Tag color="orange">外部链接</Tag>
                  )}
                  {item.path && (
                    <Tag color="blue">{item.path}</Tag>
                  )}
                  {item.children && item.children.length > 0 && (
                    <Tag color="purple">{item.children.length} 子菜单</Tag>
                  )}
                </div>
              </div>
              <div className="menu-tree-actions">
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'view',
                        label: '查看详情',
                        icon: <EyeOutlined />,
                        onClick: () => handleView(item),
                      },
                      {
                        key: 'edit',
                        label: '编辑',
                        icon: <EditOutlined />,
                        onClick: () => handleEdit(item),
                      },
                      {
                        key: 'add-child',
                        label: '添加子菜单',
                        icon: <PlusOutlined />,
                        onClick: () => handleCreate(item.uuid),
                      },
                      {
                        type: 'divider',
                      },
                      {
                        key: 'delete',
                        label: '删除',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleDelete(item),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ opacity: 0.6 }}
                  />
                </Dropdown>
              </div>
            </div>
          );

          return {
            title: titleContent,
            key: item.uuid,
            isLeaf: !item.children || item.children.length === 0,
            children: item.children && item.children.length > 0 ? convertToTreeData(item.children) : undefined,
            data: item,
          };
        });
      };
      
      const convertedData = convertToTreeData(response);
      setTreeData(convertedData);
      // 初始化时展开所有节点
      const getAllKeys = (nodes: DataNode[]): React.Key[] => {
        let keys: React.Key[] = [];
        nodes.forEach(node => {
          if (node.children && node.children.length > 0) {
            keys.push(node.key);
            keys = keys.concat(getAllKeys(node.children));
          }
        });
        return keys;
      };
      setExpandedKeys(getAllKeys(convertedData));
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        messageApi.error(error.message || '加载菜单树失败');
      }
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMenuTree();
      loadApplications();
    }
  }, [currentUser]);

  /**
   * 处理树节点选择
   */
  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) {
      setSelectedNode(null);
      return;
    }
    
    // 查找选中的节点数据
    const findNode = (nodes: DataNode[], key: React.Key): DataNode | null => {
      for (const node of nodes) {
        if (node.key === key) {
          return node;
        }
        if (node.children) {
          const found = findNode(node.children, key);
          if (found) return found;
        }
      }
      return null;
    };
    
    const node = findNode(treeData, selectedKeys[0]);
    if (node && node.data) {
      setSelectedNode(node.data as Menu);
    }
  };

  /**
   * 处理新建菜单
   */
  const handleCreate = (parentUuid?: string) => {
    setIsEdit(false);
    setCurrentMenuUuid(null);
    setParentMenuUuid(parentUuid || null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      parent_uuid: parentUuid,
      is_active: true,
      is_external: false,
      sort_order: 0,
    });
  };

  /**
   * 处理编辑菜单
   */
  const handleEdit = async (record: Menu) => {
    try {
      setIsEdit(true);
      setCurrentMenuUuid(record.uuid);
      setParentMenuUuid(record.parent_uuid || null);
      setModalVisible(true);
      
      const detail = await getMenuDetail(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        path: detail.path,
        icon: detail.icon,
        component: detail.component,
        permission_code: detail.permission_code,
        application_uuid: detail.application_uuid,
        parent_uuid: detail.parent_uuid,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
        is_external: detail.is_external,
        external_url: detail.external_url,
        meta: detail.meta ? JSON.stringify(detail.meta, null, 2) : '',
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取菜单详情失败');
    }
  };

  /**
   * 处理查看详情
   */
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

  /**
   * 处理删除菜单
   */
  const handleDelete = async (record: Menu) => {
    try {
      await deleteMenu(record.uuid);
      messageApi.success('删除成功');
      loadMenuTree();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/编辑）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 处理 meta 字段（如果是字符串，转换为 JSON）
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
      formRef.current?.resetFields();
      loadMenuTree();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 展开/收起所有节点
   */
  const handleExpandAll = () => {
    const getAllKeys = (nodes: DataNode[]): React.Key[] => {
      let keys: React.Key[] = [];
      nodes.forEach(node => {
        keys.push(node.key);
        if (node.children && node.children.length > 0) {
          keys = keys.concat(getAllKeys(node.children));
        }
      });
      return keys;
    };
    
    if (expandedKeys.length === 0) {
      setExpandedKeys(getAllKeys(treeData));
    } else {
      setExpandedKeys([]);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div style={{ padding: '16px' }}>
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleCreate()}
            >
              创建菜单
            </Button>
          </div>
          <div>
            <Button
              icon={expandedKeys.length === 0 ? <ExpandOutlined /> : <CompressOutlined />}
              onClick={handleExpandAll}
            >
              {expandedKeys.length === 0 ? '展开全部' : '收起全部'}
            </Button>
          </div>
        </div>

        {treeData.length === 0 ? (
          <Empty description="暂无菜单数据" />
        ) : (
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            selectedKeys={selectedNode ? [selectedNode.uuid] : []}
            onExpand={(keys) => setExpandedKeys(keys as React.Key[])}
            onSelect={handleSelect}
            autoExpandParent={autoExpandParent}
            blockNode
          />
        )}
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑菜单' : '创建菜单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          formRef.current?.resetFields();
        }}
        footer={null}
        width={600}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
          loading={formLoading}
        >
          <ProFormText
            name="name"
            label="菜单名称"
            rules={[{ required: true, message: '请输入菜单名称' }]}
            placeholder="请输入菜单名称"
          />
          <ProFormText
            name="path"
            label="菜单路径"
            placeholder="请输入菜单路径（如：/system/users）"
          />
          <ProFormText
            name="icon"
            label="菜单图标"
            placeholder="请输入 Ant Design 图标名称（如：UserOutlined）"
          />
          <ProFormText
            name="component"
            label="前端组件路径"
            placeholder="请输入前端组件路径（可选）"
          />
          <ProFormSelect
            name="application_uuid"
            label="关联应用"
            options={applications}
            placeholder="请选择关联应用（可选）"
          />
          <ProFormText
            name="permission_code"
            label="权限代码"
            placeholder="请输入权限代码（可选）"
          />
          <ProFormText
            name="parent_uuid"
            label="父菜单UUID"
            placeholder="请输入父菜单UUID（可选，留空表示根菜单）"
            disabled={true}
            extra="父菜单由操作按钮设置，此处仅显示"
          />
          <ProFormText
            name="sort_order"
            label="排序顺序"
            fieldProps={{ type: 'number', min: 0 }}
            initialValue={0}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
            initialValue={true}
          />
          <ProFormSwitch
            name="is_external"
            label="是否外部链接"
            initialValue={false}
          />
          <ProFormText
            name="external_url"
            label="外部链接URL"
            placeholder="请输入外部链接URL（如果 is_external 为 true）"
          />
          <ProFormTextArea
            name="meta"
            label="菜单元数据（JSON）"
            placeholder='请输入 JSON 格式的元数据（可选，如：{"key": "value"})'
            fieldProps={{ rows: 4 }}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="菜单详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
        }}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailData ? (
          <div>
            <p><strong>菜单名称：</strong>{detailData.name}</p>
            <p><strong>菜单路径：</strong>{detailData.path || '-'}</p>
            <p><strong>菜单图标：</strong>{detailData.icon || '-'}</p>
            <p><strong>前端组件：</strong>{detailData.component || '-'}</p>
            <p><strong>权限代码：</strong>{detailData.permission_code || '-'}</p>
            <p><strong>关联应用：</strong>{detailData.application_uuid || '-'}</p>
            <p><strong>父菜单：</strong>{detailData.parent_uuid || '根菜单'}</p>
            <p><strong>排序顺序：</strong>{detailData.sort_order}</p>
            <p><strong>是否启用：</strong>
              <Tag color={detailData.is_active ? 'success' : 'default'}>
                {detailData.is_active ? '启用' : '禁用'}
              </Tag>
            </p>
            <p><strong>是否外部链接：</strong>
              <Tag color={detailData.is_external ? 'orange' : 'default'}>
                {detailData.is_external ? '是' : '否'}
              </Tag>
            </p>
            {detailData.external_url && (
              <p><strong>外部链接URL：</strong>{detailData.external_url}</p>
            )}
            {detailData.meta && (
              <div>
                <strong>菜单元数据：</strong>
                <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(detailData.meta, null, 2)}
                </pre>
              </div>
            )}
            <p><strong>创建时间：</strong>{dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
            <p><strong>更新时间：</strong>{dayjs(detailData.updated_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default MenuListPage;

