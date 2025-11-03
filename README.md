# Pyright LSP WebSocket Bridge

A WebSocket bridge for the Pyright language server with a bundled Node.js runtime. This service provides Python language server capabilities (autocomplete, type checking, diagnostics, etc.) through a WebSocket interface, primarily used by the Jesse dashboard to provide IntelliSense features for Jesse strategies.

## Overview

This repository delivers:
- **WebSocket Bridge** - Translates WebSocket messages to Pyright LSP protocol
- **Bundled Runtime** - Includes Node.js, eliminating system dependencies
- **Cross-Platform Support** - Works on Linux, macOS, and Windows
- **Optimized Builds** - ~70% size reduction with production-only dependencies

## Technology Stack

- **TypeScript** - Main language for the bridge implementation
- **Node.js** - Runtime environment
- **Pyright** - Microsoft's static type checker for Python
- **WebSocket (ws)** - WebSocket communication
- **vscode-ws-jsonrpc** - JSON-RPC over WebSocket
- **esbuild** - Fast JavaScript bundler

## Development

### Setup
```bash
npm install
```

### Running in Development Mode
```bash
npm start -- \
  --port 9011 \
  --bot-root /path/to/project \
  --jesse-root /path/to/project/src
```

### Command-Line Arguments
- `--port` - WebSocket server port (default: 9011)
- `--bot-root` - Root directory of the Python project (where pyrightconfig.json is deployed)
- `--jesse-root` - Directory containing Python source files

## Build

### Single Platform (Linux x64)
```bash
./build.sh
```
Output: `output/linux-x64.tar.gz` (~34 MB)

### All Platforms
```bash
./build-all.sh
```
Outputs:
- `linux-x64.tar.gz` / `linux-arm64.tar.gz`
- `darwin-x64.tar.gz` / `darwin-arm64.tar.gz`
- `win32-x64.zip`

## Deployment & Usage

### Linux/macOS
```bash
# Extract the archive
tar -xzf linux-x64.tar.gz

# Run the server
cd linux-x64
./start.sh \
  --port 9011 \
  --bot-root /path/to/project \
  --jesse-root /path/to/project/src
```

### Windows
```cmd
REM Extract win32-x64.zip

REM Run the server
cd win32-x64
start.bat --port 9011 --bot-root C:\path\to\project --jesse-root C:\path\to\project\src
```

## Configuration

The Pyright language server is configured via `pyrightconfig.json` in the project root. You can customize type checking behavior, Python version, include/exclude patterns, and more.

## Features

- ✅ Bundled Node.js runtime (no system dependencies)
- ✅ Optimized build (~70% size reduction)
- ✅ Cross-platform support (Linux, macOS, Windows)
- ✅ Production-ready dependencies only
- ✅ WebSocket-based communication
- ✅ Full Pyright LSP capabilities

## Architecture

The bridge acts as a middleware between WebSocket clients (like the Jesse dashboard) and the Pyright language server:

```
Client (Jesse Dashboard) <-> WebSocket <-> Bridge <-> Pyright LSP
```

Messages are translated between WebSocket and the Language Server Protocol, enabling Python IntelliSense features in web-based interfaces.

## File Structure

- `index.ts` - Entry point and CLI argument handling
- `pyright-bridge.ts` - WebSocket bridge implementation
- `pyrightconfig.json` - Pyright configuration
- `package.json` - Node.js project configuration
- `build.sh` - Build script for Linux x64
- `build-all.sh` - Build script for all platforms
- `output/` - Build output directory (generated)

## Research & Documentation

For insights into how similar projects handle Pyright execution, see:

### Server-Based Implementations
- [RESEARCH.md](./RESEARCH.md) - Comprehensive analysis of pyright-playground architecture
- [RESEARCH_SUMMARY.md](./RESEARCH_SUMMARY.md) - Quick reference guide

### Browser-Native Implementation
- [BASEDPYRIGHT_BROWSER_RESEARCH.md](./BASEDPYRIGHT_BROWSER_RESEARCH.md) - **NEW:** Detailed analysis of basedpyright's true browser execution

### Visual Comparisons
- [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) - Visual architecture diagrams

These documents explain:
- How pyright-playground actually works (server-based, not browser-native)
- **How basedpyright runs entirely in the browser using Web Workers and LSP**
- Comparison with python-language-server architecture
- Complete implementation examples and integration guides
- Recommendations for potential enhancements

## License

This project is part of the Jesse ecosystem.
