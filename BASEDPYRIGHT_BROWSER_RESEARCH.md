# BasedPyright Browser Implementation Research

## Executive Summary

**YES, basedpyright DOES have a true browser-native implementation** that runs Pyright entirely in the browser using Web Workers and browser-compatible JavaScript bundles. This is achieved through the `browser-basedpyright` npm package, which is a special browser build of basedpyright that can execute Python type checking completely client-side without any server component.

## Key Finding

BasedPyright provides a **browser edition** package (`browser-basedpyright`) that:
- ✅ Runs entirely in the browser using Web Workers
- ✅ Uses LSP (Language Server Protocol) via `vscode-languageserver/browser`
- ✅ Bundles TypeScript code for browser execution (NOT WebAssembly)
- ✅ Implements a complete LSP server in JavaScript
- ✅ Uses virtual file system (TestFileSystem) for browser environment
- ✅ No server component required
- ✅ Loads from CDN (jsdelivr) for easy integration

## Architecture

### Browser-BasedPyright Package

**Package:** `browser-basedpyright` on npm  
**Repository:** https://github.com/DetachHead/basedpyright/tree/main/packages/browser-pyright  
**Live Demo:** https://basedpyright.com/

### Technical Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Environment                        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Monaco Editor (UI)                                    │  │
│  │  • Code editing interface                              │  │
│  │  • Display diagnostics                                 │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │                                           │
│                   │ LSP JSON-RPC Messages                     │
│                   │ (BrowserMessageReader/Writer)             │
│                   ▼                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Foreground Web Worker (pyright.worker.js)            │  │
│  │  • PyrightBrowserServer instance                       │  │
│  │  • Handles LSP requests                                │  │
│  │  • Manages background workers                          │  │
│  │  • Virtual file system (TestFileSystem)                │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │                                           │
│                   │ MessageChannel (MessagePort)              │
│                   ▼                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Background Web Workers (multiple)                     │  │
│  │  • BrowserBackgroundAnalysisRunner instances           │  │
│  │  • Perform type analysis                               │  │
│  │  • Run in parallel for performance                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘

ALL EXECUTION HAPPENS IN THE BROWSER - NO SERVER REQUIRED
```

## How It Works

### 1. Browser Build Process

The browser build uses Webpack to bundle Pyright for browser execution:

**Key Configuration (from webpack.config.js):**

```javascript
{
    entry: {
        pyright: './src/worker.ts',
    },
    resolve: {
        fallback: {
            // Browser polyfills for Node.js modules
            buffer: require.resolve('buffer/'),
            path: require.resolve('path-browserify'),
            stream: false,
            fs: false,  // File system is virtualized
            os: false,
            crypto: false,  // Uses browser crypto
        }
    },
    plugins: [
        new DefinePlugin({
            // Mock Node.js process object
            process: "{ env: {}, execArgv: [], cwd: () => '/', memoryUsage: () => ({heapUsed: 0, rss: 1}) }",
        }),
        // Bundle typeshed stubs as JSON
        new VirtualModulesPlugin({
            'node_modules/typeshed-json': /* bundled stubs */
        })
    ]
}
```

**Key Points:**
- TypeScript compiled to JavaScript (NOT WebAssembly)
- Node.js modules replaced with browser-compatible polyfills
- Virtual file system instead of real fs
- Typeshed stubs bundled into the JavaScript

### 2. Worker-Based Architecture

**Foreground Worker (Main LSP Server):**

```typescript
// From browser-pyright/src/worker.ts
const foreground = new Worker(workerScript, {
    name: 'Pyright-foreground',
    type: 'classic'
});

// Boot the foreground worker
foreground.postMessage({
    type: "browser/boot",
    mode: "foreground",
});

// Create LSP connection using browser message readers/writers
const connection = createMessageConnection(
    new BrowserMessageReader(foreground),
    new BrowserMessageWriter(foreground)
);
```

**Background Workers (Analysis):**

```typescript
// Foreground worker spawns background workers via MessageChannel
foreground.addEventListener("message", (e: MessageEvent) => {
    if (e.data.type === "browser/newWorker") {
        const { initialData, port } = e.data;
        const background = new Worker(workerScript, {
            name: `Pyright-background-${++backgroundWorkerCount}`,
        });
        
        background.postMessage({
            type: "browser/boot",
            mode: "background",
            initialData,
            port,
        }, [port]);
    }
});
```

### 3. LSP Server Implementation

**PyrightBrowserServer Class:**

```typescript
// From browser-pyright/src/browser-server.ts
export class PyrightBrowserServer extends RealLanguageServer {
    constructor(connection: Connection) {
        // Use TestFileSystem (virtual file system) instead of real fs
        const testFileSystem = new TestFileSystem(false, {
            cwd: normalizeSlashes('/'),
        });
        
        super(
            connection, 
            0, 
            testFileSystem, 
            new DefaultCancellationProvider(), 
            testFileSystem, 
            nullFileWatcherHandler
        );
    }

    protected override initialize(
        params: InitializeParams,
        supportedCommands: string[],
        supportedCodeActions: string[]
    ): Promise<InitializeResult> {
        const { files } = params.initializationOptions;
        
        const initialFiles = {
            // Virtual module with typeshed stubs
            ...require('typeshed-json'),
            // User's Python files passed during initialization
            ...files,
        };
        
        // Load files into virtual file system
        (this.serverOptions.serviceProvider.fs() as TestFileSystem)
            .apply(initialFiles);
        
        return super.initialize(params, supportedCommands, supportedCodeActions);
    }
}
```

### 4. Virtual File System

The browser implementation uses `TestFileSystem` which:
- Stores files in memory (JavaScript objects)
- Provides standard fs-like API
- No disk I/O required
- Files passed during LSP initialization

```typescript
// Files loaded into memory
const initialFiles = {
    '/typeshed/...': '...',  // Bundled typeshed stubs
    '/src/Untitled.py': 'def foo() -> int: return "wrong"',
    '/src/pyrightconfig.json': '{"typeCheckingMode": "strict"}'
};
```

## Implementation Example

### Complete Browser Integration (from basedpyright-playground)

**1. Loading the Worker from CDN:**

```typescript
// From basedpyright-playground/client/LspClient.ts

const packageName = 'browser-basedpyright';
const pyrightVersion = '1.27.1';  // Or fetch latest dynamically

const workerScript = 
    `https://cdn.jsdelivr.net/npm/${packageName}@${pyrightVersion}/dist/pyright.worker.js`;

const foreground = new Worker(workerScript, {
    name: 'Pyright-foreground',
    type: 'classic'
});
```

**2. Initializing the LSP Connection:**

```typescript
// Boot the worker
foreground.postMessage({
    type: "browser/boot",
    mode: "foreground",
});

// Create LSP connection
const connection = createMessageConnection(
    new BrowserMessageReader(foreground),
    new BrowserMessageWriter(foreground)
);

connection.listen();
```

**3. LSP Initialize Request:**

```typescript
const rootPath = '/src/';
const fileName = 'Untitled.py';
const documentUri = `file://${rootPath}${fileName}`;

const init: InitializeParams = {
    rootUri: `file://${rootPath}`,
    rootPath,
    processId: 1,
    capabilities: {
        textDocument: {
            publishDiagnostics: {
                tagSupport: {
                    valueSet: [DiagnosticTag.Unnecessary, DiagnosticTag.Deprecated],
                },
                versionSupport: true,
            },
            hover: {
                contentFormat: ['markdown', 'plaintext'],
            },
            signatureHelp: {},
        }
    },
    initializationOptions: {
        files: {
            [rootPath + fileName]: userCodeText,
            [rootPath + 'pyrightconfig.json']: JSON.stringify({
                typeshedPath: '/typeshed',
                pythonVersion: '3.12',
                typeCheckingMode: 'strict'
            })
        }
    }
};

await connection.sendRequest(InitializeRequest.type, init);
```

**4. Receiving Diagnostics:**

```typescript
connection.onNotification(
    new NotificationType<PublishDiagnosticsParams>('textDocument/publishDiagnostics'),
    (diagInfo) => {
        console.log('Diagnostics:', diagInfo.diagnostics);
        // Display errors/warnings in UI
    }
);
```

**5. Updating Code:**

```typescript
// When user types new code
async function updateCode(newCode: string) {
    documentVersion++;
    
    await connection.sendNotification(
        new NotificationType<DidChangeTextDocumentParams>('textDocument/didChange'),
        {
            textDocument: {
                uri: documentUri,
                version: documentVersion,
            },
            contentChanges: [{
                text: newCode,
            }],
        }
    );
}
```

**6. Requesting Hover Information:**

```typescript
async function getHoverInfo(position: Position): Promise<Hover | null> {
    const params: HoverParams = {
        textDocument: { uri: documentUri },
        position,
    };
    
    return await connection.sendRequest(HoverRequest.type, params);
}
```

**7. Requesting Completions:**

```typescript
async function getCompletions(position: Position): Promise<CompletionList | null> {
    const params: CompletionParams = {
        textDocument: { uri: documentUri },
        position,
    };
    
    return await connection.sendRequest(CompletionRequest.type, params);
}
```

## Live Implementation

### BasedPyright Playground

**URL:** https://basedpyright.com/  
**Repository:** https://github.com/DetachHead/basedpyright-playground

This is a fully functional implementation showing:
- Loading `browser-basedpyright` from CDN
- Complete LSP integration
- Monaco Editor for UI
- Full type checking in browser
- No server component

### Comparison with Original Research

| Feature | Pyright-Playground | python-language-server | BasedPyright Browser |
|---------|-------------------|----------------------|---------------------|
| **Execution Location** | Server (Node.js) | Server (Node.js) | Browser (Web Workers) |
| **Architecture** | HTTP REST + Express | WebSocket + Bridge | In-browser LSP |
| **LSP Communication** | Server-side | Server-side | Browser-side |
| **File System** | Real (server) | Real (server) | Virtual (memory) |
| **Process Model** | Node child processes | Node child process | Web Workers |
| **Deployment** | Cloud server | Standalone server | Static files/CDN |
| **Privacy** | Code on server | Code on server | Code in browser only |
| **Offline** | ❌ No | ✅ With local server | ✅ Yes (after load) |
| **Dependencies** | Node.js server | Bundled Node.js | Browser only |
| **Latency** | Network + compute | Local compute | Browser compute |
| **Technology** | Standard Pyright | Standard Pyright | Browser-adapted build |

## Technical Details

### Package Dependencies (from package.json)

```json
{
  "name": "browser-basedpyright",
  "dependencies": {
    "buffer": "^6.0.3",
    "crypto-browserify": "^3.12.0",
    "os-browserify": "^0.3.0",
    "path-browserify": "^1.0.1",
    "stream-browserify": "^3.0.0",
    "util": "^0.12.5",
    "vm-browserify": "^1.1.2",
    "vscode-languageserver": "^10.0.0-next.10"
  }
}
```

**Key Points:**
- Browser polyfills for Node.js APIs
- Full `vscode-languageserver` for LSP support
- No WebAssembly - pure JavaScript

### Build Output

**Generated Files:**
- `pyright.worker.js` - Main worker bundle
- `pyright.worker.js.map` - Source maps

**Size:** ~2-3 MB bundled (includes typeshed stubs)

**Distribution:**
```
https://cdn.jsdelivr.net/npm/browser-basedpyright@1.27.1/dist/pyright.worker.js
```

## Advantages of Browser Implementation

### 1. Privacy
- User's code never leaves the browser
- No server-side storage or logging
- Compliant with strict privacy requirements

### 2. Scalability
- No server resources needed
- Scales to unlimited users
- Zero hosting costs for compute

### 3. Offline Capability
- Works completely offline after initial load
- No network dependency for type checking
- Great for air-gapped environments

### 4. Simplicity
- No server infrastructure to maintain
- Just serve static files
- Can use free CDN (jsdelivr, unpkg)

### 5. Performance
- No network latency for LSP requests
- Type checking happens locally
- Instant feedback to users

## Limitations

### 1. Initial Load Time
- Must download ~2-3 MB worker bundle
- Typeshed stubs included in bundle
- Mitigated by CDN caching

### 2. Browser Resource Usage
- Memory for virtual file system
- CPU for type analysis
- May be slower on low-end devices

### 3. Limited File System Access
- Cannot read local Python files directly
- Must copy/paste or upload code
- No access to installed packages (except typeshed)

### 4. Feature Parity
- Some features may be limited vs server version
- File watching doesn't apply
- No access to local Python environment

### 5. Browser Compatibility
- Requires modern browser with Web Workers
- ES6+ JavaScript features
- May not work in older browsers

## Comparison with WebAssembly

### Browser-BasedPyright Does NOT Use WASM

Despite initial assumptions, browser-basedpyright:
- ✅ Uses JavaScript bundles (Webpack + TypeScript transpilation)
- ❌ Does NOT use WebAssembly
- ✅ Uses browser polyfills for Node.js APIs
- ✅ Implements LSP server in JavaScript/TypeScript

### Why Not WASM?

1. **TypeScript/JavaScript Nature:**
   - Pyright is written in TypeScript
   - Transpiles naturally to JavaScript
   - No need for WASM compilation

2. **LSP Protocol:**
   - LSP already uses JSON-RPC
   - Easy to implement in JavaScript
   - Natural fit for browser environment

3. **Performance:**
   - Modern JavaScript engines (V8, SpiderMonkey) are fast
   - JIT compilation provides good performance
   - Web Workers provide parallelism

4. **Size:**
   - JavaScript bundles are smaller than WASM
   - Easier to optimize and tree-shake
   - Better compression

## Integration Guide for Other Projects

### Step 1: Install or Load from CDN

**Option A: NPM (for build process):**
```bash
npm install browser-basedpyright
```

**Option B: CDN (for direct browser use):**
```html
<script type="module">
  const workerUrl = 'https://cdn.jsdelivr.net/npm/browser-basedpyright@latest/dist/pyright.worker.js';
  const worker = new Worker(workerUrl);
  // ... initialize worker
</script>
```

### Step 2: Initialize Workers

```typescript
import { 
    BrowserMessageReader, 
    BrowserMessageWriter,
    createMessageConnection 
} from 'vscode-languageserver-protocol/browser';

// Create foreground worker
const foreground = new Worker(workerUrl, { name: 'Pyright-foreground' });
foreground.postMessage({ type: "browser/boot", mode: "foreground" });

// Setup background worker spawning
foreground.addEventListener("message", (e) => {
    if (e.data.type === "browser/newWorker") {
        const background = new Worker(workerUrl, { 
            name: `Pyright-background-${Date.now()}` 
        });
        background.postMessage({
            type: "browser/boot",
            mode: "background",
            initialData: e.data.initialData,
            port: e.data.port,
        }, [e.data.port]);
    }
});

// Create LSP connection
const connection = createMessageConnection(
    new BrowserMessageReader(foreground),
    new BrowserMessageWriter(foreground)
);
connection.listen();
```

### Step 3: Initialize LSP Server

```typescript
const initParams = {
    rootUri: 'file:///src/',
    rootPath: '/src/',
    processId: 1,
    capabilities: { /* LSP capabilities */ },
    initializationOptions: {
        files: {
            '/src/main.py': '# Your Python code',
            '/src/pyrightconfig.json': JSON.stringify({
                typeshedPath: '/typeshed',
                pythonVersion: '3.12',
                typeCheckingMode: 'basic'
            })
        }
    }
};

await connection.sendRequest('initialize', initParams);
await connection.sendNotification('initialized', {});
```

### Step 4: Use LSP Features

```typescript
// Open document
await connection.sendNotification('textDocument/didOpen', {
    textDocument: {
        uri: 'file:///src/main.py',
        languageId: 'python',
        version: 1,
        text: pythonCode
    }
});

// Listen for diagnostics
connection.onNotification('textDocument/publishDiagnostics', (params) => {
    console.log('Diagnostics:', params.diagnostics);
});

// Request hover info
const hover = await connection.sendRequest('textDocument/hover', {
    textDocument: { uri: 'file:///src/main.py' },
    position: { line: 0, character: 5 }
});

// Request completions
const completions = await connection.sendRequest('textDocument/completion', {
    textDocument: { uri: 'file:///src/main.py' },
    position: { line: 0, character: 5 }
});
```

## Conclusion

**YES, basedpyright has a true browser-native implementation:**

1. **Package:** `browser-basedpyright` on npm
2. **Technology:** JavaScript bundles (NOT WebAssembly)
3. **Architecture:** Web Workers + LSP
4. **File System:** Virtual (in-memory TestFileSystem)
5. **LSP Server:** Complete implementation in browser
6. **Live Example:** https://basedpyright.com/
7. **Source Code:** https://github.com/DetachHead/basedpyright/tree/main/packages/browser-pyright

This is fundamentally different from pyright-playground, which runs Pyright on a Node.js server. BasedPyright's browser edition runs entirely in the browser with no server component, making it a true client-side type checking solution.

## References

1. **BasedPyright Browser Package:** https://github.com/DetachHead/basedpyright/tree/main/packages/browser-pyright
2. **BasedPyright Playground:** https://github.com/DetachHead/basedpyright-playground
3. **Live Demo:** https://basedpyright.com/
4. **NPM Package:** https://www.npmjs.com/package/browser-basedpyright
5. **Original Fork Credit:** Adapted from microbit-foundation pyright fork
6. **VSCode LSP Browser:** https://github.com/microsoft/vscode-languageserver-node/tree/main/jsonrpc/browser

## Related Files in This Research

- [RESEARCH.md](./RESEARCH.md) - Analysis of pyright-playground (server-based)
- [RESEARCH_SUMMARY.md](./RESEARCH_SUMMARY.md) - Quick comparison guide
- [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) - Visual architecture diagrams
