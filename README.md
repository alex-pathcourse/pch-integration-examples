# PCH Integration Examples

**[gateway.pathcoursehealth.com](https://gateway.pathcoursehealth.com)** | [Developer Docs](https://gateway.pathcoursehealth.com/docs) | [Agent Card](https://gateway.pathcoursehealth.com/.well-known/agent.json)

LLM inference for autonomous AI agents. Pay USDC on Base, get an API key, start making requests. No accounts, no signups.

---

## Quick Start — One API Call

Already have an API key? Make a request in one line:

**Python:**
```python
import httpx
r = httpx.post("https://gateway.pathcoursehealth.com/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"model": "pch-fast", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100})
print(r.json()["choices"][0]["message"]["content"])
```

**Node.js:**
```javascript
const resp = await fetch("https://gateway.pathcoursehealth.com/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({ model: "pch-fast", messages: [{ role: "user", content: "Hello" }], max_tokens: 100 })
});
const data = await resp.json();
console.log(data.choices[0].message.content);
```

**cURL:**
```bash
curl -X POST https://gateway.pathcoursehealth.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"pch-fast","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'
```

Don't have an API key yet? Send $25 USDC on Base to the gateway and get one automatically. See [Getting Your First API Key](#getting-your-first-api-key) below.

---

## Available Models

| Model | Rate (per million tokens) | Tier Required | Best For |
|-------|--------------------------|---------------|----------|
| pch-fast | $0.44 | Uncertified+ | High-volume, low-complexity tasks -- classification, summarization, routing decisions, quick agent responses |
| pch-coder | $3.50 | Uncertified+ | Agentic coding tasks, repository-scale code generation, function calling, browser automation, debugging |
| pch-pro | $1.96 | Bronze+ | General-purpose autonomous agent reasoning, multi-step planning, tool use, production workloads |
| claude-haiku | Common rate | Silver+ | Balanced instruction following at higher quality |
| claude-sonnet | Common rate | Gold+ | Long-context reasoning, nuanced analysis, vision |

PCH model tiers are powered by third-party inference infrastructure. The underlying model configuration is proprietary to PathCourse Health and subject to change without notice.

### Certification Tiers

| Tier | Deposit (USDC) | Models Unlocked |
|------|---------------|-----------------|
| Uncertified | $25 | pch-fast, pch-coder |
| Bronze | $75 | + pch-pro |
| Silver | $250 | + claude-haiku |
| Gold | $750 | + claude-sonnet |

---

## Getting Your First API Key

No account needed. The entire flow is autonomous:

1. **Send a request** to `https://gateway.pathcoursehealth.com/v1/chat/completions` with no API key
2. **Receive a 402** response with payment instructions (treasury wallet, amount, chain)
3. **Send $25+ USDC** on Base (chain ID 8453) to the treasury wallet
4. **Resend your request** with the `X-PAYMENT-PROOF` header
5. **Receive your API key** in the `X-API-KEY` response header, plus your inference result

Total time: ~20 seconds from payment to first response.

### Payment Proof Format

The `X-PAYMENT-PROOF` header accepts base64-encoded JSON or plain JSON:

```json
{
  "payment_context_id": "from the 402 response",
  "tx_hash": "your USDC transfer transaction hash",
  "buyer_wallet": "your wallet address"
}
```

---

## Full Integration Examples

For the complete flow (discovery, payment, provisioning, and ongoing usage):

- **[Python example](python/pch_client.py)** -- requires `httpx`, `eth-account`
- **[Node.js example](javascript/pch_client.js)** -- requires `ethers`

```bash
# Python
pip install httpx eth-account web3
export PCH_WALLET_KEY=0xYourPrivateKey
python python/pch_client.py

# Node.js
npm install ethers
export PCH_WALLET_KEY=0xYourPrivateKey
node javascript/pch_client.js
```

---

## Response Headers

Every inference response includes:

| Header | Description |
|--------|-------------|
| `X-PCH-Routed-Model` | Which model handled the request |
| `X-PCH-Tier` | Your certification tier |
| `X-PCH-Balance-Remaining` | Your remaining USDC balance |
| `X-PCH-Requested-Model` | Only present if your request was rerouted to a different model (e.g., tier restriction) |
| `X-PCH-Route-Reason` | Explains why a reroute occurred |

---

## Links

- **Gateway:** [gateway.pathcoursehealth.com](https://gateway.pathcoursehealth.com)
- **Developer Docs (JSON):** [/docs](https://gateway.pathcoursehealth.com/docs)
- **Agent Card:** [/.well-known/agent.json](https://gateway.pathcoursehealth.com/.well-known/agent.json)
- **Capabilities:** [/registry/capabilities](https://agents.pathcoursehealth.com/registry/capabilities)
- **Handshake (A2A):** [/negotiator/handshake](https://agents.pathcoursehealth.com/negotiator/handshake) (POST)
- **Certification Status:** [/v1/cert/registry](https://gateway.pathcoursehealth.com/v1/cert/registry)
- **Legal Terms:** [/legal/terms.json](https://gateway.pathcoursehealth.com/legal/terms.json)

---

## Payment Details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453) |
| Currency | USDC |
| USDC Contract | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Minimum Deposit | $25 USDC |
| Settlement | x402 protocol |

---

*Built by [PathCourse Health](https://pathcoursehealth.com)*
