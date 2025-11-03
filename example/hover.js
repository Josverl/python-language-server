/**
 * Hover tooltip functionality for CodeMirror with LSP integration
 * Provides type information and documentation on hover
 */

/**
 * Creates a hover tooltip extension for CodeMirror
 * @param {LSPClient} lspClient - The LSP client instance
 * @param {string} documentUri - The URI of the document
 * @returns {Extension} CodeMirror extension for hover tooltips
 */
function createHoverExtension(lspClient, documentUri) {
    return CodeMirror.hoverTooltip(async (view, pos, side) => {
        // Get the position in LSP format (line, character)
        const line = view.state.doc.lineAt(pos);
        const character = pos - line.from;
        const lineNumber = line.number - 1; // LSP uses 0-based line numbers
        
        const position = {
            line: lineNumber,
            character: character
        };
        
        try {
            // Request hover information from LSP server
            const hoverResult = await lspClient.hover(documentUri, position);
            
            if (!hoverResult || !hoverResult.contents) {
                return null;
            }
            
            // Parse the hover contents
            const contents = parseHoverContents(hoverResult.contents);
            
            if (!contents) {
                return null;
            }
            
            // Create tooltip DOM element
            const tooltip = document.createElement('div');
            tooltip.className = 'cm-hover-tooltip';
            
            // Add contents to tooltip
            if (contents.code) {
                const codeBlock = document.createElement('pre');
                codeBlock.className = 'cm-hover-code';
                codeBlock.textContent = contents.code;
                tooltip.appendChild(codeBlock);
            }
            
            if (contents.documentation) {
                const docDiv = document.createElement('div');
                docDiv.className = 'cm-hover-documentation';
                
                // Support markdown formatting
                if (typeof contents.documentation === 'string') {
                    // Simple markdown-to-HTML conversion for basic formatting
                    docDiv.innerHTML = formatMarkdown(contents.documentation);
                } else {
                    docDiv.textContent = contents.documentation;
                }
                
                tooltip.appendChild(docDiv);
            }
            
            return {
                pos: pos,
                end: pos,
                above: true,
                create: () => tooltip
            };
        } catch (error) {
            console.error('Error fetching hover information:', error);
            return null;
        }
    }, {
        // Hover configuration
        hoverTime: 300 // Delay before showing tooltip (ms)
    });
}

/**
 * Parse hover contents from LSP response
 * @param {any} contents - Hover contents from LSP
 * @returns {Object|null} Parsed contents with code and documentation
 */
function parseHoverContents(contents) {
    let code = '';
    let documentation = '';
    
    if (typeof contents === 'string') {
        // Simple string content
        code = contents;
    } else if (Array.isArray(contents)) {
        // Array of marked strings
        for (const item of contents) {
            if (typeof item === 'string') {
                if (!code) {
                    code = item;
                } else {
                    documentation += item + '\n';
                }
            } else if (item.language && item.value) {
                // MarkupContent with language
                code = item.value;
            } else if (item.kind === 'markdown' || item.kind === 'plaintext') {
                // MarkupContent
                documentation = item.value;
            }
        }
    } else if (contents.kind) {
        // Single MarkupContent
        if (contents.kind === 'markdown' || contents.kind === 'plaintext') {
            const parts = contents.value.split('\n\n');
            if (parts.length > 0) {
                // First part is usually the signature
                code = parts[0].replace(/```python\n?/g, '').replace(/```\n?/g, '');
            }
            if (parts.length > 1) {
                // Rest is documentation
                documentation = parts.slice(1).join('\n\n');
            }
        }
    } else if (contents.language && contents.value) {
        // MarkedString with language
        code = contents.value;
    }
    
    if (!code && !documentation) {
        return null;
    }
    
    return { code, documentation };
}

/**
 * Simple markdown formatter for hover tooltips
 * @param {string} markdown - Markdown text
 * @returns {string} HTML string
 */
function formatMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

/**
 * Debounce function to limit hover requests
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
