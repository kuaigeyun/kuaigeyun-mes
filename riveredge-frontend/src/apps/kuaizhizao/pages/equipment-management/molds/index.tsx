/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Modal, Row, Col, Typography } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { QrcodeOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { moldApi } from '../../../services/equipment';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import {
  IMPORT_YES_NO_OPTIONS,
  pickImportExampleValue,
} from '../../../../../utils/loadImportDictionaryValues';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import dayjs from 'dayjs';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  CustomFieldsFormSection,
} from '../../../../../components/custom-fields';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  formDateFormItemProps,
  formDateRangeFormItemProps,
  parseSpreadsheetDateToApiString,
  toApiDateString,
} from '../../../../../utils/formDate';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveLedgerListParams,
} from '../../../utils/equipmentListCore';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  renderEquipmentMasterRowActions,
  renderIsActiveTag,
} from '../shared/equipmentMasterDataDetail';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { buildMoldDetailPath } from './moldPaths';
import { todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
const MOLD_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_molds';

interface Mold {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  status?: string;
  is_active?: boolean;
  description?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  total_usage_count?: number;
  cavity_count?: number;
  design_lifetime?: number;
  maintenance_interval?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  created_at?: string;
  updated_at?: string;
}

const MoldsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:equipment-management-molds');
  const moldDictOptions = useImportDictionaryOptions(['MOLD_TYPE', 'MOLD_STATUS']);
  const parseMoldDict = moldDictOptions.parseDict;

  const moldImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.mold.import.code', aliases: ['模具编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.mold.import.name', aliases: ['模具名称', '名称'] },
          {
            field: 'type',
            labelKey: 'app.kuaizhizao.mold.import.type',
            aliases: ['模具类型', '类型'],
            options: moldDictOptions.MOLD_TYPE,
          },
          { field: 'category', labelKey: 'app.kuaizhizao.mold.import.category', aliases: ['模具分类', '分类'] },
          { field: 'brand', labelKey: 'app.kuaizhizao.mold.import.brand', aliases: ['品牌'] },
          { field: 'model', labelKey: 'app.kuaizhizao.mold.import.model', aliases: ['型号'] },
          { field: 'serial_number', labelKey: 'app.kuaizhizao.mold.import.serialNumber', aliases: ['序列号'] },
          { field: 'manufacturer', labelKey: 'app.kuaizhizao.mold.import.manufacturer', aliases: ['制造商'] },
          { field: 'supplier', labelKey: 'app.kuaizhizao.mold.import.supplier', aliases: ['供应商'] },
          { field: 'purchase_date', labelKey: 'app.kuaizhizao.mold.import.purchaseDate', aliases: ['采购日期'] },
          { field: 'installation_date', labelKey: 'app.kuaizhizao.mold.import.installationDate', aliases: ['安装日期'] },
          { field: 'warranty_period', labelKey: 'app.kuaizhizao.mold.import.warrantyPeriod', aliases: ['保修期（月）', '保修期'] },
          {
            field: 'status',
            required: true,
            labelKey: 'app.kuaizhizao.mold.import.status',
            aliases: ['模具状态', '状态'],
            options: moldDictOptions.MOLD_STATUS,
          },
          { field: 'cavity_count', labelKey: 'app.kuaizhizao.mold.import.cavityCount', aliases: ['腔数（模数）', '腔数'] },
          { field: 'design_lifetime', labelKey: 'app.kuaizhizao.mold.import.designLifetime', aliases: ['设计寿命（次）', '设计寿命'] },
          { field: 'description', labelKey: 'common.remark', aliases: ['备注', '描述'] },
          {
            field: 'is_active',
            labelKey: 'app.kuaizhizao.mold.import.isActive',
            aliases: ['是否启用', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.kuaizhizao.mold.importExample.code'),
          t('app.kuaizhizao.mold.importExample.name'),
          pickImportExampleValue(moldDictOptions.MOLD_TYPE, t('app.kuaizhizao.mold.importExample.type')),
          t('app.kuaizhizao.mold.importExample.category'),
          t('app.kuaizhizao.mold.importExample.brand'),
          t('app.kuaizhizao.mold.importExample.model'),
          t('app.kuaizhizao.mold.importExample.serialNumber'),
          t('app.kuaizhizao.mold.importExample.manufacturer'),
          t('app.kuaizhizao.mold.importExample.supplier'),
          t('app.kuaizhizao.mold.importExample.purchaseDate'),
          t('app.kuaizhizao.mold.importExample.installationDate'),
          t('app.kuaizhizao.mold.importExample.warrantyPeriod'),
          pickImportExampleValue(moldDictOptions.MOLD_STATUS, t('app.kuaizhizao.mold.importExample.status')),
          t('app.kuaizhizao.mold.importExample.cavityCount'),
          t('app.kuaizhizao.mold.importExample.designLifetime'),
          '',
          pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('common.yes')),
        ],
      ),
    [t, i18n.language, moldDictOptions],
  );
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  const {
    customFields: moldFormCustomFields,
    customFieldValues: moldFormCustomFieldValues,
    loadFieldValues: loadMoldFormFieldValues,
    extractFormValues: extractMoldFormValues,
    saveCustomFieldValues: saveMoldCustomFieldValues,
    resetFieldValues: resetMoldFormFieldValues,
  } = useCustomFields({ tableName: MOLD_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: moldListCustomFields,
    generateCustomFieldColumns: generateMoldCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichMoldRecordsWithCustomFields,
  } = useCustomFieldsForList<Mold>({ tableName: MOLD_CUSTOM_FIELD_TABLE });
  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMold(null);
    setFormInitialValues(undefined);
    resetMoldFormFieldValues();
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.mold.create')),
    [t],
  );

  const handleBatchPrintMoldCards = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.mold.selectMoldForCard'));
      return;
    }
    const uuids = selectedRowKeys.map((key) => String(key)).filter(Boolean);
    if (uuids.length === 0) {
      messageApi.error(t('app.kuaizhizao.mold.getSelectedFailed'));
      return;
    }
    openPrint({
      documentType: 'mold_card',
      documentId: uuids.length,
      printApiPath: '/apps/kuaizhizao/molds/print-cards',
      printApiParams: { uuids },
      pdfDownloadFilename: 'mold-cards.pdf',
    });
  };

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.mold.uuidNotFound'));
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setIsEdit(true);
      setCurrentMold(detail);
      const fieldFormValues =
        detail.id != null ? await loadMoldFormFieldValues(detail.id) : {};
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
        installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
        warranty_period: detail.warranty_period,
        status: detail.status,
        is_active: detail.is_active,
        cavity_count: detail.cavity_count,
        design_lifetime: detail.design_lifetime,
        description: detail.description,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        ...fieldFormValues,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.mold.getDetailFailed'));
    }
  };

  useEffect(() => {
    const openEditUuid = (location.state as { openEditUuid?: string } | null)?.openEditUuid;
    if (!openEditUuid) return;
    navigate(location.pathname, { replace: true, state: null });
    void handleEdit({ uuid: openEditUuid } as Mold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname]);

  const handleDetail = (record: Mold) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaizhizao.mold.uuidNotFound'));
      return;
    }
    navigate(buildMoldDetailPath(record.uuid));
  };

  /**
   * 处理批量删除模具（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
          for (const uuid of keys) {
            await moldApi.delete(String(uuid));
          }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractMoldFormValues(values);
      const submitData = {
        ...standardValues,
        purchase_date: toApiDateString(standardValues.purchase_date) ?? null,
        installation_date: toApiDateString(standardValues.installation_date) ?? null,
        cavity_count: standardValues.cavity_count ?? null,
        design_lifetime: standardValues.design_lifetime ?? null,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
      };

      const editedUuid = isEdit ? currentMold?.uuid : undefined;
      if (isEdit && editedUuid) {
        await moldApi.update(editedUuid, submitData);
        messageApi.success(t('app.kuaizhizao.mold.updateSuccess'));
        const updated = await moldApi.get(editedUuid);
        if (updated?.id != null) {
          await saveMoldCustomFieldValues(updated.id, customData);
        }
      } else {
        const created = await moldApi.create(submitData);
        if (created?.id != null) {
          await saveMoldCustomFieldValues(created.id, customData);
        }
        messageApi.success(t('app.kuaizhizao.mold.createSuccess'));
      }
      setModalVisible(false);
      setCurrentMold(null);
      formRef.current?.resetFields();
      resetMoldFormFieldValues();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const moldStatusValueEnum = useMemo(
    () => ({
      正常: { text: t('app.kuaizhizao.mold.statusNormal') },
      使用中: { text: t('app.kuaizhizao.mold.statusInUse') },
      维护中: { text: t('app.kuaizhizao.mold.statusMaintaining') },
      停用: { text: t('app.kuaizhizao.mold.statusDisabled') },
      报废: { text: t('app.kuaizhizao.mold.statusScrapped') },
    }),
    [t],
  );

  const columns: ProColumns<Mold>[] = useMemo(() => {
    const customFieldColumns = generateMoldCustomFieldColumns();
    return alignProColumns<Mold>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
      dataIndex: 'is_active',
      valueType: 'select',
      valueEnum: activeStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: moldStatusValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
      hideInTable: true,
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
      hideInTable: true,
      search: { order: 23 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colNameCode'),
      dataIndex: 'code',
      minWidth: 200,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: false,
      fixed: 'left',
      sorter: true,
      search: { order: 30 } as ProColumns['search'],
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.name ?? '') || '-'}
          secondary={String(r.code ?? '') || '-'}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.type != null && r.type !== '' ? String(r.type) : '-'),
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.category != null && r.category !== '' ? String(r.category) : '-'),
    },
    {
      title: t('app.kuaizhizao.mold.colBrand'),
      dataIndex: 'brand',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => (r.brand != null && r.brand !== '' ? String(r.brand) : '-'),
    },
    {
      title: t('app.kuaizhizao.mold.colModel'),
      dataIndex: 'model',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => (r.model != null && r.model !== '' ? String(r.model) : '-'),
    },
    {
      title: t('app.kuaizhizao.mold.colSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) =>
        r.serial_number != null && r.serial_number !== '' ? String(r.serial_number) : '-',
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
      dataIndex: 'is_active',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => renderIsActiveTag(t, r.is_active),
    },
    {
      title: t('app.kuaizhizao.mold.colTotalUsageCount'),
      dataIndex: 'total_usage_count',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.total_usage_count != null ? String(r.total_usage_count) : '-'),
    },
    {
      title: t('app.kuaizhizao.mold.colLifeProgress'),
      key: 'life_progress',
      dataIndex: 'design_lifetime',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_: unknown, record: Mold) => {
        const total = record.total_usage_count ?? 0;
        const lifetime = record.design_lifetime;
        if (!lifetime || lifetime <= 0) return '-';
        const pct = Math.round((total / lifetime) * 100);
        if (pct >= 100) return <MarkerTag color="error">{pct}%</MarkerTag>;
        if (pct >= 90) return <MarkerTag color="warning">{pct}%</MarkerTag>;
        return `${pct}%`;
      },
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    ...customFieldColumns,
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_text, record) =>
        renderEquipmentMasterRowActions({
          record,
          t,
          canRead: perms.canRead,
          canUpdate: perms.canUpdate,
          canDelete: perms.canDelete,
          onDetail: (row) => {
            void handleDetail(row);
          },
          onEdit: (row) => {
            void handleEdit(row);
          },
          onDelete: (row) => {
            if (row.uuid != null) {
              void handleDelete([row.uuid]);
            }
          },
        }),
    },
  ], SALES_DOC_LIST_FIELD_RANK);
  }, [moldListCustomFields, generateMoldCustomFieldColumns, t, activeStatusValueEnum, moldStatusValueEnum, perms, handleDetail]);

  const moldCardToolbar = useMemo(
    () =>
      perms.canPrint ? (
        <Button key="mold-card-print" icon={<QrcodeOutlined />} onClick={handleBatchPrintMoldCards}>
          {t('app.kuaizhizao.mold.printMoldCards')}
        </Button>
      ) : null,
    [t, selectedRowKeys, perms.canPrint],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Mold>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.moldsLedger')}
          headerTitle={t('app.kuaizhizao.mold.title')}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.molds-width-v2"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            try {
              const listParams = resolveLedgerListParams(searchFormValues, sort);
              const response = await moldApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              const enriched = meta?.purpose === 'prefetch'
                ? data as Mold[]
                : await enrichMoldRecordsWithCustomFields(data as Mold[]);
              return {
                data: enriched,
                success: true,
                total,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.mold.getListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          deleteConfirmTitle={t('app.kuaizhizao.mold.confirmBatchDeleteTitle')}
          deleteConfirmDescription={(count) => t('app.kuaizhizao.mold.confirmBatchDeleteContent', { count: count })}
          
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolbar={{ actions: [moldCardToolbar] }}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.kuaizhizao.mold.importEmpty'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              moldImportTemplate.importHeaderMap,
            );
            if (headerIndexMap.name === undefined) {
              messageApi.error(t('app.kuaizhizao.mold.importHeaderMissingName'));
              return;
            }
            const cellAt = (row: any[], field: string): string => {
              const idx = headerIndexMap[field];
              if (idx === undefined) return '';
              return String(row[idx] ?? '').trim();
            };
            const parseDate = (raw: string): string | undefined => parseSpreadsheetDateToApiString(raw);
            const parseIntField = (raw: string): number | undefined => {
              if (!raw) return undefined;
              const n = Number(raw);
              return Number.isFinite(n) ? n : undefined;
            };
            const parseActive = (raw: string): boolean | undefined => {
              if (!raw) return undefined;
              const v = raw.toLowerCase();
              if (['1', 'true', 'yes', 'y', '是', '启用', 'active'].includes(v)) return true;
              if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
              return undefined;
            };
            const items: any[] = [];
            const importRows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            for (const row of importRows) {
              const name = cellAt(row, 'name');
              if (!name) continue;
              const isActive = parseActive(cellAt(row, 'is_active'));
              items.push({
                code: cellAt(row, 'code') || undefined,
                name,
                type: parseMoldDict('MOLD_TYPE', cellAt(row, 'type')) || undefined,
                category: cellAt(row, 'category') || undefined,
                brand: cellAt(row, 'brand') || undefined,
                model: cellAt(row, 'model') || undefined,
                serial_number: cellAt(row, 'serial_number') || undefined,
                manufacturer: cellAt(row, 'manufacturer') || undefined,
                supplier: cellAt(row, 'supplier') || undefined,
                purchase_date: parseDate(cellAt(row, 'purchase_date')),
                installation_date: parseDate(cellAt(row, 'installation_date')),
                warranty_period: parseIntField(cellAt(row, 'warranty_period')),
                status: parseMoldDict('MOLD_STATUS', cellAt(row, 'status')) || '待用',
                cavity_count: parseIntField(cellAt(row, 'cavity_count')),
                design_lifetime: parseIntField(cellAt(row, 'design_lifetime')),
                description: cellAt(row, 'description') || undefined,
                ...(isActive === undefined ? {} : { is_active: isActive }),
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaizhizao.mold.importNoRows'));
              return;
            }
            const result = await importInChunksViaPerItemCreate({
              items,
              createOne: async (item, _index) => moldApi.create(item),
              title: t('app.kuaizhizao.mold.importTitle'),
              chunkSize: 100,
              concurrency: 4,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.kuaizhizao.mold.importSuccess', { count: result.successCount }));
    actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.kuaizhizao.mold.importPartialFail', { count: result.failureCount }));
            }
          }}
          importHeaders={moldImportTemplate.importHeaders}
          importExampleRow={moldImportTemplate.importExampleRow}
          importColumnOptions={moldImportTemplate.importColumnOptions}
          importFieldMap={moldImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items: any[] =
                type === 'currentPage' && pageData?.length
                  ? pageData
                  : await fetchAllListItems((p) => moldApi.list(p));
              if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const exportColumns = [
                { key: 'code', title: t('app.kuaizhizao.mold.import.code') },
                { key: 'name', title: t('app.kuaizhizao.mold.import.name') },
                { key: 'type', title: t('app.kuaizhizao.mold.import.type') },
                { key: 'category', title: t('app.kuaizhizao.mold.import.category') },
                { key: 'brand', title: t('app.kuaizhizao.mold.import.brand') },
                { key: 'model', title: t('app.kuaizhizao.mold.import.model') },
                { key: 'serial_number', title: t('app.kuaizhizao.mold.fieldSerialNumber') },
                { key: 'manufacturer', title: t('app.kuaizhizao.mold.fieldManufacturer') },
                { key: 'supplier', title: t('app.kuaizhizao.mold.fieldSupplier') },
                { key: 'status', title: t('app.kuaizhizao.mold.fieldStatus') },
              ];
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `molds-${todaySiteDateString()}.xlsx`,
                { columns: exportColumns, sheetName: t('app.kuaizhizao.mold.title') },
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑模具 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.mold.edit') : t('app.kuaizhizao.mold.create')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentMold(null);
          resetMoldFormFieldValues();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-equipment-management-mold"
              name="code"
              label={t('app.kuaizhizao.mold.fieldCode')}
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.kuaizhizao.mold.fieldName')}
              placeholder={t('app.kuaizhizao.mold.phName')}
              rules={[{ required: true, message: t('app.kuaizhizao.mold.ruleNameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_TYPE"
              name="type"
              label={t('app.kuaizhizao.mold.fieldType')}
              placeholder={t('common.selectField', { field: t('app.kuaizhizao.mold.fieldType') })}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="category" label={t('app.kuaizhizao.mold.fieldCategory')} placeholder={t('app.kuaizhizao.mold.phCategory')} />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label={t('app.kuaizhizao.mold.fieldBrand')} placeholder={t('app.kuaizhizao.mold.phBrand')} />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label={t('app.kuaizhizao.mold.fieldModel')} placeholder={t('app.kuaizhizao.mold.phModel')} />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label={t('app.kuaizhizao.mold.fieldSerialNumber')} placeholder={t('app.kuaizhizao.mold.phSerialNumber')} />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label={t('app.kuaizhizao.mold.fieldManufacturer')} placeholder={t('app.kuaizhizao.mold.phManufacturer')} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t('app.kuaizhizao.mold.fieldSupplier')} placeholder={t('app.kuaizhizao.mold.phSupplier')} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label={t('app.kuaizhizao.mold.fieldPurchaseDate')}
              placeholder={t('app.kuaizhizao.mold.phPurchaseDate')}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label={t('app.kuaizhizao.mold.fieldInstallationDate')}
              placeholder={t('app.kuaizhizao.mold.phInstallationDate')}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label={t('app.kuaizhizao.mold.fieldWarrantyPeriod')}
              placeholder={t('app.kuaizhizao.mold.phWarrantyPeriod')}
              min={0}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_STATUS"
              name="status"
              label={t('app.kuaizhizao.mold.fieldStatus')}
              placeholder={t('app.kuaizhizao.mold.phStatus')}
              required={true}
              rules={[{ required: true, message: t('app.kuaizhizao.mold.ruleStatusRequired') }]}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="cavity_count"
              label={t('app.kuaizhizao.mold.fieldCavityCount')}
              placeholder={t('app.kuaizhizao.mold.phCavityCount')}
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="design_lifetime"
              label={t('app.kuaizhizao.mold.fieldDesignLifetime')}
              placeholder={t('app.kuaizhizao.mold.phDesignLifetime')}
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <CustomFieldsFormSection
            customFields={moldFormCustomFields}
            customFieldValues={moldFormCustomFieldValues}
            gridColumns={2}
            embedInParentRow
          />
          <Col span={24}>
            <DocumentAttachmentsField category="mold_attachments" />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label={t('common.remark')}
              placeholder={t('app.kuaizhizao.mold.phDescription')}
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.mold.fieldIsActive')} />
          </Col>
        </Row>
      </FormModalTemplate>

      {PrintModal}
    </>
  );
};

export default MoldsPage;

