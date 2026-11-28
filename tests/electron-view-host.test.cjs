
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createElectronViewHost} = require('@cxx/host-runtime/electron-view-host');
for (const show of [true, false]) test('一次激活只读取一次品牌配置并遵循显示策略：' + show, async () => {
  let reads = 0, shown = 0, focused = 0;
  class BaseWindow extends EventEmitter {
    constructor() {super(); this.id=1; this.contentView={addChildView(){},removeChildView(){}};}
    isDestroyed(){return false;} isMinimized(){return false;}
    getContentBounds(){return {width:640,height:480};}
    setTitle(title){this.title=title;} setIcon(icon){this.icon=icon;}
    show(){shown++;} focus(){focused++;} close(){this.emit('closed');}
  }
  class WebContentsView {
    constructor(){this.webContents=Object.assign(new EventEmitter(), {setWindowOpenHandler(){},isDestroyed:()=>false,focus(){},close(){}});}
    setBounds(){} setVisible(){}
  }
  const host=createElectronViewHost({electron:{BaseWindow,WebContentsView},
    windowOptions: id => {reads++; return {title:id,icon:'app.ico',show};}});
  try {
    const id=host.createWindow('deploy-flow'), view=host.createView({id:'deploy-flow'});
    const session={applicationId:'deploy-flow',view}; await host.attach(session,id); reads=0;
    await host.focus(session,id);
    assert.equal(reads,1); assert.equal(host.window(id).title,'deploy-flow');
    assert.equal(host.window(id).icon,'app.ico'); assert.equal(shown,Number(show)); assert.equal(focused,Number(show));
  } finally {host.destroy();}
});
