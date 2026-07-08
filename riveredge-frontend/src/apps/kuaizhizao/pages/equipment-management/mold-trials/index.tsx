import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { moldApi } from '../../../services/equipment';
import { trialsApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.moldOps.trial';
const RESOURCE = 'kuaizhizao:mold-trial';

interface MoldTrial {
  id?: number;
  trial_no?: string;
  mold_id?: number;
  mold_code?: string;
  mold_name?: string;
  trial_date?: string;
  supplier?: string;
  trial_count?: number;
  result?: string;
  remark?: string;
  updated_at?: string;
}

const MoldTrialsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MoldTrial | null>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: number }[]>([]);

  const resultOptions = useMemo(
    () => [
      { label: t(`${P}.result.pass`), value: '合格' },
      { label: t(`${P}.result.fail`), value: '不合格' },
      { label: t(`${P}.result.pendingProduction`), value: '待试产' },
    ],
    [t],
  );

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
    formRef.current?.setFieldsValue({ trial_date: dayjs(), trial_count: 1, result: '合格' });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldTrial) => {
    if (!record.id) return;
    const detail = await trialsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadMoldOptions();
    formRef.current?.setFieldsValue({
      mold_id: detail.mold_id,
      trial_date: detail.trial_date ? dayjs(detail.trial_date) : dayjs(),
      supplier: detail.supplier,
      trial_count: detail.trial_count,
      result: detail.result,
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await trialsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      mold_id: values.mold_id,
      trial_date: (values.trial_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      supplier: values.supplier,
      trial_count: values.trial_count,
      result: values.result,
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await trialsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await trialsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<MoldTrial>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.trialDate`),
        dataIndex: 'doc_date_range',
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
        title: t(`${P}.col.trialNo`),
        dataIndex: 'trial_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name', width: 160, ellipsis: true, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.trialDate`),
        dataIndex: 'trial_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.supplier`), dataIndex: 'supplier', width: 120, ellipsis: true, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.trialCount`), dataIndex: 'trial_count', width: 90, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.result`),
        dataIndex: 'result',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag>{r.result ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        sorter: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at) : '-'),
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 180,
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
            {perms.canUpdate && (
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
            {perms.canDelete && (
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
    [t, perms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldTrial>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-trials"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveAssetWorkflowListParams(searchFormValues, sort);
              const res = await trialsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MoldTrial[], success: true, total };
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
          <Col span={12}>
            <ProFormDatePicker
              name="trial_date"
              label={t(`${P}.col.trialDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="trial_count" label={t(`${P}.col.trialCount`)} min={1} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t(`${P}.col.supplier`)} />
          </Col>
          <Col span={12}>
            <ProFormSelect name="result" label={t(`${P}.col.result`)} options={resultOptions} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MoldTrialsPage;
