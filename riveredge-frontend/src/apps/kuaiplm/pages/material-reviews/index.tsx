/**
 * 物料评审列表（R-15 #37）
 * 菜单待 DoD 后挂入；路由 /apps/kuaiplm/material-reviews
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form as AntForm, Input, Result, Row, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../components/uni-table';
import { UniTableDetail } from '../../../../components/uni-table-detail';
import { rowActionKind } from '../../../../components/uni-action';
import {
  DetailDrawerSection,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../components/layout-templates/detailDrawerDescriptionItems';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { todaySiteDateString } from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import { materialApi } from '../../../master-data/services/material';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import Phase2ProjectSelect from '../../components/Phase2ProjectSelect';
import {
  materialReviewApi,
  type MaterialReview,
  type MaterialReviewLine,
  type MaterialReviewStatus,
  type MaterialUsageStatus,
} from '../../services/material-review';

const RESOURCE = 'kuaiplm:material-review';
const STATUS_KEYS: MaterialReviewStatus[] = ['draft', 'pending', 'approved', 'rejected'];
const USAGE_KEYS: MaterialUsageStatus[] = ['preferred', 'limited', 'forbidden'];

const MATERIAL_REVIEW_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'review_code', title: '评审单号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'title', title: '标题' },
  { key: 'line_count', title: '物料行数' },
  { key: 'status_label', title: '状态' },
  { key: 'remarks', title: '备注' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const MaterialReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<MaterialReview[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialReview | null>(null);
  const [detail, setDetail] = useState<MaterialReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [materialOptions, setMaterialOptions] = useState<
    { value: number; label: string; code: string; name: string }[]
  >([]);

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.materialReview.status.${s}`, { defaultValue: s }),
    [t],
  );
  const usageLabel = useCallback(
    (s: string) => t(`app.kuaiplm.materialReview.usage.${s}`, { defaultValue: s }),
    [t],
  );

  const searchMaterials = useCallback(async (keyword?: string) => {
    const res = await materialApi.list({
      keyword: keyword?.trim() || undefined,
      limit: 50,
      isActive: true,
    });
    const items = res.items ?? [];
    setMaterialOptions((prev) => {
      const mapped = items.map((item: any) => ({
        value: Number(item.id),
        label: `${item.main_code ?? item.code ?? item.id} - ${item.name ?? ''}`.trim(),
        code: String(item.main_code ?? item.code ?? ''),
        name: String(item.name ?? ''),
      }));
      const byId = new Map<number, (typeof mapped)[number]>();
      [...prev, ...mapped].forEach((opt) => byId.set(opt.value, opt));
      return Array.from(byId.values());
    });
  }, []);

  const openDetail = useCallback(async (row: MaterialReview) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await materialReviewApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEdit = useCallback(
    async (row: MaterialReview) => {
      try {
        const full = await materialReviewApi.get(row.id);
        setEditing(full);
        const seeded = (full.lines || [])
          .filter((line) => line.material_id)
          .map((line) => ({
            value: Number(line.material_id),
            label: `${line.material_code} - ${line.material_name}`,
            code: line.material_code,
            name: line.material_name,
          }));
        setMaterialOptions(seeded);
        setModalOpen(true);
        void searchMaterials();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [messageApi, searchMaterials],
  );

  const lineColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t('app.kuaiplm.materialReview.fields.material'),
        dataIndex: 'material_code',
        width: 260,
        render: (_: unknown, __: unknown, index: number) => (
          <>
            <AntForm.Item name={[index, 'material_id']} hidden>
              <Input />
            </AntForm.Item>
            <AntForm.Item name={[index, 'material_code']} hidden rules={[{ required: true }]}>
              <Input />
            </AntForm.Item>
            <AntForm.Item name={[index, 'material_name']} hidden rules={[{ required: true }]}>
              <Input />
            </AntForm.Item>
            <AntForm.Item
              name={[index, '_material_pick']}
              rules={[{ required: true, message: t('common.required') }]}
              style={{ marginBottom: 0 }}
            >
              <Select
                showSearch
                filterOption={false}
                placeholder={t('app.kuaiplm.materialReview.fields.materialPlaceholder')}
                options={materialOptions}
                onSearch={(kw) => void searchMaterials(kw)}
                onOpenChange={(open) => {
                  if (open && !materialOptions.length) void searchMaterials();
                }}
                onChange={(value, option) => {
                  const opt = option as {
                    code?: string;
                    name?: string;
                    label?: string;
                  };
                  const form = formRef.current;
                  if (!form) return;
                  const lines = [...((form.getFieldValue('lines') as MaterialReviewLine[]) || [])];
                  const current = { ...(lines[index] || {}) };
                  current.material_id = Number(value);
                  current.material_code = opt?.code || '';
                  current.material_name = opt?.name || '';
                  (current as Record<string, unknown>)._material_pick = value;
                  lines[index] = current;
                  form.setFieldsValue({ lines });
                }}
              />
            </AntForm.Item>
          </>
        ),
      },
      {
        title: t('app.kuaiplm.materialReview.fields.usageStatus'),
        dataIndex: 'usage_status',
        width: 140,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'usage_status']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <Select
              size="small"
              options={USAGE_KEYS.map((k) => ({ value: k, label: usageLabel(k) }))}
            />
          </AntForm.Item>
        ),
      },
      {
        title: t('common.remark'),
        dataIndex: 'remarks',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'remarks']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
    ],
    [t, usageLabel, materialOptions, searchMaterials],
  );

  const columns = useMemo<ProColumns<MaterialReview>[]>(() => {
    const cols: ProColumns<MaterialReview>[] = [
      {
        title: t('app.kuaiplm.materialReview.fields.code'),
        dataIndex: 'review_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.materialReview.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        title: t('app.kuaiplm.materialReview.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.materialReview.fields.lineCount'),
        dataIndex: 'line_count',
        key: 'line_count',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        valueEnum: Object.fromEntries(STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }])),
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => {
          const actions: React.ReactNode[] = [
            <Button
              key="detail"
              type="link"
              size="small"
              {...rowActionKind('read')}
              onClick={() => void openDetail(row)}
            />,
          ];
          if ((row.status === 'draft' || row.status === 'rejected') && perms.canUpdate) {
            actions.push(
              <Button
                key="edit"
                type="link"
                size="small"
                {...rowActionKind('update')}
                onClick={() => void openEdit(row)}
              />,
            );
          }
          if (
            (row.status === 'draft' || row.status === 'rejected') &&
            perms.canAction?.('submit') &&
            row.id
          ) {
            actions.push(
              <Button
                key="submit"
                type="link"
                size="small"
                {...rowActionKind('submit')}
                onClick={async () => {
                  try {
                    await materialReviewApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.materialReview.messages.submitSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('approve') && row.id) {
            actions.push(
              <Button
                key="approve"
                type="link"
                size="small"
                {...rowActionKind('approve')}
                onClick={async () => {
                  try {
                    await materialReviewApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.materialReview.messages.approveSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('reject') && row.id) {
            actions.push(
              <Button
                key="reject"
                type="link"
                size="small"
                {...rowActionKind('reject')}
                onClick={async () => {
                  try {
                    await materialReviewApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.materialReview.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, openDetail, openEdit, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<MaterialReview>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.materialReview.fields.code'),
        dataIndex: 'review_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.materialReview.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        key: 'title',
        title: t('app.kuaiplm.materialReview.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'updated_at',
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
      },
    ];
    return alignDescriptionColumns(
      cols as ProDescriptionsItemProps<Record<string, unknown>>[],
      GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
    );
  }, [t, statusLabel]);

  return (
    <ListPageTemplate>
      <UniTable<MaterialReview>
        headerTitle={t('app.kuaiplm.materialReview.title')}
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.material-reviews.width-v2"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.materialReview.createButton') + NEW_SHORTCUT_HINT}
        onCreate={() => {
          void searchMaterials();
          openCreate();
        }}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const deletable = rows.filter(
            (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
          );
          if (!deletable.length) {
            messageApi.warning(t('app.kuaiplm.materialReview.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((r) => materialReviewApi.remove(r.id)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as MaterialReview[])
                : await fetchAllListItems((p) =>
                    materialReviewApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.materialReview.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `material-reviews-${todaySiteDateString()}.xlsx`,
              { columns: MATERIAL_REVIEW_EXPORT_COLUMNS, sheetName: '物料评审' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await materialReviewApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={editing ? t('common.edit') : t('common.create')}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        width={960}
        initialValues={
          editing
            ? {
                project_id: editing.project_id,
                title: editing.title,
                remarks: editing.remarks,
                lines: (editing.lines || []).map((line) => ({
                  ...line,
                  _material_pick: line.material_id,
                })),
              }
            : {
                project_id: filterProjectId,
                lines: [{ usage_status: 'preferred' }],
              }
        }
        onFinish={async (values) => {
          try {
            const lines = ((values.lines || []) as MaterialReviewLine[])
              .filter((m) => m?.material_code && m?.material_name && m?.usage_status)
              .map((m) => ({
                material_id: m.material_id ?? null,
                material_code: String(m.material_code).trim(),
                material_name: String(m.material_name).trim(),
                usage_status: String(m.usage_status).trim(),
                remarks: m.remarks || null,
              }));
            if (!lines.length) {
              messageApi.error(t('app.kuaiplm.materialReview.messages.lineRequired'));
              throw new Error('line required');
            }
            const payload = {
              project_id: Number(values.project_id),
              title: String(values.title || '').trim(),
              remarks: values.remarks || null,
              lines,
            };
            if (editing?.id) {
              await materialReviewApi.update(editing.id, payload);
            } else {
              await materialReviewApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            setEditing(null);
            reload();
          } catch (e) {
            if ((e as Error)?.message !== 'line required') {
              messageApi.error(getApiErrorMessage(e));
            }
            throw e;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Phase2ProjectSelect
              name="project_id"
              label={t('app.kuaiplm.materialReview.fields.project')}
              rules={[{ required: true }]}
              disabled={!!editing}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.materialReview.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remark')} />
          </Col>
        </Row>
        <UniTableDetail
          name="lines"
          title={t('app.kuaiplm.materialReview.fields.lines')}
          required
          requiredMessage={t('app.kuaiplm.materialReview.messages.lineRequired')}
          columns={lineColumns}
          initialValue={{ usage_status: 'preferred' }}
          minRows={1}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.review_code || t('app.kuaiplm.materialReview.title')}
        loading={detailLoading}
        plainBody={
          detailError ? (
            <Result
              status="error"
              title={t('common.loadFailed')}
              subTitle={detailError}
              extra={
                detail?.id ? (
                  <Button type="primary" onClick={() => void openDetail(detail)}>
                    {t('common.retry')}
                  </Button>
                ) : null
              }
            />
          ) : undefined
        }
        basic={
          detail && !detailError ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={detailDrawerDescriptionItems(basicColumns, detail)}
            />
          ) : detailError ? null : (
            <div style={{ minHeight: 80 }} />
          )
        }
        lines={
          detail && !detailError ? (
            <DetailDrawerSection title={t('app.kuaiplm.materialReview.fields.lines')} titleAccent>
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => String(r.id ?? `${r.material_code}-${r.usage_status}`)}
                dataSource={detail.lines || []}
                columns={[
                  {
                    title: t('app.kuaiplm.materialReview.fields.materialCode'),
                    dataIndex: 'material_code',
                    width: 140,
                  },
                  {
                    title: t('app.kuaiplm.materialReview.fields.materialName'),
                    dataIndex: 'material_name',
                  },
                  {
                    title: t('app.kuaiplm.materialReview.fields.usageStatus'),
                    dataIndex: 'usage_status',
                    width: 120,
                    render: (v: string) => <MarkerTag>{usageLabel(v)}</MarkerTag>,
                  },
                  {
                    title: t('common.remark'),
                    dataIndex: 'remarks',
                  },
                ]}
              />
            </DetailDrawerSection>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default MaterialReviewsPage;
