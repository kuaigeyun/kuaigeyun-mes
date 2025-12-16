/**
 * 质量检验记录管理页面
 * 
 * 提供质量检验记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { inspectionRecordApi } from '../../services/process';
import type { InspectionRecord, InspectionRecordCreate, InspectionRecordUpdate } from '../../types/process';

/**
 * 质量检验记录管理列表页面组件
 */
const InspectionRecordsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRecordUuid, setCurrentRecordUuid] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<InspectionRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentRecordUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
      qualifiedQuantity: 0,
      defectiveQuantity: 0,
    });
  };

  /**
   * 处理编辑记录
   */
  const handleEdit = async (record: InspectionRecord) => {
    try {
      setIsEdit(true);
      setCurrentRecordUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await inspectionRecordApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        recordNo: detail.recordNo,
        inspectionType: detail.inspectionType,
        materialName: detail.materialName,
        quantity: detail.quantity,
        qualifiedQuantity: detail.qualifiedQuantity,
        defectiveQuantity: detail.defectiveQuantity,
        inspectionResult: detail.inspectionResult,
        inspectionDate: detail.inspectionDate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取记录详情失败');
    }
  };

  /**
   * 处理删除记录
   */
  const handleDelete = async (record: InspectionRecord) => {
    try {
      await inspectionRecordApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: InspectionRecord) => {
    try {
      setCurrentRecordUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await inspectionRecordApi.get(record.uuid);
      setRecordDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取记录详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: InspectionRecordCreate | InspectionRecordUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentRecordUuid) {
        await inspectionRecordApi.update(currentRecordUuid, values as InspectionRecordUpdate);
        messageApi.success('更新成功');
      } else {
        await inspectionRecordApi.create(values as InspectionRecordCreate);
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
  const columns: ProColumns<InspectionRecord>[] = [
    {
      title: '记录编号',
      dataIndex: 'recordNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.recordNo}</a>
      ),
    },
    {
      title: '检验类型',
      dataIndex: 'inspectionType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '来料检验': { text: <Tag color="blue">来料检验</Tag> },
        '过程检验': { text: <Tag color="green">过程检验</Tag> },
        '成品检验': { text: <Tag color="purple">成品检验</Tag> },
        '委外来料检验': { text: <Tag color="orange">委外来料检验</Tag> },
      },
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '检验数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '合格数量',
      dataIndex: 'qualifiedQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '不合格数量',
      dataIndex: 'defectiveQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '检验结果',
      dataIndex: 'inspectionResult',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '合格': { text: <Tag color="success">合格</Tag> },
        '不合格': { text: <Tag color="error">不合格</Tag> },
        '让步接收': { text: <Tag color="warning">让步接收</Tag> },
      },
    },
    {
      title: '检验员',
      dataIndex: 'inspectorName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="blue">已确认</Tag> },
        '已审核': { text: <Tag color="green">已审核</Tag> },
      },
    },
    {
      title: '检验日期',
      dataIndex: 'inspectionDate',
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
            title="确定要删除这条记录吗？"
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
      <UniTable<InspectionRecord>
        headerTitle="质量检验记录管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await inspectionRecordApi.list({
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
            新建记录
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑质量检验记录' : '新建质量检验记录'}
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
            name="recordNo"
            label="记录编号"
            rules={[{ required: true, message: '请输入记录编号' }]}
            placeholder="请输入记录编号"
          />
          <ProFormSelect
            name="inspectionType"
            label="检验类型"
            rules={[{ required: true, message: '请选择检验类型' }]}
            options={[
              { label: '来料检验', value: '来料检验' },
              { label: '过程检验', value: '过程检验' },
              { label: '成品检验', value: '成品检验' },
              { label: '委外来料检验', value: '委外来料检验' },
            ]}
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="quantity"
            label="检验数量"
            rules={[{ required: true, message: '请输入检验数量' }]}
            placeholder="请输入检验数量"
          />
          <ProFormText
            name="qualifiedQuantity"
            label="合格数量"
            placeholder="请输入合格数量"
          />
          <ProFormText
            name="defectiveQuantity"
            label="不合格数量"
            placeholder="请输入不合格数量"
          />
          <ProFormSelect
            name="inspectionResult"
            label="检验结果"
            rules={[{ required: true, message: '请选择检验结果' }]}
            options={[
              { label: '合格', value: '合格' },
              { label: '不合格', value: '不合格' },
              { label: '让步接收', value: '让步接收' },
            ]}
          />
          <ProFormDatePicker
            name="inspectionDate"
            label="检验日期"
            rules={[{ required: true, message: '请选择检验日期' }]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="质量检验记录详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : recordDetail ? (
          <ProDescriptions<InspectionRecord>
            column={1}
            dataSource={recordDetail}
            columns={[
              { title: '记录编号', dataIndex: 'recordNo' },
              { title: '检验类型', dataIndex: 'inspectionType' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '检验数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '合格数量', dataIndex: 'qualifiedQuantity', valueType: 'digit' },
              { title: '不合格数量', dataIndex: 'defectiveQuantity', valueType: 'digit' },
              { title: '检验结果', dataIndex: 'inspectionResult' },
              { title: '检验员', dataIndex: 'inspectorName' },
              { title: '状态', dataIndex: 'status' },
              { title: '检验日期', dataIndex: 'inspectionDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default InspectionRecordsPage;
