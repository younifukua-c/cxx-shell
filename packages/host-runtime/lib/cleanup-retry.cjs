'use strict';
const {failure}=require('./files.cjs');

/** 仅重试短暂文件占用；内容变化、未知文件和运行租约交给正常保留流程。 */
function createCleanupRetry({attempt,delays=[250,1000,3000]}) {
    if(!Array.isArray(delays)||delays.length>5||delays.some(value=>!Number.isFinite(value)||value<0||value>10000))throw failure('CLEANUP_RETRY_INVALID','清理重试期限无效');
    let cancelled=false,pending=null,timer=null,release=null;
    const wait=delay=>new Promise(resolve=>{release=()=>{clearTimeout(timer);timer=null;release=null;resolve();};timer=setTimeout(release,delay);});
    const retryable=value=>value?.phase==='cleanup-pending'&&value.cleanupFailures?.length&&value.cleanupFailures.every(item=>['EBUSY','EPERM','EACCES','ENOTEMPTY'].includes(item.code));
    return {
        run() {
            if(cancelled)return Promise.resolve();
            if(pending)return pending;
            pending=(async()=>{
                let result=await attempt();
                for(const delay of delays) {
                    if(cancelled||!retryable(result))break;
                    await wait(delay);if(cancelled)break;
                    result=await attempt();
                }
                return result;
            })().finally(()=>{pending=null;});
            return pending;
        },
        cancel(){cancelled=true;release?.();},
    };
}
module.exports={createCleanupRetry};
