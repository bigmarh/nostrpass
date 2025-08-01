// Test script to verify PIN key derivation consistency
import { getCryptoWorker } from './services/cryptoWorkerSingleton';

async function testPinKeyDerivation() {
  const cryptoWorker = getCryptoWorker();
  
  // Wait for worker to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const testPin = '111111';
  const testSalt = 'bAIBR/arAzGPao7mOzU2RA';
  
  console.log('🧪 Testing PIN key derivation consistency');
  console.log('PIN:', testPin);
  console.log('Salt:', testSalt);
  
  // Test 1: Derive key with salt (like during unlock)
  console.log('\n📍 Test 1: Derive with existing salt');
  const result1 = await cryptoWorker.deriveKey({
    password: testPin,
    salt: testSalt
  });
  
  const key1 = result1 instanceof Map ? result1.get('key') : result1.key;
  console.log('Key preview:', key1?.substring(0, 20) + '...');
  console.log('Key length:', key1?.length);
  
  // Test 2: Derive again with same inputs
  console.log('\n📍 Test 2: Derive again with same salt');
  const result2 = await cryptoWorker.deriveKey({
    password: testPin,
    salt: testSalt
  });
  
  const key2 = result2 instanceof Map ? result2.get('key') : result2.key;
  console.log('Key preview:', key2?.substring(0, 20) + '...');
  console.log('Key length:', key2?.length);
  
  // Compare keys
  console.log('\n🔍 Comparison:');
  console.log('Keys match:', key1 === key2);
  
  // Test 3: Encrypt and decrypt with derived key
  console.log('\n📍 Test 3: Encrypt/Decrypt test');
  const testData = 'test_xpriv_data_here';
  
  try {
    // Encrypt with key1
    const encrypted = await cryptoWorker.encryptData({
      data: testData,
      password: key1
    });
    console.log('✅ Encrypted successfully');
    console.log('Encrypted length:', encrypted.length);
    console.log('Encrypted preview:', encrypted.substring(0, 20) + '...');
    
    // Try to decrypt with key2 (should work if keys match)
    const decrypted = await cryptoWorker.decryptData({
      encryptedData: encrypted,
      password: key2
    });
    console.log('✅ Decrypted successfully with second key!');
    console.log('Decrypted matches original:', decrypted === testData);
    
    // Try to decrypt with wrong key
    const wrongKey = 'wrong_key_1234567890123456789012345678901234567890123456789012';
    try {
      await cryptoWorker.decryptData({
        encryptedData: encrypted,
        password: wrongKey
      });
      console.log('❌ ERROR: Decryption with wrong key succeeded (should fail)');
    } catch (e) {
      console.log('✅ Correctly failed to decrypt with wrong key');
    }
    
  } catch (error) {
    console.error('❌ Encryption/Decryption test failed:', error);
  }
}

// Run the test
testPinKeyDerivation().catch(console.error);