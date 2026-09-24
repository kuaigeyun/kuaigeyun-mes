import{r as s,j as o,M as E,D as v,a7 as z,V as x,aT as $,a2 as C,ae as p}from"./vendor-Bn3s2VBN.js";import{ar as L,au as W,a5 as M}from"./main-C_4QmIEj.js";import{b as H,be as w,F as T}from"./clientRelease-CcE3eHt6.js";import"./index.es-CnPI-o_i.js";import"./sessionCurrentUser-AW4RTkH4.js";import"./globalStore-2A6o30nb.js";import"./restoredUser-BNKLSpMx.js";import"./tokenRefresh-DaGk61z0.js";import"./building-2-w2oQq5wx.js";import"./index-B6U19pv8.js";import"./vendor-libredwg-CMR_alFQ.js";import"./vendor-three-BPXNOO5B.js";import"./clearSessionQueries-Db_KN_8V.js";const Q=({visible:d,onCancel:f,workOrderData:O,workOrderId:j})=>{const{t}=H(),[P,b]=s.useState([]),[k,g]=s.useState(!1),[y,l]=s.useState(!1),[i,u]=s.useState(),[h,m]=s.useState(""),c=s.useRef({}),n=j??O?.id;c.current={selectedTemplateId:i,effectiveWorkOrderId:n},s.useEffect(()=>{d&&(_(),u(void 0),m(""))},[d]),s.useEffect(()=>{d&&i&&n?I():m("")},[d,i,n]);const _=async()=>{g(!0);try{const e=await L({is_active:!0,document_type:"work_order"});b(e);const a=e.find(r=>r.is_default)??e.find(r=>r.code===W.work_order)??e[0];a&&u(a.uuid)}catch(e){w(e,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!i)return;const e=`${i}-${n}`;l(!0);try{const a=await T(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:i,output_format:"html",response_format:"json"}}),r=c.current;if(e!==`${r.selectedTemplateId}-${r.effectiveWorkOrderId}`)return;m(a?.content??"")}catch(a){const r=c.current;if(e!==`${r.selectedTemplateId}-${r.effectiveWorkOrderId}`)return;w(a,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),m("")}finally{const a=c.current;e===`${a.selectedTemplateId}-${a.effectiveWorkOrderId}`&&l(!1)}},S=async()=>{if(!n){p.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!i){p.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}l(!0);try{const a=(await T(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:i,output_format:"html",response_format:"json"}}))?.content??"";if(!a){p.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const r=window.open("","_blank");r?(r.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${a}</body></html>`),r.document.close(),r.focus(),r.print(),r.close(),p.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):p.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(e){w(e,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{l(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:i,onChange:u,loading:k,options:P.map(e=>({label:e.name,value:e.uuid}))})]}),open:d,onCancel:f,width:M.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!i||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{Q as default};
