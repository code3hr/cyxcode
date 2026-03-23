/**
 * CI/CD Pipeline Error Patterns (GitHub Actions, GitLab CI, Jenkins)
 */

import type { Pattern } from "../../../types"

export const cicdPatterns: Pattern[] = [
  // GITHUB ACTIONS - WORKFLOW SYNTAX
  {
    id: "gha-syntax-error",
    regex: /workflow.*syntax.*error|Invalid workflow file|yaml.*parsing.*error.*workflow/i,
    category: "cicd",
    description: "GitHub Actions workflow syntax error",
    fixes: [
      { id: "validate-workflow", command: "actionlint .github/workflows/*.yml", description: "Lint workflow files", priority: 1 },
      { id: "check-yaml", instructions: "Check YAML indentation and syntax", description: "Check YAML syntax", priority: 2 },
    ],
  },

  // GITHUB ACTIONS - SECRET NOT FOUND
  {
    id: "gha-secret-not-found",
    regex: /secret.*not found|secrets\..*is empty|Context access.*secrets/i,
    category: "cicd",
    description: "GitHub Actions secret not found",
    fixes: [
      { id: "check-secrets", instructions: "Verify secret is configured in repo Settings > Secrets", description: "Check repo secrets", priority: 1 },
      { id: "check-env", instructions: "For environment secrets, ensure job specifies 'environment:'", description: "Check environment", priority: 2 },
    ],
  },

  // GITHUB ACTIONS - RUNNER ERROR
  {
    id: "gha-runner-error",
    regex: /No runner matching|Waiting for.*runner|All runners.*offline/i,
    category: "cicd",
    description: "GitHub Actions runner not available",
    fixes: [
      { id: "check-labels", instructions: "Verify runs-on label matches available runner", description: "Check runner labels", priority: 1 },
      { id: "use-hosted", instructions: "Consider using GitHub-hosted runners: ubuntu-latest, windows-latest, macos-latest", description: "Use hosted runners", priority: 2 },
    ],
  },

  // GITLAB CI - JOB FAILED
  {
    id: "gitlab-job-failed",
    regex: /Job failed.*script.*error|ERROR: Job failed|exit code [1-9]/i,
    category: "cicd",
    description: "GitLab CI job failed",
    fixes: [
      { id: "check-script", instructions: "Review the failed script command in .gitlab-ci.yml", description: "Check script", priority: 1 },
      { id: "retry-job", command: "gitlab-runner exec docker $job", description: "Test job locally", priority: 2 },
    ],
  },

  // GITLAB CI - ARTIFACT ERROR
  {
    id: "gitlab-artifact-error",
    regex: /artifact.*not found|Uploading artifacts.*failed|ERROR:.*artifacts/i,
    category: "cicd",
    description: "GitLab CI artifact error",
    fixes: [
      { id: "check-paths", instructions: "Verify artifacts.paths matches actual file locations", description: "Check artifact paths", priority: 1 },
      { id: "check-expiry", instructions: "Artifacts may have expired, check artifacts.expire_in", description: "Check expiry", priority: 2 },
    ],
  },

  // JENKINS - BUILD FAILED
  {
    id: "jenkins-build-failed",
    regex: /Build failed|FAILURE.*Build|hudson\.AbortException/i,
    category: "cicd",
    description: "Jenkins build failed",
    fixes: [
      { id: "check-console", instructions: "Review full console output in Jenkins UI", description: "Check console log", priority: 1 },
      { id: "replay-build", instructions: "Use Pipeline Replay to test changes without commit", description: "Replay build", priority: 2 },
    ],
  },

  // JENKINS - AGENT OFFLINE
  {
    id: "jenkins-agent-offline",
    regex: /Agent.*offline|node.*offline|No valid crumb|slave.*not available/i,
    category: "cicd",
    description: "Jenkins agent offline",
    fixes: [
      { id: "check-agents", instructions: "Check Jenkins > Manage Jenkins > Nodes for agent status", description: "Check agent status", priority: 1 },
      { id: "reconnect-agent", instructions: "Manually reconnect agent from Jenkins node page", description: "Reconnect agent", priority: 2 },
    ],
  },

  // PIPELINE TIMEOUT
  {
    id: "cicd-timeout",
    regex: /Job.*timed out|execution expired|timeout.*exceeded|canceled.*timeout/i,
    category: "cicd",
    description: "CI/CD pipeline timeout",
    fixes: [
      { id: "increase-timeout", instructions: "Increase job timeout in pipeline configuration", description: "Increase timeout", priority: 1 },
      { id: "optimize-job", instructions: "Split job into smaller parallel jobs, add caching", description: "Optimize job", priority: 2 },
    ],
  },

  // CACHE ERROR
  {
    id: "cicd-cache-error",
    regex: /cache.*not found|Failed to restore cache|cache.*expired|Cache miss/i,
    category: "cicd",
    description: "CI/CD cache error",
    fixes: [
      { id: "clear-cache", instructions: "Clear cache and rebuild - cache key may have changed", description: "Clear cache", priority: 1 },
      { id: "check-cache-key", instructions: "Verify cache key includes all relevant inputs (lockfile hash, etc.)", description: "Check cache key", priority: 2 },
    ],
  },
]
