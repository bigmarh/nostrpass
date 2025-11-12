# Financial Tab - Embassy Test Console

The **Financial Tab** in the Embassy Test Console provides a comprehensive testing environment for financial transactions on Nostr, including Lightning zaps (NIP-57) and other payment-related event types.

## Features

### ⚡ Lightning Zaps (NIP-57)

Create and sign zap requests to send Lightning payments to Nostr users.

**Zap Request Builder:**
- **Recipient Pubkey**: Enter the recipient's hex public key
- **Amount**: Specify amount in satoshis (default: 21 sats)
- **Comment**: Optional message to include with your zap
- **Relays**: Comma-separated list of relay URLs for zap receipt publishing

**Workflow:**
1. Fill in recipient, amount, and optional comment
2. Click "⚡ Create Zap Request" to generate the kind 9734 event
3. Review the event structure in the preview pane
4. Click "✍️ Sign Zap Event" to sign with NostrPass
5. Use the signed event with your Lightning Service Provider

### 💰 Financial Event Types

Sign various financial-related Nostr events:

| Event Kind | Description | NIP |
|------------|-------------|-----|
| **9734** | Zap Request | 57 |
| **9735** | Zap Receipt | 57 |
| **1063** | File Metadata (paid content) | 94 |
| **402** | Payment Required | - |
| **7000** | Job Request | 90 |
| **7001** | Job Result | 90 |

**Custom Event Builder:**
- Select event kind from dropdown
- Add JSON content
- Define tags as JSON array
- Sign and get guidance on next steps

### 🎯 NIP-57 Zap Flow Reference

Complete 7-step guide showing the full Lightning zap process:

1. Fetch recipient's Lightning Address from profile metadata
2. Query LNURL endpoint for callback URL
3. Create zap request (kind 9734)
4. Sign with private key via NostrPass
5. Send to Lightning Service Provider
6. Pay Lightning invoice
7. LSP publishes zap receipt (kind 9735)

### 📚 Quick Reference Table

Built-in reference showing all financial event kinds with descriptions and their associated NIPs.

## Example: Creating a Zap

```javascript
// 1. Get recipient's public key (from their profile)
const recipientPubkey = '3bf0c...'; // hex format

// 2. Create zap request through the UI
// - Enter recipient pubkey
// - Set amount (e.g., 21 sats)
// - Add comment (e.g., "Great content!")
// - Configure relays

// 3. Click "Create Zap Request" - generates:
{
  kind: 9734,
  content: "Great content!",
  tags: [
    ["relays", "wss://relay.damus.io", "wss://relay.nostr.band"],
    ["amount", "21000"], // millisats
    ["p", "3bf0c..."]
  ],
  created_at: 1234567890,
  pubkey: "your_pubkey"
}

// 4. Click "Sign Zap Event" - signs with NostrPass

// 5. Send signed event to LSP callback URL
// 6. Pay the returned Lightning invoice
// 7. LSP publishes kind 9735 receipt to relays
```

## Example: Job Request (NIP-90)

```javascript
// Select "7000 - Job Request" from dropdown

// Content (JSON):
{
  "input": "https://example.com/video.mp4",
  "params": {
    "resolution": "720p",
    "format": "webm"
  }
}

// Tags:
[
  ["output", "video/webm"],
  ["price", "1000"], // sats
  ["relays", "wss://jobs.relay.com"]
]

// Sign and publish to job processing relays
```

## Testing Zaps in the Console

### Prerequisites
1. NostrPass account with identity
2. Recipient's public key
3. Access to a Lightning wallet (for actual payment)
4. Lightning Service Provider (LSP) supporting NIP-57

### Step-by-Step Test

1. **Open Embassy Test Console** (`http://localhost:3200/`)

2. **Navigate to Financial Tab**

3. **Enter Zap Details:**
   ```
   Recipient Pubkey: 82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2
   Amount: 21 sats
   Comment: Testing NostrPass zaps!
   Relays: wss://relay.damus.io, wss://relay.nostr.band
   ```

4. **Create Zap Request:**
   - Click "⚡ Create Zap Request"
   - Review the generated event in preview pane
   - Verify all fields are correct

5. **Sign the Event:**
   - Click "✍️ Sign Zap Event"
   - NostrPass will prompt for authorization
   - Review signed event in console output

6. **Next Steps (Manual):**
   - Copy the signed event JSON
   - Query recipient's LNURL endpoint
   - POST signed event to LSP callback URL
   - Pay the returned Lightning invoice
   - Monitor relays for zap receipt (kind 9735)

## Console Output

The console provides detailed logging for each step:

- ✅ **Success**: Zap request created, event signed
- ℹ️ **Info**: Next steps, workflow guidance
- ⚠️ **Warning**: Validation issues, format problems
- ❌ **Error**: Missing fields, signing failures

## Best Practices

1. **Always verify recipient pubkey** before creating zaps
2. **Use multiple relays** to ensure receipt publication
3. **Start with small amounts** when testing
4. **Keep comment field reasonable** (affects invoice size)
5. **Check LSP compatibility** with NIP-57 before using

## Limitations

- **npub format**: Currently requires hex public keys (npub decoding not implemented)
- **LNURL fetching**: Must be done separately (not integrated)
- **Invoice payment**: Requires external Lightning wallet
- **Receipt monitoring**: Must check relays manually

## Future Enhancements

- [ ] Automatic npub/hex conversion
- [ ] LNURL endpoint querying
- [ ] LSP integration for end-to-end testing
- [ ] Invoice QR code display
- [ ] Zap receipt monitoring
- [ ] Bulk zap operations
- [ ] Zap history tracking

## Related NIPs

- **NIP-57**: Lightning Zaps
- **NIP-90**: Data Vending Machines (job requests)
- **NIP-94**: File Metadata

## Resources

- [NIP-57 Specification](https://github.com/nostr-protocol/nips/blob/master/57.md)
- [LNURL Documentation](https://github.com/lnurl/luds)
- [Lightning Network Overview](https://lightning.network)
- [Nostr Protocol](https://nostr.com)

## Support

For issues or questions about financial operations:
- 📚 [Documentation](https://docs.nostrpass.com)
- 💬 [Discord](https://discord.gg/nostrpass)
- 🐛 [Report Issues](https://github.com/nostrpass/nostrpass/issues)

