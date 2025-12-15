/**
 * 质量预测分析管理页面
 * 
 * 提供质量预测分析的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { qualityPredictionAnalysisApi } from '../../services/process';
import type { QualityPredictionAnalysis, QualityPredictionAnalysisCreate, QualityPredictionAnalysisUpdate } from '../../types/process';

/**
 * 质量预测分析管理列表页面组件
 */
const QualityPredictionAnalysesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAnalysisUuid, setCurrentAnalysisUuid] = useState<string | null>(null);
  const [analysisDetail, setAnalysisDetail] = useState<QualityPredictionAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑质量预测分析）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建质量预测分析
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAnalysisUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      alertStatus: '正常',
      status: '草稿',
    });
  };

  /**
   * 处理编辑质量预测分析
   */
  const handleEdit = async (record: QualityPredictionAnalysis) => {
    try {
      setIsEdit(true);
      setCurrentAnalysisUuid(record.uuid);
      setModalVisible(true);
      
      // 获取质量预测分析详情
      const detail = await qualityPredictionAnalysisApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        analysisNo: detail.analysisNo,
        analysisName: detail.analysisName,
        predictionModel: detail.predictionModel,
        predictionPeriod: detail.predictionPeriod,
        predictionStartDate: detail.predictionStartDate,
        predictionEndDate: detail.predictionEndDate,
        predictionAccuracy: detail.predictionAccuracy,
        alertStatus: detail.alertStatus,
        alertLevel: detail.alertLevel,
        alertDescription: detail.alertDescription,
        riskLevel: detail.riskLevel,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取质量预测分析详情失败');
    }
  };

  /**
   * 处理删除质量预测分析
   */
  const handleDelete = async (record: QualityPredictionAnalysis) => {
    try {
      await qualityPredictionAnalysisApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: QualityPredictionAnalysis) => {
    try {
      setCurrentAnalysisUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await qualityPredictionAnalysisApi.get(record.uuid);
      setAnalysisDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取质量预测分析详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: QualityPredictionAnalysisCreate | QualityPredictionAnalysisUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAnalysisUuid) {
        await qualityPredictionAnalysisApi.update(currentAnalysisUuid, values as QualityPredictionAnalysisUpdate);
        messageApi.success('更新成功');
      } else {
        await qualityPredictionAnalysisApi.create(values as QualityPredictionAnalysisCreate);
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
  const columns: ProColumns<QualityPredictionAnalysis>[] = [
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
      title: '预测模型',
      dataIndex: 'predictionModel',
      width: 150,
      ellipsis: true,
    },
    {
      title: '预测周期',
      dataIndex: 'predictionPeriod',
      width: 100,
    },
    {
      title: '预测准确率',
      dataIndex: 'predictionAccuracy',
      width: 120,
      valueType: 'percent',
    },
    {
      title: '预警状态',
      dataIndex: 'alertStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '已预警': { text: <Tag color="orange">已预警</Tag> },
        '已处理': { text: <Tag color="blue">已处理</Tag> },
      },
    },
    {
      title: '预警等级',
      dataIndex: 'alertLevel',
      width: 100,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '低': { text: <Tag color="green">低</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '高': { text: <Tag color="red">高</Tag> },
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
            title="确定要删除这条质量预测分析吗？"
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
      <UniTable<QualityPredictionAnalysis>
        headerTitle="质量预测分析管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await qualityPredictionAnalysisApi.list({
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
            新建质量预测分析
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑质量预测分析' : '新建质量预测分析'}
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
          <ProFormText
            name="predictionModel"
            label="预测模型"
            placeholder="请输入预测模型"
          />
          <ProFormText
            name="predictionPeriod"
            label="预测周期"
            placeholder="请输入预测周期（日、周、月、年）"
          />
          <ProFormDatePicker
            name="predictionStartDate"
            label="预测开始日期"
            placeholder="请选择预测开始日期"
          />
          <ProFormDatePicker
            name="predictionEndDate"
            label="预测结束日期"
            placeholder="请选择预测结束日期"
          />
          <ProFormDigit
            name="predictionAccuracy"
            label="预测准确率（%）"
            placeholder="请输入预测准确率"
            min={0}
            max={100}
          />
          <ProFormSelect
            name="alertStatus"
            label="预警状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '已预警', value: '已预警' },
              { label: '已处理', value: '已处理' },
            ]}
            initialValue="正常"
          />
          <ProFormText
            name="alertLevel"
            label="预警等级"
            placeholder="请输入预警等级"
          />
          <ProFormTextArea
            name="alertDescription"
            label="预警描述"
            placeholder="请输入预警描述"
          />
          <ProFormSelect
            name="riskLevel"
            label="风险等级"
            options={[
              { label: '低', value: '低' },
              { label: '中', value: '中' },
              { label: '高', value: '高' },
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
        title="质量预测分析详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : analysisDetail ? (
          <ProDescriptions<QualityPredictionAnalysis>
            column={1}
            dataSource={analysisDetail}
            columns={[
              { title: '分析编号', dataIndex: 'analysisNo' },
              { title: '分析名称', dataIndex: 'analysisName' },
              { title: '预测模型', dataIndex: 'predictionModel' },
              { title: '预测周期', dataIndex: 'predictionPeriod' },
              { title: '预测开始日期', dataIndex: 'predictionStartDate', valueType: 'dateTime' },
              { title: '预测结束日期', dataIndex: 'predictionEndDate', valueType: 'dateTime' },
              { title: '预测准确率', dataIndex: 'predictionAccuracy', valueType: 'percent' },
              { title: '预警状态', dataIndex: 'alertStatus' },
              { title: '预警等级', dataIndex: 'alertLevel' },
              { title: '预警描述', dataIndex: 'alertDescription' },
              { title: '风险等级', dataIndex: 'riskLevel' },
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

export default QualityPredictionAnalysesPage;

