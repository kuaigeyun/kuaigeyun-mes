import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Tag, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SendOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { moldApi } from '../../../services/equipment';
import { scrapApplicationsApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';

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

  const columns: ProColumns<MoldScrapApplication>[] = useMemo(
    () => [
      { title: t(`${P}.col.applicationNo`), dataIndex: 'application_no', width: 140, fixed: 'left' },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name', width: 160, ellipsis: true },
      { title: t(`${P}.col.reason`), dataIndex: 'reason', ellipsis: true },
      { title: t(`${P}.col.scrapDate`), dataIndex: 'scrap_date', width: 110, valueType: 'date' },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name', width: 100 },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at) : '-'),
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
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleEdit(record);
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
    ],
    [t, perms, canAudit],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldScrapApplication>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-scrap-applications"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const res = await scrapApplicationsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
              });
              return { data: res.items ?? [], success: true, total: res.total ?? 0 };
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
