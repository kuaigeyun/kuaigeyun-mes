/**
 * Univer Export 导出弹窗组件
 * 
 * 使用 Univer Sheet 进行 Excel 数据导出
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useRef, useState, useCallback } from 'react';
import { Modal, Button, Space, App } from 'antd';
import { DownloadOutlined, CloseOutlined } from '@ant-design/icons';

import type { UniverSheetInstance } from '../univer/bootstrap-sheet';
import { UniExportSheetHost } from './uni-export-sheet-host';

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

/** Univer 运行时可用的工作表 API（包内 FWorksheet 类型声明不完整） */
type UniverActiveSheet = {
  getRowCount: () => number;
  getColumnCount: () => number;
  getCellValue: (row: number, col: number) => unknown;
};

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
  const [loading, setLoading] = useState(false);
  const univerInstanceRef = useRef<UniverSheetInstance | null>(null);
  const handleSheetError = useCallback(
    (errorMessage: string) => {
      console.error('初始化 Univer Sheet 失败:', errorMessage);
      message.error('初始化表格失败');
    },
    [message],
  );
  // 与 app 主题一致：以 document.colorScheme 为准（主题编辑选择），未设置时才用系统偏好
  const colorScheme = document.documentElement.style.colorScheme;
  const isDark = colorScheme === 'dark'
    || (colorScheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

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
      const workbook = univerAPI.getActiveWorkbook();
      const worksheet = (workbook?.getActiveSheet() ?? null) as UniverActiveSheet | null;

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
      destroyOnHidden
      maskClosable={false}
    >
      <UniExportSheetHost
        isDark={isDark}
        data={data}
        headers={headers}
        height={height}
        onLoadingChange={setLoading}
        instanceRef={univerInstanceRef}
        onError={handleSheetError}
      />
    </Modal>
  );
};

export { UniExportMenuButton } from './UniExportMenuButton';
export type { UniExportMenuButtonProps, UniExportScope } from './UniExportMenuButton';

export default UniExport;
