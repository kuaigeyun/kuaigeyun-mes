import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Input } from 'antd';
import { StatusTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { equipmentApi } from '../../../services/equipment';
import { scrapApplicationsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps, formDateFormItemProps, toApiDateString } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const P = 'app.kuaizhizao.equipmentOps.scrap';
const RESOURCE = 'kuaizhizao:equipment-scrap';

interface ScrapApplication {
  id?: number;
  application_no?: string;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  reason?: string;
  scrap_date?: string;
  applicant_name?: string;
  status?: string;
  reject_reason?: string;
  remark?: string;
  updated_at?: string;
}


const EquipmentScrapPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<ScrapApplication | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ScrapApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ScrapApplication>();

  const handleDetail = useCallback(
    (record: ScrapApplication) => {
      if (!record.id) return;
      void openDetail(() => scrapApplicationsApi.get(record.id!) as Promise<ScrapApplication>);
    },
    [openDetail],
  );

  const loadEquipmentOptions = async () => {
    const res = await equipmentApi.list({ limit: 1000 });
    setEquipmentOptions(
      (res.items ?? []).map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setFormInitialValues({ scrap_date: dayjs() });
    setModalVisible(true);
    void loadEquipmentOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: ScrapApplication) => {
    if (!record.id) return;
    try {
      const detail = await scrapApplicationsApi.get(record.id);
      setIsEdit(true);
      setCurrent(detail);
      setFormInitialValues({
        equipment_id: detail.equipment_id,
        reason: detail.reason,
        scrap_date: detail.scrap_date ? dayjs(detail.scrap_date) : dayjs(),
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadEquipmentOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const executeDelete = async (keys: React.Key[]) => {
    
        for (const id of keys) {
          await scrapApplicationsApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
      
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      equipment_id: values.equipment_id,
      reason: values.reason,
      scrap_date: toApiDateString(values.scrap_date),
      remark: values.remark,
    };
    setSubmitting(true);
    try {
      if (isEdit && current?.id) {
        await scrapApplicationsApi.update(current.id, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await scrapApplicationsApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
      if (detailVisible && detail?.id === current?.id && current?.id) {
        void handleDetail({ id: current.id });
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.submitFailed`)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDoc = async (record: ScrapApplication) => {
    if (!record.id) return;
    await scrapApplicationsApi.submit(record.id);
    messageApi.success(t(`${P}.submitSuccess`));
    actionRef.current?.reload();
  };

  const handleApprove = async (record: ScrapApplication) => {
    if (!record.id) return;
    await scrapApplicationsApi.approve(record.id);
    messageApi.success(t(`${P}.approveSuccess`));
    actionRef.current?.reload();
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget?.id || !rejectReason.trim()) return;
    await scrapApplicationsApi.reject(rejectTarget.id, { reject_reason: rejectReason });
    messageApi.success(t(`${P}.rejectSuccess`));
    setRejectModalVisible(false);
    setRejectTarget(null);
    setRejectReason('');
    actionRef.current?.reload();
  };

  const approvalStatusValueEnum = useMemo(() => buildApprovalDocStatusValueEnum(), []);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<ScrapApplication>[]>(
    () => [
      { title: t(`${P}.col.applicationNo`), dataIndex: 'application_no' },
      { title: t(`${P}.col.equipment`), dataIndex: 'equipment_name' },
      { title: t(`${P}.col.reason`), dataIndex: 'reason', span: 2 },
      { title: t(`${P}.col.scrapDate`), dataIndex: 'scrap_date', valueType: 'date' },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
      { title: t(`${P}.form.rejectReason`), dataIndex: 'reject_reason', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<ScrapApplication>[] = useMemo(() => alignProColumns<ScrapApplication>([
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: approvalStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.applicationNo`),
        dataIndex: 'application_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) =>
          r.application_no != null && r.application_no !== '' ? String(r.application_no) : '-',
      },
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.equipment_name != null && r.equipment_name !== '' ? String(r.equipment_name) : '-',
      },
      {
        title: t(`${P}.col.reason`),
        dataIndex: 'reason',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.reason != null && r.reason !== '' ? String(r.reason) : '-'),
      },
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.applicant`),
        dataIndex: 'applicant_name',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.applicant_name != null && r.applicant_name !== '' ? String(r.applicant_name) : '-',
      },
      ...buildDocumentAuditColumns<ScrapApplication>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          perms.canRead ? (
            <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>
          ) : null,
          perms.canUpdate && record.status === '草稿' ? (
            <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          perms.canAction?.('submit') && record.status === '草稿' ? (
            <Button
              key="submit"
              {...rowActionKind('submit')}
              onClick={(e) => {
                e.stopPropagation();
                void handleSubmitDoc(record);
              }}
            >
              {t('common.submit')}
            </Button>
          ) : null,
          perms.canAction?.('approve') && record.status === '已提交' ? (
            <Button
              key="approve"
              {...rowActionKind('approve')}
              onClick={(e) => {
                e.stopPropagation();
                void handleApprove(record);
              }}
            >
              {t(`${P}.action.approve`)}
            </Button>
          ) : null,
          perms.canAction?.('reject') && record.status === '已提交' ? (
            <Button
              key="reject"
              {...rowActionKind('reject')}
              danger
              onClick={(e) => {
                e.stopPropagation();
                setRejectTarget(record);
                setRejectReason('');
                setRejectModalVisible(true);
              }}
            >
              {t(`${P}.action.reject`)}
            </Button>
          ) : null,
          perms.canDelete && record.status === '草稿' ? (
            <ActionConfirmPopconfirm
              title={t('common.deleteTitle')}
              onConfirm={() => record.id && void executeDelete([record.id])}
            >
              <Button
                key="delete"
                {...rowActionKind('delete')}
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              >
                {t('common.delete')}
              </Button>
            </ActionConfirmPopconfirm>
          ) : null,
        ],
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, approvalStatusValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ScrapApplication>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.equipmentScrap)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-scrap-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => perms.canRead && handleDetail(record),
            style: { cursor: perms.canRead ? 'pointer' : undefined },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveApprovalDocListParams(searchFormValues, sort, {
                docDateRangeKeys: ['scrap_date_range', 'scrapDateRange'],
                docDateParamPrefix: 'scrap',
              });
              const res = await scrapApplicationsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as ScrapApplication[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={false}
          enableRowSelection={false}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.application_no ? ` - ${detail.application_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(detail && perms.canUpdate && detail.status === '草稿'),
          () => {
            if (!detail) return;
            closeDetail();
            void handleEdit(detail);
          },
        )}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="equipment_id"
              label={t(`${P}.form.equipment`)}
              options={equipmentOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="reason" label={t(`${P}.col.reason`)} rules={[{ required: true }]} fieldProps={{ rows: 3 }} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="scrap_date"
              label={t(`${P}.col.scrapDate`)}
              formItemProps={formDateFormItemProps}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        title={t(`${P}.rejectModal`)}
        open={rejectModalVisible}
        onOk={() => void handleRejectConfirm()}
        onCancel={() => setRejectModalVisible(false)}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t(`${P}.form.rejectReason`)}
        />
      </Modal>
    </>
  );
};

export default EquipmentScrapPage;
