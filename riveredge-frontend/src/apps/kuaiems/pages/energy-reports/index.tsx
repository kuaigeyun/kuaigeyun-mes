/**
 * 能源报表管理页面
 * 
 * 提供能源报表的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { energyReportApi } from '../../services/process';
import type { EnergyReport, EnergyReportCreate, EnergyReportUpdate } from '../../types/process';

/**
 * 能源报表管理列表页面组件
 */
const EnergyReportsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentReportUuid, setCurrentReportUuid] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<EnergyReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑能源报表）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建能源报表
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReportUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      reportType: '能耗报表',
      status: '草稿',
    });
  };

  /**
   * 处理编辑能源报表
   */
  const handleEdit = async (record: EnergyReport) => {
    try {
      setIsEdit(true);
      setCurrentReportUuid(record.uuid);
      setModalVisible(true);
      
      // 获取能源报表详情
      const detail = await energyReportApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        reportNo: detail.reportNo,
        reportName: detail.reportName,
        reportType: detail.reportType,
        reportPeriod: detail.reportPeriod,
        reportStartDate: detail.reportStartDate,
        reportEndDate: detail.reportEndDate,
        energyType: detail.energyType,
        totalConsumption: detail.totalConsumption,
        totalCost: detail.totalCost,
        carbonEmission: detail.carbonEmission,
        reportData: detail.reportData,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取能源报表详情失败');
    }
  };

  /**
   * 处理删除能源报表
   */
  const handleDelete = async (record: EnergyReport) => {
    try {
      await energyReportApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: EnergyReport) => {
    try {
      setCurrentReportUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await energyReportApi.get(record.uuid);
      setReportDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取能源报表详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: EnergyReportCreate | EnergyReportUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentReportUuid) {
        await energyReportApi.update(currentReportUuid, values as EnergyReportUpdate);
        messageApi.success('更新成功');
      } else {
        await energyReportApi.create(values as EnergyReportCreate);
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
  const columns: ProColumns<EnergyReport>[] = [
    {
      title: '报表编号',
      dataIndex: 'reportNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reportNo}</a>
      ),
    },
    {
      title: '报表名称',
      dataIndex: 'reportName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '报表类型',
      dataIndex: 'reportType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '能耗报表': { text: '能耗报表' },
        '成本分析': { text: '成本分析' },
        '碳排放统计': { text: '碳排放统计' },
      },
    },
    {
      title: '报表周期',
      dataIndex: 'reportPeriod',
      width: 100,
    },
    {
      title: '能源类型',
      dataIndex: 'energyType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '电': { text: '电' },
        '水': { text: '水' },
        '气': { text: '气' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '总消耗量',
      dataIndex: 'totalConsumption',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      width: 120,
      valueType: 'money',
    },
    {
      title: '碳排放量',
      dataIndex: 'carbonEmission',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已生成': { text: <Tag color="blue">已生成</Tag> },
        '已发布': { text: <Tag color="green">已发布</Tag> },
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
            title="确定要删除这条能源报表吗？"
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
      <UniTable<EnergyReport>
        headerTitle="能源报表管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await energyReportApi.list({
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
            新建能源报表
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑能源报表' : '新建能源报表'}
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
            name="reportNo"
            label="报表编号"
            rules={[{ required: true, message: '请输入报表编号' }]}
            placeholder="请输入报表编号"
            disabled={isEdit}
          />
          <ProFormText
            name="reportName"
            label="报表名称"
            rules={[{ required: true, message: '请输入报表名称' }]}
            placeholder="请输入报表名称"
          />
          <ProFormSelect
            name="reportType"
            label="报表类型"
            options={[
              { label: '能耗报表', value: '能耗报表' },
              { label: '成本分析', value: '成本分析' },
              { label: '碳排放统计', value: '碳排放统计' },
            ]}
            rules={[{ required: true, message: '请选择报表类型' }]}
          />
          <ProFormText
            name="reportPeriod"
            label="报表周期"
            placeholder="请输入报表周期（日、周、月、年）"
          />
          <ProFormDatePicker
            name="reportStartDate"
            label="报表开始日期"
            placeholder="请选择报表开始日期"
          />
          <ProFormDatePicker
            name="reportEndDate"
            label="报表结束日期"
            placeholder="请选择报表结束日期"
          />
          <ProFormSelect
            name="energyType"
            label="能源类型"
            options={[
              { label: '电', value: '电' },
              { label: '水', value: '水' },
              { label: '气', value: '气' },
              { label: '其他', value: '其他' },
            ]}
          />
          <ProFormDigit
            name="totalConsumption"
            label="总消耗量"
            placeholder="请输入总消耗量"
            min={0}
          />
          <ProFormDigit
            name="totalCost"
            label="总成本（元）"
            placeholder="请输入总成本"
            min={0}
          />
          <ProFormDigit
            name="carbonEmission"
            label="碳排放量（吨）"
            placeholder="请输入碳排放量"
            min={0}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已生成', value: '已生成' },
              { label: '已发布', value: '已发布' },
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
        title="能源报表详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : reportDetail ? (
          <ProDescriptions<EnergyReport>
            column={1}
            dataSource={reportDetail}
            columns={[
              { title: '报表编号', dataIndex: 'reportNo' },
              { title: '报表名称', dataIndex: 'reportName' },
              { title: '报表类型', dataIndex: 'reportType' },
              { title: '报表周期', dataIndex: 'reportPeriod' },
              { title: '报表开始日期', dataIndex: 'reportStartDate', valueType: 'dateTime' },
              { title: '报表结束日期', dataIndex: 'reportEndDate', valueType: 'dateTime' },
              { title: '能源类型', dataIndex: 'energyType' },
              { title: '总消耗量', dataIndex: 'totalConsumption' },
              { title: '总成本', dataIndex: 'totalCost', valueType: 'money' },
              { title: '碳排放量', dataIndex: 'carbonEmission' },
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

export default EnergyReportsPage;

