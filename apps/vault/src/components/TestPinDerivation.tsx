import { Component, createSignal } from 'solid-js';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';

const TestPinDerivation: Component = () => {
  const [results, setResults] = createSignal<string[]>([]);
  const [testing, setTesting] = createSignal(false);
  
  const addResult = (msg: string) => {
    console.log(msg);
    setResults(prev => [...prev, msg]);
  };
  
  const runTest = async () => {
    setTesting(true);
    setResults([]);
    
    const cryptoWorker = getCryptoWorker();
    
    const testPin = '111111';
    const testSalt = 'bAIBR/arAzGPao7mOzU2RA';
    
    addResult('🧪 Testing PIN key derivation consistency');
    addResult(`PIN: ${testPin}`);
    addResult(`Salt: ${testSalt}`);
    
    try {
      // Test 1: Derive key with salt
      addResult('\n📍 Test 1: Derive with existing salt');
      const result1 = await cryptoWorker.deriveKey({
        password: testPin,
        salt: testSalt
      });
      
      const key1 = result1 instanceof Map ? result1.get('key') : result1.key;
      addResult(`Key preview: ${key1?.substring(0, 20)}...`);
      addResult(`Key length: ${key1?.length}`);
      addResult(`Key type: ${typeof key1}`);
      
      // Test 2: Derive again
      addResult('\n📍 Test 2: Derive again with same salt');
      const result2 = await cryptoWorker.deriveKey({
        password: testPin,
        salt: testSalt
      });
      
      const key2 = result2 instanceof Map ? result2.get('key') : result2.key;
      addResult(`Key preview: ${key2?.substring(0, 20)}...`);
      addResult(`Key length: ${key2?.length}`);
      
      // Compare
      addResult('\n🔍 Comparison:');
      addResult(`Keys match: ${key1 === key2}`);
      
      // Test 3: Encrypt/Decrypt
      addResult('\n📍 Test 3: Encrypt/Decrypt test');
      const testData = 'test_xpriv_data_here';
      
      const encrypted = await cryptoWorker.encryptData({
        data: testData,
        password: key1
      });
      addResult('✅ Encrypted successfully');
      addResult(`Encrypted length: ${encrypted.length}`);
      
      const decrypted = await cryptoWorker.decryptData({
        encryptedData: encrypted,
        password: key2
      });
      addResult('✅ Decrypted successfully!');
      addResult(`Data matches: ${decrypted === testData}`);
      
      // Test with actual vault data
      addResult('\n📍 Test 4: Try with actual vault encrypted data');
      const encryptedXpriv = 'p44r+l6q3YKZArzR0kzu'; // From the error log
      
      try {
        await cryptoWorker.decryptData({
          encryptedData: encryptedXpriv,
          password: key1
        });
        addResult('✅ Decrypted vault data successfully');
      } catch (e: any) {
        addResult(`❌ Failed to decrypt vault data: ${e.message}`);
        
        // Try to understand why
        addResult('\n🔍 Debugging vault data:');
        addResult(`Vault data length: ${encryptedXpriv.length}`);
        addResult(`Vault data looks base64: ${/^[A-Za-z0-9+/]+=*$/.test(encryptedXpriv)}`);
      }
      
    } catch (error: any) {
      addResult(`❌ Test failed: ${error.message}`);
    }
    
    setTesting(false);
  };
  
  return (
    <div class="p-4 max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-4">PIN Key Derivation Test</h2>
      
      <button
        onClick={runTest}
        disabled={testing()}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 mb-4"
      >
        {testing() ? 'Testing...' : 'Run Test'}
      </button>
      
      <div class="bg-gray-100 p-4 rounded font-mono text-sm whitespace-pre-wrap">
        {results().length === 0 ? 'Click "Run Test" to start' : results().join('\n')}
      </div>
    </div>
  );
};

export default TestPinDerivation;