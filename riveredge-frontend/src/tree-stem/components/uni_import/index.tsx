/**
 * Univer Import 导入弹窗组件
 * 
 * 使用 Univer Sheet 进行 Excel 数据导入
 * 已从 Luckysheet 迁移到 Univer Sheet
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Modal, Button, Space, App } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

// 引入 Univer Sheet 样式
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

// 引入 Univer 预设（简化初始化）
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';
import { UniverSheetsPlugin } from '@univerjs/sheets';

/**
 * Univer Import 导入弹窗组件属性
 */
export interface UniImportProps {
  /**
   * 弹窗是否可见
   */
  visible: boolean;
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
   * 弹窗宽度（默认：'90%'）
   */
  width?: string | number;
  /**
   * 表格容器高度（默认：600）
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
   * 下拉列配置（可选，定义哪些列需要下拉选项）
   * 格式：{ columnIndex: string[] } - 列索引对应的下拉选项数组
   */
  dropdownColumns?: Record<number, string[]>;
}

/**
 * Univer Import 导入弹窗组件
 */
export const UniImport: React.FC<UniImportProps> = ({
  visible,
  onCancel,
  onConfirm,
  title = '导入数据',
  width = '90%',
  height = 600,
  showConfirmButton = true,
  showCancelButton = true,
  confirmText = '确认导入',
  cancelText = '取消',
  headers,
  exampleRow,
  dropdownColumns,
}) => {
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const univerInstanceRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const containerIdRef = useRef<string>('');

  /**
   * 初始化 Univer Sheet
   */
  useLayoutEffect(() => {
    if (visible) {
      const initUniver = async () => {
        // 等待 DOM 更新
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!containerRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!containerRef.current) {
          message.error('容器元素不存在，请刷新页面重试');
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
          
          // 使用预设方式创建 Univer 实例
          const { univer, univerAPI } = createUniver({
            locale: LocaleType.ZH_CN,
            locales: {
              [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
            },
            theme: defaultTheme,
            presets: [
              UniverSheetsCorePreset({
                container: containerId,
              }),
            ],
          });
          
          // 准备单元格数据（如果有表头，填充第一行；如果有示例数据，填充第二行）
          const cellData: Record<string, Record<string, { v: any; m?: string; s?: any }>> = {};
          const columnCount = headers ? headers.length : 20;
          const dataRowCount = 100; // 数据区域行数
          
          // 准备样式对象
          const styles: Record<string, any> = {};
          
          // 表头样式（浅蓝色背景，加粗字体）
          const headerStyleId = 'headerStyle';
          styles[headerStyleId] = {
            bg: { rgb: 'E3F2FD' }, // 浅蓝色背景 #E3F2FD
            cl: { rgb: '000000' }, // 黑色文字
            fs: 12, // 字体大小
            bl: 1, // 加粗
            bd: {
              t: { s: 1, cl: { rgb: 'BBDEFB' } }, // 上边框
              b: { s: 1, cl: { rgb: 'BBDEFB' } }, // 下边框
              l: { s: 1, cl: { rgb: 'BBDEFB' } }, // 左边框
              r: { s: 1, cl: { rgb: 'BBDEFB' } }, // 右边框
            },
          };
          
          // 示例数据样式（浅灰色背景）
          const exampleStyleId = 'exampleStyle';
          styles[exampleStyleId] = {
            bg: { rgb: 'F5F5F5' }, // 浅灰色背景 #F5F5F5
            cl: { rgb: '000000' }, // 黑色文字
            fs: 12,
            bd: {
              t: { s: 1, cl: { rgb: 'E0E0E0' } },
              b: { s: 1, cl: { rgb: 'E0E0E0' } },
              l: { s: 1, cl: { rgb: 'E0E0E0' } },
              r: { s: 1, cl: { rgb: 'E0E0E0' } },
            },
          };
          
          // 数据区域边框样式
          const dataBorderStyleId = 'dataBorderStyle';
          styles[dataBorderStyleId] = {
            bd: {
              t: { s: 1, cl: { rgb: 'D0D0D0' } },
              b: { s: 1, cl: { rgb: 'D0D0D0' } },
              l: { s: 1, cl: { rgb: 'D0D0D0' } },
              r: { s: 1, cl: { rgb: 'D0D0D0' } },
            },
          };
          
          if (headers && headers.length > 0) {
            const headerRow: Record<string, { v: any; m?: string; s?: any }> = {};
            headers.forEach((header, colIndex) => {
              if (header) {
                headerRow[colIndex.toString()] = {
                  v: header,
                  m: header, // 显示值
                  s: headerStyleId, // 应用表头样式
                };
              }
            });
            cellData['0'] = headerRow; // 第一行（索引从 0 开始）
          }
          
          // 如果有示例数据，填充第二行
          if (exampleRow && exampleRow.length > 0) {
            const exampleDataRow: Record<string, { v: any; m?: string; s?: any }> = {};
            exampleRow.forEach((value, colIndex) => {
              if (value !== undefined && value !== null) {
                exampleDataRow[colIndex.toString()] = {
                  v: value,
                  m: String(value), // 显示值
                  s: exampleStyleId, // 应用示例数据样式
                };
              }
            });
            cellData['1'] = exampleDataRow; // 第二行（索引从 1 开始）
          }
          
          // 为数据区域（第3行到第100行）的所有单元格设置边框
          for (let r = 2; r < dataRowCount; r++) {
            const dataRow: Record<string, { v: any; s?: any }> = {};
            for (let c = 0; c < columnCount; c++) {
              dataRow[c.toString()] = {
                v: '', // 空值
                s: dataBorderStyleId, // 应用边框样式
              };
            }
            cellData[r.toString()] = dataRow;
          }
          
          // 创建工作簿（如果提供了表头，自动填充第一行）
          univerAPI.createWorkbook({
            name: '导入数据',
            sheets: {
              'sheet-1': {
                id: 'sheet-1',
                name: 'Sheet1',
                cellData: cellData,
                styles: styles, // 添加样式对象
                rowCount: dataRowCount,
                columnCount: columnCount,
              } as any, // 使用类型断言绕过类型检查
            },
          });
          
          // 保存实例引用
          univerInstanceRef.current = { univer, univerAPI };
          
          // 等待渲染完成
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 设置下拉列的数据验证（如果提供了 dropdownColumns）
          if (dropdownColumns && Object.keys(dropdownColumns).length > 0) {
            try {
              // @ts-ignore - Univer API 类型定义可能不完整
              const sheetsPlugin = univer.getPlugin(UniverSheetsPlugin);
              if (sheetsPlugin) {
                // @ts-ignore
                const workbookModel = sheetsPlugin.getWorkbook();
                if (workbookModel) {
                  // @ts-ignore
                  const sheetModel = workbookModel.getActiveSheet();
                  if (sheetModel) {
                    // 为每个下拉列设置数据验证
                    Object.keys(dropdownColumns).forEach((colIndexStr) => {
                      const colIndex = parseInt(colIndexStr, 10);
                      const options = dropdownColumns[colIndex];
                      if (options && options.length > 0) {
                        try {
                          // 设置数据验证为下拉列表
                          // 注意：Univer Sheet 的数据验证 API 可能不同，这里使用通用方式
                          // @ts-ignore
                          if (sheetModel.setDataValidation) {
                            // @ts-ignore
                            sheetModel.setDataValidation(colIndex, 1, 100, {
                              type: 'list',
                              allowBlank: true,
                              operator: 'between',
                              formula1: options.join(','),
                            });
                          } else if (sheetModel.addDataValidation) {
                            // 尝试使用 addDataValidation
                            // @ts-ignore
                            sheetModel.addDataValidation({
                              ranges: [{ startRow: 1, endRow: 100, startColumn: colIndex, endColumn: colIndex }],
                              type: 'list',
                              allowBlank: true,
                              formula1: options.join(','),
                            });
                          }
                        } catch (e) {
                          console.warn(`设置列 ${colIndex} 的数据验证失败：`, e);
                        }
                      }
                    });
                  }
                }
              }
            } catch (e) {
              console.warn('设置下拉列数据验证失败：', e);
            }
          }
          
          setLoading(false);
          if (headers && headers.length > 0) {
            if (exampleRow && exampleRow.length > 0) {
              message.success('表格已加载，表头和示例数据已自动填充，请从第三行开始填写数据');
            } else {
              message.success('表格已加载，表头已自动填充，请从第二行开始填写数据');
            }
          } else {
            message.success('表格已加载，可以开始编辑数据');
          }
        } catch (error: any) {
          setLoading(false);
          message.error('表格加载失败：' + (error.message || '未知错误'));
        }
      };

      initUniver();
    } else if (!visible && univerInstanceRef.current) {
      // 关闭弹窗时清理
      try {
        if (univerInstanceRef.current) {
          univerInstanceRef.current.univer.dispose();
          univerInstanceRef.current = null;
        }
      } catch (error) {
        // 忽略清理错误
      }
    }
  }, [visible, message]);

  /**
   * 处理确认导入
   */
  const handleConfirm = () => {
    try {
      const instance = univerInstanceRef.current;
      
      if (!instance) {
        message.error('表格未加载完成，请稍候再试');
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
            
            // 方法3：尝试直接访问 cellData
            if (data.length === 0 && worksheet.cellData) {
              data = convertCellDataToArray(worksheet.cellData);
            }
          } catch (e) {
            console.warn('从 worksheet 获取数据失败：', e);
          }
        }
        
        // 如果仍然没有数据，尝试从创建时的 cellData 获取
        if (data.length === 0) {
          message.warning('无法获取表格数据，请刷新页面重试');
          console.error('无法获取数据，worksheet:', worksheet);
          return;
        }
      } catch (error: any) {
        message.error('获取表格数据失败：' + (error.message || '未知错误'));
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
        
        // 创建二维数组
        for (let r = 0; r <= maxRow; r++) {
          const rowData: any[] = [];
          let hasData = false;
          
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
            if (value !== '' && value !== null && value !== undefined) {
              hasData = true;
            }
          }
          
          if (hasData) {
            result.push(rowData);
          }
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
        
        // 创建二维数组
        for (let r = 0; r <= maxRow; r++) {
          const rowData: any[] = [];
          let hasData = false;
          
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
            if (value !== '' && value !== null && value !== undefined) {
              hasData = true;
            }
          }
          
          if (hasData) {
            result.push(rowData);
          }
        }
        
        return result;
      }

      // 如果仍然没有数据
      if (data.length === 0) {
        message.warning('表格中没有有效数据，请先输入数据');
        return;
      }

      if (data.length === 0) {
        message.warning('表格中没有有效数据，请先输入数据');
        return;
      }

      // 调用确认回调
      onConfirm(data);
      
      // 关闭弹窗
      onCancel();
    } catch (error: any) {
      message.error('获取表格数据失败：' + (error.message || '未知错误'));
    }
  };

  return (
    <>
      {/* Univer Sheet 基本样式 */}
      {visible && (
        <style>{`
          .ant-modal-body {
            padding: 16px 0 !important;
          }
          #${containerIdRef.current} {
            width: 100%;
            height: 100%;
            border: 1px solid #e8e8e8;
            border-radius: 0px;
          }
        `}</style>
      )}
      <Modal
        title={title}
        open={visible}
        onCancel={onCancel}
        width={width}
        footer={
          <Space>
            {showCancelButton && (
              <Button icon={<CloseOutlined />} onClick={onCancel}>
                {cancelText}
              </Button>
            )}
            {showConfirmButton && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleConfirm}
                loading={loading}
              >
                {confirmText}
              </Button>
            )}
          </Space>
        }
        destroyOnClose={true}
        styles={{
          body: {
            padding: '16px',
            height: `${height}px`,
            overflow: 'hidden',
          },
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: `${height - 32}px`,
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
            <div>正在加载表格...</div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default UniImport;

