# Research: How Pyright-Playground Runs Pyright in the Browser

## Executive Summary

This research document explains how the pyright-playground project (https://pyright-play.net) provides Python type checking in the browser. The key finding is that **pyright-playground does NOT actually run Pyright in the browser** - it uses a traditional server-based architecture with Node.js running Pyright as a language server on the backend.

However, there is a separate technology called **basedpyright** that can run Pyright natively in the browser using WebAssembly and modern JavaScript bundling.

## Architecture Analysis

### Pyright-Playground (https://pyright-play.net)

#### Actual Implementation
The pyright-playground is **NOT** a browser-only solution. It consists of:

1. **Client Side (React/Expo Web App)**
   - Monaco Editor for code editing
   - HTTP API calls to server endpoints
   - No direct execution of Pyright in the browser
   - Location: `/client/` directory in repository

2. **Server Side (Express + Node.js)**
   - Spawns Pyright language server processes via Node.js `fork()`
   - Manages session lifecycle (create, reuse, terminate)
   - Handles LSP (Language Server Protocol) communication
   - Dynamically installs different Pyright versions via npm
   - Location: `/server/` directory in repository

#### Key Technical Details

**Server Process Management:**
```typescript
// From server/src/sessionManager.ts
const langServerProcess = fork(
    binaryPath,  // Path to pyright/langserver.index.js
    ['--node-ipc', `--clientProcessId=${process.pid.toString()}`],
    {
        cwd: tempDirPath,
        silent: true,
        env,
    }
);
```

**Communication Flow:**
```
User Browser (Monaco Editor)
    ↓ HTTP POST
API Server (Express)
    ↓ Node IPC
Pyright Language Server (Node.js Process)
    ↓ LSP Messages
API Server
    ↓ HTTP Response (JSON)
User Browser
```

**Session Management:**
- Each user session gets a dedicated Pyright process
- Sessions are pooled and reused for performance
- Automatic cleanup after 1 minute of inactivity
- Support for multiple Pyright versions simultaneously

**Technology Stack:**
- **Frontend:** React, Monaco Editor, Expo (web)
- **Backend:** Express.js, Node.js
- **LSP Communication:** vscode-jsonrpc, vscode-languageserver
- **Deployment:** Azure (pyright-playground.azurewebsites.net)

### BasedPyright (Browser-Native Alternative)

Based on web research, there is a separate project called **basedpyright** that can run in the browser:

**Key Features:**
- Pyright compiled to run natively in browser environments
- Uses WebAssembly and modern JavaScript bundling (webpack/esbuild)
- Static type checking happens entirely client-side
- Available as npm package and PyPI wrapper
- Privacy benefit: code never leaves the browser
- Performance benefit: no network latency

**How It Works:**
1. Pyright's TypeScript source is bundled for browser environments
2. May use WebAssembly for performance-critical components
3. All file system operations are virtualized
4. Python type checking runs in the browser's JavaScript engine

## Comparison: Current python-language-server vs Pyright-Playground

### Current Implementation (python-language-server)

**Architecture:**
```
Client (Jesse Dashboard)
    ↓ WebSocket
WebSocket Bridge (pyright-bridge.ts)
    ↓ stdio
Pyright Language Server (spawned process)
```

**Key Characteristics:**
- WebSocket bridge instead of HTTP
- Single Pyright process per bridge instance
- Direct stdio communication with Pyright
- Bundled Node.js runtime for portability
- Deployed as standalone service

### Pyright-Playground Architecture

**Architecture:**
```
Client (Browser)
    ↓ HTTP REST API
Express Server
    ↓ Node IPC
Pyright Language Server Pool (multiple processes)
```

**Key Characteristics:**
- HTTP REST API instead of WebSocket
- Session pooling and lifecycle management
- Multiple Pyright versions supported
- Dynamic version installation
- Centralized cloud deployment

### Key Differences

| Feature | python-language-server | pyright-playground |
|---------|----------------------|-------------------|
| Communication | WebSocket (persistent) | HTTP REST (stateless) |
| Process Model | One per server | Pool of sessions |
| Pyright Versions | Single bundled version | Dynamic multi-version |
| Deployment | Standalone/embedded | Centralized cloud |
| Client | Specific (Jesse) | Generic web app |
| Runtime | Bundled Node.js | Server Node.js |

## Why Pyright-Playground Doesn't Run in Browser

1. **Native Dependencies:** Pyright is written in TypeScript for Node.js and relies on:
   - Node.js file system APIs
   - Node.js process management
   - Native module resolution
   - Child process spawning

2. **Performance:** Language servers are computationally intensive:
   - Full AST parsing
   - Type inference algorithms
   - Symbol resolution across files
   - Running in Node.js is more performant than browser JS

3. **Architecture:** LSP was designed for client-server model:
   - Separation of concerns
   - Better resource management
   - Multi-client support

## Implications for python-language-server

### Current Strengths
1. **WebSocket persistence** - Better for continuous editing sessions
2. **Bundled runtime** - No server-side Node.js dependency
3. **Standalone deployment** - Can run alongside Jesse
4. **Optimized for single use case** - Jesse dashboard

### Potential Enhancements from Pyright-Playground

1. **Session Pooling:**
   - Reuse Pyright processes across connections
   - Reduce spawn overhead
   - Better resource management

2. **Multi-Version Support:**
   - Allow clients to specify Pyright version
   - Test compatibility with different versions
   - Stay up-to-date with Pyright releases

3. **Configuration Flexibility:**
   - Dynamic pyrightconfig.json generation
   - Per-session Python version settings
   - Type checking mode selection

4. **Monitoring & Lifecycle:**
   - Session timeout management
   - Automatic cleanup of idle sessions
   - Health check endpoints

### Browser-Native Path (Using BasedPyright)

If truly running Pyright in the browser is desired:

**Pros:**
- No server component needed
- Privacy (code stays in browser)
- Lower hosting costs
- Offline capability

**Cons:**
- Significant refactoring required
- May have performance limitations
- Limited to browser-compatible features
- Less mature than server-based approach

**Implementation Requirements:**
1. Replace current server with basedpyright package
2. Rewrite communication layer for in-browser execution
3. Implement virtual file system for Python files
4. Test performance with large codebases
5. Ensure feature parity with Node.js Pyright

## Recommendations

### For python-language-server Project

1. **Keep Current Architecture:** The WebSocket bridge approach is well-suited for Jesse's use case

2. **Consider Adding Session Pooling:**
   - Reuse Pyright processes when possible
   - Implement session timeout (similar to playground's 1-minute timeout)
   - Add graceful shutdown and restart

3. **Add Version Management:**
   - Allow specifying Pyright version at runtime
   - Support updating Pyright without rebuild
   - Version compatibility checks

4. **Improve Monitoring:**
   - Add health check endpoint
   - Session statistics
   - Resource usage tracking

5. **Configuration Management:**
   - More flexible pyrightconfig.json handling
   - Runtime configuration updates
   - Per-connection settings

### If Browser-Native Execution is Required

1. **Evaluate basedpyright:**
   - Test performance with Jesse's typical codebases
   - Verify feature compatibility
   - Assess maintenance burden

2. **Prototype Implementation:**
   - Create proof-of-concept with basedpyright
   - Compare performance metrics
   - Validate all Jesse-required features work

3. **Gradual Migration:**
   - Keep server-based as fallback
   - Offer browser-native as option
   - Monitor real-world performance

## Conclusion

**Pyright-playground does NOT run Pyright in the browser.** It uses a traditional server architecture with Node.js running Pyright language servers and communicating via HTTP REST API.

The current python-language-server architecture is actually quite similar, using WebSocket instead of HTTP for more efficient persistent connections. The main learnings from pyright-playground are around session management, version flexibility, and lifecycle handling rather than browser execution.

If truly browser-native Pyright execution is desired, **basedpyright** is the technology to investigate, but it would require significant architectural changes and may not offer advantages for the Jesse dashboard use case.

## References

- Pyright Playground: https://github.com/erictraut/pyright-playground
- Pyright Playground Live Site: https://pyright-play.net/
- BasedPyright Documentation: https://docs.basedpyright.com/
- Pyright (Microsoft): https://github.com/microsoft/pyright
- Language Server Protocol: https://microsoft.github.io/language-server-protocol/

## Appendix: Code Snippets

### Pyright-Playground Session Creation
```typescript
// From server/src/sessionManager.ts - lines 220-328
// Shows how pyright-playground spawns Pyright as a Node.js process
function startSession(binaryDirPath: string, sessionOptions?: SessionOptions): Promise<SessionId> {
    // Launch a new instance of the language server in another process
    const binaryPath = path.join(
        process.cwd(),
        binaryDirPath,
        './node_modules/pyright/langserver.index.js'
    );
    
    const langServerProcess = fork(
        binaryPath,
        ['--node-ipc', `--clientProcessId=${process.pid.toString()}`],
        {
            cwd: tempDirPath,
            silent: true,
            env,
        }
    );
    
    session.langClient = new LspClient(langServerProcess);
    // ... LSP initialization
}
```

### Current python-language-server Process Spawning
```typescript
// From pyright-bridge.ts - lines 119-122
// Shows similar approach but using stdio instead of IPC
const pyright = spawn('node', [config.pyrightPath, '--stdio'], {
    cwd: config.botRoot,
    env: process.env
})
```

### Key Difference: Communication Protocol
```typescript
// Pyright-Playground: Uses Node IPC
new IPCMessageReader(langServer)
new IPCMessageWriter(langServer)

// python-language-server: Uses stdio
new StreamMessageReader(pyright.stdout)
new StreamMessageWriter(pyright.stdin)
```

Both approaches spawn Pyright as a separate Node.js process - neither runs in the browser.
