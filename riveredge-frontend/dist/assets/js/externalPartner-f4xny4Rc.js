function o(e){return e?(e.roles??[]).some(r=>{const t=String(r.role_type??"").trim().toLowerCase(),n=String(r.external_partner_type??"").trim();return t==="external"&&n.length>0}):!1}export{o as u};
