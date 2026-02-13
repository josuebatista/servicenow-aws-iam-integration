#!/bin/bash

# ServiceNow AWS IAM Integration - cURL Test Examples
# Replace YOUR-API-ID and YOUR-API-KEY with your actual values

API_ENDPOINT="https://0sb9pw9hbj.execute-api.us-east-2.amazonaws.com/default/ServiceNowIAMProxy"
API_KEY="YOUR-API-KEY"  # Replace with your actual API key

echo "========================================"
echo "ServiceNow AWS IAM Integration Tests"
echo "========================================"
echo ""

# Test 1: List Users
echo "Test 1: List All IAM Users"
echo "----------------------------"
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "operation": "list_users"
  }' | jq .
echo ""
echo ""

# Test 2: Create User
echo "Test 2: Create IAM User"
echo "------------------------"
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "operation": "create_user",
    "username": "servicenow-test-user-001",
    "tags": [
      {"Key": "Environment", "Value": "Development"},
      {"Key": "CreatedBy", "Value": "ServiceNow"},
      {"Key": "Purpose", "Value": "Testing"}
    ]
  }' | jq .
echo ""
echo ""

# Test 3: Get User Details
echo "Test 3: Get User Details"
echo "-------------------------"
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "operation": "get_user",
    "username": "servicenow-test-user-001"
  }' | jq .
echo ""
echo ""

# Test 4: Delete User
echo "Test 4: Delete IAM User"
echo "------------------------"
read -p "Do you want to delete the test user? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    curl -X POST $API_ENDPOINT \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d '{
        "operation": "delete_user",
        "username": "servicenow-test-user-001"
      }' | jq .
    echo ""
fi

echo ""
echo "========================================"
echo "Tests Complete"
echo "========================================"
