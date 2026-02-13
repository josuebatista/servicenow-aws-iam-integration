# ServiceNow AI Agent Test Scenarios

This document provides comprehensive test scenarios for validating the AWS IAM Integration Agent.

## Prerequisites

- AI Agent configured in ServiceNow
- API Gateway endpoint configured with API key
- Lambda function deployed and working
- At least one existing IAM user for testing

## Test Scenario 1: Create New IAM User

### Objective
Verify that the agent can create a new IAM user with appropriate tags and permissions.

### Test Steps
1. Open the AI Agent chat interface
2. Enter: "Create a new IAM user called servicenow-test-backup"
3. Observe agent response

### Expected Results
- Agent calls `create_iam_user` tool
- Returns success message with:
  - Username: `servicenow-test-backup`
  - ARN of the new user
  - User ID
  - Access Key ID
  - Secret Access Key
  - Policy attached: `AmazonS3FullAccess`
  - Warning about storing credentials securely

### Validation
1. Log into AWS Console
2. Navigate to IAM → Users
3. Verify `servicenow-test-backup` exists
4. Check user has `AmazonS3FullAccess` policy attached
5. Verify tags are present (Environment, CreatedBy, Department)

---

## Test Scenario 2: Create User with Custom Tags

### Objective
Verify that the agent can create users with custom department and environment tags.

### Test Steps
1. Enter: "Create a new IAM user called servicenow-finance-user for the Finance department in the Production environment"
2. Observe agent response

### Expected Results
- Agent extracts department and environment from conversation
- User created with appropriate tags:
  - Department: Finance
  - Environment: Production

### Validation
1. In AWS Console, check user tags
2. Verify correct tag values

---

## Test Scenario 3: List All Users

### Objective
Verify that the agent can retrieve and display all IAM users.

### Test Steps
1. Enter: "Show me all IAM users"
2. Observe agent response

### Expected Results
- Agent calls `list_iam_users` tool
- Returns formatted list including:
  - Total user count
  - Username for each user
  - Creation date
  - Attached policies

### Validation
1. Compare agent output with AWS Console IAM user list
2. Verify count matches
3. Check sample user details match

---

## Test Scenario 4: Get Specific User Details

### Objective
Verify that the agent can retrieve detailed information about a specific user.

### Test Steps
1. Enter: "What are the details for servicenow-integration user?"
2. Observe agent response

### Expected Results
- Agent calls `get_iam_user` tool with correct username
- Returns detailed information:
  - Username
  - ARN
  - User ID
  - Creation date
  - List of attached policies
  - Access key status (without exposing secret)

### Validation
1. Compare output with AWS Console user details
2. Verify all policies are listed
3. Check access key count and status

---

## Test Scenario 5: Delete IAM User

### Objective
Verify that the agent can safely delete an IAM user.

### Test Steps
1. First create a test user: "Create user servicenow-delete-test"
2. Verify creation successful
3. Enter: "Delete the user servicenow-delete-test"
4. Observe agent response

### Expected Results
- Agent calls `delete_iam_user` tool
- Returns success message confirming:
  - Username deleted
  - All access keys removed
  - All policies detached

### Validation
1. Check AWS Console
2. Verify user no longer exists
3. Confirm no orphaned resources

---

## Test Scenario 6: Error Handling - User Already Exists

### Objective
Verify proper error handling when trying to create a duplicate user.

### Test Steps
1. Create a user: "Create user servicenow-duplicate-test"
2. Try to create same user again: "Create user servicenow-duplicate-test"
3. Observe agent response

### Expected Results
- First creation succeeds
- Second attempt returns error message
- Error clearly states user already exists
- HTTP status 409 (Conflict)

### Validation
1. Only one user exists in AWS Console
2. Error message is clear and actionable

---

## Test Scenario 7: Error Handling - User Not Found

### Objective
Verify proper error handling when querying or deleting non-existent user.

### Test Steps
1. Enter: "Get details for user nonexistent-user-12345"
2. Observe agent response
3. Enter: "Delete user nonexistent-user-12345"
4. Observe agent response

### Expected Results
- Both operations return clear error messages
- Error indicates user not found
- HTTP status 404 (Not Found)
- Agent explains what went wrong

---

## Test Scenario 8: Invalid Username Format

### Objective
Verify validation of username format.

### Test Steps
1. Enter: "Create user my invalid username"
2. Observe agent response

### Expected Results
- Operation fails with validation error
- Error message explains valid username format
- No API call made (validation happens locally)

---

## Test Scenario 9: Conversational Context

### Objective
Verify agent maintains context across multiple interactions.

### Test Steps
1. Enter: "Create a user called servicenow-context-test"
2. Wait for response
3. Enter: "Now get the details for that user"
4. Enter: "Can you delete it?"

### Expected Results
- Agent remembers "that user" refers to servicenow-context-test
- Retrieves correct user details
- Asks for confirmation before deletion
- Deletes correct user

---

## Test Scenario 10: Multiple Operations in Sequence

### Objective
Verify agent can handle a workflow of multiple operations.

### Test Steps
1. Enter: "Create two users: servicenow-ops-user-001 and servicenow-ops-user-002"
2. Enter: "List all users"
3. Enter: "Get details for both ops users"
4. Enter: "Delete both ops users"

### Expected Results
- Agent creates both users (may need two separate tool calls)
- List shows all users including the two new ones
- Details retrieved for both users
- Both users deleted successfully

---

## Test Scenario 11: Missing API Key

### Objective
Verify proper error handling when API key is missing or invalid.

### Test Steps
1. In ServiceNow, comment out the API key line in one tool script
2. Try to use that tool through the agent
3. Observe error

### Expected Results
- HTTP 403 Forbidden error
- Clear error message about authentication
- Agent explains the problem

### Remediation
1. Uncomment API key line
2. Retry operation
3. Verify success

---

## Test Scenario 12: Lambda Timeout

### Objective
Verify behavior when Lambda function takes too long.

### Test Steps
1. In AWS Lambda, reduce timeout to 3 seconds
2. Try to list users (should complete)
3. Try to create user (may timeout if slow)

### Expected Results
- If timeout occurs:
  - ServiceNow receives timeout error
  - Agent explains operation may still be in progress
  - Provides guidance to check AWS Console

### Remediation
1. Increase Lambda timeout
2. Check if user was created in AWS
3. Retry if needed

---

## Performance Test Scenarios

### Scenario P1: Rapid Sequential Requests

**Test**: Create 5 users in quick succession

**Expected**: 
- All requests complete successfully
- No throttling errors (within usage plan limits)
- Consistent response times

### Scenario P2: Large User List

**Test**: List users when account has 50+ users

**Expected**:
- Operation completes within reasonable time (<5 seconds)
- All users returned
- Formatted output is readable

---

## Security Test Scenarios

### Scenario S1: Credential Exposure

**Test**: 
1. Create a user
2. Review agent conversation logs
3. Check ServiceNow system logs

**Expected**:
- Secret access key shown to authorized user in conversation
- No secrets logged in system logs
- Warning about securing credentials displayed

### Scenario S2: Unauthorized Access

**Test**: Log in as user without agent permissions

**Expected**:
- Agent not accessible or operations denied
- Clear error message about permissions

---

## Integration Test Scenarios

### Scenario I1: End-to-End Workflow

**Complete workflow**:
1. ServiceNow receives access request ticket
2. Agent creates IAM user
3. Credentials stored in ServiceNow Credential Store
4. Email notification sent with access details
5. User can immediately access S3

**Expected**: All steps complete successfully, automated

---

## Regression Test Checklist

After any code changes, verify:

- [ ] All 4 basic operations work (create, list, get, delete)
- [ ] Error handling works correctly
- [ ] API key authentication functions
- [ ] Tags are properly applied to created users
- [ ] Credentials are returned securely
- [ ] User deletion removes all associated resources
- [ ] Agent maintains conversational context
- [ ] Multiple sequential operations complete successfully
- [ ] Logs contain appropriate information without secrets

---

## Troubleshooting Common Test Failures

### "Operation not called"
- **Cause**: Tool description unclear to LLM
- **Fix**: Improve tool description with clearer keywords

### "403 Forbidden"
- **Cause**: API key missing or invalid
- **Fix**: Verify API key in script and usage plan association

### "500 Internal Server Error"
- **Cause**: Lambda execution error
- **Fix**: Check CloudWatch Logs for detailed error

### "Username already exists"
- **Cause**: Previous test didn't clean up
- **Fix**: Delete test users manually or use unique names

### "Timeout"
- **Cause**: Lambda cold start or network latency
- **Fix**: Retry operation or increase timeout settings

---

## Test Data Cleanup

After testing, clean up created resources:

```bash
# List all test users
aws iam list-users | grep servicenow-test

# Delete test users (example)
aws iam delete-access-key --user-name servicenow-test-user-001 --access-key-id AKIAXXXXXXX
aws iam detach-user-policy --user-name servicenow-test-user-001 --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam delete-user --user-name servicenow-test-user-001
```

Or use the agent: "Delete all users starting with servicenow-test"

---

## Test Results Template

| Test Scenario | Status | Notes | Date |
|--------------|--------|-------|------|
| Create User | ✅ | All tags applied correctly | 2026-02-13 |
| List Users | ✅ | Formatted output clear | 2026-02-13 |
| Get User | ✅ | All details retrieved | 2026-02-13 |
| Delete User | ✅ | Clean removal | 2026-02-13 |
| Duplicate User | ✅ | Proper error handling | 2026-02-13 |
| User Not Found | ✅ | Clear error message | 2026-02-13 |
| Invalid Username | ✅ | Validation works | 2026-02-13 |
| Context Maintained | ✅ | Agent remembers previous operations | 2026-02-13 |
| Multiple Operations | ✅ | Sequential calls successful | 2026-02-13 |
| API Key Missing | ✅ | 403 error handled | 2026-02-13 |
