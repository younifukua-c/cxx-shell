'use strict';
const {randomUUID}=require('node:crypto');
const {failure}=require('./files.cjs');

/** 会话持有应用状态，窗口只承载它；移动成功确认前不关闭原窗口。 */
function createApplicationSessions({viewHost,canCombine=()=>true,schedule=fn=>setImmediate(fn),persist=()=>{}}) {
    const sessions=new Map(),transferring=new Set();
    let requestedEligibility=null,eligibilityScheduled=false;
    const snapshot=()=>[...sessions.values()].map(({id,applicationId,windowId})=>({id,applicationId,windowId}));
    const reconcileEligibility=()=>{
        if(!requestedEligibility||eligibilityScheduled||transferring.size)return;
        eligibilityScheduled=true;
        schedule(async()=>{
            eligibilityScheduled=false;
            if(transferring.size)return;
            const allowed=requestedEligibility;requestedEligibility=null;
            const byWindow=new Map();
            for(const session of sessions.values()) {const group=byWindow.get(session.windowId)||[];group.push(session);byWindow.set(session.windowId,group);}
            for(const group of byWindow.values())for(const session of group.slice(1))if(!allowed(session.applicationId)) {
                try{await api.split(session.id);}catch(error){viewHost.report?.(error,session);}
            }
            reconcileEligibility();
        });
    };
    const api={
        register({applicationId,windowId,view,state}) {
            if(typeof applicationId!=='string'||!applicationId||windowId===undefined||windowId===null) throw failure('SESSION_INVALID','请提供应用与目标窗口');
            if(sessions.size>=128) throw failure('SESSION_LIMIT','打开的应用会话过多，请先关闭不需要的窗口');
            const session={id:randomUUID(),applicationId,windowId,view,state};sessions.set(session.id,session);
            try {persist(snapshot());return session.id;}
            catch(error) {sessions.delete(session.id);throw error;}
        },
        list:snapshot,
        async merge(sessionId,targetWindow) {
            return this.mergeMany([sessionId],targetWindow);
        },
        async mergeMany(ids,targetWindow) {
            if(!Array.isArray(ids)||!ids.length||ids.length>128)throw failure('SESSION_LIMIT','窗口组合数量无效');
            const selected=[...new Set(ids)].map(id=>{const session=sessions.get(id);if(!session)throw failure('SESSION_NOT_FOUND','应用会话不存在');return session;});
            const moving=selected.filter(session=>session.windowId!==targetWindow);
            if(!moving.length){await viewHost.focus(selected[0],targetWindow);return;}
            for(const session of moving) {
                if(transferring.has(session.id))throw failure('SESSION_TRANSFER_BUSY','此应用正在切换窗口');
                if(!canCombine(session.applicationId,targetWindow))throw failure('COMBINATION_UNAVAILABLE','当前应用不能合并到此窗口');
            }
            const previous=new Map(moving.map(session=>[session.id,session.windowId]));
            for(const session of moving)transferring.add(session.id);
            try {
                for(const session of moving){await viewHost.attach(session,targetWindow);await viewHost.confirm(session,targetWindow);}
                for(const session of moving)session.windowId=targetWindow;
                persist(snapshot());await viewHost.focus(moving[0],targetWindow);
            } catch(error) {
                for(const session of moving){session.windowId=previous.get(session.id);await viewHost.attach(session,session.windowId);}
                persist(snapshot());throw error;
            } finally {for(const session of moving)transferring.delete(session.id);reconcileEligibility();}
            const occupied=new Set([...sessions.values()].map(session=>session.windowId));
            for(const windowId of new Set(previous.values()))if(!occupied.has(windowId)) {
                try{await viewHost.closeEmpty(windowId);}catch(error){viewHost.report?.(error);}
            }
        },
        async split(sessionId) {
            const session=sessions.get(sessionId);if(!session) throw failure('SESSION_NOT_FOUND','应用会话不存在');
            if(transferring.has(sessionId)) throw failure('SESSION_TRANSFER_BUSY','此应用正在切换窗口');
            transferring.add(sessionId);
            const previous=session.windowId;
            let windowId;
            try {
                windowId=await viewHost.createWindow(session.applicationId);
                await viewHost.attach(session,windowId);await viewHost.confirm(session,windowId);
                session.windowId=windowId;persist(snapshot());await viewHost.focus(session,windowId);
            } catch(error) {
                session.windowId=previous;await viewHost.attach(session,previous);persist(snapshot());
                if(windowId!==undefined) await viewHost.closeEmpty(windowId);throw error;
            } finally {transferring.delete(sessionId);reconcileEligibility();}
        },
        eligibilityChanged(allowed) {
            requestedEligibility=allowed;reconcileEligibility();
        },
        unregister(id) {if(transferring.has(id)) throw failure('SESSION_TRANSFER_BUSY','请等待窗口切换完成');sessions.delete(id);persist(snapshot());},
    };
    return api;
}
module.exports={createApplicationSessions};
