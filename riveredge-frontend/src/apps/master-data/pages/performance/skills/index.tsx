/**
 * 技能管理页面
 * 
 * 提供技能的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { skillApi } from '../../../services/performance';
import { SkillFormModal } from '../../../components/SkillFormModal';
import type { Skill } from '../../../types/performance';

/**
 * 技能管理列表页面组件
 */
const SkillsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSkillUuid, setCurrentSkillUuid] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑技能）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  /**
   * 处理新建技能
   */
  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑技能
   */
  const handleEdit = (record: Skill) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除技能
   */
  const handleDelete = async (record: Skill) => {
    try {
      await skillApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除技能
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await skillApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Skill) => {
    try {
      setCurrentSkillUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await skillApi.get(record.uuid);
      setSkillDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取技能详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSkillUuid(null);
    setSkillDetail(null);
  };

  /**
   * 处理提交表单（创建/更新技能）
   */
  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Skill>[] = [
    {
      title: '技能编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '技能名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '技能分类',
      dataIndex: 'category',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个技能吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<Skill>[] = [
    {
      title: '技能编码',
      dataIndex: 'code',
    },
    {
      title: '技能名称',
      dataIndex: 'name',
    },
    {
      title: '技能分类',
      dataIndex: 'category',
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Skill>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          try {
            const result = await skillApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取技能列表失败:', error);
            messageApi.error(error?.message || '获取技能列表失败');
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
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建技能
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Skill>
        title="技能详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={skillDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑技能 Modal */}
      <SkillFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default SkillsPage;
