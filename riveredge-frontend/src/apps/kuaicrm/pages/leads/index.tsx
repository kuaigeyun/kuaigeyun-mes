/**
 * 线索管理页面
 * 
 * 提供线索的 CRUD 功能，包括列表展示、创建、编辑、删除、评分、分配、转化等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message, InputNumber } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, StarOutlined, UserOutlined, SwapOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { leadApi } from '../../services/process';
import type { Lead, LeadCreate, LeadUpdate } from '../../types/process';

/**
 * 线索管理列表页面组件
 */
const LeadsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentLeadUuid, setCurrentLeadUuid] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑线索）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建线索
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentLeadUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '新线索',
      source: '其他',
    });
  };

  /**
   * 处理编辑线索
   */
  const handleEdit = async (record: Lead) => {
    try {
      setIsEdit(true);
      setCurrentLeadUuid(record.uuid);
      setModalVisible(true);
      
      // 获取线索详情
      const detail = await leadApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        company: detail.company,
        phone: detail.phone,
        email: detail.email,
        source: detail.source,
        status: detail.status,
        ownerId: detail.ownerId,
        description: detail.description,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取线索详情失败');
    }
  };

  /**
   * 处理删除线索
   */
  const handleDelete = async (record: Lead) => {
    try {
      await leadApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Lead) => {
    try {
      setCurrentLeadUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await leadApi.get(record.uuid);
      setLeadDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取线索详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理线索评分
   */
  const handleScore = async (record: Lead) => {
    try {
      await leadApi.score(record.uuid);
      messageApi.success('评分成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '评分失败');
    }
  };

  /**
   * 处理分配线索
   */
  const handleAssign = async (record: Lead) => {
    Modal.confirm({
      title: '分配线索',
      content: (
        <InputNumber
          placeholder="请输入负责人ID"
          style={{ width: '100%', marginTop: 8 }}
        />
      ),
      onOk: async () => {
        // TODO: 实现分配逻辑
        messageApi.info('分配功能待实现');
      },
    });
  };

  /**
   * 处理转化线索
   */
  const handleConvert = async (record: Lead) => {
    Modal.confirm({
      title: '转化线索',
      content: '确定要将此线索转化为商机吗？',
      onOk: async () => {
        try {
          await leadApi.convert(record.uuid);
          messageApi.success('转化成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '转化失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: LeadCreate | LeadUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentLeadUuid) {
        await leadApi.update(currentLeadUuid, values as LeadUpdate);
        messageApi.success('更新成功');
      } else {
        await leadApi.create(values as LeadCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Lead>[] = [
    {
      title: '线索名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.name}</a>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      width: 150,
      ellipsis: true,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '网站': { text: '网站' },
        '电话': { text: '电话' },
        '展会': { text: '展会' },
        '推荐': { text: '推荐' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '新线索': { text: <Tag color="blue">新线索</Tag> },
        '跟进中': { text: <Tag color="orange">跟进中</Tag> },
        '已转化': { text: <Tag color="green">已转化</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '评分',
      dataIndex: 'score',
      width: 80,
      sorter: true,
      render: (score) => score ? <Tag color="gold"><StarOutlined /> {score}</Tag> : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<StarOutlined />}
            onClick={() => handleScore(record)}
          >
            评分
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => handleAssign(record)}
          >
            分配
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => handleConvert(record)}
          >
            转化
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
            title="确定要删除这条线索吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Lead>
        headerTitle="线索管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await leadApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建线索
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑线索' : '新建线索'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
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
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="name"
            label="线索名称"
            rules={[{ required: true, message: '请输入线索名称' }]}
            placeholder="请输入线索名称"
          />
          <ProFormText
            name="company"
            label="公司"
            placeholder="请输入公司名称"
          />
          <ProFormText
            name="phone"
            label="电话"
            placeholder="请输入电话号码"
          />
          <ProFormText
            name="email"
            label="邮箱"
            placeholder="请输入邮箱地址"
          />
          <ProFormSelect
            name="source"
            label="来源"
            options={[
              { label: '网站', value: '网站' },
              { label: '电话', value: '电话' },
              { label: '展会', value: '展会' },
              { label: '推荐', value: '推荐' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择来源' }]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '新线索', value: '新线索' },
              { label: '跟进中', value: '跟进中' },
              { label: '已转化', value: '已转化' },
              { label: '已关闭', value: '已关闭' },
            ]}
          />
          <ProFormText
            name="ownerId"
            label="负责人ID"
            placeholder="请输入负责人ID"
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="线索详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : leadDetail ? (
          <ProDescriptions<Lead>
            column={1}
            dataSource={leadDetail}
            columns={[
              { title: '线索名称', dataIndex: 'name' },
              { title: '公司', dataIndex: 'company' },
              { title: '电话', dataIndex: 'phone' },
              { title: '邮箱', dataIndex: 'email' },
              { title: '来源', dataIndex: 'source' },
              { title: '状态', dataIndex: 'status' },
              { title: '评分', dataIndex: 'score' },
              { title: '负责人ID', dataIndex: 'ownerId' },
              { title: '描述', dataIndex: 'description' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default LeadsPage;
