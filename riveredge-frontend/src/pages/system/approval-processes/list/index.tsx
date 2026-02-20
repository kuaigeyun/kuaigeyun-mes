/**
 * 审批流程管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的审批流程。
 * 支持审批流程的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
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


/**
 * 审批流程管理列表页面组件
 */
const ApprovalProcessListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑审批流程）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentApprovalProcessUuid, setCurrentApprovalProcessUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建审批流程
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentApprovalProcessUuid(null);
    setFormInitialValues({
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑审批流程
   */
  const handleEdit = async (record: ApprovalProcess) => {
    try {
      setIsEdit(true);
      setCurrentApprovalProcessUuid(record.uuid);
      
      // 获取审批流程详情
      const detail = await getApprovalProcessByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        is_active: detail.is_active,
      });
      setModalVisible(true);
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
    navigate(`/system/approval-processes/designer?uuid=${record.uuid}`);
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
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      const data: CreateApprovalProcessData | UpdateApprovalProcessData = {
        ...values,
      };
      
      // 如果是新建，提供默认的工作流骨架
      if (!isEdit) {
        (data as CreateApprovalProcessData).nodes = { nodes: [], edges: [] };
        (data as CreateApprovalProcessData).config = {};
      }
      
      if (isEdit && currentApprovalProcessUuid) {
        await updateApprovalProcess(currentApprovalProcessUuid, data as UpdateApprovalProcessData);
        messageApi.success('更新成功');
      } else {
        await createApprovalProcess(data as CreateApprovalProcessData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
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
      <ListPageTemplate>
        <UniTable<ApprovalProcess>
        headerTitle="审批流程管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20 } = params;
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
        showAdvancedSearch={true}
        showCreateButton
        createButtonText="新建审批流程"
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText="批量删除"
        showImportButton
        showExportButton
        onExport={async (type, keys, pageData) => {
          const allData = await getApprovalProcessList({});
          let items = type === 'currentPage' && pageData?.length ? pageData : allData;
          if (type === 'selected' && keys?.length) {
            items = allData.filter((d) => keys.includes(d.uuid));
          }
          if (items.length === 0) {
            messageApi.warning('暂无数据可导出');
            return;
          }
          const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `approval-processes-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          messageApi.success('导出成功');
        }}
        search={{
          labelWidth: 'auto',
        }}
      />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑审批流程' : '新建审批流程'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={720}
      >
        <ProFormText
          name="name"
          label="流程名称"
          placeholder="请输入流程名称"
          rules={[{ required: true, message: '请输入流程名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label="流程代码"
          placeholder="请输入唯一代码"
          rules={[
            { required: true, message: '请输入流程代码' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '以字母开头，仅限字母数字下划线' },
          ]}
          disabled={isEdit}
          tooltip="创建后不可修改"
          colProps={{ span: 12 }}
        />
      
        <ProFormTextArea
          name="description"
          label="流程描述"
          placeholder="请输入流程描述..."
          fieldProps={{
            rows: 3,
          }}
          colProps={{ span: 24 }}
        />
      
        <ProFormSwitch
          name="is_active"
          label="是否立即启用"
          checkedChildren="启用"
          unCheckedChildren="禁用"
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="审批流程详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
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
                render: (value: any) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '节点配置',
                dataIndex: 'nodes',
                render: (value: any) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: '流程配置',
                dataIndex: 'config',
                render: (value: any) => (
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
    </>
  );
};

export default ApprovalProcessListPage;

