#test file

const { initDatabase, createSubject, listSubjects } = require('./dist-electron/db.js');

async function main() {
  await initDatabase();
  console.log('Initial subjects:', listSubjects().length);
  
  const newSubject = createSubject({
    name: 'Test Subject ' + Date.now(),
    description: 'Test',
    color: '#000000'
  });
  
  console.log('Created subject:', newSubject);
  console.log('Subjects after creation:', listSubjects().length);
}

main().catch(console.error);
