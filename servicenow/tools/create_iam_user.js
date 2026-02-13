(function(inputs) {
    try {
        // Parse inputs
        var username = inputs.username || '';
        var environment = inputs.environment || 'Production';
        var department = inputs.department || 'IT';
        
        // Validate username
        if (!username) {
            return {
                success: 'false',
                error: 'Username is required',
                message: 'Please provide a username for the new IAM user'
            };
        }
        
        // Prepare request payload
        var requestBody = {
            operation: 'create_user',
            username: username,
            tags: [
                {Key: 'Environment', Value: environment},
                {Key: 'CreatedBy', Value: 'ServiceNow'},
                {Key: 'Department', Value: department},
                {Key: 'CreatedDate', Value: new GlideDateTime().getDisplayValue()}
            ]
        };
        
        // Make API request
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint('https://0sb9pw9hbj.execute-api.us-east-2.amazonaws.com/default/ServiceNowIAMProxy');
        request.setHttpMethod('POST');
        request.setRequestHeader('Content-Type', 'application/json');
        // TODO: Add API key when available
        // request.setRequestHeader('x-api-key', 'YOUR-API-KEY');
        request.setRequestBody(JSON.stringify(requestBody));
        
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();
        
        // Parse response
        var result = JSON.parse(responseBody);
        
        if (httpStatus == 200) {
            return {
                success: 'true',
                username: result.username,
                arn: result.arn,
                user_id: result.user_id,
                access_key_id: result.access_key_id,
                secret_access_key: result.secret_access_key,
                policy_attached: result.policy_attached,
                created_date: result.created_date,
                message: 'IAM user created successfully',
                warning: 'Store the secret access key securely - it cannot be retrieved again'
            };
        } else {
            return {
                success: 'false',
                error: result.error || 'Unknown error',
                http_status: httpStatus.toString(),
                message: 'Failed to create IAM user'
            };
        }
        
    } catch (e) {
        return {
            success: 'false',
            error: e.message,
            message: 'Script execution error occurred'
        };
    }
})(inputs);
