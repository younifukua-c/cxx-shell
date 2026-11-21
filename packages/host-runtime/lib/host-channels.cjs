'use strict';
/** 宿主窗口、应用切换和关闭确认协议；所有产品消费同一公开定义。 */
module.exports=Object.freeze({
    WINDOW_MINIMIZE:'window:minimize',WINDOW_TOGGLE_MAXIMIZE:'window:toggle-maximize',WINDOW_CLOSE:'window:close',
    WINDOW_IS_MAXIMIZED:'window:is-maximized',WINDOW_MAXIMIZE_CHANGED:'window:maximize-changed',
    APPLICATION_HOST:'application-host:request',APPLICATION_HOST_CHANGED:'application-host:changed',APPLICATION_HOST_CLOSING:'application-host:closing',
});
