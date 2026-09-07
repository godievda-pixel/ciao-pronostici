function sameContext(a,b){
  if(a===b)return true;
  if(!a||!b)return false;
  const aKeys=Object.keys(a).sort();
  const bKeys=Object.keys(b).sort();
  if(aKeys.length!==bKeys.length)return false;
  return aKeys.every((key,index)=>key===bKeys[index]&&a[key]===b[key]);
}

export function createLiveController({
  refresh,
  setTimer=globalThis.setTimeout,
  clearTimer=globalThis.clearTimeout,
  intervalMs=30000,
}={}){
  if(typeof refresh!=='function')throw new TypeError('live_refresh_required');
  if(typeof setTimer!=='function'||typeof clearTimer!=='function')throw new TypeError('live_timer_required');
  if(!Number.isFinite(intervalMs)||intervalMs<=0)throw new TypeError('live_interval_invalid');

  let timerId=null;
  let generation=0;
  let current={
    running:false,
    context:null,
    data:null,
    error:null,
    updatedAt:null,
  };

  const clearScheduled=()=>{
    if(timerId===null)return;
    clearTimer(timerId);
    timerId=null;
  };

  const schedule=token=>{
    if(!current.running||token!==generation)return;
    clearScheduled();
    timerId=setTimer(async()=>{
      timerId=null;
      await execute(token);
    },intervalMs);
  };

  const execute=async token=>{
    const context=current.context;
    try{
      const data=await refresh(context);
      if(!current.running||token!==generation)return;
      current={...current,data,error:null,updatedAt:Date.now()};
    }catch(error){
      if(!current.running||token!==generation)return;
      current={...current,error:error instanceof Error?error:new Error(String(error??'live_refresh_failed'))};
    }
    schedule(token);
  };

  return Object.freeze({
    async start(context){
      const changed=!sameContext(current.context,context);
      generation+=1;
      const token=generation;
      clearScheduled();
      current={
        running:true,
        context:context?{...context}:null,
        data:changed?null:current.data,
        error:null,
        updatedAt:changed?null:current.updatedAt,
      };
      await execute(token);
      return this.state();
    },

    stop(){
      generation+=1;
      clearScheduled();
      current={...current,running:false};
    },

    state(){
      return {...current,context:current.context?{...current.context}:null};
    },
  });
}
