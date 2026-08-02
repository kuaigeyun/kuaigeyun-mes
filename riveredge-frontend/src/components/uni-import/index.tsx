/**
 * Univer Import 导入弹窗组件
 * 
 * 使用 Univer Sheet 进行 Excel 数据导入
 * 已从 Luckysheet 迁移到 Univer Sheet
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal, Button, Space, App, Upload } from 'antd';
import type { UploadProps } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { relayoutUniverSheet, type UniverSheetInstance } from '../univer/bootstrap-sheet';
import { buildImportTemplateFileName } from './build-import-template-file-name';
import { UniImportSheetHost } from './uni-import-sheet-host';
import { downloadImportTemplateXlsx, parseImportXlsxFile } from './uni-import-xlsx';
import { UniImportMappingModal } from './uni-import-mapping-modal';
import {
  UniImportCustomModal,
  normalizeRelationEntities,
  type UniImportCustomModalApplyResult,
} from './uni-import-custom-modal';
import {
  type UniRelationImportConfig,
  type UniRelationImportEntity,
  type UniRelationImportWriteStrategy,
  type UniRelationImportResult,
} from './uni-import-relation-types';
import {
  UniImportPreviewModal,
  type ImportPrecheckResult,
} from './uni-import-preview-modal';
import { getImportDataRows } from './import-preview-utils';
import { translatePathTitle } from '../../utils/menuTranslation';
import { resolveSystemFieldKey } from './apply-import-mapping';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import ErrorBoundary from '../error-boundary';

/** Univer dispose / 上传重建竞态：内部异步仍可能访问已卸载 workbook */
function isUniverImportDisposeRaceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    msg.includes('getSheetBySheetId') ||
    msg.includes('workbook is null') ||
    msg.includes("Failed to execute 'removeChild' on 'Node'")
  );
}

/**
 * UniImport 导入弹窗。
 *
 * 矩阵约定（与后端 POST …/import 的 data 一致）：
 * - 行 0：表头（必填列可用 * 前缀）
 * - 行 1：示例行（提交时跳过）
 * - 行 2+：实际数据
 *
 * 确认导入只读取 sheet-host 同步的字符串矩阵（上传 / 粘贴 / 初始模板），禁止从 Univer scrape。
 * 列表页接入须经 UniTable：showImportButton + onImport + importHeaders/exampleRow/fieldMap。
 * 禁止用 onImport 仅打开第二个弹窗。
 */
export interface UniImportProps {
  /**
   * 弹窗是否可见
   */
  visible?: boolean;
  /**
   * 弹窗是否可见 (Ant Design 5+)
   */
  open?: boolean;
  /**
   * 关闭弹窗回调
   */
  onCancel: () => void;
  /**
   * 确认导入回调
   * @param data - 导入的数据（二维数组格式）
   * @returns false 表示未成功，保留预检/导入弹窗
   */
  onConfirm: (data: any[][]) => void | boolean | Promise<void | boolean>;
  /**
   * 弹窗标题（默认：'导入数据'）
   */
  title?: string;
  /**
   * 弹窗宽度（默认：1200）
   */
  width?: string | number;
  /**
   * 弹窗内容区高度（默认：620；表格宿主撑满 body）
   */
  height?: number;
  /**
   * 是否显示确认按钮（默认：true）
   */
  showConfirmButton?: boolean;
  /**
   * 是否显示取消按钮（默认：true）
   */
  showCancelButton?: boolean;
  /**
   * 确认按钮文本（默认：'确认导入'）
   */
  confirmText?: string;
  /**
   * 取消按钮文本（默认：'取消'）
   */
  cancelText?: string;
  /**
   * 表头数据（可选，如果提供则自动填充第一行）
   */
  headers?: string[];
  /**
   * 示例数据（可选，如果提供则自动填充第二行作为示例）
   */
  exampleRow?: string[];
  /**
   * 与 headers 等长的列下拉选项；某列有值时示例行与数据区启用列表下拉
   */
  columnOptions?: Array<string[] | undefined>;
  /**
   * 当前单据/页面名称，用于生成下载文件名（如「账户管理 - 导入模板.xlsx」）
   */
  templateDocumentName?: string;
  /**
   * 下载的 xlsx 模板完整文件名（传入时优先于 templateDocumentName）
   */
  templateFileName?: string;
  /**
   * 是否显示「下载模板 / 上传 Excel」（默认：有 headers 时开启）
   */
  enableXlsxTemplate?: boolean;
  /**
   * 表头名称 → 字段名，用于映射导入时同名字段自动匹配
   */
  importFieldMap?: Record<string, string>;
  /**
   * 是否显示「映射导入」（默认：有 headers 时开启）
   */
  enableMappingImport?: boolean;
  /**
   * 是否显示「自定义导入」（默认：有 headers 时开启）
   */
  enableCustomImport?: boolean;
  /**
   * 是否显示「高级关联导入」（默认：onRelationImportSubmit 存在时开启）
   */
  enableRelationImport?: boolean;
  /**
   * 高级关联导入配置
   */
  relationImportConfig?: UniRelationImportConfig;
  /**
   * 关联导入预检
   */
  onRelationImportPrecheck?: (payload: {
    rawRows: string[][];
    entities: UniRelationImportEntity[];
    writeStrategy: UniRelationImportWriteStrategy;
  }) => Promise<UniRelationImportResult | void>;
  /**
   * 关联导入提交
   */
  onRelationImportSubmit?: (payload: {
    rawRows: string[][];
    entities: UniRelationImportEntity[];
    writeStrategy: UniRelationImportWriteStrategy;
  }) => Promise<UniRelationImportResult | void>;
  /**
   * 自定义导入字段偏好键（不传时使用当前 pathname）
   */
  customImportPreferenceKey?: string;
  /**
   * 确认入库前是否展示预检预览（默认：true）
   */
  enableImportPreview?: boolean;
  /**
   * 预检预览最多展示的数据行数（默认：10）
   */
  importPreviewMaxRows?: number;
  /**
   * 数据行起始下标（默认：2，即跳过表头与示例行，与业务 slice(2) 一致）
   */
  importDataStartRow?: number;
  /**
   * 入库前服务端/业务预检（返回 errors 时将阻止确认入库）
   */
  onImportPrecheck?: (data: any[][]) => Promise<ImportPrecheckResult | void>;
}

/**
 * Univer Import 导入弹窗组件
 */
export const UniImport: React.FC<UniImportProps> = ({
  visible,
  open,
  onCancel,
  onConfirm,
  title,
  width = 1200,
  height = 620,
  showConfirmButton = true,
  showCancelButton = true,
  confirmText,
  cancelText,
  headers,
  exampleRow,
  columnOptions,
  templateDocumentName,
  templateFileName,
  enableXlsxTemplate,
  importFieldMap,
  enableMappingImport,
  enableCustomImport,
  enableRelationImport,
  relationImportConfig,
  onRelationImportPrecheck,
  onRelationImportSubmit,
  customImportPreferenceKey,
  enableImportPreview = true,
  importPreviewMaxRows = 10,
  importDataStartRow = 2,
  onImportPrecheck,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('components.uniImport.defaultTitle');
  const resolvedConfirmText = confirmText ?? t('components.uniImport.confirmImport');
  const resolvedCancelText = cancelText ?? t('components.uniImport.cancel');
  const location = useLocation();
  const getPreference = useUserPreferenceStore((s) => s.getPreference);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  /** 上传/映射后的表格行；变更时 useLayoutEffect 同步重建 Univer 工作簿 */
  const [uploadedSheetRows, setUploadedSheetRows] = useState<string[][] | null>(null);
  /** 确认导入必须读 ref：避免闭包/预览路径绕过上传原文导致 toPrecision 截断 */
  const uploadedSheetRowsRef = useRef<string[][] | null>(null);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingRawRows, setMappingRawRows] = useState<string[][]>([]);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customImportFieldKeys, setCustomImportFieldKeys] = useState<string[] | null>(null);
  const [customRelationEntities, setCustomRelationEntities] = useState<UniRelationImportEntity[]>(
    relationImportConfig?.entities ?? ['material', 'processRoute', 'operation', 'performance'],
  );
  const [customWriteStrategy, setCustomWriteStrategy] = useState<UniRelationImportWriteStrategy>(
    relationImportConfig?.defaultWriteStrategy ?? 'upsert',
  );
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<ImportPrecheckResult | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const univerInstanceRef = useRef<UniverSheetInstance | null>(null);
  const headersRef = useRef<string[] | undefined>(headers);
  const exampleRowRef = useRef<string[] | undefined>(exampleRow);
  const importFieldMapRef = useRef(importFieldMap);
  importFieldMapRef.current = importFieldMap;

  const allFieldKeys = useMemo(
    () => (headers ?? []).map((h) => resolveSystemFieldKey(h, importFieldMapRef.current)),
    [headers],
  );
  const selectedImportFieldKeys = useMemo(
    () => (customImportFieldKeys && customImportFieldKeys.length > 0 ? customImportFieldKeys : allFieldKeys),
    [customImportFieldKeys, allFieldKeys],
  );
  const fieldKeyToIndex = useMemo(() => {
    const map = new Map<string, number>();
    (headers ?? []).forEach((header, idx) => {
      map.set(resolveSystemFieldKey(header, importFieldMapRef.current), idx);
    });
    return map;
  }, [headers]);
  const effectiveHeaders = useMemo(() => {
    if (!headers?.length) return headers;
    const orderedIndexes = selectedImportFieldKeys
      .map((key) => fieldKeyToIndex.get(key))
      .filter((idx): idx is number => idx !== undefined);
    if (!orderedIndexes.length) return headers;
    return orderedIndexes.map((idx) => headers[idx]);
  }, [headers, selectedImportFieldKeys, fieldKeyToIndex]);
  const effectiveExampleRow = useMemo(() => {
    if (!effectiveHeaders?.length) return exampleRow;
    if (!headers?.length) return exampleRow;
    const selectedIndexes = selectedImportFieldKeys
      .map((key) => fieldKeyToIndex.get(key))
      .filter((idx): idx is number => idx !== undefined);
    if (!exampleRow?.length) return selectedIndexes.map(() => '');
    return selectedIndexes.map((idx) => String(exampleRow[idx] ?? ''));
  }, [effectiveHeaders, headers, exampleRow, selectedImportFieldKeys, fieldKeyToIndex]);

  const effectiveColumnOptions = useMemo(() => {
    if (!columnOptions?.length || !headers?.length) return columnOptions;
    const selectedIndexes = selectedImportFieldKeys
      .map((key) => fieldKeyToIndex.get(key))
      .filter((idx): idx is number => idx !== undefined);
    if (!selectedIndexes.length) return columnOptions;
    return selectedIndexes.map((idx) => columnOptions[idx]);
  }, [columnOptions, headers, selectedImportFieldKeys, fieldKeyToIndex]);

  headersRef.current = effectiveHeaders;
  exampleRowRef.current = effectiveExampleRow;
  const columnOptionsRef = useRef(effectiveColumnOptions);
  columnOptionsRef.current = effectiveColumnOptions;

  const projectImportSheetRows = useCallback(
    (rows: any[][]): string[][] => {
      const stringRows = rows.map((row) => row.map((cell) => String(cell ?? '')));
      if (!headers?.length || !selectedImportFieldKeys.length) {
        return stringRows;
      }

      const trimTrailingEmpty = (row: string[]): string[] => {
        let end = row.length;
        while (end > 0 && !String(row[end - 1] ?? '').trim()) {
          end -= 1;
        }
        return row.slice(0, end);
      };

      const sliceToWidth = (row: string[], width: number): string[] =>
        Array.from({ length: width }, (_, idx) => String(row[idx] ?? ''));

      // Univer 常在末尾垫空列；先按表头去尾，再判断是否已是自定义列布局。
      const trimmedHeader = trimTrailingEmpty(stringRows[0] ?? []);
      const effectiveCount = effectiveHeaders?.length ?? 0;
      const sheetHeaderKeys = trimmedHeader.map((header) =>
        resolveSystemFieldKey(String(header ?? ''), importFieldMapRef.current),
      );
      const alreadyProjected =
        effectiveCount > 0 &&
        sheetHeaderKeys.length === effectiveCount &&
        sheetHeaderKeys.every((key, idx) => key === selectedImportFieldKeys[idx]);

      // 自定义导入 / 上传 Excel 后，表格已是 effectiveHeaders 顺序，不能再用全量模板下标重排。
      if (alreadyProjected || trimmedHeader.length !== headers.length) {
        const width =
          effectiveCount > 0 && trimmedHeader.length >= effectiveCount
            ? effectiveCount
            : trimmedHeader.length;
        return stringRows.map((row) => sliceToWidth(row, width));
      }

      const selectedIndexes = selectedImportFieldKeys
        .map((key) => fieldKeyToIndex.get(key))
        .filter((idx): idx is number => idx !== undefined);
      if (!selectedIndexes.length) {
        return stringRows;
      }
      return stringRows.map((row) => selectedIndexes.map((colIdx) => row?.[colIdx] ?? ''));
    },
    [headers, selectedImportFieldKeys, effectiveHeaders, fieldKeyToIndex],
  );

  const resolveHeaderFieldKeys = useCallback(
    (rows: string[][]): Set<string> => {
      const headerRow = rows[0] ?? [];
      return new Set(
        headerRow.map((header) => resolveSystemFieldKey(String(header ?? ''), importFieldMapRef.current)),
      );
    },
    [],
  );

  const importPreferenceSegment = useMemo(() => {
    const raw = (customImportPreferenceKey?.trim() || location.pathname || 'default').toLowerCase();
    return raw.replace(/[^a-z0-9_-]/g, '_');
  }, [customImportPreferenceKey, location.pathname]);

  const resolvedTemplateFileName = useMemo(() => {
    if (templateFileName?.trim()) {
      const name = templateFileName.trim();
      return name.endsWith('.xlsx') ? name : `${name}.xlsx`;
    }
    const docName =
      templateDocumentName?.trim() ||
      translatePathTitle(location.pathname, t)?.trim() ||
      '';
    if (docName) {
      return buildImportTemplateFileName(docName, t('components.uniImport.templateSuffix'));
    }
    return buildImportTemplateFileName('', t('components.uniImport.templateSuffix'));
  }, [templateFileName, templateDocumentName, location.pathname, t]);

  const showXlsxTools = enableXlsxTemplate ?? Boolean(headers?.length);
  const showMappingImport = enableMappingImport ?? Boolean(headers?.length);
  const showCustomImport = enableCustomImport ?? Boolean(headers?.length);
  const showRelationImport = enableRelationImport ?? Boolean(onRelationImportSubmit);
  const relationDefaultEntities = useMemo<UniRelationImportEntity[]>(
    () => relationImportConfig?.entities ?? ['material', 'processRoute', 'operation', 'performance'],
    [relationImportConfig?.entities],
  );
  const relationSupportedStrategies = useMemo<UniRelationImportWriteStrategy[]>(
    () => relationImportConfig?.supportedStrategies ?? ['upsert', 'create_only', 'link_only', 'strict_fail'],
    [relationImportConfig?.supportedStrategies],
  );
  const relationDefaultWriteStrategy = relationImportConfig?.defaultWriteStrategy ?? 'upsert';
  // 与 app 主题一致：以 document.colorScheme 为准（主题编辑选择），未设置时才用系统偏好
  const colorScheme = document.documentElement.style.colorScheme;
  const isDark = colorScheme === 'dark'
    || (colorScheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (open ?? visible) {
      setCustomRelationEntities((prev) => normalizeRelationEntities(prev, relationDefaultEntities));
      return;
    }
    uploadedSheetRowsRef.current = null;
    setUploadedSheetRows(null);
    setMappingModalOpen(false);
    setMappingRawRows([]);
    setCustomModalOpen(false);
    setCustomImportFieldKeys(null);
    setCustomRelationEntities(relationDefaultEntities);
    setCustomWriteStrategy(relationDefaultWriteStrategy);
    setPreviewModalOpen(false);
    setPreviewData([]);
    setPrecheckResult(null);
    setPrecheckLoading(false);
  }, [open, visible, relationDefaultEntities, relationDefaultWriteStrategy]);

  // 弹窗打开时拦截 Univer dispose 竞态的全局 error / unhandledrejection，避免污染控制台与其它全局监听
  useEffect(() => {
    if (!(open ?? visible)) return;

    const suppressIfRace = (error: unknown) => {
      if (!isUniverImportDisposeRaceError(error)) return false;
      console.warn('[UniImport] suppressed Univer dispose race:', error);
      return true;
    };

    const onWindowError = (event: ErrorEvent) => {
      if (!suppressIfRace(event.error ?? event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!suppressIfRace(event.reason)) return;
      event.preventDefault();
    };

    window.addEventListener('error', onWindowError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [open, visible]);

  useEffect(() => {
    if (!(open ?? visible)) return;
    if (!allFieldKeys.length) return;
    const savedMap = getPreference<Record<string, string[]>>('ui.import_field_selection', {});
    const saved = Array.isArray(savedMap?.[importPreferenceSegment]) ? savedMap[importPreferenceSegment] : [];
    if (!saved.length) {
      setCustomImportFieldKeys(allFieldKeys);
      return;
    }
    const orderedSaved = saved.filter((key) => allFieldKeys.includes(key));
    const missing = allFieldKeys.filter((key) => !orderedSaved.includes(key));
    const merged = [...orderedSaved, ...missing];
    setCustomImportFieldKeys(merged.length ? merged : allFieldKeys);
  }, [open, visible, allFieldKeys, getPreference, importPreferenceSegment]);

  // 弹窗打开时拦截 Ctrl/Cmd+D，避免触发浏览器收藏
  useEffect(() => {
    if (!(open ?? visible)) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'd') return;

      e.preventDefault();
    };

    window.addEventListener('keydown', handleModalKeyDown, true);
    return () => window.removeEventListener('keydown', handleModalKeyDown, true);
  }, [open, visible]);

  const handleDownloadTemplate = () => {
    const importHeaders = headersRef.current;
    if (!importHeaders?.length) {
      messageApi.warning(t('components.uniImport.noHeadersForTemplate'));
      return;
    }
    modalApi.confirm({
      title: t('components.uniImport.downloadTemplateConfirmTitle'),
      content: (
        <>
          <strong style={{ color: '#ff4d4f' }}>
            {t('components.uniImport.downloadTemplateConfirmEmphasize')}
          </strong>
          {t('components.uniImport.downloadTemplateConfirmContentRest')}
        </>
      ),
      okText: t('components.uniImport.downloadTemplateConfirmOk'),
      cancelText: t('components.uniImport.cancel'),
      onOk: async () => {
        try {
          setXlsxBusy(true);
          await downloadImportTemplateXlsx(
            importHeaders,
            exampleRowRef.current,
            resolvedTemplateFileName,
            columnOptionsRef.current,
          );
          messageApi.success(t('components.uniImport.templateDownloaded'));
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          messageApi.error(t('components.uniImport.templateDownloadFailed', { message: msg }));
          throw error;
        } finally {
          setXlsxBusy(false);
        }
      },
    });
  };

  const handleUploadXlsx: UploadProps['beforeUpload'] = async (file) => {
    try {
      setXlsxBusy(true);
      const rows = await parseImportXlsxFile(file as File);
      uploadedSheetRowsRef.current = rows;
      setUploadedSheetRows(rows);
      messageApi.success(t('components.uniImport.uploadSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(t('components.uniImport.uploadFailed', { message: msg }));
    } finally {
      setXlsxBusy(false);
    }
    return false;
  };

  const mappingFileInputRef = useRef<HTMLInputElement>(null);

  const processMappingFile = async (file: File) => {
    const importHeaders = headersRef.current;
    if (!importHeaders?.length) {
      messageApi.warning(t('components.uniImport.noHeadersForTemplate'));
      return;
    }
    try {
      setXlsxBusy(true);
      const rows = await parseImportXlsxFile(file);
      setMappingRawRows(rows);
      setMappingModalOpen(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(t('components.uniImport.uploadFailed', { message: msg }));
    } finally {
      setXlsxBusy(false);
    }
  };

  const handleMappingImportClick = () => {
    if (loading || xlsxBusy) return;
    const importHeaders = headersRef.current;
    if (!importHeaders?.length) {
      messageApi.warning(t('components.uniImport.noHeadersForTemplate'));
      return;
    }
    modalApi.confirm({
      title: t('components.uniImport.mappingImportConfirmTitle'),
      content: (
        <>
          <strong style={{ color: '#ff4d4f' }}>
            {t('components.uniImport.mappingImportConfirmEmphasize')}
          </strong>
          {t('components.uniImport.mappingImportConfirmContentRest')}
        </>
      ),
      okText: t('components.uniImport.mappingImportConfirmOk'),
      cancelText: t('components.uniImport.cancel'),
      onOk: () => {
        const input = mappingFileInputRef.current;
        if (!input) return;
        input.value = '';
        input.click();
      },
    });
  };

  const handleMappingFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void processMappingFile(file);
  };

  const handleMappingApply = (mappedRows: string[][]) => {
    uploadedSheetRowsRef.current = mappedRows;
    setUploadedSheetRows(mappedRows);
    setMappingModalOpen(false);
    messageApi.success(t('components.uniImport.mappingApplySuccess'));
  };

  const handleCustomApply = (result: UniImportCustomModalApplyResult) => {
    const sanitizedRelationEntities = normalizeRelationEntities(
      result.relationEntities,
      relationDefaultEntities,
    );
    setCustomImportFieldKeys(result.selectedFieldKeys);
    setCustomRelationEntities(sanitizedRelationEntities);
    setCustomWriteStrategy(result.writeStrategy);
    const savedMap = getPreference<Record<string, string[]>>('ui.import_field_selection', {});
    const nextMap = {
      ...(savedMap && typeof savedMap === 'object' ? savedMap : {}),
      [importPreferenceSegment]: result.selectedFieldKeys,
    };
    void updatePreferences({
      ui: {
        import_field_selection: nextMap,
      },
    });
    setCustomModalOpen(false);
    messageApi.success(
      t('components.uniImport.customImportApplySuccess', { count: result.selectedFieldKeys.length }),
    );
  };

  const shouldUseRelationImport = showRelationImport && customRelationEntities.length > 0 && !!onRelationImportSubmit;
  const relationCoreRequiredFieldKeys = useMemo(
    () =>
      relationImportConfig?.requiredFieldKeys?.length
        ? relationImportConfig.requiredFieldKeys
        : ['parentCode', 'componentCode', 'quantity'],
    [relationImportConfig?.requiredFieldKeys],
  );
  const relationEntityRequiredFieldKeys = useMemo<Partial<Record<UniRelationImportEntity, string[]>>>(
    () =>
      relationImportConfig?.entityRequiredFieldKeys ?? {
        material: ['componentCode'],
        processRoute: ['processRouteCode'],
        operation: ['operationCode'],
        performance: ['employeeId'],
      },
    [relationImportConfig?.entityRequiredFieldKeys],
  );
  const resolveEffectiveRelationEntities = useCallback(
    (headerFieldKeys: Set<string>): UniRelationImportEntity[] =>
      customRelationEntities.filter((entity) => {
        const required = relationEntityRequiredFieldKeys[entity] ?? [];
        const importRequired = required.filter((key) => selectedImportFieldKeys.includes(key));
        if (!importRequired.length) {
          return true;
        }
        return importRequired.every((key) => headerFieldKeys.has(key));
      }),
    [customRelationEntities, selectedImportFieldKeys, relationEntityRequiredFieldKeys],
  );
  const validateRelationPayload = useCallback(
    (rows: string[][]): string[] => {
      const errors: string[] = [];
      const headerRow = rows[0] ?? [];
      const headerFieldKeys = resolveHeaderFieldKeys(rows);
      const effectiveEntities = resolveEffectiveRelationEntities(headerFieldKeys);

      const selectedCore = relationCoreRequiredFieldKeys.filter((key) =>
        selectedImportFieldKeys.includes(key),
      );
      const missingBase = selectedCore.filter((key) => !headerFieldKeys.has(key));
      if (missingBase.length) {
        errors.push(
          t('components.uniImport.relationMissingRequiredColumns', {
            columns: missingBase.join(', '),
          }),
        );
      }

      effectiveEntities.forEach((entity) => {
        const required = relationEntityRequiredFieldKeys[entity] ?? [];
        const importRequired = required.filter((key) => selectedImportFieldKeys.includes(key));
        const missing = importRequired.filter((key) => !headerFieldKeys.has(key));
        if (missing.length) {
          errors.push(
            t('components.uniImport.relationMissingEntityColumns', {
              entity: t(`components.uniImport.relationEntity.${entity}`),
              columns: missing.join(', '),
            }),
          );
        }
      });

      const fieldIndexMap = Object.fromEntries(
        headerRow.map((header, idx) => [
          resolveSystemFieldKey(String(header ?? ''), importFieldMapRef.current),
          idx,
        ]),
      ) as Record<string, number>;

      for (let rowIdx = 2; rowIdx < rows.length; rowIdx += 1) {
        const row = rows[rowIdx] ?? [];
        if (!row.some((cell) => String(cell ?? '').trim() !== '')) continue;
        effectiveEntities.forEach((entity) => {
          (relationEntityRequiredFieldKeys[entity] ?? [])
            .filter((fieldKey) => selectedImportFieldKeys.includes(fieldKey))
            .forEach((fieldKey) => {
              const idx = fieldIndexMap[fieldKey];
              if (idx === undefined) return;
              const val = String(row[idx] ?? '').trim();
              if (!val) {
                errors.push(
                  t('components.uniImport.relationMissingEntityValue', {
                    row: rowIdx + 1,
                    entity: t(`components.uniImport.relationEntity.${entity}`),
                    field: fieldKey,
                  }),
                );
              }
            });
        });
      }
      return errors;
    },
    [
      resolveEffectiveRelationEntities,
      resolveHeaderFieldKeys,
      relationCoreRequiredFieldKeys,
      relationEntityRequiredFieldKeys,
      selectedImportFieldKeys,
      t,
    ],
  );

  const runImportPrecheck = useCallback(
    async (data: any[][]) => {
      const asStringRows = projectImportSheetRows(
        data.map((row) => row.map((cell) => String(cell ?? ''))),
      );
      if (showRelationImport && customRelationEntities.length > 0 && onRelationImportPrecheck) {
        const localErrors = validateRelationPayload(asStringRows);
        if (localErrors.length) {
          setPrecheckResult({
            canImport: false,
            errors: localErrors,
          });
          return;
        }
        const effectiveEntities = resolveEffectiveRelationEntities(resolveHeaderFieldKeys(asStringRows));
        setPrecheckLoading(true);
        setPrecheckResult(null);
        try {
          const relation = await onRelationImportPrecheck({
            rawRows: asStringRows,
            entities: effectiveEntities,
            writeStrategy: customWriteStrategy,
          });
          setPrecheckResult({
            canImport: relation?.success !== false && !(relation?.errors?.length),
            errors: relation?.errors,
            warnings: relation?.warnings,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          setPrecheckResult({
            canImport: false,
            errors: [t('components.uniImport.previewPrecheckFailed', { message: msg })],
          });
        } finally {
          setPrecheckLoading(false);
        }
        return;
      }
      if (!onImportPrecheck) {
        setPrecheckResult(null);
        setPrecheckLoading(false);
        return;
      }
      setPrecheckLoading(true);
      setPrecheckResult(null);
      try {
        const result = await onImportPrecheck(data);
        setPrecheckResult(result ?? null);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        setPrecheckResult({
          canImport: false,
          errors: [t('components.uniImport.previewPrecheckFailed', { message: msg })],
        });
      } finally {
        setPrecheckLoading(false);
      }
    },
    [
      showRelationImport,
      customRelationEntities,
      customWriteStrategy,
      onRelationImportPrecheck,
      onImportPrecheck,
      projectImportSheetRows,
      resolveEffectiveRelationEntities,
      resolveHeaderFieldKeys,
      validateRelationPayload,
      t,
    ],
  );

  const openImportPreview = (data: any[][]) => {
    const dataRows = getImportDataRows(data, importDataStartRow);
    if (dataRows.length === 0) {
      messageApi.warning(t('components.uniImport.previewNoDataRows'));
      return;
    }
    setPreviewData(data);
    setPrecheckResult(null);
    setPreviewModalOpen(true);
    void runImportPrecheck(data);
  };

  const commitImport = async (data: any[][]) => {
    if (commitLoading) return;
    setCommitLoading(true);
    try {
      if (shouldUseRelationImport && onRelationImportSubmit) {
        const relationRows = projectImportSheetRows(
          data.map((row) => row.map((cell) => String(cell ?? ''))),
        );
        const localErrors = validateRelationPayload(relationRows);
        if (localErrors.length) {
          setPrecheckResult({
            canImport: false,
            errors: localErrors,
          });
          return;
        }
        const effectiveEntities = resolveEffectiveRelationEntities(resolveHeaderFieldKeys(relationRows));
        const relationResult = await onRelationImportSubmit({
          rawRows: relationRows,
          entities: effectiveEntities,
          writeStrategy: customWriteStrategy,
        });
        if (relationResult?.success !== false && !relationResult?.errors?.length && relationResult?.message) {
          messageApi.success(relationResult.message);
        }
        if (relationResult?.errors?.length) {
          if (relationResult?.message) {
            messageApi.error(relationResult.message);
          }
          setPrecheckResult({
            canImport: false,
            errors: relationResult.errors,
            warnings: relationResult.warnings,
          });
          return;
        }
        setPreviewModalOpen(false);
        onCancel();
        return;
      }

      const result = await Promise.resolve(onConfirm(data));
      if (result === false) {
        return;
      }
      setPreviewModalOpen(false);
      onCancel();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(msg || t('common.importFailed'));
    } finally {
      setCommitLoading(false);
    }
  };

  const handlePreviewConfirmImport = () => {
    const blockingErrors = (precheckResult?.errors ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (blockingErrors.length) {
      messageApi.warning(blockingErrors[0]);
      return;
    }
    void commitImport(previewData);
  };

  const submitParsedImportRows = (data: string[][]) => {
    if (data.length === 0) {
      messageApi.warning(t('components.uniImport.emptySheet'));
      return;
    }

    const hasDataRow =
      data.length > 1 &&
      data.slice(1).some(
        (row) =>
          row &&
          row.some((cell) => {
            const v = cell !== null && cell !== undefined ? String(cell).trim() : '';
            return v !== '';
          }),
      );
    if (!hasDataRow) {
      messageApi.warning(t('components.uniImport.emptySheetAllBlank'));
      return;
    }

    const projectedData = projectImportSheetRows(
      data.map((row) => row.map((cell) => String(cell ?? ''))),
    );

    if (shouldUseRelationImport) {
      const localErrors = validateRelationPayload(
        projectedData.map((row) => row.map((cell) => String(cell ?? ''))),
      );
      if (localErrors.length) {
        setPrecheckResult({
          canImport: false,
          errors: localErrors,
        });
        if (enableImportPreview) {
          setPreviewData(projectedData);
          setPreviewModalOpen(true);
        } else {
          messageApi.error(localErrors[0]);
        }
        return;
      }
    }

    if (enableImportPreview) {
      openImportPreview(projectedData);
      return;
    }
    void commitImport(projectedData);
  };

  /**
   * 确认导入：只认 sheet-host 同步的字符串矩阵（上传 / 粘贴 / 初始模板）。
   */
  const handleConfirm = () => {
    const uploaded = uploadedSheetRowsRef.current;
    if (!uploaded || uploaded.length === 0) {
      messageApi.warning(t('components.uniImport.sheetMatrixMissing'));
      return;
    }
    submitParsedImportRows(uploaded.map((row) => row.map((cell) => String(cell ?? ''))));
  };

  return (
    <>
      {/* Univer Sheet 基本样式 */}
      {(open ?? visible) && (
        <style>{`
          .uni-import-modal .ant-modal-body {
            padding: 8px 0 !important;
            /* 禁止 Modal 再出原生横滚；超宽只走 Univer 视口滚动条 */
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
          }
          .uni-import-sheet-host {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            height: 100%;
            border-radius: 0;
          }
          /* 禁止 Univer 根节点按内容撑破宿主，否则列裁切但引擎仍认「未超宽」 */
          .uni-import-sheet-host > * {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          /* Excel 品牌绿 */
          .uni-import-modal .uni-import-upload-excel-btn.ant-btn-primary {
            background: #217346;
            border-color: #217346;
          }
          .uni-import-modal .uni-import-upload-excel-btn.ant-btn-primary:not(:disabled):hover {
            background: #1a5c38;
            border-color: #1a5c38;
          }
          .uni-import-modal .uni-import-upload-excel-btn.ant-btn-primary:not(:disabled):active {
            background: #154a2d;
            border-color: #154a2d;
          }
        `}</style>
      )}
      <Modal
        className="uni-import-modal"
        focusable={{ trap: false }}
        title={resolvedTitle}
        open={open ?? visible}
        onCancel={onCancel}
        keyboard={false}
        maskClosable={false}
        width={width}
        afterOpenChange={(opened) => {
          if (!opened || !univerInstanceRef.current) return;
          const host = document.querySelector(
            '.uni-import-modal .uni-import-sheet-host',
          ) as HTMLElement | null;
          relayoutUniverSheet(univerInstanceRef.current, host);
        }}
        footer={
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            {showXlsxTools || showMappingImport || showCustomImport ? (
              <Space wrap>
                {showMappingImport && (
                  <>
                    <input
                      ref={mappingFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={handleMappingFileInputChange}
                    />
                    <Button
                      icon={<SwapOutlined />}
                      loading={xlsxBusy}
                      disabled={loading}
                      onClick={handleMappingImportClick}
                    >
                      {t('components.uniImport.mappingImport')}
                    </Button>
                  </>
                )}
                {showCustomImport && (
                  <Button icon={<SwapOutlined />} disabled={loading || xlsxBusy} onClick={() => setCustomModalOpen(true)}>
                    {t('components.uniImport.customImport')}
                  </Button>
                )}
                {showXlsxTools && (
                  <>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadTemplate}
                      loading={xlsxBusy}
                      disabled={loading}
                    >
                      {t('components.uniImport.downloadTemplate')}
                    </Button>
                    <Upload
                      accept=".xlsx,.xls"
                      showUploadList={false}
                      beforeUpload={handleUploadXlsx}
                      disabled={loading || xlsxBusy}
                    >
                      <Button
                        type="primary"
                        className="uni-import-upload-excel-btn"
                        icon={<UploadOutlined />}
                        loading={xlsxBusy}
                        disabled={loading}
                      >
                        {t('components.uniImport.uploadExcel')}
                      </Button>
                    </Upload>
                  </>
                )}
              </Space>
            ) : (
              <span />
            )}
            <Space>
              {showCancelButton && (
                <Button icon={<CloseOutlined />} onClick={onCancel} disabled={loading || xlsxBusy}>
                  {resolvedCancelText}
                </Button>
              )}
              {showConfirmButton && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleConfirm}
                  loading={loading}
                  disabled={xlsxBusy}
                >
                  {enableImportPreview
                    ? t('components.uniImport.previewNextStep')
                    : resolvedConfirmText}
                </Button>
              )}
            </Space>
          </div>
        }
        destroyOnHidden={true}
        centered
        styles={{
          body: {
            padding: '8px 0',
            height: `${height}px`,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          },
        }}
      >
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', position: 'relative' }}>
          <ErrorBoundary
            fallback={
              <div style={{ padding: 24, textAlign: 'center' }}>
                {t('components.uniImport.sheetLoadFailed', { message: t('common.unknownError') })}
              </div>
            }
          >
            <UniImportSheetHost
            isDark={isDark}
            uploadedSheetRows={uploadedSheetRows}
            headers={headersRef.current}
            exampleRow={exampleRowRef.current}
            columnOptions={effectiveColumnOptions}
            height={height}
            loading={loading}
            onLoadingChange={setLoading}
            instanceRef={univerInstanceRef}
            messageApi={messageApi}
            onSheetRowsChange={(rows) => {
              // 仅写 ref：确认导入读原文；避免 setState 重建 Univer 冲掉粘贴
              uploadedSheetRowsRef.current = rows;
            }}
          />
          </ErrorBoundary>
        </div>
      </Modal>
      {showMappingImport && headers && headers.length > 0 && (
        <UniImportMappingModal
          open={mappingModalOpen}
          systemHeaders={headers}
          exampleRow={exampleRow}
          fieldMap={importFieldMapRef.current}
          rawRows={mappingRawRows}
          onCancel={() => setMappingModalOpen(false)}
          onApply={handleMappingApply}
        />
      )}
      {showCustomImport && headers && headers.length > 0 && (
        <UniImportCustomModal
          open={customModalOpen}
          headers={headers}
          fieldMap={importFieldMapRef.current}
          initialSelectedFieldKeys={selectedImportFieldKeys}
          enableRelationImport={showRelationImport}
          defaultRelationEntities={relationDefaultEntities}
          availableRelationEntities={relationDefaultEntities}
          defaultWriteStrategy={relationDefaultWriteStrategy}
          supportedStrategies={relationSupportedStrategies}
          initialRelationEntities={customRelationEntities}
          initialWriteStrategy={customWriteStrategy}
          onCancel={() => setCustomModalOpen(false)}
          onApply={handleCustomApply}
        />
      )}
      <UniImportPreviewModal
        open={previewModalOpen}
        data={previewData}
        dataStartRow={importDataStartRow}
        maxPreviewRows={importPreviewMaxRows}
        width={width}
        precheckLoading={precheckLoading}
        commitLoading={commitLoading}
        precheckResult={precheckResult}
        onCancel={() => setPreviewModalOpen(false)}
        onConfirmImport={handlePreviewConfirmImport}
      />
    </>
  );
};

export { UniImportToolbarButton } from './UniImportToolbarButton';
export type { UniImportToolbarButtonProps } from './UniImportToolbarButton';

export default UniImport;


