#!/bin/bash
# Hook: Track file changes and suggest commits after significant work
# Runs after Edit/Write operations to track when checkpoints are needed

set -e

# Read the hook input from stdin
INPUT=$(cat)

# Extract tool name and file path from input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# State file to track changes since last commit
STATE_DIR="$HOME/.claude-checkpoint-state"
STATE_FILE="$STATE_DIR/$(pwd | md5sum | cut -d' ' -f1).changes"

mkdir -p "$STATE_DIR"

# Count uncommitted changes
UNCOMMITTED_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# If there are many uncommitted changes, remind about checkpoints
if [ "$UNCOMMITTED_COUNT" -gt 5 ]; then
    cat << EOF
{
  "decision": "allow",
  "message": "Checkpoint reminder: You have $UNCOMMITTED_COUNT uncommitted changes. Consider committing your progress with a descriptive message."
}
EOF
else
    cat << 'EOF'
{
  "decision": "allow"
}
EOF
fi
