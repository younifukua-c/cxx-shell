'use strict';
const {failure}=require('./files.cjs');
/** 安装声明只提供本应用的二级入口，不得声明其他应用或宿主公共页。 */
function applicationNavigation(value,id){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||!value.length||value.length>50)throw failure('APPLICATION_MENU_INVALID','应用菜单声明无效');
 const ids=new Set();
 const result=value.map(item=>{
  if(!item||typeof item.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80|| (item.icon!==undefined&&(typeof item.icon!=='string'||!/^[a-z0-9-]{1,80}$/.test(item.icon))))throw failure('APPLICATION_MENU_INVALID','应用菜单标识、名称或图标无效');
  ids.add(item.id);return {id:item.id,name:item.name,...(item.icon?{icon:item.icon}:{})};
 });
 if(!ids.has(id))throw failure('APPLICATION_MENU_INVALID','应用菜单必须包含默认入口');
 return result;
}
module.exports={applicationNavigation};
