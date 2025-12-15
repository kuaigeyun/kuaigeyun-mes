/**
 * 全局库存视图管理页面
 * 
 * 提供全局库存视图的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormMoney } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { globalInventoryViewApi } from '../../services/process';
import type { GlobalInventoryView, GlobalInventoryViewCreate, GlobalInventoryViewUpdate } from '../../types/process';

/**
 * 全局库存视图管理列表页面组件
 */
const GlobalInventoryViewsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentViewUuid, setCurrentViewUuid] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<GlobalInventoryView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑全局库存视图）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建全局库存视图
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentViewUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      alertStatus: '正常',
      status: '正常',
    });
  };

  /**
   * 处理编辑全局库存视图
   */
  const handleEdit = async (record: GlobalInventoryView) => {
    try {
      setIsEdit(true);
      setCurrentViewUuid(record.uuid);
      setModalVisible(true);
      
      // 获取全局库存视图详情
      const detail = await globalInventoryViewApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        viewNo: detail.viewNo,
        viewName: detail.viewName,
        materialId: detail.materialId,
        materialName: detail.materialName,
        materialCode: detail.materialCode,
        inventoryType: detail.inventoryType,
        warehouseId: detail.warehouseId,
        warehouseName: detail.warehouseName,
        quantity: detail.quantity,
        unit: detail.unit,
        unitPrice: detail.unitPrice,
        totalValue: detail.totalValue,
        turnoverRate: detail.turnoverRate,
        alertStatus: detail.alertStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取全局库存视图详情失败');
    }
  };

  /**
   * 处理删除全局库存视图
   */
  const handleDelete = async (record: GlobalInventoryView) => {
    try {
      await globalInventoryViewApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: GlobalInventoryView) => {
    try {
      setCurrentViewUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await globalInventoryViewApi.get(record.uuid);
      setViewDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取全局库存视图详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: GlobalInventoryViewCreate | GlobalInventoryViewUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentViewUuid) {
        await globalInventoryViewApi.update(currentViewUuid, values as GlobalInventoryViewUpdate);
        messageApi.success('更新成功');
      } else {
        await globalInventoryViewApi.create(values as GlobalInventoryViewCreate);
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
  const columns: ProColumns<GlobalInventoryView>[] = [
    {
      title: '视图编号',
      dataIndex: 'viewNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.viewNo}</a>
      ),
    },
    {
      title: '视图名称',
      dataIndex: 'viewName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '库存类型',
      dataIndex: 'inventoryType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '原材料': { text: '原材料' },
        '在制品': { text: '在制品' },
        '成品': { text: '成品' },
      },
    },
    {
      title: '仓库名称',
      dataIndex: 'warehouseName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      width: 120,
      valueType: 'money',
    },
    {
      title: '总价值',
      dataIndex: 'totalValue',
      width: 120,
      valueType: 'money',
    },
    {
      title: '周转率',
      dataIndex: 'turnoverRate',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '预警状态',
      dataIndex: 'alertStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '预警': { text: <Tag color="orange">预警</Tag> },
        '紧急': { text: <Tag color="red">紧急</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '预警': { text: <Tag color="orange">预警</Tag> },
        '呆滞': { text: <Tag color="default">呆滞</Tag> },
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
            title="确定要删除这条全局库存视图吗？"
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
      <UniTable<GlobalInventoryView>
        headerTitle="全局库存视图管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await globalInventoryViewApi.list({
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
            新建全局库存视图
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑全局库存视图' : '新建全局库存视图'}
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
            name="viewNo"
            label="视图编号"
            rules={[{ required: true, message: '请输入视图编号' }]}
            placeholder="请输入视图编号"
          />
          <ProFormText
            name="viewName"
            label="视图名称"
            rules={[{ required: true, message: '请输入视图名称' }]}
            placeholder="请输入视图名称"
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
          <ProFormSelect
            name="inventoryType"
            label="库存类型"
            options={[
              { label: '原材料', value: '原材料' },
              { label: '在制品', value: '在制品' },
              { label: '成品', value: '成品' },
            ]}
            placeholder="请选择库存类型"
          />
          <ProFormDigit
            name="warehouseId"
            label="仓库ID"
            placeholder="请输入仓库ID"
          />
          <ProFormText
            name="warehouseName"
            label="仓库名称"
            placeholder="请输入仓库名称"
          />
          <ProFormDigit
            name="quantity"
            label="数量"
            placeholder="请输入数量"
            fieldProps={{
              precision: 4,
              min: 0,
            }}
          />
          <ProFormText
            name="unit"
            label="单位"
            placeholder="请输入单位"
          />
          <ProFormMoney
            name="unitPrice"
            label="单价"
            placeholder="请输入单价"
            fieldProps={{
              precision: 2,
              min: 0,
            }}
          />
          <ProFormMoney
            name="totalValue"
            label="总价值"
            placeholder="请输入总价值"
            fieldProps={{
              precision: 2,
              min: 0,
            }}
          />
          <ProFormDigit
            name="turnoverRate"
            label="周转率"
            placeholder="请输入周转率"
            fieldProps={{
              precision: 4,
              min: 0,
            }}
          />
          <ProFormSelect
            name="alertStatus"
            label="预警状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '预警', value: '预警' },
              { label: '紧急', value: '紧急' },
            ]}
            initialValue="正常"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '预警', value: '预警' },
              { label: '呆滞', value: '呆滞' },
            ]}
            initialValue="正常"
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
        title="全局库存视图详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : viewDetail ? (
          <ProDescriptions<GlobalInventoryView>
            column={1}
            dataSource={viewDetail}
            columns={[
              { title: '视图编号', dataIndex: 'viewNo' },
              { title: '视图名称', dataIndex: 'viewName' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '物料编码', dataIndex: 'materialCode' },
              { title: '库存类型', dataIndex: 'inventoryType' },
              { title: '仓库ID', dataIndex: 'warehouseId' },
              { title: '仓库名称', dataIndex: 'warehouseName' },
              { title: '数量', dataIndex: 'quantity' },
              { title: '单位', dataIndex: 'unit' },
              { title: '单价', dataIndex: 'unitPrice', valueType: 'money' },
              { title: '总价值', dataIndex: 'totalValue', valueType: 'money' },
              { title: '周转率', dataIndex: 'turnoverRate' },
              { title: '预警状态', dataIndex: 'alertStatus' },
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

export default GlobalInventoryViewsPage;

