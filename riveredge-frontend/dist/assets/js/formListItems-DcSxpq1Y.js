function r(t){return Array.isArray(t)?t.filter(e=>e!=null):t&&typeof t=="object"?Object.values(t).filter(e=>e!=null):[]}function n(t){return r(t).length>0}export{n as h,r as n};
