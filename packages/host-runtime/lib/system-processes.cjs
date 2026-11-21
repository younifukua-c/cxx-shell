'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {failure}=require('./files.cjs');
const execute=promisify(execFile);
const SCRIPT="Get-CimInstance Win32_Process -Filter \"Name = 'electron.exe' OR Name LIKE 'cxx-%'\" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress";
const OPTIONS={encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']};

/** 一次转换有界的进程快照，宿主不保存命令行内容。 */
function parse(output) {
    const value=output.trim()?JSON.parse(output):[];
    const items=Array.isArray(value)?value:[value];
    if(items.length>1000) throw failure('PROCESS_INSPECTION_LIMIT','运行实例过多，暂未切换数据目录');
    return items.map(item=>({pid:item.ProcessId,executable:item.ExecutablePath,commandLine:item.CommandLine}));
}

/** 批量读取本机进程元数据，不能确认时保留原存储并允许重试。 */
async function listProcesses() {
    if(process.platform!=='win32') throw failure('PROCESS_INSPECTION_UNAVAILABLE','旧实例检查尚不支持此系统，未切换或删除原数据');
    const {stdout}=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',SCRIPT],OPTIONS);
    return parse(stdout);
}

/** Chromium 初始化之前检查旧实例，此时不能让出事件循环提前打开浏览器数据库。 */
function listProcessesSync() {
    if(process.platform!=='win32') throw failure('PROCESS_INSPECTION_UNAVAILABLE','无法核对旧浏览器资料的占用情况，原数据未打开');
    return parse(require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',SCRIPT],OPTIONS));
}
module.exports={listProcesses,listProcessesSync};
