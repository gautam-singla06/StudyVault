const path = require('path');
const fs = require('fs');

// Mock electron
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
  console.log('Initial count:', listSubjects().length);
  
  const subject = createSubject({ name: 'Test ' + Date.now(), description: 'Desc', color: '#fff' });
  console.log('Created ID:', subject.id);
  
  const subjects = listSubjects();
  console.log('New count:', subjects.length);
  console.log('Found in list:', subjects.some(s => s.id === subject.id));
}

main().catch(console.error);
