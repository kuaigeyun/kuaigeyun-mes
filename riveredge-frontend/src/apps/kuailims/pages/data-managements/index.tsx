/**
 * 数据管理页面
 * 
 * 提供数据管理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { dataManagementApi } from '../../services/process';
import type { DataManagement, DataManagementCreate, DataManagementUpdate } from '../../types/process';

/**
 * 数据管理列表页面组件
 */
const DataManagementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDataUuid, setCurrentDataUuid] = useState<string | null>(null);
  const [dataDetail, setDataDetail] = useState<DataManagement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑数据管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建数据管理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDataUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      dataType: '实验数据',
      validationStatus: '待校验',
      auditStatus: '待审核',
      archiveStatus: '未归档',
      status: '草稿',
    });
  };

  /**
   * 处理编辑数据管理
   */
  const handleEdit = async (record: DataManagement) => {
    try {
      setIsEdit(true);
      setCurrentDataUuid(record.uuid);
      setModalVisible(true);
      
      // 获取数据管理详情
      const detail = await dataManagementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        dataNo: detail.dataNo,
        dataName: detail.dataName,
        dataType: detail.dataType,
        experimentId: detail.experimentId,
        experimentUuid: detail.experimentUuid,
        experimentNo: detail.experimentNo,
        dataContent: detail.dataContent,
        entryPersonId: detail.entryPersonId,
        entryPersonName: detail.entryPersonName,
        entryDate: detail.entryDate,
        validationStatus: detail.validationStatus,
        validationResult: detail.validationResult,
        auditStatus: detail.auditStatus,
        auditPersonId: detail.auditPersonId,
        auditPersonName: detail.auditPersonName,
        auditDate: detail.auditDate,
        archiveStatus: detail.archiveStatus,
        archiveDate: detail.archiveDate,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取数据管理详情失败');
    }
  };

  /**
   * 处理删除数据管理
   */
  const handleDelete = async (record: DataManagement) => {
    try {
      await dataManagementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DataManagement) => {
    try {
      setCurrentDataUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await dataManagementApi.get(record.uuid);
      setDataDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据管理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: DataManagementCreate | DataManagementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDataUuid) {
        await dataManagementApi.update(currentDataUuid, values as DataManagementUpdate);
        messageApi.success('更新成功');
      } else {
        await dataManagementApi.create(values as DataManagementCreate);
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
  const columns: ProColumns<DataManagement>[] = [
    {
      title: '数据编号',
      dataIndex: 'dataNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.dataNo}</a>
      ),
    },
    {
      title: '数据名称',
      dataIndex: 'dataName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '实验数据': { text: '实验数据' },
        '检验数据': { text: '检验数据' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '实验编号',
      dataIndex: 'experimentNo',
      width: 150,
      ellipsis: true,
    },
    {
      title: '校验状态',
      dataIndex: 'validationStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待校验': { text: <Tag color="default">待校验</Tag> },
        '校验中': { text: <Tag color="processing">校验中</Tag> },
        '已校验': { text: <Tag color="green">已校验</Tag> },
        '校验失败': { text: <Tag color="red">校验失败</Tag> },
      },
    },
    {
      title: '录入人',
      dataIndex: 'entryPersonName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '录入日期',
      dataIndex: 'entryDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '审核状态',
      dataIndex: 'auditStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待审核': { text: <Tag color="default">待审核</Tag> },
        '审核中': { text: <Tag color="processing">审核中</Tag> },
        '已审核': { text: <Tag color="green">已审核</Tag> },
        '已拒绝': { text: <Tag color="red">已拒绝</Tag> },
      },
    },
    {
      title: '归档状态',
      dataIndex: 'archiveStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '未归档': { text: <Tag color="default">未归档</Tag> },
        '已归档': { text: <Tag color="green">已归档</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
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
            title="确定要删除这条数据管理吗？"
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
      <UniTable<DataManagement>
        headerTitle="数据管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await dataManagementApi.list({
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
            新建数据管理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑数据管理' : '新建数据管理'}
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
            name="dataNo"
            label="数据编号"
            rules={[{ required: true, message: '请输入数据编号' }]}
            placeholder="请输入数据编号"
            disabled={isEdit}
          />
          <ProFormText
            name="dataName"
            label="数据名称"
            rules={[{ required: true, message: '请输入数据名称' }]}
            placeholder="请输入数据名称"
          />
          <ProFormSelect
            name="dataType"
            label="数据类型"
            options={[
              { label: '实验数据', value: '实验数据' },
              { label: '检验数据', value: '检验数据' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择数据类型' }]}
          />
          <ProFormDigit
            name="experimentId"
            label="实验ID"
            placeholder="请输入实验ID"
          />
          <ProFormText
            name="experimentUuid"
            label="实验UUID"
            placeholder="请输入实验UUID"
          />
          <ProFormText
            name="experimentNo"
            label="实验编号"
            placeholder="请输入实验编号"
          />
          <ProFormSelect
            name="validationStatus"
            label="校验状态"
            options={[
              { label: '待校验', value: '待校验' },
              { label: '校验中', value: '校验中' },
              { label: '已校验', value: '已校验' },
              { label: '校验失败', value: '校验失败' },
            ]}
            initialValue="待校验"
          />
          <ProFormTextArea
            name="validationResult"
            label="校验结果"
            placeholder="请输入校验结果"
          />
          <ProFormDigit
            name="entryPersonId"
            label="录入人ID"
            placeholder="请输入录入人ID"
          />
          <ProFormText
            name="entryPersonName"
            label="录入人姓名"
            placeholder="请输入录入人姓名"
          />
          <ProFormDatePicker
            name="entryDate"
            label="录入日期"
            placeholder="请选择录入日期"
            showTime
          />
          <ProFormTextArea
            name="dataContent"
            label="数据内容"
            placeholder="请输入数据内容（JSON格式）"
          />
          <ProFormSelect
            name="auditStatus"
            label="审核状态"
            options={[
              { label: '待审核', value: '待审核' },
              { label: '审核中', value: '审核中' },
              { label: '已审核', value: '已审核' },
              { label: '已拒绝', value: '已拒绝' },
            ]}
            initialValue="待审核"
          />
          <ProFormDigit
            name="auditPersonId"
            label="审核人ID"
            placeholder="请输入审核人ID"
          />
          <ProFormText
            name="auditPersonName"
            label="审核人姓名"
            placeholder="请输入审核人姓名"
          />
          <ProFormDatePicker
            name="auditDate"
            label="审核日期"
            placeholder="请选择审核日期"
            showTime
          />
          <ProFormSelect
            name="archiveStatus"
            label="归档状态"
            options={[
              { label: '未归档', value: '未归档' },
              { label: '已归档', value: '已归档' },
            ]}
            initialValue="未归档"
          />
          <ProFormDatePicker
            name="archiveDate"
            label="归档日期"
            placeholder="请选择归档日期"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已确认', value: '已确认' },
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
        title="数据管理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : dataDetail ? (
          <ProDescriptions<DataManagement>
            column={1}
            dataSource={dataDetail}
            columns={[
              { title: '数据编号', dataIndex: 'dataNo' },
              { title: '数据名称', dataIndex: 'dataName' },
              { title: '数据类型', dataIndex: 'dataType' },
              { title: '实验ID', dataIndex: 'experimentId' },
              { title: '实验UUID', dataIndex: 'experimentUuid' },
              { title: '实验编号', dataIndex: 'experimentNo' },
              { title: '录入人ID', dataIndex: 'entryPersonId' },
              { title: '录入人姓名', dataIndex: 'entryPersonName' },
              { title: '录入日期', dataIndex: 'entryDate', valueType: 'dateTime' },
              { title: '数据内容', dataIndex: 'dataContent' },
              { title: '校验状态', dataIndex: 'validationStatus' },
              { title: '校验结果', dataIndex: 'validationResult' },
              { title: '审核状态', dataIndex: 'auditStatus' },
              { title: '审核人ID', dataIndex: 'auditPersonId' },
              { title: '审核人姓名', dataIndex: 'auditPersonName' },
              { title: '审核日期', dataIndex: 'auditDate', valueType: 'dateTime' },
              { title: '归档状态', dataIndex: 'archiveStatus' },
              { title: '归档日期', dataIndex: 'archiveDate', valueType: 'dateTime' },
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

export default DataManagementsPage;

