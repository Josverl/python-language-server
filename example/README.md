# CodeMirror with Pyright LSP - Hover Tooltips Example

This example demonstrates how to integrate the Pyright WebSocket bridge with CodeMirror 6 to provide hover tooltips with Python type information and documentation.

## Features

- ✅ **Real-time Type Information**: Hover over Python code to see type annotations
- ✅ **Function Signatures**: View function parameters and return types
- ✅ **Docstring Display**: Read documentation directly in tooltips
- ✅ **Readable Tooltips**: Enhanced styling with proper opacity and contrast
- ✅ **WebSocket LSP Connection**: Full Language Server Protocol integration
- ✅ **Live Document Sync**: Changes are sent to the LSP server in real-time

## Project Structure

```
example/
├── index.html      # Main demo page with CodeMirror editor
├── client.js       # LSP client WebSocket connection handler
├── hover.js        # Hover tooltip implementation for CodeMirror
├── styles.css      # Styling for editor and tooltips
└── README.md       # This file
```

## How It Works

### Architecture

```
Browser (CodeMirror) ←→ client.js ←→ WebSocket ←→ Pyright Bridge ←→ Pyright LSP
```

1. **client.js**: Manages the WebSocket connection and LSP protocol
   - Handles initialization handshake
   - Sends document open/change/close notifications
   - Manages request/response pairs for hover and other features

2. **hover.js**: Implements hover tooltip functionality
   - Creates CodeMirror hover extension
   - Converts editor positions to LSP format
   - Parses and displays hover information with proper formatting

3. **styles.css**: Provides styling for readability
   - Fixed opacity to make tooltips clearly visible
   - Proper contrast for code and documentation
   - Responsive layout for the demo page

## Usage

### Prerequisites

1. **Start the Pyright WebSocket Bridge**:
   ```bash
   cd /path/to/python-language-server
   npm start -- --port 9011 --bot-root /path/to/project --jesse-root /path/to/project/src
   ```

2. **Serve the example files** (required for browser module imports):
   ```bash
   # From the example directory
   python3 -m http.server 8000
   # or
   npx serve
   ```

### Running the Demo

1. Open your browser to `http://localhost:8000/index.html`
2. Click "Connect to LSP Server"
3. Hover over Python code elements to see type information
4. Try editing the code and see live type checking

### What to Try

- **Hover over function names**: See the function signature and docstring
- **Hover over variables**: View inferred or annotated types
- **Hover over imports**: Get module information
- **Hover over class names**: See class documentation
- **Edit the code**: Watch diagnostics update in real-time

## Implementation Details

### LSP Client (`client.js`)

The `LSPClient` class handles:
- WebSocket connection management
- LSP protocol message encoding/decoding
- Request/response correlation using message IDs
- Document lifecycle (open, change, close)
- Hover and completion requests

Key methods:
```javascript
connect()                          // Establish WebSocket connection
initialize()                       // LSP initialize handshake
openDocument(uri, languageId, version, text)
changeDocument(uri, version, changes)
hover(uri, position)              // Request hover information
```

### Hover Extension (`hover.js`)

The hover extension:
- Integrates with CodeMirror's tooltip system
- Converts editor positions to LSP line/character format
- Requests hover information from the LSP server
- Parses various LSP hover response formats
- Renders formatted tooltips with code and documentation

Key functions:
```javascript
createHoverExtension(lspClient, documentUri)
parseHoverContents(contents)      // Parse LSP hover response
formatMarkdown(markdown)          // Convert markdown to HTML
```

### Styling Improvements (`styles.css`)

The styling addresses the transparency issue mentioned in the problem statement:
```css
.cm-tooltip.cm-hover-tooltip {
    opacity: 1 !important;        /* Fix transparency */
    background-color: #ffffff;    /* Solid white background */
    border: 1px solid #d1d5db;    /* Clear border */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* Depth */
}
```

## Troubleshooting

### Connection Fails

- Ensure the Pyright bridge is running: `npm start -- --port 9011`
- Check that the WebSocket URL is correct: `ws://localhost:9011/lsp`
- Verify no CORS or firewall issues

### No Hover Information

- Check browser console for errors
- Verify the Python code is valid
- Ensure the document is opened with the LSP server
- Check that the Pyright bridge has correct project configuration

### Tooltips Not Visible

- Ensure `styles.css` is loaded
- Check that `opacity: 1 !important` is applied
- Verify no CSS conflicts with other stylesheets

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (Safari 16+)

Requires ES6 module support for CodeMirror 6 imports.

## Extension Ideas

- Add completion (autocomplete) support
- Show diagnostics (errors/warnings) inline
- Add go-to-definition functionality
- Implement find references
- Add code actions (quick fixes)
- Support multiple open files

## License

This example is part of the python-language-server project.
