/**
 * 样机制作书（研发项目 §2.15）
 * 项目发起 → 电子/结构并行填写 → 审核下发 → 制造/质量会签
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Input, Modal, Result, Row, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind } from '../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
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
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import Phase2ProjectSelect from '../../components/Phase2ProjectSelect';
import {
  prototypeBuildSheetApi,
  type PrototypeBuildRound,
  type PrototypeBuildSheet,
  type PrototypeBuildSheetStatus,
} from '../../services/prototype-build-sheet';

const RESOURCE = 'kuaiplm:prototype-build-sheet';
const STATUS_KEYS: PrototypeBuildSheetStatus[] = [
  'draft',
  'pending',
  'approved',
  'issued',
  'closed',
  'rejected',
];
const ROUND_KEYS: PrototypeBuildRound[] = ['handboard', 't1', 't2', 't3'];

const EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'sheet_code', title: '单号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'round_label', title: '样机轮次' },
  { key: 'title', title: '标题' },
  { key: 'status_label', title: '状态' },
  { key: 'electronics_status', title: '电子填写状态' },
  { key: 'structure_status', title: '结构填写状态' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const PrototypeBuildSheetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<PrototypeBuildSheet[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrototypeBuildSheet | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'electronics' | 'structure'>('electronics');
  const [sectionText, setSectionText] = useState('');
  const [mfgOpinion, setMfgOpinion] = useState('');
  const [qaOpinion, setQaOpinion] = useState('');
  const [detail, setDetail] = useState<PrototypeBuildSheet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.prototypeBuildSheet.status.${s}`, { defaultValue: s }),
    [t],
  );
  const roundLabel = useCallback(
    (s: string) => t(`app.kuaiplm.prototypeBuildSheet.round.${s}`, { defaultValue: s }),
    [t],
  );

  const openDetail = useCallback(async (row: PrototypeBuildSheet) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await prototypeBuildSheetApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(
    async (id: number) => {
      const full = await prototypeBuildSheetApi.get(id);
      setDetail(full);
      reload();
      return full;
    },
    [reload],
  );

  const openEdit = useCallback((row: PrototypeBuildSheet) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  const columns = useMemo<ProColumns<PrototypeBuildSheet>[]>(() => {
    const cols: ProColumns<PrototypeBuildSheet>[] = [
      {
        title: t('app.kuaiplm.prototypeBuildSheet.fields.code'),
        dataIndex: 'sheet_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.prototypeBuildSheet.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => `${r.project_name} (${r.project_code})`,
      },
      {
        title: t('app.kuaiplm.prototypeBuildSheet.fields.round'),
        dataIndex: 'round_key',
        key: 'round_key',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueEnum: Object.fromEntries(ROUND_KEYS.map((k) => [k, { text: roundLabel(k) }])),
        render: (_, r) => <MarkerTag variant="filled">{roundLabel(r.round_key)}</MarkerTag>,
      },
      {
        title: t('app.kuaiplm.prototypeBuildSheet.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
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
                onClick={() => openEdit(row)}
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
                    await prototypeBuildSheetApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.prototypeBuildSheet.messages.submitSuccess'));
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
                    await prototypeBuildSheetApi.approve(row.id);
                    messageApi.success(t('common.approveSuccess'));
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
                    await prototypeBuildSheetApi.reject(row.id);
                    messageApi.success(t('common.rejectSuccess'));
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
                key="issue"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={async () => {
                  try {
                    await prototypeBuildSheetApi.issue(row.id);
                    messageApi.success(t('app.kuaiplm.prototypeBuildSheet.messages.issued'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.prototypeBuildSheet.actions.issue')}
              </Button>,
            );
          }
          return actions;
        },
      },
    ];
    return alignProColumns(cols, GLOBAL_DOC_LIST_FIELD_RANK);
  }, [messageApi, openDetail, openEdit, perms, reload, roundLabel, statusLabel, t]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<PrototypeBuildSheet>
          actionRef={actionRef}
          rowKey="uuid"
          permissionResource={RESOURCE}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columnPersistenceId="apps.kuaiplm.pages.prototype-build-sheets.width-v3"
          headerTitle={t('app.kuaiplm.prototypeBuildSheet.title')}
          showCreateButton={perms.canCreate}
          createButtonText={t('app.kuaiplm.prototypeBuildSheet.createButton') + NEW_SHORTCUT_HINT}
          onCreate={openCreate}
          showDeleteButton={perms.canDelete}
          onDelete={async (keys) => {
            const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
            const deletable = rows.filter(
              (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
            );
            if (!deletable.length) {
              messageApi.warning(t('app.kuaiplm.prototypeBuildSheet.messages.deleteOnlyDraft'));
              return;
            }
            await Promise.all(deletable.map((r) => prototypeBuildSheetApi.remove(r.id)));
            messageApi.success(t('common.deleteSuccess'));
            setSelectedRowKeys([]);
            reload();
          }}
          showExportButton={perms.canExport}
          onExport={async (type, keys, pageData) => {
            try {
              let items =
                type === 'currentPage' && pageData?.length
                  ? (pageData as PrototypeBuildSheet[])
                  : await fetchAllListItems((p) =>
                      prototypeBuildSheetApi.list({
                        ...p,
                        project_id: filterProjectId,
                      }),
                    );
              if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('app.kuaiplm.prototypeBuildSheet.messages.noExportData'));
                return;
              }
              const rows = items.map((r) => ({
                ...r,
                status_label: statusLabel(r.status),
                round_label: roundLabel(r.round_key),
              }));
              await downloadRecordsAsXlsx(
                rows as Array<Record<string, unknown>>,
                `prototype-build-sheets-${todaySiteDateString()}.xlsx`,
                { columns: EXPORT_COLUMNS, sheetName: '样机制作书' },
              );
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (err) {
              messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
            }
          }}
          columns={columns}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params) => {
            const res = await prototypeBuildSheetApi.list({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              keyword: params.keyword as string | undefined,
              status: params.status as string | undefined,
              project_id: filterProjectId,
            });
            return { data: res.items, success: true, total: res.total };
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={
          editing
            ? t('common.edit') + t('app.kuaiplm.prototypeBuildSheet.title')
            : t('app.kuaiplm.prototypeBuildSheet.createButton')
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        initialValues={
          editing
            ? {
                project_id: editing.project_id,
                round_key: editing.round_key,
                title: editing.title,
                project_requirements: editing.project_requirements,
                remarks: editing.remarks,
              }
            : filterProjectId
              ? { project_id: filterProjectId, round_key: 't1' }
              : { round_key: 't1' }
        }
        onFinish={async (values) => {
          try {
            const payload = {
              title: String(values.title || '').trim(),
              project_requirements: values.project_requirements || undefined,
              remarks: values.remarks || undefined,
            };
            if (editing?.id) {
              await prototypeBuildSheetApi.update(editing.id, payload);
            } else {
              await prototypeBuildSheetApi.create({
                project_id: Number(values.project_id),
                round_key: values.round_key as string,
                ...payload,
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
              rules={[{ required: true }]}
              disabled={!!editing}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="round_key"
              label={t('app.kuaiplm.prototypeBuildSheet.fields.round')}
              rules={[{ required: true }]}
              disabled={!!editing}
              options={ROUND_KEYS.map((k) => ({ value: k, label: roundLabel(k) }))}
            />
          </Col>
          <Col span={24}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.prototypeBuildSheet.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="project_requirements"
              label={t('app.kuaiplm.prototypeBuildSheet.fields.projectRequirements')}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remark')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.title}
        subtitle={detail?.sheet_code}
        loading={detailLoading}
        size={DRAWER_CONFIG.HALF_WIDTH}
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
        extra={
          detail && !detailError ? (
            <Space wrap>
              {perms.canUpdate && ['draft', 'rejected'].includes(detail.status) ? (
                <>
                  <Button size="small" onClick={() => openEdit(detail)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setActiveSection('electronics');
                      setSectionText(detail.electronics_requirements || '');
                      setSectionOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.prototypeBuildSheet.actions.fillElectronics')}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setActiveSection('structure');
                      setSectionText(detail.structure_requirements || '');
                      setSectionOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.prototypeBuildSheet.actions.fillStructure')}
                  </Button>
                </>
              ) : null}
              {perms.canAction?.('submit') && ['draft', 'rejected'].includes(detail.status) ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={async () => {
                    try {
                      await prototypeBuildSheetApi.submit(detail.id);
                      messageApi.success(t('app.kuaiplm.prototypeBuildSheet.messages.submitSuccess'));
                      await refreshDetail(detail.id);
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('common.submit')}
                </Button>
              ) : null}
              {perms.canAction?.('approve') && detail.status === 'pending' ? (
                <>
                  <Button
                    size="small"
                    onClick={async () => {
                      await prototypeBuildSheetApi.approve(detail.id);
                      messageApi.success(t('common.approveSuccess'));
                      await refreshDetail(detail.id);
                    }}
                  >
                    {t('common.approve')}
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={async () => {
                      await prototypeBuildSheetApi.reject(detail.id);
                      messageApi.success(t('common.rejectSuccess'));
                      await refreshDetail(detail.id);
                    }}
                  >
                    {t('common.reject')}
                  </Button>
                </>
              ) : null}
              {perms.canAction?.('execute') && detail.status === 'approved' ? (
                <Button
                  size="small"
                  onClick={async () => {
                    await prototypeBuildSheetApi.issue(detail.id);
                    messageApi.success(t('app.kuaiplm.prototypeBuildSheet.messages.issued'));
                    await refreshDetail(detail.id);
                  }}
                >
                  {t('app.kuaiplm.prototypeBuildSheet.actions.issue')}
                </Button>
              ) : null}
              {perms.canUpdate && ['approved', 'issued'].includes(detail.status) ? (
                <Button
                  size="small"
                  onClick={() => {
                    setMfgOpinion(detail.manufacturing_opinion || '');
                    setQaOpinion(detail.quality_opinion || '');
                    setSignoffOpen(true);
                  }}
                >
                  {t('app.kuaiplm.prototypeBuildSheet.actions.signoff')}
                </Button>
              ) : null}
              {perms.canAction?.('complete') && ['issued', 'approved'].includes(detail.status) ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={async () => {
                    try {
                      await prototypeBuildSheetApi.close(detail.id);
                      messageApi.success(t('common.closeSuccess'));
                      await refreshDetail(detail.id);
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('common.close')}
                </Button>
              ) : null}
            </Space>
          ) : undefined
        }
        basic={
          detail && !detailError ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              items={detailDrawerDescriptionItems([
                {
                  key: 'project',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.project'),
                  children: `${detail.project_name} (${detail.project_code})`,
                },
                {
                  key: 'round',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.round'),
                  children: roundLabel(detail.round_key),
                },
                {
                  key: 'status',
                  label: t('common.status'),
                  children: statusLabel(detail.status),
                },
                {
                  key: 'electronics_status',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.electronicsStatus'),
                  children: detail.electronics_status,
                },
                {
                  key: 'structure_status',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.structureStatus'),
                  children: detail.structure_status,
                },
                {
                  key: 'project_requirements',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.projectRequirements'),
                  children: detail.project_requirements || '—',
                },
                {
                  key: 'electronics_requirements',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.electronicsRequirements'),
                  children: detail.electronics_requirements || '—',
                },
                {
                  key: 'structure_requirements',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.structureRequirements'),
                  children: detail.structure_requirements || '—',
                },
                {
                  key: 'manufacturing_opinion',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.manufacturingOpinion'),
                  children: detail.manufacturing_opinion || '—',
                },
                {
                  key: 'quality_opinion',
                  label: t('app.kuaiplm.prototypeBuildSheet.fields.qualityOpinion'),
                  children: detail.quality_opinion || '—',
                },
              ])}
            />
          ) : detailError ? null : (
            <div style={{ minHeight: 80 }} />
          )
        }
      />

      <Modal
        title={
          activeSection === 'electronics'
            ? t('app.kuaiplm.prototypeBuildSheet.actions.fillElectronics')
            : t('app.kuaiplm.prototypeBuildSheet.actions.fillStructure')
        }
        open={sectionOpen}
        onCancel={() => setSectionOpen(false)}
        destroyOnHidden
        onOk={async () => {
          if (!detail) return;
          try {
            await prototypeBuildSheetApi.updateSection(detail.id, activeSection, {
              requirements: sectionText,
            });
            messageApi.success(t('common.saveSuccess'));
            setSectionOpen(false);
            await refreshDetail(detail.id);
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <div>
          <div style={{ marginBottom: 8 }}>
            {t('app.kuaiplm.prototypeBuildSheet.fields.requirements')}
          </div>
          <Input.TextArea rows={6} value={sectionText} onChange={(e) => setSectionText(e.target.value)} />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.prototypeBuildSheet.actions.signoff')}
        open={signoffOpen}
        onCancel={() => setSignoffOpen(false)}
        destroyOnHidden
        onOk={async () => {
          if (!detail) return;
          try {
            await prototypeBuildSheetApi.updateSignoff(detail.id, {
              manufacturing_opinion: mfgOpinion,
              quality_opinion: qaOpinion,
            });
            messageApi.success(t('common.saveSuccess'));
            setSignoffOpen(false);
            await refreshDetail(detail.id);
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            {t('app.kuaiplm.prototypeBuildSheet.fields.manufacturingOpinion')}
          </div>
          <Input.TextArea value={mfgOpinion} onChange={(e) => setMfgOpinion(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>
            {t('app.kuaiplm.prototypeBuildSheet.fields.qualityOpinion')}
          </div>
          <Input.TextArea value={qaOpinion} onChange={(e) => setQaOpinion(e.target.value)} />
        </div>
      </Modal>
    </>
  );
};

export default PrototypeBuildSheetsPage;
