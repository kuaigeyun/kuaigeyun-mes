import{r as p,j as o,M as E,G as z,ai as v,X as x,aO as $,a7 as C,ac as d}from"./vendor-DO8EbQ_1.js";import{g as L}from"./printTemplate-lGlUT4Qm.js";import{u as M,ax as w,t as O}from"./clearSessionQueries-Cse8l8yS.js";import{a as W}from"./printTemplateSchemas-BketwQyG.js";import{M as H}from"./main-D4Ik8O30.js";import"./LinkedDocumentDetailContext-DtWQbmYT.js";import"./index.es-_HPvIjsV.js";import"./sessionCurrentUser-C3AYFIfe.js";import"./tokenRefresh-C2aWt-1x.js";import"./building-2-BYB6o3_Q.js";import"./index-D-UunzSh.js";import"./documentLifecycleStatusTag-CS5GWqxL.js";import"./statusBadges-tmfyQNZ2.js";/* empty css                            */import"./globalLifecycleI18n-YKQvqC18.js";import"./lightbulb-CB7hOsoz.js";import"./send-B3vi-Vcp.js";import"./package-check-DlHgbOKI.js";import"./japanese-yen-CyDM73MS.js";import"./file-CM8GKfG6.js";import"./materialUnitDisplay--P03SeYU.js";import"./purchase-BBEjr8Rz.js";import"./documentStatus-BoewOGYE.js";import"./workOrderLifecycle-BNG9Mauw.js";import"./listLifecycleStage-CZKWm3oh.js";import"./businessConfig-CnIg7CuU.js";import"./fieldPermissionResources-d912wusz.js";import"./quotation-Bb7je1-U.js";import"./userDisplay-gK0ecNa-.js";import"./user-awu_agGn.js";import"./permissionResource-C4537ZA2.js";import"./warehouse-execution-D4HRZfGa.js";import"./inboundHubTypes-DaX08-kk.js";import"./useDocumentCapabilities-GBY3hw-u.js";import"./sales-order-D_D1LjKK.js";import"./purchase-requisition-CUYy-hwv.js";import"./work-order-S9vBsZKH.js";import"./AuditPhaseBadge-BESFtdFh.js";import"./ThemedSegmented-CsSDnqee.js";import"./index-CEs5OTrl.js";import"./index-B4s4Foah.js";import"./index-Bixox2JN.js";import"./index-C1VPfa3s.js";import"./index-CoQuapPS.js";import"./createForOfIteratorHelper-D50zWYx6.js";import"./index-Ddpk2tGj.js";import"./index-BHfYYeFv.js";import"./debounce-CEQbJ11E.js";import"./throttle-US2pxhHy.js";import"./index-BiXCFWy8.js";import"./dataDictionary-CRC73JrL.js";import"./actionCatalog-BZjgs0Bi.js";import"./normalize-DwlnGpgD.js";import"./permissionContract-BX9McyaT.js";import"./approvalInstance-BTRc47Wp.js";import"./index-Dq8yzAKf.js";import"./timer-haTt7V0m.js";const Ft=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=M(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
