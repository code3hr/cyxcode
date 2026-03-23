/**
 * Authentication/Authorization Error Patterns
 */

import type { Pattern } from "../../../types"

export const authPatterns: Pattern[] = [
  // 401 UNAUTHORIZED
  {
    id: "auth-401-unauthorized",
    regex: /401 Unauthorized|HTTP.*401|Authentication required|WWW-Authenticate/i,
    category: "auth",
    description: "Authentication required (401)",
    fixes: [
      { id: "check-token", instructions: "Verify your API token or credentials are valid and not expired", description: "Check credentials", priority: 1 },
      { id: "env-token", command: "echo $API_TOKEN | head -c 10", description: "Verify token is set in environment", priority: 2 },
      { id: "refresh-token", instructions: "Refresh your authentication token", description: "Refresh token", priority: 3 },
    ],
  },

  // 403 FORBIDDEN
  {
    id: "auth-403-forbidden",
    regex: /403 Forbidden|HTTP.*403|Access denied|Insufficient permissions/i,
    category: "auth",
    description: "Access forbidden (403)",
    fixes: [
      { id: "check-perms", instructions: "Verify you have the required permissions/role for this operation", description: "Check permissions", priority: 1 },
      { id: "check-scope", instructions: "Verify your token has the required scopes/claims", description: "Check token scopes", priority: 2 },
    ],
  },

  // API KEY INVALID
  {
    id: "auth-api-key-invalid",
    regex: /Invalid API key|API key.*invalid|Incorrect API key|bad.*api.?key/i,
    category: "auth",
    description: "Invalid API key",
    fixes: [
      { id: "regenerate-key", instructions: "Regenerate your API key from the provider dashboard", description: "Regenerate API key", priority: 1 },
      { id: "check-key-format", instructions: "Verify the API key format and check for extra whitespace", description: "Check key format", priority: 2 },
    ],
  },

  // TOKEN EXPIRED
  {
    id: "auth-token-expired",
    regex: /Token.*expired|JWT.*expired|Access token.*expired|exp claim/i,
    category: "auth",
    description: "Authentication token expired",
    fixes: [
      { id: "refresh-token", instructions: "Use refresh token to get a new access token", description: "Refresh token", priority: 1 },
      { id: "reauth", instructions: "Re-authenticate to get new credentials", description: "Re-authenticate", priority: 2 },
    ],
  },

  // OAUTH ERROR
  {
    id: "auth-oauth-error",
    regex: /OAuth.*error|invalid_grant|invalid_client|unauthorized_client|access_denied/i,
    category: "auth",
    description: "OAuth authentication error",
    fixes: [
      { id: "check-client-id", instructions: "Verify client_id and client_secret are correct", description: "Check OAuth credentials", priority: 1 },
      { id: "check-redirect", instructions: "Verify redirect_uri matches registered callback URL", description: "Check redirect URI", priority: 2 },
      { id: "check-scope", instructions: "Verify requested scopes are allowed for this client", description: "Check scopes", priority: 3 },
    ],
  },

  // CORS ERROR
  {
    id: "auth-cors-error",
    regex: /CORS.*blocked|Access-Control-Allow-Origin|Cross-Origin Request Blocked|No 'Access-Control-Allow-Origin'/i,
    category: "auth",
    description: "CORS policy blocked request",
    fixes: [
      { id: "cors-header", instructions: "Add Access-Control-Allow-Origin header to server response", description: "Add CORS headers", priority: 1 },
      { id: "cors-proxy", instructions: "Use a CORS proxy for development", description: "Use CORS proxy", priority: 2 },
      { id: "cors-credentials", instructions: "Set credentials: 'include' and Access-Control-Allow-Credentials: true", description: "Enable credentials", priority: 3 },
    ],
  },

  // JWT MALFORMED
  {
    id: "auth-jwt-malformed",
    regex: /jwt malformed|invalid token|JsonWebTokenError|JWT.*invalid/i,
    category: "auth",
    description: "Malformed JWT token",
    fixes: [
      { id: "decode-jwt", command: "echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .", description: "Decode and inspect JWT", priority: 1 },
      { id: "check-jwt-format", instructions: "Verify JWT has 3 parts separated by dots (header.payload.signature)", description: "Check JWT format", priority: 2 },
    ],
  },

  // RATE LIMIT
  {
    id: "auth-rate-limit",
    regex: /429 Too Many Requests|Rate limit exceeded|too many requests|API rate limit/i,
    category: "auth",
    description: "Rate limit exceeded",
    fixes: [
      { id: "wait-retry", instructions: "Wait for the rate limit window to reset (check Retry-After header)", description: "Wait and retry", priority: 1 },
      { id: "reduce-requests", instructions: "Implement request throttling or batching", description: "Throttle requests", priority: 2 },
      { id: "upgrade-plan", instructions: "Consider upgrading API plan for higher limits", description: "Upgrade plan", priority: 3 },
    ],
  },
]
