/**
 * Univer 表格宿主：必须作为 Modal 子树挂载。
 * rc-dialog + destroyOnHidden 在 open 首帧 animatedVisible 仍为 false 时不渲染 body，
 * 初始化只能在本组件 mount 后的 useLayoutEffect 中执行。
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

const UNIVER_COPY_COMMAND = 'univer.command.copy';
const UNIVER_CUT_COMMAND = 'univer.command.cut';
const UNIVER_PASTE_COMMAND = 'univer.command.paste';

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
    // 幂等清理：避免在节点已被移除时抛出 removeChild 竞态错误
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
}) => {
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountSeqRef = useRef(0);
  const keyDownHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

        const handleKeyDown = (e: KeyboardEvent) => {
          const container = containerRef.current;
          if (!container || !isKeyboardEventInSheetContainer(container, e)) return;

          if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.defaultPrevented) {
            const key = e.key.toLowerCase();
            if (key === 'c' || key === 'v' || key === 'x') {
              const current = instanceRef.current;
              if (current?.univerAPI) {
                e.preventDefault();
                e.stopPropagation();
                const commandId =
                  key === 'c'
                    ? UNIVER_COPY_COMMAND
                    : key === 'v'
                      ? UNIVER_PASTE_COMMAND
                      : UNIVER_CUT_COMMAND;
                void current.univerAPI.executeCommand(commandId);
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
        document.addEventListener('keydown', handleKeyDown, true);

        focusSheetContainer(containerEl);

        if (!sheetRows) {
          if (headers && headers.length > 0) {
            if (exampleRow && exampleRow.length > 0) {
              messageApi.success('表格已加载，表头和示例数据已自动填充，请从第三行开始填写数据');
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
      const keyDownHandler = keyDownHandlerRef.current;
      if (keyDownHandler) {
        document.removeEventListener('keydown', keyDownHandler, true);
        keyDownHandlerRef.current = null;
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
