/**
 * 商机管理页面
 * 
 * 提供商机的 CRUD 功能，包括列表展示、创建、编辑、删除、阶段管理、转化等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormDigit, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SwapOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { opportunityApi } from '../../services/process';
import type { Opportunity, OpportunityCreate, OpportunityUpdate } from '../../types/process';

/**
 * 商机管理列表页面组件
 */
const OpportunitiesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOpportunityUuid, setCurrentOpportunityUuid] = useState<string | null>(null);
  const [opportunityDetail, setOpportunityDetail] = useState<Opportunity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑商机）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 根据路由路径自动打开创建 Modal
  useEffect(() => {
    if (location.pathname.endsWith('/create')) {
      handleCreate();
      // 清理 URL，避免刷新时重复打开
      navigate(location.pathname.replace('/create', ''), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /**
   * 处理新建商机
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOpportunityUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      stage: '初步接触',
      probability: 10,
    });
  };

  /**
   * 处理编辑商机
   */
  const handleEdit = async (record: Opportunity) => {
    try {
      setIsEdit(true);
      setCurrentOpportunityUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await opportunityApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        customerId: detail.customerId,
        leadId: detail.leadId,
        amount: detail.amount,
        stage: detail.stage,
        probability: detail.probability,
        expectedCloseDate: detail.expectedCloseDate,
        ownerId: detail.ownerId,
        source: detail.source,
        description: detail.description,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取商机详情失败');
    }
  };

  /**
   * 处理删除商机
   */
  const handleDelete = async (record: Opportunity) => {
    try {
      await opportunityApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Opportunity) => {
    try {
      setCurrentOpportunityUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await opportunityApi.get(record.uuid);
      setOpportunityDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取商机详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理计算成交概率
   */
  const handleCalculateProbability = async (record: Opportunity) => {
    try {
      await opportunityApi.calculateProbability(record.uuid);
      messageApi.success('计算成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '计算失败');
    }
  };

  /**
   * 处理变更阶段
   */
  const handleChangeStage = async (record: Opportunity) => {
    Modal.confirm({
      title: '变更商机阶段',
      content: '请选择新的阶段',
      // TODO: 实现阶段选择
      onOk: async () => {
        messageApi.info('阶段变更功能待实现');
      },
    });
  };

  /**
   * 处理转化商机
   */
  const handleConvert = async (record: Opportunity) => {
    Modal.confirm({
      title: '转化商机',
      content: '确定要将此商机转化为订单吗？',
      onOk: async () => {
        try {
          await opportunityApi.convert(record.uuid);
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
  const handleSubmit = async (values: OpportunityCreate | OpportunityUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOpportunityUuid) {
        await opportunityApi.update(currentOpportunityUuid, values as OpportunityUpdate);
        messageApi.success('更新成功');
      } else {
        await opportunityApi.create(values as OpportunityCreate);
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
  const columns: ProColumns<Opportunity>[] = [
    {
      title: '商机名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.name}</a>
      ),
    },
    {
      title: '客户ID',
      dataIndex: 'customerId',
      width: 100,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      sorter: true,
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '初步接触': { text: <Tag color="blue">初步接触</Tag> },
        '需求确认': { text: <Tag color="cyan">需求确认</Tag> },
        '方案报价': { text: <Tag color="orange">方案报价</Tag> },
        '商务谈判': { text: <Tag color="purple">商务谈判</Tag> },
        '合同签署': { text: <Tag color="green">合同签署</Tag> },
        '已成交': { text: <Tag color="success">已成交</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '成交概率',
      dataIndex: 'probability',
      width: 100,
      sorter: true,
      render: (probability) => probability ? `${probability}%` : '-',
    },
    {
      title: '预计成交日期',
      dataIndex: 'expectedCloseDate',
      width: 150,
      valueType: 'date',
    },
    {
      title: '负责人ID',
      dataIndex: 'ownerId',
      width: 100,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<CalculatorOutlined />}
            onClick={() => handleCalculateProbability(record)}
          >
            计算概率
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleChangeStage(record)}
          >
            变更阶段
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
            title="确定要删除这条商机吗？"
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
      <UniTable<Opportunity>
        headerTitle="商机管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await opportunityApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
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
            新建商机
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑商机' : '新建商机'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
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
            label="商机名称"
            rules={[{ required: true, message: '请输入商机名称' }]}
            placeholder="请输入商机名称"
          />
          <ProFormDigit
            name="customerId"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID' }]}
            placeholder="请输入客户ID"
          />
          <ProFormDigit
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
            placeholder="请输入金额"
            fieldProps={{
              prefix: '¥',
              precision: 2,
            }}
          />
          <ProFormSelect
            name="stage"
            label="阶段"
            options={[
              { label: '初步接触', value: '初步接触' },
              { label: '需求确认', value: '需求确认' },
              { label: '方案报价', value: '方案报价' },
              { label: '商务谈判', value: '商务谈判' },
              { label: '合同签署', value: '合同签署' },
              { label: '已成交', value: '已成交' },
              { label: '已关闭', value: '已关闭' },
            ]}
            rules={[{ required: true, message: '请选择阶段' }]}
          />
          <ProFormDigit
            name="probability"
            label="成交概率(%)"
            placeholder="请输入成交概率"
            fieldProps={{
              min: 0,
              max: 100,
              precision: 0,
            }}
          />
          <ProFormDatePicker
            name="expectedCloseDate"
            label="预计成交日期"
            placeholder="请选择预计成交日期"
          />
          <ProFormDigit
            name="ownerId"
            label="负责人ID"
            placeholder="请输入负责人ID"
          />
          <ProFormSelect
            name="source"
            label="来源"
            options={[
              { label: '线索转化', value: '线索转化' },
              { label: '主动开发', value: '主动开发' },
              { label: '客户推荐', value: '客户推荐' },
              { label: '其他', value: '其他' },
            ]}
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
        title="商机详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : opportunityDetail ? (
          <ProDescriptions<Opportunity>
            column={1}
            dataSource={opportunityDetail}
            columns={[
              { title: '商机名称', dataIndex: 'name' },
              { title: '客户ID', dataIndex: 'customerId' },
              { title: '金额', dataIndex: 'amount', render: (amount) => `¥${amount?.toLocaleString() || 0}` },
              { title: '阶段', dataIndex: 'stage' },
              { title: '成交概率', dataIndex: 'probability', render: (prob) => prob ? `${prob}%` : '-' },
              { title: '预计成交日期', dataIndex: 'expectedCloseDate', valueType: 'date' },
              { title: '负责人ID', dataIndex: 'ownerId' },
              { title: '来源', dataIndex: 'source' },
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

export default OpportunitiesPage;
