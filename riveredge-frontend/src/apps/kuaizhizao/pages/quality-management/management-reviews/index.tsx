import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Empty, Row, Tag, Alert } from 'antd';
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
import { qualityQmsApi, QmsManagementReview } from '../../../services/quality-qms';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import {
  parseEvidenceLinksText,
  stringifyEvidenceLinks,
  QMS_REVIEW_STATUS_OPTIONS,
} from '../qms/qmsMeta';

const RESOURCE = 'kuaizhizao:quality-management-management-reviews';

const ManagementReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QmsManagementReview | null>(null);
  const [inputSummaryText, setInputSummaryText] = useState('');
  const [inputSummaryLoading, setInputSummaryLoading] = useState(false);
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(RESOURCE);

  const statusEnum = useMemo(
    () =>
      Object.fromEntries(QMS_REVIEW_STATUS_OPTIONS.map((o) => [o.value, { text: t(o.labelKey) }])),
    [t],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        status: 'draft',
        input_links_text: '[]',
        training_refs_text: '[]',
        calibration_refs_text: '[]',
        attachments: [],
      });
    }, 0);
  }, []);
  useNewShortcut(() => {
    if (canCreate) openCreate();
  });

  const loadInputSummary = useCallback(async () => {
    setInputSummaryLoading(true);
    try {
      const reviewDate = formRef.current?.getFieldValue?.('review_date');
      const res = await qualityQmsApi.managementReviews.inputSummary(
        reviewDate
          ? {
              period_end: reviewDate,
            }
          : undefined,
      );
      setInputSummaryText(res.summary_text || '');
      const current = formRef.current?.getFieldValue?.('inputs_summary');
      if (!String(current || '').trim()) {
        formRef.current?.setFieldsValue({ inputs_summary: res.summary_text });
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('common.loadFailed'));
    } finally {
      setInputSummaryLoading(false);
    }
  }, [messageApi, t]);

  const columns: ProColumns<QmsManagementReview>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.quality.qms.reviewCode'),
            dataIndex: 'review_code',
            width: 140,
            copyable: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.title'),
            dataIndex: 'title',
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.keyword'),
            dataIndex: 'keyword',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.chairperson'),
            dataIndex: 'chairperson',
            width: 100,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.qms.reviewDate'),
            dataIndex: 'review_date',
            width: 140,
            hideInSearch: true,
            render: (_, row) => formatDateTimeBySiteSetting(row.review_date) || '-',
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            width: 110,
            valueEnum: statusEnum,
            render: (_, row) => <Tag>{statusEnum[row.status]?.text || row.status}</Tag>,
          },
          {
            title: t('common.actions'),
            valueType: 'option',
            width: 140,
            fixed: 'right',
            render: (_, row) => [
              canUpdate ? (
                <a
                  key="edit"
                  className={rowActionKind('edit')}
                  onClick={() => {
                    setEditing(row);
                    setOpen(true);
                    setTimeout(() => {
                      formRef.current?.setFieldsValue({
                        ...row,
                        input_links_text: stringifyEvidenceLinks(row.input_links),
                        training_refs_text: stringifyEvidenceLinks(row.training_refs),
                        calibration_refs_text: stringifyEvidenceLinks(row.calibration_refs),
                        attachments: mapAttachmentsToUploadList(row.attachments as any),
                      });
                    }, 0);
                  }}
                >
                  {t('common.edit')}
                </a>
              ) : null,
              canDelete ? (
                <a
                  key="delete"
                  className={rowActionKind('danger')}
                  onClick={async () => {
                    await qualityQmsApi.managementReviews.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('common.delete')}
                </a>
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
      permission="kuaizhizao:quality-management-management-reviews:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.qms.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<QmsManagementReview>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.managementReview)}
          headerTitle={t('app.kuaizhizao.menu.quality-management.management-reviews')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.management-reviews"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="add" type="primary" onClick={openCreate}>
                    {withSingleNewShortcutHint(t('app.kuaizhizao.quality.qms.createReview'))}
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const res = await qualityQmsApi.managementReviews.list({
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
              ? t('app.kuaizhizao.quality.qms.editReview')
              : t('app.kuaizhizao.quality.qms.createReview')
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
                input_links: parseEvidenceLinksText(values.input_links_text),
                training_refs: parseEvidenceLinksText(values.training_refs_text),
                calibration_refs: parseEvidenceLinksText(values.calibration_refs_text),
                attachments: normalizeDocumentAttachments(values.attachments),
              };
              delete (payload as any).input_links_text;
              delete (payload as any).training_refs_text;
              delete (payload as any).calibration_refs_text;
              if (editing?.id) {
                await qualityQmsApi.managementReviews.update(editing.id, payload);
              } else {
                await qualityQmsApi.managementReviews.create(payload);
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
                name="review_code"
                label={t('app.kuaizhizao.quality.qms.reviewCode')}
                pageCode="kuaizhizao-quality-management-review"
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
                options={QMS_REVIEW_STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="chairperson" label={t('app.kuaizhizao.quality.qms.chairperson')} />
            </Col>
            <Col span={8}>
              <ProFormDateTimePicker name="review_date" label={t('app.kuaizhizao.quality.qms.reviewDate')} />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="attendees" label={t('app.kuaizhizao.quality.qms.attendees')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 8 }}
                title={inputSummaryText || t('app.kuaizhizao.quality.qms.inputSummaryHint')}
                action={
                  <Button size="small" loading={inputSummaryLoading} onClick={() => void loadInputSummary()}>
                    {t('app.kuaizhizao.quality.qms.loadInputSummary')}
                  </Button>
                }
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="inputs_summary"
                label={t('app.kuaizhizao.quality.qms.inputsSummary')}
                fieldProps={{ rows: 3 }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="outputs_summary"
                label={t('app.kuaizhizao.quality.qms.outputsSummary')}
                fieldProps={{ rows: 3 }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="input_links_text"
                label={t('app.kuaizhizao.quality.qms.inputLinks')}
                tooltip={t('app.kuaizhizao.quality.qms.inputLinksHint')}
                fieldProps={{ rows: 4 }}
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
              <DocumentAttachmentsField category="qms_management_review_attachments" />
            </Col>
          </Row>
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default ManagementReviewsPage;
