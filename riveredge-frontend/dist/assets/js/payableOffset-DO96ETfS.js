const r="采购退货";function s(t){return String(t?.source_type||"").trim()===r||String(t?.status||"").trim()==="已冲减"?!0:String(t?.notes||"").startsWith("采购退货冲减")}export{s as i};
