# Security Considerations

This document outlines security best practices, potential threats, and mitigation strategies for the ServiceNow-AWS IAM integration.

## Security Model

### Defense in Depth

This integration implements multiple layers of security:

```
┌─────────────────────────────────────────────────┐
│ Layer 1: ServiceNow Access Control              │
│ - User authentication                           │
│ - Role-based access to AI Agent                 │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Layer 2: Network Security                       │
│ - HTTPS/TLS 1.2+ encryption                     │
│ - API Gateway with API key                      │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Layer 3: AWS Authentication                     │
│ - API key validation                            │
│ - Usage plans and rate limiting                 │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Layer 4: Lambda Execution                       │
│ - IAM execution role (least privilege)          │
│ - Input validation                              │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Layer 5: IAM Authorization                      │
│ - Policy-based access control                   │
│ - Resource-level permissions                    │
└─────────────────────────────────────────────────┘
```

## Threat Model

### Threats and Mitigations

#### T1: Unauthorized Access to API

**Threat**: Attacker discovers API endpoint and attempts unauthorized access

**Impact**: High - Could create/delete IAM users, expose credentials

**Likelihood**: Medium

**Mitigations**:
- ✅ API key required for all requests
- ✅ Usage plans limit request rates
- 🔄 Consider: IP whitelisting
- 🔄 Consider: Request signing (AWS Signature V4)
- 🔄 Consider: Web Application Firewall (WAF)

**Detection**:
- CloudWatch metric: 403 errors
- Alert on unusual request patterns
- Monitor requests from unexpected IP addresses

---

#### T2: API Key Exposure

**Threat**: API key leaked through code repository, logs, or unauthorized access

**Impact**: High - Enables unauthorized API access

**Likelihood**: Medium

**Mitigations**:
- ⚠️ Current: API key in ServiceNow script (inline)
- 🔄 Recommended: Move to ServiceNow Credential Store
- ✅ API key not logged in CloudWatch
- 🔄 Consider: Rotate API keys regularly (quarterly)
- 🔄 Consider: Multiple API keys for different environments

**Detection**:
- Monitor for requests from unusual sources
- Track usage patterns per API key
- GitHub secret scanning (if code committed)

**Response**:
```bash
# If API key compromised:
1. Create new API key in API Gateway
2. Associate with usage plan
3. Update ServiceNow scripts
4. Delete compromised key
5. Review CloudWatch logs for unauthorized usage
6. Check IAM for any unauthorized users created
```

---

#### T3: Credential Exposure in ServiceNow

**Threat**: Generated AWS credentials exposed through ServiceNow logs or UI

**Impact**: High - Provides S3 access to attacker

**Likelihood**: Low-Medium

**Mitigations**:
- ✅ Credentials only shown once in agent response
- ⚠️ May be logged in conversation history
- 🔄 Recommended: Store credentials in AWS Secrets Manager
- 🔄 Recommended: Implement auto-rotation
- ✅ Warning message about secure storage

**Detection**:
- Review ServiceNow access logs
- Monitor for unusual S3 access patterns
- CloudTrail logs for S3 API calls

**Response**:
```bash
# If credentials compromised:
1. Delete affected IAM user's access keys
2. Create new access keys
3. Update stored credentials
4. Review S3 access logs for unauthorized activity
5. Consider S3 bucket versioning recovery
```

---

#### T4: Privilege Escalation

**Threat**: Attacker uses created user to escalate privileges beyond S3

**Impact**: High - Could gain broader AWS access

**Likelihood**: Low

**Mitigations**:
- ✅ Users only get AmazonS3FullAccess policy
- ✅ Lambda condition restricts policy attachment
- 🔄 Consider: Permission boundaries
- 🔄 Consider: Service Control Policies (SCPs)

**IAM Policy Condition**:
```json
{
    "Condition": {
        "ArnEquals": {
            "iam:PolicyARN": "arn:aws:iam::aws:policy/AmazonS3FullAccess"
        }
    }
}
```

This prevents Lambda from attaching any policy other than S3FullAccess.

---

#### T5: Lambda Function Compromise

**Threat**: Vulnerability in Lambda code exploited

**Impact**: High - Full IAM management access

**Likelihood**: Low

**Mitigations**:
- ✅ Input validation (username format)
- ✅ Structured error handling (no stack traces)
- ✅ Minimal dependencies (boto3 only)
- 🔄 Consider: Lambda code signing
- 🔄 Consider: Runtime security scanning

**Detection**:
- CloudWatch Logs for unusual errors
- Lambda execution metrics
- VPC Flow Logs (if in VPC)

---

#### T6: Denial of Service

**Threat**: Attacker floods API with requests

**Impact**: Medium - Service unavailable, increased costs

**Likelihood**: Medium

**Mitigations**:
- ✅ API Gateway throttling (10 req/sec)
- ✅ Usage plan quotas (1000 req/day)
- ✅ Lambda reserved concurrency available
- 🔄 Consider: AWS WAF rate-based rules
- 🔄 Consider: CloudFront for DDoS protection

**Detection**:
- CloudWatch alarm: Throttled requests > threshold
- Unusual spike in request volume
- Lambda throttling metrics

---

#### T7: Insider Threat

**Threat**: Authorized ServiceNow user abuses access

**Impact**: Medium-High - Unauthorized user creation

**Likelihood**: Low

**Mitigations**:
- ✅ CloudTrail logs all operations
- ✅ ServiceNow conversation logs
- 🔄 Recommended: Approval workflow for sensitive ops
- 🔄 Recommended: Manager notification for user creation
- 🔄 Consider: Time-based access restrictions

**Detection**:
- Review CloudTrail logs regularly
- Monitor for unusual patterns (bulk creation)
- ServiceNow audit logs

---

## Best Practices Implementation

### 1. API Key Management

**Current State**: API key hardcoded in scripts ⚠️

**Recommended Implementation**:

```javascript
// Instead of:
request.setRequestHeader('x-api-key', 'abc123...');

// Use ServiceNow Credential Store:
var credential = new GlideCredential('aws_iam_api_key');
var apiKey = credential.getPassword();
request.setRequestHeader('x-api-key', apiKey);
```

**Setup Steps**:
1. Navigate to **Credentials** in ServiceNow
2. Create new credential: `aws_iam_api_key`
3. Type: API Key
4. Store API key value
5. Update all tool scripts to use credential

---

### 2. Credential Storage (AWS Secrets Manager)

**Recommended Architecture**:

```
ServiceNow Agent → Lambda → IAM (create user)
                     ↓
                 Secrets Manager (store credentials)
                     ↓
              Return Secret ARN to ServiceNow
```

**Benefits**:
- Centralized secret storage
- Automatic rotation support
- Audit trail of access
- No credentials in ServiceNow

**Implementation** (Lambda modification):

```python
import boto3
import json

secrets_manager = boto3.client('secretsmanager')

def create_user_with_s3_access(username, tags):
    # ... existing user creation code ...
    
    # Store credentials in Secrets Manager
    secret_name = f"servicenow/iam/{username}"
    secret_value = {
        "username": username,
        "access_key_id": access_key['AccessKeyId'],
        "secret_access_key": access_key['SecretAccessKey']
    }
    
    secrets_manager.create_secret(
        Name=secret_name,
        SecretString=json.dumps(secret_value),
        Tags=tags
    )
    
    return {
        'operation': 'create_user',
        'username': username,
        'arn': user_arn,
        'secret_arn': f"arn:aws:secretsmanager:us-east-2:ACCOUNT:secret:{secret_name}",
        'message': 'User created and credentials stored in Secrets Manager'
        # Do NOT return actual credentials
    }
```

---

### 3. CloudTrail Configuration

**Enable CloudTrail** for complete audit trail:

```bash
aws cloudtrail create-trail \
    --name servicenow-iam-audit \
    --s3-bucket-name my-cloudtrail-bucket

aws cloudtrail start-logging \
    --name servicenow-iam-audit

# Enable S3 data events
aws cloudtrail put-event-selectors \
    --trail-name servicenow-iam-audit \
    --event-selectors '[
        {
            "ReadWriteType": "All",
            "IncludeManagementEvents": true,
            "DataResources": [
                {
                    "Type": "AWS::IAM::User",
                    "Values": ["arn:aws:iam::ACCOUNT:user/*"]
                }
            ]
        }
    ]'
```

**What Gets Logged**:
- All IAM user operations (create, delete, update)
- Policy attachments
- Access key generation
- Who performed each action (Lambda execution role)
- When operations occurred
- Source IP (API Gateway)

---

### 4. Least Privilege IAM Policies

**Lambda Execution Role** - Current vs Recommended:

**Current** (functional but broad):
```json
{
    "Action": "iam:*",
    "Resource": "*"
}
```

**Recommended** (least privilege):
```json
{
    "Action": [
        "iam:CreateUser",
        "iam:GetUser",
        "iam:ListUsers",
        "iam:DeleteUser",
        "iam:CreateAccessKey",
        "iam:DeleteAccessKey",
        "iam:ListAccessKeys",
        "iam:AttachUserPolicy",
        "iam:DetachUserPolicy",
        "iam:ListAttachedUserPolicies",
        "iam:TagUser"
    ],
    "Resource": [
        "arn:aws:iam::ACCOUNT:user/servicenow-*"
    ],
    "Condition": {
        "StringEquals": {
            "iam:PolicyARN": "arn:aws:iam::aws:policy/AmazonS3FullAccess"
        }
    }
}
```

**Additional restriction**: Only allow operations on users with `servicenow-` prefix.

---

### 5. Network Isolation (Optional - Enhanced Security)

Deploy Lambda in VPC with private subnets:

```
┌─────────────────────────────────────┐
│             VPC                     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Private Subnet                │ │
│  │                                │ │
│  │  ┌──────────────────────┐     │ │
│  │  │  Lambda Function      │     │ │
│  │  │  (No internet access) │     │ │
│  │  └──────────┬────────────┘     │ │
│  │             │                  │ │
│  │             │ VPC Endpoint     │ │
│  │             ▼                  │ │
│  │  ┌──────────────────────┐     │ │
│  │  │  IAM VPC Endpoint     │     │ │
│  │  └──────────────────────┘     │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Benefits**:
- Lambda has no internet access
- All AWS API calls via VPC endpoints
- Enhanced network security

**Trade-offs**:
- Added complexity
- VPC endpoint costs (~$7/month per endpoint)
- May not be necessary for proof-of-concept

---

### 6. Monitoring and Alerting

**CloudWatch Alarms to Create**:

```bash
# 1. High error rate
aws cloudwatch put-metric-alarm \
    --alarm-name servicenow-iam-high-errors \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1

# 2. API Gateway 403 errors
aws cloudwatch put-metric-alarm \
    --alarm-name servicenow-iam-unauthorized \
    --metric-name 4XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold

# 3. Unusual user creation volume
aws cloudwatch put-metric-alarm \
    --alarm-name servicenow-iam-high-creation \
    --metric-name Invocations \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 3600 \
    --threshold 50 \
    --comparison-operator GreaterThanThreshold
```

**SNS Topic for Notifications**:
```bash
aws sns create-topic --name servicenow-iam-alerts
aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-2:ACCOUNT:servicenow-iam-alerts \
    --protocol email \
    --notification-endpoint security@company.com
```

---

### 7. Access Key Rotation

**Recommended**: Implement automatic rotation policy

**Strategy**:
1. Every 90 days, generate new access key
2. Update stored credentials
3. Test new key works
4. Delete old key
5. Notify user/system

**Lambda Function** (scheduled via EventBridge):
```python
def rotate_access_keys(event, context):
    iam = boto3.client('iam')
    
    # List all servicenow-* users
    users = iam.list_users()['Users']
    sn_users = [u for u in users if u['UserName'].startswith('servicenow-')]
    
    for user in sn_users:
        username = user['UserName']
        
        # Get access keys
        keys = iam.list_access_keys(UserName=username)['AccessKeyMetadata']
        
        for key in keys:
            # Check if key is > 90 days old
            age = (datetime.now(timezone.utc) - key['CreateDate']).days
            
            if age > 90:
                # Create new key
                new_key = iam.create_access_key(UserName=username)
                
                # Store in Secrets Manager
                # ... update secret ...
                
                # Delete old key
                iam.delete_access_key(
                    UserName=username,
                    AccessKeyId=key['AccessKeyId']
                )
                
                # Send notification
                sns.publish(
                    TopicArn='arn:aws:sns:...',
                    Subject=f'Rotated access key for {username}',
                    Message=f'New key created, old key deleted'
                )
```

---

## Compliance Considerations

### GDPR / Data Privacy

**Personal Data**: IAM usernames may contain personal identifiers

**Compliance Steps**:
- Document data retention policy
- Implement data deletion procedures
- Maintain audit logs for 7 years (configurable)
- Provide user data export capability

### SOC 2 / ISO 27001

**Control Requirements**:
- ✅ Access control (authentication & authorization)
- ✅ Audit logging (CloudTrail + CloudWatch)
- ✅ Encryption in transit (HTTPS)
- 🔄 Encryption at rest (Secrets Manager)
- 🔄 Regular access reviews
- 🔄 Incident response procedures

### PCI DSS (if applicable)

**Requirements**:
- Strong access control measures
- Tracking and monitoring all access
- Regular testing of security systems
- Maintain information security policy

---

## Security Checklist

### Initial Deployment

- [ ] API Gateway deployed with API key requirement
- [ ] Usage plan configured with throttling limits
- [ ] Lambda execution role uses least-privilege permissions
- [ ] CloudTrail enabled for IAM operations
- [ ] CloudWatch Logs retention set to 30 days
- [ ] ServiceNow agent access restricted to authorized users
- [ ] API key stored securely (not in code repository)

### Ongoing Operations

- [ ] Review CloudTrail logs monthly
- [ ] Rotate API keys quarterly
- [ ] Audit created IAM users monthly
- [ ] Review Lambda function permissions quarterly
- [ ] Test incident response procedures annually
- [ ] Update security documentation as needed

### Advanced Security (Recommended for Production)

- [ ] Move API key to ServiceNow Credential Store
- [ ] Implement AWS Secrets Manager integration
- [ ] Enable automatic access key rotation
- [ ] Deploy Lambda in VPC with VPC endpoints
- [ ] Enable AWS WAF on API Gateway
- [ ] Implement approval workflow for user creation
- [ ] Set up comprehensive CloudWatch dashboards
- [ ] Configure SNS alerts for security events
- [ ] Enable AWS Config for compliance tracking
- [ ] Implement permission boundaries for created users

---

## Incident Response Procedures

### Suspected API Key Compromise

1. **Immediate Actions** (< 15 minutes):
   ```bash
   # Disable API key
   aws apigateway update-api-key \
       --api-key YOUR-KEY-ID \
       --patch-operations op=replace,path=/enabled,value=false
   ```

2. **Investigation** (< 1 hour):
   - Review CloudWatch Logs for unusual patterns
   - Check CloudTrail for unauthorized operations
   - Identify source IPs of suspicious requests

3. **Remediation** (< 4 hours):
   - Create new API key
   - Update ServiceNow scripts
   - Delete compromised key
   - Review all users created in suspicious timeframe

4. **Recovery** (< 8 hours):
   - Verify all legitimate users still functional
   - Test all agent operations
   - Document incident and lessons learned

### Unauthorized IAM User Created

1. **Immediate Actions**:
   ```bash
   # Delete user and all credentials
   aws iam delete-access-key --user-name SUSPICIOUS-USER --access-key-id KEY
   aws iam detach-user-policy --user-name SUSPICIOUS-USER --policy-arn POLICY
   aws iam delete-user --user-name SUSPICIOUS-USER
   ```

2. **Investigation**:
   - Review CloudTrail for creation event
   - Identify who/what created the user
   - Check if credentials were used

3. **Remediation**:
   - Rotate compromised credentials
   - Review and strengthen access controls
   - Update monitoring rules

---

## Security Contact

For security issues:
- Create GitHub issue (for non-sensitive issues)
- Email: security@yourcompany.com (for sensitive disclosures)
- AWS Support (for AWS-specific security concerns)
