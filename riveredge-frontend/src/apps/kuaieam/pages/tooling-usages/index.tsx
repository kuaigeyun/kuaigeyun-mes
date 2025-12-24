/**
 * 工装夹具使用管理页面
 * 
 * 提供工装夹具使用记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { toolingUsageApi } from '../../services/process';
import type { ToolingUsage, ToolingUsageCreate, ToolingUsageUpdate } from '../../types/process';

/**
 * 工装夹具使用管理列表页面组件
 */
const ToolingUsagesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUsageUuid, setCurrentUsageUuid] = useState<string | null>(null);
  const [usageDetail, setUsageDetail] = useState<ToolingUsage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工装夹具使用）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建工装夹具使用
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUsageUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      usageDate: new Date().toISOString(),
      usageCount: 1,
    });
  };

  /**
   * 处理编辑工装夹具使用
   */
  const handleEdit = async (record: ToolingUsage) => {
    try {
      setIsEdit(true);
      setCurrentUsageUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await toolingUsageApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        usageNo: detail.usageNo,
        toolingId: detail.toolingId,
        toolingName: detail.toolingName,
        toolingCode: detail.toolingCode,
        sourceType: detail.sourceType,
        sourceId: detail.sourceId,
        sourceNo: detail.sourceNo,
        usageDate: detail.usageDate,
        usageCount: detail.usageCount,
        totalUsageCount: detail.totalUsageCount,
        operatorId: detail.operatorId,
        operatorName: detail.operatorName,
        returnDate: detail.returnDate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工装夹具使用详情失败');
    }
  };

  /**
   * 处理删除工装夹具使用
   */
  const handleDelete = async (record: ToolingUsage) => {
    try {
      await toolingUsageApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ToolingUsage) => {
    try {
      setCurrentUsageUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await toolingUsageApi.get(record.uuid);
      setUsageDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工装夹具使用详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ToolingUsageCreate | ToolingUsageUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentUsageUuid) {
        await toolingUsageApi.update(currentUsageUuid, values as ToolingUsageUpdate);
        messageApi.success('更新成功');
      } else {
        await toolingUsageApi.create(values as ToolingUsageCreate);
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
  const columns: ProColumns<ToolingUsage>[] = [
    {
      title: '使用记录编号',
      dataIndex: 'usageNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.usageNo}</a>
      ),
    },
    {
      title: '工装夹具名称',
      dataIndex: 'toolingName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工装夹具编码',
      dataIndex: 'toolingCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '使用日期',
      dataIndex: 'usageDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      width: 100,
      sorter: true,
    },
    {
      title: '累计使用次数',
      dataIndex: 'totalUsageCount',
      width: 120,
      sorter: true,
    },
    {
      title: '操作人员',
      dataIndex: 'operatorName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '归还日期',
      dataIndex: 'returnDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '使用中': { text: <Tag color="orange">使用中</Tag> },
        '已归还': { text: <Tag color="green">已归还</Tag> },
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
            title="确定要删除这条工装夹具使用记录吗？"
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
      <UniTable<ToolingUsage>
        headerTitle="工装夹具使用管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await toolingUsageApi.list({
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
            新建工装夹具使用
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑工装夹具使用' : '新建工装夹具使用'}
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
            name="usageNo"
            label="使用记录编号"
            rules={[{ required: true, message: '请输入使用记录编号' }]}
            placeholder="请输入使用记录编号"
          />
          <ProFormDigit
            name="toolingId"
            label="工装夹具ID"
            rules={[{ required: true, message: '请输入工装夹具ID' }]}
            placeholder="请输入工装夹具ID"
          />
          <ProFormText
            name="toolingName"
            label="工装夹具名称"
            rules={[{ required: true, message: '请输入工装夹具名称' }]}
            placeholder="请输入工装夹具名称"
          />
          <ProFormText
            name="toolingCode"
            label="工装夹具编码"
            placeholder="请输入工装夹具编码"
          />
          <ProFormSelect
            name="sourceType"
            label="来源类型"
            options={[
              { label: '生产工单', value: '生产工单' },
              { label: '维护工单', value: '维护工单' },
              { label: '其他', value: '其他' },
            ]}
            placeholder="请选择来源类型"
          />
          <ProFormDigit
            name="sourceId"
            label="来源ID"
            placeholder="请输入来源ID"
          />
          <ProFormText
            name="sourceNo"
            label="来源编号"
            placeholder="请输入来源编号"
          />
          <ProFormDatePicker
            name="usageDate"
            label="使用日期"
            rules={[{ required: true, message: '请选择使用日期' }]}
            placeholder="请选择使用日期"
          />
          <ProFormDigit
            name="usageCount"
            label="使用次数"
            placeholder="请输入使用次数"
            min={1}
          />
          <ProFormDigit
            name="totalUsageCount"
            label="累计使用次数"
            placeholder="请输入累计使用次数"
          />
          <ProFormDigit
            name="operatorId"
            label="操作人员ID"
            placeholder="请输入操作人员ID"
          />
          <ProFormText
            name="operatorName"
            label="操作人员姓名"
            placeholder="请输入操作人员姓名"
          />
          <ProFormDatePicker
            name="returnDate"
            label="归还日期"
            placeholder="请选择归还日期"
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
        title="工装夹具使用详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : usageDetail ? (
          <ProDescriptions<ToolingUsage>
            column={1}
            dataSource={usageDetail}
            columns={[
              { title: '使用记录编号', dataIndex: 'usageNo' },
              { title: '工装夹具ID', dataIndex: 'toolingId' },
              { title: '工装夹具名称', dataIndex: 'toolingName' },
              { title: '工装夹具编码', dataIndex: 'toolingCode' },
              { title: '来源类型', dataIndex: 'sourceType' },
              { title: '来源ID', dataIndex: 'sourceId' },
              { title: '来源编号', dataIndex: 'sourceNo' },
              { title: '使用日期', dataIndex: 'usageDate', valueType: 'dateTime' },
              { title: '使用次数', dataIndex: 'usageCount' },
              { title: '累计使用次数', dataIndex: 'totalUsageCount' },
              { title: '操作人员', dataIndex: 'operatorName' },
              { title: '归还日期', dataIndex: 'returnDate', valueType: 'dateTime' },
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

export default ToolingUsagesPage;

