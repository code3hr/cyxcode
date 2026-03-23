/**
 * Kubernetes/kubectl Error Patterns
 */

import type { Pattern } from "../../../types"

export const kubernetesPatterns: Pattern[] = [
  // CONTEXT NOT FOUND
  {
    id: "k8s-context-not-found",
    regex: /context.*not found|no context.*with.*name|error:.*context/i,
    category: "kubernetes",
    description: "Kubernetes context not found",
    fixes: [
      { id: "list-contexts", command: "kubectl config get-contexts", description: "List available contexts", priority: 1 },
      { id: "set-context", command: "kubectl config use-context $context", description: "Switch to correct context", priority: 2 },
    ],
  },

  // CONNECTION REFUSED
  {
    id: "k8s-connection-refused",
    regex: /connection.*refused.*6443|Unable to connect to the server|dial tcp.*refused|must be logged in.*Unauthorized/i,
    category: "kubernetes",
    description: "Cannot connect to Kubernetes cluster",
    fixes: [
      { id: "check-cluster", command: "kubectl cluster-info", description: "Check cluster info", priority: 1 },
      { id: "check-kubeconfig", command: "echo $KUBECONFIG && cat ~/.kube/config | head -20", description: "Check kubeconfig", priority: 2 },
      { id: "start-minikube", command: "minikube start", description: "Start minikube (local dev)", priority: 3 },
    ],
  },

  // POD NOT FOUND
  {
    id: "k8s-pod-not-found",
    regex: /pods?.*not found|Error from server.*NotFound.*pods/i,
    category: "kubernetes",
    description: "Kubernetes pod not found",
    fixes: [
      { id: "list-pods", command: "kubectl get pods -A", description: "List all pods", priority: 1 },
      { id: "check-namespace", command: "kubectl get pods -n $namespace", description: "Check specific namespace", priority: 2 },
    ],
  },

  // IMAGE PULL ERROR
  {
    id: "k8s-image-pull-error",
    regex: /ImagePullBackOff|ErrImagePull|Failed to pull image|repository does not exist/i,
    category: "kubernetes",
    description: "Kubernetes image pull failed",
    fixes: [
      { id: "describe-pod", command: "kubectl describe pod $pod", description: "Get detailed error", priority: 1 },
      { id: "check-secret", command: "kubectl get secrets", description: "Check image pull secrets", priority: 2 },
      { id: "create-secret", command: "kubectl create secret docker-registry regcred --docker-server=$server --docker-username=$user --docker-password=$pass", description: "Create registry secret", priority: 3 },
    ],
  },

  // CRASHLOOPBACKOFF
  {
    id: "k8s-crashloop",
    regex: /CrashLoopBackOff|Back-off restarting failed container/i,
    category: "kubernetes",
    description: "Pod in CrashLoopBackOff",
    fixes: [
      { id: "get-logs", command: "kubectl logs $pod --previous", description: "Get previous container logs", priority: 1 },
      { id: "describe-pod", command: "kubectl describe pod $pod", description: "Describe pod for events", priority: 2 },
      { id: "exec-debug", command: "kubectl run debug --image=busybox -it --rm -- sh", description: "Start debug container", priority: 3 },
    ],
  },

  // OOM KILLED
  {
    id: "k8s-oom-killed",
    regex: /OOMKilled|memory.*limit|Killed.*memory/i,
    category: "kubernetes",
    description: "Container killed due to OOM",
    fixes: [
      { id: "check-resources", command: "kubectl top pods", description: "Check pod resource usage", priority: 1 },
      { id: "describe-limits", command: "kubectl describe pod $pod | grep -A5 Limits", description: "Check resource limits", priority: 2 },
      { id: "increase-memory", instructions: "Increase memory limits in pod spec resources.limits.memory", description: "Increase memory limit", priority: 3 },
    ],
  },

  // PERMISSION DENIED / RBAC
  {
    id: "k8s-forbidden",
    regex: /forbidden|RBAC.*denied|cannot.*verb|User.*cannot/i,
    category: "kubernetes",
    description: "Kubernetes RBAC permission denied",
    fixes: [
      { id: "check-auth", command: "kubectl auth can-i --list", description: "List your permissions", priority: 1 },
      { id: "check-role", command: "kubectl get rolebindings,clusterrolebindings -A | grep $user", description: "Check role bindings", priority: 2 },
    ],
  },

  // PENDING POD
  {
    id: "k8s-pod-pending",
    regex: /Pending|Unschedulable|FailedScheduling|Insufficient.*cpu|Insufficient.*memory/i,
    category: "kubernetes",
    description: "Pod stuck in Pending state",
    fixes: [
      { id: "describe-pod", command: "kubectl describe pod $pod | tail -20", description: "Check scheduling events", priority: 1 },
      { id: "check-nodes", command: "kubectl describe nodes | grep -A5 Allocatable", description: "Check node resources", priority: 2 },
      { id: "check-taints", command: "kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints", description: "Check node taints", priority: 3 },
    ],
  },

  // INVALID YAML
  {
    id: "k8s-invalid-yaml",
    regex: /error validating|yaml.*error|json.*unmarshal|field.*not found|unknown field/i,
    category: "kubernetes",
    description: "Invalid Kubernetes manifest",
    fixes: [
      { id: "validate-yaml", command: "kubectl apply --dry-run=client -f $file", description: "Dry-run validation", priority: 1 },
      { id: "explain-field", command: "kubectl explain $resource", description: "Show valid fields", priority: 2 },
    ],
  },

  // SERVICE NOT ACCESSIBLE
  {
    id: "k8s-service-not-accessible",
    regex: /service.*has no endpoints|no endpoints available|connection refused.*service/i,
    category: "kubernetes",
    description: "Kubernetes service not accessible",
    fixes: [
      { id: "check-endpoints", command: "kubectl get endpoints $service", description: "Check service endpoints", priority: 1 },
      { id: "check-selector", command: "kubectl describe svc $service | grep Selector", description: "Check service selector", priority: 2 },
      { id: "check-pod-labels", command: "kubectl get pods --show-labels", description: "Check pod labels match", priority: 3 },
    ],
  },
]
