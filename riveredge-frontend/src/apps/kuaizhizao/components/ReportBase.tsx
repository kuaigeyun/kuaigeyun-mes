import React from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, type StatCard } from '../../../components/layout-templates';
import { exportReport } from '../services/reports';

/**
 * 通用报表组件属性
 */
interface ReportBaseProps<T = any> {
  /** 报表标题 */
  title: string;
  /** 报表类型（用于后端识别） */
  reportType?: string;
  /** 表格列定义 */
  columns: ProColumns<T>[];
  /** 统计卡片数据 */
  statCards?: StatCard[];
  /** 默认请求函数 */
  request?: (params: any) => Promise<{ data: T[]; total: number; success: boolean }>;
  /** 额外内容（如图表） */
  children?: React.ReactNode;
  /** ProTable 列状态持久化 key（质量管理报表等批量改造时按页唯一） */
  columnPersistenceId?: string;
}

/**
 * 跨模块报表基础模板
 */
const ReportBase: React.FC<ReportBaseProps> = ({
  title,
  reportType = 'summary',
  columns,
  statCards = [],
  request,
  children,
  columnPersistenceId,
}) => {
  const { message: messageApi } = App.useApp();
  const actionRef = React.useRef<ActionType>(null);
  const [loading, setLoading] = React.useState(false);

  // 默认模拟请求
  const defaultRequest = async (_params: any) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      data: [],
      total: 0,
      success: true,
    };
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      messageApi.loading(`正在导出 ${title}...`, 0);
      await exportReport(reportType, {});
      messageApi.destroy();
      messageApi.success(`${title} 导出成功`);
    } catch (error) {
      messageApi.destroy();
      messageApi.error(`导出失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ListPageTemplate statCards={statCards}>
      {children}
      <UniTable
        headerTitle={title}
        columnPersistenceId={columnPersistenceId}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={request || defaultRequest}
        showExportButton
        onExport={async () => {
          await handleExport();
        }}
        scroll={{ x: 1200 }}
        bordered
      />
    </ListPageTemplate>
  );
};

export default ReportBase;
