/**
 * 审批流程管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的审批流程。
 * 支持审批流程的 CRUD 操作。
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag } from '../../utils/systemListPresentation';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { useNavigate } from 'react-router-dom';
import { countWithPagedRequests } from '../../../../utils/pagedCount';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
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
import {
  resolvePresetApprovalProcessDescription,
  resolvePresetApprovalProcessName,
} from '../../../../utils/presetEntityI18n';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

/**
 * 审批流程管理列表页面组件
 */
const ApprovalProcessListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);

  const approvalProcessDetailDescColumns = useMemo<ProDescriptionsItemProps<Record<string, unknown>>[]>(
    () => [
      {
        title: t('pages.system.approvalProcesses.name'),
        dataIndex: 'name',
        render: (_: unknown, record: ApprovalProcess) => resolvePresetApprovalProcessName(record, t),
      },
      {
        title: t('pages.system.approvalProcesses.code'),
        dataIndex: 'code',
      },
      {
        title: t('common.remark'),
        dataIndex: 'description',
        render: (_: unknown, record: ApprovalProcess) =>
          resolvePresetApprovalProcessDescription(record, t),
      },
      {
        title: t('pages.system.approvalProcesses.enableStatus'),
        dataIndex: 'is_active',
        render: (value: unknown) =>
          renderSystemActiveTag(
            t,
            Boolean(value),
            'common.enabled',
            'common.disabled',
          ),
      },
      {
        title: t('pages.system.approvalProcesses.nodesConfig'),
        dataIndex: 'nodes',
        render: (value: unknown) => (
          <pre
            style={{
              maxHeight: '200px',
              overflow: 'auto',
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              margin: 0,
            }}
          >
            {JSON.stringify(value, null, 2)}
          </pre>
        ),
      },
      {
        title: t('pages.system.approvalProcesses.flowConfig'),
        dataIndex: 'config',
        render: (value: unknown) => (
          <pre
            style={{
              maxHeight: '200px',
              overflow: 'auto',
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              margin: 0,
            }}
          >
            {JSON.stringify(value, null, 2)}
          </pre>
        ),
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at',
        valueType: 'dateTime',
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        valueType: 'dateTime',
      },
    ],
    [t]
  );

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
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
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
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getApprovalProcessByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.approvalProcesses.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = async (record: ApprovalProcess) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
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
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
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
    } catch {
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
      
      // 新建仅填元数据；节点在设计器中配置。须带合法骨架（开始→结束），否则后端校验拒绝空图。
      if (!isEdit) {
        (data as CreateApprovalProcessData).nodes = {
          nodes: [
            {
              id: 'start',
              type: 'start',
              position: { x: 250, y: 50 },
              data: { label: t('pages.approval.designer.start') },
            },
            {
              id: 'end',
              type: 'end',
              position: { x: 250, y: 350 },
              data: { label: t('pages.approval.designer.end') },
            },
          ],
          edges: [{ id: 'e-start-end', source: 'start', target: 'end', type: 'smoothstep' }],
        };
        (data as CreateApprovalProcessData).config = {};
      }
      
      if (isEdit && currentApprovalProcessUuid) {
        await updateApprovalProcess(currentApprovalProcessUuid, data as UpdateApprovalProcessData);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createApprovalProcess(data as CreateApprovalProcessData);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<ApprovalProcess>[]>(() => alignProColumns([
    {
      title: t('pages.system.approvalProcesses.code'),
      dataIndex: 'code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
    },
    {
      title: t('pages.system.approvalProcesses.name'),
      dataIndex: 'name',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      render: (_, record) => resolvePresetApprovalProcessName(record, t),
    },
    {
      // 备注长短不一：唯一 RemainderFlex
      title: t('common.remark'),
      dataIndex: 'description',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => resolvePresetApprovalProcessDescription(record, t),
    },
    {
      title: t('pages.system.approvalProcesses.enableStatus'),
      dataIndex: 'is_active',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) =>
        renderSystemActiveTag(t, record.is_active, 'common.enabled', 'common.disabled'),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
            <Button key="view" {...rowActionKind('read')} onClick={() => handleView(record)} />,
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
            <Button
              key="design"
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              onClick={() => handleDesign(record)}
            >
              {t('pages.system.approvalProcesses.design')}
            </Button>,
            <Popconfirm
              key="delete"
              title={t('pages.system.approvalProcesses.deleteConfirmTitle')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button {...rowActionKind('delete')} />
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleEdit, handleDesign, handleDelete]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<ApprovalProcess>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.approvalProcesses')}
        columnPersistenceId="pages.system.approval-processes.list-v2"
        headerTitle={t('pages.system.approvalProcesses.headerTitle')}
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
          try {
            const { current = 1, pageSize = 20 } = params;
            const skip = (current - 1) * pageSize;
            const limit = pageSize;

            const listParams: any = {
              skip,
              limit,
              ...searchFormValues,
            };

            const countTotal = async (): Promise<number> => {
              const chunkSize = 1000;
              let total = 0;
              let offset = 0;
              for (let i = 0; i < 100; i += 1) {
                const chunk = await getApprovalProcessList({
                  skip: offset,
                  limit: chunkSize,
                  ...searchFormValues,
                });
                total += chunk.length;
                if (chunk.length < chunkSize) break;
                offset += chunkSize;
              }
              return total;
            };

            const [data, total] = await Promise.all([
              getApprovalProcessList(listParams),
              // 接口无 total 字段，按后端上限分批统计总量
              countTotal(),
            ]);
            return {
              data,
              success: true,
              total,
            };
          } catch (error: any) {
            messageApi.error(error?.message || t('common.operationFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
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
        deleteButtonText={t('common.batchDelete')}
        toolBarRender={() => []}
        showExportButton
        onExport={async (type, keys, pageData) => {
          const allData = await getApprovalProcessList({});
          let items = type === 'currentPage' && pageData?.length ? pageData : allData;
          if (type === 'selected' && keys?.length) {
            items = allData.filter((d) => keys.includes(d.uuid));
          }
          if (items.length === 0) {
            messageApi.warning(t('common.exportNoData'));
            return;
          }
          await downloadRecordsAsXlsx(
            items as Array<Record<string, unknown>>,
            `approval-processes-${todaySiteDateString()}.xlsx`,
          );
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
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
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
        <ProFormText
          name="name"
          label={t('pages.system.approvalProcesses.nameLabel')}
          placeholder={t('pages.system.approvalProcesses.namePlaceholder')}
          rules={[{ required: true, message: t('pages.system.approvalProcesses.nameRequired') }]}
          colProps={{ span: 12 }}
        />
      
        <ProFormTextArea
          name="description"
          label={t('common.remark')}
          placeholder={t('pages.system.approvalProcesses.descPlaceholder')}
          fieldProps={{
            rows: 3,
          }}
          colProps={{ span: 24 }}
        />
      
        <ProFormSwitch
          name="is_active"
          label={t('common.enabled')}
          checkedChildren={t('common.enabled')}
          unCheckedChildren={t('common.disabled')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <SystemMasterDetailDrawer
        title={t('pages.system.approvalProcesses.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
          setDetailError(null);
        }}
        detail={detailData}
        detailColumns={approvalProcessDetailDescColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
      />
    </>
  );
};

export default ApprovalProcessListPage;

