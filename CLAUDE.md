# Google Tasks MCP Server Implementation Plan

## Project Overview

Build a Model Context Protocol (MCP) server that provides secure access to Google Tasks via OAuth 2.0 authentication. The server will run locally using stdio transport and expose Google Tasks operations as MCP tools and resources.

## Technical Requirements

### Core Technologies

-   **Language**: Node.js/TypeScript
-   **MCP Protocol**: @modelcontextprotocol/sdk-typescript
-   **Authentication**: Google OAuth 2.0 with PKCE
-   **Transport**: stdio (JSON-RPC)
-   **Storage**: Encrypted local file storage
-   **Google API**: Google Tasks API v1

### Project Structure

```
google-tasks-mcp/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── server.ts               # MCP server implementation
│   ├── auth/
│   │   ├── oauth-manager.ts    # OAuth 2.0 flow handler
│   │   ├── token-storage.ts    # Encrypted token persistence
│   │   └── auth-types.ts       # Auth-related interfaces
│   ├── handlers/
│   │   ├── tools.ts           # MCP tool implementations
│   │   ├── resources.ts       # MCP resource implementations
│   │   └── types.ts           # Handler type definitions
│   ├── google/
│   │   ├── tasks-client.ts    # Google Tasks API client
│   │   ├── api-types.ts       # Google API type definitions
│   │   └── error-handler.ts   # API error handling
│   └── utils/
│       ├── config.ts          # Configuration management
│       ├── logger.ts          # Logging utilities
│       └── crypto.ts          # Encryption/decryption utilities
├── config/
│   └── default.json           # Default configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Phases

### Phase 1: Project Setup and Core Infrastructure

#### 1.1 Initialize Project

Feel free to initialize project in modern and secure way

#### 1.2 Core Dependencies

-   `@modelcontextprotocol/sdk-typescript` - MCP protocol implementation
-   `googleapis` - Google APIs client library
-   `crypto` - Built-in Node.js encryption
-   `fs/promises` - Async file operations
-   `path` - File path utilities

Feel free to add other dependencies if needed

#### 1.3 TypeScript Configuration

Create `tsconfig.json` with strict settings, ES2020 target, and proper module resolution.

#### 1.4 Basic Project Structure

Set up directory structure and create placeholder files with proper TypeScript interfaces.

### Phase 2: Authentication System

#### 2.1 OAuth Manager Implementation

```typescript
class OAuthManager {
    // Generate PKCE challenge and verifier
    generatePKCE(): { verifier: string; challenge: string };

    // Create OAuth authorization URL
    getAuthorizationUrl(): string;

    // Exchange authorization code for tokens
    exchangeCodeForTokens(code: string): Promise<TokenSet>;

    // Refresh access token using refresh token
    refreshAccessToken(): Promise<TokenSet>;

    // Check if tokens are valid/expired
    isTokenValid(): boolean;
}
```

#### 2.2 Token Storage Implementation

```typescript
class TokenStorage {
    // Encrypt and save tokens to file
    saveTokens(tokens: TokenSet): Promise<void>;

    // Load and decrypt tokens from file
    loadTokens(): Promise<TokenSet | null>;

    // Remove stored tokens
    clearTokens(): Promise<void>;

    // Check if tokens exist
    hasTokens(): Promise<boolean>;
}
```

#### 2.3 Security Features

-   AES-256 encryption for token storage
-   Secure random key generation
-   File permission restrictions (600)
-   PKCE implementation for OAuth flow

### Phase 3: Google Tasks API Integration

#### 3.1 Tasks Client Implementation

```typescript
class GoogleTasksClient {
    constructor(private authManager: OAuthManager);

    // Task Lists operations
    getTaskLists(): Promise<TaskList[]>;
    createTaskList(title: string): Promise<TaskList>;

    // Tasks operations
    getTasks(taskListId: string): Promise<Task[]>;
    getTask(taskListId: string, taskId: string): Promise<Task>;
    createTask(taskListId: string, task: Partial<Task>): Promise<Task>;
    updateTask(
        taskListId: string,
        taskId: string,
        updates: Partial<Task>
    ): Promise<Task>;
    deleteTask(taskListId: string, taskId: string): Promise<void>;

    // Batch operations
    batchUpdateTasks(operations: BatchOperation[]): Promise<BatchResult>;
}
```

#### 3.2 API Error Handling

-   Token expiration detection and auto-refresh
-   Rate limiting with exponential backoff
-   Google API error code mapping
-   Graceful degradation for network issues

#### 3.3 Data Type Definitions

Create comprehensive TypeScript interfaces for:

-   Google Tasks API responses
-   Internal task representations
-   MCP tool parameters and responses

### Phase 4: MCP Server Implementation

#### 4.1 Tool Handlers

Implement MCP tools for task operations:

```typescript
// Tools to implement:
- list_task_lists(): List all task lists
- list_tasks(taskListId: string): Get tasks from specific list
- get_task(taskListId: string, taskId: string): Get specific task
- create_task(params: CreateTaskParams): Create new task
- update_task(params: UpdateTaskParams): Update existing task
- delete_task(taskListId: string, taskId: string): Delete task
- complete_task(taskListId: string, taskId: string): Mark task as completed
- move_task(params: MoveTaskParams): Move task between lists
```

#### 4.2 Resource Handlers

Implement MCP resources for data access:

```typescript
// Resources to implement:
- tasks://lists - All task lists
- tasks://list/{listId} - Specific task list metadata
- tasks://list/{listId}/tasks - All tasks in a list
- tasks://task/{listId}/{taskId} - Specific task details
```

#### 4.3 MCP Server Setup

```typescript
class GoogleTasksMCPServer {
    constructor();

    // Initialize server with tools and resources
    initialize(): Promise<void>;

    // Handle authentication status
    checkAuthStatus(): AuthStatus;

    // Start OAuth flow if needed
    initiateAuth(): Promise<string>; // Returns auth URL

    // Complete OAuth flow
    completeAuth(authCode: string): Promise<void>;

    // Start MCP server
    start(): void;
}
```

### Phase 5: Configuration and Utilities

#### 5.1 Configuration Management

```json
{
    "google": {
        "clientId": "YOUR_CLIENT_ID",
        "clientSecret": "", // Not used with PKCE
        "redirectUri": "http://localhost:8080/oauth/callback",
        "scopes": ["https://www.googleapis.com/auth/tasks"]
    },
    "storage": {
        "tokenFile": "~/.google-tasks-mcp/tokens.enc",
        "configDir": "~/.google-tasks-mcp"
    },
    "server": {
        "name": "google-tasks",
        "version": "1.0.0"
    }
}
```

#### 5.2 Logging System

-   Structured logging with different levels
-   Separate log files for auth and API operations
-   No sensitive data logging (tokens, auth codes)
-   Configurable log levels

#### 5.3 Error Handling Strategy

-   Graceful error responses for MCP clients
-   Detailed error logging for debugging
-   User-friendly error messages
-   Automatic retry logic for transient failures

### Phase 6: OAuth Flow Implementation

#### 6.1 Local HTTP Server for OAuth Callback

```typescript
class OAuthCallbackServer {
    // Start temporary HTTP server for OAuth callback
    startCallbackServer(): Promise<number>; // Returns port

    // Wait for OAuth callback
    waitForCallback(): Promise<string>; // Returns auth code

    // Stop callback server
    stopCallbackServer(): void;
}
```

#### 6.2 Alternative: Manual Code Entry

Provide fallback option for users to manually enter authorization code if callback server fails.

#### 6.3 PKCE Implementation

-   Generate cryptographically secure code verifier
-   Create SHA256 code challenge
-   Include in OAuth flow parameters

### Phase 7: Testing and Validation

#### 7.1 Unit Tests

-   OAuth flow components
-   Token storage encryption/decryption
-   Google API client methods
-   MCP tool and resource handlers

#### 7.2 Integration Tests

-   End-to-end OAuth flow
-   Google Tasks API integration
-   MCP protocol compliance
-   Error scenarios and recovery

#### 7.3 Manual Testing Scenarios

-   First-time authentication
-   Token refresh scenarios
-   Network connectivity issues
-   Invalid/expired tokens
-   MCP client integration

### Phase 8: Documentation and Deployment

#### 8.1 User Documentation

-   Installation instructions
-   OAuth setup guide (Google Cloud Console)
-   MCP client configuration
-   Troubleshooting guide

#### 8.2 Developer Documentation

-   API documentation
-   Architecture overview
-   Extension points for additional features
-   Security considerations

#### 8.3 Package Preparation

-   Build scripts and distribution
-   npm package configuration
-   CLI executable setup
-   Cross-platform compatibility

## Detailed Implementation Steps

### Step 1: Create Project Foundation

1. Initialize npm project with TypeScript
2. Set up directory structure
3. Configure TypeScript compilation
4. Create basic package.json scripts
5. Set up development environment with nodemon

### Step 2: Implement Token Storage

1. Create encryption utilities using Node.js crypto
2. Implement secure file storage for tokens
3. Add file permission management
4. Create token validation logic
5. Test encryption/decryption round-trip

### Step 3: Build OAuth Manager

1. Implement PKCE code generation
2. Create authorization URL builder
3. Add token exchange logic
4. Implement refresh token flow
5. Add token expiration checking

### Step 4: Google API Integration

1. Set up Google API client with authentication
2. Implement task list operations
3. Add task CRUD operations
4. Create error handling and retry logic
5. Add rate limiting protection

### Step 5: MCP Server Framework

1. Initialize MCP server with stdio transport
2. Define tool schemas and handlers
3. Implement resource handlers
4. Add authentication state management
5. Create server lifecycle management

### Step 6: OAuth Callback Handling

1. Implement local HTTP server for callbacks
2. Add manual code entry fallback
3. Create user-friendly auth flow guidance
4. Test OAuth flow end-to-end
5. Handle edge cases and errors

### Step 7: Integration and Testing

1. Test with actual MCP clients
2. Validate all tool operations
3. Test resource access patterns
4. Verify error handling
5. Performance testing with large task lists

### Step 8: Polish and Documentation

1. Add comprehensive error messages
2. Create setup and usage documentation
3. Prepare distribution package
4. Create example configurations
5. Final security review

## Security Considerations

1. **Token Security**: Encrypt all stored tokens with AES-256
2. **File Permissions**: Restrict token files to user-only access (600)
3. **PKCE**: Use PKCE for OAuth to eliminate client secret needs
4. **Local Communication**: Use stdio transport for maximum security
5. **Error Handling**: Never log sensitive authentication data
6. **Token Rotation**: Implement automatic token refresh
7. **Input Validation**: Validate all user inputs and API responses

## Success Criteria

1. **Functional**: All Google Tasks operations work through MCP tools
2. **Secure**: OAuth implementation follows security best practices
3. **Reliable**: Handles network issues and token expiration gracefully
4. **Usable**: Clear setup process and good error messages
5. **Compatible**: Works with standard MCP clients like Claude
6. **Maintainable**: Clean, well-documented, and extensible code

## Future Enhancements

1. Support for task attachments and metadata
2. Bulk operations for large task sets
3. Task synchronization and conflict resolution
4. Integration with other Google Workspace services
5. Advanced filtering and search capabilities
6. Task analytics and reporting features

This implementation plan provides a comprehensive roadmap for building a production-ready Google Tasks MCP server with proper security, error handling, and user experience considerations.
