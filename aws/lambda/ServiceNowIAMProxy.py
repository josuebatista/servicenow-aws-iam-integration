import json
import boto3
from botocore.exceptions import ClientError
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize IAM client
iam = boto3.client('iam')

def lambda_handler(event, context):
    """
    ServiceNow IAM Proxy - Handles IAM user operations for ServiceNow
    
    Expected input (JSON body):
    {
        "operation": "create_user" | "delete_user" | "list_users" | "get_user",
        "username": "user-name",     (required for create_user, delete_user, get_user)
        "tags": [                    (optional, for create_user)
            {"Key": "Environment", "Value": "Production"}
        ]
    }
    """
    
    try:
        # Parse request body (same pattern as ServiceNowS3Proxy)
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        operation = body.get('operation')
        username = body.get('username')
        tags = body.get('tags', [])
        
        # Validate operation
        if not operation:
            return error_response('Missing required parameter: operation')
        
        # Validate username format for operations that need it
        if operation in ['create_user', 'delete_user', 'get_user']:
            if not username:
                return error_response(f'{operation} requires username parameter')
            if not is_valid_username(username):
                return error_response('Invalid username format. Must contain only alphanumeric characters and +=,.@_-')
        
        # Route to appropriate IAM operation
        if operation == 'create_user':
            result = create_user_with_s3_access(username, tags)
            
        elif operation == 'delete_user':
            result = delete_user(username)
            
        elif operation == 'list_users':
            result = list_users()
            
        elif operation == 'get_user':
            result = get_user_details(username)
            
        else:
            return error_response(f'Unknown operation: {operation}')
        
        return {
            'statusCode': 200,
            'body': json.dumps(result),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'  # Enable CORS if needed
            }
        }
        
    except ClientError as e:
        logger.error(f"AWS ClientError: {str(e)}")
        return error_response(f"AWS error: {e.response['Error']['Message']}", 500)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return error_response(f"Error: {str(e)}", 500)


def create_user_with_s3_access(username, tags):
    """Create IAM user with S3 full access and generate access keys"""
    
    logger.info(f"Creating user: {username}")
    
    # Create the user
    create_user_response = iam.create_user(
        UserName=username,
        Tags=tags
    )
    logger.info(f"User created successfully: {username}")
    
    # Attach AmazonS3FullAccess policy
    policy_arn = 'arn:aws:iam::aws:policy/AmazonS3FullAccess'
    iam.attach_user_policy(
        UserName=username,
        PolicyArn=policy_arn
    )
    logger.info(f"Attached AmazonS3FullAccess policy to user: {username}")
    
    # Create access key
    access_key_response = iam.create_access_key(
        UserName=username
    )
    
    access_key = access_key_response['AccessKey']
    
    logger.info(f"Access key created for user: {username}")
    
    return {
        'operation': 'create_user',
        'username': username,
        'arn': create_user_response['User']['Arn'],
        'user_id': create_user_response['User']['UserId'],
        'created_date': create_user_response['User']['CreateDate'].isoformat(),
        'access_key_id': access_key['AccessKeyId'],
        'secret_access_key': access_key['SecretAccessKey'],
        'policy_attached': policy_arn,
        'message': 'User created successfully',
        'warning': 'Store the secret access key securely. It cannot be retrieved again.'
    }


def delete_user(username):
    """Delete IAM user (detach policies and delete access keys first)"""
    
    logger.info(f"Deleting user: {username}")
    
    # List and delete all access keys
    access_keys = iam.list_access_keys(UserName=username)
    for key in access_keys['AccessKeyMetadata']:
        iam.delete_access_key(
            UserName=username,
            AccessKeyId=key['AccessKeyId']
        )
        logger.info(f"Deleted access key: {key['AccessKeyId']}")
    
    # List and detach all policies
    attached_policies = iam.list_attached_user_policies(UserName=username)
    for policy in attached_policies['AttachedPolicies']:
        iam.detach_user_policy(
            UserName=username,
            PolicyArn=policy['PolicyArn']
        )
        logger.info(f"Detached policy: {policy['PolicyArn']}")
    
    # Delete the user
    iam.delete_user(UserName=username)
    logger.info(f"User deleted successfully: {username}")
    
    return {
        'operation': 'delete_user',
        'username': username,
        'message': 'User deleted successfully'
    }


def list_users():
    """List all IAM users"""
    
    logger.info("Listing all users")
    
    response = iam.list_users()
    
    users = []
    for user in response['Users']:
        # Try to get attached policies for each user
        try:
            policies = iam.list_attached_user_policies(UserName=user['UserName'])
            policy_names = [p['PolicyName'] for p in policies['AttachedPolicies']]
        except ClientError:
            policy_names = ['N/A']
        
        users.append({
            'username': user['UserName'],
            'arn': user['Arn'],
            'user_id': user['UserId'],
            'created_date': user['CreateDate'].isoformat(),
            'attached_policies': policy_names
        })
    
    return {
        'operation': 'list_users',
        'user_count': len(users),
        'users': users
    }


def get_user_details(username):
    """Get details about a specific user"""
    
    logger.info(f"Getting user details: {username}")
    
    # Get user information
    user = iam.get_user(UserName=username)
    
    # Get attached policies
    policies = iam.list_attached_user_policies(UserName=username)
    
    # Get access keys
    access_keys = iam.list_access_keys(UserName=username)
    
    return {
        'operation': 'get_user',
        'username': user['User']['UserName'],
        'arn': user['User']['Arn'],
        'user_id': user['User']['UserId'],
        'created_date': user['User']['CreateDate'].isoformat(),
        'attached_policies': [
            {
                'policy_name': p['PolicyName'],
                'policy_arn': p['PolicyArn']
            } for p in policies['AttachedPolicies']
        ],
        'access_keys': [
            {
                'access_key_id': key['AccessKeyId'],
                'status': key['Status'],
                'created_date': key['CreateDate'].isoformat()
            } for key in access_keys['AccessKeyMetadata']
        ]
    }


def is_valid_username(username):
    """Validate IAM username format"""
    import re
    # IAM usernames can contain alphanumeric characters and +=,.@_-
    pattern = r'^[\w+=,.@-]+$'
    return bool(re.match(pattern, username)) and 1 <= len(username) <= 64


def error_response(message, status_code=400):
    """Return error response (matches ServiceNowS3Proxy pattern)"""
    return {
        'statusCode': status_code,
        'body': json.dumps({'error': message}),
        'headers': {'Content-Type': 'application/json'}
    }
