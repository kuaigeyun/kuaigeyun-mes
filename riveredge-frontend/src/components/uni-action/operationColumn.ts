/**
 * 与 UniTable 内操作列判定一致：用于右侧固定列排序、列宽拖拽排除、scroll 配置等。
 */
export function isUniTableOperationColumn(col: any): boolean {
  const dataIndex = col?.dataIndex
  const fieldName = Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex || '')
  const key = col?.key ?? fieldName
  return (
    col?.valueType === 'option' ||
    key === 'action' ||
    key === 'operation' ||
    key === 'option' ||
    fieldName === 'action' ||
    fieldName === 'operation' ||
    fieldName === 'option' ||
    (!dataIndex && col?.render && typeof col.render === 'function')
  )
}
