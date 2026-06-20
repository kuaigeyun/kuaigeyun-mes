import { rowActionKind } from '../../../../../components/uni-action';
/**
 * FMEA 记录（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listFmeaRecords,
  createFmeaRecord,
  deleteFmeaRecord,
  updateFmeaRecord,
  type RdFmeaRecord,
} from '../../../services/phase2';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTime } from '../../../../../utils/format';

const RISK_COLOR: Record<string, string> = {
  高: 'red',
  中: 'orange',
  低: 'green',
};

const FmeaPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RdFmeaRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<RdFmeaRecord | null>(null);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const toFmeaIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toFmeaIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.fmea.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteFmeaRecord(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.phase2.fmea.batchDeleteSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.fmea.batchDeleteFailed'));
  };

  const handleBatchSetStatus = async (status: string, label: string) => {
    const ids = toFmeaIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.fmea.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateFmeaRecord(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.fmea.batchStatusSuccess', { count: successCount, label }),
      );
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.fmea.batchStatusFailed'));
  };

  const fmeaStatusLabelMap: Record<string, string> = {
    DRAFT: t('app.kuaiplm.phase2.common.status.draft'),
    IN_REVIEW: t('app.kuaiplm.phase2.common.status.inReview'),
    CLOSED: t('app.kuaiplm.phase2.common.status.closed'),
    ARCHIVED: t('app.kuaiplm.phase2.common.status.archived'),
  };
  const riskLevelLabelMap: Record<string, string> = {
    高: t('app.kuaiplm.phase2.common.risk.high'),
    中: t('app.kuaiplm.phase2.common.risk.medium'),
    低: t('app.kuaiplm.phase2.common.risk.low'),
  };

  const columns: ProColumns<RdFmeaRecord>[] = [
    { title: t('app.kuaiplm.phase2.fmea.columns.code'), dataIndex: 'fmea_code', width: 140 },
    { title: t('app.kuaiplm.phase2.fmea.columns.title'), dataIndex: 'title', ellipsis: true },
    { title: t('app.kuaiplm.phase2.fmea.columns.type'), dataIndex: 'fmea_type', width: 100 },
    {
      title: t('app.kuaiplm.phase2.fmea.columns.status'),
      dataIndex: 'status',
      width: 90,
      valueEnum: Object.fromEntries(
        Object.entries(fmeaStatusLabelMap).map(([value, label]) => [value, { text: label }]),
      ),
      render: (_, row) => fmeaStatusLabelMap[row.status || ''] || row.status || '-',
    },
    {
      title: t('app.kuaiplm.phase2.fmea.columns.riskLevel'),
      dataIndex: 'risk_level',
      width: 100,
      render: (_, row) =>
        row.risk_level ? (
          <Tag color={RISK_COLOR[row.risk_level] ?? 'default'}>
            {riskLevelLabelMap[row.risk_level] || row.risk_level}
          </Tag>
        ) : (
          '-'
        ),
    },
    { title: t('app.kuaiplm.phase2.fmea.columns.owner'), dataIndex: 'owner_name', width: 100, hideInSearch: true },
    {
      title: t('app.kuaiplm.phase2.fmea.columns.updatedAt'),
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
              onClick={() => setDetailRecord(row)}
            >
              {t('common.detail')}
            </Button>,
            <Button
              {...rowActionKind('edit')}
              key="edit"
              type="link"
              size="small"
              onClick={() => setEditingRecord(row)}
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
                  title: t('app.kuaiplm.phase2.fmea.deleteOneTitle'),
                  onOk: async () => {
                    await deleteFmeaRecord(row.id!);
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
      <UniTable<RdFmeaRecord>
        headerTitle={t('app.kuaiplm.menu.phase2.fmea')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.phase2.fmea"
        request={async (params) => {
          const { current, pageSize } = params;
          try {
            const res = await listFmeaRecords({
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
        createButtonText={t('app.kuaiplm.phase2.fmea.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaiplm.phase2.fmea.deleteConfirmTitle', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="fmea-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              {
                key: 'batch-set-in-review',
                label: t('app.kuaiplm.phase2.fmea.batchSetInReview'),
                onClick: () => {
                  void handleBatchSetStatus('IN_REVIEW', t('app.kuaiplm.phase2.common.status.inReview'));
                },
              },
              {
                key: 'batch-set-closed',
                label: t('app.kuaiplm.phase2.fmea.batchSetClosed'),
                onClick: () => {
                  void handleBatchSetStatus('CLOSED', t('app.kuaiplm.phase2.common.status.closed'));
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.fmea.createTitle')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createFmeaRecord(values);
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label={t('app.kuaiplm.phase2.fmea.form.title')} rules={[{ required: true }]} />
        <ProFormSelect
          name="fmea_type"
          label={t('app.kuaiplm.phase2.fmea.form.fmeaType')}
          options={[
            { value: 'DFMEA', label: 'DFMEA' },
            { value: 'PFMEA', label: 'PFMEA' },
          ]}
        />
        <ProFormSelect
          name="risk_level"
          label={t('app.kuaiplm.phase2.fmea.form.riskLevel')}
          options={[
            { value: '高', label: t('app.kuaiplm.phase2.common.risk.high') },
            { value: '中', label: t('app.kuaiplm.phase2.common.risk.medium') },
            { value: '低', label: t('app.kuaiplm.phase2.common.risk.low') },
          ]}
        />
        <ProFormText name="owner_name" label={t('app.kuaiplm.phase2.fmea.form.owner')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.fmea.form.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.fmea.editTitle')}
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        isEdit
        initialValues={editingRecord || {}}
        onFinish={async (values) => {
          if (!editingRecord?.id) return;
          await updateFmeaRecord(editingRecord.id, values);
          messageApi.success(t('common.updateSuccess'));
          setEditingRecord(null);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label={t('app.kuaiplm.phase2.fmea.form.title')} rules={[{ required: true }]} />
        <ProFormSelect
          name="fmea_type"
          label={t('app.kuaiplm.phase2.fmea.form.fmeaType')}
          options={[
            { value: 'DFMEA', label: 'DFMEA' },
            { value: 'PFMEA', label: 'PFMEA' },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.fmea.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_REVIEW', label: t('app.kuaiplm.phase2.common.status.inReview') },
            { value: 'CLOSED', label: t('app.kuaiplm.phase2.common.status.closed') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormSelect
          name="risk_level"
          label={t('app.kuaiplm.phase2.fmea.form.riskLevel')}
          options={[
            { value: '高', label: t('app.kuaiplm.phase2.common.risk.high') },
            { value: '中', label: t('app.kuaiplm.phase2.common.risk.medium') },
            { value: '低', label: t('app.kuaiplm.phase2.common.risk.low') },
          ]}
        />
        <ProFormText name="owner_name" label={t('app.kuaiplm.phase2.fmea.form.owner')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.fmea.form.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.fmea.detailTitle')}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        readOnly
        initialValues={detailRecord || {}}
        onFinish={async () => {}}
      >
        <ProFormText name="fmea_code" label={t('app.kuaiplm.phase2.fmea.columns.code')} />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.fmea.form.title')} />
        <ProFormSelect
          name="fmea_type"
          label={t('app.kuaiplm.phase2.fmea.form.fmeaType')}
          options={[
            { value: 'DFMEA', label: 'DFMEA' },
            { value: 'PFMEA', label: 'PFMEA' },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.fmea.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_REVIEW', label: t('app.kuaiplm.phase2.common.status.inReview') },
            { value: 'CLOSED', label: t('app.kuaiplm.phase2.common.status.closed') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormSelect
          name="risk_level"
          label={t('app.kuaiplm.phase2.fmea.form.riskLevel')}
          options={[
            { value: '高', label: t('app.kuaiplm.phase2.common.risk.high') },
            { value: '中', label: t('app.kuaiplm.phase2.common.risk.medium') },
            { value: '低', label: t('app.kuaiplm.phase2.common.risk.low') },
          ]}
        />
        <ProFormText name="owner_name" label={t('app.kuaiplm.phase2.fmea.form.owner')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.fmea.form.description')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FmeaPage;
