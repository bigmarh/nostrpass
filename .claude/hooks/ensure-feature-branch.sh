#!/bin/bash
# Hook: Ensure Claude is working on a feature branch before making code changes
# This prevents accidental commits to main and enables checkpoint commits

set -e

# Read the hook input from stdin
INPUT=$(cat)

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Protected branches that shouldn't have direct changes
PROTECTED_BRANCHES=("main" "master" "production" "develop")

# Check if current branch is protected
is_protected() {
    for branch in "${PROTECTED_BRANCHES[@]}"; do
        if [ "$CURRENT_BRANCH" = "$branch" ]; then
            return 0
        fi
    done
    return 1
}

# If we're on a protected branch, block and suggest creating a feature branch
if is_protected; then
    # Generate a branch name based on timestamp
    SUGGESTED_BRANCH="feature/claude-$(date +%Y%m%d-%H%M%S)"

    cat << EOF
{
  "decision": "block",
  "reason": "You are on the protected '$CURRENT_BRANCH' branch. Please create a feature branch first for checkpoint commits.\n\nRun: git checkout -b $SUGGESTED_BRANCH\n\nOr ask me to create a branch with a descriptive name for your task."
}
EOF
else
    # We're on a feature branch, allow the operation
    cat << 'EOF'
{
  "decision": "allow"
}
EOF
fi
