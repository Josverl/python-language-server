# Architecture Comparison Diagram

## Pyright-Playground Architecture (Server-Based)

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Monaco Editor (JavaScript)                           │   │
│  │  • Code editing                                       │   │
│  │  • Syntax highlighting                                │   │
│  │  • No Pyright execution                               │   │
│  └────────────────┬─────────────────────────────────────┘   │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    │ HTTP REST API (JSON)
                    │ POST /api/session/:id/diagnostics
                    │ POST /api/session/:id/hover
                    │ POST /api/session/:id/completion
                    ▼
┌─────────────────────────────────────────────────────────────┐
│           Cloud Server (Azure/Node.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js API Server                                │   │
│  │  • Session management                                 │   │
│  │  • Request routing                                    │   │
│  │  • Process pooling                                    │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   │ Node.js IPC (LSP Messages)                │
│                   ▼                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pyright Language Server Pool                        │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │   │
│  │  │LS #1 │ │LS #2 │ │LS #3 │ │LS #4 │ ...           │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                │   │
│  │  • Node.js child processes                           │   │
│  │  • Full Pyright functionality                        │   │
│  │  • Session lifecycle (1-min timeout)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ❌ Pyright does NOT run in the browser
- ✅ HTTP REST API for communication
- ✅ Session pooling and reuse
- ✅ Multiple Pyright versions supported
- ✅ Centralized cloud deployment

---

## python-language-server Architecture (Current)

```
┌─────────────────────────────────────────────────────────────┐
│              Client Application (Jesse Dashboard)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CodeMirror Editor (JavaScript)                       │   │
│  │  • Code editing                                       │   │
│  │  • LSP client                                         │   │
│  │  • WebSocket connection                               │   │
│  └────────────────┬─────────────────────────────────────┘   │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    │ WebSocket (Persistent Connection)
                    │ ws://localhost:9011/lsp
                    │ LSP JSON-RPC Messages
                    ▼
┌─────────────────────────────────────────────────────────────┐
│    Standalone Server (Bundled with Jesse or Separate)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Bridge (pyright-bridge.ts)                │   │
│  │  • WebSocket ↔ stdio translation                     │   │
│  │  • Message routing                                    │   │
│  │  • Auto-inject rootUri                                │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   │ stdio (stdin/stdout)                      │
│                   │ LSP Messages                              │
│                   ▼                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pyright Language Server                             │   │
│  │  • Single Node.js child process                      │   │
│  │  • Spawned per bridge instance                       │   │
│  │  • Full Pyright functionality                        │   │
│  │  • Persistent during connection                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Bundled Node.js Runtime                             │   │
│  │  • No system Node.js required                        │   │
│  │  • Cross-platform (Linux, macOS, Windows)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ❌ Pyright does NOT run in the browser
- ✅ WebSocket for persistent connection
- ✅ Bundled Node.js runtime (no dependencies)
- ✅ Optimized for single-client use case
- ✅ Can be deployed standalone or with Jesse

---

## BasedPyright Architecture (True Browser Execution)

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser Only                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Monaco Editor (JavaScript)                           │   │
│  │  • Code editing                                       │   │
│  │  • Syntax highlighting                                │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   │ LSP JSON-RPC Messages                     │
│                   │ BrowserMessageReader/Writer               │
│                   ▼                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Foreground Web Worker (pyright.worker.js)            │  │
│  │  • PyrightBrowserServer (LSP implementation)          │  │
│  │  • Virtual file system (TestFileSystem)               │  │
│  │  • Manages background workers via MessageChannel     │  │
│  │  • Loaded from CDN (jsdelivr)                         │  │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   │ MessageChannel (MessagePort)              │
│                   ▼                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Background Web Workers (multiple, parallel)          │  │
│  │  • BrowserBackgroundAnalysisRunner                    │  │
│  │  • Perform type analysis                              │  │
│  │  • JavaScript execution (NOT WebAssembly)             │  │
│  │  • Files stored in memory (virtual fs)                │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

         ⚠️  NO SERVER COMPONENT REQUIRED ⚠️
    ALL TYPE CHECKING HAPPENS IN BROWSER WEB WORKERS
```

**Key Points:**
- ✅ Pyright DOES run entirely in the browser
- ✅ Uses Web Workers (NOT WebAssembly)
- ✅ Full LSP server implementation in JavaScript
- ✅ Virtual file system (TestFileSystem) in memory
- ✅ No server needed
- ✅ Complete privacy (code never leaves browser)
- ✅ Offline capability
- ✅ Available as `browser-basedpyright` npm package
- ✅ Live demo: https://basedpyright.com/
- ❌ NOT used by pyright-playground (different project)

---

## Side-by-Side Comparison

| Feature | Pyright-Playground | python-language-server | BasedPyright (Browser) |
|---------|-------------------|----------------------|---------------------|
| **Browser Execution** | ❌ No | ❌ No | ✅ Yes (Web Workers) |
| **Server Required** | ✅ Express.js | ✅ WebSocket Bridge | ❌ None |
| **Communication** | HTTP REST | WebSocket | LSP (BrowserMessage) |
| **Process Model** | Pooled sessions | Single process | Web Workers |
| **Deployment** | Cloud (Azure) | Standalone/embedded | Static files/CDN |
| **Runtime** | Node.js (server) | Bundled Node.js | Browser JavaScript |
| **File System** | Real fs (server) | Real fs (server) | Virtual (memory) |
| **Privacy** | Code on server | Code on server | Code in browser |
| **Latency** | Network + compute | Local compute | Browser compute |
| **Resource Usage** | Server resources | Local resources | Browser resources |
| **Offline Support** | ❌ No | ✅ Yes (with local) | ✅ Yes (after load) |
| **Package** | Standard pyright | Standard pyright | browser-basedpyright |
| **Technology** | Node.js LSP | Node.js LSP | JavaScript LSP |

---

## The Misunderstanding

**Common Misconception:**
> "Pyright-playground runs Pyright in the browser"

**Reality:**
> Pyright-playground uses a traditional client-server architecture. The browser only handles UI (Monaco Editor) and makes HTTP requests to a Node.js server that runs Pyright.

**What Actually Runs in Browser:**
1. **Pyright-playground:** Monaco Editor UI + HTTP client only
2. **python-language-server:** CodeMirror Editor + WebSocket client only
3. **BasedPyright (browser edition):** Complete Pyright LSP server in Web Workers + UI

**The Correct Understanding:**
- Pyright-playground and python-language-server both run Pyright on a server
- BasedPyright has a special `browser-basedpyright` package that runs entirely in the browser
- The browser edition uses Web Workers and JavaScript (NOT WebAssembly)
- See [BASEDPYRIGHT_BROWSER_RESEARCH.md](./BASEDPYRIGHT_BROWSER_RESEARCH.md) for complete details

---

## Conclusion

Both **pyright-playground** and **python-language-server** use server-based architectures where Pyright runs in Node.js processes, not in the browser. The main difference is:

- **Pyright-playground:** Uses HTTP REST API with session pooling
- **python-language-server:** Uses WebSocket with persistent connection

If true browser execution is needed, **basedpyright** is the technology to investigate, but it's a completely different implementation approach.
