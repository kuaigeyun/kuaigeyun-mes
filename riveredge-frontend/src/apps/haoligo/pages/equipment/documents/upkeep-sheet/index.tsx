/**
 * 好力 GO — 设备保养单（对齐厂内维保单头区：申请人、末级部门、保养前附件、单台设备；仅保养）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormInstance,
  ProFormSelect,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadProps } from 'antd';
import { App, Button, Col, Modal, Row, Space, Spin, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import type { DepartmentTreeItem } from '../../../../../../services/department';
import { getDepartmentTree } from '../../../../../../services/department';
import { getUserList } from '../../../../../../services/user';
import { useGlobalStore } from '../../../../../../stores';
import {
  createEquipmentUpkeepSheet,
  deleteEquipmentUpkeepSheet,
  getEquipmentUpkeepSheet,
  listEquipmentUpkeepSheets,
  listEquipments,
  updateEquipmentUpkeepSheet,
  type EquipmentUpkeepSheetRow,
} from '../../../../services/haoligo';
import { normUploadUuids, uuidsToUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

const APPLICANT_BOOTSTRAP_PAGE_SIZE = 120;

function collectLeafDepartmentOptions(items: DepartmentTreeItem[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const n of items) {
    if (n.children?.length) {
      out.push(...collectLeafDepartmentOptions(n.children));
    } else {
      out.push({ label: n.name, value: n.uuid });
    }
  }
  return out;
}

function findDeptNodeByUuid(items: DepartmentTreeItem[], uuid: string): DepartmentTreeItem | null {
  for (const n of items) {
    if (n.uuid === uuid) return n;
    if (n.children?.length) {
      const f = findDeptNodeByUuid(n.children, uuid);
      if (f) return f;
    }
  }
  return null;
}

function firstLeafUuidUnder(node: DepartmentTreeItem): string {
  if (!node.children?.length) return node.uuid;
  for (const c of node.children) {
    return firstLeafUuidUnder(c);
  }
  return node.uuid;
}

function resolveDefaultLeafDeptUuid(
  tree: DepartmentTreeItem[],
  userDeptUuid: string | undefined,
): string | undefined {
  const u = (userDeptUuid || '').trim();
  if (!u || !tree.length) return undefined;
  const node = findDeptNodeByUuid(tree, u);
  if (!node) return undefined;
  return firstLeafUuidUnder(node);
}

const EquipmentUpkeepSheetPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const applicantDeptUuidByUserIdRef = useRef<Map<number, string>>(new Map());
  const applicantLabelByIdRef = useRef<Map<number, string>>(new Map());
  const applicantBootstrapOptionsRef = useRef<{ label: string; value: number }[]>([]);
  const applicantSearchSeqRef = useRef(0);
  const applicantSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentTreeRef = useRef<DepartmentTreeItem[]>([]);
  const tenantFormOptionsValidUntilRef = useRef(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [applicantOptions, setApplicantOptions] = useState<{ label: string; value: number }[]>([]);
  const [leafDeptOptions, setLeafDeptOptions] = useState<{ label: string; value: string }[]>([]);

  const title = t('app.haoligo.menu.equipment.documents.upkeep-sheet');

  useEffect(() => {
    if (modalVisible) return;
    if (applicantSearchTimerRef.current) {
      clearTimeout(applicantSearchTimerRef.current);
      applicantSearchTimerRef.current = null;
    }
    applicantSearchSeqRef.current += 1;
  }, [modalVisible]);

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

  const loadLeafDepartments = useCallback(async () => {
    try {
      const tree = await getDepartmentTree({ is_active: true });
      const items = tree.items || [];
      departmentTreeRef.current = items;
      setLeafDeptOptions(collectLeafDepartmentOptions(items));
    } catch {
      departmentTreeRef.current = [];
      setLeafDeptOptions([]);
    }
  }, []);

  const bootstrapApplicantOptions = useCallback(
    async (extras?: { id: number; name: string; deptUuid?: string }[]) => {
      const emptyDept = new Map<number, string>();
      const emptyLabel = new Map<number, string>();
      try {
        const res = await getUserList({
          page: 1,
          page_size: APPLICANT_BOOTSTRAP_PAGE_SIZE,
          is_active: true,
        });
        const deptMap = new Map<number, string>();
        const labelMap = new Map<number, string>();
        const opts: { label: string; value: number }[] = [];
        for (const u of res.items || []) {
          const person = (u.full_name || '').trim() || u.username;
          deptMap.set(u.id, (u.department?.uuid || '').trim());
          labelMap.set(u.id, person);
          opts.push({ value: u.id, label: person });
        }
        const cu = useGlobalStore.getState().currentUser;
        if (cu?.id != null && Number.isFinite(cu.id) && !deptMap.has(cu.id)) {
          const person = (cu.full_name || '').trim() || cu.username || `用户#${cu.id}`;
          deptMap.set(cu.id, (cu.department?.uuid || '').trim());
          labelMap.set(cu.id, person);
          opts.unshift({ value: cu.id, label: person });
        }
        for (const ex of extras || []) {
          if (!deptMap.has(ex.id)) {
            deptMap.set(ex.id, (ex.deptUuid || '').trim());
            labelMap.set(ex.id, ex.name);
            opts.push({ value: ex.id, label: ex.name });
          }
        }
        applicantDeptUuidByUserIdRef.current = deptMap;
        applicantLabelByIdRef.current = labelMap;
        applicantBootstrapOptionsRef.current = opts.slice();
        setApplicantOptions(opts);
      } catch {
        applicantDeptUuidByUserIdRef.current = emptyDept;
        applicantLabelByIdRef.current = emptyLabel;
        applicantBootstrapOptionsRef.current = [];
        setApplicantOptions([]);
      }
    },
    [],
  );

  const flushApplicantSearch = useCallback(async (keyword: string) => {
    const seq = ++applicantSearchSeqRef.current;
    const kw = keyword.trim();
    if (!kw) {
      if (seq !== applicantSearchSeqRef.current) return;
      setApplicantOptions(applicantBootstrapOptionsRef.current.slice());
      return;
    }
    try {
      const res = await getUserList({ page: 1, page_size: 50, is_active: true, keyword: kw });
      if (seq !== applicantSearchSeqRef.current) return;
      const deptMap = applicantDeptUuidByUserIdRef.current;
      const labelMap = applicantLabelByIdRef.current;
      const next: { label: string; value: number }[] = [];
      for (const u of res.items || []) {
        const person = (u.full_name || '').trim() || u.username;
        deptMap.set(u.id, (u.department?.uuid || '').trim());
        labelMap.set(u.id, person);
        next.push({ value: u.id, label: person });
      }
      const inst = formRef.current;
      const selId = inst?.getFieldValue('applicant_user_id') as number | undefined;
      if (selId != null && Number.isFinite(selId) && !next.some((o) => o.value === selId)) {
        const g = useGlobalStore.getState();
        const cu = g.currentUser;
        const lab =
          labelMap.get(selId) ||
          (cu?.id === selId
            ? ((cu.full_name || '').trim() || cu.username || `用户#${selId}`)
            : `用户#${selId}`);
        const du =
          (deptMap.get(selId) || '').trim() ||
          (cu?.id === selId ? (cu.department?.uuid || '').trim() : '');
        deptMap.set(selId, du);
        labelMap.set(selId, lab);
        next.unshift({ value: selId, label: lab });
      }
      setApplicantOptions(next);
    } catch {
      if (seq !== applicantSearchSeqRef.current) return;
      setApplicantOptions(applicantBootstrapOptionsRef.current.slice());
    }
  }, []);

  const scheduleApplicantSearch = useCallback(
    (raw: string) => {
      if (applicantSearchTimerRef.current) clearTimeout(applicantSearchTimerRef.current);
      applicantSearchTimerRef.current = setTimeout(() => {
        applicantSearchTimerRef.current = null;
        void flushApplicantSearch(raw);
      }, 280);
    },
    [flushApplicantSearch],
  );

  const preloadTenantFormOptions = useCallback(
    async (extras?: { id: number; name: string; deptUuid?: string }[]) => {
      const ttlMs = 90_000;
      const now = Date.now();
      const warm =
        !extras &&
        now < tenantFormOptionsValidUntilRef.current &&
        applicantDeptUuidByUserIdRef.current.size > 0 &&
        departmentTreeRef.current.length > 0;
      if (warm) return;
      await Promise.all([bootstrapApplicantOptions(extras), loadLeafDepartments()]);
      tenantFormOptionsValidUntilRef.current = extras ? 0 : Date.now() + ttlMs;
    },
    [bootstrapApplicantOptions, loadLeafDepartments],
  );

  const syncDefaultDepartmentForApplicant = useCallback((userId: number | undefined) => {
    const inst = formRef.current;
    if (!inst) return;
    if (userId == null || !Number.isFinite(userId)) {
      inst.setFieldsValue({ department_uuid: undefined });
      return;
    }
    const tree = departmentTreeRef.current;
    let userDeptUuid = (applicantDeptUuidByUserIdRef.current.get(userId) || '').trim();
    if (!userDeptUuid) {
      const cu = useGlobalStore.getState().currentUser;
      if (cu?.id === userId && cu.department?.uuid) userDeptUuid = cu.department.uuid.trim();
    }
    const leaf = resolveDefaultLeafDeptUuid(tree, userDeptUuid || undefined);
    if (leaf) inst.setFieldsValue({ department_uuid: leaf });
    else inst.setFieldsValue({ department_uuid: undefined });
  }, []);

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> => ({
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
    setFormOptionsReady(false);
    setModalVisible(true);
    void (async () => {
      try {
        await preloadTenantFormOptions(undefined);
        const tree = departmentTreeRef.current;
        const cu = useGlobalStore.getState().currentUser;
        const uid = cu?.id;
        let deptUuid: string | undefined;
        if (uid != null) {
          const uu = (applicantDeptUuidByUserIdRef.current.get(uid) || cu?.department?.uuid || '').trim();
          deptUuid = resolveDefaultLeafDeptUuid(tree, uu || undefined);
        }
        setFormInitialValues({
          applicant_user_id: uid,
          department_uuid: deptUuid,
          equipment_id: undefined,
          description: '',
          header_attachments: [],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch {
        messageApi.error(t('app.haoligo.equipment.upkeep.loadOptionsFailed'));
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    })();
  }, [messageApi, preloadTenantFormOptions, t]);

  const handleMainModalCancel = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setFormOptionsReady(false);
    setIsDetailView(false);
  }, []);

  useNewShortcut(handleCreate);

  const openSheetForm = useCallback(
    async (record: EquipmentUpkeepSheetRow, detailOnly: boolean) => {
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(record.id);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const d = await getEquipmentUpkeepSheet(record.id);
        const extras =
          d.applicant_user_id != null
            ? [
                {
                  id: d.applicant_user_id,
                  name: (d.applicant_name || '').trim() || `用户#${d.applicant_user_id}`,
                  deptUuid: (d.department_uuid || '').trim(),
                },
              ]
            : undefined;
        await preloadTenantFormOptions(extras);
        let initDept = (d.department_uuid || '').trim();
        if (!initDept && d.applicant_user_id != null) {
          const uu = (applicantDeptUuidByUserIdRef.current.get(d.applicant_user_id) || '').trim();
          initDept = resolveDefaultLeafDeptUuid(departmentTreeRef.current, uu) || '';
        }
        setFormInitialValues({
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept || undefined,
          equipment_id: d.equipment_id,
          description: d.description,
          header_attachments: uuidsToUploadFileList(d.header_attachment_file_uuids),
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        setModalVisible(false);
        setFormOptionsReady(false);
        setIsDetailView(false);
      }
    },
    [messageApi, preloadTenantFormOptions, t],
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
    const desc = String(values.description ?? '').trim();
    if (!desc) {
      messageApi.error(t('app.haoligo.equipment.upkeep.descRequired'));
      return Promise.reject(new Error('validation'));
    }
    const headerUuids = normUploadUuids(values.header_attachments);
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateEquipmentUpkeepSheet(editId, {
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          equipment_id: equipmentId,
          description: desc,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : [],
        });
        messageApi.success(t('app.haoligo.equipment.upkeep.saved'));
      } else {
        await createEquipmentUpkeepSheet({
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          equipment_id: equipmentId,
          description: desc,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : undefined,
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
      title: t('app.haoligo.equipment.documents.colDescription'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    moldDocumentCreatedAtColumn<EquipmentUpkeepSheetRow>(),
    {
      title: t('app.haoligo.equipment.documents.colActions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openSheetForm(record, true)}>
            {t('app.haoligo.equipment.documents.actionView')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void openSheetForm(record, false)}>
            {t('app.haoligo.equipment.documents.actionEdit')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
            {t('app.haoligo.equipment.documents.actionDelete')}
          </Button>
        </Space>
      ),
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
                  <ProFormSelect
                    name="applicant_user_id"
                    label={t('app.haoligo.equipment.upkeep.applicant')}
                    placeholder="可选中后搜索更多用户"
                    rules={[{ required: true, message: t('app.haoligo.equipment.upkeep.selectApplicant') }]}
                    options={applicantOptions}
                    showSearch
                    fieldProps={{
                      virtual: true,
                      listHeight: 256,
                      optionFilterProp: 'label',
                      filterOption: false,
                      onSearch: scheduleApplicantSearch,
                      onChange: (v: number) => {
                        syncDefaultDepartmentForApplicant(v);
                      },
                    }}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="department_uuid"
                    label={t('app.haoligo.equipment.upkeep.department')}
                    placeholder="请选择末级申请部门"
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
                <Col span={24}>
                  <ProFormSelect
                    name="equipment_id"
                    label={t('app.haoligo.equipment.documents.formEquipment')}
                    rules={[{ required: true }]}
                    disabled={isDetailView}
                    showSearch
                    fieldProps={{ filterOption: false }}
                    request={async ({ keyWords }) => {
                      const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                      return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
                    }}
                  />
                </Col>
                <Col span={24}>
                  <ProFormTextArea
                    name="description"
                    label={t('app.haoligo.equipment.upkeep.desc')}
                    rules={[{ required: true, message: t('app.haoligo.equipment.upkeep.descRequired') }]}
                    fieldProps={{ rows: 4, maxLength: 4000, showCount: true }}
                  />
                </Col>
                <Col span={24}>
                  <ProFormUploadButton
                    name="header_attachments"
                    label={t('app.haoligo.equipment.upkeep.attachBefore')}
                    max={10}
                    fieldProps={uploadFieldProps}
                  />
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
