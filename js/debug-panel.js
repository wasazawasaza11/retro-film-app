// Opt-in on-device diagnostics: memory/DOM only, never storage or network.
(function(){
  const panel=document.getElementById('debug-panel'),log=document.getElementById('debug-log'),state=document.getElementById('debug-state');
  const enabled=new URLSearchParams(location.search).get('debug')==='1';
  panel.hidden=!enabled;
  if(!enabled)return;
  let lines=[];
  function write(message){lines.push(String(message));if(lines.length>160)lines=lines.slice(-160);log.textContent=lines.join('\n');log.scrollTop=log.scrollHeight;}
  window.retroDebug={
    reset(){lines=[];log.textContent='';panel.open=true;},
    step(name){state.textContent=name;write(name);},
    info(message){write(message);},
    error(operation,error){state.textContent=`ERROR: ${operation}`;write(`ERROR: ${operation}\n${error?.name?error.name+': ':''}${error?.message||String(error)}`);panel.open=true;},
    styles(element,label){if(!element){write(`${label}: null`);return;}const s=getComputedStyle(element);write(`${label}: hidden=${element.hidden}; display=${s.display}; visibility=${s.visibility}; opacity=${s.opacity}; z-index=${s.zIndex}; pointer-events=${s.pointerEvents}`);},
    file(file){write(`name: ${file.name}\ntype: ${file.type||'(empty)'}\nsize: ${file.size}`);},
    canvas(image,canvas){write(`img.naturalWidth: ${image.naturalWidth}\nimg.naturalHeight: ${image.naturalHeight}\ncanvas.width: ${canvas.width}\ncanvas.height: ${canvas.height}\ncanvas.clientWidth: ${canvas.clientWidth}\ncanvas.clientHeight: ${canvas.clientHeight}\ndevicePixelRatio: ${window.devicePixelRatio}`);}
  };
  window.addEventListener('error',event=>{
    if(event.target!==window){const target=event.target;window.retroDebug.error('script/resource load',new Error(target.src||target.href||target.tagName));return;}
    window.retroDebug.error('JS initialization / runtime',event.error||new Error(`${event.message} (${event.filename}:${event.lineno})`));
  },true);
  window.addEventListener('unhandledrejection',event=>window.retroDebug.error('unhandled promise',event.reason));
  window.retroDebug.step('idle');
})();




