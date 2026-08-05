const e=`
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
`;export{e as W};
