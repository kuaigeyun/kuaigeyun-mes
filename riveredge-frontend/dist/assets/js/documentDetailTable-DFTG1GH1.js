import{j as t,J as i,V as l,Z as n,au as o}from"./vendor-DbPimlg3.js";import{b as r}from"./clearSessionQueries-iLnsZ5Hy.js";const u="quotation-detail-table",T={material:280,variantAttributes:240,spec:140,unit:108,quantity:112,unitPrice:132,exclAmount:120,taxRate:108,taxAmount:112,lineAmount:132,deliveryDate:152,notes:140},b={align:"left"},h={align:"right",onHeaderCell:()=>({style:{textAlign:"left"}})},_={display:"block",textAlign:"right"},E={width:"100%",minWidth:140},q={className:u,size:"middle",style:{width:"100%",margin:0}},s="middle",d=`
  .quotation-detail-table .quotation-material-cell .ant-form-item,
  .quotation-detail-table .quotation-material-cell .ant-form-item-control,
  .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
  .quotation-detail-table .quotation-material-cell .ant-select,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item-control,
  .quotation-detail-table .uni-detail-material-cell .ant-form-item-control-input,
  .quotation-detail-table .uni-detail-material-cell .ant-select {
    width: 100% !important;
    min-width: 0;
  }
  .quotation-detail-table .ant-input-number-input::selection,
  .quotation-detail-table .ant-input::selection {
    background-color: var(--ant-color-primary, #1677ff);
    color: #fff;
    border-radius: 0;
  }
  .quotation-detail-table td.ant-table-cell-align-right .ant-input-number-input {
    text-align: right;
  }
  .quotation-detail-table td.quotation-tax-rate-col {
    overflow: hidden;
  }
  .quotation-detail-table .quotation-tax-rate-cell,
  .quotation-detail-table .quotation-tax-rate-cell .ant-form-item,
  .quotation-detail-table .quotation-tax-rate-cell .ant-form-item-control-input {
    max-width: 100%;
    min-width: 0;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-wrapper {
    display: flex;
    width: 100%;
    max-width: 100%;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number {
    flex: 1 1 auto;
    min-width: 0;
    width: auto !important;
  }
  .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-addon {
    flex: 0 0 auto;
    padding-inline: 6px;
  }
`;function f(){return t.jsx("style",{children:d})}function D({onBatch:a}){const{t:e}=r();return t.jsxs("span",{style:{whiteSpace:"nowrap"},children:[e("app.kuaizhizao.salesOrder.taxRate"),t.jsx(l,{type:"link",size:"small",style:{padding:"0 4px",height:"auto"},onClick:a,children:e("app.kuaizhizao.salesOrder.batch")})]})}const c={display:"inline-flex",alignItems:"center",padding:"0 8px",color:"var(--ant-color-text-secondary)",background:"var(--ant-color-fill-alter)",border:"1px solid var(--ant-color-border)",borderLeft:0,borderRadius:"0 var(--ant-border-radius) var(--ant-border-radius) 0",fontSize:"inherit"};function m({value:a,onChange:e}){return t.jsxs(n.Compact,{style:{width:"100%"},children:[t.jsx(o,{value:a,onChange:e,placeholder:"0",min:0,max:100,precision:0,controls:!1,size:s,style:{width:"100%"}}),t.jsx("span",{style:c,children:"%"})]})}function A({index:a}){return t.jsx("div",{className:"quotation-tax-rate-cell",children:t.jsx(i.Item,{name:[a,"tax_rate"],style:{margin:0},children:t.jsx(m,{})})})}export{f as D,A as T,q as a,b,T as c,h as d,s as e,D as f,E as g,_ as h};
