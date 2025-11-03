# Testing Guide

## MCP Connection Test

This test verifies that the python-language-server is correctly configured and can establish WebSocket connections for Language Server Protocol (LSP) communication.

### What the Test Does

The MCP (Model Context Protocol) connection test performs the following checks:

1. **Server Startup**: Verifies the python-language-server starts successfully
2. **WebSocket Connection**: Tests that WebSocket connections can be established on port 9011
3. **LSP Initialize**: Validates that the LSP bridge responds correctly to initialize requests
4. **Firewall Settings**: Confirms that firewall settings allow proper communication

### Running the Test

```bash
# Run the MCP connection test
npm test

# Or explicitly
npm run test:mcp
```

### Test Output

A successful test run will show:
```
✅ Test workspace created
✅ Server started successfully
✅ WebSocket connection established
✅ LSP initialize successful
✅ All tests passed! Firewall settings are working correctly.
```

### What Gets Tested

The test creates a temporary workspace with:
- A test Python file (`test_strategy.py`)
- Pyright configuration
- Mock Jesse project structure

It then:
1. Starts the python-language-server on port 9011
2. Connects via WebSocket to `ws://localhost:9011/lsp`
3. Sends an LSP initialize request
4. Verifies the response includes Pyright server capabilities
5. Cleans up all resources

### Troubleshooting

**Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::9011
```
Solution: Kill any process using port 9011:
```bash
lsof -ti:9011 | xargs kill -9
```

**Connection Timeout**
If the test times out, check:
- Firewall settings allow connections to localhost:9011
- Node.js has permission to bind to port 9011
- No antivirus software is blocking the connection

**LSP Initialize Fails**
Check:
- Pyright is installed in node_modules
- Test workspace has proper permissions
- pyrightconfig.json is valid JSON

### Test Architecture

The test is written in TypeScript and uses:
- **ws** - WebSocket client library
- **tsx** - TypeScript execution
- **child_process** - For spawning the server

The test automatically:
- Creates temporary workspaces in `tests/test-workspace/`
- Cleans up after itself (server processes and files)
- Times out after 10 seconds if any step fails

### Continuous Integration

This test is suitable for CI/CD pipelines to verify:
- Server starts correctly in different environments
- Network/firewall configuration is correct
- LSP protocol communication works as expected
