/**
 * 采购合同管理页面
 * 
 * 提供采购合同的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { purchaseContractApi } from '../../services/process';
import type { PurchaseContract, PurchaseContractCreate, PurchaseContractUpdate } from '../../types/process';

/**
 * 采购合同管理列表页面组件
 */
const PurchaseContractsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentContractUuid, setCurrentContractUuid] = useState<string | null>(null);
  const [contractDetail, setContractDetail] = useState<PurchaseContract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑合同）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建合同
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentContractUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      currency: 'CNY',
      status: '草稿',
    });
  };

  /**
   * 处理编辑合同
   */
  const handleEdit = async (record: PurchaseContract) => {
    try {
      setIsEdit(true);
      setCurrentContractUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await purchaseContractApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        contractNo: detail.contractNo,
        contractName: detail.contractName,
        supplierId: detail.supplierId,
        contractDate: detail.contractDate,
        startDate: detail.startDate,
        endDate: detail.endDate,
        totalAmount: detail.totalAmount,
        currency: detail.currency,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取合同详情失败');
    }
  };

  /**
   * 处理删除合同
   */
  const handleDelete = async (record: PurchaseContract) => {
    try {
      await purchaseContractApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: PurchaseContract) => {
    try {
      setCurrentContractUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await purchaseContractApi.get(record.uuid);
      setContractDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取合同详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: PurchaseContractCreate | PurchaseContractUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentContractUuid) {
        await purchaseContractApi.update(currentContractUuid, values as PurchaseContractUpdate);
        messageApi.success('更新成功');
      } else {
        await purchaseContractApi.create(values as PurchaseContractCreate);
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
  const columns: ProColumns<PurchaseContract>[] = [
    {
      title: '合同编号',
      dataIndex: 'contractNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.contractNo}</a>
      ),
    },
    {
      title: '合同名称',
      dataIndex: 'contractName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '供应商ID',
      dataIndex: 'supplierId',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '已审批': { text: <Tag color="blue">已审批</Tag> },
        '执行中': { text: <Tag color="cyan">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已终止': { text: <Tag color="red">已终止</Tag> },
      },
    },
    {
      title: '合同金额',
      dataIndex: 'totalAmount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '签订日期',
      dataIndex: 'contractDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '合同期限',
      dataIndex: 'startDate',
      width: 200,
      render: (_, record) => {
        if (!record.startDate || !record.endDate) return '-';
        return `${record.startDate} 至 ${record.endDate}`;
      },
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条合同吗？"
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
      <UniTable<PurchaseContract>
        headerTitle="采购合同管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await purchaseContractApi.list({
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
            新建合同
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑采购合同' : '新建采购合同'}
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
            name="contractNo"
            label="合同编号"
            rules={[{ required: true, message: '请输入合同编号' }]}
            placeholder="请输入合同编号"
          />
          <ProFormText
            name="contractName"
            label="合同名称"
            rules={[{ required: true, message: '请输入合同名称' }]}
            placeholder="请输入合同名称"
          />
          <ProFormText
            name="supplierId"
            label="供应商ID"
            rules={[{ required: true, message: '请输入供应商ID' }]}
            placeholder="请输入供应商ID"
          />
          <ProFormDatePicker
            name="contractDate"
            label="合同签订日期"
            rules={[{ required: true, message: '请选择合同签订日期' }]}
          />
          <ProFormDatePicker
            name="startDate"
            label="合同开始日期"
            placeholder="请选择合同开始日期"
          />
          <ProFormDatePicker
            name="endDate"
            label="合同结束日期"
            placeholder="请选择合同结束日期"
          />
          <ProFormText
            name="totalAmount"
            label="合同总金额"
            placeholder="请输入合同总金额"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="采购合同详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : contractDetail ? (
          <ProDescriptions<PurchaseContract>
            column={1}
            dataSource={contractDetail}
            columns={[
              { title: '合同编号', dataIndex: 'contractNo' },
              { title: '合同名称', dataIndex: 'contractName' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '合同签订日期', dataIndex: 'contractDate', valueType: 'dateTime' },
              { title: '合同开始日期', dataIndex: 'startDate', valueType: 'dateTime' },
              { title: '合同结束日期', dataIndex: 'endDate', valueType: 'dateTime' },
              { title: '状态', dataIndex: 'status' },
              { title: '合同金额', dataIndex: 'totalAmount', valueType: 'money' },
              { title: '币种', dataIndex: 'currency' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default PurchaseContractsPage;
