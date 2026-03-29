"""
PathCourse Health -- Python Integration Example
================================================
Demonstrates the full Pattern 1 flow:
  discover -> pay USDC on Base -> get API key -> ongoing inference

Requirements:
  pip install httpx eth-account web3

Environment variables:
  PCH_WALLET_KEY  - Your wallet's private key (hex, with or without 0x prefix)

Usage:
  export PCH_WALLET_KEY=0xYourPrivateKey
  python pch_client.py
"""

import base64
import json
import os
import sys
import time

import httpx
from eth_account import Account
from web3 import Web3

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GATEWAY_URL   = "https://gateway.pathcoursehealth.com"
AGENT_CARD    = f"{GATEWAY_URL}/.well-known/agent.json"
CHAT_ENDPOINT = f"{GATEWAY_URL}/v1/chat/completions"

USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
CHAIN_ID      = 8453  # Base mainnet

# Standard ERC-20 ABI subset -- only the transfer function
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_to",    "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    }
]


def load_wallet():
    """Load wallet from PCH_WALLET_KEY environment variable."""
    key = os.environ.get("PCH_WALLET_KEY")
    if not key:
        print("ERROR: Set PCH_WALLET_KEY environment variable to your wallet private key.")
        sys.exit(1)
    account = Account.from_key(key)
    print(f"Wallet loaded: {account.address}")
    return account


# ---------------------------------------------------------------------------
# Step 1 -- Discover: fetch the agent card
# ---------------------------------------------------------------------------

def discover():
    """Fetch the PCH agent card to learn about available models and payment info."""
    print("\n--- Step 1: Discover ---")
    resp = httpx.get(AGENT_CARD, timeout=10)
    resp.raise_for_status()
    card = resp.json()

    print(f"Agent:    {card['agent_name']} v{card['version']}")
    print(f"Models:   {[c['models_available'] for c in card['capabilities']]}")
    print(f"Network:  {card['payment']['network']} (chain {card['payment']['chain_id']})")
    print(f"Treasury: {card['payment']['treasury_wallet']}")
    return card


# ---------------------------------------------------------------------------
# Step 2 -- First request: get a 402 with payment instructions
# ---------------------------------------------------------------------------

def get_payment_instructions():
    """
    Send an inference request with no API key.
    The gateway returns HTTP 402 with payment instructions.
    """
    print("\n--- Step 2: Get 402 payment instructions ---")
    payload = {
        "model": "pch-fast",
        "messages": [{"role": "user", "content": "Hello, PCH!"}],
        "max_tokens": 50,
    }

    resp = httpx.post(CHAT_ENDPOINT, json=payload, timeout=15)

    if resp.status_code != 402:
        print(f"Unexpected status {resp.status_code}. Expected 402.")
        print(resp.text)
        sys.exit(1)

    data = resp.json()
    payment = data.get("payment_required", data)

    print(f"Amount:     {payment['amount_usdc']} USDC")
    print(f"Pay to:     {payment['pay_to']}")
    print(f"Context ID: {payment['payment_context_id']}")
    print(f"Expires at: {payment['expires_at']}")
    return payment


# ---------------------------------------------------------------------------
# Step 3 -- Pay: send USDC on Base
# ---------------------------------------------------------------------------

def send_usdc(account, treasury_wallet, amount_usdc, payment_context_id):
    """
    Send a USDC transfer on Base mainnet to the PCH treasury wallet.
    Embeds the payment_context_id in calldata for matching.
    """
    print("\n--- Step 3: Send USDC on Base ---")

    # Connect to Base via a public RPC (replace with your own for production)
    w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
    if not w3.is_connected():
        print("ERROR: Cannot connect to Base RPC.")
        sys.exit(1)

    usdc = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_CONTRACT),
        abi=ERC20_ABI,
    )

    # USDC has 6 decimals: 1 USDC = 1_000_000 atomic units
    amount_atomic = int(float(amount_usdc) * 1_000_000)

    # Build the transfer transaction
    nonce = w3.eth.get_transaction_count(account.address)
    tx = usdc.functions.transfer(
        Web3.to_checksum_address(treasury_wallet),
        amount_atomic,
    ).build_transaction({
        "from":     account.address,
        "nonce":    nonce,
        "gas":      100_000,
        "gasPrice": w3.eth.gas_price,
        "chainId":  CHAIN_ID,
    })

    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    tx_hash_hex = tx_hash.hex()
    print(f"Tx sent: {tx_hash_hex}")

    # Wait for confirmation
    print("Waiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    if receipt["status"] != 1:
        print("ERROR: Transaction reverted.")
        sys.exit(1)

    print(f"Confirmed in block {receipt['blockNumber']}")
    return tx_hash_hex


# ---------------------------------------------------------------------------
# Step 4 -- Resend with proof: get API key + inference response
# ---------------------------------------------------------------------------

def resend_with_proof(payment_context_id, tx_hash, buyer_wallet):
    """
    Resend the original inference request with X-PAYMENT-PROOF header.
    The gateway validates payment, provisions an API key, and returns
    the inference result together with the new API key in response headers.
    """
    print("\n--- Step 4: Resend with payment proof ---")

    proof = json.dumps({
        "payment_context_id": payment_context_id,
        "tx_hash":            tx_hash,
        "buyer_wallet":       buyer_wallet,
    })
    proof_b64 = base64.b64encode(proof.encode()).decode()

    payload = {
        "model": "pch-fast",
        "messages": [{"role": "user", "content": "Hello, PCH!"}],
        "max_tokens": 50,
    }

    resp = httpx.post(
        CHAT_ENDPOINT,
        json=payload,
        headers={"X-PAYMENT-PROOF": proof_b64},
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"ERROR: Expected 200, got {resp.status_code}")
        print(resp.text)
        sys.exit(1)

    # Extract the API key and metadata from response headers
    api_key = resp.headers.get("X-API-KEY")
    tier    = resp.headers.get("X-PCH-Tier")
    balance = resp.headers.get("X-PCH-Balance-USDC")
    model   = resp.headers.get("X-PCH-Routed-Model")

    print(f"API Key:  {api_key[:20]}..." if api_key else "API Key: (not found)")
    print(f"Tier:     {tier}")
    print(f"Balance:  {balance} USDC")
    print(f"Model:    {model}")

    # The inference response is in the body
    result = resp.json()
    content = result["choices"][0]["message"]["content"]
    print(f"Response: {content}")

    return api_key


# ---------------------------------------------------------------------------
# Step 5 -- Ongoing requests: use the API key
# ---------------------------------------------------------------------------

def inference(api_key, prompt, model="pch-fast", max_tokens=200):
    """
    Make an authenticated inference request using your API key.
    This is the standard usage path after provisioning.
    """
    payload = {
        "model":      model,
        "messages":   [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }

    resp = httpx.post(
        CHAT_ENDPOINT,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    resp.raise_for_status()

    data    = resp.json()
    content = data["choices"][0]["message"]["content"]

    balance = resp.headers.get("X-PCH-Balance-Remaining", "unknown")
    model   = resp.headers.get("X-PCH-Routed-Model", "unknown")

    return {"content": content, "model": model, "balance": balance}


# ---------------------------------------------------------------------------
# Main -- run the full flow
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("PathCourse Health -- Python Integration Example")
    print("=" * 60)

    # Load wallet
    account = load_wallet()

    # Step 1: Discover
    card = discover()

    # Step 2: Get payment instructions (402)
    payment = get_payment_instructions()

    # Step 3: Pay USDC on Base
    tx_hash = send_usdc(
        account=account,
        treasury_wallet=payment["pay_to"],
        amount_usdc=payment["amount_usdc"],
        payment_context_id=payment["payment_context_id"],
    )

    # Brief pause for on-chain detection (Alchemy webhook fires in 1-3s)
    print("\nWaiting for on-chain detection...")
    time.sleep(5)

    # Step 4: Resend with proof, get API key
    api_key = resend_with_proof(
        payment_context_id=payment["payment_context_id"],
        tx_hash=tx_hash,
        buyer_wallet=account.address,
    )

    if not api_key:
        print("ERROR: No API key received.")
        sys.exit(1)

    # Step 5: Ongoing inference
    print("\n--- Step 5: Ongoing inference ---")
    result = inference(api_key, "Explain x402 in one sentence.")
    print(f"Model:    {result['model']}")
    print(f"Balance:  {result['balance']} USDC")
    print(f"Response: {result['content']}")

    print("\n" + "=" * 60)
    print("Integration complete. Save your API key for future requests.")
    print(f"API Key: {api_key}")
    print("=" * 60)


if __name__ == "__main__":
    main()
