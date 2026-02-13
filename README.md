# ServiceNow-AWS IAM Integration

A proof-of-concept integration that enables ServiceNow to manage AWS IAM users through an AI Agent interface. This integration allows automated creation, management, and deletion of IAM users with S3 access permissions.

## 🏗️ Architecture Overview

```
ServiceNow AI Agent → API Gateway → Lambda Function → AWS IAM Service
```

### Components

1. **ServiceNow AI Agent**: Natural language interface for IAM operations
2. **API Gateway**: REST API endpoint with API key authentication
3. **Lambda Function**: Serverless proxy handling IAM operations
4. **IAM Service**: AWS Identity and Access Management

## 📋 Prerequisites

- AWS Account with appropriate permissions
- ServiceNow instance (personal developer instance or enterprise)
- Basic understanding of AWS IAM, Lambda, and API Gateway
- Basic understanding of ServiceNow AI Agents and scripting

## 🚀 Quick Start

### 1. AWS Setup

#### Create IAM User for Integration

1. Create IAM user: `servicenow-integration`
2. Attach the custom policy: `ServiceNow-Integration-IAM-Policy` (see `aws/iam-policies/servicenow-integration-policy.json`)
3. Generate and securely store access keys

#### Deploy Lambda Function

1. Create Lambda function: `ServiceNowIAMProxy`
2. Runtime: Python 3.12
3. Copy code from `aws/lambda/ServiceNowIAMProxy.py`
4. Create execution role with policy from `aws/iam-policies/lambda-execution-role-policy.json`

#### Configure API Gateway

1. Create REST API: `ServiceNowIAMProxy-REST-API`
2. Create POST method pointing to Lambda function
3. Enable API key requirement
4. Create API key and usage plan
5. Deploy to `prod` stage
6. Save the invoke URL

### 2. ServiceNow Setup

1. Navigate to **Agent Studio** (or **Now Assist Agent Studio**)
2. Create new AI Agent: **AWS IAM Integration Agent**
3. Configure agent (see `servicenow/agent-configuration.md`)
4. Create 4 tool steps using scripts from `servicenow/tools/`
5. Update API endpoint in each script
6. Add API key to scripts (uncomment and replace placeholder)
7. Test the agent

## 📁 Repository Structure

```
servicenow-aws-iam-integration/
├── README.md
├── LICENSE
├── aws/
│   ├── lambda/
│   │   └── ServiceNowIAMProxy.py
│   ├── iam-policies/
│   │   ├── servicenow-integration-policy.json
│   │   └── lambda-execution-role-policy.json
│   └── api-gateway/
│       └── setup-guide.md
├── servicenow/
│   ├── agent-configuration.md
│   ├── tools/
│   │   ├── create_iam_user.js
│   │   ├── list_iam_users.js
│   │   ├── get_iam_user.js
│   │   └── delete_iam_user.js
│   └── testing/
│       └── test-scenarios.md
├── docs/
│   ├── architecture.md
│   ├── security-considerations.md
│   └── troubleshooting.md
└── examples/
    └── curl-requests.sh
```

## 🔧 Configuration

### AWS Configuration

**Region**: `us-east-2` (Ohio) - Update if using different region

**API Gateway Endpoint**: 
```
https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/ServiceNowIAMProxy
```

### ServiceNow Configuration

Update the endpoint in all tool scripts:
```javascript
request.setEndpoint('https://YOUR-API-GATEWAY-URL');
request.setRequestHeader('x-api-key', 'YOUR-API-KEY');
```

## 🧪 Testing

### Test with cURL

```bash
# List Users
curl -X POST https://YOUR-API-GATEWAY-URL \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"operation": "list_users"}'

# Create User
curl -X POST https://YOUR-API-GATEWAY-URL \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{
    "operation": "create_user",
    "username": "test-user-001",
    "tags": [
      {"Key": "Environment", "Value": "Development"},
      {"Key": "CreatedBy", "Value": "ServiceNow"}
    ]
  }'
```

See `examples/curl-requests.sh` for more examples.

### Test in ServiceNow

Example conversations with the AI Agent:

- "Create a new IAM user called servicenow-s3-backup"
- "List all IAM users"
- "What are the details for servicenow-integration?"
- "Delete the user test-user-001"

## 🔒 Security Considerations

### Best Practices

1. **API Key Management**: Store API keys in ServiceNow's Credential Store
2. **IAM Permissions**: Use least-privilege principle for all IAM roles
3. **Audit Logging**: Enable AWS CloudTrail for all IAM operations
4. **Access Control**: Restrict AI Agent access to authorized ServiceNow users
5. **Credential Rotation**: Regularly rotate access keys
6. **Network Security**: Consider using VPC endpoints for Lambda-IAM communication

### Sandbox Environment

This integration is designed for **sandbox/development environments**. For production:

- Implement additional authorization layers
- Add rate limiting and request throttling
- Enable CloudWatch alarms and monitoring
- Implement credential encryption at rest
- Add approval workflows for user creation/deletion
- Consider using AWS Organizations SCPs for additional boundaries

## 📊 Supported Operations

| Operation | Description | Required Input |
|-----------|-------------|----------------|
| `create_user` | Create IAM user with S3 access | `username`, optional `tags` |
| `list_users` | List all IAM users | None |
| `get_user` | Get detailed user information | `username` |
| `delete_user` | Delete IAM user (removes keys & policies) | `username` |

## 🐛 Troubleshooting

### Common Issues

**Lambda returns 403 Forbidden**
- Verify Lambda execution role has IAM permissions
- Check CloudWatch Logs for detailed error messages

**API Gateway returns 403 Forbidden**
- Verify API key is included in request header: `x-api-key`
- Ensure API key is associated with usage plan
- Confirm API is deployed to correct stage

**ServiceNow script fails**
- Check ServiceNow script execution logs
- Verify endpoint URL is correct
- Confirm API key is uncommented and valid

See `docs/troubleshooting.md` for detailed solutions.

## 📝 API Reference

### Request Format

```json
{
  "operation": "create_user|list_users|get_user|delete_user",
  "username": "string (required for create_user, get_user, delete_user)",
  "tags": [
    {"Key": "string", "Value": "string"}
  ]
}
```

### Response Format

**Success (200)**
```json
{
  "operation": "string",
  "message": "string",
  "username": "string",
  "arn": "string",
  "user_id": "string",
  "created_date": "ISO8601",
  "access_key_id": "string",
  "secret_access_key": "string",
  "policy_attached": "string"
}
```

**Error (4xx/5xx)**
```json
{
  "error": "string"
}
```

## 🤝 Contributing

This is a proof-of-concept integration. Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built as a proof-of-concept for ServiceNow-AWS integration patterns.

## 📞 Support

For issues or questions:
- Create an issue in this repository
- Review the troubleshooting guide
- Check AWS CloudWatch Logs and ServiceNow script execution logs

## 🔄 Version History

- **v1.0.0** (2026-02-13): Initial release
  - Basic IAM user management (create, list, get, delete)
  - ServiceNow AI Agent integration
  - API Gateway with API key authentication
  - Lambda proxy pattern implementation

## 🗺️ Roadmap

Potential future enhancements:
- [ ] Support for additional IAM policies
- [ ] Group management
- [ ] Access key rotation automation
- [ ] Integration with AWS Secrets Manager
- [ ] CloudWatch monitoring dashboard
- [ ] SNS notifications for user creation/deletion
- [ ] Multi-region support
- [ ] ServiceNow catalog item integration
