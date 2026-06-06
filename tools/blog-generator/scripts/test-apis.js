import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const geminiKey = process.env.GEMINI_API_KEY;
const resendKey = process.env.RESEND_API_KEY;
const userEmail = process.env.USER_EMAIL;
const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

console.log('===================================================');
console.log('⚙️ Testing API configurations...');
console.log('===================================================');
console.log(`- Gemini Key: ${geminiKey ? 'Loaded' : 'MISSING'}`);
console.log(`- Resend Key: ${resendKey ? 'Loaded' : 'MISSING'}`);
console.log(`- Recipient Email: ${userEmail}`);
console.log(`- Sender Email: ${senderEmail}`);
console.log('---------------------------------------------------');

async function testGemini() {
  if (!geminiKey) {
    console.error('❌ Skipping Gemini test (API key missing).');
    return false;
  }
  
  try {
    console.log('🤖 Testing Gemini API connection...');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Say: "Gemini API connection successful!"');
    console.log(`✅ Gemini Response: ${result.response.text().trim()}`);
    return true;
  } catch (error) {
    console.error(`❌ Gemini API Error:`, error.message);
    return false;
  }
}

async function testResend() {
  if (!resendKey) {
    console.error('❌ Skipping Resend test (API key missing).');
    return false;
  }
  
  if (!userEmail) {
    console.error('❌ Skipping Resend test (USER_EMAIL missing).');
    return false;
  }
  
  try {
    console.log(`📧 Testing Resend API connection (sending test email to ${userEmail})...`);
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: senderEmail,
      to: userEmail,
      subject: '🧪 Blog Generator Tool - Connection Test',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
          <h2 style="color: #10b981;">✅ Test Successful!</h2>
          <p>This email confirms that your Resend API integration is working correctly with the <strong>christran.io Blog Post Generator Tool</strong>.</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">Sent: ${new Date().toISOString()}</p>
        </div>
      `
    });
    
    if (result.error) {
      console.error(`❌ Resend Error:`, result.error.message);
      return false;
    }
    
    console.log(`✅ Resend Email sent successfully! ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error(`❌ Resend API Error:`, error.message);
    return false;
  }
}

async function runTests() {
  const geminiOk = await testGemini();
  console.log('---------------------------------------------------');
  const resendOk = await testResend();
  console.log('---------------------------------------------------');
  
  if (geminiOk && resendOk) {
    console.log('🎉 SUCCESS: All integrations verified and working!');
  } else {
    console.log('⚠️ WARNING: Some integrations failed. Check the error logs above.');
  }
  console.log('===================================================');
}

runTests();
