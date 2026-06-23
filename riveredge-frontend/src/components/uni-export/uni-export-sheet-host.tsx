/**
 * Univer 导出表格宿主：须作为 Modal 子树挂载（同 uni-import）。
 */
import React, { useLayoutEffect, useRef } from 'react';

import {
  createUniverSheetInstance,
  runAfterUniverSheetsRenderServiceInit,
  type UniverSheetInstance,
} from '../univer/bootstrap-sheet';

export interface UniExportSheetHostProps {
  isDark: boolean;
  data: any[][];
  headers?: string[];
  height: number;
  onLoadingChange: (loading: boolean) => void;
  instanceRef: React.MutableRefObject<UniverSheetInstance | null>;
  onError: (message: string) => void;
}

export const UniExportSheetHost: React.FC<UniExportSheetHostProps> = ({
  isDark,
  data,
  headers,
  height,
  onLoadingChange,
  instanceRef,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      return undefined;
    }

    let active = true;
    onLoadingChange(true);

    const containerId = 'univer-sheet-export';
    containerEl.id = containerId;
    containerEl.replaceChildren();

    let pendingInstance: UniverSheetInstance | null = null;

    try {
      pendingInstance = createUniverSheetInstance({
        containerId,
        darkMode: isDark,
      });
    } catch (error) {
      onLoadingChange(false);
      onError(error instanceof Error ? error.message : String(error));
      return undefined;
    }

    runAfterUniverSheetsRenderServiceInit(() => {
      if (!active || !pendingInstance) {
        pendingInstance?.univer.dispose();
        return;
      }

      const instance = pendingInstance;

      try {
        const cellData: Record<string, Record<string, { v: any; m?: string; s?: any }>> = {};
        const styles: Record<string, any> = {};

        const headerStyleId = 'headerStyle';
        styles[headerStyleId] = {
          bg: { rgb: 'E3F2FD' },
          bl: 1,
          bt: 1,
          br: 1,
          bb: 1,
          fs: 12,
          bd: 1,
          cl: { rgb: '000000' },
        };

        let rowCount = 100;
        let columnCount = 20;

        if (data.length > 0) {
          rowCount = data.length;
          columnCount = Math.max(...data.map(row => row.length));

          data.forEach((row, rowIndex) => {
            const rowKey = String(rowIndex);
            cellData[rowKey] = {};

            row.forEach((cell, colIndex) => {
              const colKey = String(colIndex);
              const cellValue = cell !== null && cell !== undefined ? String(cell) : '';

              cellData[rowKey][colKey] = {
                v: cellValue,
                m: cellValue,
                s: rowIndex === 0 && headers ? headerStyleId : undefined,
              };
            });
          });
        } else if (headers && headers.length > 0) {
          rowCount = 1;
          columnCount = headers.length;

          headers.forEach((header, colIndex) => {
            const colKey = String(colIndex);
            cellData['0'] = cellData['0'] || {};
            cellData['0'][colKey] = {
              v: header,
              m: header,
              s: headerStyleId,
            };
          });
        }

        instance.univerAPI.createWorkbook({
          name: '导出数据',
          sheets: {
            'sheet-1': {
              id: 'sheet-1',
              name: 'Sheet1',
              cellData,
              styles,
              rowCount,
              columnCount,
              defaultColumnWidth: 100,
            } as any,
          },
        });

        if (!active) {
          instance.univer.dispose();
          return;
        }

        instanceRef.current = instance;
        onLoadingChange(false);
      } catch (error) {
        if (active) {
          onLoadingChange(false);
          onError(error instanceof Error ? error.message : String(error));
        }
        instance.univer.dispose();
      }
    });

    return () => {
      active = false;
      const instance = instanceRef.current ?? pendingInstance;
      if (instance) {
        instance.univer.dispose();
        instanceRef.current = null;
      }
    };
  }, [isDark, data, headers, instanceRef, onLoadingChange, onError]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: height,
        border: '1px solid var(--river-border-color)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    />
  );
};
