import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * MCP Connection Test
 * 
 * This test verifies that:
 * 1. The python-language-server starts successfully
 * 2. WebSocket connections can be established on port 9011
 * 3. The LSP bridge responds to initialize requests
 * 4. Firewall settings allow proper communication
 */

interface TestConfig {
    port: number;
    timeout: number;
    botRoot: string;
    jesseRoot: string;
}

class MCPConnectionTest {
    private config: TestConfig;
    private server: ChildProcess | null = null;

    constructor() {
        const testDir = join(process.cwd(), 'tests', 'test-workspace');
        this.config = {
            port: 9011,
            timeout: 10000,
            botRoot: testDir,
            jesseRoot: join(testDir, 'src')
        };
    }

    async setup(): Promise<void> {
        console.log('🔧 Setting up test workspace...');
        
        // Create test workspace
        if (!existsSync(this.config.botRoot)) {
            mkdirSync(this.config.botRoot, { recursive: true });
        }
        if (!existsSync(this.config.jesseRoot)) {
            mkdirSync(this.config.jesseRoot, { recursive: true });
        }

        // Create a simple Python file for testing
        const testPyFile = join(this.config.jesseRoot, 'test_strategy.py');
        writeFileSync(testPyFile, `
def calculate_sum(a: int, b: int) -> int:
    """Calculate the sum of two numbers."""
    return a + b

class Strategy:
    def should_long(self) -> bool:
        return True
`);

        console.log('✅ Test workspace created');
    }

    async startServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('🚀 Starting python-language-server...');
            
            const args = [
                'index.ts',
                '--port', this.config.port.toString(),
                '--bot-root', this.config.botRoot,
                '--jesse-root', this.config.jesseRoot
            ];

            this.server = spawn('npx', ['tsx', ...args], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            const timeout = setTimeout(() => {
                reject(new Error('Server startup timeout'));
            }, this.config.timeout);

            this.server.stdout?.on('data', (data) => {
                output += data.toString();
                console.log(`[SERVER] ${data.toString().trim()}`);
                
                if (output.includes('Pyright WS bridge running')) {
                    clearTimeout(timeout);
                    console.log('✅ Server started successfully');
                    setTimeout(resolve, 1000); // Give it a moment to fully initialize
                }
            });

            this.server.stderr?.on('data', (data) => {
                console.error(`[SERVER ERROR] ${data.toString().trim()}`);
            });

            this.server.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            this.server.on('exit', (code) => {
                if (code !== 0 && code !== null) {
                    clearTimeout(timeout);
                    reject(new Error(`Server exited with code ${code}`));
                }
            });
        });
    }

    async testWebSocketConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('🔌 Testing WebSocket connection...');
            
            const ws = new WebSocket(`ws://localhost:${this.config.port}/lsp`);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }, this.config.timeout);

            ws.on('open', () => {
                clearTimeout(timeout);
                console.log('✅ WebSocket connection established');
                ws.close();
                resolve();
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket connection failed: ${err.message}`));
            });
        });
    }

    async testLSPInitialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('📡 Testing LSP initialize request...');
            
            const ws = new WebSocket(`ws://localhost:${this.config.port}/lsp`);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('LSP initialize timeout'));
            }, this.config.timeout);

            let messageReceived = false;

            ws.on('open', () => {
                const initRequest = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        processId: process.pid,
                        clientInfo: {
                            name: 'mcp-test-client',
                            version: '1.0.0'
                        },
                        capabilities: {}
                    }
                };

                ws.send(JSON.stringify(initRequest));
            });

            ws.on('message', (data) => {
                messageReceived = true;
                const response = JSON.parse(data.toString());
                console.log('📨 Received LSP response:', JSON.stringify(response).substring(0, 200));
                
                if (response.id === 1 && response.result) {
                    clearTimeout(timeout);
                    console.log('✅ LSP initialize successful');
                    ws.close();
                    resolve();
                } else if (response.error) {
                    clearTimeout(timeout);
                    reject(new Error(`LSP initialize error: ${response.error.message}`));
                    ws.close();
                }
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`LSP connection failed: ${err.message}`));
            });

            ws.on('close', () => {
                if (!messageReceived) {
                    clearTimeout(timeout);
                    reject(new Error('WebSocket closed before receiving response'));
                }
            });
        });
    }

    async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up...');
        
        if (this.server) {
            this.server.kill('SIGTERM');
            
            // Give it time to shut down gracefully
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (this.server.exitCode === null) {
                this.server.kill('SIGKILL');
            }
        }
        
        console.log('✅ Cleanup complete');
    }

    async run(): Promise<void> {
        let success = false;
        
        try {
            await this.setup();
            await this.startServer();
            await this.testWebSocketConnection();
            await this.testLSPInitialize();
            
            success = true;
            console.log('\n✅ All tests passed! Firewall settings are working correctly.');
        } catch (error) {
            console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
            await this.cleanup();
            process.exit(success ? 0 : 1);
        }
    }
}

// Run the test
const test = new MCPConnectionTest();
test.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
