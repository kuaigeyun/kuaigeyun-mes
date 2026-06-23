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

import type { UniverSheetInstance } from '../univer/bootstrap-sheet';
import { buildImportTemplateFileName } from './build-import-template-file-name';
import { UniImportSheetHost } from './uni-import-sheet-host';
import { downloadImportTemplateXlsx, parseImportXlsxFile } from './uni-import-xlsx';
import { UniImportMappingModal } from './uni-import-mapping-modal';
import {
  UniImportCustomModal,
  type UniImportCustomModalApplyResult,
} from './uni-import-custom-modal';
import {
  type UniRelationImportEntity,
  type UniRelationImportWriteStrategy,
  type UniRelationImportResult,
} from './uni-import-relation-modal';
import {
  UniImportPreviewModal,
  type ImportPrecheckResult,
} from './uni-import-preview-modal';
import { getImportDataRows } from './import-preview-utils';
import { translatePathTitle } from '../../utils/menuTranslation';
import { resolveSystemFieldKey } from './apply-import-mapping';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';

/**
 * Univer Import 导入弹窗组件属性
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
   */
  onConfirm: (data: any[][]) => void;
  /**
   * 弹窗标题（默认：'导入数据'）
   */
  title?: string;
  /**
   * 弹窗宽度（默认：1200）
   */
  width?: string | number;
  /**
   * 弹窗内容区高度（默认：620；表格可视区域约为 height - 32，即 588px）
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
  relationImportConfig?: {
    entities?: UniRelationImportEntity[];
    defaultWriteStrategy?: UniRelationImportWriteStrategy;
    supportedStrategies?: UniRelationImportWriteStrategy[];
  };
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
  title = '导入数据',
  width = 1200,
  height = 620,
  showConfirmButton = true,
  showCancelButton = true,
  confirmText = '确认导入',
  cancelText = '取消',
  headers,
  exampleRow,
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
  const location = useLocation();
  const getPreference = useUserPreferenceStore((s) => s.getPreference);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  /** 上传/映射后的表格行；变更时 useLayoutEffect 同步重建 Univer 工作簿 */
  const [uploadedSheetRows, setUploadedSheetRows] = useState<string[][] | null>(null);
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

  headersRef.current = effectiveHeaders;
  exampleRowRef.current = effectiveExampleRow;

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
    if (open ?? visible) return;
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

  const handleDownloadTemplate = async () => {
    const importHeaders = headersRef.current;
    if (!importHeaders?.length) {
      messageApi.warning(t('components.uniImport.noHeadersForTemplate'));
      return;
    }
    try {
      setXlsxBusy(true);
      await downloadImportTemplateXlsx(
        importHeaders,
        exampleRowRef.current,
        resolvedTemplateFileName,
      );
      messageApi.success(t('components.uniImport.templateDownloaded'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(t('components.uniImport.templateDownloadFailed', { message: msg }));
    } finally {
      setXlsxBusy(false);
    }
  };

  const handleUploadXlsx: UploadProps['beforeUpload'] = async (file) => {
    try {
      setXlsxBusy(true);
      const rows = await parseImportXlsxFile(file as File);
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

  const handleMappingUpload: UploadProps['beforeUpload'] = async (file) => {
    const importHeaders = headersRef.current;
    if (!importHeaders?.length) {
      messageApi.warning(t('components.uniImport.noHeadersForTemplate'));
      return false;
    }
    try {
      setXlsxBusy(true);
      const rows = await parseImportXlsxFile(file as File);
      setMappingRawRows(rows);
      setMappingModalOpen(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(t('components.uniImport.uploadFailed', { message: msg }));
    } finally {
      setXlsxBusy(false);
    }
    return false;
  };

  const handleMappingApply = (mappedRows: string[][]) => {
    setUploadedSheetRows(mappedRows);
    setMappingModalOpen(false);
    messageApi.success(t('components.uniImport.mappingApplySuccess'));
  };

  const handleCustomApply = (result: UniImportCustomModalApplyResult) => {
    setCustomImportFieldKeys(result.selectedFieldKeys);
    setCustomRelationEntities(result.relationEntities);
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
  const relationEntityRequiredFieldKeys = useMemo<Record<UniRelationImportEntity, string[]>>(
    () => ({
      material: ['parentCode', 'componentCode'],
      processRoute: ['processRouteCode'],
      operation: ['operationCode'],
      performance: ['employeeId'],
    }),
    [],
  );
  const validateRelationPayload = useCallback(
    (rows: string[][]): string[] => {
      const errors: string[] = [];
      const headerRow = rows[0] ?? [];
      const headerFieldKeys = new Set(
        headerRow.map((header) => resolveSystemFieldKey(String(header ?? ''), importFieldMapRef.current)),
      );
      const baseRequired = ['parentCode', 'componentCode', 'quantity'];
      const missingBase = baseRequired.filter((key) => !headerFieldKeys.has(key));
      if (missingBase.length) {
        errors.push(
          t('components.uniImport.relationMissingRequiredColumns', {
            columns: missingBase.join(', '),
          }),
        );
      }

      customRelationEntities.forEach((entity) => {
        const required = relationEntityRequiredFieldKeys[entity] ?? [];
        const missing = required.filter((key) => !headerFieldKeys.has(key));
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
        customRelationEntities.forEach((entity) => {
          (relationEntityRequiredFieldKeys[entity] ?? []).forEach((fieldKey) => {
            const idx = fieldIndexMap[fieldKey];
            const val = idx === undefined ? '' : String(row[idx] ?? '').trim();
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
    [customRelationEntities, relationEntityRequiredFieldKeys, t],
  );

  const runImportPrecheck = useCallback(
    async (data: any[][]) => {
      const asStringRows = data.map((row) => row.map((cell) => String(cell ?? '')));
      if (showRelationImport && customRelationEntities.length > 0 && onRelationImportPrecheck) {
        const localErrors = validateRelationPayload(asStringRows);
        if (localErrors.length) {
          setPrecheckResult({
            canImport: false,
            errors: localErrors,
          });
          return;
        }
        setPrecheckLoading(true);
        setPrecheckResult(null);
        try {
          const relation = await onRelationImportPrecheck({
            rawRows: asStringRows,
            entities: customRelationEntities,
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
    if (shouldUseRelationImport && onRelationImportSubmit) {
      const relationRows = data.map((row) => row.map((cell) => String(cell ?? '')));
      const localErrors = validateRelationPayload(relationRows);
      if (localErrors.length) {
        setPrecheckResult({
          canImport: false,
          errors: localErrors,
        });
        return;
      }
      const relationResult = await onRelationImportSubmit({
        rawRows: relationRows,
        entities: customRelationEntities,
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

    onConfirm(data);
    setPreviewModalOpen(false);
    onCancel();
  };

  const handlePreviewConfirmImport = () => {
    if (precheckResult?.errors?.length) {
      return;
    }
    void commitImport(previewData);
  };

  /**
   * 处理确认导入
   */
  const handleConfirm = () => {
    try {
      const instance = univerInstanceRef.current;

      if (!instance) {
        messageApi.error('表格未加载完成，请稍候再试');
        return;
      }

      const { univerAPI } = instance;

      // 使用 Univer Sheet 的正确方式获取数据
      let data: any[][] = [];

      try {
        // 方法1：通过 univerAPI 获取工作簿和工作表
        let worksheet: any = null;
        if (univerAPI) {
          try {
            // @ts-ignore - Univer API 类型定义可能不完整
            if (typeof univerAPI.getActiveWorkbook === 'function') {
              // @ts-ignore
              const workbook = univerAPI.getActiveWorkbook();
              if (workbook) {
                // @ts-ignore
                worksheet = workbook.getActiveSheet();
              }
            }
          } catch (e) {
            console.warn('通过 univerAPI 获取工作表失败：', e);
          }
        }

        // 如果获取到了 worksheet，尝试使用其方法获取数据
        if (worksheet) {
          try {
            // 方法1：尝试使用 getRangeValues 获取数据
            // @ts-ignore
            if (typeof worksheet.getRangeValues === 'function') {
              // @ts-ignore
              const rangeValues = worksheet.getRangeValues(0, 0, 999, 99); // 获取前 1000 行，100 列
              if (rangeValues && Array.isArray(rangeValues)) {
                data = rangeValues;
              }
            }

            // 方法2：尝试使用 getCellMatrix 获取数据
            if (data.length === 0) {
              // @ts-ignore
              if (typeof worksheet.getCellMatrix === 'function') {
                // @ts-ignore
                const cellMatrix = worksheet.getCellMatrix();
                if (cellMatrix) {
                  // 将 cellMatrix 转换为二维数组
                  data = convertCellMatrixToArray(cellMatrix);
                }
              }
            }

            // 方法3：尝试使用 getCellData 获取数据
            if (data.length === 0) {
              // @ts-ignore
              if (typeof worksheet.getCellData === 'function') {
                // @ts-ignore
                const cellData = worksheet.getCellData();
                if (cellData) {
                  data = convertCellDataToArray(cellData);
                }
              }
            }

            // 方法4：尝试直接访问 cellData 属性
            if (data.length === 0 && worksheet.cellData) {
              data = convertCellDataToArray(worksheet.cellData);
            }

            // 方法5：尝试使用 getRange 方法获取数据
            if (data.length === 0) {
              // @ts-ignore
              if (typeof worksheet.getRange === 'function') {
                try {
                  // @ts-ignore
                  const range = worksheet.getRange(0, 0, 999, 99);
                  if (range && typeof range.getValues === 'function') {
                    // @ts-ignore
                    const values = range.getValues();
                    if (values && Array.isArray(values)) {
                      data = values;
                    }
                  }
                } catch (e) {
                  // 忽略错误，继续尝试其他方法
                }
              }
            }

            // 方法6：尝试通过遍历单元格获取数据（最后的手段）
            if (data.length === 0) {
              try {
                const result: any[][] = [];
                let maxRow = -1;
                let maxCol = -1;
                let hasData = false;

                // 尝试获取行数和列数
                // @ts-ignore
                const rowCount = worksheet.getRowCount?.() || worksheet.rowCount || 100;
                // @ts-ignore
                const columnCount = worksheet.getColumnCount?.() || worksheet.columnCount || 100;

                // 遍历单元格获取数据（最多1000行，100列）
                const maxRows = Math.min(rowCount, 1000);
                const maxCols = Math.min(columnCount, 100);

                for (let r = 0; r < maxRows; r++) {
                  const rowData: any[] = [];
                  let rowHasData = false;

                  for (let c = 0; c < maxCols; c++) {
                    let value = '';

                    // 尝试多种方式获取单元格值
                    try {
                      // @ts-ignore
                      if (typeof worksheet.getCellValue === 'function') {
                        // @ts-ignore
                        const cell = worksheet.getCellValue(r, c);
                        if (cell !== null && cell !== undefined) {
                          if (typeof cell === 'object') {
                            value = cell.v !== undefined ? cell.v : (cell.m !== undefined ? cell.m : String(cell));
                          } else {
                            value = String(cell);
                          }
                        }
                      }
                      // @ts-ignore
                      else if (typeof worksheet.getCell === 'function') {
                        // @ts-ignore
                        const cell = worksheet.getCell(r, c);
                        if (cell) {
                          // @ts-ignore
                          if (typeof cell.getValue === 'function') {
                            // @ts-ignore
                            const cellValue = cell.getValue();
                            value = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
                          } else {
                            value = cell.v || cell.m || cell.value || '';
                          }
                        }
                      }
                      // @ts-ignore
                      else if (worksheet._cellData) {
                        // @ts-ignore
                        const row = worksheet._cellData[r];
                        if (row) {
                          const cell = row[c] || (typeof row.get === 'function' ? row.get(c) : null);
                          if (cell) {
                            value = cell.v !== undefined ? cell.v : (cell.m !== undefined ? cell.m : '');
                          }
                        }
                      }
                      // @ts-ignore
                      else if (worksheet.cellData) {
                        // @ts-ignore
                        const row = worksheet.cellData[r];
                        if (row) {
                          const cell = row[c] || (typeof row.get === 'function' ? row.get(c) : null);
                          if (cell) {
                            value = cell.v !== undefined ? cell.v : (cell.m !== undefined ? cell.m : '');
                          }
                        }
                      }
                    } catch (cellError) {
                      // 单个单元格获取失败，继续下一个
                      value = '';
                    }

                    rowData.push(value);
                    if (value !== '' && value !== null && value !== undefined) {
                      rowHasData = true;
                      hasData = true;
                      if (r > maxRow) maxRow = r;
                      if (c > maxCol) maxCol = c;
                    }
                  }

                  // 如果这一行有数据，或者在前10行，都保留
                  if (rowHasData || r < 10) {
                    result.push(rowData);
                  } else if (hasData && r > maxRow + 5) {
                    // 如果已经有数据了，且连续5行都没有数据，可以停止
                    break;
                  }
                }

                if (hasData && result.length > 0) {
                  // 移除末尾的空行
                  while (result.length > 0) {
                    const lastRow = result[result.length - 1];
                    if (lastRow.some(cell => cell !== '' && cell !== null && cell !== undefined)) {
                      break;
                    }
                    result.pop();
                  }
                  data = result;
                }
              } catch (e) {
                console.warn('通过遍历单元格获取数据失败：', e);
              }
            }
          } catch (e) {
            console.warn('从 worksheet 获取数据失败：', e);
          }
        }

        // 如果仍然没有数据，尝试通过 univerAPI 的其他方法获取
        if (data.length === 0 && univerAPI) {
          try {
            // @ts-ignore
            if (typeof univerAPI.getRangeData === 'function') {
              // @ts-ignore
              const rangeData = univerAPI.getRangeData(0, 0, 999, 99);
              if (rangeData && Array.isArray(rangeData)) {
                data = rangeData;
              }
            }
          } catch (e) {
            console.warn('通过 univerAPI.getRangeData 获取数据失败：', e);
          }
        }

        // 如果仍然没有数据，显示错误信息
        if (data.length === 0) {
          messageApi.warning('无法获取表格数据。请确保表格中有数据，或刷新页面重试');
          console.error('无法获取数据，worksheet:', worksheet);
          console.error('univerAPI:', univerAPI);
          return;
        }
      } catch (error: any) {
        messageApi.error('获取表格数据失败：' + (error.message || '未知错误'));
        console.error('获取表格数据错误详情：', error);
        return;
      }

      // 辅助函数：将 cellMatrix 转换为二维数组
      function convertCellMatrixToArray(cellMatrix: any): any[][] {
        const result: any[][] = [];
        let maxRow = -1;
        let maxCol = -1;

        // 找到最大行和列
        if (cellMatrix && typeof cellMatrix.forEach === 'function') {
          cellMatrix.forEach((row: any, r: number) => {
            if (row) {
              if (row.forEach) {
                row.forEach((cell: any, c: number) => {
                  if (cell && (cell.v !== undefined || cell.m !== undefined)) {
                    if (r > maxRow) maxRow = r;
                    if (c > maxCol) maxCol = c;
                  }
                });
              } else if (row.getValue) {
                for (let c = 0; c < 100; c++) {
                  const cell = row.getValue(c);
                  if (cell && (cell.v !== undefined || cell.m !== undefined)) {
                    if (r > maxRow) maxRow = r;
                    if (c > maxCol) maxCol = c;
                  }
                }
              }
            }
          });
        }

        if (maxRow === -1 || maxCol === -1) {
          return [];
        }

        // 创建二维数组（保留所有行以维持表头/示例/数据行结构，便于业务从第3行起取数据）
        for (let r = 0; r <= maxRow; r++) {
          const rowData: any[] = [];
          for (let c = 0; c <= maxCol; c++) {
            let value = '';
            if (cellMatrix && cellMatrix.getValue) {
              const row = cellMatrix.getValue(r);
              if (row) {
                const cell = row.getValue ? row.getValue(c) : null;
                if (cell) {
                  value = cell.v !== undefined ? cell.v : (cell.m !== undefined ? cell.m : '');
                }
              }
            }
            rowData.push(value);
          }
          result.push(rowData);
        }
        return result;
      }

      // 辅助函数：将 cellData 对象转换为二维数组
      function convertCellDataToArray(cellData: any): any[][] {
        const result: any[][] = [];

        if (!cellData || typeof cellData !== 'object') {
          return [];
        }

        // 如果是对象格式 { '0': { '0': {...}, '1': {...} } }
        const rowKeys = Object.keys(cellData).map(k => parseInt(k, 10)).filter(k => !isNaN(k));
        if (rowKeys.length === 0) {
          return [];
        }

        const maxRow = Math.max(...rowKeys);
        let maxCol = -1;

        rowKeys.forEach(r => {
          const row = cellData[r.toString()];
          if (row && typeof row === 'object') {
            const colKeys = Object.keys(row).map(k => parseInt(k, 10)).filter(k => !isNaN(k));
            if (colKeys.length > 0) {
              const rowMaxCol = Math.max(...colKeys);
              if (rowMaxCol > maxCol) maxCol = rowMaxCol;
            }
          }
        });

        if (maxCol === -1) {
          return [];
        }

        // 创建二维数组（保留所有行以维持表头/示例/数据行结构）
        for (let r = 0; r <= maxRow; r++) {
          const rowData: any[] = [];
          for (let c = 0; c <= maxCol; c++) {
            let value = '';
            const row = cellData[r.toString()];
            if (row) {
              const cell = row[c.toString()];
              if (cell) {
                value = cell.v !== undefined ? cell.v : (cell.m !== undefined ? cell.m : '');
              }
            }
            rowData.push(value);
          }
          result.push(rowData);
        }
        return result;
      }

      if (data.length === 0) {
        messageApi.warning('表格中没有有效数据，请先输入数据');
        return;
      }

      // 至少有一行数据行（表头之后）包含非空内容
      const hasDataRow = data.length > 1 && data.slice(1).some(row =>
        row && row.some((cell: any) => {
          const v = cell !== null && cell !== undefined ? String(cell).trim() : '';
          return v !== '';
        })
      );
      if (!hasDataRow) {
        messageApi.warning('表格中没有有效数据（所有行都为空），请先输入数据');
        return;
      }

      const projectedData =
        selectedImportFieldKeys.length > 0 && headers?.length
          ? (() => {
              const selectedIndexes = selectedImportFieldKeys
                .map((key) => fieldKeyToIndex.get(key))
                .filter((idx): idx is number => idx !== undefined);
              if (selectedIndexes.length === 0) return data;
              return data.map((row) => selectedIndexes.map((colIdx) => row?.[colIdx] ?? ''));
            })()
          : data;

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
    } catch (error: any) {
      messageApi.error('获取表格数据失败：' + (error.message || '未知错误'));
    }
  };

  return (
    <>
      {/* Univer Sheet 基本样式 */}
      {(open ?? visible) && (
        <style>{`
          .uni-import-modal .ant-modal-body {
            padding: 8px 0 !important;
          }
          .uni-import-sheet-host {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
        `}</style>
      )}
      <Modal
        className="uni-import-modal"
        focusable={{ trap: false }}
        title={title}
        open={open ?? visible}
        onCancel={onCancel}
        keyboard={false}
        maskClosable={false}
        width={width}
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
                  <Upload
                    accept=".xlsx,.xls"
                    showUploadList={false}
                    beforeUpload={handleMappingUpload}
                    disabled={loading || xlsxBusy}
                  >
                    <Button icon={<SwapOutlined />} loading={xlsxBusy} disabled={loading}>
                      {t('components.uniImport.mappingImport')}
                    </Button>
                  </Upload>
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
                      <Button icon={<UploadOutlined />} loading={xlsxBusy} disabled={loading}>
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
                  {cancelText}
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
                    : confirmText}
                </Button>
              )}
            </Space>
          </div>
        }
        destroyOnHidden={true}
        centered
        styles={{
          body: {
            padding: '16px',
            height: `${height}px`,
            overflow: 'hidden',
            position: 'relative',
          },
        }}
      >
        <UniImportSheetHost
          isDark={isDark}
          uploadedSheetRows={uploadedSheetRows}
          headers={headersRef.current}
          exampleRow={exampleRowRef.current}
          height={height}
          loading={loading}
          onLoadingChange={setLoading}
          instanceRef={univerInstanceRef}
          messageApi={messageApi}
        />
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
        precheckLoading={precheckLoading}
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


