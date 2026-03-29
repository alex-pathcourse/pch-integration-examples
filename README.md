# PCH Integration Examples

Code examples showing how to integrate with PathCourse Health for LLM inference via USDC on Base.

## What is PCH?

PathCourse Health is an AI token gateway. You pay USDC on the Base network, receive an API key, and make OpenAI-compatible inference requests. No accounts, no signups -- just pay and use.

## Available Models

| Model | Rate (per million tokens) | Tier Required |
|-------|--------------------------|---------------|
| pch-fast | $0.44 | Uncertified+ |
| pch-pro | $1.96 | Bronze+ |
| claude-haiku | 20% over provider cost | Silver+ |
| claude-sonnet | 20% over provider cost | Gold |
| gpt-4o | 20% over provider cost | Gold |

## Quick Start (Python)

```bash
pip install httpx eth-account web3
export PCH_WALLET_KEY=0xYourPrivateKey
python python/pch_client.py
```

## Quick Start (Node.js)

```bash
npm install ethers
export PCH_WALLET_KEY=0xYourPrivateKey
node javascript/pch_client.js
```

## How It Works

1. **Discover** -- Fetch the agent card at `/.well-known/agent.json` to learn about models, pricing, and the treasury wallet.
2. **Get 402** -- Send a POST to `/v1/chat/completions` with no API key. The gateway returns HTTP 402 with payment instructions.
3. **Pay** -- Send the requested USDC amount to the treasury wallet on Base (chain ID 8453).
4. **Resend with proof** -- Resend your request with the `X-PAYMENT-PROOF` header containing the payment context ID, transaction hash, and your wallet address.
5. **Receive API key** -- The response includes your API key in the `X-API-KEY` header, plus the inference result in the body.
6. **Ongoing usage** -- Use `Authorization: Bearer {api_key}` for all future requests.

## Payment Proof Format

The `X-PAYMENT-PROOF` header accepts base64-encoded JSON or plain JSON:

```json
{
  "payment_context_id": "from the 402 response",
  "tx_hash": "your USDC transfer transaction hash",
  "buyer_wallet": "your wallet address"
}
```

## Response Headers

Every inference response includes:

- `X-PCH-Routed-Model` -- which model handled the request
- `X-PCH-Tier` -- your certification tier
- `X-PCH-Balance-Remaining` -- your remaining USDC balance

## Links

- Developer docs: https://gateway.pathcoursehealth.com/docs
- Agent card: https://gateway.pathcoursehealth.com/.well-known/agent.json
- Certification: https://gateway.pathcoursehealth.com/v1/cert/submit
- Legal terms: https://gateway.pathcoursehealth.com/legal/terms.json
