(() => {
  'use strict';
  const BUILD_VERSION='2.0.0-alpha.13';
  const KEY='toolbox-v2-state', LEGACY='zeta-tool-pocket-bookmarklets-v1';
  const INSTANCE='__ZETA_TOOLBOX_V2__';
  if (window[INSTANCE]) {
    if(window[INSTANCE].version===BUILD_VERSION&&document.getElementById('toolbox-v2-host'))return;
    try{window[INSTANCE].destroy?.()}catch(error){console.warn('[Toolbox] old instance cleanup',error)}
    document.getElementById('toolbox-v2-host')?.remove();
    try{delete window[INSTANCE]}catch{}
  }
  console.info('[Toolbox Core] loaded',BUILD_VERSION,location.href);
  const state=(()=>{try{return {...{locked:true,items:[],position:null,size:{w:320,h:410}},...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {locked:true,items:[],position:null,size:{w:320,h:410}}}})();
  // Recover from older builds that accidentally pinned Toolbox itself.
  const isSelfItem=item=>item?.type==='script'&&(
    /toolbox|tool-pocket|zeta-all-loader|toolbox-v2-host/i.test(String(item.name||''))||
    /toolbox|tool-pocket|toolbox-v2-host/i.test(String(item.selector||''))||
    String(item.selector||'').trim()==='button.launcher'
  );
  const beforeCount=state.items.length;
  state.items=state.items.filter(item=>!isSelfItem(item));
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
  const esc=s=>CSS.escape(s);
  if(state.items.length!==beforeCount)save();
  // Recovery mode: keep saved registrations, but suspend all automatic hiding.
  // Older selector-based pins could match unrelated launchers or the Toolbox itself.
  const RECOVERY_MODE=false;
  // Preserve saved lock and position; safe capture rules are enforced below.
  const candidates=new Map();
  const tracked=new Map();
  let collecting=false,observer=null,host,shadow,button,panel,list,status,grip,pressTimer,pressed=false;
  const icon='<svg viewBox="0 0 48 48" width="18" height="18" fill="none" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="5" fill="currentColor" opacity=".82"/><path d="M5 15c0-2 2-4 4-4h30c2 0 4 2 4 4v7H5z" fill="currentColor"/><path d="M24 11v31M9 27h30" stroke="white" stroke-width="3" opacity=".9"/><path d="M23 12C11 13 11 3 17 4c4 0 6 5 7 8Zm2 0C37 13 37 3 31 4c-4 0-6 5-7 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>';
  function roots(root=document){
    const out=[]; const walk=node=>{
      if(node===shadow||node?.host?.id==='toolbox-v2-host')return;
      out.push(node);
      node.querySelectorAll?.('*').forEach(el=>{if(el.id==='toolbox-v2-host')return;if(el.shadowRoot){walk(el.shadowRoot)}});
    };walk(root);return out;
  }
  function matchesItem(el,item){
    if(!el||!el.isConnected||!item.selector)return false;
    try{return el.matches(item.selector)}catch{return false}
  }
  function applyPinned(){
    if(RECOVERY_MODE)return;
    for(const item of state.items.filter(x=>x.type==='script'&&x.selector&&x.safeCapture===true)){
      let found=false;
      for(const root of roots()){
        try{root.querySelectorAll(item.selector).forEach(el=>{
          if(el===host||el.getRootNode?.()===shadow||el.closest?.('#toolbox-v2-host'))return;
          el.setAttribute('data-toolbox-pinned',item.id);
          el.style.setProperty('display','none','important');
          tracked.set(item.id,el);found=true;
        })}catch{}
      }
      if(!found)tracked.delete(item.id);
    }
  }
  function selectorFor(el){
    if(el.id&&!/\d{5,}/.test(el.id))return '#'+esc(el.id);
    for(const attr of ['data-testid']){
      const val=el.getAttribute(attr);if(val&&val.length<90)return el.tagName.toLowerCase()+'['+attr+'="'+CSS.escape(val)+'"]';
    }
    // Only allow selectors that uniquely identify one external element.
    const cls=[...el.classList].filter(c=>/^[a-zA-Z][\w-]{2,}$/.test(c)&&!/^css-|^sc-|^hover:|^focus:/.test(c));
    for(const c of cls){
      const selector=el.tagName.toLowerCase()+'.'+esc(c);
      try{if(roots().reduce((n,r)=>n+r.querySelectorAll(selector).length,0)===1)return selector}catch{}
    }
    return '';
  }
  // Tool-pocket 1.x compatibility: known Zeta launchers and stable host metadata.
  const KNOWN_TOOLS='#zeta-screen-fit-control,#zeta-persona-editor-host,#zpc-userscript-launcher,#zeta-chat-summary-float-button,#zeta-visible-join-button,#zk-memory-fab,#zeta-shell-api-export-button,#zk_memo_dock,#zk-chat-games-root,[data-zeta-review-tabbar-drag="true"],[data-inpocket],[data-zeta-pocket-shadow-tools],[id^="zk-"],[id*="zetakit"],[id*="inpocket"],[id*="launcher"],[id*="toolbar"],[id*="tool-bar"],[id*="tabbar"],[id*="dock"],[class*="inpocket"],[class*="toolbar"],[class*="tool-bar"],[class*="tabbar"],[class*="dock"]';
  const normalizeName=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,40);
  const genericName=/^(중단|정지|닫기|열기|메뉴|햄버거|토글|실행|설정|on|off|start|stop|close|open|menu|toggle|button|fab)$/i;
  function toolName(node,button){
    const root=node.shadowRoot;
    const title=root?.querySelector('.brand,.title,.header-title,h1,h2,h3,[data-tool-name]')||
      node.querySelector?.('.brand,.title,.header-title,h1,h2,h3,[data-tool-name]');
    const candidates=[
      node.getAttribute('data-tool-name'),node.getAttribute('data-name'),node.getAttribute('data-label'),
      node.getAttribute('aria-label'),node.title,title?.getAttribute('data-tool-name'),title?.textContent,
      node.id,button.getAttribute?.('data-tool-name'),button.getAttribute?.('data-name'),
      button.getAttribute?.('aria-label'),button.title,button.textContent
    ];
    for(const raw of candidates){
      let name=normalizeName(raw);
      if(!name||genericName.test(name)||name.length>35)continue;
      if(/^zeta-|^zk-|^zpc-/i.test(name))name=name.replace(/^zeta-|^zk-|^zpc-/i,'').replace(/[-_]/g,' ');
      if(name&& !genericName.test(name))return name;
    }
    return '외부 도구';
  }
  function stableSelector(el){
    const direct=selectorFor(el);
    if(direct)return direct;
    for(const attr of ['data-name','data-label','aria-label','title']){
      const v=el.getAttribute?.(attr);
      if(v&&v.length<70){
        const selector=el.tagName.toLowerCase()+'['+attr+'="'+CSS.escape(v)+'"]';
        try{if(roots().reduce((n,r)=>n+r.querySelectorAll(selector).length,0)===1)return selector}catch{}
      }
    }
    return '';
  }
  function floatingTool(el){
    if(!(el instanceof Element)||el===host||el.getRootNode?.()===shadow||el.closest?.('#toolbox-v2-host'))return null;
    const chain=[];let n=el;
    for(let i=0;n&&i<8;i++,n=n.parentElement||n.getRootNode?.()?.host)chain.push(n);
    for(const node of chain){
      if(node.id==='toolbox-v2-host')return null;
      const r=node.getBoundingClientRect(),p=getComputedStyle(node).position;
      if(r.width<15||r.height<15||r.width>240||r.height>240)continue;
      if(!['fixed','absolute','sticky'].includes(p))continue;
      if(node.closest?.('header,nav,[role="navigation"]')&&!node.matches(KNOWN_TOOLS))continue;
      const selector=stableSelector(node)||stableSelector(el);
      if(!selector)continue;
      const label=toolName(node,el);
      if(isSelfItem({type:'script',name:label,selector}))return null;
      return {el:node,selector,label};
    }
    return null;
  }
  function collect(){
    if(RECOVERY_MODE||state.locked)return;
    candidates.clear();
    for(const root of roots()){
      root.querySelectorAll(KNOWN_TOOLS+',button,[role="button"],[class*="float"],[class*="Float"],[class*="fab"],[class*="Fab"],[style*="fixed"],[style*="absolute"]').forEach(el=>{
        if(el.hasAttribute('data-toolbox-pinned'))return;
        const tool=floatingTool(el);
        if(tool&&!state.items.some(x=>x.type==='script'&&x.selector===tool.selector))candidates.set(tool.selector,tool);
      });
    }
  }
  function render(){
    status.textContent=(state.locked?'수납 잠금':'수납 활성')+' · '+BUILD_VERSION;
    button.classList.toggle('locked',state.locked);
    list.replaceChildren();
    const add=(label,action,kind,item=null)=>{
      const row=document.createElement('div');row.className='item';
      const run=document.createElement('button');run.className='run';const glyph=document.createElement('span');glyph.className='tool-icon';glyph.textContent=item?.icon|| (kind==='SCRIPT'?'🧩':kind==='BM'?'🔖':kind==='설치'?'📥':kind==='코드'?'📝':'＋');const name=document.createElement('span');name.className='tool-name';name.textContent=label;run.append(glyph,name);run.addEventListener('click',action);
      row.append(run);list.append(row);return row;
    };
    const sortedItems=[...state.items].sort((a,b)=>String(a.category||'기본').localeCompare(String(b.category||'기본'),'ko'));
    let lastCategory='';
    sortedItems.forEach(item=>{
      const category=String(item.category||'기본');
      if(category!==lastCategory){const heading=document.createElement('div');heading.className='category-heading';heading.textContent=category;list.append(heading);lastCategory=category;}
      const row=add(item.name,()=>{
        if(item.type==='url'){openInstall(item.url)}else if(item.type==='code'){showCode(item)}else if(item.type==='bookmarklet'){
          try{const code=item.code.replace(/^javascript:/i,'');(0,eval)(code)}catch(e){alert('북마클릿 실행 실패: '+e.message)}
        }else{
          let target=tracked.get(item.id);
          if(!target?.isConnected){
            for(const root of roots()){try{target=root.querySelector(item.selector);if(target)break}catch{}}
          }
          if(target){target.click()}else{alert('도구 버튼을 찾을 수 없습니다. 유저스크립트가 실행 중인지 확인해주세요.')}
        }
      },item.type==='script'?'SCRIPT':item.type==='url'?'설치':item.type==='code'?'코드':'BM',item);
      const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.title='수납 해제';
      remove.addEventListener('click',()=>{
        if(item.type==='script'){for(const root of roots()){try{root.querySelectorAll(item.selector).forEach(el=>{el.style.removeProperty('display');el.removeAttribute('data-toolbox-pinned')})}catch{}}}
        state.items=state.items.filter(x=>x.id!==item.id);save();render();
      });row.append(remove);
    });
    if(!state.items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='아직 담긴 도구가 없습니다';list.append(empty)}
    if(!state.locked&&!RECOVERY_MODE){
      collect();
      for(const [selector,c] of candidates){
        if(isSelfItem({type:'script',name:c.label,selector}))continue;
        if(state.items.some(x=>x.selector===selector))continue;
        const row=add(c.label,()=>{state.items.push({id:'script-'+Date.now(),type:'script',name:c.label,selector,safeCapture:true});save();applyPinned();render()},'추가 +');
        row.classList.add('candidate');
      }
    }
  }
  function addManagedTool(type,name,value,icon='🧩',category='기본'){
    name=name.trim();value=value.trim();
    if(!name||!value)return alert('이름과 내용을 입력해주세요.');
    if(type==='url'){
      let url;try{url=new URL(value)}catch{return alert('올바른 URL을 입력해주세요.')}
      if(url.protocol!=='https:')return alert('HTTPS 주소만 등록할 수 있습니다.');
      value=url.href;
    }
    state.items.push({id:'managed-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type,name,icon:icon.trim()||'🧩',category:category.trim()||'기본',...(type==='url'?{url:value}:{code:value})});
    save();render();return true;
  }
  function openManager(kind='script'){
    const old=shadow.querySelector('.manager');if(old)old.remove();
    const isBookmarklet=kind==='bookmarklet';
    const wrap=document.createElement('div');wrap.className='manager';
    wrap.innerHTML=`<div class="manager-card"><div class="manager-title">${isBookmarklet?'북마클릿':'유저스크립트'} 추가 <button class="manager-close" aria-label="닫기">×</button></div>
    ${isBookmarklet?'':'<label>등록 방식<select class="manager-type"><option value="url">설치 URL 연결</option><option value="code">코드 보관</option></select></label>'}
    <label>이름<input class="manager-name" placeholder="도구 이름" maxlength="80"></label>
    <div class="manager-two"><label>아이콘<input class="manager-icon" placeholder="🔖" maxlength="12" value="${isBookmarklet?'🔖':'🧩'}"></label><label>카테고리<input class="manager-category" list="toolbox-category-options" placeholder="기본" maxlength="32" value="기본"></label></div>
    <datalist id="toolbox-category-options"><option value="기본"><option value="편집"><option value="꾸미기"><option value="관리"><option value="기타"></datalist>
    <label class="manager-value-label">${isBookmarklet?'북마클릿 코드':'HTTPS .user.js 주소'}<textarea class="manager-value" rows="5" placeholder="${isBookmarklet?'javascript:(()=>{...})()':'https://example.com/tool.user.js'}"></textarea></label>
    <p class="manager-help">${isBookmarklet?'javascript:로 시작하는 북마클릿 코드를 등록합니다.':'설치 URL은 Tampermonkey 설치 페이지를 여는 방식입니다. 코드 보관은 자동 실행되지 않으며 GM_* 권한도 제공하지 않습니다.'}</p>
    <div class="manager-actions"><button class="manager-cancel" type="button">취소</button><button class="manager-save" type="button">등록</button></div></div>`;
    panel.append(wrap);
    const type=wrap.querySelector('.manager-type'),name=wrap.querySelector('.manager-name'),value=wrap.querySelector('.manager-value');
    if(type)type.onchange=()=>{wrap.querySelector('.manager-value-label').firstChild.textContent=type.value==='url'?'HTTPS .user.js 주소':'유저스크립트 코드';value.placeholder=type.value==='url'?'https://example.com/tool.user.js':'// ==UserScript==\\n// ...'};
    const close=()=>wrap.remove();
    wrap.querySelector('.manager-close').onclick=close;wrap.querySelector('.manager-cancel').onclick=close;
    wrap.querySelector('.manager-save').onclick=()=>{
      const icon=wrap.querySelector('.manager-icon').value.trim()||(isBookmarklet?'🔖':'🧩');
      const category=wrap.querySelector('.manager-category').value.trim()||'기본';
      if(isBookmarklet){
        const code=value.value.trim();if(!name.value.trim()||!code)return alert('이름과 코드를 입력해주세요.');
        if(!/^javascript:/i.test(code))return alert('javascript:로 시작하는 북마클릿 코드를 입력해주세요.');
        state.items.push({id:'bm-'+Date.now(),type:'bookmarklet',name:name.value.trim(),code,icon,category});save();render();close();
      }else if(addManagedTool(type.value,name.value,value.value,icon,category))close();
    };
  }
  function openInstall(url){
    // Browsers/userscript managers decide whether an installation prompt appears.
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    shadow.append(a);a.click();a.remove();
  }
  function showCode(item){
    const wrap=document.createElement('div');wrap.className='manager';
    const card=document.createElement('div');card.className='manager-card';
    const title=document.createElement('div');title.className='manager-title';title.textContent=item.name;
    const close=document.createElement('button');close.textContent='×';close.className='manager-close';close.onclick=()=>wrap.remove();title.append(close);
    const code=document.createElement('textarea');code.className='manager-value';code.rows=9;code.value=item.code;
    const hint=document.createElement('p');hint.className='manager-help';hint.textContent='보관된 코드입니다. 자동 실행되지 않습니다. Tampermonkey 편집기에 복사해 설치하세요.';
    const actions=document.createElement('div');actions.className='manager-actions';
    const copy=document.createElement('button');copy.textContent='코드 복사';copy.onclick=()=>{navigator.clipboard?.writeText(code.value).then(()=>{copy.textContent='복사됨'}).catch(()=>{code.select();document.execCommand('copy')})};
    const saveBtn=document.createElement('button');saveBtn.textContent='수정 저장';saveBtn.onclick=()=>{item.code=code.value;save();wrap.remove()};
    actions.append(copy,saveBtn);card.append(title,code,hint,actions);wrap.append(card);panel.append(wrap);
  }
  function init(){
    host=document.createElement('div');host.id='toolbox-v2-host';document.body.append(host);
    shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{all:initial;font-family:system-ui,-apple-system,sans-serif;color:#354735;z-index:2147483000;position:fixed;inset:0;pointer-events:none}
      *{box-sizing:border-box}button,input{font:inherit}
      .launcher{position:fixed;left:calc(100vw - 64px);top:50vh;width:34px;height:34px;display:grid;place-items:center;border:1px solid #b7cdaa;border-radius:15px;background:#e4f1da;color:#719a5c;box-shadow:0 5px 18px #35473530;pointer-events:auto;touch-action:none;cursor:grab}
      .launcher.locked{background:#ebebeb;color:#929292;border-color:#d1d1d1}
      .panel{position:fixed;display:none;width:320px;height:410px;min-width:260px;min-height:230px;max-width:95vw;max-height:85vh;background:rgba(247,250,245,.97);border:1px solid #d9e5d4;border-radius:25px;box-shadow:0 18px 50px #203a2c38;pointer-events:auto;overflow:hidden;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
      .panel.open{display:flex;flex-direction:column}
      .head{display:flex;align-items:center;gap:10px;padding:16px 14px 13px;background:#f4f8f0;border-bottom:1px solid #e2eadf}
      .brand{font-size:16px;font-weight:800;letter-spacing:-.4px}.build{font-size:9px;font-weight:700;color:#91a48c;letter-spacing:0}.status{font-size:10px;color:#8b9e86;margin-top:3px}
      .close,.remove{border:0;background:transparent;color:#799274;cursor:pointer;font-size:20px}
      .close{margin-left:auto;width:30px;height:30px;border-radius:10px;background:#e7efe2}
      .tools{flex:1;min-height:0;overflow:auto;padding:15px 12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-content:start;gap:10px 8px;overscroll-behavior:contain}
      .category-heading{grid-column:1/-1;font-size:11px;font-weight:800;color:#82987a;letter-spacing:.02em;padding:5px 3px 0;border-bottom:1px solid #e5ede1;padding-bottom:7px}.item{position:relative;min-width:0}
      .run{width:100%;min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:1px solid #e0e9dc;border-radius:17px;background:#fff;color:#40543e;cursor:pointer;padding:10px 5px;box-shadow:0 2px 6px #3c5a3310}
      .run:active{transform:scale(.97);background:#edf5e9}
      .tool-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#e8f1e3;font-size:17px;line-height:1}
      .tool-name{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:10px;font-weight:700}
      .remove{position:absolute;top:-5px;right:-4px;width:19px;height:19px;border-radius:50%;background:#d67b7b;color:#fff;font-size:15px;line-height:19px;box-shadow:0 1px 4px #0002}
      .candidate .run{border-style:dashed;background:#f4f9f0}.candidate .tool-icon{background:#deedda}
      .empty{grid-column:1/-1;text-align:center;color:#8b9a86;padding:36px 0;font-size:12px}
      .bottom{padding:10px 12px 14px;border-top:1px solid #e5ede1;display:flex;flex-wrap:wrap;gap:6px;background:#f8faf6}
      .bottom button{flex:1;white-space:nowrap;border:1px solid #d7e5d0;border-radius:11px;background:#edf5e8;color:#5b7d4d;padding:9px 5px;cursor:pointer;font-size:11px;font-weight:700}
      .manager{position:absolute;inset:0;background:#172d1a55;display:flex;align-items:center;justify-content:center;padding:12px;z-index:3}.manager-card{background:white;border-radius:14px;width:100%;max-height:100%;overflow:auto;padding:15px;box-shadow:0 8px 30px #182e1b30}.manager-title{font-weight:750;font-size:15px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.manager-close{border:0;background:transparent;font-size:21px;color:#82947a}.manager-card label{display:block;font-size:12px;color:#587052;margin:10px 0}.manager-card input,.manager-card select,.manager-card textarea{display:block;width:100%;border:1px solid #d5e5ce;border-radius:8px;padding:9px;margin-top:5px;background:#fff;color:#334b35;font-size:12px}.manager-card textarea{resize:vertical;min-height:75px}.manager-help{font-size:11px;line-height:1.5;color:#778a70}.manager-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.manager-actions button{border:1px solid #d5e5ce;background:#eaf4e5;border-radius:8px;padding:8px 12px;color:#527b43}.grip{position:absolute;right:5px;bottom:5px;width:22px;height:22px;cursor:nwse-resize;touch-action:none;opacity:.55;background:repeating-linear-gradient(135deg,transparent 0 5px,#94ad89 5px 6px,transparent 6px 9px);clip-path:polygon(100% 0,100% 100%,0 100%)}
    </style><button class="launcher" aria-label="Toolbox 열기">${icon}</button><section class="panel"><div class="head"><div><div class="brand">Toolbox <span class="build">v${BUILD_VERSION}</span></div><div class="status"></div></div><button class="close" aria-label="닫기">×</button></div><div class="tools"></div><div class="bottom"><button class="addscript">+ 유저스크립트</button><button class="addbm">+ 북마클릿</button><button class="toggle">수납 모드 전환</button><button class="pick">+ 화면에서 선택</button></div><div class="grip" aria-label="크기 조절"></div></section>`;
    button=shadow.querySelector('.launcher');button.title='Toolbox '+BUILD_VERSION;panel=shadow.querySelector('.panel');list=shadow.querySelector('.tools');status=shadow.querySelector('.status');grip=shadow.querySelector('.grip');
    // Never trust a persisted position without checking the current viewport.
    if(state.position&&Number.isFinite(Number(state.position.x))&&Number.isFinite(Number(state.position.y))){
      const x=clamp(Number(state.position.x),4,Math.max(4,innerWidth-38));
      const y=clamp(Number(state.position.y),4,Math.max(4,innerHeight-38));
      button.style.left=x+'px';button.style.top=y+'px';
      if(x!==state.position.x||y!==state.position.y){state.position={x,y};save()}
    }else{state.position=null;save()}
    button.style.setProperty('display','grid','important');
    button.style.setProperty('visibility','visible','important');
    panel.style.width=state.size.w+'px';panel.style.height=state.size.h+'px';
    const open=()=>{const r=button.getBoundingClientRect();panel.style.left=clamp(r.left-state.size.w,8,Math.max(8,innerWidth-state.size.w-8))+'px';panel.style.top=clamp(r.top,8,Math.max(8,innerHeight-state.size.h-8))+'px';panel.classList.add('open');render()};
    shadow.querySelector('.close').onclick=()=>panel.classList.remove('open');
    const toggle=()=>{state.locked=!state.locked;save();render()};
    shadow.querySelector('.toggle').onclick=toggle;
    shadow.querySelector('.addscript').onclick=()=>openManager('script');
    shadow.querySelector('.addbm').onclick=()=>openManager('bookmarklet');
    // Fallback for launchers that cannot be discovered by heuristic scans.
    let pickMode=false;
    const pickButton=shadow.querySelector('.pick');
    const setPick=on=>{
      pickMode=on;
      pickButton.textContent=on?'선택 취소':'+ 화면에서 선택';
      status.textContent=on?'화면에서 외부 도구 버튼을 터치하세요':(state.locked?'수납 잠금':'수납 활성')+' · '+BUILD_VERSION;
      if(on)panel.classList.remove('open');
    };
    pickButton.onclick=()=>setPick(!pickMode);
    document.addEventListener('pointerdown',e=>{
      if(!pickMode)return;
      const path=e.composedPath();
      if(path.includes(host)||path.some(n=>n instanceof Element&&n.id==='toolbox-v2-host'))return;
      const target=path.find(n=>n instanceof Element&&n!==document.documentElement&&n!==document.body);
      if(!target)return;
      e.preventDefault();e.stopImmediatePropagation();
      const tool=floatingTool(target)||(()=>{
        let n=target;
        for(let i=0;n&&i<8;i++,n=n.parentElement||n.getRootNode?.()?.host){
          const rect=n.getBoundingClientRect();
          if(rect.width<15||rect.height<15||rect.width>260||rect.height>260)continue;
          const selector=stableSelector(n);
          if(selector)return {el:n,selector,label:toolName(n,target)};
        }
        return null;
      })();
      if(!tool){alert('이 버튼은 고유 식별자가 없어 안전하게 수납할 수 없습니다.');setPick(false);return}
      if(!state.items.some(x=>x.type==='script'&&x.selector===tool.selector)){
        state.items.push({id:'script-'+Date.now(),type:'script',name:tool.label,selector:tool.selector,safeCapture:true,icon:'🧩',category:'기본'});
        save();applyPinned();
      }
      setPick(false);panel.classList.add('open');render();
    },true);
    document.addEventListener('click',e=>{
      if(!pickMode)return;
      if(e.composedPath().includes(host))return;
      e.preventDefault();e.stopImmediatePropagation();
    },true);

    let drag=null,skipClick=false;
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;pressed=false;skipClick=false;
      const r=button.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};
      button.setPointerCapture(e.pointerId);
      clearTimeout(pressTimer);pressTimer=setTimeout(()=>{if(drag&&!drag.moved){pressed=true;skipClick=true;toggle()}},550);
    });
    button.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)>7){drag.moved=true;skipClick=true;clearTimeout(pressTimer)}
      if(drag.moved){button.style.left=clamp(drag.left+dx,4,innerWidth-52)+'px';button.style.top=clamp(drag.top+dy,4,innerHeight-52)+'px'}
    });
    const finish=e=>{if(!drag)return;clearTimeout(pressTimer);if(drag.moved){state.position={x:parseFloat(button.style.left),y:parseFloat(button.style.top)};save()}drag=null};
    button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);
    button.addEventListener('click',()=>{if(skipClick||pressed){skipClick=false;pressed=false;return}panel.classList.contains('open')?panel.classList.remove('open'):open()});
    // Drag a floating external tool onto the launcher to collect it.
    // Capture the gesture without interfering with the tool's own pointer handlers.
    let incoming=null;
    const externalTarget=(event)=>{
      for(const node of event.composedPath()){
        if(!(node instanceof Element))continue;
        const tool=floatingTool(node);
        if(tool)return tool;
      }
      return null;
    };
    document.addEventListener('pointerdown',e=>{
      if(state.locked||e.button!==0)return;
      const tool=externalTarget(e);
      incoming=tool?{...tool,id:e.pointerId,x:e.clientX,y:e.clientY}:null;
    },true);
    const finishIncoming=e=>{
      if(!incoming||incoming.id!==e.pointerId)return;
      const c=incoming;incoming=null;
      if(state.locked||Math.hypot(e.clientX-c.x,e.clientY-c.y)<18)return;
      const r=button.getBoundingClientRect();
      const inLauncher=e.clientX>=r.left-26&&e.clientX<=r.right+26&&e.clientY>=r.top-26&&e.clientY<=r.bottom+26;
      const pr=panel.getBoundingClientRect();
      const inPanel=panel.classList.contains('open')&&e.clientX>=pr.left&&e.clientX<=pr.right&&e.clientY>=pr.top&&e.clientY<=pr.bottom;
      if(!inLauncher&&!inPanel)return;
      if(state.items.some(item=>item.type==='script'&&item.selector===c.selector))return;
      state.items.push({id:'script-'+Date.now(),type:'script',name:c.label,selector:c.selector,safeCapture:true,icon:'🧩',category:'기본'});
      save();applyPinned();render();
    };
    document.addEventListener('pointerup',finishIncoming,true);
    window.addEventListener('pointerup',finishIncoming,true);
    document.addEventListener('pointercancel',()=>{incoming=null},true);
    let resize=null;
    grip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:panel.offsetWidth,h:panel.offsetHeight};grip.setPointerCapture(e.pointerId)});
    grip.addEventListener('pointermove',e=>{if(!resize||e.pointerId!==resize.id)return;state.size.w=clamp(resize.w+e.clientX-resize.x,260,innerWidth-20);state.size.h=clamp(resize.h+e.clientY-resize.y,230,innerHeight-20);panel.style.width=state.size.w+'px';panel.style.height=state.size.h+'px'});
    grip.addEventListener('pointerup',()=>{resize=null;save()});grip.addEventListener('pointercancel',()=>{resize=null;save()});
    // Re-hide recreated launchers without full-page periodic scans.
    let scheduled=false;
    observer=new MutationObserver(muts=>{
      if(scheduled||!muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1)))return;
      scheduled=true;requestAnimationFrame(()=>{scheduled=false;applyPinned();if(!state.locked&&panel.classList.contains('open'))render()});
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    addEventListener('resize',()=>{const r=button.getBoundingClientRect();const x=clamp(r.left,4,Math.max(4,innerWidth-52)),y=clamp(r.top,4,Math.max(4,innerHeight-52));button.style.left=x+'px';button.style.top=y+'px';state.position={x,y};save()},{passive:true});
    // Undo stale inline hiding left by older Toolbox versions.
    for(const el of document.querySelectorAll('[data-toolbox-pinned]')){
      el.style.removeProperty('display');
      el.removeAttribute('data-toolbox-pinned');
    }
    applyPinned();render();
  }
  window[INSTANCE]={version:BUILD_VERSION,destroy(){observer?.disconnect();host?.remove();delete window[INSTANCE]},rescan(){applyPinned();render()}};
  if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();