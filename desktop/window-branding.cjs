'use strict';
const path = require('node:path');
/** Shell 拥有公共窗口品牌；独立子应用窗口优先沿用其安装清单图标。 */
function windowBranding(applicationId, applications) {
  const application = applications.find(item => item.id === applicationId);
  return {
    title: application?.name || require('../package.json').productName,
    icon: application?.windowIcon || path.join(__dirname, 'dist/shell-icon.png'),
  };
}
module.exports = { windowBranding };
