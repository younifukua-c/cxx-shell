'use strict';
const fs = require('node:fs'), path = require('node:path');
const { inside, readJson, failure } = require('./files.cjs');
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_ICON_BYTES = 512 * 1024;

/** 产品编码只读安装清单的包名，不采用内部应用 ID 或外部传入的编码覆盖。 */
function applicationBranding(root, id) {
    const file = inside(root, path.join(root, 'package.json'));
    let pkg;
    try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_METADATA_BYTES)
            throw failure('APPLICATION_MANIFEST_INVALID', '应用声明不可读取，请检查安装是否完整');
        pkg = readJson(file, {});
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const productCode = pkg?.name || id;
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]{0,99}$/.test(productCode))
        throw failure('MODULE_DEFINITION_INVALID', '应用包名不能作为产品编码，请核对软件声明');
    // 旧产品已使用此构建资源约定；显式声明优先，不要求拷贝品牌文件。
    const declared = pkg?.cxxApplication?.icon;
    const iconPath = declared === undefined ? 'build/' + productCode.replace(/^@/, '').replace('/', '-') + '-icon.png' : declared;
    if (typeof iconPath !== 'string') throw failure('MODULE_ICON_INVALID', '应用图标路径无效');
    const icon = inside(root, path.resolve(root, iconPath));
    return { productCode, ...(fs.existsSync(icon) && path.extname(icon).toLowerCase() === '.png'
        ? { iconPath: path.relative(root, icon) } : {}) };
}

/** 有界本地图标用于菜单和原生窗口，缺失或不可读资源回退到宿主图标。 */
function presentApplication(record) {
    if (!record.iconPath) return record;
    const file = inside(record.root, path.resolve(record.root, record.iconPath));
    try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_ICON_BYTES) return record;
        const bytes = fs.readFileSync(file);
        if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return record;
        return { ...record, icon: 'data:image/png;base64,' + bytes.toString('base64'), windowIcon: file };
    } catch (error) { if (error.code === 'ENOENT' || error.code === 'EACCES') return record; throw error; }
}
module.exports = { applicationBranding, presentApplication };
