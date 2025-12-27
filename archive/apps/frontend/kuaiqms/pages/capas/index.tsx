/**
 * CAPA管理页面
 * 
 * 提供CAPA的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { capaApi } from '../../services/process';
import type { CAPA, CAPACreate, CAPAUpdate } from '../../types/process';

/**
 * CAPA管理列表页面组件
 */
const CAPAsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentCapaUuid, setCurrentCapaUuid] = useState<string | null>(null);
  const [capaDetail, setCapaDetail] = useState<CAPA | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑CAPA）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建CAPA
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCapaUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '待执行',
    });
  };

  /**
   * 处理编辑CAPA
   */
  const handleEdit = async (record: CAPA) => {
    try {
      setIsEdit(true);
      setCurrentCapaUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await capaApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        capaNo: detail.capaNo,
        capaType: detail.capaType,
        problemDescription: detail.problemDescription,
        rootCause: detail.rootCause,
        correctiveAction: detail.correctiveAction,
        preventiveAction: detail.preventiveAction,
        responsiblePersonName: detail.responsiblePersonName,
        plannedCompletionDate: detail.plannedCompletionDate,
        effectivenessEvaluation: detail.effectivenessEvaluation,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取CAPA详情失败');
    }
  };

  /**
   * 处理删除CAPA
   */
  const handleDelete = async (record: CAPA) => {
    try {
      await capaApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: CAPA) => {
    try {
      setCurrentCapaUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await capaApi.get(record.uuid);
      setCapaDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取CAPA详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: CAPACreate | CAPAUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentCapaUuid) {
        await capaApi.update(currentCapaUuid, values as CAPAUpdate);
        messageApi.success('更新成功');
      } else {
        await capaApi.create(values as CAPACreate);
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
  const columns: ProColumns<CAPA>[] = [
    {
      title: 'CAPA编号',
      dataIndex: 'capaNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.capaNo}</a>
      ),
    },
    {
      title: 'CAPA类型',
      dataIndex: 'capaType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '纠正措施': { text: <Tag color="orange">纠正措施</Tag> },
        '预防措施': { text: <Tag color="blue">预防措施</Tag> },
      },
    },
    {
      title: '问题描述',
      dataIndex: 'problemDescription',
      width: 200,
      ellipsis: true,
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
        '待执行': { text: <Tag color="default">待执行</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '计划完成日期',
      dataIndex: 'plannedCompletionDate',
      width: 150,
      valueType: 'dateTime',
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
            title="确定要删除这条CAPA吗？"
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
      <UniTable<CAPA>
        headerTitle="CAPA管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await capaApi.list({
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
            新建CAPA
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑CAPA' : '新建CAPA'}
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
            name="capaNo"
            label="CAPA编号"
            rules={[{ required: true, message: '请输入CAPA编号' }]}
            placeholder="请输入CAPA编号"
          />
          <ProFormSelect
            name="capaType"
            label="CAPA类型"
            rules={[{ required: true, message: '请选择CAPA类型' }]}
            options={[
              { label: '纠正措施', value: '纠正措施' },
              { label: '预防措施', value: '预防措施' },
            ]}
          />
          <ProFormTextArea
            name="problemDescription"
            label="问题描述"
            rules={[{ required: true, message: '请输入问题描述' }]}
            placeholder="请输入问题描述"
          />
          <ProFormTextArea
            name="rootCause"
            label="根本原因"
            placeholder="请输入根本原因"
          />
          <ProFormTextArea
            name="correctiveAction"
            label="纠正措施"
            placeholder="请输入纠正措施"
          />
          <ProFormTextArea
            name="preventiveAction"
            label="预防措施"
            placeholder="请输入预防措施"
          />
          <ProFormText
            name="responsiblePersonName"
            label="负责人"
            placeholder="请输入负责人姓名"
          />
          <ProFormDatePicker
            name="plannedCompletionDate"
            label="计划完成日期"
            placeholder="请选择计划完成日期"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="CAPA详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : capaDetail ? (
          <ProDescriptions<CAPA>
            column={1}
            dataSource={capaDetail}
            columns={[
              { title: 'CAPA编号', dataIndex: 'capaNo' },
              { title: 'CAPA类型', dataIndex: 'capaType' },
              { title: '问题描述', dataIndex: 'problemDescription' },
              { title: '根本原因', dataIndex: 'rootCause' },
              { title: '纠正措施', dataIndex: 'correctiveAction' },
              { title: '预防措施', dataIndex: 'preventiveAction' },
              { title: '负责人', dataIndex: 'responsiblePersonName' },
              { title: '计划完成日期', dataIndex: 'plannedCompletionDate', valueType: 'dateTime' },
              { title: '实际完成日期', dataIndex: 'actualCompletionDate', valueType: 'dateTime' },
              { title: '有效性评估', dataIndex: 'effectivenessEvaluation' },
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

export default CAPAsPage;
