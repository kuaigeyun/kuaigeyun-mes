import{r as n,j as e,M as E,D as v,a8 as z,V as x,b3 as $,a2 as W,ag as s}from"./vendor-DcKkfx8l.js";import{g as C,b as L}from"./printTemplateSchemas-N7gpG8rZ.js";import{b as M,aW as w,D as O}from"./clientRelease-DSoa8jw6.js";import{_ as D}from"./main-DCRRMr2W.js";import"./LinkedDocumentDetailContext-ZaUy7ZhX.js";import"./detailDrawerTimeFields-CelAhz09.js";import"./index.es-CgQoKGJA.js";import"./sessionCurrentUser-UVlXrBBj.js";import"./globalStore-CIh-xVe9.js";import"./restoredUser-2MPd0rVg.js";import"./tokenRefresh-bFU7BY7H.js";import"./building-2-BGkS4ylG.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-B0ULgt6O.js";import"./statusBadges-BiDAZ2O7.js";/* empty css                            */import"./UniLifecycleStepper-qoD407HX.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-8-IWv2O9.js";import"./package-check-RD0GaQo4.js";import"./japanese-yen-DinXK9D1.js";import"./file-DHyPV8vB.js";import"./documentLifecycleStatusTag-BXHYbf6b.js";import"./documentStatusColors-D_UCQLuj.js";import"./operationColumn-DIipuD_Y.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-DFUCB7r2.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-C3a_PuKI.js";import"./index-CZd5jIqd.js";import"./timer-haTt7V0m.js";import"./user-CKDhHrE7.js";import"./userDisplay-rCy03erG.js";import"./QuantityWithUnitDisplay-C634BQt-.js";import"./materialUnitDisplay-CuMkrwMC.js";import"./material-unit-Dlz80Ykf.js";import"./formDate-egVia5bp.js";import"./index-Dl_saWoV.js";import"./kuaireportSharedFilePreview-CE3w5sDR.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-Dfq-ZeBD.js";import"./index-DN371ZB7.js";import"./index-CcPN-4tC.js";import"./index-DWeu42MM.js";import"./createForOfIteratorHelper-B20TEJzF.js";import"./index-DYn5NLnm.js";import"./vendor-libredwg-DZnFzwST.js";import"./vendor-three-BPXNOO5B.js";import"./index-Ifh8ic97.js";import"./index-BoEvxLdf.js";import"./index-CnQskN5h.js";import"./isObject-BnhW0NL-.js";import"./_baseIsEqual-D66686YM.js";import"./debounce-DklBhJki.js";import"./throttle-Cn07rKEy.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-75oKq5sm.js";import"./useResourcePermissions-BWbmLFOE.js";import"./documentStatus-DXVpn59A.js";import"./purchase-GjeOcuQi.js";import"./fieldPermissionResources-Dxq2jCE-.js";import"./demandType-Bva-YUps.js";import"./quotation-BMwmdJi8.js";import"./warehouseMarkerTags-BVqgqDis.js";import"./warehouse-execution-BnSZrZf1.js";import"./sales-order-CoNSdl_o.js";import"./dataDictionary-B8BHV5b7.js";import"./material-CQOFGHSc.js";import"./purchase-requisition-BsTbUPcO.js";import"./demand-computation-BlbxKR9H.js";import"./availableInventoryCell-CN3u04Dp.js";import"./MrpMaterialPlanPanel-BWlkINp1.js";import"./workOrderReporting-DhdlRPTS.js";import"./documentAttachments-TtnQwz55.js";import"./WorkOrderMaterialMovementsPanel-BvTzU9zS.js";import"./work-order-nBexqQY2.js";import"./logisticsListPresentation-C69Be_PJ.js";import"./reporting-DjhTotj1.js";import"./afterSalesListPresentation-BSspZ_d_.js";import"./modalEventIsolation-Cy-kpAMJ.js";import"./after-sales-service-DdxDE5rE.js";import"./index-HdPxWvlJ.js";import"./index-D5EtslT5.js";import"./index-6BQYj-NX.js";import"./LineAttachmentsUpload-CrFodXZH.js";import"./AuditPhaseBadge-BHhN5bFr.js";import"./formListItems-DcSxpq1Y.js";const kr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=n.useState([]),[k,g]=n.useState(!1),[y,d]=n.useState(!1),[a,u]=n.useState(),[h,l]=n.useState(""),c=n.useRef({}),p=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:p},n.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),n.useEffect(()=>{m&&a&&p?I():l("")},[m,a,p]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});P(r);const i=r.find(o=>o.is_default)??r.find(o=>o.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!p||!a)return;const r=`${a}-${p}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!p){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const o=window.open("","_blank");o?(o.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),o.document.close(),o.focus(),o.print(),o.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return e.jsxs(E,{title:e.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[e.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),e.jsx(W,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[e.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),e.jsx(x,{type:"primary",icon:e.jsx($,{}),onClick:S,loading:y,disabled:!a||!p,children:t("common.print")},"print")],className:"work-order-print-modal",children:[e.jsx(v,{spinning:k,children:e.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:p?y&&!h?e.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:e.jsx(v,{description:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:e.jsx("div",{style:{minHeight:24}})})}):h?e.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),e.jsx("style",{children:`
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
      `})]})};export{kr as default};
