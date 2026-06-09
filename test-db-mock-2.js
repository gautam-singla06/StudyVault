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
const dbModule = require('./dist-electron/db.js');

async function main() {
  await initDatabase();
  console.log('Last ID before:', dbModule.listSubjects().length);
  
  try {
    const subject = createSubject({ name: 'Test ' + Date.now(), description: 'Desc', color: '#fff' });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);
