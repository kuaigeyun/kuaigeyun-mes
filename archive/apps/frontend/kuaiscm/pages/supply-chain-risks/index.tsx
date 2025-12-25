/**
 * 供应链风险管理页面
 * 
 * 提供供应链风险的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { supplyChainRiskApi } from '../../services/process';
import type { SupplyChainRisk, SupplyChainRiskCreate, SupplyChainRiskUpdate } from '../../types/process';

/**
 * 供应链风险管理列表页面组件
 */
const SupplyChainRisksPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRiskUuid, setCurrentRiskUuid] = useState<string | null>(null);
  const [riskDetail, setRiskDetail] = useState<SupplyChainRisk | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑供应链风险）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建供应链风险
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentRiskUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      riskLevel: '中',
      warningStatus: '未预警',
      status: '待评估',
    });
  };

  /**
   * 处理编辑供应链风险
   */
  const handleEdit = async (record: SupplyChainRisk) => {
    try {
      setIsEdit(true);
      setCurrentRiskUuid(record.uuid);
      setModalVisible(true);
      
      // 获取供应链风险详情
      const detail = await supplyChainRiskApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        riskNo: detail.riskNo,
        riskName: detail.riskName,
        riskType: detail.riskType,
        riskCategory: detail.riskCategory,
        supplierId: detail.supplierId,
        supplierName: detail.supplierName,
        riskLevel: detail.riskLevel,
        riskProbability: detail.riskProbability,
        riskImpact: detail.riskImpact,
        riskDescription: detail.riskDescription,
        warningStatus: detail.warningStatus,
        contingencyPlan: detail.contingencyPlan,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取供应链风险详情失败');
    }
  };

  /**
   * 处理删除供应链风险
   */
  const handleDelete = async (record: SupplyChainRisk) => {
    try {
      await supplyChainRiskApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SupplyChainRisk) => {
    try {
      setCurrentRiskUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await supplyChainRiskApi.get(record.uuid);
      setRiskDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取供应链风险详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SupplyChainRiskCreate | SupplyChainRiskUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentRiskUuid) {
        await supplyChainRiskApi.update(currentRiskUuid, values as SupplyChainRiskUpdate);
        messageApi.success('更新成功');
      } else {
        await supplyChainRiskApi.create(values as SupplyChainRiskCreate);
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
  const columns: ProColumns<SupplyChainRisk>[] = [
    {
      title: '风险编号',
      dataIndex: 'riskNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.riskNo}</a>
      ),
    },
    {
      title: '风险名称',
      dataIndex: 'riskName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '风险类型',
      dataIndex: 'riskType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '供应商风险': { text: '供应商风险' },
        '物流风险': { text: '物流风险' },
        '市场风险': { text: '市场风险' },
      },
    },
    {
      title: '风险分类',
      dataIndex: 'riskCategory',
      width: 120,
      ellipsis: true,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplierName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="green">低</Tag> },
      },
    },
    {
      title: '风险概率',
      dataIndex: 'riskProbability',
      width: 100,
      render: (_, record) => {
        if (record.riskProbability !== null && record.riskProbability !== undefined) {
          return `${record.riskProbability}%`;
        }
        return '-';
      },
    },
    {
      title: '风险影响',
      dataIndex: 'riskImpact',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="green">低</Tag> },
      },
    },
    {
      title: '预警状态',
      dataIndex: 'warningStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '未预警': { text: <Tag color="default">未预警</Tag> },
        '已预警': { text: <Tag color="orange">已预警</Tag> },
        '已处理': { text: <Tag color="green">已处理</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待评估': { text: <Tag color="blue">待评估</Tag> },
        '评估中': { text: <Tag color="orange">评估中</Tag> },
        '已评估': { text: <Tag color="green">已评估</Tag> },
        '已处理': { text: <Tag color="green">已处理</Tag> },
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
            title="确定要删除这条供应链风险吗？"
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
      <UniTable<SupplyChainRisk>
        headerTitle="供应链风险管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await supplyChainRiskApi.list({
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
            新建供应链风险
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑供应链风险' : '新建供应链风险'}
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
            name="riskNo"
            label="风险编号"
            rules={[{ required: true, message: '请输入风险编号' }]}
            placeholder="请输入风险编号"
          />
          <ProFormText
            name="riskName"
            label="风险名称"
            rules={[{ required: true, message: '请输入风险名称' }]}
            placeholder="请输入风险名称"
          />
          <ProFormSelect
            name="riskType"
            label="风险类型"
            options={[
              { label: '供应商风险', value: '供应商风险' },
              { label: '物流风险', value: '物流风险' },
              { label: '市场风险', value: '市场风险' },
            ]}
            rules={[{ required: true, message: '请选择风险类型' }]}
          />
          <ProFormText
            name="riskCategory"
            label="风险分类"
            placeholder="请输入风险分类"
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
          <ProFormSelect
            name="riskLevel"
            label="风险等级"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
            initialValue="中"
          />
          <ProFormDigit
            name="riskProbability"
            label="风险概率"
            placeholder="请输入风险概率（百分比）"
            fieldProps={{
              precision: 2,
              min: 0,
              max: 100,
            }}
          />
          <ProFormSelect
            name="riskImpact"
            label="风险影响"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
            placeholder="请选择风险影响"
          />
          <ProFormTextArea
            name="riskDescription"
            label="风险描述"
            placeholder="请输入风险描述"
          />
          <ProFormSelect
            name="warningStatus"
            label="预警状态"
            options={[
              { label: '未预警', value: '未预警' },
              { label: '已预警', value: '已预警' },
              { label: '已处理', value: '已处理' },
            ]}
            initialValue="未预警"
          />
          <ProFormTextArea
            name="contingencyPlan"
            label="应急预案"
            placeholder="请输入应急预案（JSON格式）"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '待评估', value: '待评估' },
              { label: '评估中', value: '评估中' },
              { label: '已评估', value: '已评估' },
              { label: '已处理', value: '已处理' },
            ]}
            initialValue="待评估"
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
        title="供应链风险详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : riskDetail ? (
          <ProDescriptions<SupplyChainRisk>
            column={1}
            dataSource={riskDetail}
            columns={[
              { title: '风险编号', dataIndex: 'riskNo' },
              { title: '风险名称', dataIndex: 'riskName' },
              { title: '风险类型', dataIndex: 'riskType' },
              { title: '风险分类', dataIndex: 'riskCategory' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '供应商名称', dataIndex: 'supplierName' },
              { title: '风险等级', dataIndex: 'riskLevel' },
              { title: '风险概率', dataIndex: 'riskProbability', render: (_, record) => record.riskProbability ? `${record.riskProbability}%` : '-' },
              { title: '风险影响', dataIndex: 'riskImpact' },
              { title: '风险描述', dataIndex: 'riskDescription' },
              { title: '预警状态', dataIndex: 'warningStatus' },
              { title: '应急预案', dataIndex: 'contingencyPlan', render: (_, record) => record.contingencyPlan ? JSON.stringify(record.contingencyPlan) : '-' },
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

export default SupplyChainRisksPage;

