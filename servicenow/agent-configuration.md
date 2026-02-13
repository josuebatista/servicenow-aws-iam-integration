# ServiceNow AI Agent Configuration

This guide walks through creating the AWS IAM Integration Agent in ServiceNow.

## Prerequisites

- ServiceNow instance with AI Agent capability (Now Assist, Agent Studio)
- Admin or appropriate role to create AI Agents
- API Gateway endpoint URL and API key from AWS setup

## Agent Setup

### 1. Create New AI Agent

1. Navigate to **Agent Studio** (or search for "AI Agent" in the filter navigator)
2. Click **"Create Agent"** or **"New"**
3. Configure basic settings:
   - **Name**: `AWS IAM Integration Agent`
   - **Description**: (see below)

### 2. Agent Description

```
This AI agent manages AWS IAM user lifecycle operations through automated workflows. It can create new IAM users with S3 full access permissions, retrieve user details, list all IAM users in the AWS account, and delete users when they're no longer needed. The agent handles credential generation, policy attachment, and provides secure access key management for ServiceNow-AWS integrations.
```

### 3. Agent Role/System Prompt

```
You are an AWS IAM administrator agent responsible for managing IAM user accounts. Your primary functions include creating new users with appropriate S3 access permissions, retrieving user information, listing all users in the account, and safely removing users when requested. Always provide clear confirmation of actions taken, including generated credentials for new users, and warn users to store credentials securely. When deleting users, confirm the username and explain that all associated access keys and policies will be removed.
```

## Tool Configuration

Create 4 tools (steps) in the following order:

### Tool 1: Create IAM User

**Tool Name**: `create_iam_user`

**Description**:
```
Creates a new AWS IAM user with AmazonS3FullAccess policy attached. Generates access key ID and secret access key for the user. Optionally accepts tags for resource organization (Environment, CreatedBy, Department, etc.). Returns user ARN, user ID, credentials, and policy information.
```

**Input Parameters**:
- `username` (String, Required): Name for the new IAM user
- `environment` (String, Optional): Environment tag (default: Production)
- `department` (String, Optional): Department tag (default: IT)

**Script**: See `tools/create_iam_user.js`

---

### Tool 2: List IAM Users

**Tool Name**: `list_iam_users`

**Description**:
```
Lists all IAM users in the AWS account with their details including username, ARN, user ID, creation date, and attached policies. Useful for auditing existing users and checking what users are currently active in the account.
```

**Input Parameters**: None

**Script**: See `tools/list_iam_users.js`

---

### Tool 3: Get IAM User Details

**Tool Name**: `get_iam_user`

**Description**:
```
Retrieves comprehensive details about a specific IAM user including username, ARN, user ID, creation date, attached policies, and access keys (without exposing secret keys). Use this to verify user configuration and check which policies and access keys are associated with the user.
```

**Input Parameters**:
- `username` (String, Required): Username of the IAM user to retrieve

**Script**: See `tools/get_iam_user.js`

---

### Tool 4: Delete IAM User

**Tool Name**: `delete_iam_user`

**Description**:
```
Deletes an IAM user from AWS. Automatically removes all access keys and detaches all policies before deleting the user. This is a destructive operation that cannot be undone. Use with caution and confirm the username before proceeding.
```

**Input Parameters**:
- `username` (String, Required): Username of the IAM user to delete

**Script**: See `tools/delete_iam_user.js`

---

## Script Configuration

### Important: Update These Values in ALL Scripts

Before using the agent, update these values in each tool script:

1. **API Gateway Endpoint**:
   ```javascript
   request.setEndpoint('https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com/prod/iam');
   ```
   Replace with your actual API Gateway invoke URL.

2. **API Key** (Uncomment and add):
   ```javascript
   request.setRequestHeader('x-api-key', 'YOUR-API-KEY-HERE');
   ```
   Remove the `// TODO:` comment and add your actual API key.

### Example:
```javascript
// Before:
// TODO: Add API key when available
// request.setRequestHeader('x-api-key', 'YOUR-API-KEY');

// After:
request.setRequestHeader('x-api-key', 'abcd1234efgh5678ijkl');
```

## Testing the Agent

### Test Conversations

Once configured, test the agent with these example conversations:

#### 1. Create a User
**User**: "Create a new IAM user called servicenow-s3-backup for the Operations department"

**Expected**: Agent calls `create_iam_user` and returns:
- Username
- ARN
- Access Key ID
- Secret Access Key
- Warning about storing credentials securely

#### 2. List All Users
**User**: "Show me all IAM users we have"

**Expected**: Agent calls `list_iam_users` and returns formatted list of all users

#### 3. Get User Details
**User**: "What are the details for servicenow-integration user?"

**Expected**: Agent calls `get_iam_user` and returns:
- User information
- Attached policies
- Access key status

#### 4. Delete a User
**User**: "Delete the user servicenow-s3-user-001, we don't need it anymore"

**Expected**: Agent calls `delete_iam_user` and confirms deletion

## Advanced Configuration

### Access Control

Restrict agent access to specific users/roles:
1. Go to **Agent Studio**
2. Select your agent
3. Configure **"Who can use this agent"**
4. Add specific users, groups, or roles

### Conversation Topics

Configure conversation topics to help route user requests:
- IAM user management
- AWS access management
- Cloud resource provisioning
- Security and compliance

### Knowledge Base Integration (Optional)

Link the agent to a knowledge base with:
- AWS IAM best practices
- Security policies
- User provisioning procedures
- Troubleshooting guides

## Monitoring and Maintenance

### Check Agent Performance

1. **Agent Analytics**:
   - Navigate to Agent Analytics dashboard
   - Review conversation success rate
   - Check most-used tools
   - Identify failed operations

2. **Script Execution Logs**:
   - Go to **System Logs** → **Script Execution History**
   - Filter by your tool script names
   - Review any errors or warnings

3. **AWS CloudWatch**:
   - Monitor Lambda execution logs
   - Check API Gateway request metrics
   - Set up alarms for errors

### Common Issues

#### Agent doesn't call tools
- **Cause**: Tool descriptions unclear or inputs undefined
- **Solution**: Improve tool descriptions with clear keywords

#### Script execution fails
- **Cause**: API endpoint or key incorrect
- **Solution**: Verify endpoint URL and API key in scripts

#### Timeout errors
- **Cause**: Lambda cold start or complex operations
- **Solution**: Increase timeout in ServiceNow script settings

## Security Considerations

1. **API Key Storage**:
   - Consider using ServiceNow's Credential Store
   - Rotate API keys regularly
   - Limit API key scope with usage plans

2. **Access Control**:
   - Restrict agent to authorized users
   - Implement approval workflows for sensitive operations
   - Log all user creation/deletion activities

3. **Credential Handling**:
   - Never log secret access keys
   - Consider integrating with AWS Secrets Manager
   - Implement automatic credential rotation

4. **Audit Trail**:
   - Enable CloudTrail in AWS
   - Log all agent conversations
   - Review security events regularly

## Troubleshooting

### Tool Not Being Called

**Symptoms**: Agent responds conversationally but doesn't execute operations

**Solutions**:
1. Check tool descriptions for clarity
2. Ensure input parameters are properly defined
3. Review agent conversation logs for routing decisions
4. Test tools individually in ServiceNow

### API Errors

**Symptoms**: Script returns 403, 500, or other HTTP errors

**Solutions**:
1. Verify API endpoint URL is correct
2. Check API key is valid and uncommented
3. Review Lambda CloudWatch Logs
4. Test API directly with cURL

### Incorrect Tool Outputs

**Symptoms**: Tool executes but returns unexpected data

**Solutions**:
1. Check Lambda function logs for errors
2. Verify IAM permissions on Lambda execution role
3. Test Lambda function directly in AWS Console
4. Review script parsing logic in ServiceNow

## Best Practices

1. **Test in Non-Production**: Always test in a development instance first
2. **Document Customizations**: Keep track of any changes to scripts or agent configuration
3. **Regular Reviews**: Periodically review user creation patterns and security
4. **Backup Configuration**: Export agent configuration regularly
5. **Version Control**: Track script changes in source control (e.g., this GitHub repo)

## Next Steps

After successful setup:

1. **Enhance Security**: 
   - Move API key to Credential Store
   - Add approval workflows
   - Implement MFA requirements

2. **Expand Functionality**:
   - Add support for additional IAM policies
   - Implement group management
   - Add access key rotation automation

3. **Integrate with Other Systems**:
   - Link to CMDB for asset tracking
   - Connect to ticketing for access requests
   - Integrate with HR systems for automated provisioning

4. **Monitor and Optimize**:
   - Set up usage dashboards
   - Implement cost tracking
   - Optimize tool descriptions based on usage patterns
