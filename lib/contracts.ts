import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

// ERC-20 ABI for basic operations
export const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// Base public client for reading
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'),
});

// $NOUN token address on Base (to be configured)
export const NOUN_TOKEN_ADDRESS = process.env.NOUN_TOKEN_ADDRESS as `0x${string}` | undefined;

export async function getNounBalance(address: `0x${string}`): Promise<bigint> {
  if (!NOUN_TOKEN_ADDRESS) {
    console.warn('NOUN_TOKEN_ADDRESS not configured');
    return 0n;
  }

  try {
    const balance = await publicClient.readContract({
      address: NOUN_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance;
  } catch (error) {
    console.error('Failed to get NOUN balance:', error);
    return 0n;
  }
}

// Format token amount (assuming 18 decimals)
export function formatNounAmount(amount: bigint): string {
  const formatted = Number(amount) / 1e18;
  return formatted.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Parse token amount to bigint
export function parseNounAmount(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e18));
}
