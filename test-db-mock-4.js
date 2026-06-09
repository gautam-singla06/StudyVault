const path = require('path');
const fs = require('fs');

const mockElectron = {
  app: {
    getPath: () => __dirname,
    isPackaged: false,
  }
};
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList[0] === 'electron') return mockElectron;
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

const { initDatabase, createSubject, listSubjects } = require('./dist-electron/db.js');

async function main() {
  await initDatabase();
  console.log('lastInsertId =', require('./dist-electron/db.js').lastInsertId);
  try {
    const s = createSubject({ name: 'Test ' + Date.now(), description: 'Desc', color: '#fff' });
    console.log('Success:', s);
  } catch(e) {
    console.error('FAILED:', e.message);
    const sql = `SELECT last_insert_rowid() AS id`;
    console.log('All subjects:', listSubjects().map(x => x.id + ' - ' + x.name));
  }
}

main().catch(console.error);
