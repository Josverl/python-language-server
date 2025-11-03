/**
 * LSP Client for WebSocket connection to Pyright bridge
 * Handles initialization, document synchronization, and LSP requests
 */

class LSPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.isInitialized = false;
        this.serverCapabilities = null;
        this.openDocuments = new Map();
        this.onDiagnostics = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.initialize().then(() => {
                    console.log('LSP initialized');
                    resolve();
                }).catch(reject);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
            };
        });
    }

    handleMessage(message) {
        console.log('Received message:', message);
        
        // Handle responses to requests
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            
            if (message.error) {
                reject(message.error);
            } else {
                resolve(message.result);
            }
        }
        
        // Handle notifications from server
        if (message.method === 'textDocument/publishDiagnostics') {
            if (this.onDiagnostics) {
                this.onDiagnostics(message.params);
            }
        }
    }

    sendRequest(method, params) {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };
            
            this.pendingRequests.set(id, { resolve, reject });
            this.ws.send(JSON.stringify(message));
            console.log('Sent request:', message);
        });
    }

    sendNotification(method, params) {
        const message = {
            jsonrpc: '2.0',
            method,
            params
        };
        
        this.ws.send(JSON.stringify(message));
        console.log('Sent notification:', message);
    }

    async initialize() {
        const result = await this.sendRequest('initialize', {
            processId: null,
            clientInfo: {
                name: 'CodeMirror LSP Client',
                version: '1.0.0'
            },
            capabilities: {
                textDocument: {
                    hover: {
                        dynamicRegistration: false,
                        contentFormat: ['markdown', 'plaintext']
                    },
                    synchronization: {
                        dynamicRegistration: false,
                        willSave: false,
                        willSaveWaitUntil: false,
                        didSave: false
                    },
                    completion: {
                        dynamicRegistration: false,
                        completionItem: {
                            snippetSupport: false
                        }
                    }
                }
            }
        });
        
        this.serverCapabilities = result.capabilities;
        this.isInitialized = true;
        
        // Send initialized notification
        this.sendNotification('initialized', {});
        
        return result;
    }

    openDocument(uri, languageId, version, text) {
        this.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId,
                version,
                text
            }
        });
        
        this.openDocuments.set(uri, { version, text });
    }

    changeDocument(uri, version, changes) {
        this.sendNotification('textDocument/didChange', {
            textDocument: {
                uri,
                version
            },
            contentChanges: changes
        });
        
        const doc = this.openDocuments.get(uri);
        if (doc) {
            doc.version = version;
        }
    }

    closeDocument(uri) {
        this.sendNotification('textDocument/didClose', {
            textDocument: { uri }
        });
        
        this.openDocuments.delete(uri);
    }

    async hover(uri, position) {
        if (!this.isInitialized) {
            throw new Error('LSP client not initialized');
        }
        
        return await this.sendRequest('textDocument/hover', {
            textDocument: { uri },
            position
        });
    }

    async completion(uri, position) {
        if (!this.isInitialized) {
            throw new Error('LSP client not initialized');
        }
        
        return await this.sendRequest('textDocument/completion', {
            textDocument: { uri },
            position
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
