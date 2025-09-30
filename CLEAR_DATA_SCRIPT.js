// Paste this in your browser console to clear all NostrPass data
// Then hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

console.log('🧹 Clearing NostrPass data...');

// Clear IndexedDB (correct database name: NostrPassVault)
indexedDB.deleteDatabase('NostrPassVault').onsuccess = () => {
  console.log('✅ IndexedDB cleared');
};

// Clear localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear sessionStorage
sessionStorage.clear();
console.log('✅ sessionStorage cleared');

console.log('✅ All data cleared!');
console.log('👉 Now hard refresh the page (Cmd+Shift+R or Ctrl+Shift+F5) and create a new account.');
