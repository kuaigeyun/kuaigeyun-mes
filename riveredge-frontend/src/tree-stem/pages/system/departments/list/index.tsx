/**
 * 部门管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的部门。
 * 支持树形结构展示、创建、编辑、删除等功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Drawer, Modal, Tree, message, Empty, Dropdown } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, MoreOutlined, ApartmentOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import type { MenuProps } from 'antd';
import {
  getDepartmentTree,
  getDepartmentByUuid,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  Department,
  DepartmentTreeItem,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../../../../services/department';
import { getUserList } from '../../../../services/user';

/**
 * 部门管理列表页面组件
 */
const DepartmentListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Department | null>(null);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDepartmentUuid, setCurrentDepartmentUuid] = useState<string | null>(null);
  const [parentDepartmentUuid, setParentDepartmentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Department | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 加载部门树
   */
  const loadDepartmentTree = async () => {
    try {
      setLoading(true);
      const response = await getDepartmentTree();
      
      // 转换为 Ant Design Tree 原生数据格式
      const convertToTreeData = (items: DepartmentTreeItem[]): DataNode[] => {
        return items.map(item => {
          // 构建节点标题（使用原生 title 属性）
          const titleContent = (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Space>
                <span style={{ fontWeight: 500 }}>{item.name}</span>
                <Tag color={item.is_active ? 'success' : 'default'} size="small">
                  {item.is_active ? '启用' : '禁用'}
                </Tag>
                {item.children_count > 0 && (
                  <Tag color="blue" size="small">
                    {item.children_count} 子部门
                  </Tag>
                )}
                {item.user_count > 0 && (
                  <Tag color="green" size="small">
                    {item.user_count} 人
                  </Tag>
                )}
              </Space>
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
                      label: '添加子部门',
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
          );

          return {
            title: titleContent,
            key: item.uuid,
            icon: <ApartmentOutlined style={{ color: '#1890ff' }} />,
            isLeaf: !item.children || item.children.length === 0,
            children: item.children && item.children.length > 0 ? convertToTreeData(item.children) : undefined,
            // 将原始数据存储在 data 属性中，方便后续使用
            data: item,
          };
        });
      };
      
      setTreeData(convertToTreeData(response.items));
    } catch (error: any) {
      messageApi.error(error.message || '加载部门树失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentTree();
  }, []);

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
      setSelectedNode(node.data as Department);
    }
  };

  /**
   * 处理新建部门
   */
  const handleCreate = (parentUuid?: string) => {
    setIsEdit(false);
    setCurrentDepartmentUuid(null);
    setParentDepartmentUuid(parentUuid || null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      parent_uuid: parentUuid,
      is_active: true,
    });
  };

  /**
   * 处理编辑部门
   */
  const handleEdit = async (record: Department) => {
    try {
      setIsEdit(true);
      setCurrentDepartmentUuid(record.uuid);
      setParentDepartmentUuid(record.parent_uuid || null);
      setModalVisible(true);
      
      const detail = await getDepartmentByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        parent_uuid: detail.parent_uuid,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取部门详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Department) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDepartmentByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取部门详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除部门
   */
  const handleDelete = async (record: Department) => {
    try {
      await deleteDepartment(record.uuid);
      messageApi.success('删除成功');
      loadDepartmentTree();
      setSelectedNode(null);
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      if (isEdit && currentDepartmentUuid) {
        await updateDepartment(currentDepartmentUuid, values as UpdateDepartmentData);
        messageApi.success('更新成功');
      } else {
        await createDepartment(values as CreateDepartmentData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      loadDepartmentTree();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 构建部门选项（用于父部门选择）
   */
  const buildDepartmentOptions = (items: DepartmentTreeItem[], excludeUuid?: string, level = 0): Array<{ label: string; value: string }> => {
    const options: Array<{ label: string; value: string }> = [];
    items.forEach(item => {
      if (item.uuid !== excludeUuid) {
        const prefix = '  '.repeat(level);
        options.push({
          label: `${prefix}${item.name}`,
          value: item.uuid,
        });
        if (item.children && item.children.length > 0) {
          options.push(...buildDepartmentOptions(item.children, excludeUuid, level + 1));
        }
      }
    });
    return options;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
      {/* 左侧：树形列表 */}
      <div style={{ width: '400px', borderRight: '1px solid #f0f0f0', padding: '16px', overflow: 'auto' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>部门树</h3>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>
            新建根部门
          </Button>
        </div>
        <Tree
          treeData={treeData}
          onSelect={handleSelect}
          defaultExpandAll
          loading={loading}
          showIcon
          blockNode
          selectedKeys={selectedNode ? [selectedNode.uuid] : []}
        />
      </div>
      
      {/* 右侧：详情面板 */}
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        {selectedNode ? (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{selectedNode.name}</h3>
              <Space>
                <Button icon={<EyeOutlined />} onClick={() => handleView(selectedNode)}>
                  查看详情
                </Button>
                <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedNode)}>
                  编辑
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(selectedNode)}
                >
                  删除
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleCreate(selectedNode.uuid)}
                >
                  添加子部门
                </Button>
              </Space>
            </div>
            <ProDescriptions
              column={2}
              dataSource={selectedNode}
              columns={[
                { title: '部门名称', dataIndex: 'name' },
                { title: '部门代码', dataIndex: 'code' },
                { title: '描述', dataIndex: 'description', span: 2 },
                {
                  title: '状态',
                  dataIndex: 'is_active',
                  render: (value) => (
                    <Tag color={value ? 'success' : 'default'}>
                      {value ? '启用' : '禁用'}
                    </Tag>
                  ),
                },
                { title: '排序', dataIndex: 'sort_order' },
                { title: '子部门数', dataIndex: 'children_count' },
                { title: '用户数', dataIndex: 'user_count' },
              ]}
            />
          </div>
        ) : (
          <Empty description="请选择部门" />
        )}
      </div>

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑部门' : '新建部门'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={formLoading}
        width={800}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
            placeholder="请输入部门名称"
          />
          <ProFormText
            name="code"
            label="部门代码"
            placeholder="请输入部门代码（可选）"
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入部门描述"
          />
          <ProFormSelect
            name="parent_uuid"
            label="父部门"
            placeholder="请选择父部门（不选则为根部门）"
            options={buildDepartmentOptions(
              treeData.map(node => node.data as DepartmentTreeItem),
              currentDepartmentUuid || undefined
            )}
            allowClear
          />
          <ProFormText
            name="sort_order"
            label="排序"
            initialValue={0}
            fieldProps={{ type: 'number' }}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
            initialValue={true}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="部门详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions
            column={2}
            dataSource={detailData}
            columns={[
              { title: '部门名称', dataIndex: 'name' },
              { title: '部门代码', dataIndex: 'code' },
              { title: '描述', dataIndex: 'description', span: 2 },
              {
                title: '状态',
                dataIndex: 'is_active',
                render: (value) => (value ? '启用' : '禁用'),
              },
              { title: '排序', dataIndex: 'sort_order' },
              { title: '子部门数', dataIndex: 'children_count' },
              { title: '用户数', dataIndex: 'user_count' },
              { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default DepartmentListPage;

