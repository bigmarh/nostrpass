# Security Questions Recovery Flow for xpriv

## Overview
Users can recover access to their PIN-encrypted xpriv by answering security questions correctly. The answers are concatenated and used to derive a recovery key that decrypts a backup copy of the xpriv.

## Data Structure

```typescript
interface VaultData {
  appPermissions: Record<string, AppPermission>;
  identities: Identity[];
  xpriv: string; // encrypted(xpriv, PIN)
  
  // Recovery system
  recovery?: {
    questions: string[]; // The questions (stored in plain text)
    xprivRecovery: string; // encrypted(xpriv, recoveryKey)
    salt: string; // Salt for answer derivation
    version: number; // For future compatibility
  };
}
```

## Setup Flow

1. **During PIN Setup** (after creating PIN):
   - User is prompted: "Would you like to set up PIN recovery?"
   - If yes, show security questions setup

2. **Security Questions Selection**:
   - Present 10-15 predefined questions
   - User must select 3-5 questions
   - User provides answers (normalized: lowercase, trimmed)

3. **Recovery Key Generation**:
   ```typescript
   const answers = ['fluffy', 'paris', 'toyota'];
   const concatenated = answers.join('|'); // "fluffy|paris|toyota"
   const salt = generateSalt();
   const recoveryKey = await pbkdf2(concatenated, salt, iterations);
   ```

4. **Store Recovery Data**:
   - Encrypt xpriv with recovery key
   - Store questions, encrypted xpriv, and salt
   - Clear answers from memory

## Recovery Flow

1. **Trigger Recovery**:
   - "Forgot PIN?" link on PIN unlock screen
   - Verify user is logged in (has decrypted VaultData)

2. **Answer Questions**:
   - Display stored questions
   - User enters answers
   - Show answer formatting hints

3. **Attempt Recovery**:
   ```typescript
   async function recoverWithQuestions(answers: string[]) {
     const concatenated = answers
       .map(a => a.toLowerCase().trim())
       .join('|');
     
     const recoveryKey = await pbkdf2(
       concatenated, 
       vaultData.recovery.salt, 
       iterations
     );
     
     try {
       const xpriv = decrypt(
         vaultData.recovery.xprivRecovery, 
         recoveryKey
       );
       return { success: true, xpriv };
     } catch {
       return { success: false };
     }
   }
   ```

4. **Reset PIN**:
   - On successful recovery, force PIN reset
   - User creates new PIN
   - User enters password to verify identity
   - System verifies password by attempting to decrypt current vault
   - Encrypt xpriv with new PIN
   - Re-encrypt entire vault with password
   - Update vault data
   - Optional: Update recovery questions

## Security Considerations

1. **Answer Normalization**:
   - Always lowercase
   - Trim whitespace
   - Consider removing special characters
   - Maybe allow close matches (edit distance)

2. **Rate Limiting**:
   - Max 5 attempts per hour
   - Exponential backoff
   - Log attempts

3. **No Answer Storage**:
   - Never store raw answers
   - Only store encrypted xpriv and salt
   - Questions are public information

4. **Clear Instructions**:
   - "Answers are case-insensitive"
   - "Spaces are removed"
   - "Use the exact spelling you'll remember"

## UI Components Needed

1. **SecurityQuestionsSetup.tsx**
   - Question selection
   - Answer input
   - Confirmation step

2. **PINRecovery.tsx**
   - Display questions
   - Answer inputs
   - Attempt counter
   - Success/failure handling

3. **PINReset.tsx**
   - New PIN entry
   - Confirmation
   - Update recovery option

## Example Questions

1. What was the name of your first pet?
2. In what city were you born?
3. What was your mother's maiden name?
4. What was the make of your first car?
5. What was the name of your elementary school?
6. What is your favorite book?
7. What was your childhood nickname?
8. In what city did you meet your spouse?
9. What is your favorite movie?
10. What was your first job?
11. What is your favorite food?
12. What was the name of your best friend in school?
13. What is your favorite color?
14. What year did you graduate high school?
15. What is your favorite sports team?

## Implementation Steps

1. Update VaultData type with recovery field
2. Create SecurityQuestionsSetup component
3. Add to PIN setup flow
4. Create PINRecovery component
5. Add "Forgot PIN?" link to PinUnlock
6. Implement recovery logic in vaultService
7. Add PIN reset flow after successful recovery
8. Test edge cases (wrong answers, special characters)