# @nostrpass/lite-cli

Headless CLI for NostrPass Lite and agent workflows.

## Default secret env vars

- `NOSTRPASS_LITE_AUTH_SECRET`
- `NOSTRPASS_LITE_PIN`
- `NOSTRPASS_LITE_KEY` (for import)

## Example

```bash
nostrpass-lite enroll --identifier alice
nostrpass-lite get-public-key --origin https://example.com --identifier alice
nostrpass-lite sign-event --origin https://example.com --identifier alice --event-file ./event.json
```

## Policy file

Defaults to `.nostrpass-lite-policy.json` in the current working directory.

Runtime storage defaults to `./.nostrpass-lite` (override with `--storage-dir` or `NOSTRPASS_LITE_HOME`).

Use:

```bash
nostrpass-lite permissions set --origin https://example.com --operation signEvent --level ALLOW
nostrpass-lite permissions list
```
