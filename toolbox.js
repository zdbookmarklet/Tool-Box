(() => {
  'use strict';
  const KEY='toolbox-v2-state', LEGACY='zeta-tool-pocket-bookmarklets-v1';
  const INSTANCE='__ZETA_TOOLBOX_V2__';
  if (window[INSTANCE]) return;
  const state=(()=>{try{return {...{locked:true,items:[],position:null,size:{w:320,h:410}},...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {locked:true,items:[],position:null,size:{w:320,h:410}}}})();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
  const esc=s=>CSS.escape(s);
  const candidates=new Map();
  const tracked=new Map();
  let collecting=false,observer=null,host,shadow,button,panel,list,status,grip,pressTimer,pressed=false;
  const icon='<svg viewBox="0 0 48 48" width="31" height="31" fill="none" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="5" fill="currentColor" opacity=".82"/><path d="M5 15c0-2 2-4 4-4h30c2 0 4 2 4 4v7H5z" fill="currentColor"/><path d="M24 11v31M9 27h30" stroke="white" stroke-width="3" opacity=".9"/><path d="M23 12C11 13 11 3 17 4c4 0 6 5 7 8Zm2 0C37 13 37 3 31 4c-4 0-6 5-7 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>';
  function roots(root=document){
    const out=[root]; const walk=node=>{
      node.querySelectorAll?.('*').forEach(el=>{if(el.shadowRoot){out.push(el.shadowRoot);walk(el.shadowRoot)}});
    };walk(root);return out;
  }
  function matchesItem(el,item){
    if(!el||!el.isConnected||!item.selector)return false;
    try{return el.matches(item.selector)}catch{return false}
  }
  function applyPinned(){
    for(const item of state.items.filter(x=>x.type==='script'&&x.selector)){
      let found=false;
      for(const root of roots()){
        try{root.querySelectorAll(item.selector).forEach(el=>{
          if(el.closest?.('#toolbox-v2-host'))return;
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
    for(const attr of ['data-testid','aria-label','title']){
      const val=el.getAttribute(attr);if(val&&val.length<90)return el.tagName.toLowerCase()+'['+attr+'="'+CSS.escape(val)+'"]';
    }
    const classes=[...el.classList].filter(c=>/^[a-zA-Z][\w-]{2,}$/.test(c)&&!/^css-|^sc-/.test(c)).slice(0,2);
    if(classes.length)return el.tagName.toLowerCase()+classes.map(c=>'.'+esc(c)).join('');
    return '';
  }
  function collect(){
    if(state.locked)return;
    candidates.clear();
    for(const root of roots()){
      root.querySelectorAll('button,[role="button"],[id*="launcher"],[class*="fab"]').forEach(el=>{
        if(el.closest?.('#toolbox-v2-host')||el.hasAttribute('data-toolbox-pinned'))return;
        const style=getComputedStyle(el),r=el.getBoundingClientRect();
        if(r.width<15||r.height<15||r.width>160||r.height>160)return;
        if(style.position!=='fixed'&&style.position!=='absolute')return;
        const selector=selectorFor(el);if(!selector)return;
        const label=(el.getAttribute('aria-label')||el.title||el.textContent||el.id||'외부 도구').trim().slice(0,40);
        candidates.set(selector,{el,label,selector});
      });
    }
  }
  function render(){
    status.textContent=state.locked?'수납 잠금':'수납 활성';
    button.classList.toggle('locked',state.locked);
    list.replaceChildren();
    const add=(label,action,kind)=>{
      const row=document.createElement('div');row.className='item';
      const run=document.createElement('button');run.className='run';run.textContent=label;run.addEventListener('click',action);
      const tag=document.createElement('span');tag.className='tag';tag.textContent=kind;
      row.append(run,tag);list.append(row);return row;
    };
    state.items.forEach(item=>{
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
      },item.type==='script'?'SCRIPT':item.type==='url'?'설치':item.type==='code'?'코드':'BM');
      const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.title='수납 해제';
      remove.addEventListener('click',()=>{
        if(item.type==='script'){for(const root of roots()){try{root.querySelectorAll(item.selector).forEach(el=>{el.style.removeProperty('display');el.removeAttribute('data-toolbox-pinned')})}catch{}}}
        state.items=state.items.filter(x=>x.id!==item.id);save();render();
      });row.append(remove);
    });
    if(!state.items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='등록된 도구가 없습니다';list.append(empty)}
    if(!state.locked){
      collect();
      for(const [selector,c] of candidates){
        if(state.items.some(x=>x.selector===selector))continue;
        const row=add(c.label,()=>{state.items.push({id:'script-'+Date.now(),type:'script',name:c.label,selector});save();applyPinned();render()},'추가 +');
        row.classList.add('candidate');
      }
    }
  }
  function addManagedTool(type,name,value){
    name=name.trim();value=value.trim();
    if(!name||!value)return alert('이름과 내용을 입력해주세요.');
    if(type==='url'){
      let url;try{url=new URL(value)}catch{return alert('올바른 URL을 입력해주세요.')}
      if(url.protocol!=='https:')return alert('HTTPS 주소만 등록할 수 있습니다.');
      value=url.href;
    }
    state.items.push({id:'managed-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type,name,...(type==='url'?{url:value}:{code:value})});
    save();render();return true;
  }
  function openManager(){
    const old=shadow.querySelector('.manager');if(old){old.remove();return}
    const wrap=document.createElement('div');wrap.className='manager';
    wrap.innerHTML=`<div class="manager-card"><div class="manager-title">유저스크립트 추가 <button class="manager-close" aria-label="닫기">×</button></div><label>등록 방식<select class="manager-type"><option value="url">설치 URL 연결</option><option value="code">코드 보관</option></select></label><label>이름<input class="manager-name" placeholder="예: Text Flip" maxlength="80"></label><label class="manager-value-label">HTTPS .user.js 주소<textarea class="manager-value" rows="4" placeholder="https://example.com/tool.user.js"></textarea></label><p class="manager-help">설치 URL은 Tampermonkey 설치 페이지를 여는 방식입니다. 코드 보관은 자동 실행되지 않으며 GM_* 권한도 제공하지 않습니다.</p><div class="manager-actions"><button class="manager-cancel">취소</button><button class="manager-save">등록</button></div></div>`;
    panel.append(wrap);
    const type=wrap.querySelector('.manager-type'),name=wrap.querySelector('.manager-name'),value=wrap.querySelector('.manager-value');
    type.onchange=()=>{wrap.querySelector('.manager-value-label').firstChild.textContent=type.value==='url'?'HTTPS .user.js 주소':'유저스크립트 코드';value.placeholder=type.value==='url'?'https://example.com/tool.user.js':'// ==UserScript==\\n// ...'};
    const close=()=>wrap.remove();
    wrap.querySelector('.manager-close').onclick=close;wrap.querySelector('.manager-cancel').onclick=close;
    wrap.querySelector('.manager-save').onclick=()=>{if(addManagedTool(type.value,name.value,value.value))close()};
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
      .launcher{position:fixed;left:calc(100vw - 64px);top:50vh;width:48px;height:48px;display:grid;place-items:center;border:1px solid #b7cdaa;border-radius:15px;background:#e4f1da;color:#719a5c;box-shadow:0 5px 18px #35473530;pointer-events:auto;touch-action:none;cursor:grab}
      .launcher.locked{background:#ebebeb;color:#929292;border-color:#d1d1d1}
      .panel{position:fixed;display:none;width:320px;height:410px;min-width:260px;min-height:230px;max-width:95vw;max-height:85vh;background:white;border:1px solid #dce8d5;border-radius:18px;box-shadow:0 14px 44px #273c2933;pointer-events:auto;overflow:hidden}
      .panel.open{display:flex;flex-direction:column}
      .head{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;background:#f5f9f2;border-bottom:1px solid #e4ecdf}
      .brand{font-size:17px;font-weight:750;letter-spacing:-.3px}.status{font-size:11px;color:#71876c}
      .close,.remove{border:0;background:transparent;color:#7c9077;cursor:pointer;font-size:20px}
      .tools{flex:1;overflow:auto;padding:10px}
      .item{display:flex;gap:8px;align-items:center;padding:5px 2px;border-bottom:1px solid #f0f3ed}
      .run{flex:1;text-align:left;border:0;background:transparent;padding:9px 7px;color:#334b35;cursor:pointer;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tag{font-size:10px;color:#74926b;background:#edf5e8;border-radius:8px;padding:4px 6px}
      .candidate{background:#f8fbf5}.empty{text-align:center;color:#8b9a86;padding:25px 0;font-size:13px}
      .bottom{padding:10px 14px;border-top:1px solid #edf1ea;display:flex;gap:8px}
      .bottom button{border:1px solid #d8e7d1;border-radius:9px;background:#f4f9ef;color:#5b7d4d;padding:8px;cursor:pointer;font-size:12px}
      .manager{position:absolute;inset:0;background:#172d1a55;display:flex;align-items:center;justify-content:center;padding:12px;z-index:3}.manager-card{background:white;border-radius:14px;width:100%;max-height:100%;overflow:auto;padding:15px;box-shadow:0 8px 30px #182e1b30}.manager-title{font-weight:750;font-size:15px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.manager-close{border:0;background:transparent;font-size:21px;color:#82947a}.manager-card label{display:block;font-size:12px;color:#587052;margin:10px 0}.manager-card input,.manager-card select,.manager-card textarea{display:block;width:100%;border:1px solid #d5e5ce;border-radius:8px;padding:9px;margin-top:5px;background:#fff;color:#334b35;font-size:12px}.manager-card textarea{resize:vertical;min-height:75px}.manager-help{font-size:11px;line-height:1.5;color:#778a70}.manager-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.manager-actions button{border:1px solid #d5e5ce;background:#eaf4e5;border-radius:8px;padding:8px 12px;color:#527b43}.grip{position:absolute;right:5px;bottom:5px;width:22px;height:22px;cursor:nwse-resize;touch-action:none;opacity:.55;background:repeating-linear-gradient(135deg,transparent 0 5px,#94ad89 5px 6px,transparent 6px 9px);clip-path:polygon(100% 0,100% 100%,0 100%)}
    </style><button class="launcher" aria-label="Toolbox 열기">${icon}</button><section class="panel"><div class="head"><div><div class="brand">Toolbox</div><div class="status"></div></div><button class="close" aria-label="닫기">×</button></div><div class="tools"></div><div class="bottom"><button class="addscript">+ 유저스크립트</button><button class="addbm">+ 북마클릿</button><button class="toggle">수납 모드 전환</button></div><div class="grip" aria-label="크기 조절"></div></section>`;
    button=shadow.querySelector('.launcher');panel=shadow.querySelector('.panel');list=shadow.querySelector('.tools');status=shadow.querySelector('.status');grip=shadow.querySelector('.grip');
    if(state.position){button.style.left=state.position.x+'px';button.style.top=state.position.y+'px'}
    panel.style.width=state.size.w+'px';panel.style.height=state.size.h+'px';
    const open=()=>{const r=button.getBoundingClientRect();panel.style.left=clamp(r.left-320,8,innerWidth-state.size.w-8)+'px';panel.style.top=clamp(r.top,8,innerHeight-state.size.h-8)+'px';panel.classList.add('open');render()};
    shadow.querySelector('.close').onclick=()=>panel.classList.remove('open');
    const toggle=()=>{state.locked=!state.locked;save();render()};
    shadow.querySelector('.toggle').onclick=toggle;
    shadow.querySelector('.addscript').onclick=openManager;
    shadow.querySelector('.addbm').onclick=()=>{
      const name=prompt('북마클릿 이름');if(!name)return;
      const code=prompt('javascript: 코드');if(!code)return;
      state.items.push({id:'bm-'+Date.now(),type:'bookmarklet',name,code});save();render();
    };
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
    applyPinned();render();
  }
  window[INSTANCE]={destroy(){observer?.disconnect();host?.remove();delete window[INSTANCE]},rescan(){applyPinned();render()}};
  if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();