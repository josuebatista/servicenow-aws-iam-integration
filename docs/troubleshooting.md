# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the ServiceNow-AWS IAM integration.

## Quick Diagnostic Steps

When something goes wrong, follow these steps in order:

1. **Check ServiceNow script execution logs**
2. **Check API Gateway CloudWatch logs**
3. **Check Lambda CloudWatch logs**
4. **Check CloudTrail for IAM operation logs**

## Common Issues

### Issue 1: "403 Forbidden" Error

**Symptoms**:
- ServiceNow tool returns HTTP 403
- Agent responds with authentication error

**Possible Causes**:

#### Cause 1A: Missing or Invalid API Key

**Diagnosis**:
```bash
# Test without API key
curl -X POST https://YOUR-API-GATEWAY-URL \
  -H "Content-Type: application/json" \
  -d '{"operation": "list_users"}'

# Expected: 403 Forbidden
```

**Solution**:
1. Verify API key exists in API Gateway:
   ```bash
   aws apigateway get-api-keys
   ```

2. Check script has API key uncommented:
   ```javascript
   // Wrong:
   // request.setRequestHeader('x-api-key', 'YOUR-API-KEY');
   
   // Correct:
   request.setRequestHeader('x-api-key', 'abc123def456...');
   ```

3. Verify API key is enabled:
   ```bash
   aws apigateway get-api-key --api-key YOUR-KEY-ID --include-value
   ```

#### Cause 1B: API Key Not Associated with Usage Plan

**Diagnosis**:
```bash
# List usage plans
aws apigateway get-usage-plans

# Check if key is in plan
aws apigateway get-usage-plan-keys --usage-plan-id YOUR-PLAN-ID
```

**Solution**:
```bash
# Associate API key with usage plan
aws apigateway create-usage-plan-key \
    --usage-plan-id YOUR-PLAN-ID \
    --key-id YOUR-KEY-ID \
    --key-type API_KEY
```

#### Cause 1C: API Not Deployed

**Diagnosis**:
- API Gateway console shows "API not deployed" warning
- Stage URL returns 403

**Solution**:
1. Go to API Gateway console
2. Select your API
3. Click **Actions** → **Deploy API**
4. Select stage: `prod`
5. Click **Deploy**

---

### Issue 2: "500 Internal Server Error"

**Symptoms**:
- ServiceNow receives HTTP 500
- Lambda function not executing correctly

**Possible Causes**:

#### Cause 2A: Lambda Execution Role Missing Permissions

**Diagnosis**:
Check Lambda CloudWatch Logs:
```
[ERROR] ClientError: An error occurred (AccessDenied) when calling the CreateUser operation: 
User: arn:aws:sts::ACCOUNT:assumed-role/lambda-role/ServiceNowIAMProxy is not authorized 
to perform: iam:CreateUser on resource: user test-user
```

**Solution**:
1. Go to IAM → Roles
2. Find Lambda execution role (e.g., `ServiceNowIAMProxy-role-xxxxx`)
3. Add inline policy from `aws/iam-policies/lambda-execution-role-policy.json`
4. Click **Attach policies**
5. Add the IAM permissions policy
6. Retry operation

#### Cause 2B: Lambda Function Error

**Diagnosis**:
Check CloudWatch Logs for:
```
[ERROR] KeyError: 'username'
[ERROR] JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

**Solution**:
1. Review request payload format
2. Verify JSON is valid:
   ```bash
   echo '{"operation": "create_user", "username": "test"}' | jq .
   ```
3. Check Lambda code for bugs
4. Update Lambda function code if needed

#### Cause 2C: Lambda Timeout

**Diagnosis**:
CloudWatch Logs show:
```
Task timed out after 3.00 seconds
```

**Solution**:
1. Go to Lambda console
2. Select function
3. **Configuration** → **General configuration**
4. Increase timeout to 30 seconds
5. Save and retry

---

### Issue 3: "User Already Exists" Error

**Symptoms**:
- Create user operation fails
- Error: "EntityAlreadyExists"

**Diagnosis**:
```bash
# Check if user exists in AWS
aws iam get-user --user-name servicenow-test-user
```

**Solution**:

**Option A**: Use different username
```javascript
// In ServiceNow or via agent:
"Create user servicenow-test-user-002"
```

**Option B**: Delete existing user first
```bash
# List user's access keys
aws iam list-access-keys --user-name servicenow-test-user

# Delete each access key
aws iam delete-access-key \
    --user-name servicenow-test-user \
    --access-key-id AKIAXXXXXXXX

# Detach policies
aws iam detach-user-policy \
    --user-name servicenow-test-user \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Delete user
aws iam delete-user --user-name servicenow-test-user
```

---

### Issue 4: AI Agent Doesn't Call Tool

**Symptoms**:
- Agent responds conversationally but doesn't execute operation
- No API call made

**Possible Causes**:

#### Cause 4A: Unclear Tool Description

**Diagnosis**:
Review agent conversation logs - agent may not understand intent

**Solution**:
Improve tool description with clearer keywords:

```
// Before (unclear):
"This tool does stuff with users"

// After (clear):
"Creates a new AWS IAM user with AmazonS3FullAccess policy attached. 
Generates access key ID and secret access key. Use when user requests 
to create, add, or provision a new IAM user."
```

#### Cause 4B: Missing Input Parameters

**Diagnosis**:
Tool configured but inputs not defined

**Solution**:
1. Go to Agent Studio
2. Select tool
3. Add input parameters:
   - `username` (String, Required)
   - `environment` (String, Optional)
   - `department` (String, Optional)
4. Save and test

#### Cause 4C: Script Syntax Error

**Diagnosis**:
Check ServiceNow script execution logs:
```
Script error: SyntaxError: Unexpected token
```

**Solution**:
1. Navigate to **System Logs** → **Script Execution History**
2. Find failed execution
3. Review error message
4. Fix syntax error in script
5. Validate JavaScript:
   ```javascript
   // Use online validator or:
   node -c script.js
   ```

---

### Issue 5: "NoSuchEntity" / User Not Found

**Symptoms**:
- Get or delete operation fails
- Error: "User not found"

**Diagnosis**:
```bash
# Verify user doesn't exist
aws iam get-user --user-name nonexistent-user
# Output: An error occurred (NoSuchEntity)
```

**Solution**:
1. List all users to verify:
   ```bash
   aws iam list-users
   ```
2. Check for typos in username
3. Verify user wasn't deleted previously

---

### Issue 6: Script Timeout in ServiceNow

**Symptoms**:
- ServiceNow script execution takes too long
- Timeout error in ServiceNow logs

**Possible Causes**:

#### Cause 6A: Lambda Cold Start

**Diagnosis**:
First request after idle period takes 5-10 seconds

**Solution**:
- Expected behavior for serverless
- Subsequent requests will be faster
- Consider provisioned concurrency for production

#### Cause 6B: Network Latency

**Diagnosis**:
Consistent slow response times

**Solution**:
1. Check ServiceNow outbound connection settings
2. Verify no proxy/firewall blocking
3. Test API Gateway directly:
   ```bash
   time curl -X POST https://YOUR-API-GATEWAY-URL \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR-KEY" \
     -d '{"operation": "list_users"}'
   ```

---

### Issue 7: Cannot Parse Response

**Symptoms**:
- ServiceNow script error: "Cannot parse JSON"
- Unexpected response format

**Diagnosis**:
Log the raw response:
```javascript
var responseBody = response.getBody();
gs.info('Raw response: ' + responseBody);
```

**Common Causes**:

#### Cause 7A: HTML Error Page Returned

**Example**:
```html
<!DOCTYPE html>
<html>
<head><title>403 Forbidden</title></head>
...
```

**Solution**:
- This is an authentication error
- Follow steps for "403 Forbidden" above

#### Cause 7B: API Gateway Error Format

**Example**:
```json
{"message":"Forbidden"}
```

**Solution**:
Update script to handle API Gateway error format:
```javascript
var result = JSON.parse(responseBody);

if (result.message && httpStatus != 200) {
    return {
        success: 'false',
        error: result.message,
        message: 'API Gateway error'
    };
}
```

---

### Issue 8: Throttling Errors

**Symptoms**:
- HTTP 429 "Too Many Requests"
- Some requests succeed, others fail

**Diagnosis**:
Check API Gateway CloudWatch metrics:
- Metric: `Throttles`
- Namespace: `AWS/ApiGateway`

**Solution**:

**Short-term**:
```bash
# Increase usage plan limits
aws apigateway update-usage-plan \
    --usage-plan-id YOUR-PLAN-ID \
    --patch-operations \
        op=replace,path=/throttle/rateLimit,value=100 \
        op=replace,path=/throttle/burstLimit,value=200
```

**Long-term**:
- Implement request batching
- Add retry logic with exponential backoff
- Cache frequent queries (e.g., list_users)

---

### Issue 9: Credentials Not Working

**Symptoms**:
- Created user, received credentials
- Credentials don't work for S3 access

**Diagnosis**:
```bash
# Test credentials
export AWS_ACCESS_KEY_ID="AKIAXXXXXXXX"
export AWS_SECRET_ACCESS_KEY="secret..."
aws s3 ls
```

**Possible Causes**:

#### Cause 9A: Policy Not Attached

**Check**:
```bash
aws iam list-attached-user-policies --user-name servicenow-user-001
```

**Solution**:
```bash
aws iam attach-user-policy \
    --user-name servicenow-user-001 \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

#### Cause 9B: Credential Propagation Delay

**Info**: AWS IAM changes can take up to 60 seconds to propagate

**Solution**: Wait 1-2 minutes, then retry

#### Cause 9C: Access Key Inactive

**Check**:
```bash
aws iam list-access-keys --user-name servicenow-user-001
```

**Solution**:
```bash
aws iam update-access-key \
    --user-name servicenow-user-001 \
    --access-key-id AKIAXXXXXXXX \
    --status Active
```

---

## Diagnostic Commands

### Check API Gateway Status

```bash
# List APIs
aws apigateway get-rest-apis

# Get API details
aws apigateway get-rest-api --rest-api-id YOUR-API-ID

# List deployments
aws apigateway get-deployments --rest-api-id YOUR-API-ID

# Get stage details
aws apigateway get-stage \
    --rest-api-id YOUR-API-ID \
    --stage-name prod
```

### Check Lambda Function

```bash
# Get function configuration
aws lambda get-function --function-name ServiceNowIAMProxy

# Get function policy
aws lambda get-policy --function-name ServiceNowIAMProxy

# Invoke function directly
aws lambda invoke \
    --function-name ServiceNowIAMProxy \
    --payload '{"body": "{\"operation\": \"list_users\"}"}' \
    response.json

cat response.json
```

### Check IAM Permissions

```bash
# Test IAM permissions
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::ACCOUNT:role/lambda-role \
    --action-names iam:CreateUser iam:AttachUserPolicy \
    --resource-arns arn:aws:iam::ACCOUNT:user/*

# List role policies
aws iam list-role-policies --role-name ServiceNowIAMProxy-role

# Get policy details
aws iam get-role-policy \
    --role-name ServiceNowIAMProxy-role \
    --policy-name PolicyName
```

### Check CloudWatch Logs

```bash
# List log streams
aws logs describe-log-streams \
    --log-group-name /aws/lambda/ServiceNowIAMProxy \
    --order-by LastEventTime \
    --descending \
    --max-items 5

# Get recent logs
aws logs tail /aws/lambda/ServiceNowIAMProxy --follow
```

### Check CloudTrail Events

```bash
# List recent IAM events
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::IAM::User \
    --max-items 10
```

---

## Log Analysis

### Reading Lambda CloudWatch Logs

**Normal execution**:
```
START RequestId: abc123...
INFO Creating user: servicenow-test-user
INFO User created successfully: servicenow-test-user
INFO Attached AmazonS3FullAccess policy
INFO Access key created
END RequestId: abc123...
REPORT RequestId: abc123... Duration: 1243.21 ms
```

**Error patterns**:

**Access Denied**:
```
ERROR AWS ClientError: An error occurred (AccessDenied)
```
→ Check Lambda execution role permissions

**Invalid Parameter**:
```
ERROR AWS ClientError: Invalid username format
```
→ Check input validation

**Timeout**:
```
Task timed out after 30.00 seconds
```
→ Increase Lambda timeout

---

## Performance Troubleshooting

### Slow Response Times

**Diagnose**:
1. Check API Gateway latency metrics
2. Check Lambda duration metrics
3. Check IAM API response times

**Common Causes**:

| Issue | Duration | Solution |
|-------|----------|----------|
| Lambda cold start | 2-5s | Provisioned concurrency |
| IAM API latency | 0.5-2s | Normal, no action needed |
| Network latency | 0.1-0.5s | Check ServiceNow network |
| List users with many results | 2-10s | Implement pagination |

---

## Getting Help

If you can't resolve the issue:

1. **Gather diagnostic information**:
   - ServiceNow script execution logs
   - Lambda CloudWatch logs
   - API Gateway execution logs
   - CloudTrail events
   - Request/response payloads (sanitized)

2. **Create detailed issue report**:
   - What operation was attempted
   - Expected vs actual behavior
   - Error messages (complete text)
   - Timestamps
   - Steps to reproduce

3. **Check resources**:
   - GitHub issues (this repository)
   - AWS documentation
   - ServiceNow community
   - Stack Overflow

4. **Contact support**:
   - GitHub: Create issue
   - AWS Support: For AWS-specific issues
   - ServiceNow Support: For ServiceNow-specific issues

---

## Preventive Measures

To avoid common issues:

- [ ] Always test in development before production
- [ ] Use meaningful usernames (include timestamp/purpose)
- [ ] Implement error handling in scripts
- [ ] Monitor CloudWatch metrics regularly
- [ ] Keep API keys secure and rotate periodically
- [ ] Document custom configurations
- [ ] Maintain backups of Lambda code
- [ ] Test after any AWS or ServiceNow updates
- [ ] Review logs regularly for warnings
- [ ] Set up CloudWatch alarms for critical errors
