# Testing the Security Questions Recovery Flow

## Prerequisites
1. Make sure the vault app is running
2. You'll need to create a fresh test account to set up recovery

## Step-by-Step Testing Guide

### 1. Create a New Account with Recovery Setup

1. **Navigate to the vault login page**
   ```
   http://localhost:5173/localhost_8080
   ```

2. **Click "Don't have an account? Sign up"**

3. **Fill in signup form:**
   - Username: `testrecovery` (or any unique username)
   - Password: `TestPassword123!`
   - Confirm Password: `TestPassword123!`

4. **Click "Create Account"**

5. **PIN Setup Screen:**
   - Enter a PIN: `1234`
   - Confirm PIN: `1234`

6. **Security Questions Setup:**
   - You should see "Set Up PIN Recovery" screen
   - Select 3 questions (e.g., first pet, birth city, favorite color)
   - Enter memorable answers:
     - First pet: `fluffy`
     - Birth city: `paris`
     - Favorite color: `blue`
   - **IMPORTANT**: Write these down exactly as entered!
   - Click "Complete Setup"

7. **You should be redirected to the dashboard**

### 2. Test the Recovery Flow

1. **Log out** (or refresh the page)

2. **Log back in** with username and password

3. **On PIN unlock screen:**
   - Click "Forgot PIN?" link at the bottom

4. **Security Questions Recovery:**
   - You'll see your 3 questions
   - Enter the EXACT answers (case doesn't matter):
     - `fluffy`
     - `paris` 
     - `blue`
   - Click "Recover Access"

5. **If successful:**
   - You'll see the PIN setup screen again
   - Enter a NEW PIN: `5678`
   - Confirm NEW PIN: `5678`

6. **Password Verification:**
   - A password prompt will appear
   - Enter your password: `TestPassword123!`
   - Click "Complete Reset"

7. **Success!**
   - You should be redirected to the dashboard
   - Your vault is now unlocked with the new PIN

### 3. Verify the New PIN Works

1. **Log out or refresh**
2. **Log in with username/password**
3. **Enter your NEW PIN**: `5678`
4. **Should successfully unlock**

## Testing Edge Cases

### Test 1: Wrong Security Answers
1. Start recovery flow
2. Enter WRONG answers
3. Should see error: "Incorrect answers. X attempts remaining"
4. After 5 failed attempts, should be locked out

### Test 2: Wrong Password During Reset
1. Complete recovery successfully
2. Set new PIN
3. Enter WRONG password
4. Should see error: "Invalid password"

### Test 3: Cancel at Various Stages
1. Test canceling during security questions
2. Test canceling during PIN setup
3. Test canceling during password entry
4. Should return to PIN unlock screen each time

## Console Debugging

Open browser console (F12) and look for:
- "🔍 Checking username availability" during signup
- "🔑 Creating account with PIN and recovery"
- "Recovery successful" messages
- Any error messages

## Common Issues

1. **"No recovery questions set up"**
   - The account was created before recovery was implemented
   - Create a new test account

2. **"Incorrect answers" even though they're right**
   - Check for extra spaces
   - Remember answers are normalized (lowercase, trimmed)
   - Special characters might cause issues

3. **"Failed to reset PIN"**
   - Check console for specific errors
   - Might be worker communication issue

## Reset Test Environment

To start fresh:
1. Open browser DevTools (F12)
2. Go to Application tab
3. Clear all site data
4. Refresh the page

## Test Data for Quick Testing

```
Username: testuser123
Password: TestPass123!
PIN: 1234
Recovery Questions:
- What was the name of your first pet? → spot
- In what city were you born? → london
- What is your favorite color? → green
```