import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Tag, Input } from 'antd';
import { SendOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
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
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { equipmentApi } from '../../../services/equipment';
import { transferApplicationsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.transfer';
const RESOURCE = 'kuaizhizao:equipment-transfer';

interface TransferApplication {
  id?: number;
  application_no?: string;
  equipment_id?: number;
  equipment_name?: string;
  from_workshop_name?: string;
  to_workshop_name?: string;
  to_workstation_name?: string;
  to_status?: string;
  reason?: string;
  transfer_date?: string;
  applicant_name?: string;
  status?: string;
  remark?: string;
  reject_reason?: string;
  updated_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  草稿: 'default',
  已提交: 'processing',
  已审核: 'success',
  已驳回: 'error',
};

const EQUIPMENT_STATUS_OPTIONS = ['正常', '故障', '维修中', '停用', '校验中'].map((s) => ({ label: s, value: s }));

const EquipmentTransfersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<TransferApplication | null>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TransferApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<TransferApplication>();

  const handleDetail = useCallback(
    (record: TransferApplication) => {
      if (!record.id) return;
      void openDetail(() => transferApplicationsApi.get(record.id!) as Promise<TransferApplication>);
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
    setModalVisible(true);
    void loadEquipmentOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ transfer_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: TransferApplication) => {
    if (!record.id) return;
    try {
      const loaded = await transferApplicationsApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setModalVisible(true);
      void loadEquipmentOptions();
      formRef.current?.setFieldsValue({
        equipment_id: loaded.equipment_id,
        to_workshop_name: loaded.to_workshop_name,
        to_workstation_name: loaded.to_workstation_name,
        to_status: loaded.to_status,
        reason: loaded.reason,
        transfer_date: loaded.transfer_date ? dayjs(loaded.transfer_date) : dayjs(),
        remark: loaded.remark,
      });
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await transferApplicationsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      equipment_id: values.equipment_id,
      to_workshop_name: values.to_workshop_name,
      to_workstation_name: values.to_workstation_name,
      to_status: values.to_status,
      reason: values.reason,
      transfer_date: (values.transfer_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await transferApplicationsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await transferApplicationsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
    if (detailVisible && detail?.id === current?.id && current?.id) {
      void handleDetail({ id: current.id });
    }
  };

  const approvalStatusValueEnum = useMemo(() => buildApprovalDocStatusValueEnum(), []);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<TransferApplication>[]>(
    () => [
      { title: t(`${P}.col.applicationNo`), dataIndex: 'application_no' },
      { title: t(`${P}.col.equipment`), dataIndex: 'equipment_name' },
      { title: t(`${P}.col.fromWorkshop`), dataIndex: 'from_workshop_name' },
      { title: t(`${P}.col.toWorkshop`), dataIndex: 'to_workshop_name' },
      { title: t(`${P}.col.toLocation`), dataIndex: 'to_workstation_name' },
      { title: t(`${P}.form.toStatus`), dataIndex: 'to_status' },
      { title: t(`${P}.col.transferDate`), dataIndex: 'transfer_date', valueType: 'date' },
      { title: t(`${P}.col.applicant`, { defaultValue: '申请人' }), dataIndex: 'applicant_name' },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        render: (_, r) => (
          <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>
        ),
      },
      { title: t(`${P}.form.reason`), dataIndex: 'reason', span: 2 },
      { title: t(`${P}.form.remark`), dataIndex: 'remark', span: 2 },
      { title: t(`${P}.form.rejectReason`, { defaultValue: '驳回原因' }), dataIndex: 'reject_reason', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<TransferApplication>[] = useMemo(() => alignProColumns<TransferApplication>([
      {
        title: t(`${P}.col.transferDate`),
        dataIndex: 'transfer_date_range',
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
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.fromWorkshop`),
        dataIndex: 'from_workshop_name',
        width: 120,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.toWorkshop`),
        dataIndex: 'to_workshop_name',
        width: 120,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.toLocation`),
        dataIndex: 'to_workstation_name',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.transferDate`),
        dataIndex: 'transfer_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<TransferApplication>(t),
      {
        title: t('common.actions'),
        key: 'action',
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
              icon={<SendOutlined />}
              onClick={async () => {
                if (!record.id) return;
                await transferApplicationsApi.submit(record.id);
                messageApi.success(t(`${P}.submitSuccess`));
                actionRef.current?.reload();
              }}
            >
              {t(`${P}.action.submit`)}
            </Button>
          ) : null,
          perms.canAction?.('approve') && record.status === '已提交' ? (
            <Button
              key="approve"
              {...rowActionKind('approve')}
              icon={<CheckOutlined />}
              onClick={async () => {
                if (!record.id) return;
                await transferApplicationsApi.approve(record.id);
                messageApi.success(t(`${P}.approveSuccess`));
                actionRef.current?.reload();
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
              icon={<CloseOutlined />}
              onClick={() => {
                setRejectTarget(record);
                setRejectReason('');
                setRejectModalVisible(true);
              }}
            >
              {t(`${P}.action.reject`)}
            </Button>
          ) : null,
        ],
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, messageApi, approvalStatusValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<TransferApplication>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-transfers"
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
                docDateRangeKeys: ['transfer_date_range', 'transferDateRange'],
                docDateParamPrefix: 'transfer',
              });
              const res = await transferApplicationsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as TransferApplication[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          enableRowSelection={perms.canDelete}
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
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="equipment_id"
              label={t(`${P}.form.equipment`)}
              options={equipmentOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker name="transfer_date" label={t(`${P}.col.transferDate`)} fieldProps={EQUIPMENT_DATE_FIELD_PROPS} />
          </Col>
          <Col span={12}>
            <ProFormText name="to_workshop_name" label={t(`${P}.form.toWorkshop`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="to_workstation_name" label={t(`${P}.form.toLocation`)} />
          </Col>
          <Col span={12}>
            <ProFormSelect name="to_status" label={t(`${P}.form.toStatus`)} options={EQUIPMENT_STATUS_OPTIONS} allowClear />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="reason" label={t(`${P}.form.reason`)} rules={[{ required: true }]} />
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        title={t(`${P}.rejectModal`)}
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={async () => {
          if (!rejectTarget?.id || !rejectReason.trim()) return;
          await transferApplicationsApi.reject(rejectTarget.id, { reject_reason: rejectReason });
          messageApi.success(t(`${P}.rejectSuccess`));
          setRejectModalVisible(false);
          actionRef.current?.reload();
        }}
      >
        <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>
    </>
  );
};

export default EquipmentTransfersPage;
