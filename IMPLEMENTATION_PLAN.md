# Implementation Plan: Dual LSP Demo with MicroPython Stub Port Selection

## Overview

This plan outlines the implementation of two demo applications showcasing both server-based and browser-based Pyright LSP implementations, with support for switching between different MicroPython stub packages (RP2, ESP32, STM32, Unix, WebAssembly).

## Requirements

1. **Two Demo Implementations:**
   - Demo 1: Current client-server (WebSocket) + pyright
   - Demo 2: Browser-native (Web Workers) + browser-basedpyright

2. **MicroPython Stub Port Selection:**
   - Support 5 ports: RP2, ESP32, STM32, Unix, WebAssembly
   - Dropdown selector in UI
   - Stubs provided as JSON files
   - Dynamic stub loading

3. **Code Quality:**
   - DRY principles (Don't Repeat Yourself)
   - Shared components between demos
   - Minimal duplication

## Architecture

### Directory Structure

```
python-language-server/
├── demos/
│   ├── shared/                    # Shared components
│   │   ├── editor/
│   │   │   ├── CodeMirrorEditor.ts   # CodeMirror editor wrapper
│   │   │   └── DiagnosticsPanel.ts
│   │   ├── stubs/
│   │   │   ├── StubManager.ts     # Stub loading logic
│   │   │   └── StubSelector.tsx   # Port selector dropdown
│   │   └── ui/
│   │       ├── Layout.tsx         # Common layout
│   │       └── styles.css
│   ├── server-demo/               # Demo 1: WebSocket + Server
│   │   ├── index.html
│   │   ├── client.ts              # WebSocket LSP client
│   │   └── package.json
│   ├── browser-demo/              # Demo 2: Web Workers + Browser
│   │   ├── index.html
│   │   ├── client.ts              # Browser LSP client
│   │   └── package.json
│   └── stubs-data/                # MicroPython stub packages
│       ├── rp2.json
│       ├── esp32.json
│       ├── stm32.json
│       ├── unix.json
│       └── webassembly.json
├── scripts/
│   └── generate-stub-bundles.js   # Generate JSON from .pyi files
└── package.json                    # Root package.json
```

## Implementation Phases

### Phase 1: Stub Bundle Generation (Priority: High)

**Goal:** Create JSON bundles for each MicroPython port

**Tasks:**
1. Create `scripts/generate-stub-bundles.js`
   - Download MicroPython stub packages for each port
   - Parse .pyi files into JSON format
   - Generate `demos/stubs-data/{port}.json`

2. JSON Structure:
```typescript
{
  "port": "esp32",
  "version": "1.26.0",
  "files": {
    "/stubs/machine.pyi": "content...",
    "/stubs/esp32.pyi": "content...",
    // ... all stub files
  },
  "metadata": {
    "description": "MicroPython ESP32 stubs",
    "moduleCount": 69,
    "sizeKB": 250
  }
}
```

**Deliverables:**
- `scripts/generate-stub-bundles.js`
- 5 JSON files in `demos/stubs-data/`

### Phase 2: Shared Components (Priority: High)

**Goal:** Create reusable components for both demos

**Tasks:**
1. Create `demos/shared/editor/CodeMirrorEditor.ts`
   - Initialize CodeMirror 6 editor
   - Configure Python language
   - Handle code changes
   - Display diagnostics

2. Create `demos/shared/stubs/StubManager.ts`
   - Load stub JSON files
   - Parse and cache stubs
   - Provide stub data to LSP clients

3. Create `demos/shared/stubs/StubSelector.tsx`
   - Dropdown UI component
   - Port selection logic
   - Emit selection events

4. Create `demos/shared/ui/Layout.tsx`
   - Common page layout
   - Header with port selector
   - Editor area
   - Problems panel

**Deliverables:**
- Shared TypeScript/React components
- Common CSS styles
- Type definitions

### Phase 3: Server-Based Demo (Priority: Medium)

**Goal:** Implement Demo 1 with existing WebSocket architecture

**Tasks:**
1. Create `demos/server-demo/index.html`
   - HTML page with CodeMirror editor
   - Port selector dropdown
   - Problems panel

2. Create `demos/server-demo/client.ts`
   - WebSocket LSP client
   - Connect to existing pyright-bridge server
   - Send stub files to server (if supported)
   - Handle diagnostics

3. Modify `pyright-bridge.ts` (if needed)
   - Support dynamic stub loading
   - Accept stubs via WebSocket messages
   - Update pyrightconfig.json dynamically

4. Add build configuration
   - Bundle with webpack/esbuild
   - Development server setup

**Architecture:**
```
Browser (Demo 1)
  ↓ Select Port (e.g., ESP32)
  ↓ Load esp32.json
  ↓ WebSocket Connection
pyright-bridge server
  ↓ Load stubs into file system
  ↓ Update pyrightconfig.json
Pyright LSP (Node.js process)
```

**Deliverables:**
- Working server-based demo
- WebSocket client implementation
- Build configuration

### Phase 4: Browser-Based Demo (Priority: Medium)

**Goal:** Implement Demo 2 with browser-basedpyright

**Tasks:**
1. Create `demos/browser-demo/index.html`
   - HTML page with CodeMirror editor
   - Port selector dropdown
   - Problems panel

2. Create `demos/browser-demo/client.ts`
   - Load browser-basedpyright worker from CDN
   - Initialize LSP connection
   - Load selected stub JSON
   - Pass stubs to initializationOptions

3. Implement stub loading logic
   - Fetch JSON file when port selected
   - Parse and prepare for LSP initialization
   - Update virtual file system

4. Add build configuration
   - Bundle with webpack/esbuild
   - Static file server for testing

**Architecture:**
```
Browser (Demo 2)
  ↓ Select Port (e.g., RP2)
  ↓ Load rp2.json
  ↓ Initialize Worker
Web Worker (browser-basedpyright)
  ↓ Virtual File System
  ↓ Load stubs from JSON
  ↓ Type check in browser
```

**Deliverables:**
- Working browser-based demo
- Browser LSP client implementation
- Build configuration

### Phase 5: Integration & Testing (Priority: Medium)

**Goal:** Test both demos and ensure feature parity

**Tasks:**
1. Create test MicroPython code samples
   - ESP32-specific code
   - RP2-specific code
   - Common MicroPython code

2. Test both demos
   - Verify stub switching works
   - Check diagnostics accuracy
   - Compare performance

3. Documentation
   - README for demos
   - Usage instructions
   - Comparison table

4. Polish UI/UX
   - Loading indicators
   - Error handling
   - Responsive design

**Deliverables:**
- Test cases
- Documentation
- Polished demos

## Detailed Component Specifications

### 1. StubManager (Shared)

```typescript
// demos/shared/stubs/StubManager.ts

export interface StubBundle {
  port: string;
  version: string;
  files: Record<string, string>;
  metadata: {
    description: string;
    moduleCount: number;
    sizeKB: number;
  };
}

export class StubManager {
  private cache: Map<string, StubBundle> = new Map();
  
  async loadStubs(port: string): Promise<StubBundle> {
    if (this.cache.has(port)) {
      return this.cache.get(port)!;
    }
    
    const response = await fetch(`/stubs-data/${port}.json`);
    const bundle: StubBundle = await response.json();
    this.cache.set(port, bundle);
    return bundle;
  }
  
  getAvailablePorts(): string[] {
    return ['rp2', 'esp32', 'stm32', 'unix', 'webassembly'];
  }
}
```

### 2. StubSelector (Shared)

```typescript
// demos/shared/stubs/StubSelector.tsx

interface StubSelectorProps {
  onPortChange: (port: string) => void;
  currentPort: string;
}

export const StubSelector: React.FC<StubSelectorProps> = ({
  onPortChange,
  currentPort
}) => {
  const ports = [
    { value: 'rp2', label: 'Raspberry Pi Pico (RP2)' },
    { value: 'esp32', label: 'ESP32' },
    { value: 'stm32', label: 'STM32' },
    { value: 'unix', label: 'Unix' },
    { value: 'webassembly', label: 'WebAssembly' }
  ];
  
  return (
    <select 
      value={currentPort} 
      onChange={(e) => onPortChange(e.target.value)}
      className="stub-selector"
    >
      {ports.map(port => (
        <option key={port.value} value={port.value}>
          {port.label}
        </option>
      ))}
    </select>
  );
};
```

### 3. CodeMirrorEditor (Shared)

```typescript
// demos/shared/editor/CodeMirrorEditor.ts

import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { linter, Diagnostic } from '@codemirror/lint';
import { Extension } from '@codemirror/state';

export interface EditorDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export class CodeMirrorEditor {
  private view: EditorView;
  private diagnostics: EditorDiagnostic[] = [];
  
  constructor(
    parent: HTMLElement,
    initialCode: string = '',
    onChange?: (code: string) => void
  ) {
    const extensions: Extension[] = [
      basicSetup,
      python(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
      linter(() => this.getLinterDiagnostics())
    ];
    
    this.view = new EditorView({
      doc: initialCode,
      extensions,
      parent
    });
  }
  
  setDiagnostics(diagnostics: EditorDiagnostic[]) {
    this.diagnostics = diagnostics;
    // Trigger linter update
    this.view.dispatch({});
  }
  
  private getLinterDiagnostics(): Diagnostic[] {
    return this.diagnostics.map(diag => ({
      from: this.view.state.doc.line(diag.line + 1).from + diag.column,
      to: this.view.state.doc.line(diag.line + 1).from + diag.column + 1,
      severity: diag.severity,
      message: diag.message
    }));
  }
  
  getValue(): string {
    return this.view.state.doc.toString();
  }
  
  setValue(code: string) {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: code
      }
    });
  }
  
  destroy() {
    this.view.destroy();
  }
}
```

### 4. Server Demo Client

```typescript
// demos/server-demo/client.ts

import { StubManager } from '../shared/stubs/StubManager';
import { CodeMirrorEditor } from '../shared/editor/CodeMirrorEditor';

class ServerLSPClient {
  private ws: WebSocket;
  private stubManager: StubManager;
  
  constructor() {
    this.stubManager = new StubManager();
    this.connect();
  }
  
  private connect() {
    this.ws = new WebSocket('ws://localhost:9011/lsp');
    // ... WebSocket setup
  }
  
  async switchPort(port: string) {
    const stubs = await this.stubManager.loadStubs(port);
    
    // Send stubs to server (custom message)
    this.ws.send(JSON.stringify({
      method: 'pyright/loadStubs',
      params: {
        port,
        stubs: stubs.files
      }
    }));
  }
}
```

### 4. Browser Demo Client

```typescript
// demos/browser-demo/client.ts

import { StubManager } from '../shared/stubs/StubManager';
import { CodeMirrorEditor } from '../shared/editor/CodeMirrorEditor';

class BrowserLSPClient {
  private connection: MessageConnection;
  private stubManager: StubManager;
  
  constructor() {
    this.stubManager = new StubManager();
  }
  
  async initialize(port: string, code: string) {
    const stubs = await this.stubManager.loadStubs(port);
    
    // Load worker
    const workerUrl = 'https://cdn.jsdelivr.net/npm/browser-basedpyright@latest/dist/pyright.worker.js';
    const worker = new Worker(workerUrl);
    
    // Initialize with stubs
    const init: InitializeParams = {
      rootUri: 'file:///src/',
      initializationOptions: {
        files: {
          '/src/main.py': code,
          '/src/pyrightconfig.json': JSON.stringify({
            stubPath: '/stubs',
            pythonVersion: '3.11'
          }),
          ...stubs.files  // Include all stub files
        }
      }
    };
    
    // ... continue initialization
  }
}
```

## Build Configuration

### Root package.json

```json
{
  "name": "python-language-server-demos",
  "scripts": {
    "generate-stubs": "node scripts/generate-stub-bundles.js",
    "build:server-demo": "cd demos/server-demo && npm run build",
    "build:browser-demo": "cd demos/browser-demo && npm run build",
    "build:all": "npm run generate-stubs && npm run build:server-demo && npm run build:browser-demo",
    "dev:server": "cd demos/server-demo && npm run dev",
    "dev:browser": "cd demos/browser-demo && npm run dev"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0",
    "webpack-dev-server": "^4.0.0"
  },
  "dependencies": {
    "codemirror": "^6.0.0",
    "@codemirror/lang-python": "^6.0.0",
    "@codemirror/lint": "^6.0.0",
    "@codemirror/state": "^6.0.0",
    "@codemirror/view": "^6.0.0"
  }
}
```

## DRY Principles Applied

1. **Shared StubManager:** Both demos use same stub loading logic
2. **Shared CodeMirrorEditor:** Editor setup and configuration shared
3. **Shared StubSelector:** UI component reused
4. **Shared Layouts:** Common page structure
5. **Shared Stub Data:** JSON files used by both demos
6. **Shared Types:** TypeScript interfaces for stubs and LSP

## Timeline Estimate

- **Phase 1 (Stub Bundles):** 2-3 hours
- **Phase 2 (Shared Components):** 4-5 hours
- **Phase 3 (Server Demo):** 3-4 hours
- **Phase 4 (Browser Demo):** 3-4 hours
- **Phase 5 (Integration):** 2-3 hours

**Total:** ~14-19 hours

## Technical Considerations

### 1. Stub File Sizes

- Each port: ~200-300 KB uncompressed
- 5 ports total: ~1-1.5 MB
- Lazy loading recommended (load on selection)

### 2. Browser Demo Performance

- Initial load: ~100-200ms per port
- Switching ports: requires LSP reinitialization
- Consider caching worker instances

### 3. Server Demo Limitations

- Current pyright-bridge may not support dynamic stubs
- May require modifications to accept stub updates
- Alternative: restart server with new stubs

### 4. CodeMirror Editor

**Why CodeMirror instead of Monaco:**
- **Size:** ~200KB vs Monaco's ~2MB
- **Modularity:** Install only needed features
- **Extensibility:** Easier to customize and extend
- **Performance:** Faster initialization and lower memory usage
- **Integration:** Better suited for embedded use cases

**Implementation:**
- CDN: https://cdn.jsdelivr.net/npm/codemirror@6/
- Python language support via @codemirror/lang-python
- Diagnostics via @codemirror/lint
- LSP integration via custom extension
- Syntax highlighting and code folding built-in

**CodeMirror 6 Features:**
- Modern architecture with immutable state
- Better mobile support
- Accessibility features
- Customizable themes
- Plugin system for extensions

## Success Criteria

1. ✅ Both demos functional
2. ✅ Port switching works in both
3. ✅ Diagnostics show correct errors for each port
4. ✅ Code completion works with port-specific APIs
5. ✅ Shared components minimize duplication
6. ✅ Clear documentation provided
7. ✅ Good user experience (responsive, clear UI)

## Future Enhancements

- Add more MicroPython ports
- Support custom stub upload
- Add code examples for each port
- Implement stub version selection
- Add performance metrics display
- Support multiple files in editor

## Risk Mitigation

1. **Stub Generation Issues:**
   - Fallback to pre-generated JSON files
   - Manual stub curation if needed

2. **Server Demo Limitations:**
   - Document limitations clearly
   - Provide workarounds or alternative approaches

3. **Browser Performance:**
   - Implement loading indicators
   - Optimize bundle sizes
   - Use service workers for caching

4. **API Changes:**
   - Pin dependency versions
   - Test with specific basedpyright version
   - Document version requirements

## References

- [BASEDPYRIGHT_BROWSER_RESEARCH.md](../BASEDPYRIGHT_BROWSER_RESEARCH.md)
- [CUSTOM_STUBS_GUIDE.md](../CUSTOM_STUBS_GUIDE.md)
- MicroPython Stubs: https://github.com/Josverl/micropython-stubs
- Browser-BasedPyright: https://github.com/DetachHead/basedpyright
