/**
 * PathCourse Health -- Node.js Integration Example
 * =================================================
 * Demonstrates the full Pattern 1 flow:
 *   discover -> pay USDC on Base -> get API key -> ongoing inference
 *
 * Requirements:
 *   npm install ethers
 *
 * Environment variables:
 *   PCH_WALLET_KEY  - Your wallet's private key (hex, with or without 0x prefix)
 *
 * Usage:
 *   export PCH_WALLET_KEY=0xYourPrivateKey
 *   node pch_client.js
 */

'use strict';

const https  = require('https');
const { URL } = require('url');
const { ethers } = require('ethers');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GATEWAY_URL   = 'https://gateway.pathcoursehealth.com';
const AGENT_CARD    = `${GATEWAY_URL}/.well-known/agent.json`;
const CHAT_ENDPOINT = `${GATEWAY_URL}/v1/chat/completions`;

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const CHAIN_ID      = 8453; // Base mainnet
const BASE_RPC      = 'https://mainnet.base.org';

// Standard ERC-20 ABI subset -- only the transfer function
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple HTTPS JSON request using the native https module. */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  { 'Content-Type': 'application/json', ...(options.headers || {}) },
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(body); } catch { json = null; }
        resolve({
          status:  res.statusCode,
          headers: res.headers,
          body:    json,
          raw:     body,
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

/** Pause execution for a given number of milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Step 1 -- Discover: fetch the agent card
// ---------------------------------------------------------------------------

async function discover() {
  console.log('\n--- Step 1: Discover ---');
  const resp = await request(AGENT_CARD);
  if (resp.status !== 200) {
    console.error(`Failed to fetch agent card: ${resp.status}`);
    process.exit(1);
  }
  const card = resp.body;
  console.log(`Agent:    ${card.agent_name} v${card.version}`);
  console.log(`Models:   ${card.capabilities[0].models_available.join(', ')}`);
  console.log(`Network:  ${card.payment.network} (chain ${card.payment.chain_id})`);
  console.log(`Treasury: ${card.payment.treasury_wallet}`);
  return card;
}

// ---------------------------------------------------------------------------
// Step 2 -- First request: get a 402 with payment instructions
// ---------------------------------------------------------------------------

async function getPaymentInstructions() {
  console.log('\n--- Step 2: Get 402 payment instructions ---');
  const payload = {
    model:      'pch-fast',
    messages:   [{ role: 'user', content: 'Hello, PCH!' }],
    max_tokens: 50,
  };

  const resp = await request(CHAT_ENDPOINT, { method: 'POST', body: payload });

  if (resp.status !== 402) {
    console.error(`Unexpected status ${resp.status}. Expected 402.`);
    console.error(resp.raw);
    process.exit(1);
  }

  const payment = resp.body.payment_required || resp.body;
  console.log(`Amount:     ${payment.amount_usdc} USDC`);
  console.log(`Pay to:     ${payment.pay_to}`);
  console.log(`Context ID: ${payment.payment_context_id}`);
  console.log(`Expires at: ${payment.expires_at}`);
  return payment;
}

// ---------------------------------------------------------------------------
// Step 3 -- Pay: send USDC on Base
// ---------------------------------------------------------------------------

async function sendUsdc(wallet, treasuryWallet, amountUsdc, paymentContextId) {
  console.log('\n--- Step 3: Send USDC on Base ---');

  // Connect to Base mainnet (replace RPC with your own for production)
  const provider = new ethers.JsonRpcProvider(BASE_RPC, CHAIN_ID);
  const signer   = new ethers.Wallet(wallet.privateKey, provider);

  const usdc = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, signer);

  // USDC has 6 decimals: 1 USDC = 1_000_000 atomic units
  const amountAtomic = BigInt(Math.round(parseFloat(amountUsdc) * 1_000_000));

  console.log(`Sending ${amountUsdc} USDC (${amountAtomic} atomic) to ${treasuryWallet}...`);

  const tx = await usdc.transfer(treasuryWallet, amountAtomic);
  console.log(`Tx sent: ${tx.hash}`);

  // Wait for confirmation
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    console.error('ERROR: Transaction reverted.');
    process.exit(1);
  }

  console.log(`Confirmed in block ${receipt.blockNumber}`);
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Step 4 -- Resend with proof: get API key + inference response
// ---------------------------------------------------------------------------

async function resendWithProof(paymentContextId, txHash, buyerWallet) {
  console.log('\n--- Step 4: Resend with payment proof ---');

  const proof = JSON.stringify({
    payment_context_id: paymentContextId,
    tx_hash:            txHash,
    buyer_wallet:       buyerWallet,
  });
  const proofB64 = Buffer.from(proof).toString('base64');

  const payload = {
    model:      'pch-fast',
    messages:   [{ role: 'user', content: 'Hello, PCH!' }],
    max_tokens: 50,
  };

  const resp = await request(CHAT_ENDPOINT, {
    method:  'POST',
    body:    payload,
    headers: { 'X-PAYMENT-PROOF': proofB64 },
  });

  if (resp.status !== 200) {
    console.error(`ERROR: Expected 200, got ${resp.status}`);
    console.error(resp.raw);
    process.exit(1);
  }

  // Extract API key and metadata from response headers
  const apiKey  = resp.headers['x-api-key'];
  const tier    = resp.headers['x-pch-tier'];
  const balance = resp.headers['x-pch-balance-usdc'];
  const model   = resp.headers['x-pch-routed-model'];

  console.log(`API Key:  ${apiKey ? apiKey.substring(0, 20) + '...' : '(not found)'}`);
  console.log(`Tier:     ${tier}`);
  console.log(`Balance:  ${balance} USDC`);
  console.log(`Model:    ${model}`);

  // The inference response is in the body
  const content = resp.body.choices[0].message.content;
  console.log(`Response: ${content}`);

  return apiKey;
}

// ---------------------------------------------------------------------------
// Step 5 -- Ongoing requests: use the API key
// ---------------------------------------------------------------------------

async function inference(apiKey, prompt, model = 'pch-fast', maxTokens = 200) {
  const payload = {
    model,
    messages:   [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  };

  const resp = await request(CHAT_ENDPOINT, {
    method:  'POST',
    body:    payload,
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (resp.status !== 200) {
    throw new Error(`Inference failed with status ${resp.status}: ${resp.raw}`);
  }

  const content      = resp.body.choices[0].message.content;
  const balanceLeft  = resp.headers['x-pch-balance-remaining'] || 'unknown';
  const routedModel  = resp.headers['x-pch-routed-model']     || 'unknown';

  return { content, model: routedModel, balance: balanceLeft };
}

// ---------------------------------------------------------------------------
// Main -- run the full flow
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('PathCourse Health -- Node.js Integration Example');
  console.log('='.repeat(60));

  // Load wallet from environment
  const walletKey = process.env.PCH_WALLET_KEY;
  if (!walletKey) {
    console.error('ERROR: Set PCH_WALLET_KEY environment variable to your wallet private key.');
    process.exit(1);
  }
  const wallet = new ethers.Wallet(walletKey);
  console.log(`Wallet loaded: ${wallet.address}`);

  // Step 1: Discover
  const card = await discover();

  // Step 2: Get payment instructions (402)
  const payment = await getPaymentInstructions();

  // Step 3: Pay USDC on Base
  const txHash = await sendUsdc(
    wallet,
    payment.pay_to,
    payment.amount_usdc,
    payment.payment_context_id,
  );

  // Brief pause for on-chain detection (Alchemy webhook fires in 1-3s)
  console.log('\nWaiting for on-chain detection...');
  await sleep(5000);

  // Step 4: Resend with proof, get API key
  const apiKey = await resendWithProof(
    payment.payment_context_id,
    txHash,
    wallet.address,
  );

  if (!apiKey) {
    console.error('ERROR: No API key received.');
    process.exit(1);
  }

  // Step 5: Ongoing inference
  console.log('\n--- Step 5: Ongoing inference ---');
  const result = await inference(apiKey, 'Explain x402 in one sentence.');
  console.log(`Model:    ${result.model}`);
  console.log(`Balance:  ${result.balance} USDC`);
  console.log(`Response: ${result.content}`);

  console.log('\n' + '='.repeat(60));
  console.log('Integration complete. Save your API key for future requests.');
  console.log(`API Key: ${apiKey}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
