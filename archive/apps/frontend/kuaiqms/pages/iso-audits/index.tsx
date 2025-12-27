/**
 * ISO质量审核管理页面
 * 
 * 提供ISO质量审核的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { isoAuditApi } from '../../services/process';
import type { ISOAudit, ISOAuditCreate, ISOAuditUpdate } from '../../types/process';

/**
 * ISO质量审核管理列表页面组件
 */
const ISOAuditsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAuditUuid, setCurrentAuditUuid] = useState<string | null>(null);
  const [auditDetail, setAuditDetail] = useState<ISOAudit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑审核）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建审核
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAuditUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '计划中',
    });
  };

  /**
   * 处理编辑审核
   */
  const handleEdit = async (record: ISOAudit) => {
    try {
      setIsEdit(true);
      setCurrentAuditUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await isoAuditApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        auditNo: detail.auditNo,
        auditType: detail.auditType,
        isoStandard: detail.isoStandard,
        auditScope: detail.auditScope,
        auditDate: detail.auditDate,
        auditorName: detail.auditorName,
        auditResult: detail.auditResult,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取审核详情失败');
    }
  };

  /**
   * 处理删除审核
   */
  const handleDelete = async (record: ISOAudit) => {
    try {
      await isoAuditApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ISOAudit) => {
    try {
      setCurrentAuditUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await isoAuditApi.get(record.uuid);
      setAuditDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取审核详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ISOAuditCreate | ISOAuditUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAuditUuid) {
        await isoAuditApi.update(currentAuditUuid, values as ISOAuditUpdate);
        messageApi.success('更新成功');
      } else {
        await isoAuditApi.create(values as ISOAuditCreate);
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
  const columns: ProColumns<ISOAudit>[] = [
    {
      title: '审核编号',
      dataIndex: 'auditNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.auditNo}</a>
      ),
    },
    {
      title: '审核类型',
      dataIndex: 'auditType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '内审': { text: <Tag color="blue">内审</Tag> },
        '外审': { text: <Tag color="green">外审</Tag> },
      },
    },
    {
      title: 'ISO标准',
      dataIndex: 'isoStandard',
      width: 150,
    },
    {
      title: '审核员',
      dataIndex: 'auditorName',
      width: 100,
    },
    {
      title: '审核结果',
      dataIndex: 'auditResult',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '通过': { text: <Tag color="success">通过</Tag> },
        '不通过': { text: <Tag color="error">不通过</Tag> },
        '待整改': { text: <Tag color="warning">待整改</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '计划中': { text: <Tag color="default">计划中</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '审核日期',
      dataIndex: 'auditDate',
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
            title="确定要删除这条审核吗？"
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
      <UniTable<ISOAudit>
        headerTitle="ISO质量审核管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await isoAuditApi.list({
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
            新建审核
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑ISO质量审核' : '新建ISO质量审核'}
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
            name="auditNo"
            label="审核编号"
            rules={[{ required: true, message: '请输入审核编号' }]}
            placeholder="请输入审核编号"
          />
          <ProFormSelect
            name="auditType"
            label="审核类型"
            rules={[{ required: true, message: '请选择审核类型' }]}
            options={[
              { label: '内审', value: '内审' },
              { label: '外审', value: '外审' },
            ]}
          />
          <ProFormText
            name="isoStandard"
            label="ISO标准"
            placeholder="请输入ISO标准（如：ISO 9001）"
          />
          <ProFormTextArea
            name="auditScope"
            label="审核范围"
            placeholder="请输入审核范围"
          />
          <ProFormDatePicker
            name="auditDate"
            label="审核日期"
            placeholder="请选择审核日期"
          />
          <ProFormText
            name="auditorName"
            label="审核员"
            placeholder="请输入审核员姓名"
          />
          <ProFormSelect
            name="auditResult"
            label="审核结果"
            options={[
              { label: '通过', value: '通过' },
              { label: '不通过', value: '不通过' },
              { label: '待整改', value: '待整改' },
            ]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="ISO质量审核详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : auditDetail ? (
          <ProDescriptions<ISOAudit>
            column={1}
            dataSource={auditDetail}
            columns={[
              { title: '审核编号', dataIndex: 'auditNo' },
              { title: '审核类型', dataIndex: 'auditType' },
              { title: 'ISO标准', dataIndex: 'isoStandard' },
              { title: '审核范围', dataIndex: 'auditScope' },
              { title: '审核员', dataIndex: 'auditorName' },
              { title: '审核结果', dataIndex: 'auditResult' },
              { title: '审核发现', dataIndex: 'findings', valueType: 'jsonCode' },
              { title: '状态', dataIndex: 'status' },
              { title: '审核日期', dataIndex: 'auditDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ISOAuditsPage;
