/**
 * Univer Export 导出弹窗组件
 * 
 * 使用 Univer Sheet 进行 Excel 数据导出
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Modal, Button, Space, App } from 'antd';
import { DownloadOutlined, CloseOutlined } from '@ant-design/icons';

// 引入 Univer Sheet 样式
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

// 引入手动依赖注册所需模块
// (已移除手动插件引用，因为改用 Preset 管理)

// 引入 Univer 预设（与 Git 旧版一致：仅 Sheets）
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';

/**
 * Univer Export 导出弹窗组件属性
 */
export interface UniExportProps {
  /**
   * 弹窗是否可见
   */
  visible: boolean;
  /**
   * 关闭弹窗回调
   */
  onCancel: () => void;
  /**
   * 确认导出回调
   * @param data - 导出的数据（二维数组格式）
   */
  onConfirm: (data: any[][]) => void;
  /**
   * 弹窗标题（默认：'导出数据'）
   */
  title?: string;
  /**
   * 弹窗宽度（默认：1200）
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
   * 确认按钮文本（默认：'确认导出'）
   */
  confirmText?: string;
  /**
   * 取消按钮文本（默认：'取消'）
   */
  cancelText?: string;
  /**
   * 初始数据（二维数组格式）
   */
  data?: any[][];
  /**
   * 表头数据（可选，如果提供则自动填充第一行）
   */
  headers?: string[];
}

/**
 * Univer Export 导出弹窗组件
 */
export const UniExport: React.FC<UniExportProps> = ({
  visible,
  onCancel,
  onConfirm,
  title = '导出数据',
  width = 1200,
  height = 600,
  showConfirmButton = true,
  showCancelButton = true,
  confirmText = '确认导出',
  cancelText = '取消',
  data = [],
  headers,
}) => {
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const univerInstanceRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const containerIdRef = useRef<string>('');
  // 与 app 主题一致：以 document.colorScheme 为准（主题编辑选择），未设置时才用系统偏好
  const colorScheme = document.documentElement.style.colorScheme;
  const isDark = colorScheme === 'dark'
    || (colorScheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  /**
   * 初始化 Univer Sheet
   */
  useLayoutEffect(() => {
    if (visible) {
      const initUniver = async () => {
        // 等待 DOM 更新
        await new Promise(resolve => setTimeout(resolve, 50));

        if (!containerRef.current) {
          return;
        }

        try {
          setLoading(true);

          // 创建容器 ID（确保唯一）
          const containerId = `univer-sheet-export-${Date.now()}`;
          containerIdRef.current = containerId;
          containerRef.current.id = containerId;

          // 清空容器内容
          containerRef.current.innerHTML = '';

          // 等待 DOM 更新完成
          await new Promise(resolve => setTimeout(resolve, 100));

          // 使用预设方式创建 Univer 实例（isDark 随主题编辑切换，见 useLayoutEffect 依赖）
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

          // 保存实例引用
          univerInstanceRef.current = { univer, univerAPI };

          // 准备单元格数据
          const cellData: Record<string, Record<string, { v: any; m?: string; s?: any }>> = {};
          const styles: Record<string, any> = {};

          // 表头样式（浅蓝色背景，加粗字体）
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

          // 准备数据
          let rowCount = 0;
          let columnCount = 0;

          // 如果有初始数据，使用初始数据
          if (data && data.length > 0) {
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
            // 如果有表头，填充表头
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
          } else {
            // 默认空表格
            rowCount = 100;
            columnCount = 20;
          }

          // 设置工作表数据
          const worksheet = univerAPI.getActiveWorkbook().getActiveSheet();
          if (worksheet) {
            // 设置单元格数据
            Object.keys(cellData).forEach((rowKey) => {
              Object.keys(cellData[rowKey]).forEach((colKey) => {
                const cell = cellData[rowKey][colKey];
                worksheet.setCellValue(Number(rowKey), Number(colKey), cell.v);
                if (cell.s) {
                  worksheet.setCellStyle(Number(rowKey), Number(colKey), styles[cell.s]);
                }
              });
            });

            // 设置列宽
            for (let i = 0; i < columnCount; i++) {
              worksheet.setColumnWidth(i, 100);
            }
          }

          setLoading(false);
        } catch (error) {
          console.error('初始化 Univer Sheet 失败:', error);
          message.error('初始化表格失败');
          setLoading(false);
        }
      };

      initUniver();
    }

    // 清理函数
    return () => {
      if (univerInstanceRef.current?.univer) {
        try {
          univerInstanceRef.current.univer.dispose();
        } catch (error) {
          console.error('清理 Univer 实例失败:', error);
        }
        univerInstanceRef.current = null;
      }
    };
  }, [visible, isDark, data, headers]);

  /**
   * 处理确认导出
   */
  const handleConfirm = async () => {
    try {
      if (!univerInstanceRef.current?.univerAPI) {
        message.warning('表格未初始化');
        return;
      }

      const univerAPI = univerInstanceRef.current.univerAPI;
      const worksheet = univerAPI.getActiveWorkbook().getActiveSheet();

      if (!worksheet) {
        message.warning('无法获取工作表');
        return;
      }

      // 获取所有单元格数据
      const rowCount = worksheet.getRowCount();
      const columnCount = worksheet.getColumnCount();
      const exportData: any[][] = [];

      for (let row = 0; row < rowCount; row++) {
        const rowData: any[] = [];
        for (let col = 0; col < columnCount; col++) {
          const cellValue = worksheet.getCellValue(row, col);
          rowData.push(cellValue || '');
        }
        // 只添加非空行
        if (rowData.some(cell => cell !== '')) {
          exportData.push(rowData);
        }
      }

      if (exportData.length === 0) {
        message.warning('没有可导出的数据');
        return;
      }

      onConfirm(exportData);
      message.success('数据已准备就绪，可以导出');
    } catch (error) {
      console.error('导出数据失败:', error);
      message.error('导出数据失败');
    }
  };

  return (
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
              icon={<DownloadOutlined />}
              onClick={handleConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          )}
        </Space>
      }
      destroyOnClose
      maskClosable={false}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: height,
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      />
    </Modal>
  );
};

export default UniExport;
