import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const authenticate = () => {
  showConnect({
    appDetails: {
      name: 'Bitcoin Booster',
      icon: '/logo.png', // Fallback or user can provide
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
};

export const disconnect = () => {
  userSession.signUserOut('/');
};

export const getNetwork = () => new StacksTestnet();

// Contract info
export const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Deployer address for testnet
export const CONTRACT_NAME = 'sbtc-usdcx-vault';
