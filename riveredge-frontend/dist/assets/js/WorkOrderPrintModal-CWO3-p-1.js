import{r as p,j as o,M as E,D as z,ag as v,V as x,aM as $,a5 as M,aa as d}from"./vendor-CY-66l_Y.js";import{g as C}from"./printTemplate-viJ06CMh.js";import{b as L,az as w,v as O}from"./clearSessionQueries-BpeMRrUl.js";import{a as W}from"./printTemplateSchemas-BpoNGxtx.js";import{M as H}from"./main-Bwz9GDIJ.js";import"./LinkedDocumentDetailContext-BoO3IXny.js";import"./index.es-CwX2fDYn.js";import"./sessionCurrentUser-BtxS_iHJ.js";import"./tokenRefresh-DIlqz4eD.js";import"./building-2-BRcZ13c2.js";import"./index-BCMwqOF6.js";import"./documentLifecycleStatusTag-CfT4lYI-.js";import"./statusBadges-DsJGmldB.js";/* empty css                            */import"./globalLifecycleI18n-YKQvqC18.js";import"./lightbulb-rXvgZOwW.js";import"./send-ArHiI86j.js";import"./package-check-NTJ_-DRY.js";import"./japanese-yen-XJ7sjJjH.js";import"./file-D0HdXPNC.js";import"./materialUnitDisplay-7rild7ai.js";import"./purchase-CkJ59aB7.js";import"./documentStatus-BRq1nHWx.js";import"./workOrderLifecycle-BMrkHi3P.js";import"./listLifecycleStage-CZKWm3oh.js";import"./businessConfig-BmWsr8TU.js";import"./fieldPermissionResources-D_k_OUsk.js";import"./quotation-BTV6lAr9.js";import"./userDisplay-7vHt_Stt.js";import"./user-vUt0c2VA.js";import"./permissionResource-C4537ZA2.js";import"./warehouse-execution-DhcwnEV4.js";import"./inboundHubTypes-eDfOwX0y.js";import"./useDocumentCapabilities-BwVPba28.js";import"./sales-order-DORp619d.js";import"./purchase-requisition-6sVd9d-3.js";import"./work-order-Ck5-q7f8.js";import"./AuditPhaseBadge-C2F9ziFs.js";import"./ThemedSegmented-LsAc6Uyj.js";import"./index-CiHUfJtl.js";import"./index-CIP7NobJ.js";import"./index-CoTxs0Mx.js";import"./index-DMNpqBPO.js";import"./index-BHDOEnt3.js";import"./createForOfIteratorHelper-OnhmeiF8.js";import"./index-C3IuAHS8.js";import"./vendor-libredwg-CBM4kyEi.js";import"./vendor-three-BPXNOO5B.js";import"./index-BZu7F5Um.js";import"./debounce-BrM68X_b.js";import"./throttle-BeIvN6Ee.js";import"./index-OneTg6kw.js";import"./dataDictionary-B3xk5o1D.js";import"./actionCatalog-CBFaKQD_.js";import"./normalize-sxtTYXTX.js";import"./permissionContract-DFc_ZMhj.js";import"./approvalInstance-g1Tgs7um.js";import"./index-YF6Bxsrh.js";import"./timer-haTt7V0m.js";const qt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=L(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{qt as default};
