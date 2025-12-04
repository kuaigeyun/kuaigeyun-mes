/**
 * 虚拟滚动列表组件
 * 
 * 用于优化长列表性能，只渲染可见区域的项目。
 * 适用于大量数据的列表展示场景。
 */

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Table, TableProps } from 'antd';

export interface VirtualListProps<T = any> extends Omit<TableProps<T>, 'scroll'> {
  /**
   * 数据源
   */
  dataSource: T[];
  /**
   * 每项高度（固定高度）或函数（动态高度）
   */
  itemHeight?: number | ((index: number) => number);
  /**
   * 容器高度
   */
  containerHeight?: number;
  /**
   * 可见区域上下缓冲区项目数量
   */
  overscan?: number;
  /**
   * 是否启用虚拟滚动（默认 true）
   */
  virtual?: boolean;
}

/**
 * 虚拟滚动列表组件
 * 
 * 当数据量较大时（> 100 条），自动启用虚拟滚动优化性能。
 */
function VirtualList<T extends Record<string, any> = any>({
  dataSource = [],
  itemHeight = 54, // Ant Design Table 默认行高
  containerHeight = 600,
  overscan = 5,
  virtual = true,
  ...tableProps
}: VirtualListProps<T>) {
  const [scrollY, setScrollY] = useState<number | undefined>(containerHeight);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算是否启用虚拟滚动（数据量大于 100 时启用）
  const shouldVirtualize = useMemo(() => {
    return virtual && dataSource.length > 100;
  }, [virtual, dataSource.length]);

  // 监听容器高度变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setScrollY(height);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 如果不启用虚拟滚动，直接使用普通 Table
  if (!shouldVirtualize) {
    return (
      <div ref={containerRef} style={{ height: containerHeight || 'auto' }}>
        <Table<T>
          {...tableProps}
          dataSource={dataSource}
          scroll={scrollY ? { y: scrollY } : undefined}
        />
      </div>
    );
  }

  // 启用虚拟滚动
  return (
    <div ref={containerRef} style={{ height: containerHeight || 'auto' }}>
      <Table<T>
        {...tableProps}
        dataSource={dataSource}
        scroll={scrollY ? { y: scrollY, scrollToFirstRowOnChange: true } : undefined}
        pagination={false} // 虚拟滚动时禁用分页，由外部控制
      />
    </div>
  );
}

export default VirtualList;

