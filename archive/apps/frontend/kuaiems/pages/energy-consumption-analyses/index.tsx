/**
 * 能耗分析管理页面
 * 
 * 提供能耗分析的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { energyConsumptionAnalysisApi } from '../../services/process';
import type { EnergyConsumptionAnalysis, EnergyConsumptionAnalysisCreate, EnergyConsumptionAnalysisUpdate } from '../../types/process';

/**
 * 能耗分析管理列表页面组件
 */
const EnergyConsumptionAnalysesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAnalysisUuid, setCurrentAnalysisUuid] = useState<string | null>(null);
  const [analysisDetail, setAnalysisDetail] = useState<EnergyConsumptionAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑能耗分析）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建能耗分析
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAnalysisUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      analysisType: '能耗统计',
      status: '草稿',
    });
  };

  /**
   * 处理编辑能耗分析
   */
  const handleEdit = async (record: EnergyConsumptionAnalysis) => {
    try {
      setIsEdit(true);
      setCurrentAnalysisUuid(record.uuid);
      setModalVisible(true);
      
      // 获取能耗分析详情
      const detail = await energyConsumptionAnalysisApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        analysisNo: detail.analysisNo,
        analysisName: detail.analysisName,
        analysisType: detail.analysisType,
        energyType: detail.energyType,
        analysisPeriod: detail.analysisPeriod,
        analysisStartDate: detail.analysisStartDate,
        analysisEndDate: detail.analysisEndDate,
        totalConsumption: detail.totalConsumption,
        averageConsumption: detail.averageConsumption,
        peakConsumption: detail.peakConsumption,
        consumptionTrend: detail.consumptionTrend,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取能耗分析详情失败');
    }
  };

  /**
   * 处理删除能耗分析
   */
  const handleDelete = async (record: EnergyConsumptionAnalysis) => {
    try {
      await energyConsumptionAnalysisApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: EnergyConsumptionAnalysis) => {
    try {
      setCurrentAnalysisUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await energyConsumptionAnalysisApi.get(record.uuid);
      setAnalysisDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取能耗分析详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: EnergyConsumptionAnalysisCreate | EnergyConsumptionAnalysisUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAnalysisUuid) {
        await energyConsumptionAnalysisApi.update(currentAnalysisUuid, values as EnergyConsumptionAnalysisUpdate);
        messageApi.success('更新成功');
      } else {
        await energyConsumptionAnalysisApi.create(values as EnergyConsumptionAnalysisCreate);
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
  const columns: ProColumns<EnergyConsumptionAnalysis>[] = [
    {
      title: '分析编号',
      dataIndex: 'analysisNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.analysisNo}</a>
      ),
    },
    {
      title: '分析名称',
      dataIndex: 'analysisName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '分析类型',
      dataIndex: 'analysisType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '能耗统计': { text: '能耗统计' },
        '能耗对比': { text: '能耗对比' },
        '能耗趋势': { text: '能耗趋势' },
      },
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
      title: '分析周期',
      dataIndex: 'analysisPeriod',
      width: 100,
    },
    {
      title: '总消耗量',
      dataIndex: 'totalConsumption',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '平均消耗量',
      dataIndex: 'averageConsumption',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '峰值消耗量',
      dataIndex: 'peakConsumption',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '消耗趋势',
      dataIndex: 'consumptionTrend',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '上升': { text: <Tag color="red">上升</Tag> },
        '下降': { text: <Tag color="green">下降</Tag> },
        '平稳': { text: <Tag color="default">平稳</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
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
            title="确定要删除这条能耗分析吗？"
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
      <UniTable<EnergyConsumptionAnalysis>
        headerTitle="能耗分析管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await energyConsumptionAnalysisApi.list({
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
            新建能耗分析
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑能耗分析' : '新建能耗分析'}
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
            name="analysisNo"
            label="分析编号"
            rules={[{ required: true, message: '请输入分析编号' }]}
            placeholder="请输入分析编号"
            disabled={isEdit}
          />
          <ProFormText
            name="analysisName"
            label="分析名称"
            rules={[{ required: true, message: '请输入分析名称' }]}
            placeholder="请输入分析名称"
          />
          <ProFormSelect
            name="analysisType"
            label="分析类型"
            options={[
              { label: '能耗统计', value: '能耗统计' },
              { label: '能耗对比', value: '能耗对比' },
              { label: '能耗趋势', value: '能耗趋势' },
            ]}
            rules={[{ required: true, message: '请选择分析类型' }]}
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
          <ProFormText
            name="analysisPeriod"
            label="分析周期"
            placeholder="请输入分析周期（日、周、月、年）"
          />
          <ProFormDatePicker
            name="analysisStartDate"
            label="分析开始日期"
            placeholder="请选择分析开始日期"
          />
          <ProFormDatePicker
            name="analysisEndDate"
            label="分析结束日期"
            placeholder="请选择分析结束日期"
          />
          <ProFormDigit
            name="totalConsumption"
            label="总消耗量"
            placeholder="请输入总消耗量"
            min={0}
          />
          <ProFormDigit
            name="averageConsumption"
            label="平均消耗量"
            placeholder="请输入平均消耗量"
            min={0}
          />
          <ProFormDigit
            name="peakConsumption"
            label="峰值消耗量"
            placeholder="请输入峰值消耗量"
            min={0}
          />
          <ProFormSelect
            name="consumptionTrend"
            label="消耗趋势"
            options={[
              { label: '上升', value: '上升' },
              { label: '下降', value: '下降' },
              { label: '平稳', value: '平稳' },
            ]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已完成', value: '已完成' },
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
        title="能耗分析详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : analysisDetail ? (
          <ProDescriptions<EnergyConsumptionAnalysis>
            column={1}
            dataSource={analysisDetail}
            columns={[
              { title: '分析编号', dataIndex: 'analysisNo' },
              { title: '分析名称', dataIndex: 'analysisName' },
              { title: '分析类型', dataIndex: 'analysisType' },
              { title: '能源类型', dataIndex: 'energyType' },
              { title: '分析周期', dataIndex: 'analysisPeriod' },
              { title: '分析开始日期', dataIndex: 'analysisStartDate', valueType: 'dateTime' },
              { title: '分析结束日期', dataIndex: 'analysisEndDate', valueType: 'dateTime' },
              { title: '总消耗量', dataIndex: 'totalConsumption' },
              { title: '平均消耗量', dataIndex: 'averageConsumption' },
              { title: '峰值消耗量', dataIndex: 'peakConsumption' },
              { title: '消耗趋势', dataIndex: 'consumptionTrend' },
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

export default EnergyConsumptionAnalysesPage;

