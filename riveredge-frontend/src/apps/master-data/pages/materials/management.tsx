import { rowActionKind } from '../../../../components/uni-action';
/**
 * 物料管理合并页面
 *
 * 左侧物料分组树，右侧物料管理列表
 * 参考文件管理页面的左右两栏布局
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Space,
  Modal,
  Popconfirm,
  Tag,
  theme,
  Menu,
  List,
  Typography,
  Checkbox,
  Select,
  TreeSelect,
  Alert,
  Result,
  Spin,
  Segmented,
  Card,
  Row,
  Col,
  Divider,
  Tooltip,
  Table,
  Skeleton,
  Form,
  InputNumber,
  Tabs,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderFilled,
  FolderOpenFilled,
  ExpandOutlined,
  CompressOutlined,
  TagsOutlined,
  BarcodeOutlined,
  NumberOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileOutlined,
  FilePdfOutlined,
  SwapOutlined,
  RedoOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ClusterOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormItem,
  ProFormInstance,
} from '@ant-design/pro-components'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { MenuProps } from 'antd'

/** 经典 Windows 资源管理器式实心文件夹（黄褐色） */
const MATERIAL_GROUP_FOLDER_ICON_STYLE = { fontSize: 16, verticalAlign: 'middle' } as const
const MATERIAL_GROUP_FOLDER_COLOR_CLOSED = '#e8b347'
const MATERIAL_GROUP_FOLDER_COLOR_OPEN = '#d4a028'

function renderMaterialGroupFolderIcon(props: { expanded: boolean; isLeaf: boolean }) {
  if (!props.isLeaf && props.expanded) {
    return (
      <FolderOpenFilled
        style={{ ...MATERIAL_GROUP_FOLDER_ICON_STYLE, color: MATERIAL_GROUP_FOLDER_COLOR_OPEN }}
      />
    )
  }
  return (
    <FolderFilled
      style={{ ...MATERIAL_GROUP_FOLDER_ICON_STYLE, color: MATERIAL_GROUP_FOLDER_COLOR_CLOSED }}
    />
  )
}

// 导入现有组件
import SafeProFormSelect from '../../../../components/safe-pro-form-select'
import { UniTable, type UniTableRequestMeta} from '../../../../components/uni-table'
import { UniImportMenuButton } from '../../../../components/uni-import/UniImportMenuButton'
import type { ImportPrecheckResult } from '../../../../components/uni-import/uni-import-preview-modal'
import { usePagePermissionResource } from '../../../../hooks/usePagePermissionResource'
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions'
import { UniBatchSplitToolbar } from '../../../../components/uni-batch'
import { TwoColumnLayout, DocumentFormPageLayout } from '../../../../components/layout-templates'
import { useLeaveFormTab, navigateClosingTab, uniTabKey } from '../../../../components/uni-tabs/navigateClosingTab'
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../utils/customPageTitle'
import { getApiErrorMessage } from '../../../../utils/errorHandler'
import { buildDetailDrawerEditExtra } from '../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail'
import { MasterDataDetailDrawer } from '../shared/masterDataDetailDrawer'
import {
  MODAL_CONFIG,
  LIST_PAGE_TABLE_SCROLL,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
} from '../../../../components/layout-templates/constants'
import { MaterialForm } from '../../components/MaterialForm'
import { MaterialGroupFormModal } from '../../components/MaterialGroupFormModal'
import { DEFAULT_MATERIAL_BASE_UNIT } from '../../constants/materialDefaults'
import {
  InspectionStagesEditor,
  MATERIAL_STAGE_KEYS,
  normalizeStagesInput,
  stagesFromLegacy,
  type InspectionStagesValue,
} from '../../components/InspectionStagesEditor'
import { MaterialVariantSkusPanel } from '../../components/MaterialVariantSkusPanel'
import {
  isVariantSkuMaterial,
  isVariantMasterMaterial,
  formatVariantAttributesLine,
} from '../../components/MaterialVariantCombinationsTable'
import { variantAttributeApi } from '../../services/variant-attribute'
import type { VariantAttributeDefinition } from '../../types/variant-attribute'
import FabricationRawMaterialWizard from '../../components/FabricationRawMaterialWizard'
import { MaterialHealthAssistantTrigger } from '../../../kuaiai/components/material-health/MaterialHealthAssistant'
import { MaterialDedupConfigTrigger } from '../../components/MaterialDedupAssistant'
import {
  fabricationMaterialNeedsRawMaterialSetup,
  isFabricationFromValues,
  toFabricationMaterialRef,
} from '../../utils/fabricationRawMaterial'
import type { FabricationMaterialRef } from '../../utils/fabricationRawMaterial'
import { QRCodeGenerator } from '../../../../components/qrcode'
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
} from '../../../../components/uni-table/stackedPrimaryColumn'
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { alignProColumns } from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment'
import { MASTER_DATA_LIST_FIELD_RANK } from '../../utils/masterListCore'
import {
  renderMasterActiveTag,
  renderMasterYesNoTag,
} from '../../utils/masterListPresentation'
import { MarkerTag } from '../../../../constants/statusBadges'

const LazyUniImport = lazy(() => import('../../../../components/uni-import'))

type MaterialSplitImportKind =
  | 'master'
  | 'sku'
  | 'units'
  | 'customerCodes'
  | 'defaults'
  | 'inspection'

/** SKU 子行列表单元格：不重复展示主物料字段 */
function renderMasterCell(record: Material, node: React.ReactNode): React.ReactNode {
  return isVariantSkuMaterial(record) ? null : node
}

function getMaterialListMainCode(record: Material): string {
  if (isVariantSkuMaterial(record)) {
    return String((record as any).code ?? '')
  }
  return String(
    (record as any).mainCode ?? (record as any).main_code ?? (record as any).code ?? '',
  )
}

function getMaterialProcessRouteName(record: Material): string {
  const name =
    (record as any).processRouteName ?? (record as any).process_route_name ?? ''
  return String(name).trim() || '-'
}

function resolveMaterialAuditDisplay(record: Record<string, unknown>): { operator: string; time: string } {
  const updater = String(
    record.updatedByName ?? record.updated_by_name ?? record.updater_name ?? record.updated_user_name ?? '',
  ).trim();
  const updatedAt = formatMasterDateTimeCell(record.updatedAt ?? record.updated_at);
  if (updater && updatedAt !== '-') {
    return { operator: updater, time: updatedAt };
  }
  const creator = String(
    record.createdByName ?? record.created_by_name ?? record.creator_name ?? record.created_user_name ?? '',
  ).trim();
  const createdAt = formatMasterDateTimeCell(record.createdAt ?? record.created_at);
  if (creator && createdAt !== '-') {
    return { operator: creator, time: createdAt };
  }
  if (updatedAt !== '-') {
    return { operator: updater || '-', time: updatedAt };
  }
  return { operator: creator || '-', time: createdAt };
}

function getMaterialSourceTypeLabel(
  record: Material,
  sourceTypeOptions: { value: string; label: string }[],
): string {
  const st = normalizeMaterialSourceType((record as any).sourceType ?? (record as any).source_type)
  const option = sourceTypeOptions.find((opt) => opt.value === st)
  return option ? option.label : st || '-'
}

/** 物料管理特例：名/码/规格叠列；配置件 SKU 子行：属性摘要 / SKU 编号 */
function MaterialListStackedCell({
  record,
  variantAttrLabelMap,
}: {
  record: Material
  variantAttrLabelMap: Map<string, string>
}) {
  const { t } = useTranslation()

  if (isVariantSkuMaterial(record)) {
    const attrs = (record.variantAttributes ?? (record as any).variant_attributes ?? {}) as Record<
      string,
      unknown
    >
    const primary = formatVariantAttributesLine(attrs, variantAttrLabelMap)
    const code = getMaterialListMainCode(record) || '-'
    return <UniTableStackedPrimaryCell primary={primary} secondary={code} />
  }

  const brand = record.brand?.trim()
  const model = record.model?.trim()
  const badges =
    brand || model ? (
      <Space size={4} wrap style={{ marginTop: 2 }}>
        {brand ? (
          <Tooltip title={`${t('app.master-data.materials.brand')}: ${brand}`}>
            <MarkerTag color="processing">{brand}</MarkerTag>
          </Tooltip>
        ) : null}
        {model ? (
          <Tooltip title={`${t('app.master-data.materials.model')}: ${model}`}>
            <MarkerTag color="purple">{model}</MarkerTag>
          </Tooltip>
        ) : null}
      </Space>
    ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <MaterialStackedCell
        material_name={record.name}
        material_code={getMaterialListMainCode(record)}
        material_spec={record.specification}
      />
      {badges}
    </div>
  )
}

// 导入服务和类型
import { materialApi, materialGroupApi } from '../../services/material'
import { customerApi, unwrapSupplyPagedList } from '../../services/supply-chain'
import type { Customer } from '../../types/supply-chain'
import { drawingApi, type EngineeringDrawing } from '../../services/drawing'
import {
  buildMaterialSourceTypeImportOptions,
  buildMaterialSourceTypeOptions,
  normalizeMaterialSourceType,
  parseMaterialSourceTypeImport,
} from '../../utils/materialSourceType';
import {
  IMPORT_YES_NO_OPTIONS,
  importDropdownLabelsFromOptions,
  parseImportOptionCell,
  pickImportExampleValue,
} from '../../../../utils/loadImportDictionaryValues';
import { processRouteApi } from '../../services/process'
import { warehouseApi } from '../../services/warehouse'
import type { Warehouse } from '../../types/warehouse'
import type { ProcessRoute } from '../../types/process'
import {
  formatMaterialGroupLabel,
  formatMaterialGroupHoverTitle,
  type Material,
  type MaterialCreate,
  type MaterialUpdate,
  type MaterialGroup,
  type MaterialGroupCreate,
  type MaterialGroupUpdate,
  type MaterialBulkTrackingPayload,
  type MaterialBulkVariantPayload,
  type MaterialBulkInspectionPatchItem,
  type StandardPartsPresetCatalog,
} from '../../types/material'
import { batchRuleApi, serialRuleApi } from '../../services/batchSerialRules'
import { materialUnitApi } from '../../services/material-unit'
import { SecureImage } from '../../../../components/secure-image'
import FilePreviewModal from '../../../../components/file-preview'
import { getFileByUuid, getFileDownloadUrlWithToken } from '../../../../services/file'
import { importInChunks, importInChunksViaPerItemCreate } from '../../../../utils/chunkedBulkImport';
import {
  buildMaterialImportColumnIndex,
  materialImportHasRemovedSkuColumns,
  parseMaterialImportRows,
} from '../../utils/materialImport'
import {
  buildMaterialGroupImportOptions,
  resolveMaterialGroupForImport,
} from '../../utils/materialGroupImport'
import {
  buildMaterialSkuImportColumnIndex,
  parseMaterialSkuImportRows,
} from '../../utils/materialSkuImport'
import {
  buildMaterialUnitsImportColumnIndex,
  mergeMaterialUnits,
  parseMaterialUnitsImportRows,
} from '../../utils/materialUnitsImport'
import {
  buildMaterialCustomerCodeImportColumnIndex,
  extractCustomerCodesFromMaterial,
  mergeCustomerCodes,
  parseMaterialCustomerCodeImportRows,
} from '../../utils/materialCustomerCodeImport'
import {
  buildMaterialDefaultsImportColumnIndex,
  parseMaterialDefaultsImportRows,
} from '../../utils/materialDefaultsImport'
import { pickMaterialMainCode, resolveMasterByMainCode } from '../../utils/materialImportResolve'
import {
  buildMaterialInspectionImportColumnIndex,
  parseMaterialInspectionImportRows,
} from '../../utils/materialInspectionImport'
import { inspectionPlanApi, unwrapInspectionPlanList } from '../../../kuaizhizao/services/quality-execution'
import { buildFactoryImportTemplate } from '../../utils/factoryImportTemplate'
import { downloadFile } from '../../../../utils'
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../utils/format'
import { formDateRangeFormItemProps } from '../../../../utils/formDate'
import { useNewShortcut } from '../../../../hooks/useNewShortcut'
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut'
import {
  buildMasterCrudActiveValueEnum,
  formatMasterDateTimeCell,
  MATERIAL_PINNED_ACTIVE_FIELD,
  resolveMaterialListParams,
} from '../../utils/materialListCore'
import { getSuspendedModal, clearSuspendedModal } from '../../utils/suspendedModal'
import { useCustomFieldsForList } from '../../../../hooks/useCustomFieldsForList'
import { useCustomFields } from '../../../../hooks/useCustomFields'
import { useTrialRunMode } from '../../../../hooks/useTrialRunMode'
import { getAntdModal } from '../../../../utils/antdAppApis';
/** 与 MaterialForm 一致：表示使用系统默认批号/序列号规则 */
const SYSTEM_DEFAULT_BATCH_SERIAL_RULE = '__SYSTEM_DEFAULT__'

const CONTEXT_MENU_VIEWPORT_PADDING = 8

/** 右键菜单贴边时向上/向左偏移，避免底部或右侧被裁切 */
function clampContextMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const pad = CONTEXT_MENU_VIEWPORT_PADDING
  const vw = window.innerWidth
  const vh = window.innerHeight
  let nextX = x
  let nextY = y
  if (x + width > vw - pad) {
    nextX = Math.max(pad, vw - width - pad)
  }
  if (y + height > vh - pad) {
    nextY = Math.max(pad, y - height)
  }
  if (nextY + height > vh - pad) {
    nextY = Math.max(pad, vh - height - pad)
  }
  return { x: nextX, y: nextY }
}

/** 与 MaterialForm 一致：非图片附件扩展名 */
const MATERIAL_NON_IMAGE_EXT = new Set(['pdf', 'dwg', 'dxf', 'step', 'stp', 'xls', 'xlsx'])

function normalizeMaterialAttachmentExt(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\./, '')
}

/** 列表首列附件：图片走缩略图，PDF/DWG 等显示图标并可预览 */
const MaterialAttachmentThumb: React.FC<{ fileUuid: string; alt?: string }> = ({ fileUuid, alt }) => {
  const { t } = useTranslation()
  const [ext, setExt] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fileName, setFileName] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    getFileByUuid(fileUuid)
      .then((f) => {
        if (cancelled) return
        const fromField = f.file_extension ? normalizeMaterialAttachmentExt(String(f.file_extension)) : ''
        const name = f.original_name || ''
        const fromName =
          name.lastIndexOf('.') >= 0
            ? normalizeMaterialAttachmentExt(name.slice(name.lastIndexOf('.') + 1))
            : ''
        setExt(fromField || fromName || '')
        setFileName(name)
      })
      .catch(() => {
        // 元数据失败时保持 null，继续按图片缩略图尝试加载
      })
    return () => {
      cancelled = true
    }
  }, [fileUuid])

  // 仅已知非图片扩展名才切文件图标；未知/空扩展名仍走 SecureImage（与改前列表行为一致）
  const showAsFileIcon = ext !== null && ext !== '' && MATERIAL_NON_IMAGE_EXT.has(ext)
  if (!showAsFileIcon) {
    return (
      <SecureImage
        fileUuid={fileUuid}
        alt={alt || ''}
        width={40}
        height={40}
        lazyLoad
        thumbSize={64}
      />
    )
  }

  const open = async () => {
    if (ext === 'pdf') {
      setPreviewOpen(true)
      return
    }
    try {
      const url = await getFileDownloadUrlWithToken(fileUuid)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Tooltip title={t('app.master-data.materials.openAttachment')}>
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 40, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          icon={
            ext === 'pdf' ? (
              <FilePdfOutlined style={{ fontSize: 22 }} />
            ) : (
              <FileOutlined style={{ fontSize: 22 }} />
            )
          }
          onClick={open}
        />
      </Tooltip>

      {ext === 'pdf' ? (
        <FilePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fileUuid={fileUuid}
          fileName={fileName || alt || 'PDF'}
          fileType="application/pdf"
          fileExtension="pdf"
          title={t('app.master-data.materials.openAttachment')}
          width="calc(100vw - 32px)"
          height="calc(100vh - 32px)"
        />
      ) : null}
    </>
  )
}

type StandardPartFlatRow = {
  presetKey: string
  industryId: string
  industryName: string
  categoryId: string
  categoryName: string
  primaryCategory: string
  name: string
  specification: string
  gbStandard: string
  gbCode: string
  baseUnit: string
  texture?: string
}

const MATERIAL_LIST_PATH = '/apps/master-data/materials'
const MATERIAL_CREATE_PATH = `${MATERIAL_LIST_PATH}/new`
const materialEditPath = (uuid: string) => `${MATERIAL_LIST_PATH}/${uuid}/edit`

function buildMaterialEditFormValues(material: Material): Record<string, unknown> {
  return {
    mainCode: material.mainCode ?? (material as any).main_code,
    name: material.name,
    groupId: material.groupId ?? (material as any).group_id,
    sourceType:
      (material as any).sourceType ??
      (material as any).source_type ??
      undefined,
    specification: material.specification,
    baseUnit: material.baseUnit ?? (material as any).base_unit,
    units: material.units ?? (material as any).units ?? undefined,
    batchManaged: material.batchManaged ?? (material as any).batch_managed,
    defaultBatchRuleId:
      (material as any).defaultBatchRuleId ?? (material as any).default_batch_rule_id,
    serialManaged:
      (material as any).serialManaged ?? (material as any).serial_managed ?? false,
    defaultSerialRuleId:
      (material as any).defaultSerialRuleId ?? (material as any).default_serial_rule_id,
    variantManaged: material.variantManaged ?? (material as any).variant_managed,
    description: material.description,
    brand: material.brand,
    model: material.model,
    texture: material.texture ?? (material as any).texture,
    weight: Number(material.weight ?? (material as any).weight ?? 0) || undefined,
    volume: Number(material.volume ?? (material as any).volume ?? 0) || undefined,
    barcode: material.barcode ?? (material as any).barcode,
    shelfLifeManaged:
      material.shelfLifeManaged ?? (material as any).shelf_life_managed ?? false,
    shelfLifeDays: material.shelfLifeDays ?? (material as any).shelf_life_days,
    referenceCost: material.referenceCost ?? (material as any).reference_cost,
    countryOfOrigin: material.countryOfOrigin ?? (material as any).country_of_origin,
    customsCode: material.customsCode ?? (material as any).customs_code,
    isGiftable: material.isGiftable ?? (material as any).is_giftable ?? false,
    isActive: material.isActive ?? (material as any).is_active,
    inspectionMode:
      (material as any).inspectionMode ?? (material as any).inspection_mode ?? 'none',
    inspectionStages: normalizeStagesInput(
      (material as any).inspectionStages ??
        (material as any).inspection_stages ??
        stagesFromLegacy(
          (material as any).inspectionMode ?? (material as any).inspection_mode,
          (material as any).defaultInspectionPlanId ??
            (material as any).default_inspection_plan_id,
        ),
    ),
    defaultInspectionPlanId:
      (material as any).defaultInspectionPlanId ??
      (material as any).default_inspection_plan_id ??
      undefined,
    overReportMode:
      (material as any).overReportMode ?? (material as any).over_report_mode ?? 'none',
    overReportValue:
      Number(
        (material as any).overReportValue ?? (material as any).over_report_value ?? 0,
      ) || 0,
  }
}

function buildMaterialCreateFormValues(groupId?: number | null): Record<string, unknown> {
  return {
    groupId: groupId || undefined,
    isActive: true,
    batchManaged: false,
    serialManaged: false,
    variantManaged: false,
    sourceType: undefined,
    baseUnit: DEFAULT_MATERIAL_BASE_UNIT,
    inspectionMode: 'none',
    inspectionStages: stagesFromLegacy('none'),
    overReportMode: 'none',
    overReportValue: 0,
    isGiftable: false,
  }
}

/**
 * 物料管理合并页面组件
 */
const MaterialsManagementPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const trialRunMode = useTrialRunMode()
  // 标准件预设导入当前阶段关闭（保留代码以便后续恢复）。
  const standardPresetFeatureEnabled = false
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isCreatePage = /\/materials\/new$/.test(location.pathname.replace(/\/$/, ''))
  const editRouteMatch = location.pathname.match(/\/materials\/([^/]+)\/edit$/)
  const editRouteUuid = editRouteMatch?.[1] ? decodeURIComponent(editRouteMatch[1]) : null
  const isEditPage = Boolean(editRouteUuid)
  const isFormPage = isCreatePage || isEditPage
  const leaveMaterialFormPage = useLeaveFormTab(MATERIAL_LIST_PATH)
  const formPageInitializedRef = useRef(false)
  const [formPageError, setFormPageError] = useState<string | null>(null)
  const pagePermissionResource = usePagePermissionResource(location.pathname)
  const { canImport } = useResourcePermissions(pagePermissionResource)

  // 左侧分组树状态
  const [groupTreeData, setGroupTreeData] = useState<DataNode[]>([])
  const [filteredGroupTreeData, setFilteredGroupTreeData] = useState<DataNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>(['all'])
  const [groupSearchValue, setGroupSearchValue] = useState<string>('')

  // 右侧物料列表状态
  const actionRef = useRef<ActionType>(null)
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({})
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [activeImportKind, setActiveImportKind] = useState<MaterialSplitImportKind | null>(null)
  const [importModalVisible, setImportModalVisible] = useState(false)

  const materialActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  )

  /** 批量批号/序列号管理（后端 batch-tracking 单接口） */
  const [batchSerialModalOpen, setBatchSerialModalOpen] = useState(false)
  const [batchMoveGroupOpen, setBatchMoveGroupOpen] = useState(false)
  const [batchMoveGroupId, setBatchMoveGroupId] = useState<number | undefined>(undefined)
  const [batchMoveGroupSubmitting, setBatchMoveGroupSubmitting] = useState(false)
  const [batchProcessRouteOpen, setBatchProcessRouteOpen] = useState(false)
  const [batchProcessRouteId, setBatchProcessRouteId] = useState<number | undefined>(undefined)
  const [batchProcessRouteSubmitting, setBatchProcessRouteSubmitting] = useState(false)
  const [processRoutesForBulk, setProcessRoutesForBulk] = useState<ProcessRoute[]>([])
  const [processRoutesForBulkLoading, setProcessRoutesForBulkLoading] = useState(false)
  const [batchSourceTypeOpen, setBatchSourceTypeOpen] = useState(false)
  const [batchSourceTypeValue, setBatchSourceTypeValue] = useState<string | undefined>(undefined)
  const [batchSourceTypeSubmitting, setBatchSourceTypeSubmitting] = useState(false)
  const [batchDefaultsOpen, setBatchDefaultsOpen] = useState(false)
  const [batchDefaultsSubmitting, setBatchDefaultsSubmitting] = useState(false)
  const [batchDefaultsApplyTax, setBatchDefaultsApplyTax] = useState(false)
  const [batchDefaultsTaxRate, setBatchDefaultsTaxRate] = useState<number | undefined>(13)
  const [batchDefaultsApplyWarehouse, setBatchDefaultsApplyWarehouse] = useState(false)
  const [batchDefaultsWarehouseIds, setBatchDefaultsWarehouseIds] = useState<number[]>([])
  const [warehousesForBulk, setWarehousesForBulk] = useState<Warehouse[]>([])
  const [warehousesForBulkLoading, setWarehousesForBulkLoading] = useState(false)
  const [batchDefaultsApplySafetyStock, setBatchDefaultsApplySafetyStock] = useState(false)
  const [batchDefaultsSafetyStock, setBatchDefaultsSafetyStock] = useState<number | undefined>()
  const [batchDefaultsApplyMaxStock, setBatchDefaultsApplyMaxStock] = useState(false)
  const [batchDefaultsMaxStock, setBatchDefaultsMaxStock] = useState<number | undefined>()
  const [batchInspectionOpen, setBatchInspectionOpen] = useState(false)
  const [batchInspectionSubmitting, setBatchInspectionSubmitting] = useState(false)
  const [batchInspectionApplyStages, setBatchInspectionApplyStages] = useState(true)
  const [batchInspectionStages, setBatchInspectionStages] = useState<InspectionStagesValue>(() =>
    normalizeStagesInput(null),
  )
  const [batchInspectionApplyOverReport, setBatchInspectionApplyOverReport] = useState(false)
  const [batchInspectionOverReportMode, setBatchInspectionOverReportMode] = useState<
    'none' | 'fixed' | 'percent'
  >('none')
  const [batchInspectionOverReportValue, setBatchInspectionOverReportValue] = useState<number>(0)
  const [batchVariantModalOpen, setBatchVariantModalOpen] = useState(false)
  const [batchVariantSubmitting, setBatchVariantSubmitting] = useState(false)
  const [bulkVariantMode, setBulkVariantMode] = useState<'enable' | 'disable'>('enable')
  const [rewriteMainCodesOpen, setRewriteMainCodesOpen] = useState(false)
  const [rewriteMainCodesSubmitting, setRewriteMainCodesSubmitting] = useState(false)
  const [rewriteMainCodesScope, setRewriteMainCodesScope] = useState<'selected' | 'group'>('selected')
  const [rewriteResetSequence, setRewriteResetSequence] = useState(false)
  const [bulkTrackingMode, setBulkTrackingMode] = useState<'enable' | 'disable'>('enable')
  const [bulkApplyBatch, setBulkApplyBatch] = useState(true)
  const [bulkApplySerial, setBulkApplySerial] = useState(true)
  const [bulkBatchRuleId, setBulkBatchRuleId] = useState<number | string>(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
  const [bulkSerialRuleId, setBulkSerialRuleId] = useState<number | string>(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
  const [batchRulesForBulk, setBatchRulesForBulk] = useState<{ id: number; name: string; code: string }[]>([])
  const [serialRulesForBulk, setSerialRulesForBulk] = useState<{ id: number; name: string; code: string }[]>([])
  const [bulkRuleOptionsLoading, setBulkRuleOptionsLoading] = useState(false)
  const [batchSerialSubmitting, setBatchSerialSubmitting] = useState(false)

  // Modal 和 Drawer 状态
  const [groupModalVisible, setGroupModalVisible] = useState(false)
  const [groupIsEdit, setGroupIsEdit] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<MaterialGroup | null>(null)
  /** 新建分组时预填的父分组 ID（右键「新建子分组」） */
  const [groupParentIdPreset, setGroupParentIdPreset] = useState<number | undefined>(undefined)

  const [materialRestoreInitialValues, setMaterialRestoreInitialValues] = useState<Record<string, any> | null>(null)
  const [materialFormLoading, setMaterialFormLoading] = useState(false)
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false)
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)
  const [materialDetailError, setMaterialDetailError] = useState<string | null>(null)
  const materialRetryUuidRef = useRef<string | null>(null)
  const [linkedDrawings, setLinkedDrawings] = useState<EngineeringDrawing[]>([])
  const [linkedDrawingsLoading, setLinkedDrawingsLoading] = useState(false)
  const [fabricationWizardOpen, setFabricationWizardOpen] = useState(false)
  const [fabricationWizardMaterial, setFabricationWizardMaterial] = useState<FabricationMaterialRef | null>(null)

  // 数据状态
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const selectedGroupIdRef = useRef<number | null>(null)
  const hasGroupSelectionInitializedRef = useRef(false)

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuGroup, setContextMenuGroup] = useState<MaterialGroup | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [baseUnitOptions, setBaseUnitOptions] = useState<Array<{ label: string; value: string }>>(
    []
  )
  const [loadingBaseUnitOptions, setLoadingBaseUnitOptions] = useState(false)
  const [variantAttrDefinitions, setVariantAttrDefinitions] = useState<
    VariantAttributeDefinition[]
  >([])

  const [standardPresetOpen, setStandardPresetOpen] = useState(false)
  const [standardPresetLoading, setStandardPresetLoading] = useState(false)
  const [standardPresetSubmitting, setStandardPresetSubmitting] = useState(false)
  const [standardPresetCatalog, setStandardPresetCatalog] = useState<StandardPartsPresetCatalog | null>(null)
  const [standardPresetIndustryId, setStandardPresetIndustryId] = useState<string>('')
  const [standardPresetPrimaryId, setStandardPresetPrimaryId] = useState<string>('')
  const [standardPresetCategoryId, setStandardPresetCategoryId] = useState<string>('')
  const [standardPresetSelectedKeys, setStandardPresetSelectedKeys] = useState<string[]>([])
  const [standardPresetGroupMode, setStandardPresetGroupMode] = useState<'single' | 'preset_by_category'>('single')
  const [standardPresetGroupUuid, setStandardPresetGroupUuid] = useState<string>('')
  const [standardPresetParentGroupUuid, setStandardPresetParentGroupUuid] = useState<string>('')
  const [standardPresetCodeMode, setStandardPresetCodeMode] = useState<'auto' | 'gb'>('auto')

  const {
    customFields,
    customFieldValues,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Material>({ tableName: 'master_data_materials' });

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  /**
   * 当详情抽屉打开时，加载自定义字段值
   */
  useEffect(() => {
    if (materialDrawerVisible && currentMaterial?.id) {
      loadFieldValuesForDetail(currentMaterial.id);
    } else if (!materialDrawerVisible) {
      resetDetailFieldValues();
    }
  }, [materialDrawerVisible, currentMaterial?.id, loadFieldValuesForDetail, resetDetailFieldValues]);

  const standardPresetIndustries = useMemo(
    () => standardPresetCatalog?.industries ?? [],
    [standardPresetCatalog]
  )

  const standardPresetFlatRows = useMemo((): StandardPartFlatRow[] => {
    const rows: StandardPartFlatRow[] = []
    for (const industry of standardPresetIndustries) {
      for (const primary of industry.primaryCategories ?? []) {
        for (const cat of primary.categories ?? []) {
          for (const it of cat.items ?? []) {
            rows.push({
              presetKey: it.presetKey,
              industryId: industry.id,
              industryName: industry.name,
              categoryId: cat.id,
              categoryName: cat.name,
              primaryCategory: primary.id || cat.primaryCategory || 'standard_parts',
              name: it.name,
              specification: it.specification ?? '',
              gbStandard: it.gbStandard ?? '',
              gbCode: it.gbCode ?? '',
              baseUnit: it.baseUnit ?? '件',
              texture: it.texture,
            })
          }
        }
      }
    }
    return rows
  }, [standardPresetIndustries])

  const standardPresetFilteredRows = useMemo(() => {
    if (standardPresetIndustryId) {
      return standardPresetFlatRows.filter((r) => r.industryId === standardPresetIndustryId).filter((r) => {
        if (standardPresetCategoryId) return r.categoryId === standardPresetCategoryId
        if (standardPresetPrimaryId) return r.primaryCategory === standardPresetPrimaryId
        return true
      })
    }
    if (standardPresetCategoryId) {
      return standardPresetFlatRows.filter((r) => r.categoryId === standardPresetCategoryId)
    }
    if (standardPresetPrimaryId) {
      return standardPresetFlatRows.filter((r) => r.primaryCategory === standardPresetPrimaryId)
    }
    return standardPresetFlatRows
  }, [standardPresetFlatRows, standardPresetIndustryId, standardPresetCategoryId, standardPresetPrimaryId])

  const standardPresetIndustryOptions = useMemo(
    () =>
      standardPresetIndustries.map((ind) => ({
        value: ind.id,
        label: ind.name,
      })),
    [standardPresetIndustries]
  )

  const standardPresetPrimaryOptions = useMemo(() => {
    const source = standardPresetCatalog?.taxonomy?.primaryCategories ?? []
    const allowedPrimary = new Set(
      standardPresetIndustryId
        ? standardPresetFlatRows
            .filter((r) => r.industryId === standardPresetIndustryId)
            .map((r) => r.primaryCategory)
        : source.map((pc) => pc.id)
    )
    return source
      .filter((pc) => allowedPrimary.has(pc.id))
      .map((pc) => ({
      value: pc.id,
      label: t(`app.master-data.materials.standardPresetPrimary.${pc.id}`, { defaultValue: pc.name || pc.id }),
    }))
  }, [standardPresetCatalog, standardPresetIndustryId, standardPresetFlatRows, t])

  const standardPresetSecondaryOptions = useMemo(() => {
    const source = standardPresetCatalog?.taxonomy?.secondaryCategories ?? []
    const allowedCategory = new Set(
      standardPresetFlatRows
        .filter((r) => (standardPresetIndustryId ? r.industryId === standardPresetIndustryId : true))
        .filter((r) => (standardPresetPrimaryId ? r.primaryCategory === standardPresetPrimaryId : true))
        .map((r) => r.categoryId)
    )
    const filtered = source.filter((c) => allowedCategory.has(c.id))
    return filtered.map((cat) => ({ value: cat.id, label: cat.name }))
  }, [standardPresetCatalog, standardPresetFlatRows, standardPresetIndustryId, standardPresetPrimaryId])

  const handleOpenStandardPreset = useCallback(async () => {
    setStandardPresetLoading(true)
    try {
      const cat = await materialApi.getStandardPartsPresetPreview()
      if (!Array.isArray(cat.industries) || cat.industries.length === 0) {
        throw new Error(t('app.master-data.materials.standardPresetIndustryEmpty'))
      }
      if (!cat.taxonomy?.primaryCategories?.length || !cat.taxonomy?.secondaryCategories?.length) {
        throw new Error(t('app.master-data.materials.standardPresetTaxonomyEmpty'))
      }
      setStandardPresetCatalog(cat)
      const industries = cat.industries
      setStandardPresetIndustryId('')
      setStandardPresetPrimaryId('')
      setStandardPresetCategoryId('')
      const allKeys = industries.flatMap((ind) =>
        (ind.primaryCategories ?? []).flatMap((pc) =>
          (pc.categories ?? []).flatMap((c) => (c.items ?? []).map((i) => i.presetKey))
        )
      )
      setStandardPresetSelectedKeys(allKeys)
      setStandardPresetGroupMode('single')
      setStandardPresetParentGroupUuid('')
      if (selectedGroupId != null) {
        const g = materialGroups.find((x) => x.id === selectedGroupId)
        setStandardPresetGroupUuid(g?.uuid ?? '')
      } else {
        setStandardPresetGroupUuid('')
      }
      setStandardPresetCodeMode('auto')
      setStandardPresetOpen(true)
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'))
    } finally {
      setStandardPresetLoading(false)
    }
  }, [materialGroups, messageApi, selectedGroupId, t])

  /**
   * 递归收集所有节点的key
   */
  const collectAllKeys = useCallback((nodes: DataNode[]): React.Key[] => {
    const getAll = (data: DataNode[]): React.Key[] => {
      let keys: React.Key[] = []
      data.forEach(node => {
        keys.push(node.key)
        if (node.children && node.children.length > 0) {
          keys = keys.concat(getAll(node.children))
        }
      })
      return keys
    }
    return getAll(nodes)
  }, [])

  /**
   * 递归过滤树数据（支持搜索子分组）
   * 如果父分组匹配，显示父分组及其所有子分组
   * 如果子分组匹配，显示父分组和匹配的子分组
   */
  const filterTreeData = useCallback((nodes: DataNode[], keyword: string): DataNode[] => {
    if (!keyword.trim()) {
      return nodes
    }

    const keywordLower = keyword.toLowerCase()
    const filter = (data: DataNode[]): DataNode[] => {
      const filtered: DataNode[] = []
      data.forEach(node => {
        // 检查当前节点是否匹配（排除"全部物料"节点）
        const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
        const matches =
          node.key !== 'all' &&
          (String(searchLabel ?? node.title ?? '').toLowerCase().includes(keywordLower) ||
            String(node.title ?? '').toLowerCase().includes(keywordLower))

        // 递归过滤子节点
        const filteredChildren = node.children ? filter(node.children) : []

        // 如果当前节点匹配，或者有子节点匹配，则包含此节点
        if (matches || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children:
              filteredChildren.length > 0 ? filteredChildren : matches ? node.children : undefined,
          })
        }
      })
      return filtered
    }

    return filter(nodes)
  }, [])

  const handleEditMaterial = useCallback(
    (record: Material) => {
      if (!record.uuid) return
      navigate(materialEditPath(record.uuid))
    },
    [navigate],
  )

  const loadMaterialDetail = useCallback(
    async (uuid: string) => {
      setMaterialDetailLoading(true)
      setMaterialDetailError(null)
      setLinkedDrawingsLoading(true)
      try {
        const detail = await materialApi.get(uuid)
        setCurrentMaterial(detail)
        await loadFieldValuesForDetail(detail.id)
        const drawings = await drawingApi.listByContext({ materialUuid: uuid })
        setLinkedDrawings(drawings)
      } catch (error) {
        setCurrentMaterial(null)
        setLinkedDrawings([])
        setMaterialDetailError(getApiErrorMessage(error, t('app.master-data.materials.getDetailFailed')))
      } finally {
        setMaterialDetailLoading(false)
        setLinkedDrawingsLoading(false)
      }
    },
    [loadFieldValuesForDetail, t],
  )

  const handleViewMaterial = useCallback(
    (record: Material) => {
      materialRetryUuidRef.current = record.uuid
      setMaterialDrawerVisible(true)
      setCurrentMaterial(null)
      setLinkedDrawings([])
      setMaterialDetailError(null)
      resetDetailFieldValues()
      void loadMaterialDetail(record.uuid)
    },
    [loadMaterialDetail, resetDetailFieldValues],
  )

  const handleOpenMaterialForEdit = useCallback(
    (uuid: string) => {
      navigate(materialEditPath(uuid))
    },
    [navigate],
  )

  const healthCheckGroupId = useMemo(() => {
    const id = selectedGroupIdRef.current ?? selectedGroupId
    return id != null && id !== -1 ? id : null
  }, [selectedGroupId])

  /**
   * 将后端树形数据转换为Ant Design Tree组件格式
   */
  const convertToTreeData = useCallback(
    (
      treeResponse: any[],
      summary?: { ungroupedMaterialCount?: number; totalMaterialCount?: number },
    ): DataNode[] => {
      const withCount = (label: string, count: number | undefined) =>
        typeof count === 'number' && Number.isFinite(count) ? `${label} (${count})` : label

      const convertNode = (node: any): DataNode & { searchLabel?: string } => {
        const count = Number(node.materialCount ?? node.material_count)
        const label = withCount(
          formatMaterialGroupLabel(node),
          Number.isFinite(count) ? count : undefined,
        )
        // rc-tree 将 data.title 写入 node-content-wrapper 的 HTML title（含右侧空白区），须用完整悬停文案
        return {
          title: withCount(
            formatMaterialGroupHoverTitle(node),
            Number.isFinite(count) ? count : undefined,
          ),
          searchLabel: label,
          key: node.id.toString(),
          isLeaf: !node.children || node.children.length === 0,
          children: node.children ? node.children.map(convertNode) : undefined,
        }
      }

      const allLabel = withCount(
        t('app.master-data.materials.allMaterials'),
        summary?.totalMaterialCount,
      )
      const noGroupLabel = withCount(
        t('app.master-data.materials.noGroup'),
        summary?.ungroupedMaterialCount,
      )

      return [
        {
          title: allLabel,
          searchLabel: allLabel,
          key: 'all',
          isLeaf: false,
          children: [
            ...treeResponse.map(convertNode),
            {
              title: noGroupLabel,
              searchLabel: noGroupLabel,
              key: 'no-group',
              isLeaf: true,
            },
          ],
        },
      ]
    },
    [t],
  )

  /** 批量移动分组：TreeSelect 用树形数据（不含「全部物料」根节点） */
  const batchMoveGroupTreeData = useMemo(() => {
    type TreeNode = { value: number; title: string; key: string; children?: TreeNode[] }
    const toTreeSelectNodes = (nodes: DataNode[] | undefined): TreeNode[] => {
      if (!nodes?.length) return []
      const out: TreeNode[] = []
      for (const node of nodes) {
        if (node.key === 'all') {
          out.push(...toTreeSelectNodes(node.children))
          continue
        }
        const id = Number(node.key)
        if (!Number.isFinite(id)) continue
        const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
        const title =
          searchLabel ??
          (typeof node.title === 'string' ? node.title : String(node.title ?? ''))
        out.push({
          value: id,
          key: String(node.key),
          title,
          children: node.children?.length ? toTreeSelectNodes(node.children) : undefined,
        })
      }
      return out
    }
    return toTreeSelectNodes(groupTreeData)
  }, [groupTreeData])

  /**
   * 加载物料分组树形结构
   */
  const loadMaterialGroups = useCallback(async () => {
    try {
      setMaterialGroupsLoading(true)

      // 获取树形结构数据
      const treeResult = await materialGroupApi.tree()
      const treeItems = treeResult.items ?? []

      // 构建树形数据（含各节点物料数量）
      const treeData: DataNode[] = convertToTreeData(treeItems, {
        ungroupedMaterialCount: treeResult.ungroupedMaterialCount,
        totalMaterialCount: treeResult.totalMaterialCount,
      })

      setGroupTreeData(treeData)
      setFilteredGroupTreeData(treeData)

      // 同时获取平级列表用于其他操作（如果需要）
      const listResult = await materialGroupApi.list({ limit: 1000 })
      setMaterialGroups(listResult)

      const allKeys = collectAllKeys(treeData)
      setExpandedKeys(allKeys)
    } catch (error: any) {
      console.error('加载物料分组树形结构失败:', error)
      messageApi.error(t('app.master-data.materials.loadGroupFailed'))
    } finally {
      setMaterialGroupsLoading(false)
    }
  }, [messageApi, convertToTreeData, collectAllKeys, t])

  useEffect(() => {
    if (isFormPage) return
    const state = location.state as {
      reloadMaterials?: boolean
      openFabricationWizard?: FabricationMaterialRef
    } | null
    if (!state?.reloadMaterials && !state?.openFabricationWizard) return
    if (state.reloadMaterials) {
      actionRef.current?.reload()
      void loadMaterialGroups()
    }
    if (state.openFabricationWizard) {
      setFabricationWizardMaterial(state.openFabricationWizard)
      setFabricationWizardOpen(true)
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
  }, [isFormPage, location.state, location.pathname, location.search, navigate, loadMaterialGroups])

  /**
   * 加载基础单位选项（单位主数据）与属性定义
   */
  const loadDictionaryOptions = useCallback(async () => {
    try {
      setLoadingBaseUnitOptions(true)
      const res = await materialUnitApi.list({ skip: 0, limit: 500, is_active: true })
      setBaseUnitOptions(
        (res.items ?? []).map((u) => ({ label: u.name || u.code, value: u.code })),
      )
    } catch (error: any) {
      console.error('加载基础单位选项失败:', error)
    } finally {
      setLoadingBaseUnitOptions(false)
    }

    try {
      const { items: defs } = await variantAttributeApi.list({ is_active: true, limit: 1000 })
      defs.sort((a, b) => a.display_order - b.display_order)
      setVariantAttrDefinitions(defs)
    } catch (error: unknown) {
      console.error('加载属性定义失败:', error)
    }
  }, [])

  // 暂存表单返回：打开独立新建标签，由建单页读取 sessionStorage
  useEffect(() => {
    if (isFormPage) return
    const state = getSuspendedModal()
    const isRestoreUrl = searchParams.get('restore') === '1'
    const isMaterialsPath =
      location.pathname.replace(/\/$/, '').endsWith('/materials') &&
      !/\/materials\/.+/.test(location.pathname)
    if (state?.formData && (isRestoreUrl || (isMaterialsPath && state.returnPath?.endsWith('/materials')))) {
      navigate(MATERIAL_CREATE_PATH, { replace: isRestoreUrl })
    }
  }, [isFormPage, location.pathname, navigate, searchParams])

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuVisible) {
        setContextMenuVisible(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenuVisible])

  // 根据菜单实际尺寸调整位置（底部空间不足时向上弹出）
  useLayoutEffect(() => {
    if (!contextMenuVisible) return
    const el = contextMenuRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const adjusted = clampContextMenuPosition(
      contextMenuPosition.x,
      contextMenuPosition.y,
      width,
      height,
    )
    if (adjusted.x !== contextMenuPosition.x || adjusted.y !== contextMenuPosition.y) {
      setContextMenuPosition(adjusted)
    }
  }, [contextMenuVisible, contextMenuGroup, contextMenuPosition.x, contextMenuPosition.y])

  const materialGroupContextMenuItems = useMemo((): MenuProps['items'] => {
    const items: NonNullable<MenuProps['items']> = []
    if (contextMenuGroup) {
      items.push({
        key: 'createSub',
        icon: <PlusOutlined />,
        label: t('app.master-data.materials.createSubGroup'),
      })
    }
    items.push({
      key: 'create',
      icon: <PlusOutlined />,
      label: t('app.master-data.materials.createGroup'),
    })
    if (contextMenuGroup) {
      items.push(
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: t('app.master-data.materials.editGroup'),
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          danger: true,
          label: t('app.master-data.materials.deleteGroup'),
        },
      )
    }
    return items
  }, [contextMenuGroup, t])

  // 物料来源类型选项（用于搜索下拉框和列表展示，使用 i18n）
  const sourceTypeOptions = useMemo(() => buildMaterialSourceTypeOptions(t), [t])

  const variantAttrLabelMap = useMemo(
    () => new Map(variantAttrDefinitions.map((d) => [d.attribute_name, d.display_name])),
    [variantAttrDefinitions],
  )




  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    if (isFormPage) return
    const materialUuid = searchParams.get('materialUuid')
    const action = searchParams.get('action')

    if (materialUuid && action === 'detail') {
      // 自动打开物料详情
      handleViewMaterial({ uuid: materialUuid } as Material)
      // 清除URL参数
      setSearchParams({}, { replace: true })
    }
    if (materialUuid && action === 'edit') {
      navigate(materialEditPath(materialUuid), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormPage, searchParams, setSearchParams, handleViewMaterial, navigate])

  /**
   * 处理分组搜索
   */
  useEffect(() => {
    if (!groupSearchValue.trim()) {
      setFilteredGroupTreeData(groupTreeData)
    } else {
      const filtered = filterTreeData(groupTreeData, groupSearchValue)
      setFilteredGroupTreeData(filtered)

      // 自动展开所有匹配的节点
      const allKeys = collectAllKeys(filtered)
      setExpandedKeys(allKeys)
    }
  }, [groupTreeData, groupSearchValue, filterTreeData, collectAllKeys])

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadMaterialGroups()
    loadDictionaryOptions()
  }, [loadMaterialGroups, loadDictionaryOptions])

  /**
   * 分组相关操作
   */
  /**
   * 切换展开/收起所有分组
   */
  const handleToggleExpand = useCallback(() => {
    // 如果当前展开的节点数量少于所有节点数量的一半，则视为折叠状态，进行展开
    // 否则视为展开状态，进行折叠
    // 注意：如果有搜索结果，仅针对搜索结果进行操作
    const targetData = filteredGroupTreeData.length > 0 ? filteredGroupTreeData : groupTreeData
    const allKeys = collectAllKeys(targetData)
    
    // 判断"全部展开"的标准：我们可以简单地检查 expandedKeys 的长度
    // 但为了更好的体验，如果 expandedKeys 包含了大部分 key，我们认为是展开的，点击则是收起
    // 这里的"大部分"我们定义为 > 1 (因为 'all' 总是存在的)
    // 更好的逻辑：
    // 如果 expandedKeys 只包含 'all' (或者为空)，则展开所有
    // 否则，收起所有（只保留 'all'）
    
    if (expandedKeys.length <= 1) {
       setExpandedKeys(allKeys)
    } else {
       setExpandedKeys(['all'])
    }
  }, [expandedKeys, filteredGroupTreeData, groupTreeData, collectAllKeys])

  const handleCreateGroup = useCallback(() => {
    setGroupParentIdPreset(undefined)
    setGroupIsEdit(false)
    setCurrentGroup(null)
    setGroupModalVisible(true)
  }, [])

  const handleCreateSubGroup = useCallback((parent: MaterialGroup) => {
    setGroupParentIdPreset(parent.id)
    setGroupIsEdit(false)
    setCurrentGroup(null)
    setGroupModalVisible(true)
  }, [])

  const handleCloseGroupModal = useCallback(() => {
    setGroupModalVisible(false)
    setGroupParentIdPreset(undefined)
  }, [])

  const handleEditGroup = useCallback((group: MaterialGroup) => {
    setGroupParentIdPreset(undefined)
    setGroupIsEdit(true)
    setCurrentGroup(group)
    setGroupModalVisible(true)
  }, [])

  const handleGroupFormSuccess = useCallback(() => {
    loadMaterialGroups()
  }, [loadMaterialGroups])

  const handleDeleteGroup = useCallback(
    async (group: MaterialGroup) => {
      try {
        await materialGroupApi.delete(group.uuid)
        messageApi.success(t('common.deleteSuccess'))
        loadMaterialGroups()
      } catch (error: any) {
        messageApi.error(error.message || t('common.deleteFailed'))
      }
    },
    [messageApi, loadMaterialGroups]
  )

  /**
   * 物料相关操作
   */
  const handleCreateMaterial = useCallback(() => {
    const gid = selectedGroupIdRef.current
    const qs = gid != null && gid > 0 ? `?groupId=${gid}` : ''
    navigate(`${MATERIAL_CREATE_PATH}${qs}`)
  }, [navigate])

  // Alt+N 绑定到新建物料（与新建分组区分，仅新建物料响应快捷键）
  useNewShortcut(isFormPage ? undefined : handleCreateMaterial)

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false
      return
    }
    const title = isCreatePage
      ? t('app.master-data.menu.materials.management.new')
      : t('app.master-data.menu.materials.management.edit')
    const params = new URLSearchParams(location.search || '')
    params.delete('_refresh')
    const cleanSearch = params.toString()
    const tabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '')
    setCustomPageTitle(location.pathname, title)
    setCustomPageTitle(tabKey, title)
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    )
    return () => {
      removeCustomPageTitle(location.pathname)
      removeCustomPageTitle(tabKey)
    }
  }, [isFormPage, isCreatePage, location.pathname, location.search, t])

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return
    formPageInitializedRef.current = true
    setFormPageError(null)
    if (isCreatePage) {
      const suspended = getSuspendedModal()
      if (suspended?.formData) {
        setMaterialRestoreInitialValues(suspended.formData)
        clearSuspendedModal()
      }
      setCurrentMaterial(null)
      return
    }
    if (!editRouteUuid) return
    void (async () => {
      try {
        setMaterialFormLoading(true)
        const detail = await materialApi.get(editRouteUuid)
        setCurrentMaterial(detail)
      } catch (error) {
        setCurrentMaterial(null)
        setFormPageError(getApiErrorMessage(error, t('app.master-data.materials.getDetailFailed')))
      } finally {
        setMaterialFormLoading(false)
      }
    })()
  }, [isFormPage, isCreatePage, editRouteUuid, t])

  const handleGroupSelect: TreeProps['onSelect'] = selectedKeys => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string
      setSelectedGroupKeys(selectedKeys)

      if (key === 'all') {
        selectedGroupIdRef.current = null
        setSelectedGroupId(null)
      } else if (key === 'no-group') {
        selectedGroupIdRef.current = -1
        setSelectedGroupId(-1)
      } else {
        const groupId = parseInt(key)
        selectedGroupIdRef.current = groupId
        setSelectedGroupId(groupId)
      }
    }
  }

  useEffect(() => {
    // 首次渲染不触发，避免页面初始化时重复请求
    if (!hasGroupSelectionInitializedRef.current) {
      hasGroupSelectionInitializedRef.current = true
      return
    }
    actionRef.current?.reload()
  }, [selectedGroupKeys])

  const handleGroupExpand: TreeProps['onExpand'] = expandedKeys => {
    setExpandedKeys(expandedKeys)
  }

  const handleGroupContextMenu = (e: React.MouseEvent, group: MaterialGroup | null) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuGroup(group)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
  }

  const handleOpenBatchSerialModal = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.materials.selectForBatchSerial'))
      return
    }
    setBulkTrackingMode('enable')
    setBulkApplyBatch(true)
    setBulkApplySerial(true)
    setBulkBatchRuleId(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
    setBulkSerialRuleId(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
    setBatchSerialModalOpen(true)
    setBulkRuleOptionsLoading(true)
    Promise.all([
      batchRuleApi.list({ page: 1, pageSize: 500, isActive: true }),
      serialRuleApi.list({ page: 1, pageSize: 500, isActive: true }),
    ])
      .then(([br, sr]) => {
        setBatchRulesForBulk(br.items.map((r) => ({ id: r.id, name: r.name, code: r.code })))
        setSerialRulesForBulk(sr.items.map((r) => ({ id: r.id, name: r.name, code: r.code })))
      })
      .catch(() => {
        messageApi.error(t('app.master-data.materials.batchTrackingLoadRulesFailed'))
        setBatchRulesForBulk([])
        setSerialRulesForBulk([])
      })
      .finally(() => setBulkRuleOptionsLoading(false))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchSerial = useCallback(async () => {
    if (!bulkApplyBatch && !bulkApplySerial) {
      messageApi.warning(t('app.master-data.materials.batchTrackingPickOneDimension'))
      return Promise.reject()
    }
    setBatchSerialSubmitting(true)
    try {
      const payload: MaterialBulkTrackingPayload = {
        material_uuids: selectedRowKeys.map((k) => String(k)),
      }
      if (bulkTrackingMode === 'enable') {
        if (bulkApplyBatch) {
          payload.batch_managed = true
          payload.default_batch_rule_id =
            bulkBatchRuleId === SYSTEM_DEFAULT_BATCH_SERIAL_RULE ? null : Number(bulkBatchRuleId)
        }
        if (bulkApplySerial) {
          payload.serial_managed = true
          payload.default_serial_rule_id =
            bulkSerialRuleId === SYSTEM_DEFAULT_BATCH_SERIAL_RULE ? null : Number(bulkSerialRuleId)
        }
      } else {
        if (bulkApplyBatch) payload.batch_managed = false
        if (bulkApplySerial) payload.serial_managed = false
      }

      const res = await materialApi.bulkUpdateTracking(payload)
      const notFound = res.not_found_uuids?.length ?? 0
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchTrackingSuccess', { count: res.updated_count })
        )
        if (notFound > 0) {
          messageApi.warning(
            t('app.master-data.materials.batchTrackingNotFound', { count: notFound })
          )
        }
      } else if (notFound > 0) {
        messageApi.error(t('app.master-data.materials.batchTrackingAllMissing'))
      } else {
        messageApi.warning(t('app.master-data.materials.batchTrackingNoop'))
      }
      setBatchSerialModalOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const detailMsg =
        typeof detail === 'string' ? detail : detail?.message ?? (typeof detail === 'object' ? detail?.detail : undefined)
      messageApi.error(detailMsg || e?.message || t('common.updateFailed'))
      throw e
    } finally {
      setBatchSerialSubmitting(false)
    }
  }, [
    bulkApplyBatch,
    bulkApplySerial,
    bulkBatchRuleId,
    bulkSerialRuleId,
    bulkTrackingMode,
    selectedRowKeys,
    messageApi,
    t,
  ])

  const handleDeleteMaterial = useCallback(
    async (record: Material) => {
      try {
        await materialApi.delete(record.uuid)
        messageApi.success(t('common.deleteSuccess'))
        await loadMaterialGroups()
        actionRef.current?.reload()
      } catch (error: any) {
        messageApi.error(error.message || t('common.deleteFailed'))
      }
    },
    [messageApi, loadMaterialGroups, t]
  )

  /**
   * 批量删除物料（Popconfirm 确认后执行；返回 Promise 时 Ant Design 会为「确定」显示 loading）
   */
  const executeBatchDelete = useCallback(async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'))
      return
    }
    try {
      const uuids = targetKeys.map((k) => String(k))
      const res = await materialApi.batchDelete(uuids)
      const { deleted_count: deletedCount, failed_count: failCount, failed_items: failedItems } = res

      if (deletedCount > 0) {
        messageApi.success(t('common.batchDeleteSuccess', { count: deletedCount }))
      }
      if (failCount > 0) {
        const uniq = [...new Set((failedItems ?? []).map((f) => f.reason))]
        const hint = uniq.length <= 3 ? uniq.join('; ') : `${uniq.slice(0, 3).join('; ')}…`
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: hint ? ': ' + hint : '',
          })
        )
      }

      setSelectedRowKeys([])
      if (deletedCount > 0) {
        await loadMaterialGroups()
      }
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'))
      throw error
    }
  }, [selectedRowKeys, messageApi, t, loadMaterialGroups])

  const handleOpenBatchMoveGroup = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchMoveGroupId(undefined)
    setBatchMoveGroupOpen(true)
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchMoveGroup = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    if (batchMoveGroupId == null) {
      messageApi.warning(t('app.master-data.materials.batchMoveGroupSelectRequired'))
      return
    }
    setBatchMoveGroupSubmitting(true)
    try {
      const uuids = selectedRowKeys.map((k) => String(k))
      const res = await materialApi.batchMoveGroup(uuids, batchMoveGroupId)
      if (res.updated_count > 0) {
        messageApi.success(t('app.master-data.materials.batchMoveGroupSuccess', { count: res.updated_count }))
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(t('app.master-data.materials.batchMoveGroupNotFound', { count: notFound }))
      }
      setBatchMoveGroupOpen(false)
      setSelectedRowKeys([])
      if (res.updated_count > 0) {
        await loadMaterialGroups()
      }
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchMoveGroupFailed'))
    } finally {
      setBatchMoveGroupSubmitting(false)
    }
  }, [selectedRowKeys, batchMoveGroupId, messageApi, t, loadMaterialGroups])

  const handleOpenBatchProcessRoute = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchProcessRouteId(undefined)
    setBatchProcessRouteOpen(true)
    setProcessRoutesForBulkLoading(true)
    processRouteApi
      .list({ limit: 1000, isActive: true })
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.data ?? []
        setProcessRoutesForBulk(list)
      })
      .catch(() => {
        messageApi.error(t('app.master-data.materialForm.fetchProcessRoutesFailed'))
        setProcessRoutesForBulk([])
      })
      .finally(() => setProcessRoutesForBulkLoading(false))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchProcessRoute = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchProcessRouteSubmitting(true)
    try {
      const uuids = selectedRowKeys.map((k) => String(k))
      const res = await materialApi.batchUpdateProcessRoute(
        uuids,
        batchProcessRouteId ?? null,
      )
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchProcessRouteSuccess', { count: res.updated_count }),
        )
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(
          t('app.master-data.materials.batchProcessRouteNotFound', { count: notFound }),
        )
      }
      setBatchProcessRouteOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchProcessRouteFailed'))
    } finally {
      setBatchProcessRouteSubmitting(false)
    }
  }, [selectedRowKeys, batchProcessRouteId, messageApi, t])

  const handleOpenBatchSourceType = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchSourceTypeValue(undefined)
    setBatchSourceTypeOpen(true)
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchSourceType = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    if (!batchSourceTypeValue) {
      messageApi.warning(t('app.master-data.materials.batchSourceTypeSelectRequired'))
      return
    }
    setBatchSourceTypeSubmitting(true)
    try {
      const uuids = selectedRowKeys.map((k) => String(k))
      const res = await materialApi.batchUpdateSourceType(uuids, batchSourceTypeValue)
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchSourceTypeSuccess', { count: res.updated_count }),
        )
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(
          t('app.master-data.materials.batchSourceTypeNotFound', { count: notFound }),
        )
      }
      setBatchSourceTypeOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchSourceTypeFailed'))
    } finally {
      setBatchSourceTypeSubmitting(false)
    }
  }, [selectedRowKeys, batchSourceTypeValue, messageApi, t])

  const handleOpenBatchDefaults = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchDefaultsApplyTax(false)
    setBatchDefaultsTaxRate(13)
    setBatchDefaultsApplyWarehouse(false)
    setBatchDefaultsWarehouseIds([])
    setBatchDefaultsApplySafetyStock(false)
    setBatchDefaultsSafetyStock(undefined)
    setBatchDefaultsApplyMaxStock(false)
    setBatchDefaultsMaxStock(undefined)
    setBatchDefaultsOpen(true)
    setWarehousesForBulkLoading(true)
    warehouseApi
      .list({ limit: 1000, is_active: true })
      .then((result) => {
        setWarehousesForBulk(result.items ?? [])
      })
      .catch(() => {
        messageApi.error(t('app.master-data.materialForm.fetchWarehousesFailed'))
        setWarehousesForBulk([])
      })
      .finally(() => setWarehousesForBulkLoading(false))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchDefaults = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    if (
      !batchDefaultsApplyTax &&
      !batchDefaultsApplyWarehouse &&
      !batchDefaultsApplySafetyStock &&
      !batchDefaultsApplyMaxStock
    ) {
      messageApi.warning(t('app.master-data.materials.batchDefaultsPickOne'))
      return Promise.reject()
    }
    if (batchDefaultsApplyTax && batchDefaultsTaxRate == null) {
      messageApi.warning(t('app.master-data.defaults.defaultTaxRatePlaceholder'))
      return Promise.reject()
    }
    if (batchDefaultsApplySafetyStock && batchDefaultsSafetyStock == null) {
      messageApi.warning(t('app.master-data.defaults.safetyStockPlaceholder'))
      return Promise.reject()
    }
    if (batchDefaultsApplyMaxStock && batchDefaultsMaxStock == null) {
      messageApi.warning(t('app.master-data.defaults.maxStockPlaceholder'))
      return Promise.reject()
    }
    setBatchDefaultsSubmitting(true)
    try {
      const payload: import('../../types/material').MaterialBulkDefaultsPatchPayload = {
        material_uuids: selectedRowKeys.map((k) => String(k)),
      }
      if (batchDefaultsApplyTax) payload.defaultTaxRate = batchDefaultsTaxRate
      if (batchDefaultsApplyWarehouse) {
        payload.defaultWarehouseIds = batchDefaultsWarehouseIds
      }
      if (batchDefaultsApplySafetyStock) payload.safetyStock = batchDefaultsSafetyStock
      if (batchDefaultsApplyMaxStock) payload.maxStock = batchDefaultsMaxStock
      const res = await materialApi.bulkPatchDefaults(payload)
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchDefaultsSuccess', { count: res.updated_count }),
        )
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(
          t('app.master-data.materials.batchDefaultsNotFound', { count: notFound }),
        )
      }
      setBatchDefaultsOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchDefaultsFailed'))
      return Promise.reject()
    } finally {
      setBatchDefaultsSubmitting(false)
    }
  }, [
    selectedRowKeys,
    batchDefaultsApplyTax,
    batchDefaultsTaxRate,
    batchDefaultsApplyWarehouse,
    batchDefaultsWarehouseIds,
    batchDefaultsApplySafetyStock,
    batchDefaultsSafetyStock,
    batchDefaultsApplyMaxStock,
    batchDefaultsMaxStock,
    messageApi,
    t,
  ])

  const handleOpenBatchInspection = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchInspectionApplyStages(true)
    setBatchInspectionStages(normalizeStagesInput(null))
    setBatchInspectionApplyOverReport(false)
    setBatchInspectionOverReportMode('none')
    setBatchInspectionOverReportValue(0)
    setBatchInspectionOpen(true)
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchInspection = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    if (!batchInspectionApplyStages && !batchInspectionApplyOverReport) {
      messageApi.warning(t('app.master-data.materials.batchInspectionPickOne'))
      return Promise.reject()
    }
    if (batchInspectionApplyStages) {
      for (const key of MATERIAL_STAGE_KEYS) {
        const pol = batchInspectionStages[key]
        if (pol?.mode === 'plan' && !(pol.planId != null && Number(pol.planId) > 0)) {
          messageApi.warning(t('app.master-data.materials.batchInspectionPlanRequired', { stage: key.toUpperCase() }))
          return Promise.reject()
        }
      }
    }
    setBatchInspectionSubmitting(true)
    try {
      const patch: Omit<MaterialBulkInspectionPatchItem, 'materialUuid'> = {}
      if (batchInspectionApplyStages) {
        const stages: NonNullable<MaterialBulkInspectionPatchItem['inspectionStages']> = {}
        for (const key of MATERIAL_STAGE_KEYS) {
          const pol = batchInspectionStages[key] || { mode: 'none' as const, planId: null }
          const mode = (pol.mode || 'none') as 'none' | 'simple' | 'plan'
          stages[key] = {
            mode,
            planId: mode === 'plan' ? Number(pol.planId) : null,
          }
        }
        patch.inspectionStages = stages
      }
      if (batchInspectionApplyOverReport) {
        patch.overReportMode = batchInspectionOverReportMode
        patch.overReportValue = batchInspectionOverReportValue
      }
      const uuids = selectedRowKeys.map((k) => String(k))
      const CHUNK = 200
      let updated = 0
      const failReasons: string[] = []
      for (let i = 0; i < uuids.length; i += CHUNK) {
        const chunk = uuids.slice(i, i + CHUNK)
        const res = await materialApi.bulkPatchInspection({
          items: chunk.map((materialUuid) => ({ materialUuid, ...patch })),
        })
        updated += Number(res.updated_count ?? 0)
        for (const f of res.failed_items ?? []) {
          if (f.reason) failReasons.push(f.reason)
        }
      }
      if (updated > 0) {
        messageApi.success(t('app.master-data.materials.batchInspectionSuccess', { count: updated }))
      }
      if (failReasons.length > 0) {
        messageApi.warning(
          t('app.master-data.materials.batchInspectionPartialFailed', {
            count: failReasons.length,
            reason: failReasons[0],
          }),
        )
      }
      if (updated === 0 && failReasons.length === 0) {
        messageApi.warning(t('app.master-data.materials.batchInspectionNoop'))
      }
      setBatchInspectionOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchInspectionFailed'))
      return Promise.reject()
    } finally {
      setBatchInspectionSubmitting(false)
    }
  }, [
    selectedRowKeys,
    batchInspectionApplyStages,
    batchInspectionStages,
    batchInspectionApplyOverReport,
    batchInspectionOverReportMode,
    batchInspectionOverReportValue,
    messageApi,
    t,
  ])

  const handleOpenBatchVariantModal = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBulkVariantMode('enable')
    setBatchVariantModalOpen(true)
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchVariant = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return Promise.reject()
    }

    const payload: MaterialBulkVariantPayload = {
      material_uuids: selectedRowKeys.map((k) => String(k)),
      variantManaged: bulkVariantMode === 'enable',
    }

    setBatchVariantSubmitting(true)
    try {
      const res = await materialApi.bulkUpdateVariant(payload)
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchVariantSuccess', { count: res.updated_count }),
        )
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(
          t('app.master-data.materials.batchVariantNotFound', { count: notFound }),
        )
      }
      setBatchVariantModalOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const detailMsg =
        typeof detail === 'string'
          ? detail
          : detail?.message ?? (typeof detail === 'object' ? detail?.detail : undefined)
      messageApi.error(detailMsg || e?.message || t('app.master-data.materials.batchVariantFailed'))
      throw e
    } finally {
      setBatchVariantSubmitting(false)
    }
  }, [selectedRowKeys, bulkVariantMode, messageApi, t])

  const handleOpenRewriteMainCodes = useCallback(() => {
    if (selectedRowKeys.length > 0) {
      setRewriteMainCodesScope('selected')
      setRewriteMainCodesOpen(true)
      return
    }
    if (selectedGroupIdRef.current != null && selectedGroupIdRef.current !== -1) {
      setRewriteMainCodesScope('group')
      setRewriteMainCodesOpen(true)
      return
    }
    messageApi.warning(t('app.master-data.materials.rewriteMainCodesSelectOrGroup'))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmRewriteMainCodes = useCallback(async () => {
    setRewriteMainCodesSubmitting(true)
    try {
      const payload =
        rewriteMainCodesScope === 'selected'
          ? { material_uuids: selectedRowKeys.map((k) => String(k)), reset_sequence: rewriteResetSequence }
          : { groupId: selectedGroupIdRef.current!, reset_sequence: rewriteResetSequence }
      const res = await materialApi.rewriteMainCodes(payload)
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.rewriteMainCodesSuccess', {
            families: res.updated_count,
            rows: res.updated_material_count,
          }),
        )
      }
      if (res.failed_count > 0) {
        messageApi.warning(
          t('app.master-data.materials.rewriteMainCodesPartialFail', { count: res.failed_count }),
        )
      }
      setRewriteMainCodesOpen(false)
      setRewriteResetSequence(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.rewriteMainCodesFailed'))
    } finally {
      setRewriteMainCodesSubmitting(false)
    }
  }, [rewriteMainCodesScope, rewriteResetSequence, selectedRowKeys, messageApi, t])

  const materialSourceTypeImportOptions = useMemo(
    () => buildMaterialSourceTypeImportOptions(t),
    [t, i18n.language],
  )

  const materialGroupImportOptions = useMemo(
    () => buildMaterialGroupImportOptions(materialGroups),
    [materialGroups],
  )

  const materialImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'mainCode', labelKey: 'app.master-data.materials.materialCode', aliases: ['物料编号', '编号'] },
          {
            field: 'name',
            required: true,
            labelKey: 'app.master-data.materials.materialName',
            aliases: ['物料名称', '名称'],
          },
          { field: 'baseUnit', required: true, labelKey: 'app.master-data.materials.baseUnit', aliases: ['基础单位', '单位'], options: importDropdownLabelsFromOptions(baseUnitOptions) },
          { field: 'specification', labelKey: 'app.master-data.materials.specification', aliases: ['规格'] },
          {
            field: 'sourceType',
            labelKey: 'app.master-data.materials.sourceType',
            aliases: ['物料类型'],
            options: materialSourceTypeImportOptions,
          },
          {
            field: 'groupCode',
            labelKey: 'app.master-data.materials.materialGroup',
            aliases: ['分组编号', '分组', '分类', '物料分类', '分组名称'],
            options: materialGroupImportOptions,
          },
          {
            field: 'variantManaged',
            labelKey: 'app.master-data.materials.importVariantManaged',
            aliases: ['启用属性管理'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'isActive',
            labelKey: 'app.master-data.materials.enabledStatus',
            aliases: ['是否启用', '启用状态', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'batchManaged',
            labelKey: 'app.master-data.materials.batchManaged',
            aliases: ['批号管理'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'serialManaged',
            labelKey: 'app.master-data.materialForm.serialManaged',
            aliases: ['序列号管理'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.master-data.materials.importExample.code'),
          t('app.master-data.materials.importExample.name'),
          pickImportExampleValue(
            importDropdownLabelsFromOptions(baseUnitOptions),
            t('app.master-data.materials.importExample.baseUnit'),
          ),
          '',
          pickImportExampleValue(
            materialSourceTypeImportOptions,
            t('app.master-data.materialForm.sourceMake'),
          ),
          materialGroupImportOptions[0] ?? t('app.master-data.materials.importExample.groupCode'),
          t('common.yes'),
          '是',
          '否',
          '否',
        ],
      ),
    [t, i18n.language, baseUnitOptions, materialSourceTypeImportOptions, materialGroupImportOptions],
  )

  const materialSkuImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'mainCode',
            required: true,
            labelKey: 'app.master-data.materials.materialCode',
            aliases: ['主编码', '物料编号', '编号'],
          },
          {
            field: 'variantAttributes',
            required: true,
            labelKey: 'app.master-data.materials.importSku.variantAttributes',
            aliases: ['属性组合'],
          },
          {
            field: 'isActive',
            labelKey: 'app.master-data.materials.enabledStatus',
            aliases: ['是否启用', '启用状态', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.master-data.materials.importExample.code'),
          t('app.master-data.materials.importSku.exampleVariantAttrs'),
          '是',
        ],
      ),
    [t, i18n.language],
  )

  const materialUnitsImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'mainCode',
            required: true,
            labelKey: 'app.master-data.materials.materialCode',
            aliases: ['主编码', '物料编号', '编号'],
          },
          {
            field: 'unit',
            required: true,
            labelKey: 'app.master-data.materials.importUnits.unit',
            aliases: ['辅助单位', '单位'],
          },
          {
            field: 'numerator',
            required: true,
            labelKey: 'app.master-data.materials.importUnits.numerator',
            aliases: ['换算分子'],
          },
          {
            field: 'denominator',
            required: true,
            labelKey: 'app.master-data.materials.importUnits.denominator',
            aliases: ['换算分母'],
          },
          {
            field: 'purchaseUnit',
            labelKey: 'app.master-data.materials.importUnits.purchaseUnit',
            aliases: ['采购单位'],
          },
          {
            field: 'saleUnit',
            labelKey: 'app.master-data.materials.importUnits.saleUnit',
            aliases: ['销售单位'],
          },
          {
            field: 'productionUnit',
            labelKey: 'app.master-data.materials.importUnits.productionUnit',
            aliases: ['生产单位'],
          },
          {
            field: 'inventoryUnit',
            labelKey: 'app.master-data.materials.importUnits.inventoryUnit',
            aliases: ['库存单位'],
          },
        ],
        ['M001', '箱', '12', '1', '', '', '', ''],
      ),
    [t, i18n.language],
  )

  const materialCustomerCodeImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'mainCode',
            required: true,
            labelKey: 'app.master-data.materials.materialCode',
            aliases: ['主编码', '物料编号', '编号'],
          },
          {
            field: 'customerCode',
            labelKey: 'app.master-data.codeMapping.customerCode',
            aliases: ['客户编码'],
          },
          {
            field: 'customerName',
            labelKey: 'app.master-data.codeMapping.customerLabel',
            aliases: ['客户名称'],
          },
          {
            field: 'customerPartCode',
            required: true,
            labelKey: 'app.master-data.materials.importCustomerCodes.partCode',
            aliases: ['客户料号'],
          },
          {
            field: 'customerPartName',
            labelKey: 'app.master-data.materials.importCustomerCodes.partName',
            aliases: ['客户物料名称'],
          },
          {
            field: 'description',
            labelKey: 'common.remark',
            aliases: ['描述'],
          },
        ],
        ['M001', 'C001', '', 'CUST-PART-001', '客户品名', ''],
      ),
    [t, i18n.language],
  )

  const materialDefaultsImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'mainCode',
            required: true,
            labelKey: 'app.master-data.materials.materialCode',
            aliases: ['主编码', '物料编号', '编号'],
          },
          {
            field: 'defaultTaxRate',
            labelKey: 'app.master-data.defaults.defaultTaxRate',
            aliases: ['默认税率', '税率', '默认税率(%)'],
          },
          {
            field: 'defaultWarehouseCodes',
            labelKey: 'app.master-data.materials.importDefaults.defaultWarehouseCodes',
            aliases: ['默认仓库编码', '默认仓库'],
          },
          {
            field: 'safetyStock',
            labelKey: 'app.master-data.defaults.safetyStock',
            aliases: ['安全库存'],
          },
          {
            field: 'maxStock',
            labelKey: 'app.master-data.defaults.maxStock',
            aliases: ['最高库存', '最大库存'],
          },
          {
            field: 'defaultSalePrice',
            labelKey: 'app.master-data.defaults.defaultSalePrice',
            aliases: ['默认销售价', '默认销售价格'],
          },
          {
            field: 'defaultLocation',
            labelKey: 'app.master-data.materials.importDefaults.defaultLocation',
            aliases: ['默认库位', '库位'],
          },
        ],
        ['M001', '13', 'WH01', '100', '1000', '99.9', 'A-01-01'],
      ),
    [t, i18n.language],
  )

  const materialInspectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'mainCode',
            required: true,
            labelKey: 'app.master-data.materials.materialCode',
            aliases: ['主编码', '物料编号', '编号'],
          },
          {
            field: 'iqcMode',
            labelKey: 'app.master-data.materials.importInspection.iqcMode',
            aliases: ['来料质检模式', 'IQC模式', 'IQC'],
          },
          {
            field: 'iqcPlanCode',
            labelKey: 'app.master-data.materials.importInspection.iqcPlanCode',
            aliases: ['来料质检方案编码', 'IQC方案编码', 'IQC方案'],
          },
          {
            field: 'fqcMode',
            labelKey: 'app.master-data.materials.importInspection.fqcMode',
            aliases: ['成品质检模式', 'FQC模式', 'FQC'],
          },
          {
            field: 'fqcPlanCode',
            labelKey: 'app.master-data.materials.importInspection.fqcPlanCode',
            aliases: ['成品质检方案编码', 'FQC方案编码', 'FQC方案'],
          },
          {
            field: 'oqcMode',
            labelKey: 'app.master-data.materials.importInspection.oqcMode',
            aliases: ['出货质检模式', 'OQC模式', 'OQC'],
          },
          {
            field: 'oqcPlanCode',
            labelKey: 'app.master-data.materials.importInspection.oqcPlanCode',
            aliases: ['出货质检方案编码', 'OQC方案编码', 'OQC方案'],
          },
          {
            field: 'overReportMode',
            labelKey: 'app.master-data.materials.importInspection.overReportMode',
            aliases: ['超报方式'],
          },
          {
            field: 'overReportValue',
            labelKey: 'app.master-data.materials.importInspection.overReportValue',
            aliases: ['超报数值'],
          },
        ],
        ['M001', '方案质检', 'IQC-001', '无质检', '', '无质检', '', '不允许', '0'],
      ),
    [t, i18n.language],
  )

  const activeImportTemplate = useMemo(() => {
    switch (activeImportKind) {
      case 'sku':
        return materialSkuImportTemplate
      case 'units':
        return materialUnitsImportTemplate
      case 'customerCodes':
        return materialCustomerCodeImportTemplate
      case 'defaults':
        return materialDefaultsImportTemplate
      case 'inspection':
        return materialInspectionImportTemplate
      case 'master':
      default:
        return materialImportTemplate
    }
  }, [
    activeImportKind,
    materialImportTemplate,
    materialSkuImportTemplate,
    materialUnitsImportTemplate,
    materialCustomerCodeImportTemplate,
    materialDefaultsImportTemplate,
    materialInspectionImportTemplate,
  ])

  const activeImportTitle = useMemo(() => {
    switch (activeImportKind) {
      case 'sku':
        return t('app.master-data.materials.importMenu.skuTitle')
      case 'units':
        return t('app.master-data.materials.importMenu.unitsTitle')
      case 'customerCodes':
        return t('app.master-data.materials.importMenu.customerCodesTitle')
      case 'defaults':
        return t('app.master-data.materials.importMenu.defaultsTitle')
      case 'inspection':
        return t('app.master-data.materials.importMenu.inspectionTitle')
      case 'master':
      default:
        return t('app.master-data.materials.importMenu.masterTitle')
    }
  }, [activeImportKind, t])

  const openMaterialImport = useCallback((kind: MaterialSplitImportKind) => {
    setActiveImportKind(kind)
    setImportModalVisible(true)
  }, [])

  const materialImportMenuButton = useMemo(() => {
    if (!canImport) return null
    return (
      <UniImportMenuButton
        key="material-import-menu"
        items={[
          {
            key: 'master',
            label: t('app.master-data.materials.importMenu.master'),
            onClick: () => openMaterialImport('master'),
          },
          {
            key: 'sku',
            label: t('app.master-data.materials.importMenu.sku'),
            onClick: () => openMaterialImport('sku'),
          },
          {
            key: 'units',
            label: t('app.master-data.materials.importMenu.units'),
            onClick: () => openMaterialImport('units'),
          },
          {
            key: 'customerCodes',
            label: t('app.master-data.materials.importMenu.customerCodes'),
            onClick: () => openMaterialImport('customerCodes'),
          },
          {
            key: 'defaults',
            label: t('app.master-data.materials.importMenu.defaults'),
            onClick: () => openMaterialImport('defaults'),
          },
          {
            key: 'inspection',
            label: t('app.master-data.materials.importMenu.inspection'),
            onClick: () => openMaterialImport('inspection'),
          },
        ]}
      />
    )
  }, [canImport, openMaterialImport, t])

  const showImportValidationErrors = useCallback(
    (errors: Array<{ row: number; message: string }>) => {
      getAntdModal().warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(e) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: e.row, message: e.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      })
    },
    [t],
  )

  const showImportPartialErrors = useCallback(
    (successCount: number, importErrors: Array<{ row: number; error: string }>) => {
      getAntdModal().warning({
        title: t('app.master-data.importPartialResultTitle'),
        width: 600,
        content: (
          <div>
            <p>
              <strong>
                {t('app.master-data.importPartialResultIntro', {
                  success: successCount,
                  failure: importErrors.length,
                })}
              </strong>
            </p>
            <List
              size="small"
              dataSource={importErrors}
              renderItem={(e) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: e.row, message: e.error })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      })
    },
    [t],
  )

  const ensureMasterVariantManaged = useCallback(async (master: Material) => {
    if (isVariantMasterMaterial(master)) return master
    await materialApi.update(master.uuid, {
      variantManaged: true,
      variantAttributes: null,
    } as MaterialUpdate)
    return materialApi.get(master.uuid)
  }, [])

  const clearGroupFilterAfterImport = useCallback(
    (importedGroupIds: number[]) => {
      const currentFilter = selectedGroupIdRef.current
      if (currentFilter == null || currentFilter === -1 || importedGroupIds.length === 0) {
        return false
      }
      if (importedGroupIds.includes(currentFilter)) {
        return false
      }
      selectedGroupIdRef.current = null
      setSelectedGroupId(null)
      setSelectedGroupKeys(['all'])
      messageApi.info(t('app.master-data.materials.importSwitchedToAll'))
      return true
    },
    [messageApi, t],
  )

  const handleMaterialImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const removedSkuCols = materialImportHasRemovedSkuColumns(headers)
    if (removedSkuCols.length > 0) {
      messageApi.error(
        t('app.master-data.materials.importSkuColumnsRemoved', {
          columns: removedSkuCols.join('、'),
        }),
      )
      return
    }

    const idx = buildMaterialImportColumnIndex(headers, materialImportTemplate.importHeaderMap)
    if (idx.name < 0 || idx.unit < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.importMasterRequiredFields'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    const groups = await materialGroupApi.list({ limit: 1000 })
    const groupList = Array.isArray(groups) ? groups : []
    const { items: masterItems, errors } = parseMaterialImportRows(
      rows.map((row) => {
        if (idx.unit < 0) return row;
        const copy = [...row];
        const raw = String(copy[idx.unit] ?? '').trim();
        if (raw) {
          copy[idx.unit] = parseImportOptionCell(raw, baseUnitOptions) ?? raw;
        }
        return copy;
      }),
      idx,
      (groupCode) => {
        const group = resolveMaterialGroupForImport(groupList, groupCode)
        return group?.id
      },
      3,
      t,
    )

    if (errors.length > 0) {
      getAntdModal().warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(e) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: e.row, message: e.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      })
      return
    }

    if (masterItems.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    const importErrors: Array<{ row: number; error: string }> = []
    let successCount = 0
    const title = t('app.master-data.materials.importTitle', { defaultValue: '正在导入物料' })

    try {
      const result = await importInChunks({
        items: masterItems,
        chunkSize: 100,
        title,
        showResultModal: false,
        rowNumberForIndex: (_i, item) => item.rowNum ?? _i + 1,
        importChunk: async (chunk) => {
          const res = await materialApi.bulkCreate(chunk.map((item) => item.data))
          return {
            createdCount: res.createdCount,
            failedItems: res.failedItems.map((f) => ({
              index: f.index,
              reason: f.reason || t('common.unknownError', { defaultValue: '未知错误' }),
            })),
          }
        },
      })
      successCount = result.successCount
      importErrors.push(...result.errors)

      const failureCount = importErrors.length
      if (failureCount > 0) {
        getAntdModal().warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.master-data.importPartialResultIntro', {
                    success: successCount,
                    failure: failureCount,
                  })}
                </strong>
              </p>
              {importErrors.length > 0 && (
                <List
                  size="small"
                  dataSource={importErrors}
                  renderItem={(e) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.rowError', { row: e.row, message: e.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        })
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }

      if (successCount > 0) {
        const importedGroupIds = [
          ...new Set(
            masterItems
              .map((item) => item.data.groupId)
              .filter((id): id is number => typeof id === 'number' && id > 0),
          ),
        ]
        clearGroupFilterAfterImport(importedGroupIds)
        await loadMaterialGroups()
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const handleMaterialSkuImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const idx = buildMaterialSkuImportColumnIndex(headers, materialSkuImportTemplate.importHeaderMap)
    if (idx.mainCode < 0 || idx.variantAttributes < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.importSku.requiredFields'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    const { items, errors } = parseMaterialSkuImportRows(rows, idx, 3, t)
    if (errors.length > 0) {
      showImportValidationErrors(errors)
      return
    }
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    for (const row of items) {
      for (const [attrName, attrValue] of Object.entries(row.variantAttributes)) {
        const result = await variantAttributeApi.validate({
          attribute_name: attrName,
          attribute_value: attrValue,
        })
        if (!result.is_valid) {
          showImportValidationErrors([
            {
              row: row.rowNum,
              message: result.error_message || attrName,
            },
          ])
          return
        }
      }
    }

    const masterCache = new Map<string, Material>()
    const importErrors: Array<{ row: number; error: string }> = []
    let successCount = 0

    try {
      const result = await importInChunksViaPerItemCreate({
        items,
        createOne: async (row, _index) => {
          let master = await resolveMasterByMainCode(row.mainCode, masterCache)
          if (!master) {
            throw new Error(
              t('app.master-data.materials.importSku.masterNotFound', { code: row.mainCode }),
            )
          }
          master = await ensureMasterVariantManaged(master)
          masterCache.set(pickMaterialMainCode(master).toUpperCase(), master)
          const materialized = await materialApi.materializeVariant({
            mainCode: pickMaterialMainCode(master),
            variantAttributes: row.variantAttributes,
            createIfMissing: true,
          })
          if (!row.isActive && materialized.material?.uuid) {
            await materialApi.update(materialized.material.uuid, { isActive: false })
          }
        },
        title: t('app.master-data.materials.importMenu.skuTitle'),
        chunkSize: 100,
        concurrency: 4,
      })
      successCount = result.successCount
      importErrors.push(
        ...result.errors.map((e) => ({
          row: items[e.row - 1]?.rowNum ?? e.row,
          error: e.error,
        })),
      )

      if (importErrors.length > 0) {
        showImportPartialErrors(successCount, importErrors)
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }
      if (successCount > 0) {
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const handleMaterialUnitsImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const idx = buildMaterialUnitsImportColumnIndex(headers, materialUnitsImportTemplate.importHeaderMap)
    if (idx.mainCode < 0 || idx.unit < 0 || idx.numerator < 0 || idx.denominator < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.importUnits.requiredFields'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    const { groups, errors } = parseMaterialUnitsImportRows(rows, idx, 3, t)
    if (errors.length > 0) {
      showImportValidationErrors(errors)
      return
    }
    if (groups.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    const masterCache = new Map<string, Material>()
    const importErrors: Array<{ row: number; error: string }> = []
    let successCount = 0

    try {
      const result = await importInChunksViaPerItemCreate({
        items: groups,
        chunkSize: 50,
        concurrency: 3,
        title: t('app.master-data.materials.importUnitsTitle', { defaultValue: '正在导入物料单位' }),
        showResultModal: false,
        rowNumberForIndex: (_i, g) => g.rowNums?.[0] ?? _i + 1,
        createOne: async (group) => {
          const master = await resolveMasterByMainCode(group.mainCode, masterCache)
          if (!master) {
            throw new Error(
              t('app.master-data.materials.importUnits.masterNotFound', { code: group.mainCode }),
            )
          }
          const full = await materialApi.get(master.uuid)
          const mergedUnits = mergeMaterialUnits(full.units, group)
          await materialApi.update(master.uuid, { units: mergedUnits })
        },
      })
      successCount = result.successCount
      result.failureItems.forEach((item, i) => {
        const g = item as (typeof groups)[number]
        const reason = result.errors[i]?.error || t('common.unknownError', { defaultValue: '未知错误' })
        const rows = g?.rowNums?.length ? g.rowNums : [result.errors[i]?.row ?? i + 1]
        for (const rowNum of rows) {
          importErrors.push({ row: rowNum, error: reason })
        }
      })

      if (importErrors.length > 0) {
        showImportPartialErrors(successCount, importErrors)
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }
      if (successCount > 0) {
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const handleMaterialCustomerCodesImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const idx = buildMaterialCustomerCodeImportColumnIndex(
      headers,
      materialCustomerCodeImportTemplate.importHeaderMap,
    )
    if (idx.mainCode < 0 || idx.customerPartCode < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.importCustomerCodes.requiredFields'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    let customers: Customer[] = []
    try {
      const result = await customerApi.list({ limit: 1000, isActive: true })
      customers = unwrapSupplyPagedList(result)
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.materialForm.fetchCustomersFailed'))
      return
    }

    const { groups, errors } = parseMaterialCustomerCodeImportRows(rows, idx, customers, 3, t)
    if (errors.length > 0) {
      showImportValidationErrors(errors)
      return
    }
    if (groups.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    const masterCache = new Map<string, Material>()
    const importErrors: Array<{ row: number; error: string }> = []
    let successCount = 0

    try {
      const result = await importInChunksViaPerItemCreate({
        items: groups,
        chunkSize: 50,
        concurrency: 3,
        title: t('app.master-data.materials.importCustomerCodesTitle', {
          defaultValue: '正在导入客户料号',
        }),
        showResultModal: false,
        rowNumberForIndex: (_i, g) => g.rowNums?.[0] ?? _i + 1,
        createOne: async (group) => {
          const master = await resolveMasterByMainCode(group.mainCode, masterCache)
          if (!master) {
            throw new Error(
              t('app.master-data.materials.importCustomerCodes.masterNotFound', {
                code: group.mainCode,
              }),
            )
          }
          const full = await materialApi.get(master.uuid)
          const existing = extractCustomerCodesFromMaterial(full)
          const merged = mergeCustomerCodes(existing, group.customerCodes)
          await materialApi.update(master.uuid, {
            customer_codes: merged
              .filter((code) => code.customerId > 0)
              .map((code) => ({
                customer_id: code.customerId,
                code: code.code,
                name: code.name,
                description: code.description,
              })),
          } as MaterialUpdate)
        },
      })
      successCount = result.successCount
      result.failureItems.forEach((item, i) => {
        const g = item as (typeof groups)[number]
        const reason = result.errors[i]?.error || t('common.unknownError', { defaultValue: '未知错误' })
        const rows = g?.rowNums?.length ? g.rowNums : [result.errors[i]?.row ?? i + 1]
        for (const rowNum of rows) {
          importErrors.push({ row: rowNum, error: reason })
        }
      })

      if (importErrors.length > 0) {
        showImportPartialErrors(successCount, importErrors)
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }
      if (successCount > 0) {
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const handleMaterialDefaultsImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const idx = buildMaterialDefaultsImportColumnIndex(
      headers,
      materialDefaultsImportTemplate.importHeaderMap,
    )
    if (idx.mainCode < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.materialCode'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    let warehouses: Warehouse[] = []
    try {
      const result = await warehouseApi.list({ limit: 1000, is_active: true })
      warehouses = result.items ?? []
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.materialForm.fetchWarehousesFailed'))
      return
    }

    const { items, errors } = parseMaterialDefaultsImportRows(rows, idx, warehouses, 3, t)
    if (errors.length > 0) {
      showImportValidationErrors(errors)
      return
    }
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    const masterCache = new Map<string, Material>()
    const importErrors: Array<{ row: number; error: string }> = []
    let successCount = 0

    try {
      const result = await importInChunksViaPerItemCreate({
        items,
        chunkSize: 100,
        concurrency: 4,
        title: t('app.master-data.materials.importDefaultsTitle', {
          defaultValue: '正在导入物料默认值',
        }),
        showResultModal: false,
        rowNumberForIndex: (_i, item) => item.rowNum ?? _i + 1,
        createOne: async (item) => {
          const master = await resolveMasterByMainCode(item.mainCode, masterCache)
          if (!master) {
            throw new Error(
              t('app.master-data.materials.importDefaults.masterNotFound', { code: item.mainCode }),
            )
          }
          await materialApi.bulkPatchDefaults({
            material_uuids: [master.uuid],
            ...item.patch,
          })
        },
      })
      successCount = result.successCount
      importErrors.push(...result.errors)

      if (importErrors.length > 0) {
        showImportPartialErrors(successCount, importErrors)
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }
      if (successCount > 0) {
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const handleMaterialInspectionImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const idx = buildMaterialInspectionImportColumnIndex(
      headers,
      materialInspectionImportTemplate.importHeaderMap,
    )
    if (idx.mainCode < 0) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: t('app.master-data.materials.materialCode'),
          headers: headers.join(', '),
        }),
      )
      return
    }

    let plans: Array<{
      id: number
      plan_code?: string
      planCode?: string
      plan_type?: string
      planType?: string
    }> = []
    try {
      const plansRes = await inspectionPlanApi.list({ skip: 0, limit: 2000 })
      plans = unwrapInspectionPlanList(plansRes).map((p) => {
        const row = p as Record<string, unknown>
        return {
          id: Number(row.id),
          plan_code: row.plan_code != null ? String(row.plan_code) : undefined,
          planCode: row.planCode != null ? String(row.planCode) : undefined,
          plan_type: row.plan_type != null ? String(row.plan_type) : undefined,
          planType: row.planType != null ? String(row.planType) : undefined,
        }
      })
    } catch (error: any) {
      messageApi.error(
        error?.message || t('app.master-data.materials.importInspection.fetchPlansFailed'),
      )
      return
    }

    const { items, errors } = parseMaterialInspectionImportRows(rows, idx, plans, 3, t)
    if (errors.length > 0) {
      showImportValidationErrors(errors)
      return
    }
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    const masterCache = new Map<string, Material>()
    const importErrors: Array<{ row: number; error: string }> = []
    const batchItems: Array<{
      materialUuid: string
      inspectionStages?: MaterialBulkInspectionPatchItem['inspectionStages']
      overReportMode?: MaterialBulkInspectionPatchItem['overReportMode']
      overReportValue?: number
      rowNum: number
    }> = []

    for (const item of items) {
      try {
        const master = await resolveMasterByMainCode(item.mainCode, masterCache)
        if (!master?.uuid) {
          throw new Error(
            t('app.master-data.materials.importInspection.masterNotFound', { code: item.mainCode }),
          )
        }
        batchItems.push({
          materialUuid: master.uuid,
          ...item.patch,
          rowNum: item.rowNum,
        })
      } catch (error: any) {
        importErrors.push({ row: item.rowNum, error: error?.message || String(error) })
      }
    }

    if (batchItems.length === 0) {
      showImportPartialErrors(0, importErrors)
      return
    }

    try {
      const CHUNK = 200
      let successCount = 0
      for (let i = 0; i < batchItems.length; i += CHUNK) {
        const chunk = batchItems.slice(i, i + CHUNK)
        const res = await materialApi.bulkPatchInspection({
          items: chunk.map(({ rowNum: _r, ...patch }) => patch),
        })
        successCount += Number(res.updated_count ?? 0)
        const failed = res.failed_items ?? []
        for (const f of failed) {
          const uuid = String(f.materialUuid ?? f.material_uuid ?? '')
          const src = chunk.find((c) => c.materialUuid === uuid)
          importErrors.push({
            row: src?.rowNum ?? 0,
            error: f.reason || t('app.master-data.importFailed', { defaultValue: '导入失败' }),
          })
        }
      }

      if (importErrors.length > 0) {
        showImportPartialErrors(successCount, importErrors)
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: successCount }))
      }
      if (successCount > 0) {
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed', { defaultValue: '导入失败' }))
    }
  }

  const runActiveMaterialImport = async (data: any[][]) => {
    switch (activeImportKind) {
      case 'sku':
        return handleMaterialSkuImport(data)
      case 'units':
        return handleMaterialUnitsImport(data)
      case 'customerCodes':
        return handleMaterialCustomerCodesImport(data)
      case 'defaults':
        return handleMaterialDefaultsImport(data)
      case 'inspection':
        return handleMaterialInspectionImport(data)
      case 'master':
      default:
        return handleMaterialImport(data)
    }
  }

  const handleMaterialImportPrecheck = useCallback(
    async (data: any[][]): Promise<ImportPrecheckResult> => {
      const rowErrorsToPrecheck = (errors: Array<{ row: number; message: string }>) => ({
        canImport: false,
        errors: errors.map((e) =>
          t('app.master-data.rowError', { row: e.row, message: e.message }),
        ),
      })

      if (!data || data.length < 2) {
        return { canImport: false, errors: [t('app.master-data.importEmpty')] }
      }
      const headers = (data[0] || []).map((h: any) => String(h || '').trim())
      const rows = data
        .slice(2)
        .filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
      if (rows.length === 0) {
        return { canImport: false, errors: [t('app.master-data.importNoRows')] }
      }

      const kind = activeImportKind ?? 'master'

      if (kind === 'master') {
        const removedSkuCols = materialImportHasRemovedSkuColumns(headers)
        if (removedSkuCols.length > 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.materials.importSkuColumnsRemoved', {
                columns: removedSkuCols.join('、'),
              }),
            ],
          }
        }
        const idx = buildMaterialImportColumnIndex(headers, materialImportTemplate.importHeaderMap)
        if (idx.name < 0 || idx.unit < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.importMasterRequiredFields'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        const groups = await materialGroupApi.list({ limit: 1000 })
        const groupList = Array.isArray(groups) ? groups : []
        const { items, errors } = parseMaterialImportRows(
          rows.map((row) => {
            if (idx.unit < 0) return row
            const copy = [...row]
            const raw = String(copy[idx.unit] ?? '').trim()
            if (raw) {
              copy[idx.unit] = parseImportOptionCell(raw, baseUnitOptions) ?? raw
            }
            return copy
          }),
          idx,
          (groupCode) => resolveMaterialGroupForImport(groupList, groupCode)?.id,
          3,
          t,
        )
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (items.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        return { canImport: true }
      }

      if (kind === 'sku') {
        const idx = buildMaterialSkuImportColumnIndex(headers, materialSkuImportTemplate.importHeaderMap)
        if (idx.mainCode < 0 || idx.variantAttributes < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.importSku.requiredFields'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        const { items, errors } = parseMaterialSkuImportRows(rows, idx, 3, t)
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (items.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        for (const row of items) {
          for (const [attrName, attrValue] of Object.entries(row.variantAttributes)) {
            const result = await variantAttributeApi.validate({
              attribute_name: attrName,
              attribute_value: attrValue,
            })
            if (!result.is_valid) {
              return rowErrorsToPrecheck([
                {
                  row: row.rowNum,
                  message: result.error_message || attrName,
                },
              ])
            }
          }
        }
        return { canImport: true }
      }

      if (kind === 'units') {
        const idx = buildMaterialUnitsImportColumnIndex(headers, materialUnitsImportTemplate.importHeaderMap)
        if (idx.mainCode < 0 || idx.unit < 0 || idx.numerator < 0 || idx.denominator < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.importUnits.requiredFields'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        const { groups, errors } = parseMaterialUnitsImportRows(rows, idx, 3, t)
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (groups.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        return { canImport: true }
      }

      if (kind === 'customerCodes') {
        const idx = buildMaterialCustomerCodeImportColumnIndex(
          headers,
          materialCustomerCodeImportTemplate.importHeaderMap,
        )
        if (idx.mainCode < 0 || idx.customerPartCode < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.importCustomerCodes.requiredFields'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        let customers: Customer[] = []
        try {
          const result = await customerApi.list({ limit: 1000, isActive: true })
          customers = unwrapSupplyPagedList(result)
        } catch (error: any) {
          return {
            canImport: false,
            errors: [error?.message || t('app.master-data.materialForm.fetchCustomersFailed')],
          }
        }
        const { groups, errors } = parseMaterialCustomerCodeImportRows(rows, idx, customers, 3, t)
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (groups.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        return { canImport: true }
      }

      if (kind === 'defaults') {
        const idx = buildMaterialDefaultsImportColumnIndex(
          headers,
          materialDefaultsImportTemplate.importHeaderMap,
        )
        if (idx.mainCode < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.materialCode'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        let warehouses: Warehouse[] = []
        try {
          const result = await warehouseApi.list({ limit: 1000, is_active: true })
          warehouses = result.items ?? []
        } catch (error: any) {
          return {
            canImport: false,
            errors: [error?.message || t('app.master-data.materialForm.fetchWarehousesFailed')],
          }
        }
        const { items, errors } = parseMaterialDefaultsImportRows(rows, idx, warehouses, 3, t)
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (items.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        return { canImport: true }
      }

      if (kind === 'inspection') {
        const idx = buildMaterialInspectionImportColumnIndex(
          headers,
          materialInspectionImportTemplate.importHeaderMap,
        )
        if (idx.mainCode < 0) {
          return {
            canImport: false,
            errors: [
              t('app.master-data.importMissingField', {
                field: t('app.master-data.materials.materialCode'),
                headers: headers.join(', '),
              }),
            ],
          }
        }
        let plans: Array<{
          id: number
          plan_code?: string
          planCode?: string
          plan_type?: string
          planType?: string
        }> = []
        try {
          const plansRes = await inspectionPlanApi.list({ skip: 0, limit: 2000 })
          plans = unwrapInspectionPlanList(plansRes).map((p) => {
            const row = p as Record<string, unknown>
            return {
              id: Number(row.id),
              plan_code: row.plan_code != null ? String(row.plan_code) : undefined,
              planCode: row.planCode != null ? String(row.planCode) : undefined,
              plan_type: row.plan_type != null ? String(row.plan_type) : undefined,
              planType: row.planType != null ? String(row.planType) : undefined,
            }
          })
        } catch (error: any) {
          return {
            canImport: false,
            errors: [
              error?.message || t('app.master-data.materials.importInspection.fetchPlansFailed'),
            ],
          }
        }
        const { items, errors } = parseMaterialInspectionImportRows(rows, idx, plans, 3, t)
        if (errors.length > 0) return rowErrorsToPrecheck(errors)
        if (items.length === 0) {
          return { canImport: false, errors: [t('app.master-data.importAllEmpty')] }
        }
        return { canImport: true }
      }

      return { canImport: true }
    },
    [
      activeImportKind,
      t,
      materialImportTemplate.importHeaderMap,
      materialSkuImportTemplate.importHeaderMap,
      materialUnitsImportTemplate.importHeaderMap,
      materialCustomerCodeImportTemplate.importHeaderMap,
      materialDefaultsImportTemplate.importHeaderMap,
      materialInspectionImportTemplate.importHeaderMap,
      baseUnitOptions,
    ],
  )

  const handleMaterialExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: Material[]) => {
    try {
      let toExport: Material[] = []
      if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid))
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData
      } else if (type === 'all') {
        const filter = lastListParamsRef.current
        toExport = await fetchAllListItems((p) =>
          materialApi.list({
            ...p,
            treeView: true,
            ...filter,
            ...(Object.keys(filter).length === 0
              ? selectedGroupId === -1
                ? { noGroup: true }
                : selectedGroupId != null
                  ? { groupId: selectedGroupId }
                  : {}
              : {}),
          }),
        )
      } else {
        toExport = await fetchAllListItems((p) =>
          materialApi.list({ ...p, groupId: selectedGroupId ?? undefined }),
        )
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'))
        return
      }
      const headers = [
        t('app.master-data.materials.materialCode'),
        t('app.master-data.materials.materialName'),
        t('app.master-data.materials.specification'),
        t('app.master-data.materials.baseUnit'),
        t('app.master-data.materials.sourceType'),
        t('common.status'),
        t('common.createdAt'),
      ]
      const csvRows = [headers.join(',')]
      toExport.forEach((r) => {
        const code = (r as any).mainCode || (r as any).code || ''
        const name = r.name || ''
        const spec = (r as any).specification || ''
        const unit = (r as any).baseUnit || ''
        const matType = (r as any).sourceType ?? (r as any).source_type ?? ''
        const isActive = r?.isActive ?? (r as any)?.is_active
        const status = isActive ? t('common.enabled') : t('common.disabled')
        const createdAt = formatDateTimeBySiteSetting(
          r.createdAt ?? (r as any).created_at,
          '',
        )
        csvRows.push(
          [code, name, spec, unit, matType, status, createdAt]
            .map((c) => {
              const s = String(c ?? '')
              return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
            })
            .join(',')
        )
      })
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
      downloadFile(blob, `materials_${todaySiteDateString()}.csv`)
      messageApi.success(t('common.exportSuccess', { count: toExport.length }))
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'))
    }
  }

  const resolveFabricationWizardMaterial = async (
    saved: Material,
    formValues: Record<string, unknown>,
  ): Promise<FabricationMaterialRef | null> => {
    if (!isFabricationFromValues(formValues) || !saved.id) return null
    try {
      const needsSetup = await fabricationMaterialNeedsRawMaterialSetup(saved.id)
      return needsSetup ? toFabricationMaterialRef(saved) : null
    } catch {
      return null
    }
  }

  const handleMaterialSubmit = async (values: any) => {
    const editingUuid = currentMaterial?.uuid || editRouteUuid
    try {
      setMaterialFormLoading(true)

      let saved: Material
      if (isEditPage && editingUuid) {
        await materialApi.update(editingUuid, values as MaterialUpdate)
        saved = await materialApi.get(editingUuid)
        messageApi.success(t('common.updateSuccess'))
      } else {
        saved = await materialApi.create(values as MaterialCreate)
        messageApi.success(t('common.createSuccess'))
      }

      const wizardMaterial = await resolveFabricationWizardMaterial(saved, values)
      navigateClosingTab(
        navigate,
        MATERIAL_LIST_PATH,
        uniTabKey(location.pathname, location.search),
        {
          reloadMaterials: true,
          ...(wizardMaterial ? { openFabricationWizard: wizardMaterial } : {}),
        },
      )
      return saved
    } catch (error: any) {
      messageApi.error(error.message || (isEditPage ? t('common.updateFailed') : t('common.createFailed')))
      throw error
    } finally {
      setMaterialFormLoading(false)
    }
  }

  /**
   * 获取物料分组名称
   */
  const getMaterialGroupName = useCallback((groupId?: number): string => {
    if (!groupId) return '-'
    const group = materialGroups.find(g => g.id === groupId)
    return group?.name?.trim() ? group.name.trim() : `${t('app.master-data.materials.materialGroup')} ID: ${groupId}`
  }, [materialGroups, t])

  /** 详情抽屉「基本信息」字段顺序（uni-detail + detailDrawerDescriptionItems） */
  const materialDetailBasicColumns = useMemo<ProDescriptionsItemProps<Material>[]>(
    () => [
      {
        title: t('app.master-data.materials.materialCode'),
        dataIndex: 'mainCode',
        key: 'code',
        render: (_, record) => {
          const val =
            (record as any).mainCode ?? (record as any).main_code ?? (record as any).code ?? '-'
          if (val === '-') return '-'
          return (
            <Typography.Text copyable={{ text: String(val) }} style={{ marginRight: 0 }}>
              {val}
            </Typography.Text>
          )
        },
      },
      {
        title: t('app.master-data.materials.materialName'),
        dataIndex: 'name',
      },
      {
        title: t('app.master-data.materials.materialGroup'),
        dataIndex: 'groupId',
        render: (_, record) => getMaterialGroupName(record.groupId),
      },
      {
        title: t('app.master-data.materials.processRoute'),
        dataIndex: 'processRouteName',
        render: (_, record) =>
          (record as any).processRouteName ?? (record as any).process_route_name ?? '-',
      },
      {
        title: t('app.master-data.materials.specification'),
        dataIndex: 'specification',
      },
      {
        title: t('app.master-data.materials.baseUnit'),
        dataIndex: 'baseUnit',
      },
      {
        title: t('app.master-data.materials.brand'),
        dataIndex: 'brand',
      },
      {
        title: t('app.master-data.materials.model'),
        dataIndex: 'model',
      },
      {
        title: t('app.master-data.materials.texture'),
        dataIndex: 'texture',
      },
      {
        title: t('app.master-data.materialForm.weight'),
        dataIndex: 'weight',
        render: (_, record) => {
          const v = record.weight ?? (record as any).weight
          return v != null && Number(v) !== 0 ? String(v) : '-'
        },
      },
      {
        title: t('app.master-data.materialForm.volume'),
        dataIndex: 'volume',
        render: (_, record) => {
          const v = record.volume ?? (record as any).volume
          return v != null && Number(v) !== 0 ? String(v) : '-'
        },
      },
      {
        title: t('app.master-data.materialForm.barcode'),
        dataIndex: 'barcode',
      },
      {
        title: t('app.master-data.materialForm.referenceCost'),
        dataIndex: 'referenceCost',
        render: (_, record) => {
          const v = record.referenceCost ?? (record as any).reference_cost
          return v != null && v !== '' ? String(v) : '-'
        },
      },
      {
        title: t('app.master-data.materialForm.shelfLifeManaged'),
        dataIndex: 'shelfLifeManaged',
        render: (_, record) => {
          const managed =
            record.shelfLifeManaged ?? (record as any).shelf_life_managed ?? false
          const days = record.shelfLifeDays ?? (record as any).shelf_life_days
          if (!managed) {
            return renderMasterYesNoTag(t, false, 'common.yes', 'common.no')
          }
          if (days != null) {
            return (
              <span>
                {t('common.yes')} - {days}
                {t('app.master-data.materialForm.shelfLifeDayUnit')}
              </span>
            )
          }
          return renderMasterYesNoTag(t, true, 'common.yes', 'common.no')
        },
      },
      {
        title: t('app.master-data.materialForm.isGiftable'),
        dataIndex: 'isGiftable',
        render: (_, record) => {
          const giftable = record.isGiftable ?? (record as any).is_giftable ?? false
          return renderMasterYesNoTag(t, giftable, 'common.yes', 'common.no')
        },
      },
      {
        title: t('app.master-data.materialForm.countryOfOrigin'),
        dataIndex: 'countryOfOrigin',
        render: (_, record) =>
          record.countryOfOrigin ?? (record as any).country_of_origin ?? '-',
      },
      {
        title: t('app.master-data.materialForm.customsCode'),
        dataIndex: 'customsCode',
        render: (_, record) => record.customsCode ?? (record as any).customs_code ?? '-',
      },
      {
        title: t('app.master-data.materials.batchManaged'),
        dataIndex: 'batchManaged',
        render: (_, record) =>
          renderMasterYesNoTag(t, record.batchManaged, 'common.yes', 'common.no'),
      },
      {
        title: t('app.master-data.materials.variantManaged'),
        dataIndex: 'variantManaged',
        render: (_, record) =>
          renderMasterYesNoTag(t, record.variantManaged, 'common.yes', 'common.no'),
      },
      {
        title: t('common.remark'),
        dataIndex: 'description',
      },
      {
        title: t('app.master-data.materials.enabledStatusLabel'),
        dataIndex: 'isActive',
        render: (_, record) =>
          renderMasterActiveTag(
            t,
            record.isActive,
            'common.enabled',
            'common.disabled',
          ),
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'createdAt',
        valueType: 'dateTime',
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updatedAt',
        valueType: 'dateTime',
      },
    ],
    [t, getMaterialGroupName]
  )

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<Material>[]>(
    () => [
      {
        title: t('app.master-data.materials.colMaterialPrimary'),
        key: 'mainCode',
        dataIndex: 'mainCode',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        sorter: true,
        render: (_, record) => (
          <MaterialListStackedCell record={record} variantAttrLabelMap={variantAttrLabelMap} />
        ),
      },
      {
        title: t('app.master-data.materials.materialCode'),
        dataIndex: ['mainCode', 'code'],
        hideInTable: true,
      },
      {
        title: t('app.master-data.materials.materialName'),
        dataIndex: 'name',
        hideInTable: true,
      },
      {
        title: t('app.master-data.materials.specification'),
        dataIndex: 'specification',
        hideInTable: true,
        ellipsis: true,
      },
      {
        title: t('app.master-data.materials.productImage'),
        dataIndex: 'images',
        width: 72,
        minWidth: 72,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, record) => {
          if (isVariantSkuMaterial(record)) return null
          const images = (record as any).images || [];
          if (images.length > 0) {
            const firstImage = images[0];
            const fileUuid = firstImage.uid ?? firstImage.uuid ?? (typeof firstImage === 'string' ? firstImage : null);
            if (fileUuid) {
              return (
                <MaterialAttachmentThumb
                  fileUuid={fileUuid}
                  alt={firstImage.name || t('app.master-data.materials.image')}
                />
              );
            }
            if (firstImage.url) {
              return (
                <SecureImage
                  src={firstImage.url}
                  alt={firstImage.name || t('app.master-data.materials.image')}
                  width={40}
                  height={40}
                  preview={{ src: firstImage.url }}
                />
              );
            }
          }
          return '-';
        },
      },
      {
        title: t('app.master-data.materials.materialGroup'),
        dataIndex: 'groupId',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        valueType: 'select',
        valueEnum: materialGroups.reduce(
          (acc, group) => {
            acc[group.id] = { text: group.name }
            return acc
          },
          {} as Record<number, { text: string }>
        ),
        render: (_, record) => renderMasterCell(record, getMaterialGroupName(record.groupId)),
      },
      {
        title: t('app.master-data.materials.colProcessRouteSource'),
        key: 'processRouteSource',
        dataIndex: ['processRouteName', 'process_route_name'],
        minWidth: 140,
        uniTablePrimaryFlex: true,
        uniTablePrimaryFlexMaxWidth: 220,
        resizable: false,
        hideInSearch: true,
        render: (_, record) =>
          renderMasterCell(
            record,
            <UniTableStackedPrimaryCell
              primary={getMaterialSourceTypeLabel(record, sourceTypeOptions)}
              secondary={getMaterialProcessRouteName(record)}
              secondaryCopyable={false}
            />,
          ),
      },
      {
        title: t('app.master-data.materials.processRoute'),
        dataIndex: ['processRouteName', 'process_route_name'],
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.master-data.materials.sourceType'),
        dataIndex: 'sourceType',
        hideInTable: true,
        valueType: 'select',
        valueEnum: sourceTypeOptions.reduce(
          (acc, option) => {
            acc[option.value] = { text: option.label }
            return acc
          },
          {} as Record<string, { text: string }>
        ),
        fieldProps: {
          showSearch: true,
          allowClear: true,
        },
      },
      {
        title: t('app.master-data.materials.baseUnit'),
        dataIndex: 'baseUnit',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        valueEnum: baseUnitOptions.reduce(
          (acc, option) => {
            acc[option.value] = { text: option.label }
            return acc
          },
          {} as Record<string, { text: string }>
        ),
        fieldProps: {
          loading: loadingBaseUnitOptions,
          showSearch: true,
          allowClear: true,
        },
        render: (_, record) => {
          if (isVariantSkuMaterial(record)) return null
          const option = baseUnitOptions.find(opt => opt.value === record.baseUnit)
          return option ? option.label : record.baseUnit || '-'
        },
      },
      {
        title: t('app.master-data.materials.batchManaged'),
        dataIndex: 'batchManaged',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, record) =>
          renderMasterCell(
            record,
            renderMasterYesNoTag(
              t,
              record.batchManaged,
              'common.yes',
              'common.no',
            ),
          ),
      },
      {
        title: t('app.master-data.materials.variantManaged'),
        dataIndex: 'variantManaged',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, record) => {
          if (isVariantSkuMaterial(record)) return null
          return renderMasterYesNoTag(
            t,
            record.variantManaged,
            'common.yes',
            'common.no',
          )
        },
      },
      {
        title: t('app.master-data.materials.brand'),
        dataIndex: 'brand',
        hideInTable: true,
      },
      {
        title: t('app.master-data.materials.model'),
        dataIndex: 'model',
        hideInTable: true,
      },
      {
        title: t('app.master-data.materials.enabledStatus'),
        dataIndex: 'isActive',
        hideInTable: true,
        order: 20,
        valueType: 'select',
        valueEnum: materialActiveValueEnum,
        fieldProps: { allowClear: true },
      },
      {
        title: t('app.master-data.materials.enabledStatus'),
        dataIndex: 'isActive',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        hideInSearch: true,
        valueEnum: materialActiveValueEnum,
        render: (_, record) =>
          renderMasterCell(
            record,
            renderMasterActiveTag(
              t,
              record.isActive,
              'common.enabled',
              'common.disabled',
            ),
          ),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updatedAt',
        ...UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => {
          const preferred = resolveMaterialAuditDisplay(record as unknown as Record<string, unknown>);
          return renderMasterCell(
            record,
            <UniTableStackedPrimaryCell
              primary={preferred.operator}
              secondary={preferred.time}
              secondaryCopyable={false}
              primaryBold={false}
            />,
          );
        },
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 30,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 31,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleViewMaterial(record)}>
              {t('common.detail')}
            </Button>
            <Button key="edit" {...rowActionKind('update')}
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditMaterial(record)}
            >
              {t('common.edit')}
            </Button>
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.materials.deleteMaterialConfirm')}
              description={t('app.master-data.materials.deleteMaterialDesc')}
              onConfirm={() => handleDeleteMaterial(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      t,
      materialGroups,
      getMaterialGroupName,
      sourceTypeOptions,
      variantAttrLabelMap,
      baseUnitOptions,
      loadingBaseUnitOptions,
      messageApi,
      token,
      materialActiveValueEnum,
      handleViewMaterial,
      handleEditMaterial,
      handleDeleteMaterial,
    ]
  )

  if (isFormPage) {
    const createGroupIdRaw = searchParams.get('groupId')
    const createGroupId = createGroupIdRaw != null ? Number(createGroupIdRaw) : NaN
    const formPageTitle = isCreatePage
      ? t('app.master-data.menu.materials.management.new')
      : t('app.master-data.menu.materials.management.edit')
    const retryFormPage = () => {
      formPageInitializedRef.current = false
      setFormPageError(null)
      if (editRouteUuid) {
        void (async () => {
          formPageInitializedRef.current = true
          try {
            setMaterialFormLoading(true)
            const detail = await materialApi.get(editRouteUuid)
            setCurrentMaterial(detail)
          } catch (error) {
            setCurrentMaterial(null)
            setFormPageError(getApiErrorMessage(error, t('app.master-data.materials.getDetailFailed')))
          } finally {
            setMaterialFormLoading(false)
          }
        })()
      }
    }
    if (isEditPage && (materialFormLoading || formPageError || !currentMaterial)) {
      return (
        <DocumentFormPageLayout
          header={
            <Space align="center" size={8}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={leaveMaterialFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {formPageTitle}
              </Typography.Title>
            </Space>
          }
        >
          {formPageError ? (
            <Result
              status="error"
              title={formPageError}
              extra={
                <Button type="primary" onClick={retryFormPage}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              }
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <Spin />
            </div>
          )}
        </DocumentFormPageLayout>
      )
    }
    return (
      <MaterialForm
        asPage
        open
        onClose={leaveMaterialFormPage}
        onFinish={handleMaterialSubmit}
        isEdit={isEditPage}
        material={currentMaterial || undefined}
        materialGroups={materialGroups}
        onMaterialGroupsChange={loadMaterialGroups}
        loading={materialFormLoading}
        onOpenExistingMaterial={handleOpenMaterialForEdit}
        initialValues={
          materialRestoreInitialValues
            ?? (isCreatePage ? getSuspendedModal()?.formData : undefined)
            ?? (isEditPage && currentMaterial
              ? buildMaterialEditFormValues(currentMaterial)
              : buildMaterialCreateFormValues(
                  Number.isFinite(createGroupId) && createGroupId > 0
                    ? createGroupId
                    : selectedGroupId,
                ))
        }
      />
    )
  }

  return (
    <>
      <TwoColumnLayout
        leftPanel={{
          collapsed: leftPanelCollapsed,
          search: {
            placeholder: t('app.master-data.materials.searchGroup'),
            value: groupSearchValue,
            onChange: setGroupSearchValue,
            allowClear: true,
          },
          actions: [
            <div key="group-actions" style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ flex: 1 }}
                onClick={handleCreateGroup}
              >
                {t('app.master-data.materials.createGroup')}
              </Button>
              <Button
                icon={expandedKeys.length > 1 ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={handleToggleExpand}
                title={expandedKeys.length > 1 ? t('app.master-data.materials.collapseAll') : t('app.master-data.materials.expandAll')}
              />
            </div>,
          ],
          tree: {
            className: 'material-group-tree',
            showLine: true,
            icon: renderMaterialGroupFolderIcon,
            treeData:
              filteredGroupTreeData.length > 0 || !groupSearchValue.trim()
                ? filteredGroupTreeData
                : groupTreeData,
            selectedKeys: selectedGroupKeys,
            expandedKeys: expandedKeys,
            onSelect: handleGroupSelect,
            onExpand: handleGroupExpand,
            showIcon: true,
            blockNode: true,
            loading: materialGroupsLoading,
            loadingTip: t('app.master-data.materials.loadingGroups'),
            titleRender: (node) => {
              const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
              if (!searchLabel) return node.title
              return (
                <span className="material-group-tree-title-text">{searchLabel}</span>
              )
            },
            onRightClick: info => {
              const key = info.node.key as string
              if (key !== 'all' && key !== 'no-group') {
                const groupId = parseInt(key)
                const group = materialGroups.find(g => g.id === groupId)
                handleGroupContextMenu(info.event as any, group || null)
              }
            },
          },
          width: 320,
          minWidth: 200,
        }}
        rightPanel={{
          // header removed as per request to only show material list
          content: (
            <div
              style={{
                ['--uni-table-scroll-offset' as string]: `${LIST_PAGE_TABLE_SCROLL.BASE_OFFSET_PX + (2 * LIST_PAGE_TABLE_SCROLL.GAP_PX)}px`,
              }}
            >
              <UniTable<Material>
                columnPersistenceId="apps.master-data.pages.materials.management.list-v2"
                tanstackQuery={{ queryKeyPrefix: ['apps.master-data.pages.materials.management', String(selectedGroupKeys[0] ?? 'all')] }}
                size="small"
                defaultPageSize={20}
                actionRef={actionRef}
                columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
                beforeSearchButtons={
                  <Tooltip title={leftPanelCollapsed ? t('app.master-data.materials.expandGroup') : t('app.master-data.materials.collapseGroup')}>
                    <Button
                      icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                      onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                      style={{ marginRight: 8 }}
                    />
                  </Tooltip>
                }
                headerActions={
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMaterial}>
                      {t('app.master-data.materials.createMaterial') + NEW_SHORTCUT_HINT}
                    </Button>
                    {trialRunMode && (
                    <Button icon={<RedoOutlined />} onClick={handleOpenRewriteMainCodes}>
                      {t('app.master-data.materials.rewriteMainCodes')}
                    </Button>
                    )}
                    <UniBatchSplitToolbar
                      selectedRowKeys={selectedRowKeys}
                      onDelete={executeBatchDelete}
                      deleteButtonText={t('common.batchDelete')}
                      confirmTitle={(count) =>
                        t('app.master-data.materials.batchDeleteConfirm', { count })
                      }
                      confirmDescription={t('app.master-data.materials.deleteMaterialDesc')}
                      menuItems={[
                        {
                          key: 'moveGroup',
                          label: t('app.master-data.materials.batchMoveGroup'),
                          icon: <SwapOutlined />,
                          onClick: () => handleOpenBatchMoveGroup(),
                        },
                        {
                          key: 'batchTracking',
                          label: t('app.master-data.materials.batchTrackingToolbar'),
                          icon: <TagsOutlined />,
                          onClick: () => handleOpenBatchSerialModal(),
                        },
                        {
                          key: 'batchProcessRoute',
                          label: t('app.master-data.materials.batchProcessRoute'),
                          icon: <NodeIndexOutlined />,
                          onClick: () => handleOpenBatchProcessRoute(),
                        },
                        {
                          key: 'batchSourceType',
                          label: t('app.master-data.materials.batchSourceType'),
                          icon: <PartitionOutlined />,
                          onClick: () => handleOpenBatchSourceType(),
                        },
                        {
                          key: 'batchDefaults',
                          label: t('app.master-data.materials.batchDefaults'),
                          icon: <SettingOutlined />,
                          onClick: () => handleOpenBatchDefaults(),
                        },
                        {
                          key: 'batchInspection',
                          label: t('app.master-data.materials.batchInspection'),
                          icon: <SafetyCertificateOutlined />,
                          onClick: () => handleOpenBatchInspection(),
                        },
                        {
                          key: 'batchVariant',
                          label: t('app.master-data.materials.batchVariantToolbar'),
                          icon: <ClusterOutlined />,
                          onClick: () => handleOpenBatchVariantModal(),
                        },
                      ]}
                    />
                    <MaterialDedupConfigTrigger customFields={customFields} />
                    <MaterialHealthAssistantTrigger
                      groupId={healthCheckGroupId}
                      onOpenMaterial={handleOpenMaterialForEdit}
                    />
                  </Space>
                }
                request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
                const treeGroupId = selectedGroupIdRef.current
                const listParams = resolveMaterialListParams(searchFormValues, sort, {
                  noGroup: treeGroupId === -1,
                  groupId: treeGroupId != null && treeGroupId !== -1 ? treeGroupId : undefined,
                })
                lastListParamsRef.current = listParams

                const apiParams: Record<string, unknown> = {
                  skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                  limit: params.pageSize || 20,
                  treeView: true,
                  ...listParams,
                }

                try {
                  const { items, total } = await materialApi.list(apiParams as any)
                  const listItems = items || []
                  const enriched = meta?.purpose === 'prefetch'
                    ? listItems
                    : await enrichRecordsWithCustomFields(listItems)
                  return {
                    data: enriched,
                    success: true,
                    total: total,
                  }
                } catch (error: any) {
                  console.error(t('app.master-data.materials.getListFailed'), error)
                  messageApi.error(error?.message || t('app.master-data.materials.getListFailed'))
                  return {
                    data: [],
                    success: false,
                    total: 0,
                  }
                }
                }}
                rowKey="uuid"
                defaultExpandAllRows
                showAdvancedSearch={true}
                skipFuzzyPinyinClientFilter
                pinnedTabsField={MATERIAL_PINNED_ACTIVE_FIELD}
                toolBarRender={() => []}
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }}
                showImportButton={false}
                rightToolBarActionsBeforeExport={materialImportMenuButton ? [materialImportMenuButton] : undefined}
                showExportButton={true}
                onExport={handleMaterialExport}
              />
            </div>
          ),
        }}
      />

      <Modal
        title={
          <Space>
            <RedoOutlined style={{ color: token.colorPrimary }} />
            <span>{t('app.master-data.materials.rewriteMainCodesTitle')}</span>
          </Space>
        }
        open={rewriteMainCodesOpen}
        onCancel={() => {
          if (!rewriteMainCodesSubmitting) {
            setRewriteMainCodesOpen(false)
            setRewriteResetSequence(false)
          }
        }}
        onOk={handleConfirmRewriteMainCodes}
        confirmLoading={rewriteMainCodesSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={
              rewriteMainCodesScope === 'selected'
                ? t('app.master-data.materials.rewriteMainCodesHintSelected', {
                    count: selectedRowKeys.length,
                  })
                : t('app.master-data.materials.rewriteMainCodesHintGroup')
            }
            description={t('app.master-data.materials.rewriteMainCodesDesc')}
          />
          <Checkbox
            checked={rewriteResetSequence}
            onChange={(e) => setRewriteResetSequence(e.target.checked)}
          >
            <Space orientation="vertical" size={0}>
              <span>{t('app.master-data.materials.rewriteResetSequence')}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('app.master-data.materials.rewriteResetSequenceDesc')}
              </Typography.Text>
            </Space>
          </Checkbox>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchMoveGroupTitle')}
        open={batchMoveGroupOpen}
        onCancel={() => {
          if (!batchMoveGroupSubmitting) setBatchMoveGroupOpen(false)
        }}
        onOk={handleConfirmBatchMoveGroup}
        confirmLoading={batchMoveGroupSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchMoveGroupHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchMoveGroupSelect')}
            </Typography.Text>
            <TreeSelect
              showSearch
              allowClear
              treeLine
              treeDefaultExpandAll
              placeholder={t('app.master-data.materials.batchMoveGroupSelect')}
              style={{ width: '100%' }}
              value={batchMoveGroupId}
              onChange={(v) => setBatchMoveGroupId(v as number | undefined)}
              treeData={batchMoveGroupTreeData}
              loading={materialGroupsLoading}
              treeNodeFilterProp="title"
              popupMatchSelectWidth={false}
              styles={{ popup: { root: { maxHeight: 360, overflow: 'auto' } } }}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchProcessRouteTitle')}
        open={batchProcessRouteOpen}
        onCancel={() => {
          if (!batchProcessRouteSubmitting) setBatchProcessRouteOpen(false)
        }}
        onOk={handleConfirmBatchProcessRoute}
        confirmLoading={batchProcessRouteSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchProcessRouteHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchProcessRouteSelect')}
            </Typography.Text>
            <Select
              showSearch
              allowClear
              placeholder={t('app.master-data.source.selectProcessRoute')}
              style={{ width: '100%' }}
              value={batchProcessRouteId}
              onChange={(v) => setBatchProcessRouteId(v as number | undefined)}
              loading={processRoutesForBulkLoading}
              options={processRoutesForBulk.map((r) => ({
                label: `${r.code} ${r.name}`.trim(),
                value: r.id,
              }))}
              optionFilterProp="label"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {t('app.master-data.materials.batchProcessRouteClearHint')}
            </Typography.Text>
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchSourceTypeTitle')}
        open={batchSourceTypeOpen}
        onCancel={() => {
          if (!batchSourceTypeSubmitting) setBatchSourceTypeOpen(false)
        }}
        onOk={handleConfirmBatchSourceType}
        confirmLoading={batchSourceTypeSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchSourceTypeHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchSourceTypeSelect')}
            </Typography.Text>
            <Select
              showSearch
              placeholder={t('app.master-data.materialForm.sourceTypePlaceholder')}
              style={{ width: '100%' }}
              value={batchSourceTypeValue}
              onChange={(v) => setBatchSourceTypeValue(v)}
              options={sourceTypeOptions}
              optionFilterProp="label"
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchDefaultsTitle')}
        open={batchDefaultsOpen}
        onCancel={() => {
          if (!batchDefaultsSubmitting) setBatchDefaultsOpen(false)
        }}
        onOk={handleConfirmBatchDefaults}
        confirmLoading={batchDefaultsSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchDefaultsHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Checkbox
              checked={batchDefaultsApplyTax}
              onChange={(e) => setBatchDefaultsApplyTax(e.target.checked)}
              disabled={batchDefaultsSubmitting}
            >
              {t('app.master-data.materials.batchDefaultsApplyTax')}
            </Checkbox>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              disabled={!batchDefaultsApplyTax || batchDefaultsSubmitting}
              placeholder={t('app.master-data.defaults.defaultTaxRatePlaceholder')}
              value={batchDefaultsTaxRate}
              onChange={(v) => setBatchDefaultsTaxRate(v)}
              options={[
                { label: t('app.master-data.defaults.taxRate0'), value: 0 },
                { label: t('app.master-data.defaults.taxRate3'), value: 3 },
                { label: t('app.master-data.defaults.taxRate6'), value: 6 },
                { label: t('app.master-data.defaults.taxRate9'), value: 9 },
                { label: t('app.master-data.defaults.taxRate13'), value: 13 },
              ]}
            />
          </div>
          <div>
            <Checkbox
              checked={batchDefaultsApplyWarehouse}
              onChange={(e) => setBatchDefaultsApplyWarehouse(e.target.checked)}
              disabled={batchDefaultsSubmitting}
            >
              {t('app.master-data.materials.batchDefaultsApplyWarehouse')}
            </Checkbox>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 8 }}
              disabled={!batchDefaultsApplyWarehouse || batchDefaultsSubmitting}
              placeholder={t('app.master-data.defaults.selectWarehouses')}
              value={batchDefaultsWarehouseIds}
              onChange={(v) => setBatchDefaultsWarehouseIds(v)}
              loading={warehousesForBulkLoading}
              options={warehousesForBulk.map((w) => ({
                label: `${w.code} - ${w.name}`,
                value: w.id,
              }))}
              optionFilterProp="label"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {t('app.master-data.materials.batchDefaultsClearWarehouse')}
            </Typography.Text>
          </div>
          <div>
            <Checkbox
              checked={batchDefaultsApplySafetyStock}
              onChange={(e) => setBatchDefaultsApplySafetyStock(e.target.checked)}
              disabled={batchDefaultsSubmitting}
            >
              {t('app.master-data.materials.batchDefaultsApplySafetyStock')}
            </Checkbox>
            <InputNumber
              style={{ width: '100%', marginTop: 8 }}
              min={0}
              disabled={!batchDefaultsApplySafetyStock || batchDefaultsSubmitting}
              placeholder={t('app.master-data.defaults.safetyStockPlaceholder')}
              value={batchDefaultsSafetyStock}
              onChange={(v) => setBatchDefaultsSafetyStock(v ?? undefined)}
            />
          </div>
          <div>
            <Checkbox
              checked={batchDefaultsApplyMaxStock}
              onChange={(e) => setBatchDefaultsApplyMaxStock(e.target.checked)}
              disabled={batchDefaultsSubmitting}
            >
              {t('app.master-data.materials.batchDefaultsApplyMaxStock')}
            </Checkbox>
            <InputNumber
              style={{ width: '100%', marginTop: 8 }}
              min={0}
              disabled={!batchDefaultsApplyMaxStock || batchDefaultsSubmitting}
              placeholder={t('app.master-data.defaults.maxStockPlaceholder')}
              value={batchDefaultsMaxStock}
              onChange={(v) => setBatchDefaultsMaxStock(v ?? undefined)}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchInspectionTitle')}
        open={batchInspectionOpen}
        onCancel={() => {
          if (!batchInspectionSubmitting) setBatchInspectionOpen(false)
        }}
        onOk={handleConfirmBatchInspection}
        confirmLoading={batchInspectionSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchInspectionHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Checkbox
              checked={batchInspectionApplyStages}
              onChange={(e) => setBatchInspectionApplyStages(e.target.checked)}
              disabled={batchInspectionSubmitting}
            >
              {t('app.master-data.materials.batchInspectionApplyStages')}
            </Checkbox>
            <div
              style={{
                marginTop: 8,
                opacity: batchInspectionApplyStages ? 1 : 0.45,
                pointerEvents: batchInspectionApplyStages ? 'auto' : 'none',
              }}
            >
              <InspectionStagesEditor
                scope="material"
                value={batchInspectionStages}
                onChange={setBatchInspectionStages}
              />
            </div>
          </div>
          <div>
            <Checkbox
              checked={batchInspectionApplyOverReport}
              onChange={(e) => setBatchInspectionApplyOverReport(e.target.checked)}
              disabled={batchInspectionSubmitting}
            >
              {t('app.master-data.materials.batchInspectionApplyOverReport')}
            </Checkbox>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              disabled={!batchInspectionApplyOverReport || batchInspectionSubmitting}
              value={batchInspectionOverReportMode}
              onChange={(v) => setBatchInspectionOverReportMode(v)}
              options={[
                { label: t('field.operation.overReportModeNone'), value: 'none' },
                { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
                { label: t('field.operation.overReportModePercent'), value: 'percent' },
              ]}
            />
            <InputNumber
              style={{ width: '100%', marginTop: 8 }}
              min={0}
              disabled={
                !batchInspectionApplyOverReport ||
                batchInspectionSubmitting ||
                batchInspectionOverReportMode === 'none'
              }
              value={batchInspectionOverReportValue}
              onChange={(v) => setBatchInspectionOverReportValue(Number(v) || 0)}
              placeholder={t('field.operation.overReportValue')}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {t('field.operation.overReportValueExtra')}
            </Typography.Text>
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchVariantTitle')}
        open={batchVariantModalOpen}
        onCancel={() => {
          if (!batchVariantSubmitting) setBatchVariantModalOpen(false)
        }}
        onOk={handleConfirmBatchVariant}
        confirmLoading={batchVariantSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchVariantHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchVariantMode')}
            </Typography.Text>
            <Segmented
              block
              value={bulkVariantMode}
              onChange={(v) => setBulkVariantMode(v as 'enable' | 'disable')}
              disabled={batchVariantSubmitting}
              options={[
                { label: t('app.master-data.materials.batchVariantEnable'), value: 'enable' },
                { label: t('app.master-data.materials.batchVariantDisable'), value: 'disable' },
              ]}
            />
          </div>
          {bulkVariantMode === 'enable' && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('app.master-data.materials.batchVariantEnableHint')}
            </Typography.Paragraph>
          )}
          {bulkVariantMode === 'disable' && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('app.master-data.materials.batchVariantDisableHint')}
            </Typography.Paragraph>
          )}
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.batchTrackingTitle')}
        open={batchSerialModalOpen}
        onCancel={() => {
          if (!batchSerialSubmitting) setBatchSerialModalOpen(false)
        }}
        onOk={handleConfirmBatchSerial}
        confirmLoading={batchSerialSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchTrackingAlertTitle', {
              count: selectedRowKeys.length,
            })}
            description={t('app.master-data.materials.batchTrackingHint')}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('common.actions')}
            </Typography.Text>
            <Segmented
              block
              size="large"
              value={bulkTrackingMode}
              onChange={(v) => setBulkTrackingMode(v as 'enable' | 'disable')}
              disabled={batchSerialSubmitting || bulkRuleOptionsLoading}
              options={[
                { label: t('app.master-data.materials.batchTrackingEnable'), value: 'enable' },
                { label: t('app.master-data.materials.batchTrackingDisable'), value: 'disable' },
              ]}
            />
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                size="small"
                variant="borderless"
                style={{
                  background: token.colorFillAlter,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
                title={
                  <Space>
                    <BarcodeOutlined style={{ color: token.colorPrimary }} />
                    <span>{t('app.master-data.materials.batchTrackingCardBatch')}</span>
                  </Space>
                }
                extra={
                  <Checkbox
                    checked={bulkApplyBatch}
                    onChange={(e) => setBulkApplyBatch(e.target.checked)}
                    disabled={batchSerialSubmitting}
                  >
                    {t('app.master-data.materials.batchTrackingIncludeDimension')}
                  </Checkbox>
                }
              >
                {bulkTrackingMode === 'disable' && bulkApplyBatch && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, marginTop: 0 }}>
                    {t('app.master-data.materials.batchTrackingDisableBatchHint')}
                  </Typography.Paragraph>
                )}
                {bulkTrackingMode === 'enable' && bulkApplyBatch && (
                  <>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      {t('app.master-data.materials.batchTrackingDefaultBatchRule')}
                    </Typography.Text>
                    <Select
                      style={{ width: '100%' }}
                      loading={bulkRuleOptionsLoading}
                      disabled={batchSerialSubmitting}
                      value={bulkBatchRuleId}
                      onChange={(v) => setBulkBatchRuleId(v)}
                      options={[
                        {
                          label: t('app.master-data.materialForm.systemDefaultRule'),
                          value: SYSTEM_DEFAULT_BATCH_SERIAL_RULE,
                        },
                        ...batchRulesForBulk.map((r) => ({
                          label: `${r.code} ${r.name}`.trim(),
                          value: r.id,
                        })),
                      ]}
                      showSearch
                      optionFilterProp="label"
                    />
                  </>
                )}
                {bulkApplyBatch && bulkTrackingMode === 'enable' && !bulkRuleOptionsLoading && batchRulesForBulk.length === 0 && (
                  <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {t('app.master-data.materials.batchTrackingNoCustomRulesBatch')}
                  </Typography.Text>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                size="small"
                variant="borderless"
                style={{
                  background: token.colorFillAlter,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
                title={
                  <Space>
                    <NumberOutlined style={{ color: token.colorPrimary }} />
                    <span>{t('app.master-data.materials.batchTrackingCardSerial')}</span>
                  </Space>
                }
                extra={
                  <Checkbox
                    checked={bulkApplySerial}
                    onChange={(e) => setBulkApplySerial(e.target.checked)}
                    disabled={batchSerialSubmitting}
                  >
                    {t('app.master-data.materials.batchTrackingIncludeDimension')}
                  </Checkbox>
                }
              >
                {bulkTrackingMode === 'disable' && bulkApplySerial && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, marginTop: 0 }}>
                    {t('app.master-data.materials.batchTrackingDisableSerialHint')}
                  </Typography.Paragraph>
                )}
                {bulkTrackingMode === 'enable' && bulkApplySerial && (
                  <>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      {t('app.master-data.materials.batchTrackingDefaultSerialRule')}
                    </Typography.Text>
                    <Select
                      style={{ width: '100%' }}
                      loading={bulkRuleOptionsLoading}
                      disabled={batchSerialSubmitting}
                      value={bulkSerialRuleId}
                      onChange={(v) => setBulkSerialRuleId(v)}
                      options={[
                        {
                          label: t('app.master-data.materialForm.systemDefaultRule'),
                          value: SYSTEM_DEFAULT_BATCH_SERIAL_RULE,
                        },
                        ...serialRulesForBulk.map((r) => ({
                          label: `${r.code} ${r.name}`.trim(),
                          value: r.id,
                        })),
                      ]}
                      showSearch
                      optionFilterProp="label"
                    />
                  </>
                )}
                {bulkApplySerial && bulkTrackingMode === 'enable' && !bulkRuleOptionsLoading && serialRulesForBulk.length === 0 && (
                  <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {t('app.master-data.materials.batchTrackingNoCustomRulesSerial')}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      </Modal>

      {standardPresetFeatureEnabled && (
      <Modal
        title={t('app.master-data.materials.standardPresetModalTitle')}
        open={standardPresetOpen}
        onCancel={() => !standardPresetSubmitting && setStandardPresetOpen(false)}
        width={960}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" disabled={standardPresetSubmitting} onClick={() => setStandardPresetOpen(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('skip')}
            key="ok"
            type="primary"
            loading={standardPresetSubmitting}
            disabled={
              standardPresetSelectedKeys.length === 0 ||
              (standardPresetGroupMode === 'single' && !standardPresetGroupUuid)
            }
            onClick={async () => {
              try {
                setStandardPresetSubmitting(true)
                const res = await materialApi.loadStandardPartsPreset({
                  presetKeys: standardPresetSelectedKeys,
                  codeMode: standardPresetCodeMode,
                  groupMode: standardPresetGroupMode,
                  ...(standardPresetGroupMode === 'single'
                    ? { materialGroupUuid: standardPresetGroupUuid }
                    : standardPresetParentGroupUuid
                      ? { parentMaterialGroupUuid: standardPresetParentGroupUuid }
                      : {}),
                })
                messageApi.success(res.message)
                setStandardPresetOpen(false)
                actionRef.current?.reload()
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'))
              } finally {
                setStandardPresetSubmitting(false)
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              {t('app.master-data.materials.standardPresetSectionImportSettings')}
            </Typography.Title>
            <Card
              size="small"
              bordered={false}
              style={{ background: token.colorFillAlter }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    {t('app.master-data.materials.standardPresetMaterialAssignLabel')}
                  </Typography.Text>
                  <Row gutter={[12, 12]} align="middle" wrap>
                    <Col flex="none">
                      <Segmented<'single' | 'preset_by_category'>
                        size="middle"
                        value={standardPresetGroupMode}
                        onChange={(v) => {
                          setStandardPresetGroupMode(v)
                          if (v === 'single') {
                            if (selectedGroupId != null) {
                              const g = materialGroups.find((x) => x.id === selectedGroupId)
                              setStandardPresetGroupUuid(g?.uuid ?? '')
                            } else {
                              setStandardPresetGroupUuid('')
                            }
                          }
                          if (v === 'preset_by_category') {
                            setStandardPresetParentGroupUuid('')
                          }
                        }}
                        options={[
                          { label: t('app.master-data.materials.standardPresetGroupModeSingle'), value: 'single' },
                          {
                            label: t('app.master-data.materials.standardPresetGroupModePresetCategories'),
                            value: 'preset_by_category',
                          },
                        ]}
                      />
                    </Col>
                    <Col xs={24} sm={24} md={14} lg={15} flex="1 1 220px">
                      {standardPresetGroupMode === 'single' ? (
                        <Select
                          style={{ width: '100%' }}
                          placeholder={t('app.master-data.materials.standardPresetTargetGroupPlaceholder')}
                          value={standardPresetGroupUuid || undefined}
                          onChange={(v) => setStandardPresetGroupUuid(v)}
                          options={materialGroups.map((g) => ({
                            value: g.uuid,
                            label: formatMaterialGroupLabel(g),
                          }))}
                          showSearch
                          optionFilterProp="label"
                          loading={materialGroupsLoading}
                        />
                      ) : (
                        <Select
                          style={{ width: '100%' }}
                          allowClear
                          placeholder={t('app.master-data.materials.standardPresetParentGroupPlaceholder')}
                          value={standardPresetParentGroupUuid || undefined}
                          onChange={(v) => setStandardPresetParentGroupUuid((v ?? '') as string)}
                          options={materialGroups.map((g) => ({
                            value: g.uuid,
                            label: formatMaterialGroupLabel(g),
                          }))}
                          showSearch
                          optionFilterProp="label"
                          loading={materialGroupsLoading}
                        />
                      )}
                    </Col>
                  </Row>
                </div>

                <div>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    {t('app.master-data.materials.standardPresetCodeMode')}
                  </Typography.Text>
                  <Segmented<'auto' | 'gb'>
                    size="middle"
                    value={standardPresetCodeMode}
                    onChange={(v) => setStandardPresetCodeMode(v)}
                    options={[
                      { label: t('app.master-data.materials.standardPresetCodeAuto'), value: 'auto' },
                      { label: t('app.master-data.materials.standardPresetCodeGb'), value: 'gb' },
                    ]}
                  />
                </div>
              </Space>
            </Card>
          </div>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              {t('app.master-data.materials.standardPresetSectionPickItems')}
            </Typography.Title>
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetIndustryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetIndustryAll')}
                  value={standardPresetIndustryId || undefined}
                  options={standardPresetIndustryOptions}
                  onChange={(v) => {
                    const nextIndustry = (v ?? '') as string
                    setStandardPresetIndustryId(nextIndustry)
                    setStandardPresetCategoryId('')
                    setStandardPresetPrimaryId('')
                    const rows = nextIndustry
                      ? standardPresetFlatRows.filter((r) => r.industryId === nextIndustry)
                      : standardPresetFlatRows
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetPrimaryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetPrimaryAll')}
                  value={standardPresetPrimaryId || undefined}
                  options={standardPresetPrimaryOptions}
                  onChange={(v) => {
                    const nextPrimary = (v ?? '') as string
                    setStandardPresetPrimaryId(nextPrimary)
                    setStandardPresetCategoryId('')
                    const rows = standardPresetFlatRows.filter((r) => {
                      if (standardPresetIndustryId && r.industryId !== standardPresetIndustryId) return false
                      if (nextPrimary) return r.primaryCategory === nextPrimary
                      return true
                    })
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetSecondaryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetSecondaryAll')}
                  value={standardPresetCategoryId || undefined}
                  options={standardPresetSecondaryOptions}
                  onChange={(v) => {
                    const nextId = (v ?? '') as string
                    setStandardPresetCategoryId(nextId)
                    let rows = standardPresetFlatRows.filter((r) =>
                      standardPresetIndustryId ? r.industryId === standardPresetIndustryId : true
                    )
                    if (nextId) rows = rows.filter((r) => r.categoryId === nextId)
                    else if (standardPresetPrimaryId) rows = rows.filter((r) => r.primaryCategory === standardPresetPrimaryId)
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
            </Row>
          </div>
          <Table<StandardPartFlatRow>
            size="small"
            rowKey="presetKey"
            dataSource={standardPresetFilteredRows}
            pagination={false}
            scroll={{ y: 360 }}
            rowSelection={{
              selectedRowKeys: standardPresetSelectedKeys,
              onChange: (keys) => setStandardPresetSelectedKeys(keys as string[]),
            }}
            columns={[
              {
                title: t('app.master-data.materials.standardPresetColCategory'),
                key: 'presetType',
                width: 168,
                ellipsis: true,
                render: (_, r) => {
                  const pLabel = t(`app.master-data.materials.standardPresetPrimary.${r.primaryCategory}`, {
                    defaultValue: r.primaryCategory,
                  })
                  return `${r.industryName} / ${pLabel} / ${r.categoryName}`
                },
              },
              { title: t('app.master-data.materials.materialName'), dataIndex: 'name', width: 140, ellipsis: true },
              {
                title: t('app.master-data.materials.specification'),
                dataIndex: 'specification',
                width: 100,
                ellipsis: true,
              },
              {
                title: t('app.master-data.materials.standardPresetColGbStandard'),
                dataIndex: 'gbStandard',
                width: 100,
                ellipsis: true,
              },
              {
                title: t('app.master-data.materials.standardPresetColGbCode'),
                dataIndex: 'gbCode',
                width: 160,
                ellipsis: true,
              },
              { title: t('app.master-data.materials.baseUnit'), dataIndex: 'baseUnit', width: 72 },
            ]}
          />
        </Space>
      </Modal>
      )}

      <MaterialGroupFormModal
        open={groupModalVisible}
        onClose={handleCloseGroupModal}
        onSuccess={handleGroupFormSuccess}
        isEdit={groupIsEdit}
        group={currentGroup}
        parentIdPreset={groupParentIdPreset}
        materialGroups={materialGroups}
      />

      <MasterDataDetailDrawer
        title={t('app.master-data.materials.materialDetail')}
        open={materialDrawerVisible}
        onClose={() => {
          setMaterialDrawerVisible(false)
          setCurrentMaterial(null)
          setLinkedDrawings([])
          setMaterialDetailError(null)
        }}
        loading={materialDetailLoading}
        error={materialDetailError}
        onRetry={() => {
          const uuid = materialRetryUuidRef.current
          if (uuid) void loadMaterialDetail(uuid)
        }}
        extra={
          currentMaterial
            ? buildDetailDrawerEditExtra(t, true, () => {
                void handleEditMaterial(currentMaterial)
              })
            : null
        }
        detail={currentMaterial}
        detailColumns={materialDetailBasicColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        basicExtra={
          currentMaterial ? (
            <QRCodeGenerator
              qrcodeType="MAT"
              data={{
                material_uuid: currentMaterial.uuid,
                material_code: currentMaterial.mainCode || currentMaterial.code || '',
                material_name: currentMaterial.name,
              }}
              autoGenerate={true}
              showCardTitle={false}
              size={6}
              noCard={true}
            />
          ) : undefined
        }
        lines={
          currentMaterial &&
          (!!currentMaterial.variantManaged ||
            !!(currentMaterial.variantAttributes ?? (currentMaterial as any)?.variant_attributes)) ? (
            <MaterialVariantSkusPanel
              masterMaterial={currentMaterial}
              onRefresh={() => actionRef.current?.reload()}
            />
          ) : undefined
        }
        linesTitle={t('app.master-data.materials.variantSkusSection', '属性 SKU（预组合）')}
        supplementaryTitle={t('app.master-data.materials.linkedDrawings')}
        supplementary={
          currentMaterial ? (
            linkedDrawingsLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : linkedDrawings.length ? (
              <Table<EngineeringDrawing>
                size="small"
                rowKey="uuid"
                pagination={false}
                dataSource={linkedDrawings}
                columns={[
                  {
                    title: t('app.master-data.drawings.code'),
                    dataIndex: 'code',
                    width: 120,
                  },
                  {
                    title: t('app.master-data.drawings.name'),
                    dataIndex: 'name',
                    ellipsis: true,
                  },
                  {
                    title: t('app.master-data.drawings.revision'),
                    dataIndex: 'revision',
                    width: 72,
                  },
                  {
                    title: t('common.actions'),
                    width: 88,
                    render: (_, row) => (
                      <Button
                        type="link"
                        size="small"
                        {...rowActionKind('read')}
                        onClick={() =>
                          window.open(
                            `/apps/master-data/process/drawings?uuid=${encodeURIComponent(row.uuid)}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        {t('common.detail')}
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <span style={{ color: token.colorTextSecondary }}>
                {t('app.master-data.materials.noLinkedDrawings')}
              </span>
            )
          ) : undefined
        }
      />

      {/* 分组右键菜单 */}
      {contextMenuVisible && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
          }}
          onClick={() => setContextMenuVisible(false)}
        >
          <Menu
            items={materialGroupContextMenuItems}
            onClick={({ key }) => {
              switch (key) {
                case 'edit':
                  if (contextMenuGroup) {
                    handleEditGroup(contextMenuGroup)
                  }
                  break
                case 'delete':
                  if (contextMenuGroup) {
                    handleDeleteGroup(contextMenuGroup)
                  }
                  break
                case 'create':
                  handleCreateGroup()
                  break
                case 'createSub':
                  if (contextMenuGroup) {
                    handleCreateSubGroup(contextMenuGroup)
                  }
                  break
              }
              setContextMenuVisible(false)
            }}
          />
        </div>
      )}

      <FabricationRawMaterialWizard
        open={fabricationWizardOpen}
        onClose={() => {
          setFabricationWizardOpen(false)
          setFabricationWizardMaterial(null)
        }}
        fabricationMaterial={fabricationWizardMaterial}
        onSuccess={() => {
          actionRef.current?.reload()
        }}
      />

      {canImport && importModalVisible && activeImportKind && (
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            title={activeImportTitle}
            onCancel={() => {
              setImportModalVisible(false)
              setActiveImportKind(null)
            }}
            onConfirm={async (data) => {
              const result = await Promise.resolve(runActiveMaterialImport(data))
              if (result === false) return false
              setImportModalVisible(false)
              setActiveImportKind(null)
              actionRef.current?.reload()
              return undefined
            }}
            headers={activeImportTemplate.importHeaders}
            exampleRow={activeImportTemplate.importExampleRow}
            columnOptions={activeImportTemplate.importColumnOptions}
            importFieldMap={activeImportTemplate.importHeaderMap}
            enableXlsxTemplate
            enableMappingImport
            enableImportPreview
            onImportPrecheck={handleMaterialImportPrecheck}
            templateDocumentName={t('app.master-data.materials.importMenu.templateDocumentName')}
          />
        </Suspense>
      )}

    </>
  )
}

export default MaterialsManagementPage
