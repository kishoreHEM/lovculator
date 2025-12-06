import { sendVerificationEmail } from './routes/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('Testing EmailJS...');
  
  const result = await sendVerificationEmail(
    'your-test-email@gmail.com',
    'test-token-123',
    'TestUser'
  );
  
  console.log('Result:', result ? '✅ Success' : '❌ Failed');
}

test();
