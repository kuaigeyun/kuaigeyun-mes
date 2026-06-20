import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 研发需求（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Alert } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listRequirements,
  createRequirement,
  deleteRequirement,
  updateRequirement,
  type RdRequirement,
} from '../../../services/phase2';
import { buildPurchaseInquiryUrl } from '../../../services/master-data-links';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTime } from '../../../../../utils/format';

const RequirementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get('project_id');
  const filterProjectId = projectIdFilter ? Number(projectIdFilter) : undefined;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RdRequirement | null>(null);
  const [detailRecord, setDetailRecord] = useState<RdRequirement | null>(null);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const toRequirementIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toRequirementIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.requirements.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteRequirement(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.requirements.batchDeleteSuccess', { count: successCount }),
      );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.requirements.batchDeleteFailed'));
  };

  const handleBatchSetStatus = async (status: string, label: string) => {
    const ids = toRequirementIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.requirements.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateRequirement(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.requirements.batchStatusSuccess', { count: successCount, label }),
      );
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.requirements.batchStatusFailed'));
  };

  const priorityLabelMap: Record<string, string> = {
    high: t('app.kuaiplm.phase2.common.priority.high'),
    normal: t('app.kuaiplm.phase2.common.priority.normal'),
    low: t('app.kuaiplm.phase2.common.priority.low'),
  };
  const requirementStatusLabelMap: Record<string, string> = {
    DRAFT: t('app.kuaiplm.phase2.common.status.draft'),
    IN_PROGRESS: t('app.kuaiplm.phase2.common.status.inProgress'),
    DONE: t('app.kuaiplm.phase2.common.status.done'),
    ARCHIVED: t('app.kuaiplm.phase2.common.status.archived'),
  };
  const sourceTypeLabelMap: Record<string, string> = {
    customer: t('app.kuaiplm.phase2.common.source.customer'),
    purchase_inquiry: t('app.kuaiplm.phase2.common.source.purchaseInquiry'),
    internal: t('app.kuaiplm.phase2.common.source.internal'),
  };

  const columns: ProColumns<RdRequirement>[] = [
    { title: t('app.kuaiplm.phase2.requirements.columns.code'), dataIndex: 'requirement_code', width: 140 },
    { title: t('app.kuaiplm.phase2.requirements.columns.title'), dataIndex: 'title', ellipsis: true },
    { title: t('app.kuaiplm.phase2.requirements.columns.project'), dataIndex: 'project_name', width: 140, hideInSearch: true },
    {
      title: t('app.kuaiplm.phase2.requirements.columns.priority'),
      dataIndex: 'priority',
      width: 90,
      valueEnum: Object.fromEntries(
        Object.entries(priorityLabelMap).map(([value, label]) => [value, { text: label }]),
      ),
      render: (_, row) => priorityLabelMap[row.priority || ''] || row.priority || '-',
    },
    {
      title: t('app.kuaiplm.phase2.requirements.columns.status'),
      dataIndex: 'status',
      width: 90,
      valueEnum: Object.fromEntries(
        Object.entries(requirementStatusLabelMap).map(([value, label]) => [value, { text: label }]),
      ),
      render: (_, row) => requirementStatusLabelMap[row.status || ''] || row.status || '-',
    },
    {
      title: t('app.kuaiplm.phase2.requirements.columns.source'),
      dataIndex: 'source_type',
      width: 140,
      hideInSearch: true,
      render: (_, row) => {
        if (row.source_type === 'purchase_inquiry' && row.source_id) {
          return (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => window.open(buildPurchaseInquiryUrl(row.source_id!), '_blank')}
            >
              {t('app.kuaiplm.phase2.common.source.purchaseInquiry')} #{row.source_id}
            </Button>
          );
        }
        return sourceTypeLabelMap[row.source_type || ''] || row.source_type || '-';
      },
    },
    {
      title: t('app.kuaiplm.phase2.requirements.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.updated_at ? formatDateTime(row.updated_at, 'YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 180,
      render: (_, row) => [
            <Button
              {...rowActionKind('read')}
              key="detail"
              type="link"
              size="small"
              onClick={() => {
                setDetailRecord(row);
              }}
            >
              {t('common.detail')}
            </Button>,
            <Button
              {...rowActionKind('edit')}
              key="edit"
              type="link"
              size="small"
              onClick={() => {
                setEditingRecord(row);
              }}
            >
              {t('common.edit')}
            </Button>,
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              onClick={() => {
                modalApi.confirm({
                  title: t('app.kuaiplm.phase2.requirements.deleteOneTitle'),
                  onOk: async () => {
                    await deleteRequirement(row.id!);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>,
          ],
    },
  ];

  return (
    <ListPageTemplate>
      {filterProjectId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('app.kuaiplm.phase2.common.projectFilterHint', { id: filterProjectId })}
        />
      ) : null}
      <UniTable<RdRequirement>
        headerTitle={t('app.kuaiplm.menu.phase2.requirements')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.phase2.requirements"
        request={async (params) => {
          const { current, pageSize } = params;
          try {
            const res = await listRequirements({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              project_id: filterProjectId,
            });
            return { data: res.items, total: res.total, success: true };
          } catch (e: any) {
            messageApi.error(e?.message || t('common.loadFailed'));
            return { data: [], total: 0, success: false };
          }
        }}
        showCreateButton
        createButtonText={t('app.kuaiplm.phase2.requirements.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaiplm.phase2.requirements.deleteConfirmTitle', { count })
        }
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="requirements-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              {
                key: 'batch-set-in-progress',
                label: t('app.kuaiplm.phase2.requirements.batchSetInProgress'),
                onClick: () => {
                  void handleBatchSetStatus('IN_PROGRESS', t('app.kuaiplm.phase2.common.status.inProgress'));
                },
              },
              {
                key: 'batch-set-done',
                label: t('app.kuaiplm.phase2.requirements.batchSetDone'),
                onClick: () => {
                  void handleBatchSetStatus('DONE', t('app.kuaiplm.phase2.common.status.done'));
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.createTitle')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createRequirement(values);
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText
          name="title"
          label={t('app.kuaiplm.phase2.requirements.form.title')}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          initialValue="normal"
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDigit
          name="source_id"
          label={t('app.kuaiplm.phase2.requirements.form.sourceId')}
          min={1}
          fieldProps={{ precision: 0 }}
        />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.requirements.form.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.editTitle')}
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        isEdit
        initialValues={editingRecord || {}}
        onFinish={async (values) => {
          if (!editingRecord?.id) return;
          await updateRequirement(editingRecord.id, values);
          messageApi.success(t('common.updateSuccess'));
          setEditingRecord(null);
          actionRef.current?.reload();
        }}
      >
        <ProFormText
          name="title"
          label={t('app.kuaiplm.phase2.requirements.form.title')}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.requirements.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_PROGRESS', label: t('app.kuaiplm.phase2.common.status.inProgress') },
            { value: 'DONE', label: t('app.kuaiplm.phase2.common.status.done') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDigit
          name="source_id"
          label={t('app.kuaiplm.phase2.requirements.form.sourceId')}
          min={1}
          fieldProps={{ precision: 0 }}
        />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.requirements.form.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.detailTitle')}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        readOnly
        initialValues={detailRecord || {}}
        onFinish={async () => {}}
      >
        <ProFormText name="requirement_code" label={t('app.kuaiplm.phase2.requirements.columns.code')} />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.requirements.form.title')} />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.requirements.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_PROGRESS', label: t('app.kuaiplm.phase2.common.status.inProgress') },
            { value: 'DONE', label: t('app.kuaiplm.phase2.common.status.done') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDigit name="source_id" label={t('app.kuaiplm.phase2.requirements.form.sourceId')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.requirements.form.description')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RequirementsPage;
