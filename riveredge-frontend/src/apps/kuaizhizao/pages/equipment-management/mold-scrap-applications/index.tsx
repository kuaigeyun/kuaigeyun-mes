import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Input } from 'antd';
import { EditOutlined, DeleteOutlined, SendOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { StatusTag } from '../../../../../constants/statusBadges';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { moldApi } from '../../../services/equipment';
import { scrapApplicationsApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';

const P = 'app.kuaizhizao.moldOps.scrap';
const RESOURCE = 'kuaizhizao:mold-scrap';

interface MoldScrapApplication {
  id?: number;
  application_no?: string;
  mold_id?: number;
  mold_code?: string;
  mold_name?: string;
  reason?: string;
  scrap_date?: string;
  applicant_name?: string;
  status?: string;
  reject_reason?: string;
  remark?: string;
  updated_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  草稿: 'default',
  已提交: 'processing',
  已审核: 'success',
  已驳回: 'error',
};

const MoldScrapApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const canAudit = perms.canAction?.('audit') ?? perms.canAction?.('approve') ?? false;
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MoldScrapApplication | null>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: number }[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<MoldScrapApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MoldScrapApplication>();

  const handleDetail = (record: MoldScrapApplication) => {
    if (!record.id) return;
    void openDetail(() => scrapApplicationsApi.get(record.id!), t(`${P}.listFailed`));
  };

  const loadMoldOptions = async () => {
    const res = await moldApi.list({ limit: 1000 });
    setMoldOptions(
      (res.items ?? []).map((m: { id: number; code: string; name: string }) => ({
        label: `${m.code} - ${m.name}`,
        value: m.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    void loadMoldOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ scrap_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldScrapApplication) => {
    if (!record.id) return;
    const detail = await scrapApplicationsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadMoldOptions();
    formRef.current?.setFieldsValue({
      mold_id: detail.mold_id,
      reason: detail.reason,
      scrap_date: detail.scrap_date ? dayjs(detail.scrap_date) : dayjs(),
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await scrapApplicationsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      mold_id: values.mold_id,
      reason: values.reason,
      scrap_date: (values.scrap_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await scrapApplicationsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await scrapApplicationsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const handleSubmitDoc = async (record: MoldScrapApplication) => {
    if (!record.id) return;
    await scrapApplicationsApi.submit(record.id);
    messageApi.success(t(`${P}.submitSuccess`));
    actionRef.current?.reload();
  };

  const handleApprove = async (record: MoldScrapApplication) => {
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

  const detailColumns: ProDescriptionsItemProps<MoldScrapApplication>[] = useMemo(
    () => [
      { title: t(`${P}.col.applicationNo`), dataIndex: 'application_no' },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name' },
      { title: t(`${P}.col.reason`), dataIndex: 'reason', span: 2 },
      { title: t(`${P}.col.scrapDate`), dataIndex: 'scrap_date', valueType: 'date' },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name' },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        render: (_, r) => (
          <StatusTag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</StatusTag>
        ),
      },
      { title: t(`${P}.form.remark`), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<MoldScrapApplication>[] = useMemo(() => alignProColumns<MoldScrapApplication>([
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
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: approvalStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.applicationNo`),
        dataIndex: 'application_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name', width: 160, ellipsis: true, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.reason`), dataIndex: 'reason', ellipsis: true, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name', width: 100, sorter: true, hideInSearch: true },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
      {
        title: t(`${P}.col.status`),
        key: 'lifecycle',
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => (
          <StatusTag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</StatusTag>
        ),
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 260,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button
              {...rowActionKind('read')}
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>
            {perms.canUpdate && record.status === '草稿' && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            {perms.canAction?.('submit') && record.status === '草稿' && (
              <Button
                {...rowActionKind('submit')}
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSubmitDoc(record);
                }}
              >
                {t(`${P}.action.submit`)}
              </Button>
            )}
            {canAudit && record.status === '已提交' && (
              <Button
                {...rowActionKind('approve')}
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApprove(record);
                }}
              >
                {t(`${P}.action.approve`)}
              </Button>
            )}
            {canAudit && record.status === '已提交' && (
              <Button
                {...rowActionKind('reject')}
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectTarget(record);
                  setRejectReason('');
                  setRejectModalVisible(true);
                }}
              >
                {t(`${P}.action.reject`)}
              </Button>
            )}
            {perms.canDelete && record.status === '草稿' && (
              <Button
                {...rowActionKind('delete')}
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  Modal.confirm({
                    title: t('common.deleteTitle'),
                    onOk: () => record.id && handleDelete([record.id]),
                  });
                }}
              >
                {t('common.delete')}
              </Button>
            )}
          </>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, canAudit, approvalStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldScrapApplication>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-scrap-applications-equip-rank-v1"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
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
              return { data: data as MoldScrapApplication[], success: true, total };
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

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="mold_id"
              label={t(`${P}.form.mold`)}
              options={moldOptions}
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
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.application_no ? ` - ${detail.application_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
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

export default MoldScrapApplicationsPage;
