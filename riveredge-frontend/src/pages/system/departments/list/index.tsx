/**
 * 部门管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的部门。
 * 支持树形结构展示、创建、编辑、删除等功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance, ProDescriptions, PageContainer } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Drawer, Modal, Tree, Empty, Dropdown, Card, Table, Statistic, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, MoreOutlined, ExpandOutlined, CompressOutlined, UserOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import {
  getDepartmentTree,
  getDepartmentByUuid,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  updateDepartmentOrder,
  Department,
  DepartmentTreeItem,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../../../../services/department';
import { getUserList, User } from '../../../../services/user';

/**
 * 部门管理列表页面组件
 */
const DepartmentListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<Department | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  
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
  
  // 部门成员相关状态
  const [departmentMembers, setDepartmentMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  /**
   * 加载部门树
   */
  const loadDepartmentTree = async () => {
    try {
      const response = await getDepartmentTree();
      
      // 转换为 Ant Design Tree 原生数据格式
      const convertToTreeData = (items: DepartmentTreeItem[]): DataNode[] => {
        return items.map(item => {
          // 构建节点标题（将图标和文字放在同一行，优化间距）
          const titleContent = (
            <div className="department-tree-title-content">
              <div className="department-tree-title-left">
                {/* 文字（已移除图标） */}
                <span className="department-tree-text">{item.name}</span>
                <div className="department-tree-tags">
                <Tag color={item.is_active ? 'success' : 'default'}>
                  {item.is_active ? '启用' : '禁用'}
                </Tag>
                {(item.children_count && item.children_count > 0) ? (
                  <Tag color="blue">
                    {item.children_count} 子部门
                  </Tag>
                ) : null}
                {(item.user_count && item.user_count > 0) ? (
                  <Tag color="green">
                    {item.user_count} 人
                  </Tag>
                ) : null}
                </div>
              </div>
              <div className="department-tree-actions">
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
            </div>
          );

          return {
            title: titleContent,
            key: item.uuid,
            // 不再使用 icon 属性，图标已包含在 title 中
            isLeaf: !item.children || item.children.length === 0,
            children: item.children && item.children.length > 0 ? convertToTreeData(item.children) : undefined,
            // 将原始数据存储在 data 属性中，方便后续使用
            data: item,
          };
        });
      };
      
      const convertedData = convertToTreeData(response.items);
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
      messageApi.error(error.message || '加载部门树失败');
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
      
      // 加载部门成员
      await loadDepartmentMembers(record.uuid);
    } catch (error: any) {
      messageApi.error(error.message || '获取部门详情失败');
    } finally {
      setDetailLoading(false);
    }
  };
  
  /**
   * 加载部门成员
   */
  const loadDepartmentMembers = async (departmentUuid: string) => {
    try {
      setMembersLoading(true);
      const users = await getUserList({
        department_uuid: departmentUuid,
        page: 1,
        page_size: 1000,
      });
      setDepartmentMembers(users.items || []);
    } catch (error: any) {
      console.error('加载部门成员失败:', error);
      setDepartmentMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };
  
  /**
   * 处理拖拽排序
   */
  const handleDrop: TreeProps['onDrop'] = async (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
    
    // 如果拖拽到同一位置，不处理
    if (dragKey === dropKey && dropPosition === 0) {
      return;
    }
    
    // 查找拖拽节点和目标节点的数据
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
    
    const dragNode = findNode(treeData, dragKey);
    const dropNode = findNode(treeData, dropKey);
    
    if (!dragNode || !dropNode) {
      return;
    }
    
    // 获取同级节点（同一父节点下的所有节点）
    const getSiblingNodes = (nodes: DataNode[], parentKey?: React.Key): DataNode[] => {
      if (!parentKey) {
        return nodes;
      }
      for (const node of nodes) {
        if (node.key === parentKey) {
          return node.children || [];
        }
        if (node.children) {
          const siblings = getSiblingNodes(node.children, parentKey);
          if (siblings.length > 0) {
            return siblings;
          }
        }
      }
      return [];
    };
    
    // 获取父节点
    const getParentKey = (nodes: DataNode[], key: React.Key, parentKey?: React.Key): React.Key | null => {
      for (const node of nodes) {
        if (node.key === key) {
          return parentKey || null;
        }
        if (node.children) {
          const found = getParentKey(node.children, key, node.key);
          if (found !== null) {
            return found;
          }
        }
      }
      return null;
    };
    
    const parentKey = getParentKey(treeData, dropKey);
    const siblings = getSiblingNodes(treeData, parentKey);
    
    // 计算新的排序顺序
    const newSiblings = [...siblings];
    const dragIndex = newSiblings.findIndex((node) => node.key === dragKey);
    const dropIndex = newSiblings.findIndex((node) => node.key === dropKey);
    
    // 移除拖拽节点
    const [removed] = newSiblings.splice(dragIndex, 1);
    
    // 插入到新位置
    if (dropPosition === -1) {
      // 插入到目标节点之前
      newSiblings.splice(dropIndex, 0, removed);
    } else {
      // 插入到目标节点之后
      newSiblings.splice(dropIndex + 1, 0, removed);
    }
    
    // 更新排序顺序
    const departmentOrders = newSiblings.map((node, index) => ({
      uuid: node.key as string,
      sort_order: index,
    }));
    
    try {
      await updateDepartmentOrder(departmentOrders);
      messageApi.success('排序更新成功');
      loadDepartmentTree();
    } catch (error: any) {
      messageApi.error(error.message || '排序更新失败');
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
   * 获取所有节点的 key（用于展开/收起）
   */
  const getAllNodeKeys = (nodes: DataNode[]): React.Key[] => {
    let keys: React.Key[] = [];
    nodes.forEach(node => {
      keys.push(node.key);
      if (node.children && node.children.length > 0) {
        keys = keys.concat(getAllNodeKeys(node.children));
      }
    });
    return keys;
  };

  /**
   * 处理展开/收起
   */
  const handleExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  /**
   * 一键展开所有
   */
  const handleExpandAll = () => {
    const allKeys = getAllNodeKeys(treeData);
    setExpandedKeys(allKeys);
    setAutoExpandParent(true);
  };

  /**
   * 一键收起所有
   */
  const handleCollapseAll = () => {
    setExpandedKeys([]);
    setAutoExpandParent(false);
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
    <div className="department-page-container">
      <PageContainer>
      {/* 树形结构样式优化 - 遵循 Ant Design 8px 网格系统和最佳实践 */}
      <style>{`
        /* 隐藏 PageContainer 的 ant-page-header */
        .department-page-container .ant-pro-page-container .ant-page-header {
          display: none !important;
          padding: 0 !important;
          margin: 0 !important;
          height: 0 !important;
        }
        
        /* 保留顶部间距 - 通过 paddingTop 实现 */
        .department-page-container .ant-pro-page-container .ant-pro-page-container-children-content {
          padding: 16px !important;
          padding-top: 16px !important;
        }
        
        /* 树形结构容器样式 */
        .department-tree-container {
          width: 400px;
          border-right: 1px solid #f0f0f0;
          padding: 0;
          overflow: auto;
          background: #fff;
          border-radius: 8px;
        }
        
        /* 树形结构标题区域 */
        .department-tree-header {
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        /* 树节点样式优化 - 增加间距和内边距 */
        .department-tree .ant-tree-node-content-wrapper {
          padding: 8px 12px !important;
          margin: 4px 0 !important;
          border-radius: 4px;
          transition: all 0.2s;
          min-height: 40px;
          display: flex;
          align-items: center;
        }
        
        /* 树节点 hover 效果 */
        .department-tree .ant-tree-node-content-wrapper:hover {
          background-color: #f5f5f5;
        }
        
        /* 树节点选中状态 */
        .department-tree .ant-tree-node-selected .ant-tree-node-content-wrapper {
          background-color: #e6f7ff !important;
          border: 1px solid #91d5ff;
        }
        
        /* 树节点标题内容间距优化 */
        .department-tree .ant-tree-node-content-wrapper .ant-tree-title {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0;
        }
        
        /* 树节点标题内部元素间距 */
        .department-tree-title-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          gap: 8px;
        }
        
        /* 树节点标题左侧内容（图标+文字+标签） */
        .department-tree-title-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        
        /* 树节点图标样式 */
        .department-tree-icon {
          color: #1890ff;
          font-size: 16px;
          flex-shrink: 0;
        }
        
        /* 树节点文字样式 */
        .department-tree-text {
          font-weight: 500;
          font-size: 14px;
          line-height: 1.5;
          flex-shrink: 0;
        }
        
        /* 树节点标签间距 */
        .department-tree-tags {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        
        /* 树节点操作按钮 */
        .department-tree-actions {
          flex-shrink: 0;
          margin-left: 8px;
        }
        
        /* 树节点展开/收起图标间距 */
        .department-tree .ant-tree-switcher {
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* 树节点缩进优化 - 增加层级间距 */
        .department-tree .ant-tree-child-tree {
          margin-left: 8px;
        }
        
        /* 树节点连接线样式 */
        .department-tree .ant-tree-indent-unit {
          width: 24px;
        }
        
        /* 树节点整体行高优化 */
        .department-tree .ant-tree-treenode {
          padding: 2px 0;
          margin: 0;
        }
        
        /* 树节点列表整体间距 */
        .department-tree .ant-tree-list {
          padding: 0;
        }
        
        /* 树节点列表项间距 */
        .department-tree .ant-tree-list-holder-inner {
          padding: 0;
        }

        .ant-pro-page-container-children-container{
          padding: 16px !important;
        }
      `}</style>
      <div style={{ display: 'flex', height: 'calc(100vh - 144px)', gap: '24px' }}>
      {/* 左侧：树形列表 */}
        <div className="department-tree-container" style={{ padding: '16px' }}>
          <div className="department-tree-header">
            <Space>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>部门列表</h3>
              <Button
                type="text"
                size="small"
                icon={expandedKeys.length > 0 ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={expandedKeys.length > 0 ? handleCollapseAll : handleExpandAll}
                title={expandedKeys.length > 0 ? '收起全部' : '展开全部'}
              />
            </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>
            新建根部门
          </Button>
        </div>
        <Tree
          className="department-tree"
          treeData={treeData}
          onSelect={handleSelect}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onExpand={handleExpand}
          blockNode
          selectedKeys={selectedNode ? [selectedNode.uuid] : []}
          draggable
          onDrop={handleDrop}
        />
      </div>
      
      {/* 右侧：详情侧边栏 - 使用 Card 组件符合 Ant Design 最佳实践 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedNode ? (
          <Card
            title={selectedNode.name}
            extra={
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
            }
          >
            {/* 统计信息 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic
                  title="子部门数"
                  value={selectedNode.children_count || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="用户数"
                  value={selectedNode.user_count || 0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="状态"
                  value={selectedNode.is_active ? '启用' : '禁用'}
                  valueStyle={{ color: selectedNode.is_active ? '#52c41a' : '#999' }}
                />
              </Col>
            </Row>
            
            <ProDescriptions
              column={2}
              dataSource={selectedNode}
              columns={[
                { title: '部门名称', dataIndex: 'name' },
                { title: '部门代码', dataIndex: 'code' },
                { title: '描述', dataIndex: 'description', span: 2 },
                {
                  title: '排序',
                  dataIndex: 'sort_order',
                  render: (value: any) => value !== undefined && value !== null ? value : '-',
                },
              ]}
            />
          </Card>
        ) : (
          <Card>
          <Empty description="请选择部门" />
          </Card>
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
        onClose={() => {
          setDrawerVisible(false);
          setDepartmentMembers([]);
        }}
        width={800}
        loading={detailLoading}
      >
        {detailData && (
          <>
            {/* 统计信息 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic
                  title="子部门数"
                  value={detailData.children_count || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="用户数"
                  value={detailData.user_count || 0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="状态"
                  value={detailData.is_active ? '启用' : '禁用'}
                  valueStyle={{ color: detailData.is_active ? '#52c41a' : '#999' }}
                />
              </Col>
            </Row>
            
            <ProDescriptions
              column={2}
              dataSource={detailData}
              columns={[
                { title: '部门名称', dataIndex: 'name' },
                { title: '部门代码', dataIndex: 'code' },
                { title: '描述', dataIndex: 'description', span: 2 },
                {
                  title: '排序',
                  dataIndex: 'sort_order',
                  render: (value: any) => value !== undefined && value !== null ? value : '-',
                },
                { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
                { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
              ]}
            />
            
            {/* 部门成员列表 */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 16 }}>部门成员 ({departmentMembers.length})</h3>
              <Table
                dataSource={departmentMembers}
                loading={membersLoading}
                rowKey="uuid"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '用户名',
                    dataIndex: 'username',
                    key: 'username',
                  },
                  {
                    title: '姓名',
                    dataIndex: 'full_name',
                    key: 'full_name',
                  },
                  {
                    title: '邮箱',
                    dataIndex: 'email',
                    key: 'email',
                  },
                  {
                    title: '状态',
                    dataIndex: 'is_active',
                    key: 'is_active',
                    render: (value: boolean) => (
                      <Tag color={value ? 'success' : 'default'}>
                        {value ? '启用' : '禁用'}
                      </Tag>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </Drawer>
      </div>
      </PageContainer>
    </div>
  );
};

export default DepartmentListPage;

