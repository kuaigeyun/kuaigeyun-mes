import{r as p,j as o,M as E,D as v,aa as z,V as x,aQ as $,a4 as C,ai as s}from"./vendor-D7Y39u1a.js";import{g as L,b as M}from"./printTemplateSchemas-Be7SERtx.js";import{b as W,aF as w,C as O}from"./clientRelease-KbeHB7Fi.js";import{M as H}from"./main-WkLulm0U.js";import"./LinkedDocumentDetailContext-D_i4I3iM.js";import"./detailDrawerTimeFields-BNMO9M9C.js";import"./index.es-Cd7KbMGt.js";import"./sessionCurrentUser-fP_TkZTF.js";import"./globalStore-LbtONlif.js";import"./restoredUser-BBmVQEaW.js";import"./tokenRefresh-B4l0JJse.js";import"./building-2-DTNx6TKQ.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-BgG0hpI7.js";import"./statusBadges-C7FyvU5I.js";/* empty css                            */import"./UniLifecycleStepper-BYEp-Za1.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-ClREwpy7.js";import"./send-BnIPb4JP.js";import"./package-check-CYCyK9Fq.js";import"./japanese-yen-CoOjPGmC.js";import"./file-k9MQjaTe.js";import"./documentLifecycleStatusTag-CyanQDBr.js";import"./documentStatusColors-elOjImgP.js";import"./actionCatalog-bw1qV2UK.js";import"./normalize-BHIBrEcB.js";import"./businessConfig-CuT0Z6GG.js";import"./permissionContract-DqiiekYU.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-DNcdh844.js";import"./index-C-K7zVYG.js";import"./timer-haTt7V0m.js";import"./user-D1rpHUXW.js";import"./userDisplay-Dkq_hxjO.js";import"./demandType-DvdBfMNj.js";import"./index-DlCt5k0f.js";import"./kuaireportSharedFilePreview-D2XU9xy6.js";import"./index-Dg6NDWEl.js";import"./index-BgfxyEAp.js";import"./index-CYmwlR3C.js";import"./index-Da2SrDsW.js";import"./createForOfIteratorHelper-Bm3Jrj-6.js";import"./index-DG5M31iX.js";import"./vendor-libredwg-Cdf6ognf.js";import"./vendor-three-BPXNOO5B.js";import"./index-CSLJqKrJ.js";import"./debounce-BoNimHnz.js";import"./throttle-DqyHPEoa.js";import"./index-B-2KMIIW.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-Cmwn4-GH.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-VL262iiR.js";import"./documentStatus-CvGfNkG7.js";import"./purchase-DR9Zs32p.js";import"./fieldPermissionResources-DX_5Ur0d.js";import"./quotation-4ArCblqZ.js";import"./warehouseMarkerTags-ZS7s50pW.js";import"./warehouse-execution-DwRvVvLU.js";import"./material-BhOx-Pqc.js";import"./purchase-requisition-DGFV4vaY.js";import"./demand-computation-f5On2VjB.js";import"./availableInventoryCell-xTng2TEb.js";import"./MrpMaterialPlanPanel-Bddd8RmN.js";import"./workOrderReporting-uA4QAVbY.js";import"./documentAttachments-DXmMDOCc.js";import"./WorkOrderMaterialMovementsPanel-DyVK61-7.js";import"./work-order-u03e4OWG.js";import"./logisticsListPresentation-DVwrrrIk.js";import"./reporting-CaGUTgvt.js";import"./AuditPhaseBadge-DJTmlb8n.js";const er=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=W(),[P,b]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:P.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{er as default};
