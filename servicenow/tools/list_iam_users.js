(function(inputs) {
    try {
        // Prepare request payload
        var requestBody = {
            operation: 'list_users'
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
            // Format user list for readability
            var userList = [];
            if (result.users && result.users.length > 0) {
                for (var i = 0; i < result.users.length; i++) {
                    var user = result.users[i];
                    userList.push(
                        'Username: ' + user.username + 
                        ', Created: ' + user.created_date + 
                        ', Policies: ' + (user.attached_policies || []).join(', ')
                    );
                }
            }
            
            return {
                success: 'true',
                user_count: result.user_count.toString(),
                users: userList.join(' | '),
                message: 'Retrieved ' + result.user_count + ' IAM users successfully'
            };
        } else {
            return {
                success: 'false',
                error: result.error || 'Unknown error',
                http_status: httpStatus.toString(),
                message: 'Failed to list IAM users'
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
