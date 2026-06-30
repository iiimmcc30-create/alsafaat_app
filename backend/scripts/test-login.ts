// backend/scripts/test-login.ts
import axios from 'axios';

async function main() {
  console.log('📡 Testing local Next.js login API on port 3001...');

  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      login: 'alsafaat@gmail.com',
      password: 'alsafat123'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('🟢 LOGIN SUCCESSFUL via API!');
    console.log('Response Status:', response.status);
    console.log('User:', response.data.user);
  } catch (error: any) {
    if (error.response) {
      console.log('🔴 LOGIN FAILED via API!');
      console.log('Status Code:', error.response.status);
      console.log('Response Data:', error.response.data);
    } else {
      console.log('❌ CONNECTIVITY ERROR: Could not connect to Next.js API server!');
      console.log('Error Message:', error.message);
    }
  }
}

main();
