/**
 * Terraform/OpenTofu Error Patterns
 */

import type { Pattern } from "../../../types"

export const terraformPatterns: Pattern[] = [
  // STATE LOCK
  {
    id: "tf-state-lock",
    regex: /Error acquiring the state lock|state.*locked|Lock Info|ConditionalCheckFailedException/i,
    category: "terraform",
    description: "Terraform state is locked",
    fixes: [
      { id: "check-lock", command: "terraform force-unlock $LOCK_ID", description: "Force unlock state (use with caution)", priority: 1 },
      { id: "check-processes", instructions: "Check if another terraform process is running", description: "Check running processes", priority: 2 },
    ],
  },

  // PROVIDER NOT FOUND
  {
    id: "tf-provider-not-found",
    regex: /provider.*not found|Failed to query available provider|Could not retrieve the list of available versions/i,
    category: "terraform",
    description: "Terraform provider not found",
    fixes: [
      { id: "tf-init", command: "terraform init -upgrade", description: "Initialize/upgrade providers", priority: 1 },
      { id: "check-registry", instructions: "Verify provider name and version in required_providers block", description: "Check provider config", priority: 2 },
    ],
  },

  // RESOURCE ALREADY EXISTS
  {
    id: "tf-resource-exists",
    regex: /already exists|Resource.*already created|EntityAlreadyExists|ConflictException/i,
    category: "terraform",
    description: "Resource already exists outside Terraform",
    fixes: [
      { id: "tf-import", command: "terraform import $resource_type.$name $id", description: "Import existing resource", priority: 1 },
      { id: "tf-refresh", command: "terraform refresh", description: "Refresh state from remote", priority: 2 },
    ],
  },

  // CYCLE DETECTED
  {
    id: "tf-cycle",
    regex: /Cycle.*detected|circular dependency|depends on itself/i,
    category: "terraform",
    description: "Terraform dependency cycle detected",
    fixes: [
      { id: "tf-graph", command: "terraform graph | dot -Tpng > graph.png", description: "Generate dependency graph", priority: 1 },
      { id: "check-deps", instructions: "Review depends_on and implicit references to break the cycle", description: "Review dependencies", priority: 2 },
    ],
  },

  // INVALID REFERENCE
  {
    id: "tf-invalid-ref",
    regex: /Reference to undeclared|A managed resource.*has not been declared|Invalid reference/i,
    category: "terraform",
    description: "Invalid Terraform reference",
    fixes: [
      { id: "check-resources", command: "terraform state list", description: "List resources in state", priority: 1 },
      { id: "validate", command: "terraform validate", description: "Validate configuration", priority: 2 },
    ],
  },

  // BACKEND CONFIG ERROR
  {
    id: "tf-backend-error",
    regex: /Error configuring.*backend|Backend configuration changed|backend.*not configured/i,
    category: "terraform",
    description: "Terraform backend configuration error",
    fixes: [
      { id: "tf-init-reconfigure", command: "terraform init -reconfigure", description: "Reconfigure backend", priority: 1 },
      { id: "tf-init-migrate", command: "terraform init -migrate-state", description: "Migrate state to new backend", priority: 2 },
    ],
  },

  // CREDENTIALS ERROR
  {
    id: "tf-credentials",
    regex: /No valid credential|error configuring.*provider|AccessDenied|AuthorizationError|InvalidClientTokenId/i,
    category: "terraform",
    description: "Terraform provider credentials error",
    fixes: [
      { id: "check-aws-creds", command: "aws sts get-caller-identity", description: "Verify AWS credentials", priority: 1 },
      { id: "check-env", command: "env | grep -E 'AWS_|GOOGLE_|AZURE_|ARM_'", description: "Check provider env vars", priority: 2 },
    ],
  },

  // PLAN SHOWS DESTROY
  {
    id: "tf-unexpected-destroy",
    regex: /will be destroyed|Plan:.*destroy|forces replacement/i,
    category: "terraform",
    description: "Terraform plans to destroy resources",
    fixes: [
      { id: "check-drift", command: "terraform plan -detailed-exitcode", description: "Check for drift", priority: 1 },
      { id: "prevent-destroy", instructions: "Add lifecycle { prevent_destroy = true } to protect critical resources", description: "Add lifecycle protection", priority: 2 },
    ],
  },

  // VERSION CONSTRAINT
  {
    id: "tf-version-constraint",
    regex: /version constraints|required_version|Unsupported Terraform Core version/i,
    category: "terraform",
    description: "Terraform version constraint not met",
    fixes: [
      { id: "check-version", command: "terraform version", description: "Check current version", priority: 1 },
      { id: "use-tfenv", command: "tfenv install && tfenv use", description: "Install required version with tfenv", priority: 2 },
    ],
  },
]
