/**
 * 审批流程管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的审批流程。
 * 支持审批流程的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(error.message || t('pages.system.approvalProcesses.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.system.approvalProcesses.getDetailFailed'));
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
      messageApi.success(t('pages.system.approvalProcesses.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.approvalProcesses.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.approvalProcesses.selectToDelete'));
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteApprovalProcess(key as string)));
      messageApi.success(t('pages.system.approvalProcesses.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(t('pages.system.approvalProcesses.batchDeleteFailed'));
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
        messageApi.success(t('pages.system.approvalProcesses.updateSuccess'));
      } else {
        await createApprovalProcess(data as CreateApprovalProcessData);
        messageApi.success(t('pages.system.approvalProcesses.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.approvalProcesses.operationFailed'));
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
      title: t('pages.system.approvalProcesses.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.approvalProcesses.code'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.system.approvalProcesses.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalProcesses.enableStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.approvalProcesses.enabled'), status: 'Success' },
        false: { text: t('pages.system.approvalProcesses.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.approvalProcesses.enabled') : t('pages.system.approvalProcesses.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.approvalProcesses.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.approvalProcesses.actions'),
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
          {t('pages.system.approvalProcesses.view')}
        </Button>,
        <Button
          key="design"
          type="link"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => handleDesign(record)}
        >
          {t('pages.system.approvalProcesses.design')}
        </Button>,
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          {t('pages.system.approvalProcesses.edit')}
        </Button>,
        <Popconfirm
          key="delete"
          title={t('pages.system.approvalProcesses.confirmDelete')}
          onConfirm={() => handleDelete(record)}
        >
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
          >
            {t('pages.system.approvalProcesses.delete')}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ApprovalProcess>
        headerTitle={t('pages.system.approvalProcesses.headerTitle')}
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
        createButtonText={t('pages.system.approvalProcesses.createButton')}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('pages.system.approvalProcesses.batchDelete')}
        showImportButton
        showExportButton
        onExport={async (type, keys, pageData) => {
          const allData = await getApprovalProcessList({});
          let items = type === 'currentPage' && pageData?.length ? pageData : allData;
          if (type === 'selected' && keys?.length) {
            items = allData.filter((d) => keys.includes(d.uuid));
          }
          if (items.length === 0) {
            messageApi.warning(t('pages.system.approvalProcesses.exportNoData'));
            return;
          }
          const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `approval-processes-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          messageApi.success(t('pages.system.approvalProcesses.exportSuccess'));
        }}
        search={{
          labelWidth: 'auto',
        }}
      />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('pages.system.approvalProcesses.editModalTitle') : t('pages.system.approvalProcesses.createModalTitle')}
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
          label={t('pages.system.approvalProcesses.nameLabel')}
          placeholder={t('pages.system.approvalProcesses.namePlaceholder')}
          rules={[{ required: true, message: t('pages.system.approvalProcesses.nameRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label={t('pages.system.approvalProcesses.codeLabel')}
          placeholder={t('pages.system.approvalProcesses.codePlaceholder')}
          rules={[
            { required: true, message: t('pages.system.approvalProcesses.codeRequired') },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('pages.system.approvalProcesses.codePattern') },
          ]}
          disabled={isEdit}
          tooltip={t('pages.system.approvalProcesses.codeTooltip')}
          colProps={{ span: 12 }}
        />
      
        <ProFormTextArea
          name="description"
          label={t('pages.system.approvalProcesses.descLabel')}
          placeholder={t('pages.system.approvalProcesses.descPlaceholder')}
          fieldProps={{
            rows: 3,
          }}
          colProps={{ span: 24 }}
        />
      
        <ProFormSwitch
          name="is_active"
          label={t('pages.system.approvalProcesses.isActiveLabel')}
          checkedChildren={t('pages.system.approvalProcesses.enabled')}
          unCheckedChildren={t('pages.system.approvalProcesses.disabled')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.approvalProcesses.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
              {
                title: t('pages.system.approvalProcesses.name'),
                dataIndex: 'name',
              },
              {
                title: t('pages.system.approvalProcesses.code'),
                dataIndex: 'code',
              },
              {
                title: t('pages.system.approvalProcesses.description'),
                dataIndex: 'description',
              },
              {
                title: t('pages.system.approvalProcesses.enableStatus'),
                dataIndex: 'is_active',
                render: (value: any) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? t('pages.system.approvalProcesses.enabled') : t('pages.system.approvalProcesses.disabled')}
                  </Tag>
                ),
              },
              {
                title: t('pages.system.approvalProcesses.nodesConfig'),
                dataIndex: 'nodes',
                render: (value: any) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: t('pages.system.approvalProcesses.flowConfig'),
                dataIndex: 'config',
                render: (value: any) => (
                  <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: t('pages.system.approvalProcesses.inngestWorkflowId'),
                dataIndex: 'inngest_workflow_id',
              },
              {
                title: t('pages.system.approvalProcesses.createdAt'),
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: t('pages.system.approvalProcesses.updatedAt'),
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
        ]}
      />
    </>
  );
};

export default ApprovalProcessListPage;

