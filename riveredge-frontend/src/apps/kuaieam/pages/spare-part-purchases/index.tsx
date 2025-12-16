/**
 * 备件采购管理页面
 * 
 * 提供备件采购的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { sparePartPurchaseApi } from '../../services/process';
import type { SparePartPurchase, SparePartPurchaseCreate, SparePartPurchaseUpdate } from '../../types/process';

/**
 * 备件采购管理列表页面组件
 */
const SparePartPurchasesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPurchaseUuid, setCurrentPurchaseUuid] = useState<string | null>(null);
  const [purchaseDetail, setPurchaseDetail] = useState<SparePartPurchase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑备件采购）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建备件采购
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPurchaseUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      purchaseDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑备件采购
   */
  const handleEdit = async (record: SparePartPurchase) => {
    try {
      setIsEdit(true);
      setCurrentPurchaseUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await sparePartPurchaseApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        purchaseNo: detail.purchaseNo,
        demandId: detail.demandId,
        materialId: detail.materialId,
        materialName: detail.materialName,
        materialCode: detail.materialCode,
        purchaseQuantity: detail.purchaseQuantity,
        unitPrice: detail.unitPrice,
        totalAmount: detail.totalAmount,
        supplierId: detail.supplierId,
        supplierName: detail.supplierName,
        purchaseDate: detail.purchaseDate,
        expectedDeliveryDate: detail.expectedDeliveryDate,
        actualDeliveryDate: detail.actualDeliveryDate,
        purchaserId: detail.purchaserId,
        purchaserName: detail.purchaserName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取备件采购详情失败');
    }
  };

  /**
   * 处理删除备件采购
   */
  const handleDelete = async (record: SparePartPurchase) => {
    try {
      await sparePartPurchaseApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SparePartPurchase) => {
    try {
      setCurrentPurchaseUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sparePartPurchaseApi.get(record.uuid);
      setPurchaseDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取备件采购详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SparePartPurchaseCreate | SparePartPurchaseUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPurchaseUuid) {
        await sparePartPurchaseApi.update(currentPurchaseUuid, values as SparePartPurchaseUpdate);
        messageApi.success('更新成功');
      } else {
        await sparePartPurchaseApi.create(values as SparePartPurchaseCreate);
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
  const columns: ProColumns<SparePartPurchase>[] = [
    {
      title: '采购单编号',
      dataIndex: 'purchaseNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.purchaseNo}</a>
      ),
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '采购数量',
      dataIndex: 'purchaseQuantity',
      width: 100,
      sorter: true,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      width: 100,
      valueType: 'money',
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 100,
      valueType: 'money',
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '采购日期',
      dataIndex: 'purchaseDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待采购': { text: <Tag color="blue">待采购</Tag> },
        '采购中': { text: <Tag color="orange">采购中</Tag> },
        '已到货': { text: <Tag color="green">已到货</Tag> },
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
            title="确定要删除这条备件采购记录吗？"
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
      <UniTable<SparePartPurchase>
        headerTitle="备件采购管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await sparePartPurchaseApi.list({
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
            新建备件采购
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑备件采购' : '新建备件采购'}
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
            name="purchaseNo"
            label="采购单编号"
            rules={[{ required: true, message: '请输入采购单编号' }]}
            placeholder="请输入采购单编号"
          />
          <ProFormDigit
            name="demandId"
            label="备件需求ID"
            placeholder="请输入备件需求ID（可选）"
          />
          <ProFormDigit
            name="materialId"
            label="物料ID"
            rules={[{ required: true, message: '请输入物料ID' }]}
            placeholder="请输入物料ID"
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="materialCode"
            label="物料编码"
            placeholder="请输入物料编码"
          />
          <ProFormDigit
            name="purchaseQuantity"
            label="采购数量"
            rules={[{ required: true, message: '请输入采购数量' }]}
            placeholder="请输入采购数量"
            min={1}
          />
          <ProFormMoney
            name="unitPrice"
            label="单价"
            placeholder="请输入单价"
          />
          <ProFormMoney
            name="totalAmount"
            label="总金额"
            placeholder="请输入总金额"
          />
          <ProFormDigit
            name="supplierId"
            label="供应商ID"
            placeholder="请输入供应商ID"
          />
          <ProFormText
            name="supplierName"
            label="供应商名称"
            placeholder="请输入供应商名称"
          />
          <ProFormDatePicker
            name="purchaseDate"
            label="采购日期"
            rules={[{ required: true, message: '请选择采购日期' }]}
            placeholder="请选择采购日期"
          />
          <ProFormDatePicker
            name="expectedDeliveryDate"
            label="预计到货日期"
            placeholder="请选择预计到货日期"
          />
          <ProFormDatePicker
            name="actualDeliveryDate"
            label="实际到货日期"
            placeholder="请选择实际到货日期"
          />
          <ProFormDigit
            name="purchaserId"
            label="采购人员ID"
            placeholder="请输入采购人员ID"
          />
          <ProFormText
            name="purchaserName"
            label="采购人员姓名"
            placeholder="请输入采购人员姓名"
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
        title="备件采购详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : purchaseDetail ? (
          <ProDescriptions<SparePartPurchase>
            column={1}
            dataSource={purchaseDetail}
            columns={[
              { title: '采购单编号', dataIndex: 'purchaseNo' },
              { title: '备件需求ID', dataIndex: 'demandId' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '物料编码', dataIndex: 'materialCode' },
              { title: '采购数量', dataIndex: 'purchaseQuantity' },
              { title: '单价', dataIndex: 'unitPrice', valueType: 'money' },
              { title: '总金额', dataIndex: 'totalAmount', valueType: 'money' },
              { title: '供应商', dataIndex: 'supplierName' },
              { title: '采购日期', dataIndex: 'purchaseDate', valueType: 'dateTime' },
              { title: '预计到货日期', dataIndex: 'expectedDeliveryDate', valueType: 'dateTime' },
              { title: '实际到货日期', dataIndex: 'actualDeliveryDate', valueType: 'dateTime' },
              { title: '采购人员', dataIndex: 'purchaserName' },
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

export default SparePartPurchasesPage;

