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

const { initDatabase, createSubject } = require('./dist-electron/db.js');
const dbModule = require('./dist-electron/db.js');

async function main() {
  await initDatabase();
  
  // monkey patch dbModule.runStatement
  const originalRunStatement = dbModule.__get__ ? dbModule.__get__('runStatement') : null;
  if (!originalRunStatement) {
    console.log('Cannot mock runStatement');
    return;
  }
  
  console.log('Testing createSubject');
  try {
    const subject = createSubject({ name: 'Test ' + Date.now(), description: 'Desc', color: '#fff' });
    console.log('Created subject:', subject);
  } catch (err) {
    console.error('Error during createSubject:', err.message);
    const id = dbModule.__get__('lastInsertId')();
    console.log('Last insert id is:', id);
  }
}

main().catch(console.error);
