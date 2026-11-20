// ==UserScript==
// @name         Toolbox Pocket Loader
// @namespace    zdbookmarklet.toolbox.pocket
// @version      1.1.0
// @description  GitHub에서 도구주머니 기반 Toolbox 코어를 불러옵니다.
// @match        https://zeta-ai.io/ko
// @match        https://zeta-ai.io/ko/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==
(() => {
  'use strict';
  // Install the closed-ShadowRoot recorder synchronously, before the async core request.
  // The Pocket core reads the same WeakMap on initialization.
  const bootstrap=document.createElement('script');
  bootstrap.textContent=`(() => {
    const KEY='__ZETA_POCKET_CAPTURED_SHADOW_ROOTS_V1__';
    const FLAG='__TOOLBOX_POCKET_EARLY_CAPTURE_V1__';
    if(window[FLAG])return;
    window[FLAG]=true;
    const map=window[KEY] instanceof WeakMap ? window[KEY] : new WeakMap();
    window[KEY]=map;
    const proto=Element.prototype;
    const native=proto.attachShadow;
    if(typeof native!=='function')return;
    proto.attachShadow=function(init){
      const root=Reflect.apply(native,this,[init]);
      map.set(this,root);
      return root;
    };
  })();`;
  (document.head||document.documentElement).appendChild(bootstrap);
  bootstrap.remove();
  const url='https://raw.githubusercontent.com/zdbookmarklet/Tool-Box/main/pocket-core.js';
  GM_xmlhttpRequest({
    method:'GET',url:url+'?t='+Date.now(),
    onload:r=>{
      if(r.status!==200){console.error('[Toolbox] 코어 불러오기 실패:',r.status);return}
      const script=document.createElement('script');
      script.textContent=r.responseText+'\n//# sourceURL=toolbox-pocket-core.js';
      (document.head||document.documentElement).appendChild(script);
      script.remove();
    },
    onerror:e=>console.error('[Toolbox] 코어 네트워크 오류',e)
  });
})();