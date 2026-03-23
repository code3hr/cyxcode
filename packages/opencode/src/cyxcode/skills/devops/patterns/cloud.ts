/**
 * Cloud Provider Error Patterns (AWS, GCP, Azure)
 */

import type { Pattern } from "../../../types"

export const cloudPatterns: Pattern[] = [
  // AWS - CREDENTIALS
  {
    id: "aws-credentials",
    regex: /Unable to locate.*credentials|InvalidClientTokenId|SignatureDoesNotMatch|ExpiredToken/i,
    category: "cloud",
    description: "AWS credentials error",
    fixes: [
      { id: "check-creds", command: "aws sts get-caller-identity", description: "Verify AWS credentials", priority: 1 },
      { id: "configure-aws", command: "aws configure", description: "Configure AWS credentials", priority: 2 },
      { id: "check-env", command: "env | grep AWS_", description: "Check AWS env vars", priority: 3 },
    ],
  },

  // AWS - ACCESS DENIED
  {
    id: "aws-access-denied",
    regex: /AccessDenied|not authorized to perform|User:.*is not authorized/i,
    category: "cloud",
    description: "AWS access denied",
    fixes: [
      { id: "check-policy", command: "aws iam get-user && aws iam list-attached-user-policies --user-name $USER", description: "Check IAM policies", priority: 1 },
      { id: "simulate-policy", command: "aws iam simulate-principal-policy --policy-source-arn $ARN --action-names $ACTION", description: "Simulate policy", priority: 2 },
    ],
  },

  // AWS - RESOURCE NOT FOUND
  {
    id: "aws-resource-not-found",
    regex: /ResourceNotFoundException|NoSuchBucket|NoSuchKey|does not exist in region/i,
    category: "cloud",
    description: "AWS resource not found",
    fixes: [
      { id: "check-region", command: "aws configure get region", description: "Check current region", priority: 1 },
      { id: "list-regions", command: "aws ec2 describe-regions --output table", description: "List available regions", priority: 2 },
    ],
  },

  // AWS - QUOTA EXCEEDED
  {
    id: "aws-quota-exceeded",
    regex: /LimitExceeded|Quota exceeded|ServiceQuotaExceeded|Too Many Requests/i,
    category: "cloud",
    description: "AWS quota/limit exceeded",
    fixes: [
      { id: "check-quotas", command: "aws service-quotas list-service-quotas --service-code $SERVICE", description: "Check service quotas", priority: 1 },
      { id: "request-increase", instructions: "Request quota increase via AWS Service Quotas console", description: "Request increase", priority: 2 },
    ],
  },

  // GCP - AUTH ERROR
  {
    id: "gcp-auth-error",
    regex: /UNAUTHENTICATED|Could not load the default credentials|Application Default Credentials/i,
    category: "cloud",
    description: "GCP authentication error",
    fixes: [
      { id: "gcloud-auth", command: "gcloud auth application-default login", description: "Login with gcloud", priority: 1 },
      { id: "check-sa", command: "echo $GOOGLE_APPLICATION_CREDENTIALS && cat $GOOGLE_APPLICATION_CREDENTIALS | jq .client_email", description: "Check service account", priority: 2 },
    ],
  },

  // GCP - PERMISSION DENIED
  {
    id: "gcp-permission-denied",
    regex: /PERMISSION_DENIED|does not have.*permission|googleapi.*403/i,
    category: "cloud",
    description: "GCP permission denied",
    fixes: [
      { id: "check-iam", command: "gcloud projects get-iam-policy $PROJECT", description: "Check IAM policy", priority: 1 },
      { id: "grant-role", command: "gcloud projects add-iam-policy-binding $PROJECT --member=$MEMBER --role=$ROLE", description: "Grant IAM role", priority: 2 },
    ],
  },

  // GCP - PROJECT ERROR
  {
    id: "gcp-project-error",
    regex: /project.*not found|Project.*does not exist|INVALID_PROJECT/i,
    category: "cloud",
    description: "GCP project error",
    fixes: [
      { id: "list-projects", command: "gcloud projects list", description: "List available projects", priority: 1 },
      { id: "set-project", command: "gcloud config set project $PROJECT_ID", description: "Set current project", priority: 2 },
    ],
  },

  // AZURE - AUTH ERROR
  {
    id: "azure-auth-error",
    regex: /AADSTS|InteractiveBrowserCredential|DefaultAzureCredential.*failed/i,
    category: "cloud",
    description: "Azure authentication error",
    fixes: [
      { id: "az-login", command: "az login", description: "Login with Azure CLI", priority: 1 },
      { id: "check-subscription", command: "az account show", description: "Check current subscription", priority: 2 },
    ],
  },

  // AZURE - SUBSCRIPTION ERROR
  {
    id: "azure-subscription-error",
    regex: /SubscriptionNotFound|subscription.*not found|InvalidSubscriptionId/i,
    category: "cloud",
    description: "Azure subscription error",
    fixes: [
      { id: "list-subs", command: "az account list --output table", description: "List subscriptions", priority: 1 },
      { id: "set-sub", command: "az account set --subscription $SUBSCRIPTION_ID", description: "Set subscription", priority: 2 },
    ],
  },

  // CLOUD - RATE LIMIT
  {
    id: "cloud-rate-limit",
    regex: /Rate Exceeded|Throttling|RequestLimitExceeded|rateLimitExceeded|429/i,
    category: "cloud",
    description: "Cloud API rate limit exceeded",
    fixes: [
      { id: "wait-retry", instructions: "Wait and retry with exponential backoff", description: "Wait and retry", priority: 1 },
      { id: "request-increase", instructions: "Request API quota increase from cloud provider", description: "Request quota increase", priority: 2 },
    ],
  },
]
