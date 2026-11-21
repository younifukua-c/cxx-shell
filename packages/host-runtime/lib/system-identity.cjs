'use strict';
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {failure}=require('./files.cjs');

/** 使用稳定的系统账户身份，避免账户改名或同名账户混淆。 */
function systemIdentity() {
    if(process.platform!=='win32') return `uid:${os.userInfo().uid}`;
    const output=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',timeout:3000,windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:65536});
    const sid=output.match(/S-\d-(?:\d+-)+\d+/)?.[0];
    if(!sid) throw failure('ACCOUNT_ID_UNAVAILABLE','暂时无法确认系统账户身份，请重试，未连接任何正式数据');
    return sid;
}
module.exports={systemIdentity};
