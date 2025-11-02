import { spawn } from 'child_process'
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path, { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js'
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
import { WebSocketServer } from 'ws'

// Get the directory where bundle.js is located (not cwd)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse command-line arguments
function parseArgs() {
    const args = process.argv.slice(2)
    const parsed: Record<string, string> = {}

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2)
            const value = args[i + 1]
            if (value && !value.startsWith('--')) {
                parsed[key] = value
                i++
            }
        }
    }

    return parsed
}

// Production-ready configuration
// Usage: node index.js --port <PORT> --bot-root <BOT_ROOT> --jesse-root <JESSE_ROOT>
// Example: node index.js --port 9011 --bot-root /home/king/jesse/jesse-ai --jesse-root /home/king/jesse/jesse-ai/jesse

interface BridgeConfig {
    port: number
    botRoot: string
    jesseRoot: string
    pyrightPath: string
}

function loadConfig(): BridgeConfig {
    const args = parseArgs()

    return {
        port: Number(args['port']),
        botRoot: args['bot-root'],
        jesseRoot: args['jesse-root'],
        pyrightPath: join(__dirname, 'node_modules/pyright/dist/pyright-langserver.js')
    }
}

function validateConfig(config: BridgeConfig): void {
    if (!config.port || !config.botRoot || !config.jesseRoot) {
        console.error('Error: --port and --bot-root and --jesse-root are required')
        console.error('Usage: npx tsx index.ts --port <PORT> --bot-root <BOT_ROOT> --jesse-root <JESSE_ROOT>')
        process.exit(1)
    }
}

// Deploy pyrightconfig.json to the workspace on startup
function deployPyrightConfig(config: BridgeConfig): void {
    const templatePath = join(__dirname, 'pyrightconfig.json')
    const targetPath = join(config.botRoot, 'pyrightconfig.json')

    if (!existsSync(templatePath)) {
        console.warn(`Warning: No pyrightconfig.json template found at ${templatePath}`)
        return
    }

    // Read template and replace variables with normalized paths
    let configContent = readFileSync(templatePath, 'utf-8')

    // Normalize paths to use forward slashes for cross-platform compatibility
    // Pyright expects forward slashes even on Windows
    const normalizePathForPyright = (p: string) => p.replace(/\\/g, '/')

    configContent = configContent.replace(/\$\{BOT_ROOT\}/g, normalizePathForPyright(config.botRoot))
    configContent = configContent.replace(/\$\{JESSE_ROOT\}/g, normalizePathForPyright(config.jesseRoot || ''))

    // Write to workspace
    writeFileSync(targetPath, configContent)
    console.log(`Deployed pyrightconfig.json to ${targetPath}`)
}

function normalizePathForUri(pathStr: string): string {
    return pathStr.replace(/\\/g, '/')
}

export function startPyrightBridge(): void {
    const config = loadConfig()
    validateConfig(config)

    // Deploy config before starting the server
    deployPyrightConfig(config)

    const wss = new WebSocketServer({ port: config.port, path: '/lsp' })
    console.log(`Pyright WS bridge running on ws://localhost:${config.port}/lsp`)
    console.log(`Execution root: ${config.botRoot}`)

    wss.on('connection', (ws) => {
        console.log('Client connected, spawning Pyright...')

        // Spawn a new Pyright instance for THIS connection
        // Set cwd to the project root so Pyright can find pyrightconfig.json and .venv
        console.log(`Spawning Pyright with cwd: ${config.botRoot}`)

        const pyright = spawn('node', [config.pyrightPath, '--stdio'], {
            cwd: config.botRoot,
            env: process.env
        })

        console.log('Pyright spawned, setting up message readers/writers...')

        const reader = new StreamMessageReader(pyright.stdout)
        const writer = new StreamMessageWriter(pyright.stdin)

        const socket = toSocket(ws as any)
        const wsReader = new WebSocketMessageReader(socket)
        const wsWriter = new WebSocketMessageWriter(socket)

        // pipe WS -> Pyright
        wsReader.listen((msg: any) => {
            console.log('→ Client to Pyright:', JSON.stringify(msg).substring(0, 200))

            // Auto-inject rootUri in initialize request
            if (msg.method === 'initialize') {
                console.log('🔧 Auto-injecting project configuration')

                // Normalize path for file:// URI (must use forward slashes)
                const normalizedRoot = normalizePathForUri(config.botRoot)

                msg.params = msg.params || {}
                msg.params.rootUri = `file:///${normalizedRoot}`
                msg.params.workspaceFolders = [
                    {
                        uri: `file:///${normalizedRoot}`,
                        name: 'mp_codemirror'
                    }
                ]

                console.log('✓ rootUri:', msg.params.rootUri)
            }

            // Auto-convert relative file URIs to absolute
            if (msg.params?.textDocument?.uri) {
                const uri = msg.params.textDocument.uri

                // If not already absolute, make it absolute
                if (!uri.startsWith('file://')) {
                    const normalizedPath = normalizePathForUri(path.join(config.botRoot, uri))
                    msg.params.textDocument.uri = `file:///${normalizedPath}`
                }
            }

            writer.write(msg)
        })

        // pipe Pyright -> WS
        reader.listen((msg: any) => {
            console.log('← Pyright to Client:', JSON.stringify(msg).substring(0, 200))
            wsWriter.write(msg)
        })

        // Cleanup on disconnect
        ws.on('close', () => {
            console.log('Client disconnected, killing Pyright...')
            pyright.kill()
        })

        // Handle errors
        pyright.on('error', (err) => {
            console.error('Pyright process error:', err)
            ws.close()
        })

        pyright.stderr.on('data', (data) => {
            console.error('Pyright stderr:', data.toString())
        })
    })

}
