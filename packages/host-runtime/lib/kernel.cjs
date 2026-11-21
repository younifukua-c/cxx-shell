'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes, createHash } = require('node:crypto');
const { kernelAddress } = require('./environment.cjs');
const { failure, initializeJson } = require('./files.cjs');
const MESSAGE_LIMIT = 16384;

/** 使用有界本地消息唤起既有内核，拒绝连接错误环境或来源。 */
function connect(address, request, timeout = 2000) {
    return new Promise((resolve,reject) => {
        const socket = net.createConnection(address); let text='';
        const finish = (error,value) => { socket.destroy(); error ? reject(error) : resolve(value); };
        socket.setTimeout(timeout,()=>finish(failure('KERNEL_TIMEOUT','内核未响应，请稍后重试')));
        socket.on('error',reject);
        socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));
        socket.on('data',chunk=>{
            text+=chunk;
            if (text.length>MESSAGE_LIMIT) return finish(failure('KERNEL_MESSAGE_INVALID','内核响应超过限制'));
            if(text.includes('\n')) { try { finish(null,JSON.parse(text.split('\n')[0])); } catch(error) { finish(error); } }
        });
        socket.on('end',()=>{if(!text.includes('\n')) finish(failure('KERNEL_DISCONNECTED','内核连接中断'));});
    });
}

/** 以环境为范围建立唯一内核；关闭一个测试内核不会影响其他地址。 */
async function acquireKernel(environment, { sourceId, applicationId,open, platform = process.platform }) {
    const directory=path.join(environment.root,'runtime'); fs.mkdirSync(directory,{recursive:true});
    const credentials=path.join(directory,'kernel-auth.json');
    const record=initializeJson(credentials,{token:randomBytes(32).toString('hex')});
    const address=kernelAddress(environment,platform);
    const request={ version:1, environmentId:environment.id, token:record.token, sourceId, applicationId,action:'activate' };
    const forward=async()=>{
        const response=await connect(address,request);
        if(!response.success) throw failure(response.code,response.error);
        return { primary:false, close:async()=>{} };
    };
    const server=net.createServer(socket=>{
        let input='';socket.setTimeout(2000,()=>socket.destroy());
        socket.on('error',()=>socket.destroy());
        socket.on('data',chunk=>{
            input+=chunk;
            if(input.length>MESSAGE_LIMIT) return socket.destroy();
            if(!input.includes('\n')) return;
            socket.pause();
            const reply=value=>socket.end(JSON.stringify(value)+'\n');
            try {
                const message=JSON.parse(input.split('\n')[0]);
                const token=Buffer.from(String(message.token||'')), expected=Buffer.from(record.token);
                if(token.length!==expected.length || !require('node:crypto').timingSafeEqual(token,expected) || message.environmentId!==environment.id || message.version!==1) return reply({success:false,code:'KERNEL_IDENTITY_INVALID',error:'环境身份不匹配'});
                if(message.sourceId!==sourceId) return reply({success:false,code:'KERNEL_SOURCE_MISMATCH',error:'该环境已运行另一份程序，请关闭该环境后切换，或使用另一测试目录'});
                socket.setTimeout(0);
                Promise.resolve().then(()=>open(message.applicationId)).then(()=>reply({success:true}),error=>reply({success:false,code:error.code||'KERNEL_ACTIVATION_FAILED',error:error.message}));
            } catch(error) { reply({success:false,code:'KERNEL_MESSAGE_INVALID',error:error.message}); }
        });
    });
    try {
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(address,()=>{server.removeListener('error',reject);resolve();});});
    } catch(error) {
        if(error.code==='EADDRINUSE') return forward();
        throw error;
    }
    return { primary:true, address, close:()=>new Promise(resolve=>server.close(resolve)),
        fingerprint:createHash('sha256').update(environment.id).digest('hex').slice(0,12) };
}
module.exports = { acquireKernel, connect };
