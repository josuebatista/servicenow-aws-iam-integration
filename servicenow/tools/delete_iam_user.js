(function(inputs) {
    try {
        // Parse inputs
        var username = inputs.username || '';
        
        // Validate username
        if (!username) {
            return {
                success: 'false',
                error: 'Username is required',
                message: 'Please provide a username to delete'
            };
        }
        
        // Prepare request payload
        var requestBody = {
            operation: 'delete_user',
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
            return {
                success: 'true',
                username: result.username,
                message: 'IAM user deleted successfully. All access keys and policies have been removed.'
            };
        } else {
            return {
                success: 'false',
                error: result.error || 'Unknown error',
                http_status: httpStatus.toString(),
                message: 'Failed to delete IAM user'
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
