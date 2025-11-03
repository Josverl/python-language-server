# Quick Summary: Pyright-Playground Research

## The Question
How does pyright-playground run Pyright in the browser without a server component?

## The Answer
**It doesn't.** Pyright-playground (https://pyright-play.net) uses a traditional client-server architecture.

## Architecture Overview

### What Pyright-Playground Actually Does
```
Browser (Monaco Editor)
    ↓ HTTP REST API
Express Server (Node.js)
    ↓ Node IPC / LSP
Pyright Language Server (Node.js Process)
    ↓ LSP Messages
Express Server
    ↓ HTTP JSON Response
Browser
```

### What python-language-server Does
```
Client (Jesse Dashboard)
    ↓ WebSocket
Bridge (pyright-bridge.ts)
    ↓ stdio
Pyright Language Server (Node.js Process)
    ↓ LSP Messages
Bridge
    ↓ WebSocket
Client
```

## Key Differences

| Aspect | Pyright-Playground | python-language-server |
|--------|-------------------|----------------------|
| **Protocol** | HTTP REST (stateless) | WebSocket (persistent) |
| **Process Model** | Pool of reusable sessions | Single dedicated process |
| **Versions** | Multiple Pyright versions | Single bundled version |
| **Lifecycle** | 1-minute timeout + pooling | Persistent with connection |
| **Deployment** | Centralized cloud (Azure) | Standalone/embedded |
| **Runtime** | Server Node.js | Bundled Node.js |

## Alternative: BasedPyright

There IS a way to run Pyright in the browser natively:

**BasedPyright** - A browser-compatible build of Pyright
- Uses WebAssembly and modern JS bundling
- Runs entirely client-side
- Available as npm package
- NOT used by pyright-playground

## Recommendations for python-language-server

### Keep Current Architecture ✅
The WebSocket approach is better for continuous editing sessions in Jesse dashboard.

### Consider These Enhancements
1. **Session Pooling** - Reuse Pyright processes across connections
2. **Multi-Version Support** - Allow selecting Pyright version at runtime  
3. **Lifecycle Management** - Add session timeouts and graceful cleanup
4. **Health Monitoring** - Status endpoints and metrics
5. **Dynamic Configuration** - Runtime pyrightconfig.json updates

### If Browser Execution is Required
1. Evaluate **basedpyright** package
2. Create proof-of-concept
3. Compare performance with server-based approach
4. Ensure feature parity
5. Consider hybrid approach (server as fallback)

## Bottom Line

- **Pyright-playground is NOT browser-native** - it's a traditional server architecture
- **Current python-language-server architecture is sound** for its use case
- **Main learnings** are about session management, not browser execution
- **BasedPyright exists** if true browser execution is needed, but it's a separate project

## Visual Architecture Comparison

See [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) for visual diagrams comparing all three architectures side-by-side.

## Full Details

See [RESEARCH.md](./RESEARCH.md) for complete analysis, code examples, and detailed comparisons.
