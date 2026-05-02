import React, { useState, useEffect } from 'react';
import { healthCheck } from '../../services/api';
import { Alert, Button, Box } from '@mui/material';

const ConnectionTest = () => {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  const testConnection = async () => {
    try {
      setStatus('checking');
      const response = await healthCheck();
      setStatus('success');
      setMessage(response.data.message);
    } catch (error) {
      setStatus('error');
      setMessage('Backend connection failed: ' + error.message);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <Box sx={{ mb: 2 }}>
      {status === 'success' && (
        <Alert 
          severity="success" 
          action={
            <Button color="inherit" size="small" onClick={testConnection}>
              TEST AGAIN
            </Button>
          }
        >
          ✅ {message}
        </Alert>
      )}
      {status === 'error' && (
        <Alert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={testConnection}>
              RETRY
            </Button>
          }
        >
          ❌ {message}
        </Alert>
      )}
      {status === 'checking' && (
        <Alert severity="info">
          🔄 Checking backend connection...
        </Alert>
      )}
    </Box>
  );
};

export default ConnectionTest;