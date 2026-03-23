/**
 * DevOps Skill - Infrastructure, CI/CD, and cloud error recovery
 * 
 * Handles Kubernetes, Terraform, CI/CD pipelines, cloud providers, and Ansible.
 */

import { BaseSkill } from "../../base-skill"
import type { Pattern } from "../../types"

// Import pattern categories
import { kubernetesPatterns } from "./patterns/kubernetes"
import { terraformPatterns } from "./patterns/terraform"
import { cicdPatterns } from "./patterns/cicd"
import { cloudPatterns } from "./patterns/cloud"
import { ansiblePatterns } from "./patterns/ansible"

export class DevOpsSkill extends BaseSkill {
  name = "devops"
  description = "DevOps error recovery - handles Kubernetes, Terraform, CI/CD, cloud providers, and Ansible"
  version = "1.0.0"
  
  triggers = [
    "kubectl", "kubernetes", "k8s", "pod", "deployment",
    "terraform", "tf", "tofu", "state",
    "github actions", "gitlab ci", "jenkins", "pipeline", "workflow",
    "aws", "gcp", "azure", "cloud",
    "ansible", "playbook", "inventory"
  ]

  patterns: Pattern[] = [
    ...kubernetesPatterns,
    ...terraformPatterns,
    ...cicdPatterns,
    ...cloudPatterns,
    ...ansiblePatterns,
  ]
}

// Export singleton instance
export const devopsSkill = new DevOpsSkill()
