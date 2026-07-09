/**
 * Univer 表格宿主：必须作为 Modal 子树挂载。
 * 粘贴：监听 BeforeClipboardPaste，取消默认粘贴，用 HTML x:num 完整数值强制文本写入。
 */
import React, { useLayoutEffect, useRef } from 'react';
import { Spin, theme } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

import {
  createUniverSheetInstance,
  relayoutUniverSheet,
  runAfterUniverSheetsRenderServiceInit,
  type UniverSheetInstance,
} from '../univer/bootstrap-sheet';
import { buildImportCellData } from './build-import-cell-data';
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
    if (!msg.includes("Failed to execute 'removeChild' on 'Node'")) {
      console.warn('univer dispose failed:', error);
    }
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
  height: number;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  instanceRef: React.MutableRefObject<UniverSheetInstance | null>;
  messageApi: MessageInstance;
  /** 粘贴后同步字符串矩阵（剪贴板原文），供确认导入使用 */
  onSheetRowsChange?: (rows: string[][]) => void;
}

export const UniImportSheetHost: React.FC<UniImportSheetHostProps> = ({
  isDark,
  uploadedSheetRows,
  headers,
  exampleRow,
  height,
  loading,
  onLoadingChange,
  instanceRef,
  messageApi,
  onSheetRowsChange,
}) => {
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

  useLayoutEffect(() => {
    precisionRowsRef.current = uploadedSheetRows;
  }, [uploadedSheetRows]);

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      return undefined;
    }

    let active = true;
    onLoadingChange(true);

    safeClearContainer(containerEl);
    const mountEl = document.createElement('div');
    mountEl.style.width = '100%';
    mountEl.style.height = '100%';
    const containerId = `univer-sheet-import-${Date.now()}-${mountSeqRef.current++}`;
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
      onLoadingChange(false);
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error('表格加载失败：' + msg);
      return undefined;
    }

    let pasteInFlight = false;
    let lastPasteAt = 0;
    const pastePreservingPrecision = (clipboard: {
      html?: string | null;
      plain?: string | null;
    }) => {
      const now = Date.now();
      // BeforeClipboardPaste 与 document paste 可能连打两次，100ms 内只处理一次
      if (pasteInFlight || now - lastPasteAt < 100) return false;
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
      if (!active || !pendingInstance) {
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

        instance.univerAPI.createWorkbook({
          name: '导入数据',
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

        if (!active) {
          safeDisposeUniver(instance);
          return;
        }

        instanceRef.current = instance;
        relayoutUniverSheet(instance);

        // 官方粘贴前钩子：取消默认粘贴，改用 HTML x:num 完整精度写入
        try {
          const api = instance.univerAPI as any;
          const eventName = api.Event?.BeforeClipboardPaste ?? 'BeforeClipboardPaste';
          if (typeof api.addEvent === 'function') {
            eventDisposableRef.current = api.addEvent(
              eventName,
              (params: { text?: string; html?: string; cancel?: boolean }) => {
                params.cancel = true;
                const ok = pastePreservingPrecision({
                  html: params.html ?? '',
                  plain: params.text ?? '',
                });
                if (!ok) {
                  messageApi.warning('粘贴失败，请改用「上传 Excel」以保留完整精度');
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
            const current = instanceRef.current;
            if (current) {
              relayoutUniverSheet(current);
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

          const ok = pastePreservingPrecision({ html, plain });
          if (!ok) {
            messageApi.warning('粘贴失败，请改用「上传 Excel」以保留完整精度');
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
              messageApi.success(
                '表格已加载。从 Excel 粘贴会保留完整小数；更稳妥请用「上传 Excel」',
              );
            } else {
              messageApi.success('表格已加载，表头已自动填充，请从第二行开始填写数据');
            }
          } else {
            messageApi.success('表格已加载，可以开始编辑数据');
          }
        }

        onLoadingChange(false);
      } catch (error: unknown) {
        if (active) {
          onLoadingChange(false);
          const msg = error instanceof Error ? error.message : String(error);
          messageApi.error('表格加载失败：' + msg);
        }
        safeDisposeUniver(instance);
      }
    });

    return () => {
      active = false;
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
      const instance = instanceRef.current ?? pendingInstance;
      if (instance) {
        safeDisposeUniver(instance);
        instanceRef.current = null;
      }
      const root = containerRef.current;
      if (root && mountEl.parentNode === root) {
        root.removeChild(mountEl);
      } else {
        safeClearContainer(root);
      }
    };
  }, [isDark, uploadedSheetRows, headers, exampleRow, instanceRef, messageApi, onLoadingChange]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
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
          height: `${height - 32}px`,
          minHeight: `${height - 32}px`,
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
            <div style={{ marginTop: 12 }}>正在加载表格...</div>
          </div>
        </div>
      )}
    </div>
  );
};
