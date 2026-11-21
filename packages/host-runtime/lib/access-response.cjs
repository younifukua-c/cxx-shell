'use strict';
const { failure } = require('./files.cjs');

const MAX_APPLICATIONS = 200;
const MAX_REFRESH_MS = 60_000;

/** 一次完整核对中央响应；失败不返回部分许可，不保留协议以外的附加数据。 */
function readAccessDecisions(response, requested, started) {
    if (!Array.isArray(response) || response.length !== requested.size) throw failure('ACCESS_RESPONSE_INVALID', '软件资格响应不完整');
    const accepted = new Map();
    for (const item of response) {
        if (!item || !requested.has(item.applicationId) || accepted.has(item.applicationId) || typeof item.allowed !== 'boolean'
            || typeof item.reason !== 'string' || !item.reason || typeof item.evaluatedAt !== 'string') {
            throw failure('ACCESS_RESPONSE_INVALID', '软件资格响应无法核对');
        }
        const evaluated = Date.parse(item.evaluatedAt), until = item.validUntil === null ? null : Date.parse(item.validUntil);
        if (!Number.isFinite(evaluated) || (until !== null && (!Number.isFinite(until) || until <= evaluated))) {
            throw failure('ACCESS_RESPONSE_INVALID', '软件资格期限无法核对');
        }
        const duration = until === null ? MAX_REFRESH_MS : Math.min(MAX_REFRESH_MS, until - evaluated);
        accepted.set(item.applicationId, { allowed: item.allowed, reason: item.reason, validUntil: item.validUntil, deadline: started + duration });
    }
    return accepted;
}

module.exports = { MAX_APPLICATIONS, readAccessDecisions };
