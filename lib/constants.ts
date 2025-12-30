// $NOUN token on Base
export const NOUN_TOKEN_ADDRESS = '0xbb3d686a8569138da8190df93ef25baf6e750d02' as const

// Burn address for $NOUN spending
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Game constants
export const GAME_CONFIG = {
  BASE_BEANS_PER_CLICK: 1,
  BASE_BEANS_PER_SECOND: 0,
  UPGRADE_COST_MULTIPLIER: 1.15,
  OFFLINE_EARNINGS_CAP_HOURS: 8,
} as const
