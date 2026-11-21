'use strict';
const { failure } = require('./files.cjs');

/** 切换期间暂存新请求，排空在途操作后执行短暂写入屏障。 */
function createRequestGate({ timeoutMs=10000 }={}) {
    let active=0, blocked=false, drain=null;
    const queue=[];
    const run=async(operation)=>{
        while(blocked) {
            if(queue.length>=256) throw failure('MIGRATION_QUEUE_FULL','切换期间等待的请求较多，原有任务继续执行，请稍后重试');
            await new Promise(resolve=>queue.push(resolve));
        }
        active++;
        try { return await operation(); }
        finally { active--; if(!active&&drain) drain(); }
    };
    const pause=async(operation)=>{
        if(blocked) throw failure('SWITCH_ALREADY_RUNNING','位置切换正在执行');
        blocked=true;
        try {
            if(active) await new Promise((resolve,reject)=>{
                const timer=setTimeout(()=>reject(failure('SWITCH_TASKS_BUSY','仍有操作执行，当前继续使用原目录，可稍后重试')),timeoutMs);
                drain=()=>{clearTimeout(timer);resolve();};
            });
            return await operation();
        } finally { blocked=false;drain=null;for(const resume of queue.splice(0)) resume(); }
    };
    return {run,pause};
}
module.exports={createRequestGate};
