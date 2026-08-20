import{r as p,j as o,M as E,D as z,ae as v,V as x,aM as $,a4 as M,a9 as d}from"./vendor-CQlkqzCA.js";import{g as C,b as L}from"./printTemplateSchemas-_6vROVv6.js";import{b as W,aE as w,x as O}from"./clearSessionQueries-Dee27bcy.js";import{M as H}from"./main-BVAEUPA1.js";import"./LinkedDocumentDetailContext-DlNnJKsq.js";import"./detailDrawerTimeFields-D3IdpZD1.js";import"./index.es-SEWhWFsd.js";import"./sessionCurrentUser-Czoau_aX.js";import"./tokenRefresh-D5Q5B3A-.js";import"./building-2-BgsNwPfB.js";import"./index-5Q3uJtUp.js";/* empty css                            */import"./UniLifecycleStepper-D9-IG45T.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-BwYi3C2t.js";import"./send-WVUjao--.js";import"./package-check-DDgeOFOy.js";import"./japanese-yen-BKBP0vRn.js";import"./file-Dhslhv_G.js";import"./documentLifecycleStatusTag-jtmdX5rZ.js";import"./documentStatusColors-Ce9Qr2FU.js";import"./statusBadges-FtwWpVt6.js";import"./actionCatalog-CXnlkUOn.js";import"./normalize-DJzKlHHC.js";import"./businessConfig-BkO2Vjhh.js";import"./permissionContract-teRvIZgz.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-CkXl1FLR.js";import"./index-BlvLch1I.js";import"./timer-haTt7V0m.js";import"./user-D7dvVz6s.js";import"./userDisplay-DXnPLa7W.js";import"./demandType-DJL0xiOH.js";import"./ThemedSegmented-Cfb83-7W.js";import"./index-OUIXsW6Z.js";import"./kuaireportSharedFilePreview-D6Qzhq74.js";import"./index-Bzp-b7JS.js";import"./index-CDst6Qu_.js";import"./index-BTA3vezM.js";import"./index-D9-2svXI.js";import"./createForOfIteratorHelper-DPoFRG3k.js";import"./index-DsSbb6_4.js";import"./vendor-libredwg-CiZXeEqi.js";import"./vendor-three-BPXNOO5B.js";import"./index-DQ3QDTTC.js";import"./debounce-DL4J5H8R.js";import"./throttle-Bgh9S1Ok.js";import"./index-CpfkjqA-.js";import"./routes-yxoaDZG1.js";import"./workOrderLifecycle-6YqyBPEn.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-BRMuCPyu.js";import"./documentStatus-DISH3NQf.js";import"./purchase-J4pr6xkn.js";import"./fieldPermissionResources-CL4XHwij.js";import"./quotation-CLsZYR5x.js";import"./warehouseMarkerTags-BgJF61kJ.js";import"./warehouse-execution-CoSOVNQY.js";import"./material-Bb7BU3v4.js";import"./purchase-requisition-CvYeeutl.js";import"./demand-computation-BgVkLKys.js";import"./availableInventoryCell-cOuAzAhb.js";import"./MrpMaterialPlanPanel-BUiUuy4l.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-dnAxU-3P.js";import"./work-order-BVxcZIqM.js";import"./logisticsListPresentation-B72yEPh8.js";import"./reporting-CXDjwl4Y.js";import"./AuditPhaseBadge-BWhe6U4M.js";const Zt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=W(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{Zt as default};
