// Test the transactions API on Railway
const API_URL = 'https://web-production-a13cc.up.railway.app';

async function testAPI() {
  try {
    // First login to get a token
    console.log('Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.token) {
      console.error('Login failed:', loginData);
      return;
    }
    
    console.log('✓ Logged in successfully');
    const token = loginData.token;
    
    // Test getting transactions
    console.log('\nFetching transactions...');
    const txnResponse = await fetch(`${API_URL}/api/transactions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const txnData = await txnResponse.json();
    console.log('Response:', JSON.stringify(txnData, null, 2));
    
    if (txnData.success && txnData.transactions) {
      console.log(`✓ Found ${txnData.transactions.length} transactions`);
      
      if (txnData.transactions.length > 0) {
        console.log('\nSample transaction:');
        console.log(JSON.stringify(txnData.transactions[0], null, 2));
      }
    } else {
      console.error('Failed to fetch transactions');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();
