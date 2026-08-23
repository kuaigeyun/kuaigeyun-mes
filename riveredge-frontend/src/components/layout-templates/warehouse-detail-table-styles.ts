/**
 * 仓储物料明细表统一样式
 * 参考销售订单明细表样式，用于 warehouse-management 下涉及物料明细的 Table
 *
 * 使用方式：<style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
 * 配合 className="warehouse-detail-table" 应用于 Table
 */

export const WAREHOUSE_DETAIL_TABLE_STYLES = `
  .warehouse-detail-table .ant-table-thead > tr > th {
    background-color: var(--ant-color-fill-alter) !important;
    font-weight: 600;
    white-space: nowrap !important;
  }
  .warehouse-detail-table .ant-table-thead > tr > th .ant-table-cell,
  .warehouse-detail-table .ant-table-thead > tr > th .ant-table-column-title {
    white-space: nowrap !important;
  }
  .warehouse-detail-table .ant-table-thead > tr > th.warehouse-detail-fixed-op-header {
    background: #fafafa !important;
  }
  .warehouse-detail-table .ant-table {
    border-top: 1px solid var(--ant-color-border);
  }
  .warehouse-detail-table .ant-table-tbody > tr > td {
    border-bottom: 1px solid var(--ant-color-border);
    overflow: visible !important;
  }
  .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item,
  .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item-control,
  .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item-control-input,
  .warehouse-detail-table .warehouse-detail-material-cell .ant-select {
    width: 100% !important;
    min-width: 0;
  }
  .warehouse-detail-table .ant-form-item-explain,
  .warehouse-detail-table .ant-form-item-explain-error {
    display: none !important;
  }
  .warehouse-detail-table .ant-input-number-input::selection,
  .warehouse-detail-table .ant-input::selection {
    background-color: var(--ant-color-primary);
    color: #fff;
    border-radius: 0;
  }
`;

/** FormModal 内明细表：外框 + 行分隔水平线，无竖线（对齐 uni-table-detail-body） */
export const WAREHOUSE_FORM_DETAIL_TABLE_FRAME_STYLES = `
  .warehouse-form-detail-table-frame {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--ant-color-border);
    border-radius: var(--ant-border-radius, 6px);
    overflow: hidden;
    background: var(--ant-color-bg-container);
  }
  .warehouse-form-detail-table-frame .ant-table-wrapper .ant-table {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .warehouse-form-detail-table-frame .ant-table-container {
    border: none !important;
    border-radius: 0 !important;
  }
  .warehouse-form-detail-table-frame .ant-table-content > table {
    border-collapse: collapse;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-table-thead > tr > th {
    background-color: var(--ant-color-fill-alter) !important;
    font-weight: 600;
    white-space: nowrap !important;
    border-inline-start: none !important;
    border-inline-end: none !important;
    border-top: none !important;
    border-bottom: 1px solid var(--ant-color-split, rgba(5, 5, 5, 0.06)) !important;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-table-thead > tr > th .ant-table-cell,
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-table-thead > tr > th .ant-table-column-title {
    white-space: nowrap !important;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-table-tbody > tr > td {
    border-inline-start: none !important;
    border-inline-end: none !important;
    border-top: none !important;
    border-bottom: 1px solid var(--ant-color-split, rgba(5, 5, 5, 0.06)) !important;
    overflow: visible !important;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-table-tbody > tr:last-child > td {
    border-bottom: none !important;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item,
  .warehouse-form-detail-table-frame .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item-control,
  .warehouse-form-detail-table-frame .warehouse-detail-table .warehouse-detail-material-cell .ant-form-item-control-input,
  .warehouse-form-detail-table-frame .warehouse-detail-table .warehouse-detail-material-cell .ant-select {
    width: 100% !important;
    min-width: 0;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-form-item-explain,
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-form-item-explain-error {
    display: none !important;
  }
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-input-number-input::selection,
  .warehouse-form-detail-table-frame .warehouse-detail-table .ant-input::selection {
    background-color: var(--ant-color-primary);
    color: #fff;
    border-radius: 0;
  }
`;
