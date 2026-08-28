/**
 * UniTable 右侧数据能力按钮（打印/导入/导出/同步）是否仅图标。
 * 供 UniCapabilityBatchButton 等与工具栏同簇的按钮读取，避免页面手传 iconOnly。
 */
import React from 'react'

export const UniTableDataActionIconOnlyContext = React.createContext(false)

export function useUniTableDataActionIconOnly(): boolean {
  return React.useContext(UniTableDataActionIconOnlyContext)
}
