/**
 * 质量指标管理页面
 * 
 * 提供质量指标的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { qualityIndicatorApi } from '../../services/process';
import type { QualityIndicator, QualityIndicatorCreate, QualityIndicatorUpdate } from '../../types/process';

/**
 * 质量指标管理列表页面组件
 */
const QualityIndicatorsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentIndicatorUuid, setCurrentIndicatorUuid] = useState<string | null>(null);
  const [indicatorDetail, setIndicatorDetail] = useState<QualityIndicator | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑指标）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建指标
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentIndicatorUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '启用',
      currentValue: 0,
    });
  };

  /**
   * 处理编辑指标
   */
  const handleEdit = async (record: QualityIndicator) => {
    try {
      setIsEdit(true);
      setCurrentIndicatorUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await qualityIndicatorApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        indicatorNo: detail.indicatorNo,
        indicatorName: detail.indicatorName,
        indicatorDescription: detail.indicatorDescription,
        indicatorType: detail.indicatorType,
        targetValue: detail.targetValue,
        currentValue: detail.currentValue,
        unit: detail.unit,
        calculationMethod: detail.calculationMethod,
        dataSource: detail.dataSource,
        monitoringFrequency: detail.monitoringFrequency,
        alertThreshold: detail.alertThreshold,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取指标详情失败');
    }
  };

  /**
   * 处理删除指标
   */
  const handleDelete = async (record: QualityIndicator) => {
    try {
      await qualityIndicatorApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: QualityIndicator) => {
    try {
      setCurrentIndicatorUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await qualityIndicatorApi.get(record.uuid);
      setIndicatorDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取指标详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: QualityIndicatorCreate | QualityIndicatorUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentIndicatorUuid) {
        await qualityIndicatorApi.update(currentIndicatorUuid, values as QualityIndicatorUpdate);
        messageApi.success('更新成功');
      } else {
        await qualityIndicatorApi.create(values as QualityIndicatorCreate);
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
  const columns: ProColumns<QualityIndicator>[] = [
    {
      title: '指标编号',
      dataIndex: 'indicatorNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.indicatorNo}</a>
      ),
    },
    {
      title: '指标名称',
      dataIndex: 'indicatorName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '指标类型',
      dataIndex: 'indicatorType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '合格率': { text: <Tag color="blue">合格率</Tag> },
        '不良率': { text: <Tag color="red">不良率</Tag> },
        '客户满意度': { text: <Tag color="green">客户满意度</Tag> },
        '其他': { text: <Tag color="default">其他</Tag> },
      },
    },
    {
      title: '目标值',
      dataIndex: 'targetValue',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
    },
    {
      title: '监控频率',
      dataIndex: 'monitoringFrequency',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '实时': { text: <Tag color="red">实时</Tag> },
        '每日': { text: <Tag color="orange">每日</Tag> },
        '每周': { text: <Tag color="blue">每周</Tag> },
        '每月': { text: <Tag color="green">每月</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="success">启用</Tag> },
        '停用': { text: <Tag color="default">停用</Tag> },
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
            title="确定要删除这条指标吗？"
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
      <UniTable<QualityIndicator>
        headerTitle="质量指标管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await qualityIndicatorApi.list({
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
            新建指标
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑质量指标' : '新建质量指标'}
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
            name="indicatorNo"
            label="指标编号"
            rules={[{ required: true, message: '请输入指标编号' }]}
            placeholder="请输入指标编号"
          />
          <ProFormText
            name="indicatorName"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
            placeholder="请输入指标名称"
          />
          <ProFormSelect
            name="indicatorType"
            label="指标类型"
            rules={[{ required: true, message: '请选择指标类型' }]}
            options={[
              { label: '合格率', value: '合格率' },
              { label: '不良率', value: '不良率' },
              { label: '客户满意度', value: '客户满意度' },
              { label: '其他', value: '其他' },
            ]}
          />
          <ProFormText
            name="targetValue"
            label="目标值"
            placeholder="请输入目标值"
          />
          <ProFormText
            name="currentValue"
            label="当前值"
            placeholder="请输入当前值"
          />
          <ProFormText
            name="unit"
            label="单位"
            placeholder="请输入单位"
          />
          <ProFormTextArea
            name="calculationMethod"
            label="计算方法"
            placeholder="请输入计算方法"
          />
          <ProFormText
            name="dataSource"
            label="数据来源"
            placeholder="请输入数据来源"
          />
          <ProFormSelect
            name="monitoringFrequency"
            label="监控频率"
            options={[
              { label: '实时', value: '实时' },
              { label: '每日', value: '每日' },
              { label: '每周', value: '每周' },
              { label: '每月', value: '每月' },
            ]}
          />
          <ProFormText
            name="alertThreshold"
            label="预警阈值"
            placeholder="请输入预警阈值"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="质量指标详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : indicatorDetail ? (
          <ProDescriptions<QualityIndicator>
            column={1}
            dataSource={indicatorDetail}
            columns={[
              { title: '指标编号', dataIndex: 'indicatorNo' },
              { title: '指标名称', dataIndex: 'indicatorName' },
              { title: '指标描述', dataIndex: 'indicatorDescription' },
              { title: '指标类型', dataIndex: 'indicatorType' },
              { title: '目标值', dataIndex: 'targetValue', valueType: 'digit' },
              { title: '当前值', dataIndex: 'currentValue', valueType: 'digit' },
              { title: '单位', dataIndex: 'unit' },
              { title: '计算方法', dataIndex: 'calculationMethod' },
              { title: '数据来源', dataIndex: 'dataSource' },
              { title: '监控频率', dataIndex: 'monitoringFrequency' },
              { title: '预警阈值', dataIndex: 'alertThreshold', valueType: 'digit' },
              { title: '状态', dataIndex: 'status' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default QualityIndicatorsPage;
