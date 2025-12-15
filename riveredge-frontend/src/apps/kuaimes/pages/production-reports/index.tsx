/**
 * 生产报工管理页面
 * 
 * 提供生产报工的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { productionReportApi } from '../../services/process';
import type { ProductionReport, ProductionReportCreate, ProductionReportUpdate } from '../../types/process';

/**
 * 生产报工管理列表页面组件
 */
const ProductionReportsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentReportUuid, setCurrentReportUuid] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ProductionReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑报工）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建报工
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReportUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
      qualifiedQuantity: 0,
      defectiveQuantity: 0,
      workHours: 0,
    });
  };

  /**
   * 处理编辑报工
   */
  const handleEdit = async (record: ProductionReport) => {
    try {
      setIsEdit(true);
      setCurrentReportUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await productionReportApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        reportNo: detail.reportNo,
        operationName: detail.operationName,
        reportDate: detail.reportDate,
        quantity: detail.quantity,
        qualifiedQuantity: detail.qualifiedQuantity,
        defectiveQuantity: detail.defectiveQuantity,
        defectiveReason: detail.defectiveReason,
        workHours: detail.workHours,
        batchNo: detail.batchNo,
        serialNo: detail.serialNo,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取报工详情失败');
    }
  };

  /**
   * 处理删除报工
   */
  const handleDelete = async (record: ProductionReport) => {
    try {
      await productionReportApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProductionReport) => {
    try {
      setCurrentReportUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionReportApi.get(record.uuid);
      setReportDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取报工详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ProductionReportCreate | ProductionReportUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentReportUuid) {
        await productionReportApi.update(currentReportUuid, values as ProductionReportUpdate);
        messageApi.success('更新成功');
      } else {
        await productionReportApi.create(values as ProductionReportCreate);
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
  const columns: ProColumns<ProductionReport>[] = [
    {
      title: '报工单编号',
      dataIndex: 'reportNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reportNo}</a>
      ),
    },
    {
      title: '工序名称',
      dataIndex: 'operationName',
      width: 150,
    },
    {
      title: '报工数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '合格数量',
      dataIndex: 'qualifiedQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '不良品数量',
      dataIndex: 'defectiveQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '工时（小时）',
      dataIndex: 'workHours',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '操作员',
      dataIndex: 'operatorName',
      width: 100,
    },
    {
      title: '工作中心',
      dataIndex: 'workCenterName',
      width: 150,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="blue">已确认</Tag> },
        '已审核': { text: <Tag color="green">已审核</Tag> },
      },
    },
    {
      title: '报工日期',
      dataIndex: 'reportDate',
      width: 150,
      valueType: 'dateTime',
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
            title="确定要删除这条报工吗？"
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
      <UniTable<ProductionReport>
        headerTitle="生产报工管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await productionReportApi.list({
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
            新建报工
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑生产报工' : '新建生产报工'}
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
            name="reportNo"
            label="报工单编号"
            rules={[{ required: true, message: '请输入报工单编号' }]}
            placeholder="请输入报工单编号"
          />
          <ProFormText
            name="operationName"
            label="工序名称"
            placeholder="请输入工序名称"
          />
          <ProFormDatePicker
            name="reportDate"
            label="报工日期"
            rules={[{ required: true, message: '请选择报工日期' }]}
          />
          <ProFormText
            name="quantity"
            label="报工数量"
            rules={[{ required: true, message: '请输入报工数量' }]}
            placeholder="请输入报工数量"
          />
          <ProFormText
            name="qualifiedQuantity"
            label="合格数量"
            placeholder="请输入合格数量"
          />
          <ProFormText
            name="defectiveQuantity"
            label="不良品数量"
            placeholder="请输入不良品数量"
          />
          <ProFormTextArea
            name="defectiveReason"
            label="不良品原因"
            placeholder="请输入不良品原因"
          />
          <ProFormText
            name="workHours"
            label="工时（小时）"
            placeholder="请输入工时"
          />
          <ProFormText
            name="batchNo"
            label="批次号"
            placeholder="请输入批次号"
          />
          <ProFormText
            name="serialNo"
            label="序列号"
            placeholder="请输入序列号"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="生产报工详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : reportDetail ? (
          <ProDescriptions<ProductionReport>
            column={1}
            dataSource={reportDetail}
            columns={[
              { title: '报工单编号', dataIndex: 'reportNo' },
              { title: '工序名称', dataIndex: 'operationName' },
              { title: '报工数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '合格数量', dataIndex: 'qualifiedQuantity', valueType: 'digit' },
              { title: '不良品数量', dataIndex: 'defectiveQuantity', valueType: 'digit' },
              { title: '不良品原因', dataIndex: 'defectiveReason' },
              { title: '工时（小时）', dataIndex: 'workHours', valueType: 'digit' },
              { title: '操作员', dataIndex: 'operatorName' },
              { title: '工作中心', dataIndex: 'workCenterName' },
              { title: '批次号', dataIndex: 'batchNo' },
              { title: '序列号', dataIndex: 'serialNo' },
              { title: '状态', dataIndex: 'status' },
              { title: '报工日期', dataIndex: 'reportDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ProductionReportsPage;
