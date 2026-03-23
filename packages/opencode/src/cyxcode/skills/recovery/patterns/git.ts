/**
 * Git Error Patterns
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const gitPatterns: Pattern[] = [
  // MERGE CONFLICT
  {
    id: "git-merge-conflict",
    regex: /CONFLICT.*Merge conflict|Automatic merge failed/i,
    category: "git",
    description: "Git merge conflict",
    fixes: [
      { id: "git-status", command: "git status", description: "Show conflicting files", priority: 1 },
      { id: "git-diff", command: "git diff --name-only --diff-filter=U", description: "List conflicting files", priority: 2 },
      { id: "git-abort", command: "git merge --abort", description: "Abort the merge", priority: 3 },
    ],
  },

  // PUSH REJECTED - NON-FAST-FORWARD
  {
    id: "git-push-rejected",
    regex: /rejected.*non-fast-forward|Updates were rejected|failed to push some refs/i,
    category: "git",
    description: "Git push rejected - need to pull first",
    fixes: [
      { id: "git-pull-rebase", command: "git pull --rebase", description: "Pull with rebase then push", priority: 1 },
      { id: "git-pull", command: "git pull", description: "Pull and merge then push", priority: 2 },
    ],
  },

  // UNCOMMITTED CHANGES
  {
    id: "git-uncommitted-changes",
    regex: /Your local changes.*would be overwritten|Please commit your changes or stash/i,
    category: "git",
    description: "Uncommitted changes blocking operation",
    fixes: [
      { id: "git-stash", command: "git stash", description: "Stash changes temporarily", priority: 1 },
      { id: "git-stash-pop", instructions: "Run: git stash, do operation, then: git stash pop", description: "Stash workflow", priority: 2 },
    ],
  },

  // NOT A GIT REPOSITORY
  {
    id: "git-not-repo",
    regex: /fatal: not a git repository/i,
    category: "git",
    description: "Not a git repository",
    fixes: [
      { id: "git-init", command: "git init", description: "Initialize git repository", priority: 1 },
    ],
  },

  // AUTHENTICATION FAILED
  {
    id: "git-auth-failed",
    regex: /fatal: Authentication failed|Permission denied \(publickey\)/i,
    category: "git",
    description: "Git authentication failed",
    fixes: [
      { id: "ssh-add", command: "ssh-add ~/.ssh/id_rsa", description: "Add SSH key to agent", priority: 1 },
      { id: "git-credential", command: "git config --global credential.helper store", description: "Enable credential storage", priority: 2 },
    ],
  },

  // BRANCH NOT FOUND
  {
    id: "git-branch-not-found",
    regex: /error: pathspec ['"](.+)['"] did not match|fatal: ['"](.+)['"] is not a commit/,
    category: "git",
    description: "Git branch or ref not found",
    fixes: [
      { id: "git-fetch", command: "git fetch --all", description: "Fetch all remote branches", priority: 1 },
      { id: "git-branch-list", command: "git branch -a", description: "List all branches", priority: 2 },
    ],
  },

  // DETACHED HEAD
  {
    id: "git-detached-head",
    regex: /HEAD detached at|You are in 'detached HEAD'/i,
    category: "git",
    description: "Git detached HEAD state",
    fixes: [
      { id: "git-checkout-branch", command: "git checkout -b temp-branch", description: "Create branch from current state", priority: 1 },
      { id: "git-checkout-main", command: "git checkout main || git checkout master", description: "Return to main branch", priority: 2 },
    ],
  },

  // DIVERGED BRANCHES
  {
    id: "git-diverged",
    regex: /have diverged|Your branch and .* have diverged/i,
    category: "git",
    description: "Local and remote branches have diverged",
    fixes: [
      { id: "git-pull-rebase", command: "git pull --rebase", description: "Rebase local changes onto remote", priority: 1 },
      { id: "git-reset-hard", command: "git fetch origin && git reset --hard origin/$(git branch --show-current)", description: "Reset to remote (loses local changes)", priority: 2 },
    ],
  },

  // UNTRACKED FILES WOULD BE OVERWRITTEN
  {
    id: "git-untracked-overwrite",
    regex: /untracked working tree files would be overwritten/i,
    category: "git",
    description: "Untracked files would be overwritten",
    fixes: [
      { id: "git-clean", command: "git clean -fd", description: "Remove untracked files (careful!)", priority: 1 },
      { id: "git-stash-untracked", command: "git stash -u", description: "Stash including untracked files", priority: 2 },
    ],
  },
]
