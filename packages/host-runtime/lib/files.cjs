'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

/** 构造可供宿主翻译的失败原因。 */
function failure(code, message) { return Object.assign(new Error(message), { code }); }

/** 读取清单，损坏时保留原件并明确失败。 */
function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw failure('DOCUMENT_UNREADABLE', `${file}: ${error.message}`); }
}

/** 同目录写入并刷新，成功后原子替换；失败不删除原文件。 */
function writeContents(file,contents,fileSystem=fs) {
    fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor;
    try {
        descriptor = fileSystem.openSync(temporary, 'wx', 0o600);
        fileSystem.writeFileSync(descriptor, contents);
        fileSystem.fsyncSync(descriptor); fileSystem.closeSync(descriptor); descriptor = undefined;
        fileSystem.renameSync(temporary, file);
    } finally {
        if (descriptor !== undefined) fileSystem.closeSync(descriptor);
        if (fileSystem.existsSync(temporary)) fileSystem.unlinkSync(temporary);
    }
}

/** JSON 与字节内容复用同一套原子替换和刷盘能力。 */
function writeJson(file,value) {writeContents(file,JSON.stringify(value,null,2)+'\n');}

/** 首次登记采用原子排他发布；并发启动只会读取同一份完整记录。 */
function initializeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = path.join(path.dirname(file), `.cxx-bootstrap-${randomUUID()}.tmp`);
    try {
        writeJson(temporary, value);
        try { fs.linkSync(temporary, file); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        return readJson(file, null);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

/** 目录不存在时解析最近的已有祖先，防止符号链接绕过包含关系。 */
function canonical(directory) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.includes('\0')) throw failure('PATH_INVALID', '目录必须是绝对路径');
    const absolute = path.resolve(directory);
    let ancestor = absolute;
    const suffix = [];
    while (!fs.existsSync(ancestor)) {
        const parent = path.dirname(ancestor);
        if (ancestor === parent) throw failure('PATH_UNAVAILABLE', '无法访问目录');
        suffix.unshift(path.basename(ancestor)); ancestor = parent;
    }
    return path.join(fs.realpathSync.native(ancestor), ...suffix);
}

/** 校验子路径，拒绝根目录本身及越界访问。 */
function inside(root, candidate) {
    const base = canonical(root), absolute = path.resolve(candidate);
    const relative = path.relative(base, absolute);
    if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw failure('PATH_OUTSIDE_ROOT', '路径必须位于归属目录内');
    let current=base;
    for(const segment of relative.split(path.sep)) {
        current=path.join(current,segment);
        try {if(fs.lstatSync(current).isSymbolicLink()) throw failure('PATH_LINK_UNSUPPORTED','归属目录内包含链接，请使用实际文件目录');}
        catch(error) {if(error.code==='ENOENT') break;throw error;}
    }
    const target=canonical(absolute);
    const resolved=path.relative(base,target);
    if(!resolved||resolved.startsWith('..'+path.sep)||resolved==='..'||path.isAbsolute(resolved)) throw failure('PATH_OUTSIDE_ROOT','路径必须位于归属目录内');
    return target;
}

/** 校验相互独立的迁移位置。 */
function distinct(left, right) {
    const a = canonical(left), b = canonical(right);
    const related = (base, child) => { const rel = path.relative(base, child); return !rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
    if (related(a, b) || related(b, a)) throw failure('PATHS_OVERLAP', '源目录和目标目录不能相同或相互包含');
}

/** 计算文件摘要，核验复制内容。 */
async function digest(file,fileSystem=fs) {
    const hash = createHash('sha256');
    for await (const chunk of fileSystem.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

/** 仅检测可证明不存在的目录；拒绝把权限或离线问题当成删除成功。 */
function presence(directory) {
    try { fs.statSync(directory); return 'present'; }
    catch (error) { return error.code === 'ENOENT' ? 'missing' : 'unavailable'; }
}
module.exports = { failure, readJson, writeJson,writeContents, initializeJson, canonical, inside, distinct, digest, presence };
