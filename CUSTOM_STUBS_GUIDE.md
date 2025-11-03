# Using Custom Stub Packages with Browser-BasedPyright

## Executive Summary

**YES, browser-basedpyright CAN use custom type-only stub packages** like `micropython-esp32-stubs`. Stub files (.pyi) can be bundled and loaded into the browser's virtual file system during LSP initialization, allowing full type checking for custom modules and hardware-specific APIs.

This guide explains how to integrate custom stub packages (such as MicroPython stubs) with browser-basedpyright for client-side type checking in web applications.

## Understanding Stub Packages

### What Are Type Stubs?

Type stub files (`.pyi`) define the public interface and type information for Python modules. They use Python syntax with type hints but contain no implementation:

```python
# Example from machine.pyi (MicroPython ESP32)
from typing import Optional, Callable

HARD_RESET: int = 2
SLEEP: int = 2

class Pin:
    IN: int
    OUT: int
    
    def __init__(self, id: int, mode: int = -1, pull: int = -1) -> None: ...
    def value(self, x: Optional[int] = None) -> Optional[int]: ...
    def on(self) -> None: ...
    def off(self) -> None: ...
```

### MicroPython-ESP32-Stubs Example

The `micropython-esp32-stubs` package contains type stubs for MicroPython modules specific to ESP32 hardware:

**Package Structure:**
```
micropython-esp32-stubs/
├── machine.pyi          # Hardware control (GPIO, PWM, I2C, etc.)
├── esp32.pyi            # ESP32-specific functions
├── network.pyi          # WiFi, Bluetooth networking
├── micropython.pyi      # MicroPython runtime functions
├── uos.pyi              # OS interface
├── usocket.pyi          # Socket networking
├── utime.pyi            # Time functions
└── ... (69 total stub files)
```

**Installation (for local development):**
```bash
pip install micropython-esp32-stubs
```

## How Browser-BasedPyright Loads Stubs

### Architecture Overview

Browser-basedpyright uses a **virtual file system** (TestFileSystem) that stores files in memory. During LSP initialization, you provide files as a JavaScript object:

```typescript
initializationOptions: {
    files: {
        '/src/main.py': userCodeText,
        '/src/pyrightconfig.json': JSON.stringify(config),
        // Stub files loaded here
        '/typeshed/stdlib/builtins.pyi': builtinsStub,
        '/stubs/machine.pyi': machineStub,
        '/stubs/esp32.pyi': esp32Stub,
        // ... more stubs
    }
}
```

### Default Typeshed Stubs

Browser-basedpyright bundles standard library stubs during build:

```javascript
// From webpack.config.js
new VirtualModulesPlugin({
    'node_modules/typeshed-json': `module.exports = ${JSON.stringify(
        // Reads all .pyi files from docstubs directory
        // and bundles them into the JavaScript
        typeshedFiles
    )}`
})
```

**Result:** ~2-3 MB worker bundle includes Python stdlib stubs.

## Integrating Custom Stubs (MicroPython Example)

### Method 1: Bundle Stubs at Build Time

**Best for:** Static set of stubs that don't change frequently.

#### Step 1: Download Stub Package

```bash
# Download and extract stubs
pip download micropython-esp32-stubs --no-deps
unzip micropython_esp32_stubs-1.26.0.post1-py2.py3-none-any.whl
```

#### Step 2: Create Build Script

```javascript
// scripts/bundle-stubs.js
const fs = require('fs');
const path = require('path');

function bundleStubs(stubsDir) {
    const stubs = {};
    const files = fs.readdirSync(stubsDir);
    
    files.forEach(file => {
        if (file.endsWith('.pyi')) {
            const content = fs.readFileSync(
                path.join(stubsDir, file), 
                'utf8'
            );
            // Map to /stubs/ path in virtual filesystem
            stubs[`/stubs/${file}`] = content;
        }
    });
    
    // Also handle subdirectories (e.g., umqtt/)
    files.forEach(file => {
        const filePath = path.join(stubsDir, file);
        if (fs.statSync(filePath).isDirectory()) {
            const subFiles = fs.readdirSync(filePath);
            subFiles.forEach(subFile => {
                if (subFile.endsWith('.pyi')) {
                    const content = fs.readFileSync(
                        path.join(filePath, subFile),
                        'utf8'
                    );
                    stubs[`/stubs/${file}/${subFile}`] = content;
                }
            });
        }
    });
    
    return stubs;
}

// Generate JSON file
const stubs = bundleStubs('./micropython-stubs');
fs.writeFileSync(
    './src/micropython-stubs.json',
    JSON.stringify(stubs, null, 2)
);

console.log(`Bundled ${Object.keys(stubs).length} stub files`);
```

#### Step 3: Import and Use in LSP Client

```typescript
// Import bundled stubs
import micropythonStubs from './micropython-stubs.json';

// In your LSP initialization
const init: InitializeParams = {
    rootUri: 'file:///src/',
    rootPath: '/src/',
    processId: 1,
    capabilities: { /* ... */ },
    initializationOptions: {
        files: {
            // User code
            '/src/main.py': userCode,
            
            // Pyright configuration
            '/src/pyrightconfig.json': JSON.stringify({
                typeshedPath: '/typeshed',
                stubPath: '/stubs',  // Point to custom stubs
                pythonVersion: '3.11',
                typeCheckingMode: 'basic'
            }),
            
            // Bundle MicroPython stubs
            ...micropythonStubs
        }
    }
};
```

### Method 2: Load Stubs Dynamically from CDN

**Best for:** Flexible stub loading, version selection, or large stub sets.

#### Step 1: Host Stubs on CDN or Server

```
https://yourcdn.com/stubs/micropython-esp32/1.26.0/
├── machine.pyi
├── esp32.pyi
├── network.pyi
└── ...
```

#### Step 2: Fetch and Load Dynamically

```typescript
async function loadMicroPythonStubs(version: string = '1.26.0') {
    const baseUrl = `https://yourcdn.com/stubs/micropython-esp32/${version}`;
    
    // List of stub files to load
    const stubFiles = [
        'machine.pyi',
        'esp32.pyi',
        'network.pyi',
        'micropython.pyi',
        'uos.pyi',
        'utime.pyi',
        'usocket.pyi',
        // ... add all needed stubs
    ];
    
    const stubs: Record<string, string> = {};
    
    // Fetch all stubs in parallel
    await Promise.all(
        stubFiles.map(async (file) => {
            try {
                const response = await fetch(`${baseUrl}/${file}`);
                if (response.ok) {
                    const content = await response.text();
                    stubs[`/stubs/${file}`] = content;
                }
            } catch (err) {
                console.warn(`Failed to load stub: ${file}`, err);
            }
        })
    );
    
    return stubs;
}

// Use in LSP initialization
const micropythonStubs = await loadMicroPythonStubs('1.26.0');

const init: InitializeParams = {
    // ... other params
    initializationOptions: {
        files: {
            '/src/main.py': userCode,
            '/src/pyrightconfig.json': JSON.stringify({
                stubPath: '/stubs',
                pythonVersion: '3.11'
            }),
            ...micropythonStubs
        }
    }
};
```

### Method 3: User Upload

**Best for:** Allowing users to provide their own stub packages.

```typescript
async function handleStubUpload(files: FileList) {
    const stubs: Record<string, string> = {};
    
    for (const file of files) {
        if (file.name.endsWith('.pyi')) {
            const content = await file.text();
            // Preserve directory structure from file path
            const virtualPath = `/stubs/${file.webkitRelativePath || file.name}`;
            stubs[virtualPath] = content;
        }
    }
    
    return stubs;
}

// HTML
<input 
    type="file" 
    webkitdirectory 
    multiple 
    accept=".pyi"
    onChange={async (e) => {
        const stubs = await handleStubUpload(e.target.files);
        // Reinitialize LSP with new stubs
        await reinitializeLSP(stubs);
    }}
/>
```

## Configuration for Custom Stubs

### Pyright Configuration

The `pyrightconfig.json` must specify where to find custom stubs:

```json
{
  "include": ["/src"],
  "stubPath": "/stubs",
  "typeshedPath": "/typeshed",
  "pythonVersion": "3.11",
  "typeCheckingMode": "basic",
  "extraPaths": ["/stubs"]
}
```

**Key Options:**
- `stubPath`: Directory containing custom stub files
- `extraPaths`: Additional import resolution paths
- `typeshedPath`: Location of standard library stubs (bundled by default)

### Import Resolution

With stubs in `/stubs/`, imports resolve as follows:

```python
# User code in /src/main.py
import machine  # Resolves to /stubs/machine.pyi
import esp32    # Resolves to /stubs/esp32.pyi
from machine import Pin  # Types available from machine.pyi

# Standard library (from bundled typeshed)
import sys      # Resolves to /typeshed/stdlib/sys.pyi
import json     # Resolves to /typeshed/stdlib/json.pyi
```

## Complete Implementation Example

### Full LSP Client with MicroPython Stubs

```typescript
import {
    BrowserMessageReader,
    BrowserMessageWriter,
    createMessageConnection,
    InitializeParams
} from 'vscode-languageserver-protocol/browser';
import micropythonStubs from './micropython-stubs.json';

class MicroPythonLSPClient {
    private connection: MessageConnection | undefined;
    private foregroundWorker: Worker | undefined;
    
    async initialize(userCode: string) {
        // Create worker
        const workerUrl = 'https://cdn.jsdelivr.net/npm/browser-basedpyright@latest/dist/pyright.worker.js';
        this.foregroundWorker = new Worker(workerUrl, {
            name: 'Pyright-MicroPython'
        });
        
        // Boot worker
        this.foregroundWorker.postMessage({
            type: 'browser/boot',
            mode: 'foreground'
        });
        
        // Handle background worker requests
        this.foregroundWorker.addEventListener('message', (e) => {
            if (e.data.type === 'browser/newWorker') {
                const bg = new Worker(workerUrl, {
                    name: `Pyright-bg-${Date.now()}`
                });
                bg.postMessage({
                    type: 'browser/boot',
                    mode: 'background',
                    initialData: e.data.initialData,
                    port: e.data.port
                }, [e.data.port]);
            }
        });
        
        // Create connection
        this.connection = createMessageConnection(
            new BrowserMessageReader(this.foregroundWorker),
            new BrowserMessageWriter(this.foregroundWorker)
        );
        
        this.connection.listen();
        
        // Initialize with MicroPython stubs
        const init: InitializeParams = {
            rootUri: 'file:///src/',
            rootPath: '/src/',
            processId: 1,
            capabilities: {
                textDocument: {
                    publishDiagnostics: {
                        versionSupport: true
                    },
                    hover: {
                        contentFormat: ['markdown', 'plaintext']
                    },
                    completion: {}
                }
            },
            initializationOptions: {
                files: {
                    // User's MicroPython code
                    '/src/main.py': userCode,
                    
                    // Configuration
                    '/src/pyrightconfig.json': JSON.stringify({
                        typeshedPath: '/typeshed',
                        stubPath: '/stubs',
                        pythonVersion: '3.11',
                        typeCheckingMode: 'basic',
                        extraPaths: ['/stubs']
                    }),
                    
                    // MicroPython stubs (69 files)
                    ...micropythonStubs
                }
            }
        };
        
        await this.connection.sendRequest('initialize', init);
        await this.connection.sendNotification('initialized', {});
        
        // Open document
        await this.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri: 'file:///src/main.py',
                languageId: 'python',
                version: 1,
                text: userCode
            }
        });
        
        // Listen for diagnostics
        this.connection.onNotification(
            'textDocument/publishDiagnostics',
            (params) => {
                console.log('Diagnostics:', params.diagnostics);
                this.handleDiagnostics(params.diagnostics);
            }
        );
    }
    
    async updateCode(newCode: string, version: number) {
        if (!this.connection) return;
        
        await this.connection.sendNotification('textDocument/didChange', {
            textDocument: {
                uri: 'file:///src/main.py',
                version
            },
            contentChanges: [{ text: newCode }]
        });
    }
    
    async getHover(line: number, character: number) {
        if (!this.connection) return null;
        
        return await this.connection.sendRequest('textDocument/hover', {
            textDocument: { uri: 'file:///src/main.py' },
            position: { line, character }
        });
    }
    
    async getCompletions(line: number, character: number) {
        if (!this.connection) return null;
        
        return await this.connection.sendRequest('textDocument/completion', {
            textDocument: { uri: 'file:///src/main.py' },
            position: { line, character }
        });
    }
    
    private handleDiagnostics(diagnostics: any[]) {
        // Update UI with type errors, warnings, etc.
        diagnostics.forEach(diag => {
            console.log(`Line ${diag.range.start.line}: ${diag.message}`);
        });
    }
}

// Usage
const client = new MicroPythonLSPClient();
await client.initialize(`
from machine import Pin
import esp32

# Type checking now works for MicroPython!
led = Pin(2, Pin.OUT)
led.on()

temp = esp32.raw_temperature()
print(f"Temperature: {temp}")
`);
```

## Practical Considerations

### Bundle Size

**MicroPython-ESP32-Stubs:**
- 69 stub files
- ~120 KB compressed wheel
- ~200-300 KB uncompressed .pyi files
- Minimal impact when added to ~2-3 MB worker bundle

**Optimization Tips:**
1. Only include stubs for modules you use
2. Use dynamic loading for large stub sets
3. Compress stub content before bundling
4. Cache loaded stubs in browser storage

### Performance

**Initial Load:**
- Parsing 69 stub files adds ~100-200ms to initialization
- Acceptable for web applications
- One-time cost per session

**Type Checking:**
- No performance difference once loaded
- Virtual file system is fast (in-memory)
- Background workers provide parallelism

### Stub Discovery

Browser-basedpyright follows standard Pyright import resolution:

1. **Stub packages first:** `/stubs/module.pyi`
2. **Inline stubs:** `/src/module.pyi` next to `/src/module.py`
3. **Source files:** `/src/module.py` (if no stub found)
4. **Typeshed:** `/typeshed/stdlib/module.pyi` for standard library

### Version Compatibility

**Match MicroPython Version:**
```typescript
// Load stubs matching target firmware version
const stubsVersion = '1.26.0';  // Match ESP32 firmware
const stubs = await loadMicroPythonStubs(stubsVersion);
```

**Version-specific APIs:**
- Different MicroPython versions have different APIs
- Stubs must match firmware version
- Consider allowing user to select version

## Stub Package Directory

### Popular Stub Packages

1. **MicroPython Stubs:**
   - `micropython-esp32-stubs` - ESP32
   - `micropython-rp2-stubs` - Raspberry Pi Pico
   - `micropython-stm32-stubs` - STM32
   - Repository: https://github.com/Josverl/micropython-stubs

2. **Standard Stub Packages:**
   - `types-requests` - Requests library
   - `types-redis` - Redis
   - `boto3-stubs` - AWS Boto3
   - Pattern: `types-{package}` or `{package}-stubs`

3. **Custom Hardware:**
   - Create custom stubs for proprietary hardware
   - Follow PEP 561 stub package structure
   - Share via CDN or npm package

### Creating Custom Stubs

**Basic Template:**
```python
# custom_module.pyi
"""Type stubs for custom_module."""

from typing import Optional, List

class CustomDevice:
    """Custom hardware device."""
    
    def __init__(self, id: int) -> None: ...
    def read(self) -> int: ...
    def write(self, value: int) -> None: ...
    def configure(self, options: dict) -> bool: ...

def init_system() -> bool: ...
def get_devices() -> List[CustomDevice]: ...
```

**PEP 561 Package Structure:**
```
custom-module-stubs/
├── setup.py
├── custom_module/
│   ├── __init__.pyi
│   ├── hardware.pyi
│   └── network.pyi
└── py.typed  # Marker file
```

## Troubleshooting

### Stubs Not Found

**Problem:** Import shows "unresolved import" error.

**Solutions:**
1. Verify stub path in pyrightconfig.json
2. Check virtual file system paths match configuration
3. Ensure stub files have `/stubs/` prefix
4. Add to `extraPaths` in config

### Type Information Missing

**Problem:** Types show as "Unknown" or "Any".

**Solutions:**
1. Check stub file syntax (must be valid .pyi)
2. Verify stub file loaded in initializationOptions
3. Ensure stub matches module structure
4. Check for typos in function/class names

### Performance Issues

**Problem:** LSP initialization takes too long.

**Solutions:**
1. Reduce number of stub files
2. Use dynamic loading for large sets
3. Implement lazy loading (load on first import)
4. Cache stubs in localStorage/IndexedDB

### Import Resolution Conflicts

**Problem:** Wrong module version or stubs used.

**Solutions:**
1. Check stub path ordering in config
2. Ensure custom stubs take precedence
3. Use unique paths for different versions
4. Clear and reinitialize if needed

## Comparison: Browser vs Server

| Aspect | Browser-BasedPyright | python-language-server |
|--------|---------------------|----------------------|
| **Stub Loading** | Virtual FS (memory) | Real file system |
| **Bundle Method** | JSON in worker | pip install |
| **Size Impact** | +200-300 KB | No impact (on disk) |
| **Load Time** | Parse at init | Already on disk |
| **Flexibility** | Dynamic/CDN/Upload | File-based only |
| **Updates** | Reload worker | Reinstall package |
| **Offline** | If bundled | If installed |

## Conclusion

Browser-basedpyright **fully supports custom stub packages** like micropython-esp32-stubs through its virtual file system. Stubs can be:

1. **Bundled at build time** - Best for static, known stubs
2. **Loaded from CDN** - Best for flexibility and version selection
3. **User uploaded** - Best for custom/proprietary stubs

The key is providing stub file contents in the `initializationOptions.files` object during LSP initialization, mapped to virtual paths that match your `pyrightconfig.json` configuration.

**Recommended Approach for MicroPython:**
- Bundle common stubs (machine, esp32, network)
- Allow user selection of hardware variant
- Cache loaded stubs in browser storage
- Provide stub version selector matching firmware

## References

1. **MicroPython Stubs:** https://github.com/Josverl/micropython-stubs
2. **PyPI Package:** https://pypi.org/project/micropython-esp32-stubs/
3. **PEP 561 (Type Stubs):** https://www.python.org/dev/peps/pep-0561/
4. **Pyright Type Stubs:** https://github.com/microsoft/pyright/blob/main/docs/type-stubs.md
5. **BasedPyright Docs:** https://docs.basedpyright.com/
6. **Browser Implementation:** [BASEDPYRIGHT_BROWSER_RESEARCH.md](./BASEDPYRIGHT_BROWSER_RESEARCH.md)

## Related Documentation

- [RESEARCH.md](./RESEARCH.md) - Pyright-playground architecture
- [BASEDPYRIGHT_BROWSER_RESEARCH.md](./BASEDPYRIGHT_BROWSER_RESEARCH.md) - Browser implementation
- [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) - Visual comparisons
