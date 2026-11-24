const { execFileSync } = require('node:child_process');
/** 只读取本次 Electron 窗口的 WM_GETICON，确认原生窗口确已接收图标。 */
function nativeWindowIcon(handle) {
  if (!/^\d+$/.test(handle)) throw Error('无效的本次窗口句柄');
  const code = [
    'Add-Type -TypeDefinition @\'',
    'using System; using System.Runtime.InteropServices;',
    'public static class WindowIconProbe { [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }',
    '\'@',
    '$icon = [WindowIconProbe]::SendMessage([IntPtr]::new([long]' + handle + '), 127, [IntPtr]::new(1), [IntPtr]::Zero)',
    'Write-Output $icon.ToInt64()',
  ].join('\n');
  const value = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(code, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return value;
}
module.exports = { nativeWindowIcon };
