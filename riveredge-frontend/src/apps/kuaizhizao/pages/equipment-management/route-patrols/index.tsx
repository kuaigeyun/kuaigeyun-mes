import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col, Tag, Table, Switch, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { patrolRoutesApi, routePatrolsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import {
  buildAbnormalityValueEnum,
  buildSpotCheckStatusValueEnum,
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveRoutePatrolListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.routePatrol';
const RESOURCE = 'kuaizhizao:equipment-route-patrol';

interface RoutePatrolLine {
  step_no?: number;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  item_code?: string;
  item_name?: string;
  measured_value?: string;
  is_pass?: boolean;
  remark?: string;
}

interface RoutePatrol {
  id?: number;
  document_no?: string;
  route_id?: number;
  route_code?: string;
  route_name?: string;
  patrol_date?: string;
  inspector_name?: string;
  status?: string;
  has_abnormality?: boolean;
  updated_at?: string;
  lines?: RoutePatrolLine[];
}

const RoutePatrolsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<RoutePatrol | null>(null);
  const [previewLines, setPreviewLines] = useState<RoutePatrolLine[]>([]);
  const [routeOptions, setRouteOptions] = useState<{ label: string; value: number }[]>([]);

  const loadRouteOptions = async () => {
    const res = await patrolRoutesApi.list({ limit: 1000, is_active: true });
    setRouteOptions(
      (res.items ?? []).map((r: { id: number; code: string; name: string }) => ({
        label: `${r.code} - ${r.name}`,
        value: r.id,
      })),
    );
  };

  const handlePreview = async (routeId?: number) => {
    if (!routeId) {
      setPreviewLines([]);
      return;
    }
    try {
      const res = await routePatrolsApi.previewLines({ route_id: routeId });
      setPreviewLines(res.lines ?? []);
    } catch {
      messageApi.error(t(`${P}.previewFailed`));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setModalVisible(true);
    void loadRouteOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ patrol_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: RoutePatrol) => {
    if (!record.id) return;
    const detail = await routePatrolsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setPreviewLines(detail.lines ?? []);
    setModalVisible(true);
    void loadRouteOptions();
    const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
    formRef.current?.setFieldsValue({
      route_id: detail.route_id,
      patrol_date: detail.patrol_date ? dayjs(detail.patrol_date) : dayjs(),
      inspector_uuid: inspectorUuid,
      inspector_id: detail.inspector_id,
      inspector_name: detail.inspector_name,
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await routePatrolsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      route_id: values.route_id,
      patrol_date: (values.patrol_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        step_no: l.step_no,
        equipment_id: l.equipment_id,
        item_code: l.item_code,
        item_name: l.item_name,
        measured_value: l.measured_value,
        is_pass: l.is_pass ?? true,
        remark: l.remark,
      })),
    };
    if (isEdit && current?.id) {
      await routePatrolsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await routePatrolsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const lineColumns = [
    { title: t(`${P}.line.step`), dataIndex: 'step_no', width: 60 },
    { title: t(`${P}.line.equipment`), dataIndex: 'equipment_name', width: 140 },
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 120 },
    {
      title: t(`${P}.line.measuredValue`),
      dataIndex: 'measured_value',
      width: 120,
      render: (_: unknown, row: RoutePatrolLine, index: number) => (
        <Input
          size="small"
          value={row.measured_value}
          onChange={(e) => {
            const next = [...previewLines];
            next[index] = { ...next[index], measured_value: e.target.value };
            setPreviewLines(next);
          }}
        />
      ),
    },
    {
      title: t(`${P}.line.isPass`),
      dataIndex: 'is_pass',
      width: 80,
      render: (_: unknown, row: RoutePatrolLine, index: number) => (
        <Switch
          size="small"
          checked={row.is_pass ?? true}
          onChange={(checked) => {
            const next = [...previewLines];
            next[index] = { ...next[index], is_pass: checked };
            setPreviewLines(next);
          }}
        />
      ),
    },
  ];

  const routePatrolStatusValueEnum = useMemo(() => buildSpotCheckStatusValueEnum(t), [t]);
  const abnormalityValueEnum = useMemo(() => buildAbnormalityValueEnum(t, P), [t]);

  const columns: ProColumns<RoutePatrol>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.patrolDate`),
        dataIndex: 'patrol_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: routePatrolStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        valueType: 'select',
        valueEnum: abnormalityValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.documentNo`),
        dataIndex: 'document_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.route`),
        dataIndex: 'route_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.patrolDate`),
        dataIndex: 'patrol_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.inspector`),
        dataIndex: 'inspector_name',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag>{r.status ?? '-'}</Tag>,
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        width: 80,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.has_abnormality ? <Tag color="error">{t(`${P}.abnormal`)}</Tag> : <Tag color="success">{t(`${P}.normal`)}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        sorter: true,
        defaultSortOrder: 'descend',
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 160,
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
    [t, perms, routePatrolStatusValueEnum, abnormalityValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<RoutePatrol>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.route-patrols"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={EQUIPMENT_OPS_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveRoutePatrolListParams(searchFormValues, sort);
              const res = await routePatrolsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as RoutePatrol[], success: true, total };
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="route_id"
              label={t(`${P}.form.route`)}
              options={routeOptions}
              rules={[{ required: true }]}
              showSearch
              fieldProps={{
                onChange: (val: number) => void handlePreview(val),
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="patrol_date"
              label={t(`${P}.col.patrolDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="inspector_uuid"
              idFieldName="inspector_id"
              nameFieldName="inspector_name"
              label={t(`${P}.col.inspector`)}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        {previewLines.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => String(r.step_no ?? r.equipment_id)}
            columns={lineColumns}
            dataSource={previewLines}
            pagination={false}
            style={{ marginTop: 16 }}
          />
        )}
      </FormModalTemplate>
    </>
  );
};

export default RoutePatrolsPage;
