/**
 * Univer 表格宿主：必须作为 Modal 子树挂载。
 * 粘贴：监听 BeforeClipboardPaste，取消默认粘贴，用 HTML x:num 完整数值强制文本写入。
 *
 * 重建条件仅绑定「表格种子」内容（暗色/上传行/表头/示例行），下拉选项变更只重打 Data Validation，
 * 避免 columnOptions 异步到位时 dispose+重建竞态触发 getSheetBySheetId on null。
 *
 * 超宽横滚只走 Univer 视口自带滚动条：宿主 width/max-width:100% + min-width:0 + overflow:hidden，
 * 尺寸变化时用 clientWidth 驱动 engine.resizeBySize（见 relayoutUniverSheet）。
 */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Spin, theme } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { useTranslation } from 'react-i18next';

import {
  createUniverSheetInstance,
  relayoutUniverSheet,
  runAfterUniverSheetsRenderServiceInit,
  type UniverSheetInstance,
} from '../univer/bootstrap-sheet';
import { applyImportColumnDropdowns } from './apply-import-column-dropdowns';
import { buildImportCellData, buildImportStringRows } from './build-import-cell-data';
import { pasteClipboardAsForceString } from './paste-import-text';

const UNIVER_COPY_COMMAND = 'univer.command.copy';
const UNIVER_CUT_COMMAND = 'univer.command.cut';

function isKeyboardEventInSheetContainer(container: HTMLElement, event: KeyboardEvent): boolean {
  const target = event.target;
  const activeElement = document.activeElement;
  return (
    (target instanceof Node && container.contains(target)) ||
    (activeElement instanceof Node && container.contains(activeElement))
  );
}

function focusSheetContainer(container: HTMLElement) {
  if (typeof container.focus === 'function') {
    container.focus({ preventScroll: true });
  }
}

function safeDisposeUniver(instance: UniverSheetInstance | null | undefined) {
  if (!instance) return;
  try {
    instance.univer.dispose();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // dispose 过程中渲染/DV 回调可能仍访问已空的 unit.getSheetBySheetId
    if (
      msg.includes("Failed to execute 'removeChild' on 'Node'") ||
      msg.includes('getSheetBySheetId')
    ) {
      return;
    }
    console.warn('univer dispose failed:', error);
  }
}

function safeClearContainer(container: HTMLElement | null | undefined) {
  if (!container) return;
  try {
    container.textContent = '';
  } catch (error) {
    console.warn('clear univer container failed:', error);
  }
}

export interface UniImportSheetHostProps {
  isDark: boolean;
  uploadedSheetRows: string[][] | null;
  headers?: string[];
  exampleRow?: string[];
  /** 与 headers 等长；某列有选项时示例行+数据区启用下拉 */
  columnOptions?: Array<string[] | undefined>;
  height: number;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  instanceRef: React.MutableRefObject<UniverSheetInstance | null>;
  messageApi: MessageInstance;
  /**
   * 同步字符串矩阵（唯一确认数据源）。
   * init / 上传重建 / 粘贴后都会回调；禁止确认时再从 Univer scrape。
   */
  onSheetRowsChange?: (rows: string[][]) => void;
}

export const UniImportSheetHost: React.FC<UniImportSheetHostProps> = ({
  isDark,
  uploadedSheetRows,
  headers,
  exampleRow,
  columnOptions,
  height,
  loading,
  onLoadingChange,
  instanceRef,
  messageApi,
  onSheetRowsChange,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountSeqRef = useRef(0);
  const keyDownHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const pasteHandlerRef = useRef<((e: ClipboardEvent) => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const eventDisposableRef = useRef<{ dispose?: () => void } | null>(null);
  const onSheetRowsChangeRef = useRef(onSheetRowsChange);
  onSheetRowsChangeRef.current = onSheetRowsChange;
  const precisionRowsRef = useRef<string[][] | null>(uploadedSheetRows);
  const rowCountRef = useRef(0);
  const columnOptionsRef = useRef(columnOptions);
  columnOptionsRef.current = columnOptions;
  const tRef = useRef(t);
  tRef.current = t;
  const messageApiRef = useRef(messageApi);
  messageApiRef.current = messageApi;
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;

  /** 仅内容变化时重建 Univer，避免父组件每次 render 新数组引用导致 dispose 竞态 */
  const sheetSeedKey = useMemo(
    () =>
      JSON.stringify({
        isDark,
        uploadedSheetRows,
        headers,
        exampleRow,
      }),
    [isDark, uploadedSheetRows, headers, exampleRow],
  );

  const columnOptionsKey = useMemo(() => JSON.stringify(columnOptions ?? null), [columnOptions]);

  useLayoutEffect(() => {
    precisionRowsRef.current = uploadedSheetRows;
  }, [uploadedSheetRows]);

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      return undefined;
    }

    let active = true;
    const mountToken = ++mountSeqRef.current;
    onLoadingChangeRef.current(true);

    safeClearContainer(containerEl);
    const mountEl = document.createElement('div');
    mountEl.style.width = '100%';
    mountEl.style.maxWidth = '100%';
    mountEl.style.minWidth = '0';
    mountEl.style.height = '100%';
    mountEl.style.boxSizing = 'border-box';
    const containerId = `univer-sheet-import-${Date.now()}-${mountToken}`;
    mountEl.id = containerId;
    containerEl.appendChild(mountEl);

    const sheetRows = uploadedSheetRows ?? undefined;
    let pendingInstance: UniverSheetInstance | null = null;

    try {
      pendingInstance = createUniverSheetInstance({
        containerId,
        darkMode: isDark,
      });
    } catch (error: unknown) {
      onLoadingChangeRef.current(false);
      const msg = error instanceof Error ? error.message : String(error);
      messageApiRef.current.error(tRef.current('components.uniImport.sheetLoadFailed', { message: msg }));
      return undefined;
    }

    let pasteInFlight = false;
    let lastPasteAt = 0;
    /** true=写入成功；duplicate=另一路已处理（勿报失败）；false=真正失败 */
    const pastePreservingPrecision = (clipboard: {
      html?: string | null;
      plain?: string | null;
    }): true | false | 'duplicate' => {
      const now = Date.now();
      // BeforeClipboardPaste 与 document paste 可能连打两次，100ms 内只处理一次
      if (pasteInFlight || now - lastPasteAt < 100) return 'duplicate';
      pasteInFlight = true;
      try {
        const current = instanceRef.current;
        if (!current?.univerAPI) return false;
        const seed =
          precisionRowsRef.current ??
          (headers && headers.length
            ? [
                headers.map((h) => String(h ?? '')),
                (exampleRow ?? []).map((c) => String(c ?? '')),
              ]
            : []);
        const merged = pasteClipboardAsForceString(current.univerAPI, clipboard, seed);
        if (!merged) return false;
        precisionRowsRef.current = merged;
        onSheetRowsChangeRef.current?.(merged);
        lastPasteAt = now;
        return true;
      } finally {
        pasteInFlight = false;
      }
    };

    runAfterUniverSheetsRenderServiceInit(() => {
      if (!active || mountSeqRef.current !== mountToken || !pendingInstance) {
        safeDisposeUniver(pendingInstance);
        return;
      }

      const instance = pendingInstance;

      try {
        const { cellData, rowCount, columnCount, sheetStyles } = buildImportCellData({
          headers,
          exampleRow,
          sheetRows,
        });
        rowCountRef.current = rowCount;

        const workbook = instance.univerAPI.createWorkbook({
          id: containerId,
          name: tRef.current('components.uniImport.workbookName'),
          sheetOrder: ['sheet-1'],
          sheets: {
            'sheet-1': {
              id: 'sheet-1',
              name: 'Sheet1',
              cellData,
              styles: sheetStyles.styles,
              rowCount,
              columnCount,
              defaultColumnWidth: 120,
            } as any,
          },
        });

        // 关窗 / 上传重建与 microtask 竞态：createWorkbook 后若 token 已失效，禁止再碰 sheet / DV
        if (!active || mountSeqRef.current !== mountToken) {
          safeDisposeUniver(instance);
          return;
        }

        const sheet =
          workbook?.getSheetBySheetId?.('sheet-1') ?? workbook?.getActiveSheet?.() ?? null;
        applyImportColumnDropdowns(
          instance.univerAPI as any,
          columnOptionsRef.current,
          rowCount,
          sheet,
        );

        if (!active || mountSeqRef.current !== mountToken) {
          safeDisposeUniver(instance);
          return;
        }

        instanceRef.current = instance;
        relayoutUniverSheet(instance, containerRef.current);

        const seedRows = buildImportStringRows({
          headers,
          exampleRow,
          sheetRows,
        });
        precisionRowsRef.current = seedRows;
        onSheetRowsChangeRef.current?.(seedRows);

        // 官方粘贴前钩子：取消默认粘贴，改用 HTML x:num 完整精度写入
        try {
          const api = instance.univerAPI as any;
          const eventName = api.Event?.BeforeClipboardPaste ?? 'BeforeClipboardPaste';
          if (typeof api.addEvent === 'function') {
            eventDisposableRef.current = api.addEvent(
              eventName,
              (params: { text?: string; html?: string; cancel?: boolean }) => {
                // 始终拦住 Univer 默认粘贴（会按数值写格、扩大选区清空右侧/下方）
                params.cancel = true;
                const html = params.html ?? '';
                const plain = params.text ?? '';
                // 钩子里常无剪贴板正文，交给 document paste；勿报失败
                if (!html && !plain) return;
                const result = pastePreservingPrecision({ html, plain });
                if (result === false) {
                  messageApiRef.current.warning(tRef.current('components.uniImport.pasteFailed'));
                }
              },
            );
          }
        } catch (error) {
          console.warn('register BeforeClipboardPaste failed:', error);
        }

        const containerForResize = containerRef.current;
        if (containerForResize) {
          resizeObserverRef.current?.disconnect();
          const observer = new ResizeObserver(() => {
            if (mountSeqRef.current !== mountToken) return;
            const current = instanceRef.current;
            if (current) {
              relayoutUniverSheet(current, containerRef.current);
            }
          });
          observer.observe(containerForResize);
          resizeObserverRef.current = observer;
        }

        // 兜底：若 Univer 未触发 BeforeClipboardPaste，仍拦截原生 paste
        const handlePaste = (e: ClipboardEvent) => {
          const container = containerRef.current;
          if (!container) return;
          const inSheet =
            (e.target instanceof Node && container.contains(e.target)) ||
            (document.activeElement instanceof Node &&
              container.contains(document.activeElement)) ||
            document.activeElement === container;
          if (!inSheet) return;

          const html = e.clipboardData?.getData('text/html') ?? '';
          const plain = e.clipboardData?.getData('text/plain') ?? '';
          if (!html && !plain) return;

          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();

          const result = pastePreservingPrecision({ html, plain });
          if (result === false) {
            messageApiRef.current.warning(tRef.current('components.uniImport.pasteFailed'));
          }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          const container = containerRef.current;
          if (!container || !isKeyboardEventInSheetContainer(container, e)) return;

          if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.defaultPrevented) {
            const key = e.key.toLowerCase();
            if (key === 'c' || key === 'x') {
              const current = instanceRef.current;
              if (current?.univerAPI) {
                e.preventDefault();
                e.stopPropagation();
                void current.univerAPI.executeCommand(
                  key === 'c' ? UNIVER_COPY_COMMAND : UNIVER_CUT_COMMAND,
                );
                return;
              }
            }
          }

          if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'z' || e.key === 'y')) {
            if (!e.shiftKey && !e.altKey) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        };

        keyDownHandlerRef.current = handleKeyDown;
        pasteHandlerRef.current = handlePaste;
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('paste', handlePaste, true);

        focusSheetContainer(containerEl);

        if (!sheetRows) {
          if (headers && headers.length > 0) {
            if (exampleRow && exampleRow.length > 0) {
              messageApiRef.current.success(
                tRef.current('components.uniImport.sheetLoadedWithPasteHint'),
              );
            } else {
              messageApiRef.current.success(
                tRef.current('components.uniImport.sheetLoadedHeaderOnly'),
              );
            }
          } else {
            messageApiRef.current.success(tRef.current('components.uniImport.sheetLoadedEmpty'));
          }
        }

        onLoadingChangeRef.current(false);
      } catch (error: unknown) {
        if (active) {
          onLoadingChangeRef.current(false);
          const msg = error instanceof Error ? error.message : String(error);
          messageApiRef.current.error(
            tRef.current('components.uniImport.sheetLoadFailed', { message: msg }),
          );
        }
        safeDisposeUniver(instance);
      }
    });

    return () => {
      active = false;
      if (mountSeqRef.current === mountToken) {
        mountSeqRef.current += 1;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      eventDisposableRef.current?.dispose?.();
      eventDisposableRef.current = null;
      const keyDownHandler = keyDownHandlerRef.current;
      if (keyDownHandler) {
        document.removeEventListener('keydown', keyDownHandler, true);
        keyDownHandlerRef.current = null;
      }
      const pasteHandler = pasteHandlerRef.current;
      if (pasteHandler) {
        document.removeEventListener('paste', pasteHandler, true);
        pasteHandlerRef.current = null;
      }
      // 先摘掉 ref，避免 dispose 过程中 ResizeObserver / DV effect 仍拿旧实例去 getSheetBySheetId
      const instance = instanceRef.current ?? pendingInstance;
      instanceRef.current = null;
      rowCountRef.current = 0;
      if (instance) {
        safeDisposeUniver(instance);
      }
      const root = containerRef.current;
      if (root && mountEl.parentNode === root) {
        root.removeChild(mountEl);
      } else {
        safeClearContainer(root);
      }
    };
  }, [sheetSeedKey, instanceRef]);

  // 下拉选项异步到位时只重打 DV，不 dispose 整表
  // 下拉选项异步到位时只重打 DV，不 dispose 整表
  useLayoutEffect(() => {
    const instance = instanceRef.current;
    const mountToken = mountSeqRef.current;
    if (!instance?.univerAPI || loading) return;
    const rowCount = rowCountRef.current;
    if (rowCount < 2) return;
    try {
      const workbook = instance.univerAPI.getActiveWorkbook?.() ?? null;
      if (!workbook) return;
      // 再次确认未被 cleanup 摘掉（dispose 竞态）
      if (instanceRef.current !== instance || mountSeqRef.current !== mountToken) return;
      const sheet = workbook.getSheetBySheetId?.('sheet-1') ?? workbook.getActiveSheet?.() ?? null;
      applyImportColumnDropdowns(instance.univerAPI as any, columnOptions, rowCount, sheet);
    } catch {
      // workbook 已卸载
    }
  }, [columnOptionsKey, columnOptions, loading, instanceRef]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <div
        className="uni-import-sheet-host"
        ref={containerRef}
        tabIndex={-1}
        onMouseDown={() => {
          if (containerRef.current) {
            focusSheetContainer(containerRef.current);
          }
        }}
        style={{
          outline: 'none',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          height: '100%',
          minHeight: height > 0 ? undefined : 480,
          border: `1px solid ${token.colorBorder}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            background: token.colorBgMask,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12 }}>{t('components.uniImport.sheetLoading')}</div>
          </div>
        </div>
      )}
    </div>
  );
};
