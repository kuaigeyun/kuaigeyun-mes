import { rowActionKind } from '../../../../../../components/uni-action';
/**
 * 好力 GO — 设备维保单（维修/保养；单台设备；对齐厂内维保单头区）
 */

import React, { startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadProps } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { App, Button, Col, Form, Input, Modal, Row, Space, Spin, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, ToolOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import { UniUserIdSelect, type UniUserIdSelectPreset } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  createEquipmentUpkeepSheet,
  deleteEquipmentUpkeepSheet,
  getEquipment,
  getEquipmentUpkeepSheet,
  fetchEquipmentUpkeepSchemeContext,
  listEquipmentUpkeepParamSets,
  listEquipmentUpkeepSheets,
  listEquipments,
  listHaoligoNotifyUserOptions,
  listWorkshops,
  updateEquipmentUpkeepSheet,
  type EquipmentUpkeepSheetRow,
} from '../../../../services/haoligo';
import { PatrolImagePreview } from '../../../patrol/shared/PatrolImagePreview';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import {
  HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE,
  HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET,
} from '../../../../constants/documentPermissionResources';
import {
  canCompleteSourceDocument,
  canInitiateCompleteCreate,
} from '../../../../../../utils/documentWorkflowPermission';
import { useGlobalStore } from '../../../../../../stores';
import { buildEquipmentUpkeepCompleteCreateFromSheetUrl } from '../../../../utils/equipmentUpkeepCompleteNavigation';

const EQUIP_UPKEEP_SHEET_DOC_NOTIFICATION = 'haoligo_equipment_upkeep_sheet';
const EQUIP_UPKEEP_SHEET_ACTION_CREATED = 'created';

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

const EquipmentUpkeepSheetPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canInitiateComplete =
    canInitiateCompleteCreate(
      currentUser,
      HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET,
      HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE,
    ) || canCompleteSourceDocument(currentUser, HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET);
  const [searchParams] = useSearchParams();
  const urlServiceType = useMemo(() => {
    const value = (searchParams.get('service_type') || '').trim();
    return value === '维修' || value === '保养' ? value : undefined;
  }, [searchParams]);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const {
    applicantPresetUsers,
    leafDeptOptions,
    onApplicantPicked,
    preloadTenantFormOptions: preloadApplicantAndDepartments,
    getCreateApplicantDefaults,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    departmentTreeRef,
    searchApplicantUsers,
  } = useApplicantUserIdField(formRef);
  const workshopMapRef = useRef<Map<number, { code: string; name: string }>>(new Map());
  const [upkeepSetOptions, setUpkeepSetOptions] = useState<{ value: number; label: string }[]>([]);
  const [equipmentWorkshopLabel, setEquipmentWorkshopLabel] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const notifyLabelRef = useRef(new Map<number, string>());

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const upkeepSheetNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        EQUIP_UPKEEP_SHEET_DOC_NOTIFICATION,
        EQUIP_UPKEEP_SHEET_ACTION_CREATED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const upkeepSheetNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(upkeepSheetNotifyRule),
    [upkeepSheetNotifyRule],
  );

  const title = t('app.haoligo.menu.equipment.documents.upkeep-sheet');

  const handleCreateCompleteFromRow = useCallback(
    (record: EquipmentUpkeepSheetRow) => {
      navigate(buildEquipmentUpkeepCompleteCreateFromSheetUrl(record.id));
    },
    [navigate],
  );

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

  const loadUpkeepSetOptions = useCallback(async () => {
    try {
      const rows = await listEquipmentUpkeepParamSets();
      setUpkeepSetOptions(rows.map((s) => ({ value: s.id, label: `${s.code} ${s.name}` })));
    } catch {
      setUpkeepSetOptions([]);
    }
  }, []);

  const loadWorkshopMap = useCallback(async () => {
    try {
      const rows = await listWorkshops();
      workshopMapRef.current = new Map(rows.map((w) => [w.id, { code: w.code, name: w.name }]));
    } catch {
      workshopMapRef.current = new Map();
    }
  }, []);

  const preloadFormOptions = useCallback(
    async (applicantPresets?: UniUserIdSelectPreset[]) => {
      await Promise.all([
        preloadApplicantAndDepartments(applicantPresets),
        loadWorkshopMap(),
        loadUpkeepSetOptions(),
      ]);
    },
    [loadUpkeepSetOptions, loadWorkshopMap, preloadApplicantAndDepartments],
  );

  const formatWorkshopLabel = useCallback((workshopId: number) => {
    const w = workshopMapRef.current.get(workshopId);
    return w ? `${w.code} · ${w.name}` : '—';
  }, []);

  const syncEquipmentWorkshop = useCallback(
    async (equipmentId: number | null | undefined) => {
      if (equipmentId == null || !Number.isFinite(Number(equipmentId))) {
        setEquipmentWorkshopLabel('');
        return;
      }
      try {
        const eq = await getEquipment(Number(equipmentId));
        setEquipmentWorkshopLabel(formatWorkshopLabel(eq.workshop_id));
      } catch {
        setEquipmentWorkshopLabel('');
      }
    },
    [formatWorkshopLabel],
  );

  const searchUpkeepSheetNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('complete_notify_user_ids') as number[] | undefined) || []);
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        notifyLabelRef.current.set(o.value, o.label);
      }
      return opts;
    },
    [],
  );

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> =>
      withMoldPictureCardUploadClass({
        listType: 'picture-card',
        accept: '.jpg,.jpeg,.png,.gif,.webp',
        beforeUpload: (file) => {
          const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
          if (!isLt30M) {
            messageApi.error('单个文件需小于 30MB');
            return Upload.LIST_IGNORE;
          }
          return true;
        },
        customRequest: async (options) => {
          try {
            const file = options.file as Parameters<typeof uploadFile>[0];
            const res = await uploadFile(file, { category: 'haoligo_equipment_upkeep' });
            options.onSuccess?.(res, options.file);
          } catch (err) {
            options.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        },
      }),
    [messageApi],
  );

  const handleCreate = useCallback(() => {
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setEquipmentWorkshopLabel('');
    setFormOptionsReady(false);
    setModalVisible(true);
    void (async () => {
      try {
        await preloadFormOptions(undefined);
        const applicantDefaults = getCreateApplicantDefaults();
        setFormInitialValues({
          service_type: urlServiceType ?? '保养',
          ...applicantDefaults,
          equipment_id: undefined,
          description: '',
          header_attachments: [],
          complete_notify_user_ids: [...upkeepSheetNotifyDefaults],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch {
        messageApi.error(t('app.haoligo.equipment.upkeep.loadOptionsFailed'));
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    })();
  }, [getCreateApplicantDefaults, messageApi, preloadFormOptions, t, urlServiceType, upkeepSheetNotifyDefaults]);

  const handleMainModalCancel = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setFormOptionsReady(false);
    setIsDetailView(false);
    setEquipmentWorkshopLabel('');
  }, []);

  const openSheetForm = useCallback(
    async (record: EquipmentUpkeepSheetRow, detailOnly: boolean) => {
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(record.id);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const d = await getEquipmentUpkeepSheet(record.id);
        const preset = presetFromApplicantRow(d);
        await preloadFormOptions(preset ? [preset] : undefined);
        const initDept = resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid);
        setFormInitialValues({
          service_type: (d.service_type || '保养').trim() === '维修' ? '维修' : '保养',
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept,
          equipment_id: d.equipment_id,
          upkeep_param_set_id: d.upkeep_param_set_id ?? undefined,
          description: d.description,
          header_attachments: await uuidsToSecureUploadFileList(d.header_attachment_file_uuids),
          complete_notify_user_ids:
            d.complete_notify_user_ids?.length ? d.complete_notify_user_ids : [...upkeepSheetNotifyDefaults],
        });
        await syncEquipmentWorkshop(d.equipment_id);
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        setModalVisible(false);
        setFormOptionsReady(false);
        setIsDetailView(false);
      }
    },
    [
      messageApi,
      preloadFormOptions,
      presetFromApplicantRow,
      resolveInitDepartmentUuid,
      syncEquipmentWorkshop,
      t,
      upkeepSheetNotifyDefaults,
    ],
  );

  const triggerSubmit = useCallback(() => {
    if (isDetailView) return;
    if (!formOptionsReady) {
      messageApi.warning('表单加载中，请稍候');
      return;
    }
    globalThis.setTimeout(() => {
      const inst = formRef.current;
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning('表单未就绪');
        return;
      }
      inst.submit();
    }, 0);
  }, [formOptionsReady, isDetailView, messageApi]);

  useSubmitShortcut(triggerSubmit, modalVisible && !isDetailView);

  const handleSubmit = async (values: Record<string, unknown>) => {
    const applicantRaw = values.applicant_user_id;
    const applicantId =
      typeof applicantRaw === 'number'
        ? applicantRaw
        : typeof applicantRaw === 'string'
          ? Number(applicantRaw)
          : NaN;
    if (!Number.isFinite(applicantId)) {
      messageApi.error(t('app.haoligo.equipment.upkeep.selectApplicant'));
      return Promise.reject(new Error('validation'));
    }
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error(t('app.haoligo.equipment.upkeep.selectDept'));
      return Promise.reject(new Error('validation'));
    }
    if (!deptLabelByUuid.has(deptUuid)) {
      messageApi.error(t('app.haoligo.equipment.upkeep.deptInvalid'));
      return Promise.reject(new Error('validation'));
    }
    const equipmentId = Number(values.equipment_id);
    if (!Number.isFinite(equipmentId)) {
      messageApi.error(t('app.haoligo.equipment.documents.spotCheckSelectEquipmentFirst'));
      return Promise.reject(new Error('validation'));
    }
    const serviceType = values.service_type === '维修' ? '维修' : '保养';
    const desc = String(values.description ?? '').trim();
    if (!desc) {
      messageApi.error(
        serviceType === '维修'
          ? t('app.haoligo.equipment.upkeep.descRepairRequired')
          : t('app.haoligo.equipment.upkeep.descRequired'),
      );
      return Promise.reject(new Error('validation'));
    }
    const headerUuids = normUploadUuids(values.header_attachments);
    const completeNotifyIds = parseNotifyUserIds(values.complete_notify_user_ids);
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateEquipmentUpkeepSheet(editId, {
          service_type: serviceType,
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          equipment_id: equipmentId,
          description: desc || undefined,
          upkeep_param_set_id:
            serviceType === '保养' && values.upkeep_param_set_id != null
              ? Number(values.upkeep_param_set_id)
              : undefined,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : [],
          complete_notify_user_ids: completeNotifyIds,
        });
        messageApi.success(t('app.haoligo.equipment.upkeep.saved'));
      } else {
        await createEquipmentUpkeepSheet({
          service_type: serviceType,
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          equipment_id: equipmentId,
          description: desc || null,
          upkeep_param_set_id:
            serviceType === '保养' && values.upkeep_param_set_id != null
              ? Number(values.upkeep_param_set_id)
              : undefined,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : undefined,
          complete_notify_user_ids: completeNotifyIds,
        });
        messageApi.success(t('app.haoligo.equipment.upkeep.submitted'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      if ((e as Error).message !== 'validation') {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      }
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteOne = (record: EquipmentUpkeepSheetRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.upkeep.confirmDelete'),
      content: t('app.haoligo.equipment.upkeep.confirmDeleteContent'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEquipmentUpkeepSheet(record.id);
          messageApi.success(t('app.haoligo.equipment.updateSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        }
      },
    });
  };

  const columns: ProColumns<EquipmentUpkeepSheetRow>[] = [
    {
      title: t('app.haoligo.equipment.upkeep.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('app.haoligo.equipment.upkeep.keywordPh') },
    },
    {
      title: t('app.haoligo.equipment.documents.colSheetNo'),
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.serviceType'),
      dataIndex: 'service_type',
      width: 90,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.department'),
      dataIndex: 'department_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.applicant'),
      dataIndex: 'applicant_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.documents.colEquipment'),
      dataIndex: 'equipment_asset_code',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) =>
        r.equipment_asset_code || r.equipment_name
          ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
          : `ID ${r.equipment_id}`,
    },
    {
      title: t('app.haoligo.equipment.upkeep.reasonCol'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    moldDocumentCreatedAtColumn<EquipmentUpkeepSheetRow>(),
    {
      title: t('app.haoligo.equipment.documents.colActions'),
      valueType: 'option',
      width: 280,
      fixed: 'right',
      render: (_, record) => {
        const canComplete = canInitiateComplete && Boolean(record.can_complete);
        return (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => void openSheetForm(record, true)}>
              {t('app.haoligo.equipment.documents.actionView')}
            </Button>
            {canComplete ? (
              <Button
                key="complete"
                {...rowActionKind('complete')}
                icon={<ToolOutlined />}
                onClick={() => handleCreateCompleteFromRow(record)}
              >
                完成
              </Button>
            ) : null}
            <Button key="edit" {...rowActionKind('update')} onClick={() => void openSheetForm(record, false)}>
              {t('app.haoligo.equipment.documents.actionEdit')}
            </Button>
            <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
              {t('app.haoligo.equipment.documents.actionDelete')}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentUpkeepSheetRow>
          headerTitle={title}
          columnPersistenceId="apps.haoligo.pages.equipment.documents.upkeep-sheet"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.documents.btnNew')}
          onCreate={handleCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listEquipmentUpkeepSheets({
                skip,
                limit: pageSize,
                service_type: urlServiceType,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1100 }}
        />
      </ListPageTemplate>

      <Modal
        title={
          isDetailView
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : isEdit
              ? `${title} — ${t('app.haoligo.equipment.documents.actionEdit')}`
              : `${title} — ${t('app.haoligo.equipment.documents.phaseNew')}`
        }
        open={modalVisible}
        onCancel={handleMainModalCancel}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <Button htmlType="button" onClick={handleMainModalCancel}>
              {t('app.haoligo.equipment.documents.btnClose')}
            </Button>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <Button htmlType="button" type="primary" disabled={!formOptionsReady} loading={formLoading} onClick={triggerSubmit}>
                {t('app.haoligo.equipment.documents.btnSave')}
                {SUBMIT_SHORTCUT_HINT}
              </Button>
            </div>
          )
        }
      >
        <div className="form-modal-content-inner">
          {!formOptionsReady ? (
            <div style={{ display: 'flex', minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Spin tip="加载选项中…" />
            </div>
          ) : (
            <ProForm
              key={modalVisible ? `${isEdit}-${editId ?? 'n'}-${isDetailView}` : 'closed'}
              formRef={formRef}
              loading={formLoading}
              readonly={isDetailView}
              onFinish={handleSubmit}
              onFinishFailed={({ errorFields }) => {
                const first = errorFields?.[0];
                const text = first?.errors?.filter(Boolean)[0];
                messageApi.error(text || '请检查表单');
              }}
              initialValues={formInitialValues}
              submitter={false}
              layout="vertical"
              scrollToFirstError
            >
              <Row gutter={16}>
                <Col span={12}>
                  <UniUserIdSelect
                    name="applicant_user_id"
                    label={t('app.haoligo.equipment.upkeep.applicant')}
                    placeholder="请输入姓名或账号搜索"
                    required
                    presetUsers={applicantPresetUsers}
                    onUserPicked={onApplicantPicked}
                    searchUsers={searchApplicantUsers}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="department_uuid"
                    label={t('app.haoligo.equipment.upkeep.department')}
                    placeholder="请选择申请部门"
                    rules={[{ required: true, message: t('app.haoligo.equipment.upkeep.selectDept') }]}
                    options={leafDeptOptions}
                    showSearch
                    fieldProps={{
                      virtual: true,
                      listHeight: 256,
                      optionFilterProp: 'label',
                    }}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="equipment_id"
                    label={t('app.haoligo.equipment.documents.formEquipment')}
                    rules={[{ required: true }]}
                    showSearch
                    fieldProps={{
                      filterOption: false,
                      style: { width: '100%' },
                      onChange: (val: number | null) => {
                        void syncEquipmentWorkshop(val);
                        if (val != null && Number.isFinite(Number(val))) {
                          void fetchEquipmentUpkeepSchemeContext(Number(val))
                            .then((ctx) => {
                              if (ctx.ledger_upkeep_param_set_id != null) {
                                formRef.current?.setFieldValue(
                                  'upkeep_param_set_id',
                                  ctx.ledger_upkeep_param_set_id,
                                );
                              }
                            })
                            .catch(() => undefined);
                        }
                      },
                    }}
                    request={async ({ keyWords }) => {
                      const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                      return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Form.Item label={t('app.haoligo.equipment.ledger.formWorkshop')}>
                    <Input
                      readOnly
                      value={equipmentWorkshopLabel}
                      placeholder={t('app.haoligo.equipment.upkeep.equipmentWorkshopAutoPh')}
                      style={{ width: '100%', backgroundColor: isDetailView ? undefined : '#fafafa' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="service_type"
                    label={t('app.haoligo.equipment.upkeep.serviceType')}
                    disabled={isEdit || isDetailView}
                    rules={[{ required: true }]}
                    options={[
                      { label: t('app.haoligo.equipment.upkeep.serviceTypeUpkeep'), value: '保养' },
                      { label: t('app.haoligo.equipment.upkeep.serviceTypeRepair'), value: '维修' },
                    ]}
                    fieldProps={{
                      onChange: () => {
                        formRef.current?.setFieldsValue({ description: undefined });
                      },
                    }}
                  />
                </Col>
                <FormNotifyUsersSelect
                  inline
                  colSpan={12}
                  name="complete_notify_user_ids"
                  label="提交通知人员"
                  placeholder="请选择提交通知人员（抄送）"
                  readonly={isDetailView}
                  seedUserIds={upkeepSheetNotifyDefaults}
                  searchUsers={(keyword, selectedIds) =>
                    searchUpkeepSheetNotifyUsers(keyword, selectedIds)
                  }
                />
                <Col span={12}>
                  <ProFormDependency name={['service_type', 'equipment_id']}>
                    {({ service_type, equipment_id }) =>
                      service_type === '保养' ? (
                        <ProFormSelect
                          name="upkeep_param_set_id"
                          label="保养方案"
                          placeholder={equipment_id ? '请选择保养方案' : '请先选择设备'}
                          options={upkeepSetOptions}
                          disabled={isDetailView || !equipment_id}
                          showSearch
                          rules={[{ required: !isDetailView, message: '请选择保养方案' }]}
                          fieldProps={{ optionFilterProp: 'label' }}
                        />
                      ) : null
                    }
                  </ProFormDependency>
                </Col>
                <Col span={12}>
                  <ProFormDependency name={['service_type']}>
                    {({ service_type }) => {
                      const isUpkeep = service_type === '保养';
                      const reasonLabel = isUpkeep
                        ? t('app.haoligo.equipment.upkeep.desc')
                        : t('app.haoligo.equipment.upkeep.descRepair');
                      const dictCode = isUpkeep
                        ? 'HAOLIGO_EQUIPMENT_MAINTENANCE_REASON'
                        : 'HAOLIGO_EQUIPMENT_REPAIR_REASON';
                      return (
                        <DictionarySelect
                          key={dictCode}
                          dictionaryCode={dictCode}
                          hostResource={HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET}
                          name="description"
                          label={reasonLabel}
                          placeholder={t('app.haoligo.equipment.upkeep.descPh', { label: reasonLabel })}
                          rules={[
                            {
                              required: true,
                              message: isUpkeep
                                ? t('app.haoligo.equipment.upkeep.descRequired')
                                : t('app.haoligo.equipment.upkeep.descRepairRequired'),
                            },
                          ]}
                          formRef={formRef}
                          simpleQuickCreate
                          colProps={{ span: 12 }}
                        />
                      );
                    }}
                  </ProFormDependency>
                </Col>
                <Col span={24}>
                  <ProFormDependency name={['service_type']}>
                    {({ service_type }) =>
                      isDetailView ? (
                        <Form.Item
                          label={
                            service_type === '维修'
                              ? t('app.haoligo.equipment.upkeep.attachBeforeRepair')
                              : t('app.haoligo.equipment.upkeep.attachBefore')
                          }
                        >
                          <PatrolImagePreview
                            files={(formInitialValues?.header_attachments as UploadFile[] | undefined) ?? []}
                          />
                        </Form.Item>
                      ) : (
                        <ProFormUploadButton
                          name="header_attachments"
                          label={
                            service_type === '维修'
                              ? t('app.haoligo.equipment.upkeep.attachBeforeRepair')
                              : t('app.haoligo.equipment.upkeep.attachBefore')
                          }
                          max={10}
                          fieldProps={uploadFieldProps}
                        />
                      )
                    }
                  </ProFormDependency>
                </Col>
              </Row>
            </ProForm>
          )}
        </div>
      </Modal>
    </>
  );
};

export default EquipmentUpkeepSheetPage;
