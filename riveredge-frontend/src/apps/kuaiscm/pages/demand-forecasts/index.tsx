/**
 * 需求预测管理页面
 * 
 * 提供需求预测的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { demandForecastApi } from '../../services/process';
import type { DemandForecast, DemandForecastCreate, DemandForecastUpdate } from '../../types/process';

/**
 * 需求预测管理列表页面组件
 */
const DemandForecastsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentForecastUuid, setCurrentForecastUuid] = useState<string | null>(null);
  const [forecastDetail, setForecastDetail] = useState<DemandForecast | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑需求预测）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建需求预测
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentForecastUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      sharedStatus: '未共享',
      status: '草稿',
    });
  };

  /**
   * 处理编辑需求预测
   */
  const handleEdit = async (record: DemandForecast) => {
    try {
      setIsEdit(true);
      setCurrentForecastUuid(record.uuid);
      setModalVisible(true);
      
      // 获取需求预测详情
      const detail = await demandForecastApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        forecastNo: detail.forecastNo,
        forecastName: detail.forecastName,
        supplierId: detail.supplierId,
        supplierName: detail.supplierName,
        materialId: detail.materialId,
        materialName: detail.materialName,
        materialCode: detail.materialCode,
        forecastPeriod: detail.forecastPeriod,
        forecastStartDate: detail.forecastStartDate,
        forecastEndDate: detail.forecastEndDate,
        forecastQuantity: detail.forecastQuantity,
        actualQuantity: detail.actualQuantity,
        accuracyRate: detail.accuracyRate,
        sharedStatus: detail.sharedStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取需求预测详情失败');
    }
  };

  /**
   * 处理删除需求预测
   */
  const handleDelete = async (record: DemandForecast) => {
    try {
      await demandForecastApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DemandForecast) => {
    try {
      setCurrentForecastUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await demandForecastApi.get(record.uuid);
      setForecastDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取需求预测详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: DemandForecastCreate | DemandForecastUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentForecastUuid) {
        await demandForecastApi.update(currentForecastUuid, values as DemandForecastUpdate);
        messageApi.success('更新成功');
      } else {
        await demandForecastApi.create(values as DemandForecastCreate);
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
  const columns: ProColumns<DemandForecast>[] = [
    {
      title: '预测单编号',
      dataIndex: 'forecastNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.forecastNo}</a>
      ),
    },
    {
      title: '预测名称',
      dataIndex: 'forecastName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplierName',
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
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '预测周期',
      dataIndex: 'forecastPeriod',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '月度': { text: '月度' },
        '季度': { text: '季度' },
        '年度': { text: '年度' },
      },
    },
    {
      title: '预测数量',
      dataIndex: 'forecastQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '实际数量',
      dataIndex: 'actualQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '准确率',
      dataIndex: 'accuracyRate',
      width: 100,
      render: (_, record) => {
        if (record.accuracyRate !== null && record.accuracyRate !== undefined) {
          return `${record.accuracyRate}%`;
        }
        return '-';
      },
    },
    {
      title: '共享状态',
      dataIndex: 'sharedStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '未共享': { text: <Tag color="default">未共享</Tag> },
        '已共享': { text: <Tag color="blue">已共享</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已发布': { text: <Tag color="blue">已发布</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
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
            title="确定要删除这条需求预测吗？"
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
      <UniTable<DemandForecast>
        headerTitle="需求预测管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await demandForecastApi.list({
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
            新建需求预测
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑需求预测' : '新建需求预测'}
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
            name="forecastNo"
            label="预测单编号"
            rules={[{ required: true, message: '请输入预测单编号' }]}
            placeholder="请输入预测单编号"
          />
          <ProFormText
            name="forecastName"
            label="预测名称"
            rules={[{ required: true, message: '请输入预测名称' }]}
            placeholder="请输入预测名称"
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
            name="forecastPeriod"
            label="预测周期"
            options={[
              { label: '月度', value: '月度' },
              { label: '季度', value: '季度' },
              { label: '年度', value: '年度' },
            ]}
            placeholder="请选择预测周期"
          />
          <ProFormDatePicker
            name="forecastStartDate"
            label="预测开始日期"
            placeholder="请选择预测开始日期"
          />
          <ProFormDatePicker
            name="forecastEndDate"
            label="预测结束日期"
            placeholder="请选择预测结束日期"
          />
          <ProFormDigit
            name="forecastQuantity"
            label="预测数量"
            placeholder="请输入预测数量"
          />
          <ProFormDigit
            name="actualQuantity"
            label="实际数量"
            placeholder="请输入实际数量"
          />
          <ProFormDigit
            name="accuracyRate"
            label="准确率"
            placeholder="请输入准确率（百分比）"
            fieldProps={{
              precision: 2,
              min: 0,
              max: 100,
            }}
          />
          <ProFormSelect
            name="sharedStatus"
            label="共享状态"
            options={[
              { label: '未共享', value: '未共享' },
              { label: '已共享', value: '已共享' },
              { label: '已确认', value: '已确认' },
            ]}
            initialValue="未共享"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已发布', value: '已发布' },
              { label: '已确认', value: '已确认' },
              { label: '已取消', value: '已取消' },
            ]}
            initialValue="草稿"
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
        title="需求预测详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : forecastDetail ? (
          <ProDescriptions<DemandForecast>
            column={1}
            dataSource={forecastDetail}
            columns={[
              { title: '预测单编号', dataIndex: 'forecastNo' },
              { title: '预测名称', dataIndex: 'forecastName' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '供应商名称', dataIndex: 'supplierName' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '物料编码', dataIndex: 'materialCode' },
              { title: '预测周期', dataIndex: 'forecastPeriod' },
              { title: '预测开始日期', dataIndex: 'forecastStartDate', valueType: 'dateTime' },
              { title: '预测结束日期', dataIndex: 'forecastEndDate', valueType: 'dateTime' },
              { title: '预测数量', dataIndex: 'forecastQuantity' },
              { title: '实际数量', dataIndex: 'actualQuantity' },
              { title: '准确率', dataIndex: 'accuracyRate', render: (_, record) => record.accuracyRate ? `${record.accuracyRate}%` : '-' },
              { title: '共享状态', dataIndex: 'sharedStatus' },
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

export default DemandForecastsPage;

