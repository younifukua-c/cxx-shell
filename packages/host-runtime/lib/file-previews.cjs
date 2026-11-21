'use strict';
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');

/** 有界资源令牌归发起窗口所有；每次请求重新授权路径，流关闭时释放句柄。 */
function createFilePreviewResources({ maxResources = 128 } = {}) {
    if (!Number.isInteger(maxResources) || maxResources < 1 || maxResources > 1024) throw Error('预览资源上限必须是有效的有界整数');
    const resources = new Map();
    let disposed = false;
    function release(owner, token) {
        const resource = resources.get(token);
        if (!resource || resource.owner !== owner) return false;
        resources.delete(token);
        for (const stream of resource.streams) stream.destroy();
        return true;
    }
    function releaseOwner(owner) {
        for (const [token, resource] of resources) if (resource.owner === owner) release(owner, token);
    }
    return {
        register(owner, resolve) {
            if (disposed || resources.size >= maxResources) throw Error('预览资源已达上限，请先关闭其他文件预览');
            if ((!Number.isInteger(owner) && typeof owner !== 'string') || typeof resolve !== 'function') throw Error('预览必须归属一个窗口');
            const token = randomUUID(); resources.set(token, { owner, resolve, streams: new Set() });
            return { token, url: `cxx-file-preview://${token}/file` };
        },
        release, releaseOwner,
        async respond(request) {
            try {
                const url = new URL(request.url);
                const resource = resources.get(url.hostname);
                if (url.protocol !== 'cxx-file-preview:' || url.pathname !== '/file' || !resource) return new Response(null, { status: 404 });
                if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
                const file = await resource.resolve();
                if (resources.get(url.hostname) !== resource || request.signal.aborted) return new Response(null, { status: 410 });
                const stat = await fs.promises.stat(file.path);
                if (!stat.isFile()) return new Response(null, { status: 404 });
                if (resources.get(url.hostname) !== resource || request.signal.aborted) return new Response(null, { status: 410 });
                let start = 0, end = stat.size - 1, partial = false;
                const range = request.headers.get('range');
                if (range) {
                    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
                    if (!match || !match[1] && !match[2]) return invalidRange(stat.size);
                    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
                    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
                    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) return invalidRange(stat.size);
                    partial = true;
                }
                const headers = new Headers({ 'Content-Type': file.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
                    'Content-Length': String(stat.size ? end - start + 1 : 0), 'X-Content-Type-Options': 'nosniff' });
                if (partial) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
                if (request.method === 'HEAD' || !stat.size) return new Response(null, { status: partial ? 206 : 200, headers });
                const stream = fs.createReadStream(file.path, { start, end }); resource.streams.add(stream);
                const abort = () => stream.destroy(); request.signal.addEventListener('abort', abort, { once: true });
                stream.once('close', () => { resource.streams.delete(stream); request.signal.removeEventListener('abort', abort); });
                return new Response(Readable.toWeb(stream), { status: partial ? 206 : 200, headers });
            } catch { return new Response(null, { status: 404 }); }
        },
        dispose() { if (disposed) return; disposed = true; for (const resource of [...resources.values()]) releaseOwner(resource.owner); },
    };
}
function invalidRange(size) { return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } }); }
module.exports = { createFilePreviewResources };
