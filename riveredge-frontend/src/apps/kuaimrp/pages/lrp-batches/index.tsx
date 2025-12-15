/**
 * LRP批次管理页面
 * 
 * 提供LRP批次的 CRUD 功能，包括列表展示、创建、编辑、删除、计算等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { lrpBatchApi } from '../../services/process';
import type { LRPBatch, LRPBatchCreate, LRPBatchUpdate } from '../../types/process';

/**
 * LRP批次管理列表页面组件
 */
const LRPBatchesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBatchUuid, setCurrentBatchUuid] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<LRPBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑批次）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建批次
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentBatchUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
    });
  };

  /**
   * 处理编辑批次
   */
  const handleEdit = async (record: LRPBatch) => {
    try {
      setIsEdit(true);
      setCurrentBatchUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await lrpBatchApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        batchNo: detail.batchNo,
        batchName: detail.batchName,
        plannedDate: detail.plannedDate,
        deliveryDate: detail.deliveryDate,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取批次详情失败');
    }
  };

  /**
   * 处理删除批次
   */
  const handleDelete = async (record: LRPBatch) => {
    try {
      await lrpBatchApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: LRPBatch) => {
    try {
      setCurrentBatchUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await lrpBatchApi.get(record.uuid);
      setBatchDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取批次详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理执行LRP计算
   */
  const handleCalculate = async (record: LRPBatch) => {
    Modal.confirm({
      title: '执行LRP计算',
      content: `确定要执行批次 ${record.batchNo} 的LRP计算吗？`,
      onOk: async () => {
        try {
          await lrpBatchApi.calculate(record.uuid);
          messageApi.success('LRP计算已启动');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '执行LRP计算失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: LRPBatchCreate | LRPBatchUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentBatchUuid) {
        await lrpBatchApi.update(currentBatchUuid, values as LRPBatchUpdate);
        messageApi.success('更新成功');
      } else {
        await lrpBatchApi.create(values as LRPBatchCreate);
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
  const columns: ProColumns<LRPBatch>[] = [
    {
      title: '批次编号',
      dataIndex: 'batchNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.batchNo}</a>
      ),
    },
    {
      title: '批次名称',
      dataIndex: 'batchName',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '计算中': { text: <Tag color="orange">计算中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '计划日期',
      dataIndex: 'plannedDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '交期要求',
      dataIndex: 'deliveryDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleCalculate(record)}
            >
              计算
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条批次吗？"
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
      <UniTable<LRPBatch>
        headerTitle="LRP批次管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await lrpBatchApi.list({
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
            新建批次
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑LRP批次' : '新建LRP批次'}
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
            name="batchNo"
            label="批次编号"
            rules={[{ required: true, message: '请输入批次编号' }]}
            placeholder="请输入批次编号"
          />
          <ProFormText
            name="batchName"
            label="批次名称"
            rules={[{ required: true, message: '请输入批次名称' }]}
            placeholder="请输入批次名称"
          />
          <ProFormDatePicker
            name="plannedDate"
            label="计划日期"
            placeholder="请选择计划日期"
          />
          <ProFormDatePicker
            name="deliveryDate"
            label="交期要求"
            placeholder="请选择交期要求"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="LRP批次详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : batchDetail ? (
          <ProDescriptions<LRPBatch>
            column={1}
            dataSource={batchDetail}
            columns={[
              { title: '批次编号', dataIndex: 'batchNo' },
              { title: '批次名称', dataIndex: 'batchName' },
              { title: '状态', dataIndex: 'status' },
              { title: '计划日期', dataIndex: 'plannedDate', valueType: 'dateTime' },
              { title: '交期要求', dataIndex: 'deliveryDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default LRPBatchesPage;
