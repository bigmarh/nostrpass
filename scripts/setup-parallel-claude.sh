#!/bin/bash

# Setup script for running multiple Claude Code instances in parallel
# Uses Git worktrees for complete isolation between instances

set -e

# Configuration
PROJECT_NAME="nostrpass"
BASE_DIR=$(dirname "$(dirname "$(realpath "$0")")")
WORKTREE_BASE=$(dirname "$BASE_DIR")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Parallel Claude Code Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Define worktree configurations
# Format: "directory-suffix:branch-name:description"
WORKTREES=(
    "frontend:feature/frontend:Frontend/marketing site work"
    "vault:feature/vault:Vault app development"
    "extension:feature/extension:Chrome extension work"
    "packages:feature/packages:Shared packages/libraries"
    "tests:feature/tests:Testing and bug fixes"
)

# Function to create a worktree
create_worktree() {
    local suffix=$1
    local branch=$2
    local description=$3
    local worktree_path="$WORKTREE_BASE/$PROJECT_NAME-$suffix"

    if [ -d "$worktree_path" ]; then
        echo -e "${YELLOW}⚠ Worktree already exists:${NC} $worktree_path"
        return 0
    fi

    echo -e "${GREEN}Creating worktree:${NC} $PROJECT_NAME-$suffix"
    echo -e "  Branch: $branch"
    echo -e "  Path: $worktree_path"

    # Create worktree with new branch from current HEAD
    git worktree add "$worktree_path" -b "$branch" 2>/dev/null || \
    git worktree add "$worktree_path" "$branch" 2>/dev/null || \
    {
        echo -e "${RED}Failed to create worktree. Trying with existing branch...${NC}"
        git worktree add "$worktree_path" "$branch"
    }

    echo -e "  ${GREEN}✓${NC} Worktree created"
}

# Function to install dependencies in a worktree
install_deps() {
    local suffix=$1
    local worktree_path="$WORKTREE_BASE/$PROJECT_NAME-$suffix"

    if [ -d "$worktree_path" ]; then
        echo -e "${BLUE}Installing dependencies in:${NC} $PROJECT_NAME-$suffix"
        cd "$worktree_path"
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
        echo -e "  ${GREEN}✓${NC} Dependencies installed"
        cd "$BASE_DIR"
    fi
}

# Function to list all worktrees
list_worktrees() {
    echo -e "\n${BLUE}Current worktrees:${NC}"
    git worktree list
}

# Function to print launch instructions
print_launch_instructions() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  Launch Instructions${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "Open separate terminal windows/tabs and run:\n"

    local i=1
    for config in "${WORKTREES[@]}"; do
        IFS=':' read -r suffix branch description <<< "$config"
        local worktree_path="$WORKTREE_BASE/$PROJECT_NAME-$suffix"
        echo -e "${GREEN}Terminal $i - $description:${NC}"
        echo -e "  cd $worktree_path && claude"
        echo ""
        ((i++))
    done

    echo -e "${YELLOW}Tip:${NC} Use '/rename <name>' in each Claude session for easy identification"
    echo -e "${YELLOW}Tip:${NC} Focus each instance on its designated area to avoid conflicts"
}

# Function to cleanup worktrees
cleanup_worktrees() {
    echo -e "${YELLOW}Cleaning up worktrees...${NC}"
    for config in "${WORKTREES[@]}"; do
        IFS=':' read -r suffix branch description <<< "$config"
        local worktree_path="$WORKTREE_BASE/$PROJECT_NAME-$suffix"
        if [ -d "$worktree_path" ]; then
            echo -e "Removing: $PROJECT_NAME-$suffix"
            git worktree remove "$worktree_path" --force 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Function to show help
show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup     Create all worktrees and install dependencies (default)"
    echo "  create    Create worktrees only (no dependency install)"
    echo "  install   Install dependencies in existing worktrees"
    echo "  list      List all current worktrees"
    echo "  cleanup   Remove all parallel worktrees"
    echo "  help      Show this help message"
    echo ""
    echo "Worktree configuration:"
    for config in "${WORKTREES[@]}"; do
        IFS=':' read -r suffix branch description <<< "$config"
        echo "  - $PROJECT_NAME-$suffix: $description"
    done
}

# Main execution
case "${1:-setup}" in
    setup)
        echo -e "${GREEN}Setting up parallel Claude Code environment...${NC}\n"

        # Create all worktrees
        for config in "${WORKTREES[@]}"; do
            IFS=':' read -r suffix branch description <<< "$config"
            create_worktree "$suffix" "$branch" "$description"
        done

        echo -e "\n${GREEN}Installing dependencies in all worktrees...${NC}\n"

        # Install dependencies in parallel (background jobs)
        for config in "${WORKTREES[@]}"; do
            IFS=':' read -r suffix branch description <<< "$config"
            install_deps "$suffix"
        done

        list_worktrees
        print_launch_instructions
        ;;
    create)
        echo -e "${GREEN}Creating worktrees only...${NC}\n"
        for config in "${WORKTREES[@]}"; do
            IFS=':' read -r suffix branch description <<< "$config"
            create_worktree "$suffix" "$branch" "$description"
        done
        list_worktrees
        print_launch_instructions
        ;;
    install)
        echo -e "${GREEN}Installing dependencies in existing worktrees...${NC}\n"
        for config in "${WORKTREES[@]}"; do
            IFS=':' read -r suffix branch description <<< "$config"
            install_deps "$suffix"
        done
        ;;
    list)
        list_worktrees
        ;;
    cleanup)
        cleanup_worktrees
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac

echo -e "\n${GREEN}Done!${NC}"
