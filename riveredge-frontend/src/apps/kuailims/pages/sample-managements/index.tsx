/**
 * 样品管理页面
 * 
 * 提供样品管理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { sampleManagementApi } from '../../services/process';
import type { SampleManagement, SampleManagementCreate, SampleManagementUpdate } from '../../types/process';

/**
 * 样品管理列表页面组件
 */
const SampleManagementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSampleUuid, setCurrentSampleUuid] = useState<string | null>(null);
  const [sampleDetail, setSampleDetail] = useState<SampleManagement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑样品管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建样品管理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSampleUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      sampleStatus: '已登记',
      status: '启用',
    });
  };

  /**
   * 处理编辑样品管理
   */
  const handleEdit = async (record: SampleManagement) => {
    try {
      setIsEdit(true);
      setCurrentSampleUuid(record.uuid);
      setModalVisible(true);
      
      // 获取样品管理详情
      const detail = await sampleManagementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        sampleNo: detail.sampleNo,
        sampleName: detail.sampleName,
        sampleType: detail.sampleType,
        sampleCategory: detail.sampleCategory,
        sampleSource: detail.sampleSource,
        registrationDate: detail.registrationDate,
        registrationPersonId: detail.registrationPersonId,
        registrationPersonName: detail.registrationPersonName,
        sampleStatus: detail.sampleStatus,
        storageLocation: detail.storageLocation,
        currentLocation: detail.currentLocation,
        expiryDate: detail.expiryDate,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取样品管理详情失败');
    }
  };

  /**
   * 处理删除样品管理
   */
  const handleDelete = async (record: SampleManagement) => {
    try {
      await sampleManagementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SampleManagement) => {
    try {
      setCurrentSampleUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sampleManagementApi.get(record.uuid);
      setSampleDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取样品管理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SampleManagementCreate | SampleManagementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSampleUuid) {
        await sampleManagementApi.update(currentSampleUuid, values as SampleManagementUpdate);
        messageApi.success('更新成功');
      } else {
        await sampleManagementApi.create(values as SampleManagementCreate);
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
  const columns: ProColumns<SampleManagement>[] = [
    {
      title: '样品编号',
      dataIndex: 'sampleNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.sampleNo}</a>
      ),
    },
    {
      title: '样品名称',
      dataIndex: 'sampleName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '样品类型',
      dataIndex: 'sampleType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '原材料': { text: '原材料' },
        '半成品': { text: '半成品' },
        '成品': { text: '成品' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '样品分类',
      dataIndex: 'sampleCategory',
      width: 120,
      ellipsis: true,
    },
    {
      title: '样品来源',
      dataIndex: 'sampleSource',
      width: 150,
      ellipsis: true,
    },
    {
      title: '登记日期',
      dataIndex: 'registrationDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '登记人',
      dataIndex: 'registrationPersonName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '样品状态',
      dataIndex: 'sampleStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '已登记': { text: <Tag color="blue">已登记</Tag> },
        '流转中': { text: <Tag color="processing">流转中</Tag> },
        '已存储': { text: <Tag color="green">已存储</Tag> },
        '已归档': { text: <Tag color="default">已归档</Tag> },
      },
    },
    {
      title: '存储位置',
      dataIndex: 'storageLocation',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="green">启用</Tag> },
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
            title="确定要删除这条样品管理吗？"
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
      <UniTable<SampleManagement>
        headerTitle="样品管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await sampleManagementApi.list({
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
            新建样品管理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑样品管理' : '新建样品管理'}
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
            name="sampleNo"
            label="样品编号"
            rules={[{ required: true, message: '请输入样品编号' }]}
            placeholder="请输入样品编号"
            disabled={isEdit}
          />
          <ProFormText
            name="sampleName"
            label="样品名称"
            rules={[{ required: true, message: '请输入样品名称' }]}
            placeholder="请输入样品名称"
          />
          <ProFormSelect
            name="sampleType"
            label="样品类型"
            options={[
              { label: '原材料', value: '原材料' },
              { label: '半成品', value: '半成品' },
              { label: '成品', value: '成品' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择样品类型' }]}
          />
          <ProFormText
            name="sampleCategory"
            label="样品分类"
            placeholder="请输入样品分类"
          />
          <ProFormText
            name="sampleSource"
            label="样品来源"
            placeholder="请输入样品来源"
          />
          <ProFormDatePicker
            name="registrationDate"
            label="登记日期"
            placeholder="请选择登记日期"
            showTime
          />
          <ProFormDigit
            name="registrationPersonId"
            label="登记人ID"
            placeholder="请输入登记人ID"
          />
          <ProFormText
            name="registrationPersonName"
            label="登记人姓名"
            placeholder="请输入登记人姓名"
          />
          <ProFormSelect
            name="sampleStatus"
            label="样品状态"
            options={[
              { label: '已登记', value: '已登记' },
              { label: '流转中', value: '流转中' },
              { label: '已存储', value: '已存储' },
              { label: '已归档', value: '已归档' },
            ]}
            initialValue="已登记"
          />
          <ProFormText
            name="storageLocation"
            label="存储位置"
            placeholder="请输入存储位置"
          />
          <ProFormText
            name="currentLocation"
            label="当前位置"
            placeholder="请输入当前位置"
          />
          <ProFormDatePicker
            name="expiryDate"
            label="到期日期"
            placeholder="请选择到期日期"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '启用', value: '启用' },
              { label: '停用', value: '停用' },
            ]}
            initialValue="启用"
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
        title="样品管理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : sampleDetail ? (
          <ProDescriptions<SampleManagement>
            column={1}
            dataSource={sampleDetail}
            columns={[
              { title: '样品编号', dataIndex: 'sampleNo' },
              { title: '样品名称', dataIndex: 'sampleName' },
              { title: '样品类型', dataIndex: 'sampleType' },
              { title: '样品分类', dataIndex: 'sampleCategory' },
              { title: '样品来源', dataIndex: 'sampleSource' },
              { title: '登记日期', dataIndex: 'registrationDate', valueType: 'dateTime' },
              { title: '登记人ID', dataIndex: 'registrationPersonId' },
              { title: '登记人姓名', dataIndex: 'registrationPersonName' },
              { title: '样品状态', dataIndex: 'sampleStatus' },
              { title: '存储位置', dataIndex: 'storageLocation' },
              { title: '当前位置', dataIndex: 'currentLocation' },
              { title: '到期日期', dataIndex: 'expiryDate', valueType: 'dateTime' },
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

export default SampleManagementsPage;

