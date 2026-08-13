import{r as p,j as o,M as E,G as z,ai as v,X as x,aO as $,a7 as C,ac as d}from"./vendor-DurrBLAY.js";import{g as L}from"./printTemplate-vUzyL_Ma.js";import{u as M,av as w,t as O}from"./clearSessionQueries-DO5p7n_h.js";import{a as W}from"./printTemplateSchemas-k0MaQ0qW.js";import{M as H}from"./main-DYNtkjgM.js";import"./LinkedDocumentDetailContext-Cz2Zn3Sq.js";import"./index.es-D3jyCdFF.js";import"./sessionCurrentUser-9RE6o7hg.js";import"./tokenRefresh-C8V9e81m.js";import"./building-2-DaMsK6Ip.js";import"./index-DmQNCpzw.js";import"./documentLifecycleStatusTag-CY_u8H0_.js";import"./statusBadges-BRhsrMd7.js";/* empty css                            */import"./globalLifecycleI18n-YKQvqC18.js";import"./lightbulb-BrN8dW4v.js";import"./send-D4gm5T3r.js";import"./package-check-BoUIg1vU.js";import"./japanese-yen-D3TRUdyY.js";import"./file-BMRzIayo.js";import"./materialUnitDisplay-BTT7XoC3.js";import"./purchase-DFRtG-Bv.js";import"./documentStatus-DmpFHFXl.js";import"./workOrderLifecycle-BxcMmgBB.js";import"./listLifecycleStage-CZKWm3oh.js";import"./businessConfig-RHV171kw.js";import"./fieldPermissionResources-cqBygc0R.js";import"./quotation-BggC_VbE.js";import"./userDisplay-B6FUq3E1.js";import"./user-VpRhXCmC.js";import"./permissionResource-C4537ZA2.js";import"./warehouse-execution-CMNJcO9C.js";import"./inboundHubTypes-DUSma5xC.js";import"./useDocumentCapabilities-CiG9YMjk.js";import"./sales-order-CBfMrk28.js";import"./purchase-requisition-Vu8NYuyK.js";import"./work-order-BJ09BbX6.js";import"./AuditPhaseBadge-DoMrVPMv.js";import"./ThemedSegmented-C1QbkYHY.js";import"./index-DsLOJNPr.js";import"./index-UJVPOTRP.js";import"./index-B1D86rzo.js";import"./index-CSfjr0XH.js";import"./index-Bg970pRj.js";import"./createForOfIteratorHelper-A3zLiCfb.js";import"./index-9lVXPpDF.js";import"./vendor-libredwg-B4DCrMyq.js";import"./vendor-three-KhALNUCB.js";import"./index-vPyAyBsC.js";import"./debounce-DsxHi6m3.js";import"./throttle-B8_JHdRY.js";import"./index-vKg-oQ2i.js";import"./dataDictionary-8EbHvUeD.js";import"./actionCatalog-CLwDBGkr.js";import"./normalize-CPf8cCur.js";import"./permissionContract-BVWLD9fO.js";import"./approvalInstance-DaZtgtgg.js";import"./index-Ct8yBsCH.js";import"./timer-haTt7V0m.js";const qt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=M(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
