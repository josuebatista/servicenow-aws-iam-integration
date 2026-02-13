# API Gateway Setup Guide

This guide walks through setting up a REST API in AWS API Gateway to expose the Lambda function to ServiceNow.

## Prerequisites

- Lambda function `ServiceNowIAMProxy` deployed
- AWS account with API Gateway permissions

## Step-by-Step Setup

### 1. Create REST API

1. Navigate to **API Gateway Console**
2. Click **"Create API"**
3. Select **"REST API"** (not HTTP API)
4. Click **"Build"**
5. Configure:
   - **Choose the protocol**: REST
   - **Create new API**: New API
   - **API name**: `ServiceNowIAMProxy-REST-API`
   - **Description**: `REST API for ServiceNow IAM user management`
   - **Endpoint Type**: Regional
6. Click **"Create API"**

### 2. Create Resource (Optional)

1. In the **Resources** panel, select the root `/`
2. Click **"Actions"** → **"Create Resource"**
3. Configure:
   - **Resource Name**: `iam`
   - **Resource Path**: `/iam`
   - **Enable API Gateway CORS**: ✓ (optional)
4. Click **"Create Resource"**

### 3. Create POST Method

1. Select the resource (`/` or `/iam`)
2. Click **"Actions"** → **"Create Method"**
3. Select **"POST"** from dropdown
4. Click the checkmark ✓
5. Configure:
   - **Integration type**: Lambda Function
   - **Use Lambda Proxy integration**: ✓ (checked)
   - **Lambda Region**: us-east-2 (or your region)
   - **Lambda Function**: ServiceNowIAMProxy
6. Click **"Save"**
7. Click **"OK"** to grant API Gateway permission to invoke Lambda

### 4. Enable API Key Requirement

1. Click on the **POST** method
2. Click **"Method Request"**
3. Under **Settings**, find **API Key Required**
4. Change from `false` to `true`
5. Click the checkmark ✓

### 5. Create API Key

1. In the left sidebar, click **"API Keys"**
2. Click **"Actions"** → **"Create API Key"**
3. Configure:
   - **Name**: `ServiceNow-IAM-API-Key`
   - **API key**: Auto Generate
   - **Description**: API key for ServiceNow IAM integration
4. Click **"Save"**
5. **⚠️ IMPORTANT**: Copy the **API key** value and store it securely

### 6. Create Usage Plan

1. In the left sidebar, click **"Usage Plans"**
2. Click **"Create"**
3. Configure Usage Plan:
   - **Name**: `ServiceNow-IAM-Usage-Plan`
   - **Description**: Usage plan for ServiceNow IAM operations
   - **Enable throttling**: ✓ (optional)
     - **Rate**: 10 requests/second
     - **Burst**: 20 requests
   - **Enable quota**: ✓ (optional)
     - **1000** requests per **Day**
4. Click **"Next"**

### 7. Associate API Stage

1. Click **"Add API Stage"**
2. Select:
   - **API**: ServiceNowIAMProxy-REST-API
   - **Stage**: prod (you'll create this next if it doesn't exist)
3. Click the checkmark ✓
4. Click **"Next"**

### 8. Add API Key to Usage Plan

1. Click **"Add API Key to Usage Plan"**
2. Select the API key: `ServiceNow-IAM-API-Key`
3. Click the checkmark ✓
4. Click **"Done"**

### 9. Deploy API

1. Go back to **"Resources"**
2. Click **"Actions"** → **"Deploy API"**
3. Configure:
   - **Deployment stage**: [New Stage]
   - **Stage name**: `prod`
   - **Stage description**: Production stage for ServiceNow integration
4. Click **"Deploy"**

### 10. Get Invoke URL

After deployment, you'll see the **Invoke URL** at the top of the stage editor:

```
https://{api-id}.execute-api.{region}.amazonaws.com/prod
```

If you created the `/iam` resource, your full endpoint will be:

```
https://{api-id}.execute-api.{region}.amazonaws.com/prod/iam
```

## Testing the API

### Test without API Key (should fail)

```bash
curl -X POST https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/iam \
  -H "Content-Type: application/json" \
  -d '{"operation": "list_users"}'
```

**Expected Response**: 403 Forbidden
```json
{"message":"Forbidden"}
```

### Test with API Key (should succeed)

```bash
curl -X POST https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/iam \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"operation": "list_users"}'
```

**Expected Response**: 200 OK
```json
{
  "operation": "list_users",
  "user_count": 3,
  "users": [...]
}
```

## Configuration for ServiceNow

Update the endpoint in all ServiceNow tool scripts:

```javascript
request.setEndpoint('https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/iam');
request.setRequestHeader('x-api-key', 'YOUR-API-KEY');
```

## Monitoring and Logs

### CloudWatch Logs

Lambda execution logs are available in CloudWatch:
1. Navigate to **CloudWatch Console**
2. Go to **Log groups**
3. Find `/aws/lambda/ServiceNowIAMProxy`

### API Gateway Logs (Optional)

To enable API Gateway execution logs:
1. Go to **API Gateway Console**
2. Select your API
3. Click **"Stages"** → **"prod"**
4. Click **"Logs/Tracing"** tab
5. Enable **CloudWatch Logs**
6. Set **Log level**: INFO or ERROR
7. Enable **Log full requests/responses data** (for debugging)
8. Click **"Save Changes"**

## Troubleshooting

### 403 Forbidden

**Cause**: API key missing or invalid

**Solution**:
- Verify API key is included in header: `x-api-key`
- Confirm API key is associated with usage plan
- Check that usage plan is associated with the API stage

### 502 Bad Gateway

**Cause**: Lambda function error

**Solution**:
- Check CloudWatch Logs for Lambda function
- Verify Lambda has correct IAM execution role
- Test Lambda function directly in AWS Console

### 500 Internal Server Error

**Cause**: Lambda execution error

**Solution**:
- Review CloudWatch Logs for detailed error messages
- Verify IAM permissions for Lambda execution role
- Check Lambda function code for bugs

## Security Best Practices

1. **Rotate API Keys Regularly**: Create new keys and deprecate old ones
2. **Enable CloudTrail**: Track all API Gateway and Lambda invocations
3. **Use VPC Endpoints**: For enhanced security (optional)
4. **Implement Request Validation**: Add request body validation in API Gateway
5. **Enable AWS WAF**: Protect against common web exploits (optional)
6. **Monitor Usage**: Set up CloudWatch alarms for unusual activity

## Cost Optimization

- **API Gateway**: $3.50 per million requests (REST API)
- **Lambda**: Free tier includes 1M requests/month
- **CloudWatch Logs**: $0.50/GB ingested

For proof-of-concept usage, costs should be minimal (< $1/month).
