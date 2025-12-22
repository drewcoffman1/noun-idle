'use client';

import sdk from '@farcaster/miniapp-sdk';

export { sdk };

export async function initializeMiniApp() {
  try {
    // Get context from the mini app
    const context = await sdk.context;

    // Signal that we're ready to show content
    sdk.actions.ready({});

    return context;
  } catch (error) {
    console.error('Failed to initialize mini app:', error);
    throw error;
  }
}

export function getMiniAppContext() {
  return sdk.context;
}

export function getEthProvider() {
  return sdk.wallet.ethProvider;
}
