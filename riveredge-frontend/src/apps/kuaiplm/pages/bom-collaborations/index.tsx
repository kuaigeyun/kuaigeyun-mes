/**
 * BOM 协同列表（R-15 #65）
 * 多分区并行填写互不覆盖（展示名走 form-profile）；审核后文员录入。
 * 路由 /apps/kuaiplm/bom-collaborations
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Descriptions,
  Form as AntForm,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Space,
  Table,
} from 'antd';
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
import { isIndustryFormProfileActive } from '../../../../utils/industryFormProfile';
import {
  buildEmptyLineRecord,
  buildLineDetailColumns,
  flattenLineForForm,
  isDecimalLineColumn,
  prepareLineForApi,
  sortedLineColumns,
  type BomCollabProfileColumn,
} from '../../utils/bomCollabFormProfile';
import {
  bomCollabApi,
  type BomCollabFormProfile,
  type BomCollabLine,
  type BomCollaboration,
  type BomCollabStatus,
} from '../../services/bom-collaboration';

const RESOURCE = 'kuaiplm:bom-collab';
const STATUS_KEYS: BomCollabStatus[] = ['draft', 'pending', 'approved', 'entered', 'rejected'];

function normalizeLines(
  raw: BomCollabLine[] | undefined,
  columns: BomCollabProfileColumn[],
  industryActive: boolean,
): BomCollabLine[] {
  return (raw || [])
    .filter((m) => {
      const code = String(m?.material_code ?? '').trim();
      const name = String(m?.material_name ?? '').trim();
      return code && name;
    })
    .map((m) => {
      if (industryActive) {
        return prepareLineForApi(m as Record<string, unknown>, columns);
      }
      return {
        material_id: m.material_id ?? null,
        material_code: String(m.material_code).trim(),
        material_name: String(m.material_name).trim(),
        qty: m.qty ?? null,
        unit: m.unit || null,
        remarks: m.remarks || null,
      };
    });
}

function mapLinesForForm(
  lines: BomCollabLine[] | undefined,
  industryActive: boolean,
): Record<string, unknown>[] {
  if (!lines?.length) return [];
  if (!industryActive) return lines;
  return lines.map((line) => flattenLineForForm(line));
}

const BomCollaborationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const [formProfile, setFormProfile] = useState<BomCollabFormProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void bomCollabApi
      .formProfile()
      .then((p) => {
        if (!cancelled) setFormProfile(p);
      })
      .catch((e) => {
        if (!cancelled) messageApi.error(getApiErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  const industryProfileActive = isIndustryFormProfileActive(formProfile);
  const profileLineColumns = useMemo(
    () => sortedLineColumns(industryProfileActive ? formProfile : null),
    [formProfile, industryProfileActive],
  );
  const emptyLineRecord = useMemo(
    () =>
      industryProfileActive
        ? buildEmptyLineRecord(profileLineColumns)
        : { material_code: '', material_name: '' },
    [industryProfileActive, profileLineColumns],
  );

  const sectionLabel = useCallback(
    (key: 'electronics' | 'structure') => {
      if (industryProfileActive) {
        const hit = formProfile?.sections?.find((s) => s.key === key);
        if (hit?.label) return hit.label;
      }
      return key === 'electronics'
        ? t('app.kuaiplm.bomCollab.fields.electronics')
        : t('app.kuaiplm.bomCollab.fields.structure');
    },
    [formProfile, industryProfileActive, t],
  );
  const electronicsLabel = sectionLabel('electronics');
  const structureLabel = sectionLabel('structure');

  const bomExportColumns = useMemo(
    (): ExportXlsxColumn[] => [
      { key: 'collab_code', title: '协同单号' },
      { key: 'project_code', title: '项目代号' },
      { key: 'project_name', title: '项目名称' },
      { key: 'title', title: '标题' },
      { key: 'electronics_status_label', title: electronicsLabel },
      { key: 'electronics_line_count', title: `${electronicsLabel}行数` },
      { key: 'structure_status_label', title: structureLabel },
      { key: 'structure_line_count', title: `${structureLabel}行数` },
      { key: 'master_bom_code', title: '主数据 BOM' },
      { key: 'status_label', title: '状态' },
      { key: 'remarks', title: '备注' },
      { key: 'created_by_name', title: '创建人' },
      { key: 'updated_by_name', title: '更新人' },
      { key: 'created_at', title: '创建时间' },
      { key: 'updated_at', title: '更新时间' },
    ],
    [electronicsLabel, structureLabel],
  );

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<BomCollaboration[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BomCollaboration | null>(null);
  const [detail, setDetail] = useState<BomCollaboration | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [enterOpen, setEnterOpen] = useState(false);
  const [enterBomCode, setEnterBomCode] = useState('');
  const [enterTargetId, setEnterTargetId] = useState<number | null>(null);

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.bomCollab.status.${s}`, { defaultValue: s }),
    [t],
  );
  const sectionStatusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.bomCollab.sectionStatus.${s}`, { defaultValue: s }),
    [t],
  );

  const openDetail = useCallback(async (row: BomCollaboration) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await bomCollabApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEdit = useCallback(
    async (row: BomCollaboration) => {
      try {
        const full = await bomCollabApi.get(row.id);
        setEditing(full);
        setModalOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [messageApi],
  );

  const lineColumns = useMemo<ColumnsType>(() => {
    if (!industryProfileActive) {
      return [
        {
          title: t('app.kuaiplm.bomCollab.fields.materialCode'),
          dataIndex: 'material_code',
          width: 140,
          render: (_: unknown, __: unknown, index: number) => (
            <AntForm.Item
              name={[index, 'material_code']}
              rules={[{ required: true, message: t('common.required') }]}
              style={{ marginBottom: 0 }}
            >
              <Input size="small" />
            </AntForm.Item>
          ),
        },
        {
          title: t('app.kuaiplm.bomCollab.fields.materialName'),
          dataIndex: 'material_name',
          render: (_: unknown, __: unknown, index: number) => (
            <AntForm.Item
              name={[index, 'material_name']}
              rules={[{ required: true, message: t('common.required') }]}
              style={{ marginBottom: 0 }}
            >
              <Input size="small" />
            </AntForm.Item>
          ),
        },
        {
          title: t('app.kuaiplm.bomCollab.fields.qty'),
          dataIndex: 'qty',
          width: 100,
          render: (_: unknown, __: unknown, index: number) => (
            <AntForm.Item name={[index, 'qty']} style={{ marginBottom: 0 }}>
              <InputNumber size="small" style={{ width: '100%' }} />
            </AntForm.Item>
          ),
        },
        {
          title: t('app.kuaiplm.bomCollab.fields.unit'),
          dataIndex: 'unit',
          width: 80,
          render: (_: unknown, __: unknown, index: number) => (
            <AntForm.Item name={[index, 'unit']} style={{ marginBottom: 0 }}>
              <Input size="small" />
            </AntForm.Item>
          ),
        },
      ];
    }

    return profileLineColumns.map((col) => ({
      title: col.label,
      dataIndex: col.key,
      width: col.width,
      render: (_: unknown, __: unknown, index: number) => {
        const rules = col.required ? [{ required: true, message: t('common.required') }] : undefined;
        if (isDecimalLineColumn(col)) {
          return (
            <AntForm.Item name={[index, col.key]} rules={rules} style={{ marginBottom: 0 }}>
              <InputNumber size="small" style={{ width: '100%' }} />
            </AntForm.Item>
          );
        }
        return (
          <AntForm.Item name={[index, col.key]} rules={rules} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        );
      },
    }));
  }, [industryProfileActive, profileLineColumns, t]);

  const columns = useMemo<ProColumns<BomCollaboration>[]>(() => {
    const cols: ProColumns<BomCollaboration>[] = [
      {
        title: t('app.kuaiplm.bomCollab.fields.code'),
        dataIndex: 'collab_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.bomCollab.fields.project'),
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
        title: t('app.kuaiplm.bomCollab.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: electronicsLabel,
        dataIndex: 'electronics_status',
        key: 'electronics_status',
        width: 100,
        hideInSearch: true,
        render: (_, r) => (
          <MarkerTag>
            {sectionStatusLabel(r.electronics_status)} ({r.electronics_line_count ?? 0})
          </MarkerTag>
        ),
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: structureLabel,
        dataIndex: 'structure_status',
        key: 'structure_status',
        width: 100,
        hideInSearch: true,
        render: (_, r) => (
          <MarkerTag>
            {sectionStatusLabel(r.structure_status)} ({r.structure_line_count ?? 0})
          </MarkerTag>
        ),
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
                    await bomCollabApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.bomCollab.messages.submitSuccess'));
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
                    await bomCollabApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.bomCollab.messages.approveSuccess'));
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
                    await bomCollabApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.bomCollab.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'approved' && perms.canAction?.('execute') && row.id) {
            actions.push(
              <Button
                key="enter"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={() => {
                  setEnterTargetId(row.id);
                  setEnterBomCode('');
                  setEnterOpen(true);
                }}
              />,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, sectionStatusLabel, electronicsLabel, structureLabel, openDetail, openEdit, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<BomCollaboration>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.bomCollab.fields.code'),
        dataIndex: 'collab_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.bomCollab.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        key: 'title',
        title: t('app.kuaiplm.bomCollab.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'master_bom_code',
        title: t('app.kuaiplm.bomCollab.fields.masterBom'),
        dataIndex: 'master_bom_code',
        render: (_, r) => r.master_bom_code || '—',
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

  const detailLineColumns = useMemo(
    () =>
      industryProfileActive
        ? buildLineDetailColumns(formProfile, t)
        : [
            {
              title: t('app.kuaiplm.bomCollab.fields.materialCode'),
              dataIndex: 'material_code',
              width: 140,
            },
            {
              title: t('app.kuaiplm.bomCollab.fields.materialName'),
              dataIndex: 'material_name',
            },
            {
              title: t('app.kuaiplm.bomCollab.fields.qty'),
              dataIndex: 'qty',
              width: 90,
            },
            {
              title: t('app.kuaiplm.bomCollab.fields.unit'),
              dataIndex: 'unit',
              width: 80,
            },
          ],
    [formProfile, industryProfileActive, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<BomCollaboration>
        headerTitle={t('app.kuaiplm.bomCollab.title')}
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
        columnPersistenceId="apps.kuaiplm.pages.bom-collaborations.width-v3"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.bomCollab.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const deletable = rows.filter(
            (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
          );
          if (!deletable.length) {
            messageApi.warning(t('app.kuaiplm.bomCollab.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((r) => bomCollabApi.remove(r.id)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as BomCollaboration[])
                : await fetchAllListItems((p) =>
                    bomCollabApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.bomCollab.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
              electronics_status_label: sectionStatusLabel(r.electronics_status),
              structure_status_label: sectionStatusLabel(r.structure_status),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `bom-collaborations-${todaySiteDateString()}.xlsx`,
              { columns: bomExportColumns, sheetName: 'BOM协同' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await bomCollabApi.list({
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
                electronics_lines: editing.electronics_lines?.length
                  ? mapLinesForForm(editing.electronics_lines, industryProfileActive)
                  : [emptyLineRecord],
                structure_lines: editing.structure_lines?.length
                  ? mapLinesForForm(editing.structure_lines, industryProfileActive)
                  : [emptyLineRecord],
              }
            : {
                project_id: filterProjectId,
                electronics_lines: [emptyLineRecord],
                structure_lines: [emptyLineRecord],
              }
        }
        onFinish={async (values) => {
          try {
            const electronics = normalizeLines(
              values.electronics_lines,
              profileLineColumns,
              industryProfileActive,
            );
            const structure = normalizeLines(
              values.structure_lines,
              profileLineColumns,
              industryProfileActive,
            );
            if (editing?.id) {
              await bomCollabApi.update(editing.id, {
                title: String(values.title || '').trim(),
                remarks: values.remarks || null,
              });
              // 分区独立写入，互不覆盖
              await bomCollabApi.updateSection(editing.id, 'electronics', electronics);
              await bomCollabApi.updateSection(editing.id, 'structure', structure);
            } else {
              await bomCollabApi.create({
                project_id: Number(values.project_id),
                title: String(values.title || '').trim(),
                remarks: values.remarks || null,
                electronics_lines: electronics,
                structure_lines: structure,
              });
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            setEditing(null);
            reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Phase2ProjectSelect
              name="project_id"
              label={t('app.kuaiplm.bomCollab.fields.project')}
              rules={[{ required: true }]}
              disabled={!!editing}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.bomCollab.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remark')} />
          </Col>
        </Row>
        <UniTableDetail
          name="electronics_lines"
          title={`${electronicsLabel}${t('app.kuaiplm.bomCollab.fields.linesSuffix')}`}
          columns={lineColumns}
          initialValue={emptyLineRecord}
          minRows={1}
        />
        <UniTableDetail
          name="structure_lines"
          title={`${structureLabel}${t('app.kuaiplm.bomCollab.fields.linesSuffix')}`}
          columns={lineColumns}
          initialValue={emptyLineRecord}
          minRows={1}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.collab_code || t('app.kuaiplm.bomCollab.title')}
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
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <DetailDrawerSection
                title={`${electronicsLabel} (${sectionStatusLabel(detail.electronics_status)})`}
                titleAccent
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => String(r.id ?? r.material_code)}
                  dataSource={detail.electronics_lines || []}
                  columns={detailLineColumns}
                />
              </DetailDrawerSection>
              <DetailDrawerSection
                title={`${structureLabel} (${sectionStatusLabel(detail.structure_status)})`}
                titleAccent
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => String(r.id ?? r.material_code)}
                  dataSource={detail.structure_lines || []}
                  columns={detailLineColumns}
                />
              </DetailDrawerSection>
            </Space>
          ) : null
        }
      />

      <Modal
        title={t('app.kuaiplm.bomCollab.actions.enter')}
        open={enterOpen}
        destroyOnHidden
        onCancel={() => setEnterOpen(false)}
        onOk={async () => {
          if (!enterTargetId) return;
          try {
            await bomCollabApi.enter(enterTargetId, {
              master_bom_code: enterBomCode.trim() || null,
            });
            messageApi.success(t('app.kuaiplm.bomCollab.messages.enterSuccess'));
            setEnterOpen(false);
            reload();
            if (detail?.id === enterTargetId) {
              await openDetail({ ...detail, id: enterTargetId });
            }
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <Input
          value={enterBomCode}
          onChange={(e) => setEnterBomCode(e.target.value)}
          placeholder={t('app.kuaiplm.bomCollab.fields.masterBomPlaceholder')}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default BomCollaborationsPage;
