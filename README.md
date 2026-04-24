# PCH Integration Examples

**[gateway.pathcoursehealth.com](https://gateway.pathcoursehealth.com)** | [Developer Docs](https://gateway.pathcoursehealth.com/docs) | [MCP Server](https://gateway.pathcoursehealth.com/mcp) | [Agent Card](https://gateway.pathcoursehealth.com/.well-known/agent.json)

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

### Text Inference

| Model | Rate | Tier | Latency | Best For |
|-------|------|------|---------|----------|
| pch-fast | $0.44/M tokens | Uncertified+ | 400-800ms | High-volume, low-complexity tasks -- classification, summarization, routing decisions, quick agent responses |
| pch-coder | $3.50/M tokens | Uncertified+ | 1000-3000ms | Agentic coding tasks, repository-scale code generation, function calling, browser automation, debugging |
| pch-pro | $1.96/M tokens | Bronze+ | 800-2000ms | General-purpose autonomous agent reasoning, multi-step planning, tool use, production workloads |
| claude-haiku | Common rate | Silver+ | varies | Balanced instruction following at higher quality |
| claude-sonnet | Common rate | Gold+ | varies | Long-context reasoning, nuanced analysis, vision |

### Image, Audio, Documents & Voice

| Model | Rate | Tier | Latency | Best For |
|-------|------|------|---------|----------|
| pch-image | $0.028/image | Silver+ | 500-1200ms | Text-to-image generation. Sub-second at 1024x1024. Supports text-to-image and image editing. |
| pch-audio | $1.85/M chars | Bronze+ | 150-200ms | Text-to-speech, standard. <200ms first audio. Emotion tags and zero-shot voice cloning. |
| pch-audio-premium | $37.00/M chars | Silver+ | 97-150ms | Text-to-speech, premium. 97ms first-byte. 10-language support, voice cloning, emotion control. |
| pch-documents | $0.26 in / $1.48 out per M tokens | Bronze+ | 800-2000ms/page | Document parsing and OCR. 109 languages, tables, formulas, charts. |
| pch-talk | $0.001/minute | Silver+ | 1500-4000ms | End-to-end voice conversation. Audio in, audio out. One endpoint, one billing event. |

PCH model tiers are powered by third-party inference infrastructure. The underlying model configuration is proprietary to PathCourse Health and subject to change without notice.

### Certification Tiers

| Tier | Deposit (USDC) | Models Unlocked |
|------|---------------|-----------------|
| Uncertified | $25 | pch-fast, pch-coder |
| Bronze | $75 | + pch-pro, pch-audio, pch-documents |
| Silver | $250 | + pch-image, pch-audio-premium, pch-talk, claude-haiku |
| Gold | $750 | + claude-sonnet |

### Additional Endpoints

| Endpoint | Model | Method |
|----------|-------|--------|
| `/v1/chat/completions` | pch-fast, pch-coder, pch-pro, pch-documents, claude-haiku, claude-sonnet | POST |
| `/v1/images/generations` | pch-image | POST |
| `/v1/audio/speech` | pch-audio, pch-audio-premium | POST |
| `/v1/audio/conversation` | pch-talk | POST |

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

## MCP Integration (Model Context Protocol)

Agents with MCP support can use PCH through native tool calls — no REST API needed.

**MCP Endpoint:** `https://gateway.pathcoursehealth.com/mcp`

### Available Tools

| Tool | Auth Required | Description |
|------|---------------|-------------|
| `pch_models` | No | List all models with pricing, tiers, and descriptions |
| `pch_status` | No | Check gateway health and service status |
| `pch_provision` | No | Get treasury wallet, payment steps, and tier breakdown |
| `pch_estimate` | No | Estimate cost before running (model + token count) |
| `pch_pay` | No | Submit payment proof after sending USDC — returns API key + first inference |
| `pch_inference` | Yes | Run inference on any PCH model |
| `pch_balance` | Yes | Check remaining USDC balance and tier |

### Full MCP Flow (Zero REST API Calls)

```
1. pch_models()                                        → browse models + pricing
2. pch_estimate(model: "pch-fast", estimated_tokens: 50000) → "$0.022 estimated"
3. pch_provision(deposit_usdc: 25)                     → treasury wallet + payment steps
4. ... agent sends $25 USDC on Base ...
5. pch_pay(payment_context_id, tx_hash, buyer_wallet)  → API key + first inference
6. pch_inference(model: "pch-fast", prompt: "...", api_key: "pch_prod_b_...") → response
7. pch_balance(api_key: "pch_prod_b_...")              → remaining balance
```

### Supported Frameworks

| Framework | MCP Support |
|-----------|-------------|
| Claude Code / Claude Desktop | Native |
| Cursor / Windsurf | Native |
| LangChain | Via MCP adapter |
| CrewAI | Via MCP adapter |
| Custom agents | Implement MCP client |

Agents without MCP support use the REST API — both paths lead to the same models, billing, and infrastructure.

---

## Full Integration Examples (REST API)

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
## SDK Examples

The official SDKs wrap the REST API with typed methods, automatic retries, and built-in error classes.

```bash
pip install pathcourse-sdk        # Python
npm install @pathcourse/sdk       # Node.js
```

### Quick Start & Key Claiming

| File | Description |
|------|-------------|
| [python/sdk_quick_start.py](python/sdk_quick_start.py) | Claim a key, verify it, run inference, self-profile |
| [javascript/sdk_quick_start.js](javascript/sdk_quick_start.js) | Same flow in Node.js |

### 1. Memory — Persistent Embedding Store

| File | Description |
|------|-------------|
| [python/memory_example.py](python/memory_example.py) | Store, retrieve, update, forget, summarize |
| [javascript/memory_example.js](javascript/memory_example.js) | Same in Node.js |

### 2. Identity & Reputation — Path Score & ERC-8004

| File | Description |
|------|-------------|
| [python/reputation_example.py](python/reputation_example.py) | Path Score lookup, trust check, score history, ERC-8004 identity |
| [javascript/reputation_example.js](javascript/reputation_example.js) | Same in Node.js |

### 3. Observability — Traces, Spans, Cost Attribution

| File | Description |
|------|-------------|
| [python/observability_example.py](python/observability_example.py) | Trace lifecycle, event logging, analytics, cost attribution |
| [javascript/observability_example.js](javascript/observability_example.js) | Same in Node.js |

### 4. Account Controls — Balance, Budget, Webhooks

| File | Description |
|------|-------------|
| [python/account_controls.py](python/account_controls.py) | Balance, usage history, runway, budget cap, webhook registration |
| [javascript/account_controls.js](javascript/account_controls.js) | Same in Node.js |

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
- **MCP Server:** [/mcp](https://gateway.pathcoursehealth.com/mcp)
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
