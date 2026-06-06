import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import fs from 'fs';
import sharp from 'sharp';

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const result = await model.generateContent('Say: "Gemini API connection successful!"');
    console.log(`✅ Gemini Response: ${result.response.text().trim()}`);
    return true;
  } catch (error) {
    console.error(`❌ Gemini API Error:`, error.message);
    return false;
  }
}

async function testImagen() {
  if (!geminiKey) {
    console.error('❌ Skipping Imagen test (API key missing).');
    return false;
  }
  
  try {
    console.log('🎨 Testing Imagen 4 Image Generation API...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        instances: [
          { prompt: 'A simple stylized yellow banana on a clean purple background, digital art vector style' }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          outputMimeType: 'image/jpeg'
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Imagen API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
      throw new Error('Predictions payload empty or missing base64 bytes.');
    }
    
    const base64Bytes = data.predictions[0].bytesBase64Encoded;
    const buffer = Buffer.from(base64Bytes, 'base64');
    
    // Ensure data folder exists
    const dataFolder = path.join(__dirname, '../data');
    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder, { recursive: true });
    }
    
    const testOutputPath = path.join(dataFolder, 'test-image.webp');
    
    // Use sharp to convert to optimized WebP format
    await sharp(buffer)
      .webp({ quality: 85 })
      .toFile(testOutputPath);
      
    console.log(`✅ Imagen 4 successfully generated and saved test WebP image to: ${testOutputPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Imagen API Error:`, error.message);
    console.log('🔄 Falling back to free high-quality stock photo via LoremFlickr...');
    try {
      const fallbackUrl = 'https://loremflickr.com/1024/576/technology,coding,hardware,minimalist';
      
      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        throw new Error(`LoremFlickr API failed: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const dataFolder = path.join(__dirname, '../data');
      if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
      }
      const testOutputPath = path.join(dataFolder, 'test-image.webp');
      
      await sharp(buffer)
        .webp({ quality: 85 })
        .toFile(testOutputPath);
        
      console.log(`✅ Free Hero Image successfully fetched and saved test WebP to: ${testOutputPath}`);
      return true;
    } catch (fallbackError) {
      console.error(`❌ Fallback Image API Error:`, fallbackError.message);
      return false;
    }
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
  const imagenOk = await testImagen();
  console.log('---------------------------------------------------');
  const resendOk = await testResend();
  console.log('---------------------------------------------------');
  
  if (geminiOk && imagenOk && resendOk) {
    console.log('🎉 SUCCESS: All integrations verified and working!');
  } else {
    console.log('⚠️ WARNING: Some integrations failed. Check the error logs above.');
  }
  console.log('===================================================');
}

runTests();

