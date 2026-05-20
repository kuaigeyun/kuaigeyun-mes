/**
 * Univer Import 导入弹窗组件
 * 
 * 使用 Univer Sheet 进行 Excel 数据导入
 * 已从 Luckysheet 迁移到 Univer Sheet
 */

import React, { useLayoutEffect, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal, Button, Space, App, theme, Spin, Upload } from 'antd';
import type { UploadProps } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// 引入 Univer Sheet 样式
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

// 引入 Univer 预设（简化初始化）
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';
import {
  SYSTEM_VIEWPORT_OFFSETS,
  getViewportHeightExpr,
} from '../layout-templates/constants';
import './uni-import-fullscreen.less';
import { buildImportCellData } from './build-import-cell-data';
import { buildImportTemplateFileName } from './build-import-template-file-name';
import { downloadImportTemplateXlsx, parseImportXlsxFile } from './uni-import-xlsx';
import { UniImportMappingModal } from './uni-import-mapping-modal';
import {
  UniImportPreviewModal,
  type ImportPrecheckResult,
} from './uni-import-preview-modal';
import { getImportDataRows } from './import-preview-utils';
import { translatePathTitle } from '../../utils/menuTranslation';

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
  enableImportPreview = true,
  importPreviewMaxRows = 10,
  importDataStartRow = 2,
  onImportPrecheck,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sheetGeneration, setSheetGeneration] = useState(0);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingRawRows, setMappingRawRows] = useState<string[][]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<ImportPrecheckResult | null>(null);
  const univerInstanceRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const containerIdRef = useRef<string>('');
  const headersRef = useRef(headers);
  const exampleRowRef = useRef(exampleRow);
  const importFieldMapRef = useRef(importFieldMap);
  const uploadedSheetRowsRef = useRef<string[][] | null>(null);
  const lastInitGenerationRef = useRef(-1);
  headersRef.current = headers;
  exampleRowRef.current = exampleRow;
  importFieldMapRef.current = importFieldMap;

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
  // 与 app 主题一致：以 document.colorScheme 为准（主题编辑选择），未设置时才用系统偏好
  const colorScheme = document.documentElement.style.colorScheme;
  const isDark = colorScheme === 'dark'
    || (colorScheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const disposeUniverInstance = useCallback(() => {
    try {
      const instance = univerInstanceRef.current;
      if (!instance) return;
      const keyDownHandler = (instance as { _keyDownHandler?: (e: KeyboardEvent) => void })._keyDownHandler;
      if (keyDownHandler) {
        document.removeEventListener('keydown', keyDownHandler, true);
      }
      instance.univer.dispose();
      univerInstanceRef.current = null;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open ?? visible) return;
    setIsFullscreen(false);
    uploadedSheetRowsRef.current = null;
    setSheetGeneration(0);
    setMappingModalOpen(false);
    setMappingRawRows([]);
    setPreviewModalOpen(false);
    setPreviewData([]);
    setPrecheckResult(null);
    setPrecheckLoading(false);
    lastInitGenerationRef.current = -1;
    disposeUniverInstance();
  }, [open, visible, disposeUniverInstance]);

  useEffect(() => {
    if ((open ?? visible) && isFullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open, visible, isFullscreen]);

  // 全屏布局变化后通知 Univer 重算尺寸（不重建实例）
  useEffect(() => {
    if (!(open ?? visible) || !isFullscreen) return;
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    return () => window.clearTimeout(timer);
  }, [open, visible, isFullscreen]);

  /**
   * 初始化 Univer Sheet（弹窗打开时一次；关闭/主题切换时销毁）
   */
  useLayoutEffect(() => {
    if (!(open ?? visible)) {
      setLoading(false);
      return undefined;
    }

    if (univerInstanceRef.current && lastInitGenerationRef.current === sheetGeneration) {
      return undefined;
    }
    if (univerInstanceRef.current) {
      disposeUniverInstance();
    }

    const importHeaders = headersRef.current;
    const importExampleRow = exampleRowRef.current;
    const sheetRows = uploadedSheetRowsRef.current ?? undefined;
    let cancelled = false;

    const initUniver = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));

        if (!containerRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (cancelled || !containerRef.current) {
          if (!cancelled && !containerRef.current) {
            messageApi.error('容器元素不存在，请刷新页面重试');
          }
          return;
        }

        try {
          setLoading(true);

          // 创建容器 ID（确保唯一）
          const containerId = `univer-sheet-import-${Date.now()}`;
          containerIdRef.current = containerId;
          containerRef.current.id = containerId;

          // 清空容器内容
          containerRef.current.innerHTML = '';

          // 等待 DOM 更新完成
          await new Promise(resolve => setTimeout(resolve, 100));

          if (cancelled) return;

          const { univer, univerAPI } = createUniver({
            locale: LocaleType.ZH_CN,
            locales: {
              [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
            },
            theme: defaultTheme,
            darkMode: isDark,
            presets: [
              UniverSheetsCorePreset({
                container: containerId,
              }),
            ],
          });

          if (cancelled) {
            try {
              univer.dispose();
            } catch {
              // ignore
            }
            return;
          }

          const { cellData, columnCount, rowCount, sheetStyles } = buildImportCellData({
            headers: importHeaders,
            exampleRow: importExampleRow,
            sheetRows,
          });

          univerAPI.createWorkbook({
            name: '导入数据',
            sheets: {
              'sheet-1': {
                id: 'sheet-1',
                name: 'Sheet1',
                cellData: cellData,
                styles: sheetStyles.styles,
                rowCount: rowCount,
                columnCount: columnCount,
                defaultColumnWidth: 120, // 设置默认列宽为 120 像素
              } as any, // 使用类型断言绕过类型检查
            },
          });

          univerInstanceRef.current = { univer, univerAPI };
          lastInitGenerationRef.current = sheetGeneration;

          await new Promise(resolve => setTimeout(resolve, 200));

          if (cancelled) return;

          try {
            // 获取活动工作表
            const workbook = univerAPI.getActiveWorkbook();
            if (workbook) {
              const worksheet = workbook.getActiveSheet();
              if (worksheet) {
                // 自动调整所有列的宽度以适应内容
                // 根据 Univer 文档，autoResizeColumns 方法在 worksheet 对象上
                // @ts-ignore - Univer API 类型定义可能不完整
                if (typeof worksheet.autoResizeColumns === 'function') {
                  // @ts-ignore
                  worksheet.autoResizeColumns(0, columnCount);
                  console.log(`✓ 列宽已自动调整（共 ${columnCount} 列）`);
                }
                // 如果 worksheet 上没有，尝试通过 workbook 调用
                // @ts-ignore
                else if (typeof workbook.autoResizeColumns === 'function') {
                  // @ts-ignore
                  workbook.autoResizeColumns(0, columnCount);
                  console.log(`✓ 列宽已自动调整（通过 workbook，共 ${columnCount} 列）`);
                }
                // 最后尝试通过 univerAPI 调用
                // @ts-ignore
                else if (typeof univerAPI.autoResizeColumns === 'function') {
                  // @ts-ignore
                  univerAPI.autoResizeColumns(0, columnCount);
                  console.log(`✓ 列宽已自动调整（通过 univerAPI，共 ${columnCount} 列）`);
                } else {
                  console.warn('⚠ autoResizeColumns 方法不可用，列宽将使用默认值 120px');
                }
              }
            }
          } catch (error) {
            console.warn('⚠ 自动调整列宽失败：', error);
            // 不影响主流程，继续执行
          }

          // 添加键盘事件监听器，确保 Univer Sheet 的快捷键优先级高于浏览器默认快捷键
          const handleKeyDown = (e: KeyboardEvent) => {
            // 检查是否在 Univer 容器内
            const container = containerRef.current;
            if (!container) return;

            // 检查焦点是否在容器内或其子元素内
            const activeElement = document.activeElement;
            const isInContainer = container.contains(activeElement) ||
              container === activeElement;

            if (!isInContainer) return;

            // 处理 Ctrl+D（或 Cmd+D on Mac）
            // Ctrl+D 在浏览器中是"添加书签"的快捷键
            // 如果 Univer Sheet 支持 Ctrl+D（通常用于向下复制单元格内容），需要阻止浏览器默认行为
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey && !e.altKey) {
              // 阻止浏览器默认行为（添加书签）
              e.preventDefault();
              e.stopPropagation();
              // 让 Univer Sheet 自己处理这个快捷键（如果它支持的话）
              // 如果 Univer 不支持，这个事件会被忽略，不会造成问题
            }

            // 可以在这里添加其他需要优先处理的快捷键
            // 例如：Ctrl+S（保存）、Ctrl+Z（撤销）、Ctrl+Y（重做）等
            // 这些快捷键在浏览器中也有默认行为，但在表格编辑器中应该优先处理
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'z' || e.key === 'y')) {
              if (!e.shiftKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          };

          // 添加事件监听器（使用 capture 阶段，确保优先捕获）
          document.addEventListener('keydown', handleKeyDown, true);

          if (cancelled || !univerInstanceRef.current) {
            document.removeEventListener('keydown', handleKeyDown, true);
            return;
          }
          (univerInstanceRef.current as any)._keyDownHandler = handleKeyDown;

          await new Promise(resolve => setTimeout(resolve, 500));

          if (cancelled) return;

          if (!sheetRows) {
            if (importHeaders && importHeaders.length > 0) {
              if (importExampleRow && importExampleRow.length > 0) {
                messageApi.success('表格已加载，表头和示例数据已自动填充，请从第三行开始填写数据');
              } else {
                messageApi.success('表格已加载，表头已自动填充，请从第二行开始填写数据');
              }
            } else {
              messageApi.success('表格已加载，可以开始编辑数据');
            }
          }
        } catch (error: any) {
          if (!cancelled) {
            messageApi.error('表格加载失败：' + (error.message || '未知错误'));
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    initUniver();

    return () => {
      cancelled = true;
      setLoading(false);
      disposeUniverInstance();
    };
  }, [open, visible, isDark, sheetGeneration, disposeUniverInstance]);

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
      uploadedSheetRowsRef.current = rows;
      disposeUniverInstance();
      lastInitGenerationRef.current = -1;
      setSheetGeneration(gen => gen + 1);
      messageApi.success(t('components.uniImport.uploadSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(t('components.uniImport.uploadFailed', { message: msg }));
    } finally {
      setXlsxBusy(false);
    }
    return false;
  };

  const applyMappedRowsToSheet = (mappedRows: string[][]) => {
    uploadedSheetRowsRef.current = mappedRows;
    disposeUniverInstance();
    lastInitGenerationRef.current = -1;
    setSheetGeneration(gen => gen + 1);
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
    applyMappedRowsToSheet(mappedRows);
    setMappingModalOpen(false);
    messageApi.success(t('components.uniImport.mappingApplySuccess'));
  };

  const runImportPrecheck = useCallback(
    async (data: any[][]) => {
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
    [onImportPrecheck, t],
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

  const commitImport = (data: any[][]) => {
    onConfirm(data);
    setPreviewModalOpen(false);
    onCancel();
  };

  const handlePreviewConfirmImport = () => {
    if (precheckResult?.errors?.length) {
      return;
    }
    commitImport(previewData);
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

      if (enableImportPreview) {
        openImportPreview(data);
        return;
      }

      onConfirm(data);
      onCancel();
    } catch (error: any) {
      messageApi.error('获取表格数据失败：' + (error.message || '未知错误'));
    }
  };

  return (
    <>
      {/* Univer Sheet 基本样式 */}
      {(open ?? visible) && (
        <style>{`
          .uni-import-modal .ant-modal-title {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            padding-right: 0px !important; /* 避开右侧的关闭按钮 */
          }
          .uni-import-modal .ant-modal-body {
            padding: 8px 0 !important;
          }
          #${containerIdRef.current} {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
        `}</style>
      )}
      <Modal
        className="uni-import-modal"
        wrapClassName={isFullscreen ? 'uni-import-modal-fullscreen' : undefined}
        title={
          <>
            <span>{title}</span>
            <Button
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              style={{
                borderRadius: '16px',
                height: '32px',
                padding: '0 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                marginRight: -10, // 微调使其更靠近关闭按钮但留有余地
              }}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </>
        }
        open={open ?? visible}
        onCancel={onCancel}
        width={isFullscreen ? '100vw' : width}
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
            {showXlsxTools || showMappingImport ? (
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
        centered={!isFullscreen}
        style={
          isFullscreen
            ? {
                top: 0,
                maxWidth: '100vw',
                margin: 0,
                paddingBottom: 0,
              }
            : undefined
        }
        styles={{
          body: {
            padding: '16px',
            height: isFullscreen ? undefined : `${height}px`,
            maxHeight: isFullscreen ? 'none' : undefined,
            overflow: 'hidden',
          },
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: isFullscreen ? '100%' : `${height - 12}px`,
            minHeight: isFullscreen
              ? getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.UNIVER_IMPORT_FULLSCREEN_CONTAINER_PX)
              : `${height - 12}px`,
            border: `1px solid ${token.colorBorder}`,
          }}
        />
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12 }}>正在加载表格...</div>
            </div>
          </div>
        )}
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


