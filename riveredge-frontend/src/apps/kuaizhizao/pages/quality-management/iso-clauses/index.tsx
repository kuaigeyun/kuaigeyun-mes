import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormItem,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Empty, Row, Space, Table, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerSection,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  alignDescriptionColumns,
  alignProColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { renderMasterActiveTag } from '../../../../master-data/utils/masterListPresentation';
import { MASTER_DATA_LIST_FIELD_RANK } from '../../../../master-data/utils/processListCore';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import {
  qualityQmsApi,
  QmsInternalAudit,
  QmsIsoClause,
  QmsIsoClauseComplianceSummary,
  QmsSystemDocument,
} from '../../../services/quality-qms';
import QmsIsoClauseSelect from '../qms/QmsIsoClauseSelect';

const RESOURCE = 'kuaizhizao:quality-management-iso-clauses';
const DEFAULT_STANDARD = 'ISO9001:2015';

function renderComplianceTag(t: (key: string) => string, status?: string) {
  if (status === 'covered') {
    return <MarkerTag color="success">{t('app.kuaizhizao.quality.isoClauses.compliance.covered')}</MarkerTag>;
  }
  if (status === 'review_due') {
    return <MarkerTag color="warning">{t('app.kuaizhizao.quality.isoClauses.compliance.reviewDue')}</MarkerTag>;
  }
  return <MarkerTag color="error">{t('app.kuaizhizao.quality.isoClauses.compliance.gap')}</MarkerTag>;
}

const IsoClausesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<QmsIsoClause[]>([]);
  const formRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [standardFilter, setStandardFilter] = useState<string>(DEFAULT_STANDARD);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QmsIsoClause | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<QmsIsoClause | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QmsIsoClauseComplianceSummary | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<QmsSystemDocument[]>([]);
  const [relatedAudits, setRelatedAudits] = useState<QmsInternalAudit[]>([]);

  const { canCreate, canUpdate, canDelete, canExport } = useResourcePermissions(RESOURCE);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        standard_code: standardFilter || DEFAULT_STANDARD,
        sort_order: 0,
        is_active: true,
      });
    }, 0);
  }, [standardFilter]);
  useNewShortcut(() => {
    if (canCreate) openCreate();
  });

  const loadDrawerData = useCallback(async (record: QmsIsoClause) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(record);
    setDrawerOpen(true);
    try {
      const [detailRes, summaryRes, docsRes, auditsRes] = await Promise.all([
        qualityQmsApi.isoClauses.get(record.id),
        qualityQmsApi.isoClauses.complianceSummary(record.id),
        qualityQmsApi.isoClauses.relatedDocuments(record.id),
        qualityQmsApi.isoClauses.relatedAudits(record.id),
      ]);
      setDetail(detailRes);
      setSummary(summaryRes);
      setRelatedDocs(docsRes.items ?? []);
      setRelatedAudits(auditsRes.items ?? []);
    } catch (error) {
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const handleEdit = (record: QmsIsoClause) => {
    setEditing(record);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        ...record,
        parent_id: record.parent_id ?? undefined,
      });
    }, 0);
  };

  const handleDelete = async (record: QmsIsoClause) => {
    try {
      await qualityQmsApi.isoClauses.delete(record.id);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
      if (detail?.id === record.id) {
        setDrawerOpen(false);
      }
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.deleteFailed')));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }
    getAntdModal().confirm({
      title: t('common.deleteTitle'),
      onOk: async () => {
        let ok = 0;
        let fail = 0;
        for (const key of selectedRowKeys) {
          try {
            await qualityQmsApi.isoClauses.delete(Number(key));
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        if (ok > 0) messageApi.success(t('common.deleteSuccess'));
        if (fail > 0) messageApi.error(t('common.deleteFailed'));
        setSelectedRowKeys([]);
        actionRef.current?.reload();
      },
    });
  };

  const handleLoadPreset = async () => {
    try {
      const res = await qualityQmsApi.isoClauses.loadPreset(DEFAULT_STANDARD);
      messageApi.success(
        t('app.kuaizhizao.quality.isoClauses.loadPresetSuccess', {
          created: res.created,
          skipped: res.skipped,
          linked: res.linked,
        }),
      );
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    }
  };

  const handleExport = async () => {
    try {
      const items = await fetchAllListItems((params) =>
        qualityQmsApi.isoClauses.list({ ...params, standard_code: standardFilter }),
      );
      await downloadRecordsAsXlsx(items, `${t('app.kuaizhizao.menu.quality-management.iso-clauses')}.xlsx`, {
        columns: [
          { key: 'standard_code', title: t('app.kuaizhizao.quality.isoClauses.standardCode') },
          { key: 'clause_code', title: t('app.kuaizhizao.quality.isoClauses.clauseCode') },
          { key: 'title', title: t('app.kuaizhizao.quality.isoClauses.title') },
          { key: 'description', title: t('common.remark') },
          { key: 'is_active', title: t('common.enabled') },
        ],
      });
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.exportFailed')));
    }
  };

  const detailColumns: ProDescriptionsItemProps<QmsIsoClause>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.quality.isoClauses.standardCode'), dataIndex: 'standard_code' },
      { title: t('app.kuaizhizao.quality.isoClauses.clauseCode'), dataIndex: 'clause_code' },
      { title: t('app.kuaizhizao.quality.isoClauses.title'), dataIndex: 'title' },
      { title: t('common.remark'), dataIndex: 'description' },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        render: (_, record) =>
          renderMasterActiveTag(
            t,
            record.is_active ?? false,
            'common.enabled',
            'common.disabled',
          ),
      },
      { title: t('app.kuaizhizao.quality.isoClauses.sortOrder'), dataIndex: 'sort_order' },
    ],
    [t],
  );

  const columns: ProColumns<QmsIsoClause>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.quality.isoClauses.clauseCode'),
            dataIndex: 'clause_code',
            width: 120,
            uniTableKeepWidth: true,
            render: (_, record) => (
              <Button type="link" style={{ padding: 0 }} onClick={() => loadDrawerData(record)}>
                {record.clause_code}
              </Button>
            ),
          },
          {
            title: t('app.kuaizhizao.quality.isoClauses.title'),
            dataIndex: 'title',
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.quality.isoClauses.standardCode'),
            dataIndex: 'standard_code',
            width: 130,
            uniTableKeepWidth: true,
            initialValue: DEFAULT_STANDARD,
            valueType: 'select',
            valueEnum: {
              [DEFAULT_STANDARD]: { text: DEFAULT_STANDARD },
            },
            fieldProps: {
              allowClear: true,
              onChange: (value: string) => setStandardFilter(value || DEFAULT_STANDARD),
            },
          },
          {
            title: t('common.enabled'),
            dataIndex: 'is_active',
            width: 100,
            uniTableKeepWidth: true,
            valueType: 'select',
            valueEnum: {
              true: { text: t('common.enabled') },
              false: { text: t('common.disabled') },
            },
            render: (_, record) =>
              renderMasterActiveTag(
                t,
                record.is_active ?? false,
                'common.enabled',
                'common.disabled',
              ),
          },
          ...buildDocumentAuditColumns<QmsIsoClause>(t),
          {
            title: t('common.actions'),
            valueType: 'option',
            width: 160,
            fixed: 'right',
            render: (_, record) => [
              canUpdate ? (
                <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
                  {t('common.edit')}
                </Button>
              ) : null,
              canDelete ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={() => {
                    getAntdModal().confirm({
                      title: t('common.deleteTitle'),
                      onOk: () => handleDelete(record),
                    });
                  }}
                >
                  {t('common.delete')}
                </Button>
              ) : null,
            ],
          },
        ],
        MASTER_DATA_LIST_FIELD_RANK,
      ),
    [t, canUpdate, canDelete, loadDrawerData],
  );

  const alignedDetailColumns = alignDescriptionColumns(
    detailColumns as ProDescriptionsItemProps<Record<string, unknown>>[],
    MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    alignedDetailColumns, detail
  );

  return (
    <PermissionGuard resource={RESOURCE} action="read">
      <ListPageTemplate>
        <UniTable<QmsIsoClause>
          actionRef={actionRef}
          permissionResource={RESOURCE}
          headerTitle={t('app.kuaizhizao.menu.quality-management.iso-clauses')}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.iso-clauses"
          rowKey="id"
          columns={columns}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          toolBarRender={() => [
            canCreate ? (
              <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                {withSingleNewShortcutHint(t('common.create'))}
              </Button>
            ) : null,
            canCreate ? (
              <Button key="preset" onClick={handleLoadPreset}>
                {t('app.kuaizhizao.quality.isoClauses.loadPreset')}
              </Button>
            ) : null,
            canDelete && selectedRowKeys.length > 0 ? (
              <Button key="batchDelete" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                {t('common.batchDelete')}
              </Button>
            ) : null,
            canExport ? (
              <Button key="export" onClick={handleExport}>
                {t('common.export')}
              </Button>
            ) : null,
          ]}
          request={async (params) => {
            const res = await qualityQmsApi.isoClauses.list({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 50),
              limit: params.pageSize ?? 50,
              keyword: params.keyword,
              standard_code: params.standard_code ?? standardFilter,
              is_active: params.is_active,
            });
            return { data: res.items, success: true, total: res.total };
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={
          editing
            ? t('app.kuaizhizao.quality.isoClauses.editTitle')
            : t('app.kuaizhizao.quality.isoClauses.createTitle')
        }
        open={modalOpen}
        isEdit={!!editing}
        grid={false}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onFinish={async (values) => {
          try {
            const payload = {
              ...values,
              parent_id: values.parent_id ?? null,
            };
            if (editing) {
              await qualityQmsApi.isoClauses.update(editing.id, payload);
              messageApi.success(t('common.updateSuccess'));
            } else {
              await qualityQmsApi.isoClauses.create(payload);
              messageApi.success(t('common.createSuccess'));
            }
            setModalOpen(false);
            setEditing(null);
            actionRef.current?.reload();
            if (detail?.id === editing?.id && editing) {
              void loadDrawerData({ ...detail, ...payload, id: editing.id });
            }
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
            throw error;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="standard_code"
              label={t('app.kuaizhizao.quality.isoClauses.standardCode')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="clause_code"
              label={t('app.kuaizhizao.quality.isoClauses.clauseCode')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={24}>
            <ProFormText
              name="title"
              label={t('app.kuaizhizao.quality.isoClauses.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="description" label={t('common.remark')} />
          </Col>
          <Col span={12}>
            <ProFormItem
              name="parent_id"
              label={t('app.kuaizhizao.quality.isoClauses.parentClause')}
            >
              <QmsIsoClauseSelect
                standardCode={editing?.standard_code ?? standardFilter}
                excludeId={editing?.id}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormDigit name="sort_order" label={t('app.kuaizhizao.quality.isoClauses.sortOrder')} min={0} />
          </Col>
          <Col span={12}>
            <ProFormSwitch name="is_active" label={t('common.enabled')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={detail ? `${detail.clause_code} ${detail.title}` : t('common.detail')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        loading={detailLoading && !detail}
        extra={
          detail && canUpdate
            ? buildDetailDrawerEditExtra(t, true, () => handleEdit(detail))
            : undefined
        }
        basic={
          detail ? (
            <DetailDrawerSection title={t('common.basicInfo')}>
              <Descriptions
                column={2}
                items={timeconfigBasicItems}
              />
            </DetailDrawerSection>
          ) : undefined
        }
        lines={
          detail ? (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.quality.isoClauses.complianceSummary')}>
                {summary ? (
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.complianceStatus')}>
                      {renderComplianceTag(t, summary.compliance_status)}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.effectiveDocuments')}>
                      {summary.effective_document_count}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.reviewDueCount')}>
                      {summary.review_due_count}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.internalAuditCount')}>
                      {summary.internal_audit_count}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.lastAuditDate')}>
                      {summary.last_audit_date
                        ? formatDateTimeBySiteSetting(summary.last_audit_date)
                        : '-'}
                    </Descriptions.Item>
                    {summary.has_gap ? (
                      <Descriptions.Item label={t('app.kuaizhizao.quality.isoClauses.gapFlags')} span={2}>
                        <Space wrap>
                          {summary.no_effective_document ? (
                            <MarkerTag color="error">
                              {t('app.kuaizhizao.quality.isoClauses.gapNoDocument')}
                            </MarkerTag>
                          ) : null}
                          {summary.no_completed_audit ? (
                            <MarkerTag color="error">
                              {t('app.kuaizhizao.quality.isoClauses.gapNoAudit')}
                            </MarkerTag>
                          ) : null}
                        </Space>
                      </Descriptions.Item>
                    ) : null}
                  </Descriptions>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaizhizao.menu.quality-management.system-documents')}>
                <Table<QmsSystemDocument>
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={relatedDocs}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  columns={[
                    { title: t('app.kuaizhizao.quality.qms.documentCode'), dataIndex: 'document_code' },
                    { title: t('common.title'), dataIndex: 'title', ellipsis: true },
                    { title: t('common.status'), dataIndex: 'status', width: 100 },
                  ]}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaizhizao.menu.quality-management.internal-audits')}>
                <Table<QmsInternalAudit>
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={relatedAudits}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  columns={[
                    { title: t('app.kuaizhizao.quality.qms.auditCode'), dataIndex: 'audit_code' },
                    { title: t('common.title'), dataIndex: 'title', ellipsis: true },
                    { title: t('common.status'), dataIndex: 'status', width: 100 },
                  ]}
                />
              </DetailDrawerSection>
            </>
          ) : undefined
        }
        plainBody={
          detailError && !detail ? (
            <Typography.Text type="danger">{detailError}</Typography.Text>
          ) : undefined
        }
      />
    </PermissionGuard>
  );
};

export default IsoClausesPage;
