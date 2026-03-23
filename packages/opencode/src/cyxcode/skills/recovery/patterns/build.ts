/**
 * Build/Compile Error Patterns (CMake, Make, etc.)
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const buildPatterns: Pattern[] = [
  // CMAKE PACKAGE NOT FOUND
  {
    id: "cmake-package-not-found",
    regex: /Could not find.*package.*['"]([\w-]+)['"]|CMake Error.*find_package\(([\w-]+)\)/i,
    category: "build",
    description: "CMake package not found",
    extractors: { package: 0 },
    fixes: [
      { id: "vcpkg-install", command: "vcpkg install $1", description: "Install with vcpkg", priority: 1 },
      { id: "apt-install-dev", command: "sudo apt install lib$1-dev", description: "Install dev package (Debian/Ubuntu)", priority: 2 },
      { id: "brew-install", command: "brew install $1", description: "Install with Homebrew (macOS)", priority: 3 },
    ],
  },

  // LINKER ERROR - UNDEFINED REFERENCE
  {
    id: "linker-undefined-ref",
    regex: /undefined reference to ['"`](\w+)['"`]|unresolved external symbol (\w+)/i,
    category: "build",
    description: "Linker error - undefined reference",
    extractors: { symbol: 0 },
    fixes: [
      { id: "check-libs", instructions: "Check that all required libraries are linked (-l flags)", description: "Check library linking", priority: 1 },
      { id: "check-order", instructions: "Library order matters: dependent libs should come before dependencies", description: "Check link order", priority: 2 },
    ],
  },

  // HEADER NOT FOUND
  {
    id: "header-not-found",
    regex: /fatal error: ([\w\/\.]+): No such file|cannot find include file ['"]([\w\/\.]+)['"]/i,
    category: "build",
    description: "Header file not found",
    extractors: { header: 0 },
    fixes: [
      { id: "install-dev-pkg", command: "sudo apt install lib$1-dev", description: "Install dev package", priority: 1 },
      { id: "check-include-path", instructions: "Check include paths in CMakeLists.txt or Makefile", description: "Verify include paths", priority: 2 },
    ],
  },

  // CMAKE CONFIGURE ERROR
  {
    id: "cmake-configure-error",
    regex: /CMake Error at|CMake Error: The source directory .* does not exist/i,
    category: "build",
    description: "CMake configuration error",
    fixes: [
      { id: "cmake-clean", command: "rm -rf CMakeCache.txt CMakeFiles/", description: "Clean CMake cache", priority: 1 },
      { id: "cmake-reconfigure", command: "cmake -B build -S .", description: "Reconfigure with fresh build directory", priority: 2 },
    ],
  },

  // MAKE ERROR
  {
    id: "make-error",
    regex: /make\[\d+\]: \*\*\* .* Error \d+|make: \*\*\* No rule to make target/i,
    category: "build",
    description: "Make build error",
    fixes: [
      { id: "make-clean", command: "make clean", description: "Clean build artifacts", priority: 1 },
      { id: "make-verbose", command: "make VERBOSE=1", description: "Run make with verbose output", priority: 2 },
    ],
  },

  // COMPILER NOT FOUND
  {
    id: "compiler-not-found",
    regex: /gcc.*not found|g\+\+.*not found|clang.*not found|No CMAKE_CXX_COMPILER could be found/i,
    category: "build",
    description: "Compiler not found",
    fixes: [
      { id: "install-gcc", command: "sudo apt install build-essential", description: "Install GCC (Debian/Ubuntu)", priority: 1 },
      { id: "install-xcode", command: "xcode-select --install", description: "Install Xcode CLI tools (macOS)", priority: 2 },
    ],
  },

  // RUST/CARGO BUILD ERROR
  {
    id: "cargo-build-error",
    regex: /error\[E\d+\]:|cargo build.*failed/i,
    category: "build",
    description: "Cargo/Rust build error",
    fixes: [
      { id: "cargo-clean", command: "cargo clean", description: "Clean cargo build", priority: 1 },
      { id: "cargo-update", command: "cargo update", description: "Update dependencies", priority: 2 },
    ],
  },

  // GO BUILD ERROR
  {
    id: "go-build-error",
    regex: /cannot find package|go: module .* not found/i,
    category: "build",
    description: "Go module not found",
    fixes: [
      { id: "go-mod-tidy", command: "go mod tidy", description: "Tidy go modules", priority: 1 },
      { id: "go-get", command: "go get ./...", description: "Get dependencies", priority: 2 },
    ],
  },
]
