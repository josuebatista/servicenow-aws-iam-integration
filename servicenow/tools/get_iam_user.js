(function(inputs) {
    try {
        // Parse inputs
        var username = inputs.username || '';
        
        // Validate username
        if (!username) {
            return {
                success: 'false',
                error: 'Username is required',
                message: 'Please provide a username to retrieve details'
            };
        }
        
        // Prepare request payload
        var requestBody = {
            operation: 'get_user',
            username: username
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
            // Format policies
            var policies = [];
            if (result.attached_policies && result.attached_policies.length > 0) {
                for (var i = 0; i < result.attached_policies.length; i++) {
                    policies.push(result.attached_policies[i].policy_name);
                }
            }
            
            // Format access keys
            var accessKeys = [];
            if (result.access_keys && result.access_keys.length > 0) {
                for (var j = 0; j < result.access_keys.length; j++) {
                    var key = result.access_keys[j];
                    accessKeys.push(key.access_key_id + ' (Status: ' + key.status + ')');
                }
            }
            
            return {
                success: 'true',
                username: result.username,
                arn: result.arn,
                user_id: result.user_id,
                created_date: result.created_date,
                attached_policies: policies.join(', '),
                access_keys: accessKeys.join(', '),
                message: 'User details retrieved successfully'
            };
        } else {
            return {
                success: 'false',
                error: result.error || 'Unknown error',
                http_status: httpStatus.toString(),
                message: 'Failed to retrieve user details'
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
