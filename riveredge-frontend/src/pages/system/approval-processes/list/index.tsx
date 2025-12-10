/**
 * 审批流程管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的审批流程。
 * 支持审批流程的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getApprovalProcessList,
  getApprovalProcessByUuid,
  createApprovalProcess,
  updateApprovalProcess,
  deleteApprovalProcess,
  ApprovalProcess,
  CreateApprovalProcessData,
  UpdateApprovalProcessData,
} from '../../../../services/approvalProcess';

const { TextArea } = Input;

/**
 * 审批流程管理列表页面组件
 */
const ApprovalProcessListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑审批流程）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentApprovalProcessUuid, setCurrentApprovalProcessUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nodesJson, setNodesJson] = useState<string>('{"nodes": [], "edges": []}');
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ApprovalProcess | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建审批流程
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentApprovalProcessUuid(null);
    setNodesJson('{"nodes": [], "edges": []}');
    setConfigJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
    });
  };

  /**
   * 处理编辑审批流程
   */
  const handleEdit = async (record: ApprovalProcess) => {
    try {
      setIsEdit(true);
      setCurrentApprovalProcessUuid(record.uuid);
      setModalVisible(true);
      
      // 获取审批流程详情
      const detail = await getApprovalProcessByUuid(record.uuid);
      setNodesJson(JSON.stringify(detail.nodes, null, 2));
      setConfigJson(JSON.stringify(detail.config, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取审批流程详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: ApprovalProcess) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApprovalProcessByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取审批流程详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理设计流程（跳转到设计器）
   */
  const handleDesign = (record: ApprovalProcess) => {
    window.open(`/system/approval-processes/designer?uuid=${record.uuid}`, '_blank');
  };

  /**
   * 处理删除审批流程
   */
  const handleDelete = async (record: ApprovalProcess) => {
    try {
      await deleteApprovalProcess(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要删除的审批流程');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteApprovalProcess(key as string)));
      messageApi.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('批量删除失败');
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 配置
      let nodes: Record<string, any>;
      let config: Record<string, any>;
      
      try {
        nodes = JSON.parse(nodesJson);
      } catch (e) {
        messageApi.error('节点配置 JSON 格式错误');
        return;
      }
      
      try {
        config = JSON.parse(configJson);
      } catch (e) {
        messageApi.error('流程配置 JSON 格式错误');
        return;
      }
      
      const data: CreateApprovalProcessData | UpdateApprovalProcessData = {
        ...values,
        nodes,
        config,
      };
      
      if (isEdit && currentApprovalProcessUuid) {
        await updateApprovalProcess(currentApprovalProcessUuid, data as UpdateApprovalProcessData);
        messageApi.success('更新成功');
      } else {
        await createApprovalProcess(data as CreateApprovalProcessData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ApprovalProcess>[] = [
    {
      title: '流程名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '流程代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="view"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
        >
          查看
        </Button>,
        <Button
          key="design"
          type="link"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => handleDesign(record)}
        >
          设计
        </Button>,
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确定要删除这个审批流程吗？"
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
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <UniTable<ApprovalProcess>
        headerTitle="审批流程管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const limit = pageSize;
          
          const listParams: any = {
            skip,
            limit,
            ...searchFormValues,
          };
          
          const data = await getApprovalProcessList(listParams);
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="batch-delete"
            danger
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
          showAdvancedSearch: true,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑审批流程' : '新建审批流程'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        size={800}
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
          }}
        >
          <ProFormText
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
            disabled={isEdit}
          />
          <ProFormText
            name="code"
            label="流程代码"
            rules={[
              { required: true, message: '请输入流程代码' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '流程代码只能包含字母、数字和下划线，且必须以字母开头' },
            ]}
            disabled={isEdit}
            tooltip="流程代码用于程序识别，创建后不可修改"
          />
          <ProFormTextArea
            name="description"
            label="流程描述"
            fieldProps={{
              rows: 3,
            }}
          />
          <ProForm.Item
            name="nodes"
            label="节点配置（JSON）"
            rules={[{ required: true, message: '请输入节点配置' }]}
          >
            <TextArea
              rows={8}
              value={nodesJson}
              onChange={(e) => setNodesJson(e.target.value)}
              placeholder='{"nodes": [], "edges": []}'
            />
          </ProForm.Item>
          <ProForm.Item
            name="config"
            label="流程配置（JSON）"
            rules={[{ required: true, message: '请输入流程配置' }]}
          >
            <TextArea
              rows={6}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder='{}'
            />
          </ProForm.Item>
          <ProFormSwitch
            name="is_active"
            label="启用状态"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="审批流程详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailData ? (
          <ProDescriptions
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '流程名称',
                dataIndex: 'name',
              },
              {
                title: '流程代码',
                dataIndex: 'code',
              },
              {
                title: '描述',
                dataIndex: 'description',
              },
              {
                title: '启用状态',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '节点配置',
                dataIndex: 'nodes',
                render: (value) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: '流程配置',
                dataIndex: 'config',
                render: (value) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: 'Inngest 工作流ID',
                dataIndex: 'inngest_workflow_id',
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        ) : null}
      </Drawer>
    </>
  );
};

export default ApprovalProcessListPage;

