# Architecture Documentation

## Overview

This integration uses a Lambda proxy pattern to enable ServiceNow to manage AWS IAM users without directly handling AWS credentials or implementing complex AWS Signature V4 authentication.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          ServiceNow                              │
│                                                                  │
│  ┌────────────────┐                                             │
│  │  AI Agent      │  User interacts with natural language       │
│  │  Interface     │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│          │ Calls tool                                           │
│          ▼                                                       │
│  ┌────────────────┐                                             │
│  │  Tool Scripts  │  JavaScript execution                       │
│  │  (4 tools)     │  - create_iam_user.js                      │
│  │                │  - list_iam_users.js                       │
│  │                │  - get_iam_user.js                         │
│  │                │  - delete_iam_user.js                      │
│  └───────┬────────┘                                             │
│          │                                                       │
│          │ HTTPS POST with API Key                             │
│          │ {operation: "create_user", username: "..."}         │
└──────────┼─────────────────────────────────────────────────────┘
           │
           │ Internet (HTTPS)
           │
┌──────────▼─────────────────────────────────────────────────────┐
│                      AWS Cloud                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              API Gateway (REST API)                      │   │
│  │                                                          │   │
│  │  • Endpoint authentication via API Key                  │   │
│  │  • Request validation                                   │   │
│  │  • Usage plan & throttling                             │   │
│  │  • CloudWatch logging                                   │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   │                                             │
│                   │ Invokes with event                         │
│                   ▼                                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │         Lambda Function: ServiceNowIAMProxy             │   │
│  │                                                          │   │
│  │  • Python 3.12 runtime                                  │   │
│  │  • Parses operation type                                │   │
│  │  • Routes to appropriate handler                        │   │
│  │  • Implements business logic                            │   │
│  │  • Error handling & logging                             │   │
│  │                                                          │   │
│  │  Execution Role:                                        │   │
│  │  • IAM permissions for user management                  │   │
│  │  • CloudWatch Logs write access                         │   │
│  └────────────────┬───────────────────────────────────────┘   │
│                   │                                             │
│                   │ boto3 SDK calls                            │
│                   ▼                                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              AWS IAM Service                            │   │
│  │                                                          │   │
│  │  Operations:                                            │   │
│  │  • CreateUser                                           │   │
│  │  • GetUser                                              │   │
│  │  • ListUsers                                            │   │
│  │  • DeleteUser                                           │   │
│  │  • CreateAccessKey                                      │   │
│  │  • DeleteAccessKey                                      │   │
│  │  • AttachUserPolicy                                     │   │
│  │  • DetachUserPolicy                                     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           CloudWatch Logs                               │   │
│  │                                                          │   │
│  │  • Lambda execution logs                                │   │
│  │  • API Gateway access logs                              │   │
│  │  • Error tracking                                       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           CloudTrail                                    │   │
│  │                                                          │   │
│  │  • Audit log of all IAM operations                      │   │
│  │  • Who created/deleted users                            │   │
│  │  • When operations occurred                             │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### ServiceNow AI Agent

**Purpose**: Natural language interface for IAM operations

**Key Features**:
- Conversational AI powered by LLM
- Context-aware interactions
- Tool routing based on user intent
- Response formatting and presentation

**Implementation**:
- Built using ServiceNow Agent Studio
- 4 tool integrations (create, list, get, delete)
- Role-based access control
- Conversation logging

### ServiceNow Tool Scripts

**Purpose**: Execute HTTP calls to AWS API Gateway

**Technology**: JavaScript (ServiceNow server-side scripting)

**Key Features**:
- RESTMessageV2 API for HTTP requests
- JSON payload construction
- Response parsing and error handling
- Input validation

**Security**:
- API key stored in script (should be moved to Credential Store)
- HTTPS transport encryption
- No AWS credentials stored

### AWS API Gateway

**Purpose**: Secure REST API endpoint for Lambda invocation

**Type**: REST API (not HTTP API)

**Authentication**: API Key via `x-api-key` header

**Features**:
- Request throttling (10 req/sec, 20 burst)
- Usage quotas (1000 req/day)
- CORS support
- CloudWatch logging
- Stage management (prod)

**Security**:
- API key requirement on all methods
- Usage plans for rate limiting
- CloudWatch monitoring
- AWS IAM integration

### AWS Lambda Function

**Purpose**: Business logic and IAM service integration

**Runtime**: Python 3.12

**Handler**: `lambda_handler(event, context)`

**Key Features**:
- Operation routing (create/list/get/delete)
- Input validation
- Error handling
- Structured logging

**Execution Role Permissions**:
- IAM user management operations
- CloudWatch Logs write access

**Resource Limits**:
- Memory: 128 MB (default)
- Timeout: 30 seconds
- Concurrent executions: 1000 (default)

### AWS IAM Service

**Purpose**: Identity and Access Management

**Operations Used**:
- `CreateUser`: Create new IAM users
- `GetUser`: Retrieve user details
- `ListUsers`: List all users
- `DeleteUser`: Remove users
- `CreateAccessKey`: Generate access keys
- `DeleteAccessKey`: Remove access keys
- `AttachUserPolicy`: Grant permissions
- `DetachUserPolicy`: Revoke permissions
- `ListAttachedUserPolicies`: Query permissions

## Data Flow

### 1. Create User Flow

```
User: "Create user servicenow-backup"
   ↓
AI Agent parses intent → calls create_iam_user tool
   ↓
Tool script constructs JSON:
{
  "operation": "create_user",
  "username": "servicenow-backup",
  "tags": [...]
}
   ↓
HTTPS POST to API Gateway with API key
   ↓
API Gateway validates API key → invokes Lambda
   ↓
Lambda parses operation → calls create_user_with_s3_access()
   ↓
Lambda calls IAM:
- CreateUser
- AttachUserPolicy (AmazonS3FullAccess)
- CreateAccessKey
   ↓
Lambda returns JSON response:
{
  "operation": "create_user",
  "username": "servicenow-backup",
  "arn": "arn:aws:iam::...",
  "access_key_id": "AKIA...",
  "secret_access_key": "...",
  "message": "User created successfully"
}
   ↓
API Gateway returns 200 OK
   ↓
Tool script parses response
   ↓
AI Agent formats response for user:
"✓ Created user servicenow-backup
   Access Key ID: AKIA...
   Secret Key: ... (store securely)"
```

### 2. List Users Flow

```
User: "Show me all users"
   ↓
AI Agent → list_iam_users tool
   ↓
Tool script: POST {"operation": "list_users"}
   ↓
API Gateway → Lambda
   ↓
Lambda calls IAM.ListUsers()
   ↓
For each user, Lambda calls IAM.ListAttachedUserPolicies()
   ↓
Lambda returns user array
   ↓
Tool script formats as readable text
   ↓
AI Agent presents to user
```

## Security Architecture

### Authentication & Authorization Layers

```
Layer 1: ServiceNow Access Control
├─ User authentication (SSO, local)
├─ Role-based agent access
└─ Conversation logging

Layer 2: API Gateway Authentication
├─ API key validation (x-api-key header)
├─ Usage plan enforcement
└─ Rate limiting & throttling

Layer 3: Lambda Execution Role
├─ IAM role with least-privilege permissions
├─ Service control policies (SCPs)
└─ Resource-based access

Layer 4: IAM Service Authorization
├─ IAM policy evaluation
├─ Permission boundaries
└─ Service control policies
```

### Security Controls

| Control | Implementation | Purpose |
|---------|---------------|---------|
| Transport Encryption | HTTPS (TLS 1.2+) | Protect data in transit |
| API Key | Random 20-char string | Authenticate ServiceNow |
| Usage Plans | 10 req/sec, 1000/day | Prevent abuse |
| Lambda Execution Role | Scoped IAM permissions | Least privilege |
| CloudTrail | All IAM operations logged | Audit trail |
| CloudWatch Logs | Request/response logging | Monitoring & debugging |
| Input Validation | Username format checks | Prevent injection |
| Error Handling | Generic error messages | Prevent information leakage |

## Scalability Considerations

### Current Limits

- **API Gateway**: 10,000 requests/second (regional)
- **Lambda**: 1,000 concurrent executions (default)
- **IAM**: 5,000 API calls/second per account

### Scaling Strategies

1. **Horizontal Scaling**:
   - Lambda auto-scales automatically
   - No manual intervention needed for typical loads

2. **Regional Deployment**:
   - Deploy to multiple regions if needed
   - Route53 for geo-routing

3. **Caching**:
   - Cache list_users response in ServiceNow
   - Reduce API calls for frequently accessed data

4. **Asynchronous Processing**:
   - For bulk operations, use SQS + Lambda
   - Return request ID, poll for completion

## Monitoring & Observability

### Metrics to Track

**API Gateway**:
- Request count
- Latency (p50, p95, p99)
- 4xx/5xx error rates
- Cache hit rate

**Lambda**:
- Invocation count
- Duration
- Error count
- Concurrent executions
- Throttles

**IAM Operations**:
- User creation rate
- Deletion rate
- Policy attachment count
- Access key generation

### Alerting

Set up CloudWatch alarms for:
- Error rate > 5%
- Latency > 3 seconds (p99)
- Throttling events
- Concurrent executions > 80% of limit
- IAM API throttling

### Logging

**CloudWatch Log Groups**:
- `/aws/lambda/ServiceNowIAMProxy` - Lambda execution logs
- `/aws/apigateway/ServiceNowIAMProxy-REST-API` - API Gateway logs

**Log Retention**: 7-30 days (configurable)

**CloudTrail Events**: All IAM operations for compliance

## Cost Analysis

### Monthly Cost Estimate (Low Usage)

| Service | Usage | Cost |
|---------|-------|------|
| API Gateway | 1,000 requests | $0.00 |
| Lambda | 1,000 invocations, 1s avg | $0.00 |
| CloudWatch Logs | 1 GB | $0.50 |
| CloudTrail | Included | $0.00 |
| **Total** | | **~$0.50/month** |

### Monthly Cost Estimate (Medium Usage)

| Service | Usage | Cost |
|---------|-------|------|
| API Gateway | 100,000 requests | $0.35 |
| Lambda | 100,000 invocations, 1s avg | $0.20 |
| CloudWatch Logs | 10 GB | $5.00 |
| CloudTrail | Included | $0.00 |
| **Total** | | **~$5.55/month** |

## Disaster Recovery

### Backup Strategy

**Infrastructure as Code**:
- Lambda function code in GitHub
- IAM policies in JSON format
- API Gateway configuration documented

**Recovery Steps**:
1. Clone GitHub repository
2. Deploy Lambda function
3. Create API Gateway following setup guide
4. Configure API key and usage plan
5. Update ServiceNow tool scripts with new endpoint
6. Test all operations

**RTO**: 2-4 hours
**RPO**: Code changes in Git (near-zero)

## Future Enhancements

### Planned Improvements

1. **Secrets Management**:
   - Store generated credentials in AWS Secrets Manager
   - Auto-rotation of access keys
   - Integration with ServiceNow Credential Store

2. **Enhanced Security**:
   - Move API key to ServiceNow Credential Store
   - Implement request signing
   - Add IP whitelisting

3. **Additional Operations**:
   - Group management
   - Role attachment
   - MFA configuration
   - Permission boundary enforcement

4. **Observability**:
   - Custom CloudWatch dashboard
   - SNS notifications for user operations
   - Integration with SIEM

5. **Multi-Region Support**:
   - Deploy Lambda in multiple regions
   - Regional failover capability

6. **Batch Operations**:
   - Create multiple users at once
   - Bulk deletion with DynamoDB tracking
