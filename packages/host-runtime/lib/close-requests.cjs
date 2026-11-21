'use strict';
const {randomUUID}=require('node:crypto');

/** 关闭采用有界确认协议；任一应用拒绝或失联时保留整组页面。 */
function createCloseRequests({send,timeoutMs=120000,limit=128}) {
    const pending=new Map();
    return {
        request(contents) {
            if(pending.size>=limit||contents.isDestroyed())return Promise.resolve(false);
            return new Promise(resolve=>{
                const id=randomUUID();
                const finish=allow=>{const record=pending.get(id);if(!record)return;clearTimeout(record.timer);pending.delete(id);resolve(allow===true);};
                const timer=setTimeout(()=>finish(false),timeoutMs);
                pending.set(id,{contents,finish,timer});
                try{send(contents,{id});}catch{finish(false);}
            });
        },
        answer(contents,id,allow) {const record=pending.get(id);if(!record||record.contents!==contents)return false;record.finish(allow);return true;},
        destroy() {for(const record of [...pending.values()])record.finish(false);},
    };
}
module.exports={createCloseRequests};
