/**
 * 质量目标管理页面
 * 
 * 提供质量目标的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { qualityObjectiveApi } from '../../services/process';
import type { QualityObjective, QualityObjectiveCreate, QualityObjectiveUpdate } from '../../types/process';

/**
 * 质量目标管理列表页面组件
 */
const QualityObjectivesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentObjectiveUuid, setCurrentObjectiveUuid] = useState<string | null>(null);
  const [objectiveDetail, setObjectiveDetail] = useState<QualityObjective | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑目标）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建目标
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentObjectiveUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '进行中',
      currentValue: 0,
      achievementRate: 0,
    });
  };

  /**
   * 处理编辑目标
   */
  const handleEdit = async (record: QualityObjective) => {
    try {
      setIsEdit(true);
      setCurrentObjectiveUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await qualityObjectiveApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        objectiveNo: detail.objectiveNo,
        objectiveName: detail.objectiveName,
        objectiveDescription: detail.objectiveDescription,
        targetValue: detail.targetValue,
        currentValue: detail.currentValue,
        unit: detail.unit,
        period: detail.period,
        periodStartDate: detail.periodStartDate,
        periodEndDate: detail.periodEndDate,
        responsiblePersonName: detail.responsiblePersonName,
        achievementRate: detail.achievementRate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取目标详情失败');
    }
  };

  /**
   * 处理删除目标
   */
  const handleDelete = async (record: QualityObjective) => {
    try {
      await qualityObjectiveApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: QualityObjective) => {
    try {
      setCurrentObjectiveUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await qualityObjectiveApi.get(record.uuid);
      setObjectiveDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取目标详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: QualityObjectiveCreate | QualityObjectiveUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentObjectiveUuid) {
        await qualityObjectiveApi.update(currentObjectiveUuid, values as QualityObjectiveUpdate);
        messageApi.success('更新成功');
      } else {
        await qualityObjectiveApi.create(values as QualityObjectiveCreate);
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
  const columns: ProColumns<QualityObjective>[] = [
    {
      title: '目标编号',
      dataIndex: 'objectiveNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.objectiveNo}</a>
      ),
    },
    {
      title: '目标名称',
      dataIndex: 'objectiveName',
      width: 200,
      ellipsis: true,
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
      title: '周期',
      dataIndex: 'period',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '年度': { text: <Tag color="blue">年度</Tag> },
        '季度': { text: <Tag color="green">季度</Tag> },
        '月度': { text: <Tag color="purple">月度</Tag> },
      },
    },
    {
      title: '达成率',
      dataIndex: 'achievementRate',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '负责人',
      dataIndex: 'responsiblePersonName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '进行中': { text: <Tag color="processing">进行中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '未达成': { text: <Tag color="error">未达成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
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
            title="确定要删除这条目标吗？"
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
      <UniTable<QualityObjective>
        headerTitle="质量目标管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await qualityObjectiveApi.list({
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
            新建目标
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑质量目标' : '新建质量目标'}
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
            name="objectiveNo"
            label="目标编号"
            rules={[{ required: true, message: '请输入目标编号' }]}
            placeholder="请输入目标编号"
          />
          <ProFormText
            name="objectiveName"
            label="目标名称"
            rules={[{ required: true, message: '请输入目标名称' }]}
            placeholder="请输入目标名称"
          />
          <ProFormText
            name="targetValue"
            label="目标值"
            rules={[{ required: true, message: '请输入目标值' }]}
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
          <ProFormSelect
            name="period"
            label="周期"
            rules={[{ required: true, message: '请选择周期' }]}
            options={[
              { label: '年度', value: '年度' },
              { label: '季度', value: '季度' },
              { label: '月度', value: '月度' },
            ]}
          />
          <ProFormDatePicker
            name="periodStartDate"
            label="周期开始日期"
            placeholder="请选择周期开始日期"
          />
          <ProFormDatePicker
            name="periodEndDate"
            label="周期结束日期"
            placeholder="请选择周期结束日期"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="质量目标详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : objectiveDetail ? (
          <ProDescriptions<QualityObjective>
            column={1}
            dataSource={objectiveDetail}
            columns={[
              { title: '目标编号', dataIndex: 'objectiveNo' },
              { title: '目标名称', dataIndex: 'objectiveName' },
              { title: '目标描述', dataIndex: 'objectiveDescription' },
              { title: '目标值', dataIndex: 'targetValue', valueType: 'digit' },
              { title: '当前值', dataIndex: 'currentValue', valueType: 'digit' },
              { title: '单位', dataIndex: 'unit' },
              { title: '周期', dataIndex: 'period' },
              { title: '达成率', dataIndex: 'achievementRate', valueType: 'percent' },
              { title: '负责人', dataIndex: 'responsiblePersonName' },
              { title: '周期开始日期', dataIndex: 'periodStartDate', valueType: 'dateTime' },
              { title: '周期结束日期', dataIndex: 'periodEndDate', valueType: 'dateTime' },
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

export default QualityObjectivesPage;
