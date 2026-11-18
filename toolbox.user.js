// ==UserScript==
// @name         Toolbox | Zeta Loader (legacy filename)
// @namespace    zdbookmarklet.toolbox
// @version      2.0.0-alpha.2
// @description  Load Toolbox from GitHub; edit toolbox.js to update without reinstalling
// @match        https://zeta-ai.io/ko*
// @match        https://*.zeta-ai.io/ko*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @allFrames    true
// ==/UserScript==
(() => {
  'use strict';
  const SOURCE='https://raw.githubusercontent.com/zdbookmarklet/Tool-Box/main/toolbox.js';
  const TIMEOUT=12000;
  const tag='[Toolbox Loader]';
  GM_xmlhttpRequest({
    method:'GET',
    url:SOURCE+'?t='+Date.now(),
    timeout:TIMEOUT,
    headers:{'Cache-Control':'no-cache'},
    onload(response){
      if(response.status!==200){console.error(tag,'HTTP',response.status);return;}
      try{
        // Execute in the current frame's page context, so DOM integrations can work.
        const script=document.createElement('script');
        script.textContent=response.responseText+'\n//# sourceURL=toolbox.js';
        (document.head||document.documentElement).appendChild(script);
        script.remove();
      }catch(error){console.error(tag,'Failed to inject Toolbox:',error);}
    },
    onerror(error){console.error(tag,'Failed to download Toolbox:',error);},
    ontimeout(){console.error(tag,'Download timed out');}
  });
})();