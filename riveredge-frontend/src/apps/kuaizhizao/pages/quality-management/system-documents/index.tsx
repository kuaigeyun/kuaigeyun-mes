import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormItem, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Empty, Row, Tag, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import CodeField from '../../../../../components/code-field';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { qualityQmsApi, QmsSystemDocument } from '../../../services/quality-qms';
import {
  parseEvidenceLinksText,
  stringifyEvidenceLinks,
  QMS_DOC_STATUS_OPTIONS,
  QMS_DOC_TYPE_OPTIONS,
} from '../qms/qmsMeta';
import QmsIsoClauseSelect from '../qms/QmsIsoClauseSelect';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const RESOURCE = 'kuaizhizao:quality-management-system-documents';

const SystemDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QmsSystemDocument | null>(null);
  const { canCreate, canUpdate, canDelete, canAction } = useResourcePermissions(RESOURCE);
  const canPublish = !!canAction?.('publish');
  const canObsolete = !!canAction?.('obsolete');

  const statusEnum = useMemo(
    () =>
      Object.fromEntries(
        QMS_DOC_STATUS_OPTIONS.map((o) => [o.value, { text: t(o.labelKey) }]),
      ),
    [t],
  );
  const typeEnum = useMemo(
    () => Object.fromEntries(QMS_DOC_TYPE_OPTIONS.map((o) => [o.value, { text: t(o.labelKey) }])),
    [t],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        doc_type: 'procedure',
        version: 'A0',
        status: 'draft',
        evidence_links_text: '[]',
        training_refs_text: '[]',
        attachments: [],
      });
    }, 0);
  }, []);
  useNewShortcut(() => {
    if (canCreate) openCreate();
  });

  const { data: reviewDueSummary } = useQuery({
    queryKey: ['qms-system-documents-review-due'],
    queryFn: () => qualityQmsApi.systemDocuments.reviewDueSummary(),
  });

  const isReviewDue = useCallback((row: QmsSystemDocument) => {
    if (row.status !== 'effective' || !row.next_review_at) return false;
    const due = new Date(row.next_review_at).getTime();
    return Number.isFinite(due) && due <= Date.now();
  }, []);

  const columns: ProColumns<QmsSystemDocument>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.quality.qms.documentCode'),
            dataIndex: 'document_code',
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
            title: t('app.kuaizhizao.quality.qms.docTypeLabel'),
            dataIndex: 'doc_type',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            valueEnum: typeEnum,
          },
          {
            title: t('app.kuaizhizao.quality.qms.version'),
            dataIndex: 'version',
            width: 72,
            minWidth: 72,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
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
            title: t('app.kuaizhizao.quality.qms.nextReviewAt'),
            dataIndex: 'next_review_at',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => {
              const text = formatDateTimeBySiteSetting(row.next_review_at) || '-';
              if (isReviewDue(row)) {
                return <Tag color="warning">{text}</Tag>;
              }
              return text;
            },
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
                    setTimeout(() => {
                      formRef.current?.setFieldsValue({
                        ...row,
                        evidence_links_text: stringifyEvidenceLinks(row.evidence_links),
                        training_refs_text: stringifyEvidenceLinks(row.training_refs),
                        attachments: mapAttachmentsToUploadList(row.attachments as any),
                      });
                    }, 0);
                  }}
                />
              ) : null,
              canPublish && row.status !== 'effective' && row.status !== 'obsolete' ? (
                <Button
                  key="publish"
                  {...rowActionKind('execute')}
                  {...rowActionLabelKeep()}
                  onClick={async () => {
                    await qualityQmsApi.systemDocuments.publish(row.id);
                    messageApi.success(t('app.kuaizhizao.quality.qms.messages.publishSuccess'));
    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.quality.qms.actions.publish')}
                </Button>
              ) : null,
              canObsolete && row.status === 'effective' ? (
                <Button
                  key="obsolete"
                  {...rowActionKind('obsolete')}
                  onClick={async () => {
                    await qualityQmsApi.systemDocuments.obsolete(row.id);
                    messageApi.success(t('app.kuaizhizao.quality.qms.messages.obsoleteSuccess'));
    actionRef.current?.reload();
                  }}
                />
              ) : null,
              canDelete && row.status !== 'effective' ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    await qualityQmsApi.systemDocuments.delete(row.id);
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
    [canDelete, canObsolete, canPublish, canUpdate, isReviewDue, messageApi, statusEnum, t, typeEnum],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-system-documents:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.qms.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        {reviewDueSummary && reviewDueSummary.due_count > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('app.kuaizhizao.quality.qms.reviewDueBanner', { count: reviewDueSummary.due_count })}
          />
        ) : null}
        <UniTable<QmsSystemDocument>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.systemDocuments')}
          headerTitle={t('app.kuaizhizao.menu.quality-management.system-documents')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.system-documents-width-v2"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="add" type="primary" onClick={openCreate}>
                    {withSingleNewShortcutHint(t('app.kuaizhizao.quality.qms.createDocument'))}
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const res = await qualityQmsApi.systemDocuments.list({
              skip,
              limit: pageSize,
              keyword: params.keyword,
              status: params.status,
              doc_type: params.doc_type,
            });
            return { success: true, data: res.items || [], total: res.total || 0 };
          }}
        />

        <FormModalTemplate
          title={
            editing
              ? t('app.kuaizhizao.quality.qms.editDocument')
              : t('app.kuaizhizao.quality.qms.createDocument')
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
                evidence_links: parseEvidenceLinksText(values.evidence_links_text),
                training_refs: parseEvidenceLinksText(values.training_refs_text),
                attachments: normalizeDocumentAttachments(values.attachments),
              };
              delete (payload as any).evidence_links_text;
              delete (payload as any).training_refs_text;
              if (editing?.id) {
                await qualityQmsApi.systemDocuments.update(editing.id, payload);
              } else {
                await qualityQmsApi.systemDocuments.create(payload);
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
                name="document_code"
                label={t('app.kuaizhizao.quality.qms.documentCode')}
                pageCode="kuaizhizao-quality-system-document"
                disabled={!!editing}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="title" label={t('app.kuaizhizao.quality.qms.title')} rules={[{ required: true }]} />
            </Col>
            <Col span={8}>
              <ProFormSelect
                name="doc_type"
                label={t('app.kuaizhizao.quality.qms.docTypeLabel')}
                options={QMS_DOC_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="version" label={t('app.kuaizhizao.quality.qms.version')} rules={[{ required: true }]} />
            </Col>
            <Col span={8}>
              <ProFormItem name="iso_clause_id" label={t('app.kuaizhizao.quality.qms.isoClause')}>
                <QmsIsoClauseSelect />
              </ProFormItem>
            </Col>
            <Col span={8}>
              <ProFormText name="owner_name" label={t('app.kuaizhizao.quality.qms.ownerName')} />
            </Col>
            <Col span={8}>
              <ProFormDateTimePicker name="next_review_at" label={t('app.kuaizhizao.quality.qms.nextReviewAt')} />
            </Col>
            <Col span={8}>
              <ProFormText name="file_url" label={t('app.kuaizhizao.quality.qms.fileUrl')} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="content" label={t('app.kuaizhizao.quality.qms.content')} fieldProps={{ rows: 3 }} />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="evidence_links_text"
                label={t('app.kuaizhizao.quality.qms.evidenceLinks')}
                tooltip={t('app.kuaizhizao.quality.qms.evidenceLinksHint')}
                fieldProps={{ rows: 3 }}
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
              <ProFormTextArea name="remarks" label={t('common.remark')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <DocumentAttachmentsField category="qms_system_document_attachments" />
            </Col>
          </Row>
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default SystemDocumentsPage;
