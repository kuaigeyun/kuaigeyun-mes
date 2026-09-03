import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDateTimePicker,
  ProFormItem,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Empty, Row, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import CodeField from '../../../../../components/code-field';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { qualityQmsApi, QmsInternalAudit } from '../../../services/quality-qms';
import QmsFindingLinksField, { mergeFindingLinks, splitFindingLinks } from '../qms/QmsFindingLinksField';
import {
  parseEvidenceLinksText,
  stringifyEvidenceLinks,
  QMS_AUDIT_STATUS_OPTIONS,
} from '../qms/qmsMeta';
import QmsIsoClauseSelect from '../qms/QmsIsoClauseSelect';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const RESOURCE = 'kuaizhizao:quality-management-internal-audits';

const InternalAuditsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QmsInternalAudit | null>(null);
  const [findingNcIds, setFindingNcIds] = useState<number[]>([]);
  const [finding8dIds, setFinding8dIds] = useState<number[]>([]);
  const findingLinkCacheRef = useRef(new Map<string, import('../../../services/quality-qms').QmsEvidenceLink>());
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(RESOURCE);

  const statusEnum = useMemo(
    () =>
      Object.fromEntries(QMS_AUDIT_STATUS_OPTIONS.map((o) => [o.value, { text: t(o.labelKey) }])),
    [t],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        status: 'planned',
        training_refs_text: '[]',
        calibration_refs_text: '[]',
        attachments: [],
      });
      setFindingNcIds([]);
      setFinding8dIds([]);
    }, 0);
  }, []);
  useNewShortcut(() => {
    if (canCreate) openCreate();
  });

  const columns: ProColumns<QmsInternalAudit>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.quality.qms.auditCode'),
            dataIndex: 'audit_code',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            copyable: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.title'),
            dataIndex: 'title',
            minWidth: 200,
            uniTablePrimaryFlex: true,
            uniTableRemainderFlex: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.keyword'),
            dataIndex: 'keyword',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.isoClause'),
            dataIndex: 'iso_clause',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.leadAuditor'),
            dataIndex: 'lead_auditor',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.plannedDate'),
            dataIndex: 'planned_date',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => formatDateTimeBySiteSetting(row.planned_date) || '-',
          },
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            valueEnum: statusEnum,
            render: (_, row) => <Tag>{statusEnum[row.status]?.text || row.status}</Tag>,
          },
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              canUpdate ? (
                <Button
                  key="edit"
                  {...rowActionKind('update')}
                  onClick={() => {
                    setEditing(row);
                    setOpen(true);
                    const split = splitFindingLinks(row.finding_links);
                    setFindingNcIds(split.ncIds);
                    setFinding8dIds(split.eightDIds);
                    setTimeout(() => {
                      formRef.current?.setFieldsValue({
                        ...row,
                        training_refs_text: stringifyEvidenceLinks(row.training_refs),
                        calibration_refs_text: stringifyEvidenceLinks(row.calibration_refs),
                        attachments: mapAttachmentsToUploadList(row.attachments as any),
                      });
                    }, 0);
                  }}
                />
              ) : null,
              canDelete ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    await qualityQmsApi.internalAudits.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
    actionRef.current?.reload();
                  }}
                />
              ) : null,
            ],
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [canDelete, canUpdate, messageApi, statusEnum, t],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-internal-audits:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.qms.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<QmsInternalAudit>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.internalAudit)}
          headerTitle={t('app.kuaizhizao.menu.quality-management.internal-audits')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.internal-audits-width-v2"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="add" type="primary" onClick={openCreate}>
                    {withSingleNewShortcutHint(t('app.kuaizhizao.quality.qms.createAudit'))}
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const res = await qualityQmsApi.internalAudits.list({
              skip,
              limit: pageSize,
              keyword: params.keyword,
              status: params.status,
            });
            return { success: true, data: res.items || [], total: res.total || 0 };
          }}
        />

        <FormModalTemplate
          title={
            editing
              ? t('app.kuaizhizao.quality.qms.editAudit')
              : t('app.kuaizhizao.quality.qms.createAudit')
          }
          open={open}
          width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
          grid={false}
          formRef={formRef}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onFinish={async (values) => {
            try {
              const payload = {
                ...values,
                finding_links: mergeFindingLinks(findingNcIds, finding8dIds, findingLinkCacheRef.current),
                training_refs: parseEvidenceLinksText(values.training_refs_text),
                calibration_refs: parseEvidenceLinksText(values.calibration_refs_text),
                attachments: normalizeDocumentAttachments(values.attachments),
              };
              delete (payload as any).training_refs_text;
              delete (payload as any).calibration_refs_text;
              if (editing?.id) {
                await qualityQmsApi.internalAudits.update(editing.id, payload);
              } else {
                await qualityQmsApi.internalAudits.create(payload);
              }
              messageApi.success(t('common.saveSuccess'));
              setOpen(false);
    actionRef.current?.reload();
              return true;
            } catch (e: any) {
              messageApi.error(e?.message || t('common.saveFailed'));
              return false;
            }
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <CodeField
                name="audit_code"
                label={t('app.kuaizhizao.quality.qms.auditCode')}
                pageCode="kuaizhizao-quality-internal-audit"
                disabled={!!editing}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="title" label={t('app.kuaizhizao.quality.qms.title')} rules={[{ required: true }]} />
            </Col>
            <Col span={8}>
              <ProFormSelect
                name="status"
                label={t('common.status')}
                options={QMS_AUDIT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="audit_scope" label={t('app.kuaizhizao.quality.qms.auditScope')} />
            </Col>
            <Col span={8}>
              <ProFormItem name="iso_clause_id" label={t('app.kuaizhizao.quality.qms.isoClause')}>
                <QmsIsoClauseSelect />
              </ProFormItem>
            </Col>
            <Col span={8}>
              <ProFormText name="lead_auditor" label={t('app.kuaizhizao.quality.qms.leadAuditor')} />
            </Col>
            <Col span={8}>
              <ProFormDateTimePicker name="planned_date" label={t('app.kuaizhizao.quality.qms.plannedDate')} />
            </Col>
            <Col span={8}>
              <ProFormDateTimePicker name="completed_date" label={t('app.kuaizhizao.quality.qms.completedDate')} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="audit_team" label={t('app.kuaizhizao.quality.qms.auditTeam')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="checklist" label={t('app.kuaizhizao.quality.qms.checklist')} fieldProps={{ rows: 3 }} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="findings" label={t('app.kuaizhizao.quality.qms.findings')} fieldProps={{ rows: 3 }} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="conclusion" label={t('app.kuaizhizao.quality.qms.conclusion')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <QmsFindingLinksField
                ncIds={findingNcIds}
                eightDIds={finding8dIds}
                onChange={(links) => {
                  const split = splitFindingLinks(links);
                  setFindingNcIds(split.ncIds);
                  setFinding8dIds(split.eightDIds);
                  for (const link of links) {
                    findingLinkCacheRef.current.set(`${link.ref_type}:${link.ref_id}`, link);
                  }
                }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="training_refs_text"
                label={t('app.kuaizhizao.quality.qms.trainingRefs')}
                tooltip={t('app.kuaizhizao.quality.qms.crossAppRefsHint')}
                fieldProps={{ rows: 2 }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="calibration_refs_text"
                label={t('app.kuaizhizao.quality.qms.calibrationRefs')}
                tooltip={t('app.kuaizhizao.quality.qms.crossAppRefsHint')}
                fieldProps={{ rows: 2 }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="remarks" label={t('common.remark')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <DocumentAttachmentsField category="qms_internal_audit_attachments" />
            </Col>
          </Row>
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default InternalAuditsPage;
