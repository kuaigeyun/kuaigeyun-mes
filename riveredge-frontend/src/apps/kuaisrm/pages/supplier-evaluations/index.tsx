/**
 * 供应商评估管理页面
 * 
 * 提供供应商评估的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { supplierEvaluationApi } from '../../services/process';
import type { SupplierEvaluation, SupplierEvaluationCreate, SupplierEvaluationUpdate } from '../../types/process';

/**
 * 供应商评估管理列表页面组件
 */
const SupplierEvaluationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentEvaluationUuid, setCurrentEvaluationUuid] = useState<string | null>(null);
  const [evaluationDetail, setEvaluationDetail] = useState<SupplierEvaluation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑评估）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建评估
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEvaluationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑评估
   */
  const handleEdit = async (record: SupplierEvaluation) => {
    try {
      setIsEdit(true);
      setCurrentEvaluationUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await supplierEvaluationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        evaluationNo: detail.evaluationNo,
        supplierId: detail.supplierId,
        evaluationPeriod: detail.evaluationPeriod,
        evaluationDate: detail.evaluationDate,
        qualityScore: detail.qualityScore,
        deliveryScore: detail.deliveryScore,
        priceScore: detail.priceScore,
        serviceScore: detail.serviceScore,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取评估详情失败');
    }
  };

  /**
   * 处理删除评估
   */
  const handleDelete = async (record: SupplierEvaluation) => {
    try {
      await supplierEvaluationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SupplierEvaluation) => {
    try {
      setCurrentEvaluationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await supplierEvaluationApi.get(record.uuid);
      setEvaluationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取评估详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SupplierEvaluationCreate | SupplierEvaluationUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentEvaluationUuid) {
        await supplierEvaluationApi.update(currentEvaluationUuid, values as SupplierEvaluationUpdate);
        messageApi.success('更新成功');
      } else {
        await supplierEvaluationApi.create(values as SupplierEvaluationCreate);
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
  const columns: ProColumns<SupplierEvaluation>[] = [
    {
      title: '评估编号',
      dataIndex: 'evaluationNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.evaluationNo}</a>
      ),
    },
    {
      title: '供应商ID',
      dataIndex: 'supplierId',
      width: 100,
    },
    {
      title: '评估周期',
      dataIndex: 'evaluationPeriod',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '月度': { text: '月度' },
        '季度': { text: '季度' },
        '年度': { text: '年度' },
      },
    },
    {
      title: '评估日期',
      dataIndex: 'evaluationDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '综合评分',
      dataIndex: 'totalScore',
      width: 100,
      sorter: true,
      render: (score) => (
        <Tag color={score >= 90 ? 'green' : score >= 80 ? 'blue' : score >= 70 ? 'orange' : 'red'}>
          {score}分
        </Tag>
      ),
    },
    {
      title: '评估等级',
      dataIndex: 'evaluationLevel',
      width: 100,
      render: (level) => {
        if (!level) return '-';
        const levelMap: Record<string, { color: string; text: string }> = {
          'A': { color: 'green', text: 'A级' },
          'B': { color: 'blue', text: 'B级' },
          'C': { color: 'orange', text: 'C级' },
          'D': { color: 'red', text: 'D级' },
        };
        const info = levelMap[level] || { color: 'default', text: level };
        return <Tag color={info.color}>{info.text}</Tag>;
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
            title="确定要删除这条评估吗？"
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
      <UniTable<SupplierEvaluation>
        headerTitle="供应商评估管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await supplierEvaluationApi.list({
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
            新建评估
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑供应商评估' : '新建供应商评估'}
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
            name="evaluationNo"
            label="评估编号"
            rules={[{ required: true, message: '请输入评估编号' }]}
            placeholder="请输入评估编号"
          />
          <ProFormText
            name="supplierId"
            label="供应商ID"
            rules={[{ required: true, message: '请输入供应商ID' }]}
            placeholder="请输入供应商ID"
          />
          <ProFormSelect
            name="evaluationPeriod"
            label="评估周期"
            options={[
              { label: '月度', value: '月度' },
              { label: '季度', value: '季度' },
              { label: '年度', value: '年度' },
            ]}
            rules={[{ required: true, message: '请选择评估周期' }]}
          />
          <ProFormDatePicker
            name="evaluationDate"
            label="评估日期"
            rules={[{ required: true, message: '请选择评估日期' }]}
          />
          <ProFormDigit
            name="qualityScore"
            label="质量评分"
            min={0}
            max={100}
            placeholder="请输入质量评分（0-100）"
          />
          <ProFormDigit
            name="deliveryScore"
            label="交期评分"
            min={0}
            max={100}
            placeholder="请输入交期评分（0-100）"
          />
          <ProFormDigit
            name="priceScore"
            label="价格评分"
            min={0}
            max={100}
            placeholder="请输入价格评分（0-100）"
          />
          <ProFormDigit
            name="serviceScore"
            label="服务评分"
            min={0}
            max={100}
            placeholder="请输入服务评分（0-100）"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="供应商评估详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : evaluationDetail ? (
          <ProDescriptions<SupplierEvaluation>
            column={1}
            dataSource={evaluationDetail}
            columns={[
              { title: '评估编号', dataIndex: 'evaluationNo' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '评估周期', dataIndex: 'evaluationPeriod' },
              { title: '评估日期', dataIndex: 'evaluationDate', valueType: 'dateTime' },
              { title: '质量评分', dataIndex: 'qualityScore' },
              { title: '交期评分', dataIndex: 'deliveryScore' },
              { title: '价格评分', dataIndex: 'priceScore' },
              { title: '服务评分', dataIndex: 'serviceScore' },
              { title: '综合评分', dataIndex: 'totalScore' },
              { title: '评估等级', dataIndex: 'evaluationLevel' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default SupplierEvaluationsPage;
