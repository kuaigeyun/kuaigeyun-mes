import { rowActionKind } from '../../../../../components/uni-action';
/**
 * FMEA 记录（Phase2）
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Alert } from 'antd';
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
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  plmCodeTitleSearchColumns,
  plmCreatedUpdatedColumns,
  plmListActionColumn,
  PLM_PHASE2_PINNED_STATUS_FIELD,
  resolvePhase2FmeaListParams,
} from '../../../utils/plmListCore';
import {
  buildPhase2FmeaStatusValueEnum,
  getPhase2FmeaStatusOptions,
  renderPhase2FmeaStatusTag,
  renderPhase2FmeaTypeMarker,
} from '../../../components/phase2Meta';

const FmeaPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
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

  const fmeaStatusValueEnum = useMemo(() => buildPhase2FmeaStatusValueEnum(t), [t]);
  const fmeaStatusOptions = useMemo(() => getPhase2FmeaStatusOptions(t), [t]);

  const columns: ProColumns<RdFmeaRecord>[] = useMemo(
    () => [
      ...plmCodeTitleSearchColumns({
        codeLabel: t('app.kuaiplm.phase2.fmea.columns.code'),
        titleLabel: t('app.kuaiplm.phase2.fmea.columns.title'),
        codeField: 'fmea_code',
        titleField: 'title',
      }),
      {
        title: t('app.kuaiplm.phase2.fmea.columns.code'),
        dataIndex: 'fmea_code',
        width: 140,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.fmea.columns.title'),
        dataIndex: 'title',
        sorter: true,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.fmea.columns.type'),
        dataIndex: 'fmea_type',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderPhase2FmeaTypeMarker(row.fmea_type),
      },
      {
        title: t('app.kuaiplm.phase2.fmea.columns.material'),
        dataIndex: 'material_name',
        width: 160,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => row.material_name || row.material_code || '-',
      },
      {
        title: t('app.kuaiplm.phase2.fmea.columns.status'),
        dataIndex: 'status',
        width: 90,
        valueEnum: fmeaStatusValueEnum,
        render: (_, row) => renderPhase2FmeaStatusTag(t, row.status),
      },
      ...plmCreatedUpdatedColumns<RdFmeaRecord>(t),
      plmListActionColumn<RdFmeaRecord>(t, (_, row) => [
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
          ]),
    ],
    [fmeaStatusValueEnum, messageApi, modalApi, t],
  );

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
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.phase2.fmea"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={PLM_PHASE2_PINNED_STATUS_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const listParams = resolvePhase2FmeaListParams(searchFormValues, sort, {
            projectId: filterProjectId,
          });
          lastListParamsRef.current = listParams;
          try {
            const res = await listFmeaRecords({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...listParams,
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
        <ProFormText name="material_code" label={t('app.kuaiplm.phase2.fmea.form.materialCode')} />
        <ProFormText name="material_name" label={t('app.kuaiplm.phase2.fmea.form.materialName')} />
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
          options={fmeaStatusOptions}
        />
        <ProFormText name="material_code" label={t('app.kuaiplm.phase2.fmea.form.materialCode')} />
        <ProFormText name="material_name" label={t('app.kuaiplm.phase2.fmea.form.materialName')} />
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
          options={fmeaStatusOptions}
        />
        <ProFormText name="material_code" label={t('app.kuaiplm.phase2.fmea.form.materialCode')} />
        <ProFormText name="material_name" label={t('app.kuaiplm.phase2.fmea.form.materialName')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.phase2.fmea.form.description')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FmeaPage;
