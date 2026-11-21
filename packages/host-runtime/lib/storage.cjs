'use strict';
const path = require('node:path');
const { failure, inside } = require('./files.cjs');
const CATEGORIES = Object.freeze(['logs','data','settings','plus']);

/** 创建目录能力；所属模块只获得自己的路径，不允许跨应用拼接。 */
function createStorage(environment) {
    const segment = value => {
        if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) throw failure('MODULE_KEY_INVALID', '应用和模块名称无效');
        return value;
    };
    return Object.freeze({
        environment,
        directory(category, app, module) {
            if (!CATEGORIES.includes(category)) throw failure('CATEGORY_INVALID', '存储类目无效');
            return inside(environment.root, path.join(environment.root, category, segment(app), segment(module)));
        },
        file(category, app, module, file) {
            const directory = this.directory(category, app, module);
            if (typeof file !== 'string' || file.includes('\0')) throw failure('FILE_NAME_INVALID', '文件名称无效');
            return inside(directory, path.resolve(directory, file));
        },
    });
}
module.exports = { CATEGORIES, createStorage };
