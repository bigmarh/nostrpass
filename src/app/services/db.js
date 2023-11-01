import Dexie from 'dexie';
var db = new Dexie('cjDB');
db.version(1).stores({
    contacts:"&account,coinId,email,photoURL",
    txs:"&hash,amount,date,from,memo,to"
});

export default db;