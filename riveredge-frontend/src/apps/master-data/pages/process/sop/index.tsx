/**
 * 标准操作SOP管理页面
 * 
 * 提供标准操作SOP的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemProps, ProFormDependency } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Row, Col, List, Typography, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { EditOutlined, DeleteOutlined, PlusOutlined, HighlightOutlined } from '@ant-design/icons';
import SOPBatchCreateSteps from './SOPBatchCreateSteps';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { ROW_ACTIONS_INLINE_GAP, rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { downloadFile } from '../../../../../utils';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { ListPageTemplate, FormModalTemplate, detailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { ProcessMasterDetailDrawer } from '../shared/processMasterDetailDrawer';
import { renderMasterActiveTag } from '../../../utils/masterListPresentation';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import { CustomFieldsFormSection } from '../../../../../components/custom-fields';

const SOP_CUSTOM_FIELD_TABLE = 'master_data_sops';

import { sopApi, operationApi, processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import {
  buildMasterCrudActiveValueEnum,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  resolveSopListParams,
} from '../../../utils/processListCore';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { MaterialListResponse } from '../../../types/material';
import type { SOP, SOPCreate, SOPUpdate, Operation } from '../../../types/process';
import {
  MATERIAL_SELECT_OPTION_ITEM_HEIGHT,
  MaterialSelectOptionContent,
  formatMaterialSelectLabel,
} from '../../../../../components/uni-material-select';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import {
  findSopBindingConflicts,
  formatSopBindingConflictLabels,
  getBoundOperationIds,
} from '../../../utils/sopBindingDuplicate';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
const SOP_PAGE_CODE = 'master-data-process-sop';

/**
 * 标准操作SOP管理列表页面组件
 */
const SOPPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const sopActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'app.master-data.plants.enabled', 'app.master-data.plants.disabled'),
    [t],
  );
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSOPUuid, setCurrentSOPUuid] = useState<string | null>(null);
  const [sopDetail, setSopDetail] = useState<SOP | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  
  // Modal 相关状态（创建/编辑SOP；作业指导与报工采集在图形化设计页管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // 新建 Modal 状态（仅批量创建时使用）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  
  // 工序列表（用于下拉选择）
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  // 物料组/物料/工艺路线（绑定与载入用）
  const [materialGroups, setMaterialGroups] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<
    Array<{
      uuid: string;
      code: string;
      mainCode?: string;
      name: string;
      specification?: string;
      model?: string;
      images?: Array<string | { uuid?: string; uid?: string }>;
    }>
  >([]);
  const [routes, setRoutes] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [existingSopsForCheck, setExistingSopsForCheck] = useState<SOP[]>([]);
  const [sopPreviewCode, setSopPreviewCode] = useState<string | null>(null);

  const {
    customFields: sopFormCustomFields,
    customFieldValues: sopFormCustomFieldValues,
    loadFieldValues: loadSopFormFieldValues,
    extractFormValues: extractSopFormValues,
    saveCustomFieldValues: saveSopCustomFieldValues,
    resetFieldValues: resetSopFormFieldValues,
  } = useCustomFields({ tableName: SOP_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: sopListCustomFields,
    generateCustomFieldColumns: generateSopCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichSopRecordsWithCustomFields,
    customFieldValues: sopDetailCustomFieldValues,
    loadFieldValuesForDetail: loadSopFieldValuesForDetail,
    resetDetailFieldValues: resetSopDetailFieldValues,
  } = useCustomFieldsForList<SOP>({ tableName: SOP_CUSTOM_FIELD_TABLE });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: sopApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });
  const sopOperationCodeOptions = useMemo(
    () =>
      operations
        .map((o) => String(o.code || '').trim())
        .filter(Boolean),
    [operations],
  );

  const sopImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.sop.codeLabel' },
          { field: 'name', required: true, labelKey: 'app.master-data.sop.nameLabel' },
          { field: 'version', labelKey: 'app.master-data.sop.versionLabel' },
          {
            field: 'operationCode',
            labelKey: 'app.master-data.sop.operationLabel',
            aliases: ['工序编号', '关联工序', 'operation_code'],
            options: sopOperationCodeOptions,
          },
          {
            field: 'isActive',
            labelKey: 'app.master-data.sop.isActiveLabel',
            aliases: ['是否启用', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.master-data.sop.importExample.code'),
          t('app.master-data.sop.importExample.name'),
          t('app.master-data.sop.importExample.version'),
          sopOperationCodeOptions[0] ?? '',
          '是',
        ],
      ),
    [t, i18n.language, sopOperationCodeOptions],
  );

  /**
   * 从 URL 参数打开编辑弹窗（editUuid）、设计页（editUuid+tab=workflow/formConfig）或新建弹窗（create=1）
   */
  useEffect(() => {
    const editUuid = searchParams.get('editUuid');
    const tab = searchParams.get('tab');
    const create = searchParams.get('create');
    if (editUuid) {
      if (tab === 'workflow' || tab === 'formConfig') {
        navigate(`/apps/master-data/process/sop/designer?uuid=${editUuid}&from=edit`, { replace: true });
        setSearchParams({}, { replace: true });
        return;
      }
      const initialTab = tab === 'scope' ? 'scope' : undefined;
      handleEdit({ uuid: editUuid } as SOP, initialTab).then(() => {
        setSearchParams({}, { replace: true });
      });
    } else if (create === '1') {
      setIsEdit(false);
      setCurrentSOPUuid(null);
      formRef.current?.resetFields();
      setModalVisible(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams.get('editUuid'), searchParams.get('create')]);

  /**
   * 加载工序、物料组、物料、工艺路线列表
   */
  useEffect(() => {
    const load = async () => {
      try {
        setOperationsLoading(true);
        const [opRes, mgRes, matRes, routeRes] = await Promise.all([
          operationApi.list({ limit: 1000, isActive: true }),
          materialGroupApi.list({ limit: 1000 }).catch(() => []),
          materialApi.list({ limit: 2000, isActive: true }).catch(() => []),
          processRouteApi.list({ limit: 500, isActive: true }).catch(() => []),
        ]);
        setOperations(unwrapProcessPagedList(opRes));
        setMaterialGroups(Array.isArray(mgRes) ? mgRes : []);
        const rawMats = Array.isArray(matRes)
          ? matRes
          : ((matRes as MaterialListResponse | undefined)?.items ?? []);
        setMaterials(
          rawMats.map((m: any) => ({
            uuid: m.uuid,
            code: m.mainCode ?? m.main_code ?? m.code ?? '',
            mainCode: m.mainCode ?? m.main_code ?? m.code ?? '',
            name: m.name ?? '',
            specification: m.specification ?? undefined,
            model: m.model ?? undefined,
            images: Array.isArray(m.images) ? m.images : undefined,
          }))
        );
        setRoutes(
          unwrapProcessPagedList(routeRes).map((r: any) => ({
            uuid: r.uuid,
            code: r.code,
            name: r.name,
          }))
        );
      } catch (e) {
        console.error('加载基础数据失败:', e);
      } finally {
        setOperationsLoading(false);
      }
    };
    load();
  }, []);

  /**
   * 处理关闭新建 Modal
   */
  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  /**
   * 批量创建完成后，关闭新建 Modal 并打开编辑（可选）
   */
  const handleBatchCreateSuccess = () => {
    handleCloseCreateModal();
  };

  /**
   * 批量创建中点击某条 SOP 的编辑：打开编辑 Modal 或设计页
   */
  const handleBatchCreateEditSop = async (uuid: string, tab?: 'formConfig') => {
    handleCloseCreateModal();
    if (tab === 'formConfig') {
      navigate(`/apps/master-data/process/sop/designer?uuid=${uuid}&from=edit`);
      return;
    }
    await handleEdit({ uuid } as SOP);
  };

  /**
   * 处理编辑SOP（仅基本信息与适用范围；流程与报工采集在设计页管理）
   */
  const handleEdit = async (record: SOP, _initialTab?: 'basic' | 'scope') => {
    try {
      setIsEdit(true);
      setCurrentSOPUuid(record.uuid);
      setModalVisible(true);

      const detail = await sopApi.get(record.uuid);
      const d = detail as any;
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        operationId: detail.operationId ?? d.operation_id ?? undefined,
        version: detail.version,
        content: detail.content,
        isActive: detail.isActive ?? d.is_active ?? true,
        material_group_uuids: d.material_group_uuids ?? d.materialGroupUuids ?? undefined,
        material_uuids: d.material_uuids ?? d.materialUuids ?? undefined,
      });
      const fieldFormValues = await loadSopFormFieldValues(detail.id);
      formRef.current?.setFieldsValue(fieldFormValues);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.sop.getDetailFailed'));
    }
  };

  /**
   * 处理删除SOP
   */
  const handleDelete = async (record: SOP) => {
    try {
      await sopApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除SOP
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of targetKeys) {
        try {
          await sopApi.delete(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('common.deleteFailed'));
        }
      }

      if (successCount > 0) {
        messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      }
      if (failCount > 0) {
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length > 0 ? '：' + errors.join('; ') : '',
          }),
        );
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await sopApi.get(uuid);
      setSopDetail(detail);
      setCurrentSOPUuid(detail.uuid);
      if (detail.id != null) {
        await loadSopFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setSopDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.sop.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: SOP) => {
    detailRetryUuidRef.current = record.uuid;
    setCurrentSOPUuid(record.uuid);
    setDrawerVisible(true);
    setSopDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSOPUuid(null);
    setSopDetail(null);
    setDetailError(null);
    resetSopDetailFieldValues();
  };

  /**
   * 处理提交表单（创建/更新SOP）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractSopFormValues(values);

      // 仅提交基本信息与适用范围；流程与报工采集在设计页保存
      // 后端字段为 snake_case；表单为 camelCase，须显式映射（尤其 operation_id / is_active）
      const payload: Record<string, unknown> = {
        ...standardValues,
        operation_id: standardValues.operationId ?? standardValues.operation_id ?? null,
        is_active: standardValues.isActive ?? standardValues.is_active ?? true,
        material_group_uuids: standardValues.material_group_uuids ?? standardValues.materialGroupUuids ?? null,
        material_uuids: standardValues.material_uuids ?? standardValues.materialUuids ?? null,
      };
      delete payload.operationId;
      delete payload.isActive;
      delete payload.materialGroupUuids;
      delete payload.materialUuids;

      if (isEdit && currentSOPUuid) {
        await sopApi.update(currentSOPUuid, payload as SOPUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await sopApi.get(currentSOPUuid);
        await saveSopCustomFieldValues(updated.id, customData);
      } else {
        let finalCode = String(standardValues.code ?? '').trim();
        let ruleCode: string | undefined;
        let autoGenerate = false;
        try {
          const pageConfig = await getCodeRulePageConfig(SOP_PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(SOP_PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(SOP_PAGE_CODE);
        }
        const useAutoCode = !finalCode || finalCode === sopPreviewCode;
        if (autoGenerate && ruleCode && useAutoCode) {
          try {
            const codeResponse = await generateCode({
              rule_code: ruleCode,
              check_duplicate: true,
              entity_type: 'sop',
            });
            finalCode = (codeResponse?.code ?? '').trim() || finalCode;
          } catch {
            if (sopPreviewCode) finalCode = sopPreviewCode;
          }
        }
        if (!finalCode) {
          messageApi.error(t('app.master-data.sop.codeRequired'));
          return;
        }
        payload.code = finalCode;

        const created = await sopApi.create(payload as unknown as SOPCreate);
        await saveSopCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
      }

      setModalVisible(false);
      formRef.current?.resetFields();
      resetSopFormFieldValues();
      setSopPreviewCode(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      sopImportTemplate.importHeaderMap,
    );
    if (headerIndexMap['code'] === undefined || headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: `${t('app.master-data.sop.codeLabel')}/${t('app.master-data.sop.nameLabel')}`,
          headers: headers.join(', '),
        }),
      );
      return;
    }
    const items: SOPCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    rows.forEach((row: any[], i: number) => {
      const code = (row[headerIndexMap['code']] ?? '').toString().trim();
      const name = (row[headerIndexMap['name']] ?? '').toString().trim();
      const version =
        headerIndexMap['version'] !== undefined
          ? (row[headerIndexMap['version']] ?? '').toString().trim()
          : undefined;
      if (!code) {
        errors.push({
          row: i + 3,
          message: t('app.master-data.sop.codeRequired'),
        });
        return;
      }
      if (!name) {
        errors.push({
          row: i + 3,
          message: t('app.master-data.sop.nameRequired'),
        });
        return;
      }
      const isActiveRaw =
        headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
      const isActive =
        !isActiveRaw ||
        !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
      const operationCodeRaw =
        headerIndexMap.operationCode !== undefined
          ? String(row[headerIndexMap.operationCode] ?? '').trim()
          : '';
      let operationId: number | undefined;
      if (operationCodeRaw) {
        const op = operations.find(
          (o) => (o.code || '').toUpperCase() === operationCodeRaw.toUpperCase(),
        );
        if (!op?.id) {
          errors.push({
            row: i + 3,
            message: t('app.master-data.sop.operationNotFound', {
              defaultValue: `未找到工序编号：${operationCodeRaw}`,
              code: operationCodeRaw,
            }),
          });
          return;
        }
        operationId = op.id;
      }
      items.push({ code, name, version: version || undefined, isActive, operationId });
    });
    if (errors.length > 0) {
      getAntdModal().warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(e) => (
              <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }
    try {
      const result = await importInChunksViaPerItemCreate({
        items,
        createOne: async (item, _index) => sopApi.create(item),
        title: t('app.master-data.sop.importTitle'),
        chunkSize: 100,
        concurrency: 4,
      });
      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: SOP[]) => {
    try {
      let toExport: SOP[] = [];
      if (type === 'all') {
        toExport = await fetchAllListItems((p) => sopApi.list({ ...p, ...lastListParamsRef.current }));
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid));
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData;
      } else {
        toExport = await fetchAllListItems((p) => sopApi.list({ ...p, ...lastListParamsRef.current }));
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const enabledLabel = t('app.master-data.plants.enabled');
      const disabledLabel = t('app.master-data.plants.disabled');
      const headers = [
        t('app.master-data.sop.codeLabel'),
        t('app.master-data.sop.nameLabel'),
        t('app.master-data.sop.versionLabel'),
        t('app.master-data.sop.status'),
        t('common.createdAt'),
      ];
      const csvRows = [headers.join(',')];
      toExport.forEach((r) => {
        const isActive = r?.isActive ?? (r as any)?.is_active;
        csvRows.push([
          r.code || '',
          r.name || '',
          r.version || '',
          isActive ? enabledLabel : disabledLabel,
          r.createdAt ? formatDateTimeBySiteSetting(r.createdAt) : (r as any).created_at ? formatDateTimeBySiteSetting((r as any).created_at) : '',
        ].map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','));
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `${t('app.master-data.sop.exportFilename', { date: todaySiteDateString() })}.csv`);
      messageApi.success(t('common.exportSuccess', { count: toExport.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理关闭 Modal（编辑/单个新建）
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
    resetSopFormFieldValues();
    setSopPreviewCode(null);
  };

  /**
   * 选择单个新建：关闭新建 Modal，打开编辑 Modal 用于创建
   */
  const handleSelectSingleCreate = () => {
    setCreateModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
    resetSopFormFieldValues();
    setModalVisible(true);
  };

  useNewShortcut(handleSelectSingleCreate);

  /**
   * 获取工序名称
   */
  const getOperationName = (operationId?: number): string => {
    if (!operationId) return '-';
    const operation = operations.find(o => o.id === operationId);
    return operation ? `${operation.code} - ${operation.name}` : t('app.master-data.sop.operationIdFallback', { id: operationId });
  };

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    fetchAllListItems((params) => sopApi.list(params))
      .then((rows) => {
        if (cancelled) return;
        setExistingSopsForCheck(
          rows.map((row: SOP & { operation_id?: number }) => ({
            ...row,
            operationId: row.operationId ?? row.operation_id,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setExistingSopsForCheck([]);
      });
    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  useEffect(() => {
    if (!modalVisible || isEdit) return;
    let cancelled = false;

    (async () => {
      let ruleCode: string | undefined;
      let autoGenerate = false;
      try {
        const pageConfig = await getCodeRulePageConfig(SOP_PAGE_CODE);
        ruleCode = pageConfig?.ruleCode;
        autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
      } catch {
        ruleCode = getPageRuleCode(SOP_PAGE_CODE);
        autoGenerate = isAutoGenerateEnabled(SOP_PAGE_CODE);
      }

      if (!autoGenerate || !ruleCode) {
        if (!cancelled) setSopPreviewCode(null);
        return;
      }

      try {
        const res = await testGenerateCode({
          rule_code: ruleCode,
          check_duplicate: true,
          entity_type: 'sop',
        });
        if (cancelled) return;
        const previewCodeValue = (res?.code ?? '').trim();
        setSopPreviewCode(previewCodeValue || null);
        if (previewCodeValue) {
          formRef.current?.setFieldsValue({ code: previewCodeValue });
        } else {
          messageApi.info(t('app.master-data.codeRulePreviewHint'));
        }
      } catch {
        if (!cancelled) {
          setSopPreviewCode(null);
          messageApi.info(t('app.master-data.codeRuleAutoFailed'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modalVisible, isEdit, messageApi, t]);

  const sopCodeAutoGenerateEnabled = isAutoGenerateEnabled(SOP_PAGE_CODE);

  const warnSopBindingDuplicate = (
    operationId?: number | null,
    materialUuids?: string[] | null,
    materialGroupUuids?: string[] | null,
  ) => {
    if (!operationId) return;
    const mats = materialUuids ?? formRef.current?.getFieldValue('material_uuids') ?? [];
    const grps = materialGroupUuids ?? formRef.current?.getFieldValue('material_group_uuids') ?? [];
    if ((!mats || mats.length === 0) && (!grps || grps.length === 0)) return;

    const conflicts = findSopBindingConflicts(existingSopsForCheck, {
      operationId,
      materialUuids: mats,
      materialGroupUuids: grps,
      excludeUuid: isEdit ? currentSOPUuid : undefined,
    });
    if (conflicts.length === 0) return;

    const labels = formatSopBindingConflictLabels(conflicts, {
      getMaterialLabel: (uuid) => {
        const material = materials.find((item) => item.uuid === uuid);
        if (!material) return uuid;
        const code = (material as { mainCode?: string; code?: string }).mainCode
          ?? (material as { code?: string }).code
          ?? '';
        return `${code} - ${(material as { name?: string }).name ?? code}`;
      },
      getMaterialGroupLabel: (uuid) => {
        const group = materialGroups.find((item) => item.uuid === uuid);
        return group ? `${group.code} - ${group.name}` : uuid;
      },
      getOperationLabel: (id) => getOperationName(id),
    });

    messageApi.warning(t('app.master-data.sop.bindingDuplicateWarning', { details: labels.join('；') }));
  };

  const handleBindingScopeChange = (
    nextMaterialUuids?: string[],
    nextMaterialGroupUuids?: string[],
  ) => {
    const materialUuids = nextMaterialUuids ?? formRef.current?.getFieldValue('material_uuids') ?? [];
    const materialGroupUuids = nextMaterialGroupUuids ?? formRef.current?.getFieldValue('material_group_uuids') ?? [];
    if (
      !isEdit
      && materialUuids.length === 0
      && materialGroupUuids.length === 0
    ) {
      formRef.current?.setFieldValue('operationId', undefined);
      return;
    }

    const operationId = formRef.current?.getFieldValue('operationId');
    if (!operationId) return;
    warnSopBindingDuplicate(operationId, materialUuids, materialGroupUuids);
  };

  const handleOperationChange = (operationId?: number | null) => {
    warnSopBindingDuplicate(operationId);
  };

  const bomLoadModeLabel = (mode?: string | null) => {
    const m = mode || 'by_material';
    if (m === 'by_material_group') return t('app.master-data.sop.bomLoadByMaterialGroup');
    if (m === 'specific_bom') return t('app.master-data.sop.bomLoadSpecific');
    return t('app.master-data.sop.bomLoadByMaterial');
  };

  const sopDetailBasicColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      { title: t('app.master-data.sop.codeLabel'), dataIndex: 'code' },
      { title: t('app.master-data.sop.nameLabel'), dataIndex: 'name' },
      {
        title: t('app.master-data.sop.operationLabel'),
        dataIndex: 'operationId',
        render: (_: unknown, record: SOP) =>
          getOperationName(record?.operationId ?? (record as any)?.operation_id),
      },
      {
        title: t('app.master-data.sop.versionLabel'),
        dataIndex: 'version',
        render: (_: unknown, record: SOP) => {
          const v = (record as any)?.version;
          return v != null && String(v).trim() !== '' ? String(v) : '-';
        },
      },
      {
        title: t('app.master-data.sop.remarkLabel'),
        dataIndex: 'content',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const c = (record as any)?.content;
          const text = c != null && String(c).trim() !== '' ? String(c) : '-';
          return (
            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }} ellipsis={{ rows: 8, expandable: true }}>
              {text}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('field.route.isActive'),
        dataIndex: 'isActive',
        render: (_: unknown, record: SOP) =>
          renderMasterActiveTag(
            t,
            record?.isActive ?? (record as any)?.is_active,
            'app.master-data.plants.enabled',
            'app.master-data.plants.disabled',
          ),
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t, operations]
  );

  const sopDetailBindingColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      {
        title: t('app.master-data.sop.bindMaterialGroups'),
        dataIndex: 'materialGroupUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] =
            (record as any)?.materialGroupUuids ?? (record as any)?.material_group_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const g = materialGroups.find((x) => x.uuid === u);
                return <Tag key={u}>{g ? `${g.code} - ${g.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: t('app.master-data.sop.bindMaterials'),
        dataIndex: 'materialUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] = (record as any)?.materialUuids ?? (record as any)?.material_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const m = materials.find((x) => x.uuid === u);
                return <Tag key={u}>{m ? `${m.code} - ${m.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: t('app.master-data.sop.loadRoutes'),
        dataIndex: 'routeUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] = (record as any)?.routeUuids ?? (record as any)?.route_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const r = routes.find((x) => x.uuid === u);
                return <Tag key={u}>{r ? `${r.code} - ${r.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: t('app.master-data.sop.bomLoadMode'),
        dataIndex: 'bomLoadMode',
        render: (_: unknown, record: SOP) =>
          bomLoadModeLabel((record as any)?.bomLoadMode ?? (record as any)?.bom_load_mode),
      },
      {
        title: t('app.master-data.sop.specificBomUuid'),
        dataIndex: 'specificBomUuid',
        render: (_: unknown, record: SOP) => {
          const u = (record as any)?.specificBomUuid ?? (record as any)?.specific_bom_uuid;
          return u ? (
            <Typography.Text copyable={{ text: String(u) }} style={{ wordBreak: 'break-all' }}>
              {String(u)}
            </Typography.Text>
          ) : (
            '-'
          );
        },
      },
    ],
    [materialGroups, materials, routes, t]
  );

  const sopDetailDigitalColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      {
        title: t('app.master-data.sop.flowConfigLabel'),
        dataIndex: 'flowConfig',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const fc = (record as any)?.flowConfig ?? (record as any)?.flow_config;
          if (fc == null || (typeof fc === 'object' && Object.keys(fc).length === 0)) return '-';
          const nodes = (fc as any)?.nodes;
          const n = Array.isArray(nodes) ? nodes.length : 0;
          return n > 0 ? t('app.master-data.sop.configuredWithNodes', { count: n }) : t('app.master-data.sop.configured');
        },
      },
      {
        title: t('app.master-data.sop.formConfigLabel'),
        dataIndex: 'formConfig',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const fc = (record as any)?.formConfig ?? (record as any)?.form_config;
          if (fc == null || (typeof fc === 'object' && Object.keys(fc).length === 0)) return '-';
          return t('app.master-data.sop.configured');
        },
      },
      {
        title: t('app.master-data.sop.attachmentsLabel'),
        dataIndex: 'attachments',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const att = (record as any)?.attachments;
          if (att == null) return '-';
          if (Array.isArray(att)) return att.length === 0 ? '-' : t('app.master-data.sop.attachmentCount', { count: att.length });
          if (typeof att === 'object') {
            const k = Object.keys(att).length;
            return k === 0 ? '-' : t('app.master-data.sop.attachmentJsonCount', { count: k });
          }
          return String(att);
        },
      },
    ],
    [t]
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<SOP>[] = useMemo(() => {
    const customFieldColumns = generateSopCustomFieldColumns();
    return [
    ...masterCrudCodeNameSearchColumns({
      code: t('app.master-data.sop.codeLabel'),
      name: t('app.master-data.sop.nameLabel'),
    }),
    {
      title: t('app.master-data.sop.codeLabel'),
      dataIndex: 'code',
      // 与系统左固定单号列一致：168 + ellipsis，避免长编号溢出叠到名称列
      copyable: true,
      width: 168,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.sop.nameLabel'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
      hideInSearch: true,
    },
    {
      key: 'sop-operation-filter',
      title: t('app.master-data.sop.operationLabel'),
      dataIndex: 'operationId',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: t('app.master-data.sop.filterOperationPlaceholder'),
        options: operations.map((o) => ({ label: `${o.code} - ${o.name}`, value: o.id })),
        showSearch: true,
      },
    },
    {
      title: t('app.master-data.sop.operationLabel'),
      dataIndex: 'operationId',
      width: 200,
      hideInSearch: true,
      sorter: true,
      render: (_, record) =>
        getOperationName(
          record.operationId ?? (record as { operation_id?: number }).operation_id,
        ),
    },
    {
      title: t('app.master-data.sop.bindingLoad'),
      dataIndex: '_binding',
      width: 140,
      hideInSearch: true,
      render: (_, record: any) => {
        const ma = record.material_uuids ?? record.materialUuids ?? [];
        const mg = record.material_group_uuids ?? record.materialGroupUuids ?? [];
        const rt = record.route_uuids ?? record.routeUuids ?? [];
        const parts: string[] = [];
        if (ma?.length) parts.push(t('app.master-data.sop.bindingMaterialCount', { count: ma.length }));
        if (mg?.length) parts.push(t('app.master-data.sop.bindingMaterialGroupCount', { count: mg.length }));
        if (rt?.length) parts.push(t('app.master-data.sop.bindingRouteCount', { count: rt.length }));
        return parts.length ? parts.join(' ') : '-';
      },
    },
    {
      title: t('app.master-data.sop.filterByMaterial'),
      dataIndex: 'material_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: t('app.master-data.sop.filterMaterialPlaceholder'),
        options: materials.map((m: any) => ({
          label: formatMaterialSelectLabel(m),
          value: m.uuid,
        })),
        showSearch: true,
        listItemHeight: MATERIAL_SELECT_OPTION_ITEM_HEIGHT,
        popupMatchSelectWidth: 480,
        optionRender: (option: { value?: string | number; label?: React.ReactNode }) => {
          const material = materials.find((m: any) => m.uuid === option.value);
          return (
            <MaterialSelectOptionContent
              material={material as Record<string, unknown> | undefined}
              fallbackLabel={option.label}
            />
          );
        },
      },
    },
    {
      title: t('app.master-data.sop.filterByMaterialGroup'),
      dataIndex: 'material_group_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: t('app.master-data.sop.filterMaterialGroupPlaceholder'),
        options: materialGroups.map((g: any) => ({ label: `${g.code ?? ''} - ${g.name ?? ''}`, value: g.uuid })),
        showSearch: true,
      },
    },
    {
      title: t('app.master-data.sop.filterByRoute'),
      dataIndex: 'route_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: t('app.master-data.sop.filterRoutePlaceholder'),
        options: routes.map((r: any) => ({ label: `${r.code ?? ''} - ${r.name ?? ''}`, value: r.uuid })),
        showSearch: true,
      },
    },
    {
      title: t('app.master-data.sop.versionLabel'),
      dataIndex: 'version',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.sop.remarkLabel'),
      dataIndex: 'content',
      ellipsis: true,
      width: 200,
      hideInSearch: true,
      render: (_, record) => (record.content ? `${record.content.substring(0, 50)}...` : '-'),
    },
    {
      title: t('app.master-data.sop.status'),
      dataIndex: 'isActive',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: sopActiveValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('app.master-data.sop.status'),
      dataIndex: 'isActive',
      width: 100,
      hideInSearch: true,
      valueEnum: sopActiveValueEnum,
      render: (_, record) => {
        const isActive = record?.isActive ?? (record as any)?.is_active;
        return (
          <Tag color={isActive ? 'success' : 'default'} variant="solid">
            {isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
          </Tag>
        );
      },
      sorter: true,
    },
    ...customFieldColumns,
    ...masterCrudCreatedUpdatedColumns<SOP>(t),
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => {
        const goDesigner = () => {
          navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}&from=edit`);
        };
        return (
          <Space size={ROW_ACTIONS_INLINE_GAP} wrap={false} style={{ whiteSpace: 'nowrap' }}>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
              {t('field.customField.view')}
            </Button>
            <Button
              key="design"
              type="link"
              size="small"
              icon={<HighlightOutlined />}
              {...rowActionKind('update')}
              onClick={goDesigner}
              title={t('app.master-data.sop.designFlowTitle')}
            >
              {t('app.master-data.sop.designBtn')}
            </Button>
            <Button
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              {...rowActionKind('update')}
              onClick={() => handleEdit(record)}
            >
              {t('field.customField.edit')}
            </Button>
            <Popconfirm
              key="delete"
              {...rowActionKind('delete')}
              title={t('app.master-data.sop.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
                {t('field.customField.delete')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];
  }, [sopListCustomFields, generateSopCustomFieldColumns, operations, materials, materialGroups, routes, navigate, getOperationName, t, sopActiveValueEnum]);

  return (
    <ListPageTemplate>
      <UniTable<SOP>
        columnPersistenceId="apps.master-data.pages.process.sop.content-before-active-v4"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const listParams = resolveSopListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const apiParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            isActive: listParams.isActive as boolean | undefined,
            operationId: listParams.operationId as number | undefined,
            material_uuid: listParams.material_uuid as string | undefined,
            material_group_uuid: listParams.material_group_uuid as string | undefined,
            route_uuid: listParams.route_uuid as string | undefined,
            keyword: listParams.keyword as string | undefined,
            code: listParams.code as string | undefined,
            name: listParams.name as string | undefined,
            created_start_date: listParams.created_start_date as string | undefined,
            created_end_date: listParams.created_end_date as string | undefined,
            updated_start_date: listParams.updated_start_date as string | undefined,
            updated_end_date: listParams.updated_end_date as string | undefined,
            sortBy: listParams.sortBy as string | undefined,
            sortOrder: listParams.sortOrder as 'asc' | 'desc' | undefined,
          };

          try {
            const result = await sopApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            // 列表接口为 snake_case；表格/类型用 camelCase
            const normalized = listData.map((row: SOP & { operation_id?: number; is_active?: boolean }) => ({
              ...row,
              operationId: row.operationId ?? row.operation_id,
              isActive: row.isActive ?? row.is_active ?? true,
            }));
            const enrichedData = meta?.purpose === 'prefetch'
              ? normalized
              : await enrichSopRecordsWithCustomFields(normalized);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取SOP列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.sop.listFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.sop.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleSelectSingleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="sop-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        toolBarActionsAfterBatch={[
          <Button {...rowActionKind('create')} key="batch-create" type="default" onClick={() => setCreateModalVisible(true)}>
            {t('app.master-data.sop.batchCreateByRoute')}
          </Button>,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={sopImportTemplate.importHeaders}
        importExampleRow={sopImportTemplate.importExampleRow}
        importColumnOptions={sopImportTemplate.importColumnOptions}
        importFieldMap={sopImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
      />

      <ProcessMasterDetailDrawer
        title={t('app.master-data.sop.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={sopDetail}
        detailColumns={sopDetailBasicColumns}
        customFields={sopListCustomFields}
        customFieldValues={sopDetailCustomFieldValues}
        supplementaryTitle={t('app.master-data.sop.detailSectionBinding')}
        supplementary={
          sopDetail ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(sopDetailBindingColumns, sopDetail)}
            />
          ) : undefined
        }
        linesTitle={t('app.master-data.sop.detailSectionDigital')}
        lines={
          sopDetail ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(sopDetailDigitalColumns, sopDetail)}
            />
          ) : undefined
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(sopDetail), () => {
          if (!sopDetail) return;
          void handleEdit(sopDetail);
        })}
      />

      {/* 新建 SOP Modal：按工艺路线批量创建 */}
      <Modal
        className="modal-no-limit-height"
        title={t('app.master-data.sop.batchCreateModalTitle')}
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={900}
        destroyOnHidden
      >
        <SOPBatchCreateSteps
          onSuccess={handleBatchCreateSuccess}
          onCancel={handleCloseCreateModal}
          onEditSop={handleBatchCreateEditSop}
        />
      </Modal>

      <FormModalTemplate
        title={isEdit ? t('app.master-data.sop.editTitle') : t('app.master-data.sop.createTitle')}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={640}
        grid={false}
        formRef={formRef}
        initialValues={{ isActive: true }}
      >
        <div style={{ padding: '8px 0', minWidth: 0 }}>
          <Row gutter={[16, 16]}>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="code"
                label={t('app.master-data.sop.codeLabel')}
                placeholder={
                  !isEdit && sopCodeAutoGenerateEnabled
                    ? t('app.master-data.sop.codeAutoGenerated')
                    : t('app.master-data.sop.codeRequired')
                }
                rules={[
                  { required: true, message: t('app.master-data.sop.codeRequired') },
                  { max: 100, message: t('app.master-data.sop.codeMaxLength') },
                ]}
                fieldProps={{ style: { textTransform: 'uppercase' } }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="name"
                label={t('app.master-data.sop.nameLabel')}
                placeholder={t('app.master-data.sop.nameRequired')}
                rules={[
                  { required: true, message: t('app.master-data.sop.nameRequired') },
                  { max: 200, message: t('app.master-data.sop.nameMaxLength') },
                ]}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <SafeProFormSelect
                name="material_group_uuids"
                label={t('app.master-data.sop.bindMaterialGroups')}
                placeholder={t('app.master-data.sop.bindMaterialGroupPlaceholder')}
                mode="multiple"
                options={materialGroups.map(g => ({ label: `${g.code} - ${g.name}`, value: g.uuid }))}
                fieldProps={{
                  showSearch: true,
                  filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()),
                  onChange: (value: string[]) => handleBindingScopeChange(undefined, value),
                }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <SafeProFormSelect
                name="material_uuids"
                label={t('app.master-data.sop.bindMaterials')}
                placeholder={t('app.master-data.sop.bindMaterialPlaceholder')}
                mode="multiple"
                options={materials.map((m) => ({
                  label: formatMaterialSelectLabel(m as Record<string, unknown>),
                  value: m.uuid,
                }))}
                fieldProps={{
                  showSearch: true,
                  filterOption: (i: string, o: any) =>
                    String(o?.label ?? '')
                      .toLowerCase()
                      .includes((i || '').toLowerCase()),
                  listItemHeight: MATERIAL_SELECT_OPTION_ITEM_HEIGHT,
                  popupMatchSelectWidth: 480,
                  optionRender: (option: { value?: string | number; label?: React.ReactNode }) => {
                    const material = materials.find((m: any) => m.uuid === option.value);
                    return (
                      <MaterialSelectOptionContent
                        material={material as Record<string, unknown> | undefined}
                        fallbackLabel={option.label}
                      />
                    );
                  },
                  onChange: (value: string[]) => handleBindingScopeChange(value, undefined),
                }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormDependency name={['material_uuids', 'material_group_uuids']}>
                {({ material_uuids, material_group_uuids }) => {
                  const scopeReady =
                    (Array.isArray(material_uuids) && material_uuids.length > 0)
                    || (Array.isArray(material_group_uuids) && material_group_uuids.length > 0);
                  const boundOperationIds = scopeReady
                    ? getBoundOperationIds(existingSopsForCheck, {
                        materialUuids: material_uuids,
                        materialGroupUuids: material_group_uuids,
                        excludeUuid: isEdit ? currentSOPUuid : undefined,
                      })
                    : new Set<number>();
                  return (
                    <SafeProFormSelect
                      name="operationId"
                      label={t('app.master-data.sop.operationLabel')}
                      placeholder={
                        !isEdit && !scopeReady
                          ? t('app.master-data.sop.selectMaterialOrGroupFirst')
                          : t('app.master-data.sop.operationPlaceholder')
                      }
                      options={operations.map(o => ({ label: `${o.code} - ${o.name}`, value: o.id }))}
                      fieldProps={{
                        loading: operationsLoading,
                        showSearch: true,
                        allowClear: true,
                        disabled: !isEdit && !scopeReady,
                        optionFilterProp: 'label',
                        filterOption: (input: string, option: { label?: React.ReactNode }) =>
                          (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase()),
                        optionRender: (option) => {
                          const operationId = option.value as number;
                          const isBound = boundOperationIds.has(operationId);
                          return (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                width: '100%',
                              }}
                            >
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {option.label}
                              </span>
                              {isBound ? (
                                <Tag color="orange" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                                  {t('app.master-data.sop.operationBoundBadge')}
                                </Tag>
                              ) : null}
                            </div>
                          );
                        },
                        onChange: (value: number | null) => handleOperationChange(value),
                      }}
                    />
                  );
                }}
              </ProFormDependency>
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="version"
                label={t('app.master-data.sop.versionLabel')}
                placeholder={t('app.master-data.sop.versionPlaceholder')}
                rules={[{ max: 20, message: t('app.master-data.sop.versionMaxLength') }]}
              />
            </Col>
            <CustomFieldsFormSection
              customFields={sopFormCustomFields}
              customFieldValues={sopFormCustomFieldValues}
              gridColumns={2}
              embedInParentRow
            />
          </Row>
          <ProFormTextArea
            name="content"
            label={t('app.master-data.sop.remarkLabel')}
            placeholder={t('app.master-data.sop.remarkPlaceholder')}
            colProps={{ span: 24 }}
            fieldProps={{ rows: 3, maxLength: 5000 }}
            style={{ marginTop: 16 }}
          />
          <div style={{ marginTop: 16 }}>
            <ProFormSwitch name="isActive" label={t('app.master-data.sop.isActiveLabel')} />
          </div>
        </div>
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SOPPage;
