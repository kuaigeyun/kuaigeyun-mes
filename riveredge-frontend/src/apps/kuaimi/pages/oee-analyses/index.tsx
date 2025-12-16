/**
 * 设备综合效率分析管理页面
 * 
 * 提供设备综合效率分析的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { oeeAnalysisApi } from '../../services/process';
import type { OEEAnalysis, OEEAnalysisCreate, OEEAnalysisUpdate } from '../../types/process';

/**
 * 设备综合效率分析管理列表页面组件
 */
const OEEAnalysesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAnalysisUuid, setCurrentAnalysisUuid] = useState<string | null>(null);
  const [analysisDetail, setAnalysisDetail] = useState<OEEAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑设备综合效率分析）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建设备综合效率分析
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAnalysisUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
    });
  };

  /**
   * 处理编辑设备综合效率分析
   */
  const handleEdit = async (record: OEEAnalysis) => {
    try {
      setIsEdit(true);
      setCurrentAnalysisUuid(record.uuid);
      setModalVisible(true);
      
      // 获取设备综合效率分析详情
      const detail = await oeeAnalysisApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        analysisNo: detail.analysisNo,
        analysisName: detail.analysisName,
        deviceId: detail.deviceId,
        deviceName: detail.deviceName,
        analysisPeriod: detail.analysisPeriod,
        analysisStartDate: detail.analysisStartDate,
        analysisEndDate: detail.analysisEndDate,
        availability: detail.availability,
        performance: detail.performance,
        quality: detail.quality,
        oeeValue: detail.oeeValue,
        utilizationRate: detail.utilizationRate,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取设备综合效率分析详情失败');
    }
  };

  /**
   * 处理删除设备综合效率分析
   */
  const handleDelete = async (record: OEEAnalysis) => {
    try {
      await oeeAnalysisApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: OEEAnalysis) => {
    try {
      setCurrentAnalysisUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await oeeAnalysisApi.get(record.uuid);
      setAnalysisDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备综合效率分析详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: OEEAnalysisCreate | OEEAnalysisUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAnalysisUuid) {
        await oeeAnalysisApi.update(currentAnalysisUuid, values as OEEAnalysisUpdate);
        messageApi.success('更新成功');
      } else {
        await oeeAnalysisApi.create(values as OEEAnalysisCreate);
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
  const columns: ProColumns<OEEAnalysis>[] = [
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
      title: '设备名称',
      dataIndex: 'deviceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '分析周期',
      dataIndex: 'analysisPeriod',
      width: 100,
    },
    {
      title: '可用率',
      dataIndex: 'availability',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '性能率',
      dataIndex: 'performance',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '质量率',
      dataIndex: 'quality',
      width: 100,
      valueType: 'percent',
    },
    {
      title: 'OEE值',
      dataIndex: 'oeeValue',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '利用率',
      dataIndex: 'utilizationRate',
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
            title="确定要删除这条设备综合效率分析吗？"
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
      <UniTable<OEEAnalysis>
        headerTitle="设备综合效率分析管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await oeeAnalysisApi.list({
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
            新建设备综合效率分析
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑设备综合效率分析' : '新建设备综合效率分析'}
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
          <ProFormDigit
            name="deviceId"
            label="设备ID"
            placeholder="请输入设备ID"
          />
          <ProFormText
            name="deviceName"
            label="设备名称"
            placeholder="请输入设备名称"
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
            name="availability"
            label="可用率（%）"
            placeholder="请输入可用率"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="performance"
            label="性能率（%）"
            placeholder="请输入性能率"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="quality"
            label="质量率（%）"
            placeholder="请输入质量率"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="oeeValue"
            label="OEE值（%）"
            placeholder="请输入OEE值"
            min={0}
            max={100}
          />
          <ProFormDigit
            name="utilizationRate"
            label="利用率（%）"
            placeholder="请输入利用率"
            min={0}
            max={100}
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
        title="设备综合效率分析详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : analysisDetail ? (
          <ProDescriptions<OEEAnalysis>
            column={1}
            dataSource={analysisDetail}
            columns={[
              { title: '分析编号', dataIndex: 'analysisNo' },
              { title: '分析名称', dataIndex: 'analysisName' },
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '设备名称', dataIndex: 'deviceName' },
              { title: '分析周期', dataIndex: 'analysisPeriod' },
              { title: '分析开始日期', dataIndex: 'analysisStartDate', valueType: 'dateTime' },
              { title: '分析结束日期', dataIndex: 'analysisEndDate', valueType: 'dateTime' },
              { title: '可用率', dataIndex: 'availability', valueType: 'percent' },
              { title: '性能率', dataIndex: 'performance', valueType: 'percent' },
              { title: '质量率', dataIndex: 'quality', valueType: 'percent' },
              { title: 'OEE值', dataIndex: 'oeeValue', valueType: 'percent' },
              { title: '利用率', dataIndex: 'utilizationRate', valueType: 'percent' },
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

export default OEEAnalysesPage;

