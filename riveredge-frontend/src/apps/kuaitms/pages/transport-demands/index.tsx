/**
 * 运输需求管理页面
 * 
 * 提供运输需求的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { transportDemandApi } from '../../services/process';
import type { TransportDemand, TransportDemandCreate, TransportDemandUpdate } from '../../types/process';

/**
 * 运输需求管理列表页面组件
 */
const TransportDemandsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemandUuid, setCurrentDemandUuid] = useState<string | null>(null);
  const [demandDetail, setDemandDetail] = useState<TransportDemand | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑运输需求）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建运输需求
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDemandUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '中',
    });
  };

  /**
   * 处理编辑运输需求
   */
  const handleEdit = async (record: TransportDemand) => {
    try {
      setIsEdit(true);
      setCurrentDemandUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await transportDemandApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        demandNo: detail.demandNo,
        sourceType: detail.sourceType,
        sourceId: detail.sourceId,
        sourceNo: detail.sourceNo,
        customerId: detail.customerId,
        customerName: detail.customerName,
        deliveryAddress: detail.deliveryAddress,
        contactPerson: detail.contactPerson,
        contactPhone: detail.contactPhone,
        materialId: detail.materialId,
        materialName: detail.materialName,
        materialCode: detail.materialCode,
        quantity: detail.quantity,
        unit: detail.unit,
        requiredDate: detail.requiredDate,
        priority: detail.priority,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取运输需求详情失败');
    }
  };

  /**
   * 处理删除运输需求
   */
  const handleDelete = async (record: TransportDemand) => {
    try {
      await transportDemandApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: TransportDemand) => {
    try {
      setCurrentDemandUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await transportDemandApi.get(record.uuid);
      setDemandDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取运输需求详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: TransportDemandCreate | TransportDemandUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDemandUuid) {
        await transportDemandApi.update(currentDemandUuid, values as TransportDemandUpdate);
        messageApi.success('更新成功');
      } else {
        await transportDemandApi.create(values as TransportDemandCreate);
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
  const columns: ProColumns<TransportDemand>[] = [
    {
      title: '需求单编号',
      dataIndex: 'demandNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.demandNo}</a>
      ),
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      sorter: true,
      render: (_, record) => {
        if (record.quantity && record.unit) {
          return `${record.quantity} ${record.unit}`;
        }
        return record.quantity || '-';
      },
    },
    {
      title: '要求到货日期',
      dataIndex: 'requiredDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="blue">低</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待计划': { text: <Tag color="blue">待计划</Tag> },
        '已计划': { text: <Tag color="green">已计划</Tag> },
        '执行中': { text: <Tag color="orange">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
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
            title="确定要删除这条运输需求吗？"
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
      <UniTable<TransportDemand>
        headerTitle="运输需求管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await transportDemandApi.list({
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
            新建运输需求
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑运输需求' : '新建运输需求'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
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
            name="demandNo"
            label="需求单编号"
            rules={[{ required: true, message: '请输入需求单编号' }]}
            placeholder="请输入需求单编号"
          />
          <ProFormSelect
            name="sourceType"
            label="来源类型"
            options={[
              { label: '销售订单', value: '销售订单' },
              { label: '采购订单', value: '采购订单' },
              { label: '调拨单', value: '调拨单' },
              { label: '其他', value: '其他' },
            ]}
            placeholder="请选择来源类型"
          />
          <ProFormDigit
            name="sourceId"
            label="来源ID"
            placeholder="请输入来源ID"
          />
          <ProFormText
            name="sourceNo"
            label="来源编号"
            placeholder="请输入来源编号"
          />
          <ProFormDigit
            name="customerId"
            label="客户ID"
            placeholder="请输入客户ID"
          />
          <ProFormText
            name="customerName"
            label="客户名称"
            placeholder="请输入客户名称"
          />
          <ProFormTextArea
            name="deliveryAddress"
            label="收货地址"
            placeholder="请输入收货地址"
          />
          <ProFormText
            name="contactPerson"
            label="联系人"
            placeholder="请输入联系人"
          />
          <ProFormText
            name="contactPhone"
            label="联系电话"
            placeholder="请输入联系电话"
          />
          <ProFormDigit
            name="materialId"
            label="物料ID"
            placeholder="请输入物料ID"
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="materialCode"
            label="物料编码"
            placeholder="请输入物料编码"
          />
          <ProFormDigit
            name="quantity"
            label="数量"
            placeholder="请输入数量"
            min={0}
          />
          <ProFormText
            name="unit"
            label="单位"
            placeholder="请输入单位"
          />
          <ProFormDatePicker
            name="requiredDate"
            label="要求到货日期"
            placeholder="请选择要求到货日期"
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="运输需求详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : demandDetail ? (
          <ProDescriptions<TransportDemand>
            column={1}
            dataSource={demandDetail}
            columns={[
              { title: '需求单编号', dataIndex: 'demandNo' },
              { title: '来源类型', dataIndex: 'sourceType' },
              { title: '来源ID', dataIndex: 'sourceId' },
              { title: '来源编号', dataIndex: 'sourceNo' },
              { title: '客户ID', dataIndex: 'customerId' },
              { title: '客户名称', dataIndex: 'customerName' },
              { title: '收货地址', dataIndex: 'deliveryAddress' },
              { title: '联系人', dataIndex: 'contactPerson' },
              { title: '联系电话', dataIndex: 'contactPhone' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '物料编码', dataIndex: 'materialCode' },
              { title: '数量', dataIndex: 'quantity' },
              { title: '单位', dataIndex: 'unit' },
              { title: '要求到货日期', dataIndex: 'requiredDate', valueType: 'dateTime' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default TransportDemandsPage;

