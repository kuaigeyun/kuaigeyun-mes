/**
 * 报告管理页面
 * 
 * 提供报告管理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { reportManagementApi } from '../../services/process';
import type { ReportManagement, ReportManagementCreate, ReportManagementUpdate } from '../../types/process';

/**
 * 报告管理列表页面组件
 */
const ReportManagementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentReportUuid, setCurrentReportUuid] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportManagement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑报告管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建报告管理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReportUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      reportType: '实验报告',
      auditStatus: '待审核',
      publishStatus: '未发布',
      status: '草稿',
    });
  };

  /**
   * 处理编辑报告管理
   */
  const handleEdit = async (record: ReportManagement) => {
    try {
      setIsEdit(true);
      setCurrentReportUuid(record.uuid);
      setModalVisible(true);
      
      // 获取报告管理详情
      const detail = await reportManagementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        reportNo: detail.reportNo,
        reportName: detail.reportName,
        reportType: detail.reportType,
        experimentId: detail.experimentId,
        experimentUuid: detail.experimentUuid,
        experimentNo: detail.experimentNo,
        reportTemplate: detail.reportTemplate,
        reportContent: detail.reportContent,
        auditStatus: detail.auditStatus,
        auditPersonId: detail.auditPersonId,
        auditPersonName: detail.auditPersonName,
        auditDate: detail.auditDate,
        publishStatus: detail.publishStatus,
        publishDate: detail.publishDate,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取报告管理详情失败');
    }
  };

  /**
   * 处理删除报告管理
   */
  const handleDelete = async (record: ReportManagement) => {
    try {
      await reportManagementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ReportManagement) => {
    try {
      setCurrentReportUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await reportManagementApi.get(record.uuid);
      setReportDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取报告管理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ReportManagementCreate | ReportManagementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentReportUuid) {
        await reportManagementApi.update(currentReportUuid, values as ReportManagementUpdate);
        messageApi.success('更新成功');
      } else {
        await reportManagementApi.create(values as ReportManagementCreate);
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
  const columns: ProColumns<ReportManagement>[] = [
    {
      title: '报告编号',
      dataIndex: 'reportNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reportNo}</a>
      ),
    },
    {
      title: '报告名称',
      dataIndex: 'reportName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '报告类型',
      dataIndex: 'reportType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '实验报告': { text: '实验报告' },
        '检验报告': { text: '检验报告' },
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
      title: '报告模板',
      dataIndex: 'reportTemplate',
      width: 150,
      ellipsis: true,
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
      title: '发布状态',
      dataIndex: 'publishStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '未发布': { text: <Tag color="default">未发布</Tag> },
        '已发布': { text: <Tag color="green">已发布</Tag> },
      },
    },
    {
      title: '发布日期',
      dataIndex: 'publishDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已生成': { text: <Tag color="blue">已生成</Tag> },
        '已发布': { text: <Tag color="green">已发布</Tag> },
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
            title="确定要删除这条报告管理吗？"
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
      <UniTable<ReportManagement>
        headerTitle="报告管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await reportManagementApi.list({
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
            新建报告管理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑报告管理' : '新建报告管理'}
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
            name="reportNo"
            label="报告编号"
            rules={[{ required: true, message: '请输入报告编号' }]}
            placeholder="请输入报告编号"
            disabled={isEdit}
          />
          <ProFormText
            name="reportName"
            label="报告名称"
            rules={[{ required: true, message: '请输入报告名称' }]}
            placeholder="请输入报告名称"
          />
          <ProFormSelect
            name="reportType"
            label="报告类型"
            options={[
              { label: '实验报告', value: '实验报告' },
              { label: '检验报告', value: '检验报告' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择报告类型' }]}
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
          <ProFormText
            name="reportTemplate"
            label="报告模板"
            placeholder="请输入报告模板"
          />
          <ProFormTextArea
            name="reportContent"
            label="报告内容"
            placeholder="请输入报告内容（JSON格式）"
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
            name="publishStatus"
            label="发布状态"
            options={[
              { label: '未发布', value: '未发布' },
              { label: '已发布', value: '已发布' },
            ]}
            initialValue="未发布"
          />
          <ProFormDatePicker
            name="publishDate"
            label="发布日期"
            placeholder="请选择发布日期"
            showTime
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已生成', value: '已生成' },
              { label: '已发布', value: '已发布' },
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
        title="报告管理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : reportDetail ? (
          <ProDescriptions<ReportManagement>
            column={1}
            dataSource={reportDetail}
            columns={[
              { title: '报告编号', dataIndex: 'reportNo' },
              { title: '报告名称', dataIndex: 'reportName' },
              { title: '报告类型', dataIndex: 'reportType' },
              { title: '实验ID', dataIndex: 'experimentId' },
              { title: '实验UUID', dataIndex: 'experimentUuid' },
              { title: '实验编号', dataIndex: 'experimentNo' },
              { title: '报告模板', dataIndex: 'reportTemplate' },
              { title: '报告内容', dataIndex: 'reportContent' },
              { title: '审核状态', dataIndex: 'auditStatus' },
              { title: '审核人ID', dataIndex: 'auditPersonId' },
              { title: '审核人姓名', dataIndex: 'auditPersonName' },
              { title: '审核日期', dataIndex: 'auditDate', valueType: 'dateTime' },
              { title: '发布状态', dataIndex: 'publishStatus' },
              { title: '发布日期', dataIndex: 'publishDate', valueType: 'dateTime' },
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

export default ReportManagementsPage;

