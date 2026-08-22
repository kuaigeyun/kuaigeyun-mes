import{r as p,j as o,M as E,D as z,al as v,V as x,aJ as $,a4 as C,a9 as d}from"./vendor-DpL5kx19.js";import{g as L,b as M}from"./printTemplateSchemas-DpYoQsRG.js";import{b as W,aD as w,x as O}from"./clearSessionQueries-p0Xwkd5_.js";import{M as D}from"./main-DXhBGjxf.js";import"./LinkedDocumentDetailContext-By0-0q0E.js";import"./detailDrawerTimeFields-B2CgLEVG.js";import"./index.es-DqEUh-m9.js";import"./sessionCurrentUser-B_7A9nCQ.js";import"./tokenRefresh-C-WfQuuT.js";import"./building-2-C9oOjK3x.js";import"./index-DsfkOET-.js";/* empty css                            */import"./UniLifecycleStepper-DgDUfSPl.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-p8Mkzjv9.js";import"./send-HcrDxELD.js";import"./package-check-BXj1K4Rl.js";import"./japanese-yen-W1T9kNQc.js";import"./file-D5_tlO9E.js";import"./documentLifecycleStatusTag-CeD9V7pI.js";import"./documentStatusColors-C_bDuxZW.js";import"./statusBadges-BQKvRvAn.js";import"./actionCatalog-COjxIVYx.js";import"./normalize-DWZ7QvHa.js";import"./businessConfig-DXuqOCJy.js";import"./permissionContract-DViZhlf7.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-DAWASgyf.js";import"./index-DIB_sKFw.js";import"./timer-haTt7V0m.js";import"./user-YMUJ3Rfz.js";import"./userDisplay-B7fW_A3R.js";import"./demandType-Buwy0kCI.js";import"./ThemedSegmented-COTzcR-X.js";import"./index-DixmC8Oj.js";import"./index-CWujPeBz.js";import"./index-B-0vyWOt.js";import"./index-BwKxSjDu.js";import"./index-DG-cYsos.js";import"./createForOfIteratorHelper-Cmco2GBY.js";import"./index-BdOENL7P.js";import"./vendor-libredwg-xIC9BxKK.js";import"./vendor-three-BPXNOO5B.js";import"./index-TdP64UOV.js";import"./debounce-DW8eEVKj.js";import"./throttle-B7oclZhq.js";import"./index-Du3mRmOq.js";import"./routes-yxoaDZG1.js";import"./workOrderLifecycle-D7PtotzG.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-C2znZ0Bv.js";import"./documentStatus-CY7W-8VR.js";import"./purchase-D6S82fHB.js";import"./fieldPermissionResources-Cfd0-eE3.js";import"./quotation-CzF30sQ8.js";import"./warehouseMarkerTags-Cxs_MYIG.js";import"./warehouse-execution-b5i0xkyo.js";import"./material-7teL_IcM.js";import"./purchase-requisition-BhqTlKL3.js";import"./demand-computation-CG6XUZcf.js";import"./availableInventoryCell-CGQeUsDj.js";import"./MrpMaterialPlanPanel-Cn3_08Ah.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-BUaiDxlS.js";import"./work-order-CTOmjBy3.js";import"./logisticsListPresentation-Dc0NEa2a.js";import"./reporting-Dm1djVj3.js";import"./AuditPhaseBadge-BFDjrm_5.js";const Xt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=W(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{Xt as default};
