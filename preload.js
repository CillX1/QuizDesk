const { contextBridge, ipcRenderer } = require('electron');

const call = ch => (...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('quizdesk', {
  library: call('library'),
  catalog: call('catalog'),
  download: call('download'),
  open: call('open'),
  remove: call('remove'),
  importPick: call('import-pick'),
  importSave: call('import-save'),
  updateMeta: call('update-meta'),
  exportQuiz: call('export'),
  submit: call('submit'),
  openRepo: call('open-repo'),
  openRelease: call('open-release'),
  version: call('version'),
  duelPool: call('duel-pool'),
  updateCheck: call('update-check'),
  copy: call('copy'),
});
