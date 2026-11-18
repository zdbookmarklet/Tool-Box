// ==UserScript==
// @name         Toolbox | Zeta Loader
// @namespace    zdbookmarklet.toolbox
// @version      2.0.0-alpha.4
// @description  Loads Toolbox from GitHub without page inline-script injection
// @match        https://zeta-ai.io/ko*
// @match        https://*.zeta-ai.io/ko*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==
(() => {
  'use strict';
  const URL='https://raw.githubusercontent.com/zdbookmarklet/Tool-Box/main/toolbox.js';
  const PREFIX='[Toolbox Loader]';
  // Run directly in the userscript realm: Zeta CSP cannot block an inline script tag.
  function execute(code) {
    try {
      (new Function(code+'\n//# sourceURL=toolbox.js'))();
      console.info(PREFIX,'Toolbox core executed');
    } catch(error) {
      console.error(PREFIX,'Toolbox core execution failed',error);
      alert('Toolbox 실행 실패. Tampermonkey 콘솔에서 [Toolbox Loader] 오류를 확인해주세요.');
    }
  }
  if(typeof GM_xmlhttpRequest!=='function'){
    console.error(PREFIX,'GM_xmlhttpRequest unavailable');
    return;
  }
  GM_xmlhttpRequest({
    method:'GET',
    url:URL+'?v='+Date.now(),
    timeout:15000,
    onload(response) {
      if(response.status!==200){console.error(PREFIX,'Download HTTP',response.status);return}
      execute(response.responseText);
    },
    onerror(error){console.error(PREFIX,'Download failed',error)},
    ontimeout(){console.error(PREFIX,'Download timed out')}
  });
})();