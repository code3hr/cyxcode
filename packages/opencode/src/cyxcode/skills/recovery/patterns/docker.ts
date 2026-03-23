/**
 * Docker Error Patterns
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const dockerPatterns: Pattern[] = [
  // DAEMON NOT RUNNING
  {
    id: "docker-daemon-not-running",
    regex: /Cannot connect to the Docker daemon|Is the docker daemon running/i,
    category: "docker",
    description: "Docker daemon not running",
    fixes: [
      { id: "start-docker-linux", command: "sudo systemctl start docker", description: "Start Docker (Linux)", priority: 1 },
      { id: "start-docker-mac", instructions: "Open Docker Desktop application", description: "Start Docker Desktop (macOS)", priority: 2 },
    ],
  },

  // IMAGE NOT FOUND
  {
    id: "docker-image-not-found",
    regex: /Unable to find image ['"](.+)['"]|manifest.*not found|pull access denied/i,
    category: "docker",
    description: "Docker image not found",
    extractors: { image: 0 },
    fixes: [
      { id: "docker-pull", command: "docker pull $1", description: "Pull image from registry", priority: 1 },
      { id: "docker-login", command: "docker login", description: "Login to registry", priority: 2 },
    ],
  },

  // PORT ALREADY IN USE
  {
    id: "docker-port-in-use",
    regex: /port is already allocated|Bind for.*:(\d+) failed|address already in use/i,
    category: "docker",
    description: "Docker port conflict",
    extractors: { port: 0 },
    fixes: [
      { id: "docker-stop-port", command: "docker ps -q --filter publish=$1 | xargs -r docker stop", description: "Stop container using port", priority: 1 },
      { id: "find-port-process", command: "lsof -i :$1", description: "Find process using port", priority: 2 },
    ],
  },

  // CONTAINER ALREADY EXISTS
  {
    id: "docker-container-exists",
    regex: /container name ['"](\w+)['"] is already in use|Conflict.*container.*already exists/i,
    category: "docker",
    description: "Container name already in use",
    extractors: { name: 0 },
    fixes: [
      { id: "docker-rm", command: "docker rm -f $1", description: "Remove existing container", priority: 1 },
      { id: "docker-rename", instructions: "Use a different container name", description: "Use different name", priority: 2 },
    ],
  },

  // NO SPACE LEFT
  {
    id: "docker-no-space",
    regex: /no space left on device|out of disk space/i,
    category: "docker",
    description: "Docker out of disk space",
    fixes: [
      { id: "docker-prune", command: "docker system prune -af", description: "Remove unused Docker data", priority: 1 },
      { id: "docker-prune-volumes", command: "docker volume prune -f", description: "Remove unused volumes", priority: 2 },
    ],
  },

  // DOCKERFILE ERROR
  {
    id: "dockerfile-error",
    regex: /failed to solve.*dockerfile|Error response from daemon.*Dockerfile/i,
    category: "docker",
    description: "Dockerfile build error",
    fixes: [
      { id: "docker-build-no-cache", command: "docker build --no-cache .", description: "Build without cache", priority: 1 },
      { id: "check-dockerfile", instructions: "Check Dockerfile syntax and base image availability", description: "Verify Dockerfile", priority: 2 },
    ],
  },

  // PERMISSION DENIED
  {
    id: "docker-permission-denied",
    regex: /Got permission denied.*docker\.sock|permission denied.*\/var\/run\/docker\.sock/i,
    category: "docker",
    description: "Docker permission denied",
    fixes: [
      { id: "add-docker-group", command: "sudo usermod -aG docker $USER && newgrp docker", description: "Add user to docker group", priority: 1 },
      { id: "sudo-docker", instructions: "Run with sudo: sudo docker ...", description: "Use sudo", priority: 2 },
    ],
  },

  // COMPOSE ERROR
  {
    id: "docker-compose-error",
    regex: /docker-compose.*error|docker compose.*failed/i,
    category: "docker",
    description: "Docker Compose error",
    fixes: [
      { id: "compose-down-up", command: "docker compose down && docker compose up -d", description: "Restart compose services", priority: 1 },
      { id: "compose-build", command: "docker compose build --no-cache", description: "Rebuild compose images", priority: 2 },
    ],
  },
]
