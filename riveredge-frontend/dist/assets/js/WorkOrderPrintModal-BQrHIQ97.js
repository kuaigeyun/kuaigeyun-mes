import{r as p,j as o,M as E,G as z,ai as v,X as x,aO as $,a7 as C,ac as d}from"./vendor-BpC5dbqE.js";import{g as L}from"./printTemplate-DGUom5zY.js";import{u as M,ax as w,t as O}from"./clearSessionQueries-CFqkMa_J.js";import{a as W}from"./printTemplateSchemas-CkbrFwE9.js";import{M as H}from"./main-DWiISOHf.js";import"./LinkedDocumentDetailContext-CrBgFQmp.js";import"./index.es-SKZRCHJ3.js";import"./sessionCurrentUser-6oLP0QSj.js";import"./tokenRefresh-BxzH3n5T.js";import"./building-2-Co5vsZIQ.js";import"./index-D3TI4B4O.js";import"./documentLifecycleStatusTag-P_-ZeEGY.js";import"./statusBadges-D0N6mcJW.js";/* empty css                            */import"./globalLifecycleI18n-YKQvqC18.js";import"./lightbulb-DsFAfToN.js";import"./send-c-YE-hoN.js";import"./package-check-DyowrwIS.js";import"./japanese-yen-BGLVIlGL.js";import"./file-B_TsUaLv.js";import"./materialUnitDisplay-B1UCxOUf.js";import"./purchase-qWBpqX63.js";import"./documentStatus-DuM_qlnn.js";import"./workOrderLifecycle-BZhZk-ku.js";import"./listLifecycleStage-CZKWm3oh.js";import"./businessConfig-Be7iW5tU.js";import"./fieldPermissionResources-DnTICqoT.js";import"./quotation-DRYhu-V_.js";import"./userDisplay-C1UYujqz.js";import"./user-DVyvIe7U.js";import"./permissionResource-C4537ZA2.js";import"./warehouse-execution-FzUfzY19.js";import"./inboundHubTypes-CcHs2MaW.js";import"./useDocumentCapabilities-BYmcEns8.js";import"./sales-order-BO_-UKx5.js";import"./purchase-requisition-BjLtDE7H.js";import"./work-order-hEGiiLcy.js";import"./AuditPhaseBadge-BUh4dmLN.js";import"./ThemedSegmented-e3UNW3Bv.js";import"./index-Ciwf16Ms.js";import"./index-d-USsv0W.js";import"./index-7UfJT2Vt.js";import"./index-VfczBrux.js";import"./index-CcfvOhEZ.js";import"./createForOfIteratorHelper-MkSm1zyM.js";import"./index-BSe36MK_.js";import"./index-BlovEObT.js";import"./debounce-D_qL3h6o.js";import"./throttle-f5e-G1gg.js";import"./index-Bs_BOq0m.js";import"./dataDictionary-CPbl4CuU.js";import"./actionCatalog-B9uSF64Z.js";import"./normalize-TbxAPV1o.js";import"./permissionContract-BzEE66e1.js";import"./approvalInstance-DO3Tg2as.js";import"./index-BqmP6UUu.js";import"./timer-haTt7V0m.js";const Ft=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=M(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
        .work-order-print-modal-wrap .ant-modal {
          max-width: calc(100vw - 32px) !important;
        }
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-nested-loading,
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-container,
        .work-order-print-modal-wrap .work-order-print-preview {
          height: 100% !important;
        }
        .work-order-print-modal-wrap .work-order-print-iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          border: none !important;
          display: block !important;
          background: #fff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .work-order-print-preview,
          .work-order-print-preview * {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .work-order-print-preview {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `})]})};export{Ft as default};
