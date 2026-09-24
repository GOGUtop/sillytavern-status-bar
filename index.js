(function () {
  'use strict';
  const MODULE = 'status_bar_manager';
  const defaults = {
    apiUrl: '', apiKey: '', model: '', timeout: 30000, githubUrl: '', githubInterval: 30,
    bluetoothName: 'SillyTavern 状态栏', bluetoothService: '', bluetoothCharacteristic: '',
    bars: [{ id: 'default', name: '基础状态栏', enabled: true, prompt: '根据提取内容生成简洁的 JSON 状态栏。字段使用 hp、mp、mood、location、summary。只输出 JSON。', rule: {type:'all', pattern:''} }]
  };
  let settings;
  const clone = x => JSON.parse(JSON.stringify(x));
  function getSettings() { settings = extension_settings[MODULE] || clone(defaults); extension_settings[MODULE] = settings; persist(); }
  const hostSave = window.saveSettingsDebounced;
  function persist() { if (hostSave) hostSave(); }
  function uid() { return 'bar_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function ensurePanel() {
    if ($('#status_bar_manager_panel').length) return;
    const html = `<div id="status_bar_manager_panel" class="statusbar-panel">
      <div class="statusbar-head"><b>状态栏管理器</b><button id="sbm_close">×</button></div>
      <div class="statusbar-tabs"><button data-tab="bars" class="active">状态栏</button><button data-tab="api">模型 API</button><button data-tab="rules">获取规则</button><button data-tab="bt">蓝牙</button></div>
      <div class="sbm-tab" data-pane="bars"><div id="sbm_bars"></div><button id="sbm_add" class="menu_button">＋新增状态栏</button><p class="hint">勾选的状态栏会在角色消息生成完成后自动更新。</p></div>
      <div class="sbm-tab" data-pane="api" style="display:none"><label>API 地址<input id="sbm_apiUrl" placeholder="https://api.openai.com/v1/chat/completions"></label><label>API Key<input id="sbm_apiKey" type="password"></label><label>模型<input id="sbm_model" placeholder="gpt-4o-mini"></label><button id="sbm_test" class="menu_button">测试连接</button><span id="sbm_result"></span></div>
      <div class="sbm-tab" data-pane="rules" style="display:none"><label>GitHub Raw 规则地址<input id="sbm_githubUrl"></label><button id="sbm_githubSync" class="menu_button">立即同步规则</button><span id="sbm_githubResult"></span></div><div class="sbm-tab" data-pane="bt" style="display:none"><p class="hint">浏览器 Web Bluetooth 仅在 HTTPS 或 localhost 可用。</p><label>设备名称<input id="sbm_btName"></label><label>服务 UUID<input id="sbm_btService" placeholder="可选"></label><label>特征 UUID<input id="sbm_btChar" placeholder="可选"></label><button id="sbm_btConnect" class="menu_button">连接蓝牙</button><span id="sbm_btResult"></span></div>
    </div>`;
    $('body').append(html); bindPanel(); render();
  }
  function bindPanel() {
    $('#sbm_githubSync').on('click', syncGithub); $('#sbm_close').on('click', () => $('#status_bar_manager_panel').hide());
    $('.statusbar-tabs button').on('click', function () { const tab=$(this).data('tab'); $('.statusbar-tabs button').removeClass('active'); $(this).addClass('active'); $('.sbm-tab').hide(); $(`[data-pane="${tab}"]`).show(); });
    $('#sbm_add').on('click', () => { settings.bars.push({id:uid(),name:'新状态栏',enabled:true,prompt:'生成此状态栏需要展示的状态。只输出 JSON。'}); persist(); render(); });
    $('#sbm_test').on('click', testApi); $('#sbm_btConnect').on('click', connectBluetooth);
    $('#sbm_apiUrl,#sbm_apiKey,#sbm_model,#sbm_btName,#sbm_btService,#sbm_btChar').on('change', function(){ const map={sbm_apiUrl:'apiUrl',sbm_apiKey:'apiKey',sbm_model:'model',sbm_btName:'bluetoothName',sbm_btService:'bluetoothService',sbm_btChar:'bluetoothCharacteristic'}; settings[map[this.id]]=this.value; persist(); });
  }
  function render() {
    if (!settings) getSettings();
    $('#sbm_apiUrl').val(settings.apiUrl); $('#sbm_apiKey').val(settings.apiKey); $('#sbm_model').val(settings.model); $('#sbm_btName').val(settings.bluetoothName); $('#sbm_btService').val(settings.bluetoothService); $('#sbm_btChar').val(settings.bluetoothCharacteristic);
    $('#sbm_bars').html(settings.bars.map((b,i)=>`<div class="sbm-bar"><input type="checkbox" data-enable="${i}" ${b.enabled?'checked':''}><input class="sbm-name" data-name="${i}" value="${esc(b.name)}"><button data-del="${i}">删除</button><textarea data-prompt="${i}">${esc(b.prompt)}</textarea></div>`).join(''));
    $('#sbm_bars input[data-enable]').on('change', function(){settings.bars[$(this).data('enable')].enabled=this.checked;persist();});
    $('#sbm_bars .sbm-name').on('change', function(){settings.bars[$(this).data('name')].name=this.value;persist();}); $('#sbm_bars textarea').on('change', function(){settings.bars[$(this).data('prompt')].prompt=this.value;persist();});
    $('#sbm_bars button[data-del]').on('click', function(){settings.bars.splice($(this).data('del'),1);persist();render();});
  }
  async function testApi() { const out=$('#sbm_result').text('测试中…'); try { const r=await callModel('只回复 OK。'); out.text(r.toUpperCase().includes('OK')?'连接成功':'已返回：'+r.slice(0,80)); } catch(e){out.text('失败：'+e.message);} }
  async function callModel(prompt) { if (!settings.apiUrl) throw Error('请先填写 API 地址'); const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),settings.timeout||30000); try { const r=await fetch(settings.apiUrl,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json',...(settings.apiKey?{'Authorization':'Bearer '+settings.apiKey}:{})},body:JSON.stringify({model:settings.model||'gpt-4o-mini',messages:[{role:'user',content:prompt}],temperature:0.2})}); if(!r.ok) throw Error('HTTP '+r.status+' '+await r.text()); const j=await r.json(); return j.choices?.[0]?.message?.content||''; } finally { clearTimeout(t); } }
  async function connectBluetooth() { const out=$('#sbm_btResult'); try { if(!navigator.bluetooth) throw Error('当前浏览器不支持 Web Bluetooth'); const opts=settings.bluetoothService?{filters:[{services:[settings.bluetoothService]}]}:{acceptAllDevices:true}; const d=await navigator.bluetooth.requestDevice(opts); out.text('已选择：'+d.name); if(settings.bluetoothService&&settings.bluetoothCharacteristic){const s=await d.gatt.connect(); const svc=await s.getPrimaryService(settings.bluetoothService); window.sbmBluetoothCharacteristic=await svc.getCharacteristic(settings.bluetoothCharacteristic); out.text('已连接：'+d.name);} } catch(e){out.text('失败：'+e.message);} }
  function extractText(text,r){if(!r||r.type==='all'||!r.pattern)return text;if(r.type==='regex'){try{const m=text.match(new RegExp(r.pattern,r.flags||'i'));return m?(m[1]||m[0]):'';}catch(e){return '';}}const p=r.pattern.split('|');const a=text.indexOf(p[0]);const z=p[1]?text.indexOf(p[1],a+p[0].length):-1;return a>=0?text.slice(a+p[0].length,z>=0?z:text.length):'';}
  async function syncGithub(){try{const r=await fetch(settings.githubUrl);if(!r.ok)throw Error('HTTP '+r.status);const x=await r.json();(Array.isArray(x)?x:x.bars||[]).forEach(v=>{const b=settings.bars.find(b=>b.id===v.id||b.name===v.name);if(b&&v.rule)b.rule=v.rule;});persist();render();$('#sbm_githubResult').text('同步成功');}catch(e){$('#sbm_githubResult').text('失败：'+e.message);}}
  async function generateBars() { const active=settings.bars.filter(b=>b.enabled); if(!active.length||!settings.apiUrl)return; const latest=window.chat?.[window.chat.length-1]?.mes||''; for(const b of active){ try { const raw=await callModel(b.prompt+'\n从正文提取到的内容：'+extractText(latest,b.rule)); let data; try{data=JSON.parse(raw.replace(/^```json|```$/g,'').trim());}catch{data={summary:raw};} renderGenerated(b,data); } catch(e){ console.warn('[状态栏]',e); } } }
  function renderGenerated(bar,data){ const id='sbm_output_'+bar.id; $('#'+id).remove(); const el=$(`<div id="${id}" class="sbm-output"><b>${esc(bar.name)}</b><div class="sbm-grid"></div></div>`); Object.entries(data||{}).forEach(([k,v])=>el.find('.sbm-grid').append(`<span><small>${esc(k)}</small>${esc(typeof v==='object'?JSON.stringify(v):v)}</span>`)); $('#send_form').before(el); if(window.sbmBluetoothCharacteristic){ try{window.sbmBluetoothCharacteristic.writeValue(new TextEncoder().encode(JSON.stringify(data)));}catch(e){} } }
  function init(){ try { getSettings(); ensurePanel(); if(!$('#sbm_open').length){ const button=$('<button id="sbm_open" class="menu_button" title="状态栏管理器">状态栏</button>'); const host=$('#extensions_settings2').length?$('#extensions_settings2'):$('#extensions_settings'); if(host.length) host.append(button); else $('body').append(button); button.on('click',()=>{ensurePanel();$('#status_bar_manager_panel').toggle();}); } if(window.eventSource&&window.event_types&&event_types.MESSAGE_RECEIVED){eventSource.on(event_types.MESSAGE_RECEIVED,generateBars);} } catch(e){ console.error('[状态栏管理器] 加载失败',e); $('body').append('<div id="sbm_error" style="position:fixed;bottom:10px;right:10px;z-index:10000;background:#822;color:#fff;padding:8px">状态栏插件加载失败：'+esc(e.message)+'</div>'); } }
  if (window.jQuery) $(init); else document.addEventListener('DOMContentLoaded',init);
})();


