// ==UserScript==
// @name         Toolbox | Zeta Loader
// @namespace    zdbookmarklet.toolbox
// @version      2.0.0-alpha.22
// @description  Loads Toolbox from GitHub without page inline-script injection
// @match        https://zeta-ai.io/ko*
// @match        https://*.zeta-ai.io/ko*
// @match        https://frame.pingpong.ai/*
// @all-frames   true
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==
(() => {
  'use strict';
  const URL='https://raw.githubusercontent.com/zdbookmarklet/Tool-Box/main/toolbox.js';
  const PREFIX='[Toolbox Loader]';
  // Routine loader activity is console-only; never cover the page with a toast.
  const report=message=>console.info(PREFIX,message);
  // Run directly in the userscript realm: Zeta CSP cannot block an inline script tag.
  function execute(code) {
    try {
      (new Function(code+'\n//# sourceURL=toolbox.js'))();
      // Successful execution is intentionally silent.
    } catch(error) {
      report('Toolbox 실행 오류: '+error.message);
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
      if(response.status!==200){report('Toolbox 다운로드 오류 HTTP '+response.status);console.error(PREFIX,'Download HTTP',response.status);return}
      if(location.hostname!=='frame.pingpong.ai')report('Toolbox 다운로드 성공 · '+response.responseText.length+'자');
      execute(response.responseText);
    },
    onerror(error){report('Toolbox 다운로드 실패');console.error(PREFIX,'Download failed',error)},
    ontimeout(){report('Toolbox 다운로드 시간 초과');console.error(PREFIX,'Download timed out')}
  });
})();