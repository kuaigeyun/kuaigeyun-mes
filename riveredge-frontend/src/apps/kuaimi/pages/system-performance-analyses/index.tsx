/**
 * 系统应用绩效分析管理页面
 * 
 * 提供系统应用绩效分析的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { systemPerformanceAnalysisApi } from '../../services/process';
import type { SystemPerformanceAnalysis, SystemPerformanceAnalysisCreate, SystemPerformanceAnalysisUpdate } from '../../types/process';

/**
 * 系统应用绩效分析管理列表页面组件
 */
const SystemPerformanceAnalysesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAnalysisUuid, setCurrentAnalysisUuid] = useState<string | null>(null);
  const [analysisDetail, setAnalysisDetail] = useState<SystemPerformanceAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑系统应用绩效分析）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建系统应用绩效分析
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAnalysisUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      analysisType: '使用效果统计',
      status: '草稿',
    });
  };

  /**
   * 处理编辑系统应用绩效分析
   */
  const handleEdit = async (record: SystemPerformanceAnalysis) => {
    try {
      setIsEdit(true);
      setCurrentAnalysisUuid(record.uuid);
      setModalVisible(true);
      
      // 获取系统应用绩效分析详情
      const detail = await systemPerformanceAnalysisApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        analysisNo: detail.analysisNo,
        analysisName: detail.analysisName,
        analysisType: detail.analysisType,
        analysisPeriod: detail.analysisPeriod,
        moduleUsageRate: detail.moduleUsageRate,
        functionUsageFrequency: detail.functionUsageFrequency,
        userActivityRate: detail.userActivityRate,
        processEfficiencyImprovement: detail.processEfficiencyImprovement,
        processTimeReduction: detail.processTimeReduction,
        processCostReduction: detail.processCostReduction,
        roiValue: detail.roiValue,
        costSaving: detail.costSaving,
        efficiencyImprovement: detail.efficiencyImprovement,
        beforeAfterComparison: detail.beforeAfterComparison,
        improvementQuantification: detail.improvementQuantification,
        valueContribution: detail.valueContribution,
        optimizationSuggestions: detail.optimizationSuggestions,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取系统应用绩效分析详情失败');
    }
  };

  /**
   * 处理删除系统应用绩效分析
   */
  const handleDelete = async (record: SystemPerformanceAnalysis) => {
    try {
      await systemPerformanceAnalysisApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SystemPerformanceAnalysis) => {
    try {
      setCurrentAnalysisUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await systemPerformanceAnalysisApi.get(record.uuid);
      setAnalysisDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取系统应用绩效分析详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SystemPerformanceAnalysisCreate | SystemPerformanceAnalysisUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAnalysisUuid) {
        await systemPerformanceAnalysisApi.update(currentAnalysisUuid, values as SystemPerformanceAnalysisUpdate);
        messageApi.success('更新成功');
      } else {
        await systemPerformanceAnalysisApi.create(values as SystemPerformanceAnalysisCreate);
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
  const columns: ProColumns<SystemPerformanceAnalysis>[] = [
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
      width: 150,
      valueType: 'select',
      valueEnum: {
        '使用效果统计': { text: '使用效果统计' },
        '流程改善分析': { text: '流程改善分析' },
        '系统ROI分析': { text: '系统ROI分析' },
        '应用价值评估': { text: '应用价值评估' },
        '系统优化建议': { text: '系统优化建议' },
      },
    },
    {
      title: '分析周期',
      dataIndex: 'analysisPeriod',
      width: 100,
    },
    {
      title: '模块使用率',
      dataIndex: 'moduleUsageRate',
      width: 120,
      valueType: 'percent',
    },
    {
      title: '用户活跃度',
      dataIndex: 'userActivityRate',
      width: 120,
      valueType: 'percent',
    },
    {
      title: 'ROI值',
      dataIndex: 'roiValue',
      width: 100,
      valueType: 'percent',
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
            title="确定要删除这条系统应用绩效分析吗？"
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
      <UniTable<SystemPerformanceAnalysis>
        headerTitle="系统应用绩效分析管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await systemPerformanceAnalysisApi.list({
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
            新建系统应用绩效分析
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑系统应用绩效分析' : '新建系统应用绩效分析'}
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
              { label: '使用效果统计', value: '使用效果统计' },
              { label: '流程改善分析', value: '流程改善分析' },
              { label: '系统ROI分析', value: '系统ROI分析' },
              { label: '应用价值评估', value: '应用价值评估' },
              { label: '系统优化建议', value: '系统优化建议' },
            ]}
            rules={[{ required: true, message: '请选择分析类型' }]}
          />
          <ProFormText
            name="analysisPeriod"
            label="分析周期"
            placeholder="请输入分析周期（日、周、月、年）"
          />
          <ProFormDigit
            name="moduleUsageRate"
            label="模块使用率（%）"
            placeholder="请输入模块使用率"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="functionUsageFrequency"
            label="功能使用频率"
            placeholder="请输入功能使用频率"
            min={0}
          />
          <ProFormDigit
            name="userActivityRate"
            label="用户活跃度（%）"
            placeholder="请输入用户活跃度"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="processEfficiencyImprovement"
            label="流程效率提升（%）"
            placeholder="请输入流程效率提升"
            min={0}
          />
          <ProFormDigit
            name="processTimeReduction"
            label="流程时间缩短（小时）"
            placeholder="请输入流程时间缩短"
            min={0}
          />
          <ProFormDigit
            name="processCostReduction"
            label="流程成本降低（元）"
            placeholder="请输入流程成本降低"
            min={0}
          />
          <ProFormDigit
            name="roiValue"
            label="ROI值（%）"
            placeholder="请输入ROI值"
            min={0}
          />
          <ProFormDigit
            name="costSaving"
            label="成本节约（元）"
            placeholder="请输入成本节约"
            min={0}
          />
          <ProFormDigit
            name="efficiencyImprovement"
            label="效率提升（%）"
            placeholder="请输入效率提升"
            min={0}
          />
          <ProFormTextArea
            name="optimizationSuggestions"
            label="优化建议"
            placeholder="请输入优化建议"
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
        title="系统应用绩效分析详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : analysisDetail ? (
          <ProDescriptions<SystemPerformanceAnalysis>
            column={1}
            dataSource={analysisDetail}
            columns={[
              { title: '分析编号', dataIndex: 'analysisNo' },
              { title: '分析名称', dataIndex: 'analysisName' },
              { title: '分析类型', dataIndex: 'analysisType' },
              { title: '分析周期', dataIndex: 'analysisPeriod' },
              { title: '模块使用率', dataIndex: 'moduleUsageRate', valueType: 'percent' },
              { title: '功能使用频率', dataIndex: 'functionUsageFrequency' },
              { title: '用户活跃度', dataIndex: 'userActivityRate', valueType: 'percent' },
              { title: '流程效率提升', dataIndex: 'processEfficiencyImprovement' },
              { title: '流程时间缩短', dataIndex: 'processTimeReduction' },
              { title: '流程成本降低', dataIndex: 'processCostReduction' },
              { title: 'ROI值', dataIndex: 'roiValue', valueType: 'percent' },
              { title: '成本节约', dataIndex: 'costSaving' },
              { title: '效率提升', dataIndex: 'efficiencyImprovement' },
              { title: '优化建议', dataIndex: 'optimizationSuggestions' },
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

export default SystemPerformanceAnalysesPage;

