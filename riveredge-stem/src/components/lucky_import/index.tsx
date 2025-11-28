/**
 * Lucky Import 导入弹窗组件
 * 
 * 使用 Luckysheet 进行 Excel 数据导入
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Modal, Button, Space, App } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

// 引入 Luckysheet 样式（动态导入，避免影响其他页面）
let luckysheetLoaded = false;
let luckysheetInstance: any = null;
let jqueryLoaded = false;

/**
 * 加载 jQuery 及其插件（Luckysheet 的依赖）
 */
const loadJQuery = async (): Promise<void> => {
  if (jqueryLoaded && typeof window !== 'undefined' && (window as any).jQuery) {
    return;
  }
  
  try {
    const jQuery = await import('jquery');
    
    // 挂载到 window 对象（Luckysheet 需要全局的 $ 和 jQuery）
    if (typeof window !== 'undefined') {
      (window as any).jQuery = (window as any).$ = jQuery.default || jQuery;
    }
    
    // 加载 jQuery mousewheel 插件（Luckysheet 需要）
    // 注意：jquery-mousewheel 是传统 jQuery 插件，需要通过 script 标签加载
    try {
      
      // 检查是否已经加载
      if (typeof window !== 'undefined' && (window as any).$ && typeof (window as any).$.fn.mousewheel === 'function') {
        return;
      }
      
      // 通过 script 标签加载（传统 jQuery 插件的最佳方式）
      await new Promise<void>((resolve, reject) => {
        // 检查是否已经添加过 script 标签
        if (document.querySelector('script[data-jquery-mousewheel]')) {
          // 等待一下确保已加载
          setTimeout(() => {
            if (typeof (window as any).$.fn.mousewheel === 'function') {
              resolve();
            } else {
              reject(new Error('jQuery mousewheel 插件未正确加载'));
            }
          }, 100);
          return;
        }
        
        const script = document.createElement('script');
        script.setAttribute('data-jquery-mousewheel', 'true');
        
        // 直接使用 node_modules 路径（Vite 开发服务器会处理）
        // 在生产环境中，需要确保文件被正确复制或通过构建工具处理
        script.src = '/node_modules/jquery-mousewheel/jquery.mousewheel.js';
        
        script.onload = () => {
          // 验证插件是否已注册
          setTimeout(() => {
            if (typeof (window as any).$ && typeof (window as any).$.fn.mousewheel === 'function') {
              resolve();
            } else {
              reject(new Error('jQuery mousewheel 插件未正确注册'));
            }
          }, 50);
        };
        
        script.onerror = () => {
          reject(new Error('无法加载 jQuery mousewheel 插件脚本'));
        };
        
        document.head.appendChild(script);
      });
    } catch (mousewheelError) {
      throw new Error('无法加载 jQuery mousewheel 插件，这是 Luckysheet 的必需依赖');
    }
    
    jqueryLoaded = true;
  } catch (error) {
    throw new Error('无法加载 jQuery，这是 Luckysheet 的必需依赖');
  }
};

/**
 * 动态加载 Luckysheet 样式和脚本
 */
const loadLuckysheet = async (): Promise<any> => {
  if (luckysheetLoaded && luckysheetInstance) {
    return luckysheetInstance;
  }
  
  // 如果已经加载到 window 对象上，直接使用
  if (typeof window !== 'undefined' && (window as any).luckysheet) {
    luckysheetInstance = (window as any).luckysheet;
    luckysheetLoaded = true;
    return luckysheetInstance;
  }
  
  try {
    
    // 第零步：先加载 jQuery（必需依赖）
    await loadJQuery();
    
    // 第一步：加载样式
    try {
      await import('luckysheet/dist/plugins/css/pluginsCss.css');
      await import('luckysheet/dist/plugins/plugins.css');
      await import('luckysheet/dist/css/luckysheet.css');
      await import('luckysheet/dist/assets/iconfont/iconfont.css');
    } catch (styleError) {
      // 样式加载失败不影响功能，继续执行
    }
    
    // 第二步：加载 UMD 模块
    const umdModule = await import('luckysheet/dist/luckysheet.umd.js');
    
    // 尝试获取 luckysheet 对象
    let luckysheet = umdModule.default || umdModule;
    
    // 如果模块是一个对象，尝试查找 luckysheet
    if (luckysheet && typeof luckysheet === 'object') {
      // 检查是否有 create 方法
      if (typeof luckysheet.create === 'function') {
        luckysheetInstance = luckysheet;
      } else {
        // 尝试查找所有可能的导出
        const keys = Object.keys(luckysheet);
        for (const key of keys) {
          const value = (luckysheet as any)[key];
          if (value && typeof value.create === 'function') {
            luckysheetInstance = value;
            break;
          }
        }
      }
    }
    
    // 如果还没找到，检查 window 对象
    if (!luckysheetInstance && (window as any).luckysheet) {
      luckysheetInstance = (window as any).luckysheet;
    }
    
    // 验证 luckysheetInstance
    if (!luckysheetInstance || typeof luckysheetInstance.create !== 'function') {
      throw new Error('Luckysheet 对象没有 create 方法，请检查版本兼容性');
    }
    
    // 挂载到 window
    if (typeof window !== 'undefined') {
      (window as any).luckysheet = luckysheetInstance;
    }
    
    luckysheetLoaded = true;
    return luckysheetInstance;
  } catch (error) {
    throw error;
  }
};

/**
 * Luckysheet 导入弹窗组件属性
 */
export interface LuckyImportProps {
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
}

/**
 * Lucky Import 导入弹窗组件
 */
export const LuckyImport: React.FC<LuckyImportProps> = ({
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
}) => {
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [luckysheetInstance, setLuckysheetInstance] = useState<any>(null);

  /**
   * 初始化 Luckysheet
   * 使用 useLayoutEffect 确保在 DOM 更新后立即执行
   */
  useLayoutEffect(() => {
    
    if (visible) {
      // 等待 DOM 更新，确保 containerRef.current 不为 null
      const initLuckysheet = async () => {
        // 等待一下确保 DOM 已经渲染
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
          
          // 动态加载 Luckysheet
          const luckysheet = await loadLuckysheet();
          
          if (!luckysheet) {
            message.error('Luckysheet 加载失败，请检查依赖是否正确安装');
            setLoading(false);
            return;
          }
          
          // 等待 DOM 更新
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 检查容器是否存在
          if (!containerRef.current) {
            message.error('容器元素不存在');
            setLoading(false);
            return;
          }
          
          // 创建容器 ID（确保唯一）
          const containerId = `luckysheet-import-${Date.now()}`;
          containerRef.current.id = containerId;
          
          // 清空容器内容（防止重复初始化）
          containerRef.current.innerHTML = '';
          
          // 等待一下确保 DOM 更新完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 检查 luckysheet 是否有 create 方法
          if (typeof luckysheet.create !== 'function') {
            message.error('Luckysheet create 方法不存在，请检查版本兼容性');
            setLoading(false);
            return;
          }
          
          // 初始化 Luckysheet（使用简化配置）
          luckysheet.create({
            container: containerId,
            lang: 'zh',
            allowCopy: true,
            allowEdit: true,
            allowDelete: true,
            showtoolbar: true,
            showinfobar: false,
            showsheetbar: true,
            showstatisticBar: false,
            enableAddRow: true,
            enableAddCol: true,
            enablePage: false,
            enableAddBackTop: false,
            data: [
              {
                name: 'Sheet1',
                index: '0',
                order: 0,
                celldata: [],
                // 配置单元格默认格式，确保编辑时实时显示
                config: {
                  // 设置默认行高和列宽
                  defaultrowlen: 73,
                  defaultcollen: 73,
                },
                scrollLeft: 0,
                scrollTop: 0,
                luckysheet_select_save: [],
                'calc chain': {},
                isPivotTable: false,
                pivotTable: {},
                showGridLines: 1,
                zoomRatio: 1,
                functionData: [],
                frozen: {},
                chart: [],
                showRowBar: 1,
                showColumnBar: 1,
                columnHeaderHeight: 46,
                rowHeaderWidth: 46,
              },
            ],
          });
          
          // 简化：直接等待一小段时间后隐藏加载状态
          // 移除复杂的渲染检测和事件监听逻辑，避免卡顿
          // 这些复杂逻辑是为了修复编辑实时显示问题而添加的，但导致了卡顿
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 隐藏加载状态
          setLoading(false);
          setLuckysheetInstance(luckysheet);
          message.success('表格已加载，可以开始编辑数据');
        } catch (error: any) {
          setLoading(false);
          message.error('表格加载失败：' + (error.message || '未知错误'));
        }
      };

      initLuckysheet();
    } else if (!visible && luckysheetInstance) {
      // 关闭弹窗时清理
      try {
        const luckysheet = (window as any).luckysheet;
        if (luckysheet && typeof luckysheet.destroy === 'function') {
          luckysheet.destroy();
        }
      } catch (error) {
      }
      setLuckysheetInstance(null);
    }
  }, [visible]);

  /**
   * 处理确认导入
   */
  const handleConfirm = () => {
    try {
      const luckysheet = (window as any).luckysheet;
      
      if (!luckysheet) {
        message.error('表格未加载完成，请稍候再试');
        return;
      }

      // 获取所有工作表数据
      const allSheets = luckysheet.getAllSheets();
      
      if (!allSheets || allSheets.length === 0) {
        message.warning('表格中没有数据，请先输入数据');
        return;
      }

      // 获取当前工作表（第一个工作表）
      const currentSheet = allSheets[0];
      if (!currentSheet || !currentSheet.celldata || currentSheet.celldata.length === 0) {
        message.warning('表格中没有数据，请先输入数据');
        return;
      }

      // 转换为二维数组格式
      // 首先找到最大行和列
      let maxRow = 0;
      let maxCol = 0;
      currentSheet.celldata.forEach((cell: any) => {
        const r = cell.r || 0;
        const c = cell.c || 0;
        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;
      });

      // 创建二维数组
      const data: any[][] = [];
      for (let r = 0; r <= maxRow; r++) {
        const rowData: any[] = [];
        for (let c = 0; c <= maxCol; c++) {
          // 查找对应单元格
          const cell = currentSheet.celldata.find((cell: any) => cell.r === r && cell.c === c);
          if (cell && cell.v !== undefined && cell.v !== null) {
            rowData.push(cell.v);
          } else {
            rowData.push('');
          }
        }
        // 过滤空行（所有单元格都为空）
        if (rowData.some(cell => cell !== '' && cell !== null && cell !== undefined)) {
          data.push(rowData);
        }
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
      {/* Luckysheet 基本样式 */}
      {visible && (
        <style>{`
          .luckysheet-stat-area {
            background-color: transparent !important;
          }
          .ant-modal-body {
            padding: 16px 0 !important;
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

export default LuckyImport;

