import React from 'react';
import Web3 from 'web3';

export type NetworkId = 1 | 3 | 4 | 42 | 1337;

const getNetworkId = async (web3: Web3): Promise<NetworkId> => {
  const id = (await web3.eth.net.getId()) as NetworkId;

  return id;
};

const getAccount = async (web3: Web3) => {
  const accounts = await web3.eth.getAccounts();
  // Always use the first as current account
  return accounts[0] || null;
};

type ProviderName =
  | 'equal'
  | 'metamask'
  | 'dapper'
  | 'safe'
  | 'trust'
  | 'goWallet'
  | 'alphaWallet'
  | 'status'
  | 'coinbase';

const getProviderName = (web3: any): ProviderName | null => {
  if (!web3 || !web3.currentProvider) return null;
  if (web3.currentProvider.isEQLWallet) return 'equal';
  if (web3.currentProvider.isMetaMask) return 'metamask';
  if (web3.currentProvider.isDapper) return 'dapper';
  if (web3.currentProvider.isSafe) return 'safe';
  if (web3.currentProvider.isTrust) return 'trust';
  if (web3.currentProvider.isGoWallet) return 'goWallet';
  if (web3.currentProvider.isAlphaWallet) return 'alphaWallet';
  if (web3.currentProvider.isStatus) return 'status';
  if (web3.currentProvider.isToshi) return 'coinbase';

  return null;
};

interface State {
  web3IsLoading: boolean;
  providerName: string | null;
  account: string | null;
  networkId: NetworkId;
  isConnected: boolean;
}

const initialState: State = {
  web3IsLoading: true,
  providerName: null,
  account: null,
  networkId: 1,
  isConnected: false,
};

const getWeb3State = async (web3: Web3): Promise<State> => {
  const account = await getAccount(web3);
  const networkId = await getNetworkId(web3);
  const providerName = await getProviderName(web3);

  let isConnected = false;

  if (providerName === 'metamask') {
    // @ts-ignore
    isConnected = await window.ethereum._metamask.isApproved();
  }

  return {
    isConnected,
    account,
    networkId,
    providerName,
    web3IsLoading: false,
  };
};

export interface Web3Context extends State {
  hasWallet: boolean;
  web3: Web3;
}

export const Web3Context = React.createContext<Web3Context>({
  ...initialState,
  hasWallet: false,
  web3: new Web3(Web3.givenProvider),
});

export const useWeb3 = () => {
  return React.useContext(Web3Context);
};

type Action =
  | { type: 'update'; payload: State }
  | { type: 'load'; payload: State };

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'update':
      return { ...state, ...action.payload };
    case 'load':
      return { ...state, ...action.payload, web3IsLoading: false };
    default:
      throw new Error();
  }
};

interface Web3ProviderProps {
  children?: React.ReactNode;
  fallbackRPCEndpoint?: string;
  onChangeAccount?: (account: string) => void;
}

export const Web3Provider = (props: Web3ProviderProps) => {
  const {
    children,
    fallbackRPCEndpoint = `https://mainnet.infura.io/v3/022f489bd91a47f3960f6f70333bdb76`,
    onChangeAccount = () => {},
  } = props;
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [web3] = React.useState(
    new Web3(Web3.givenProvider || fallbackRPCEndpoint),
  );
  const {
    account,
    networkId,
    web3IsLoading,
    providerName,
    isConnected,
  } = state;

  // Load
  React.useEffect(() => {
    getWeb3State(web3).then(web3State => {
      dispatch({ type: 'load', payload: web3State });
    });
  }, [fallbackRPCEndpoint, web3]);

  // Subscribe
  React.useEffect(() => {
    const updateWeb3State = () => {
      getWeb3State(web3).then(web3State => {
        const { account: newAccount, networkId: newNetworkId } = web3State;

        // Changed account
        if (account && newAccount && account !== newAccount) {
          onChangeAccount(newAccount);
          dispatch({ type: 'update', payload: web3State });
        }

        // Changed network
        if (networkId !== newNetworkId) {
          dispatch({ type: 'update', payload: web3State });
        }
      });
    };

    // Only Metamask provides a listener
    const currentProvider = web3.currentProvider as any;

    if (currentProvider.publicConfigStore) {
      currentProvider.publicConfigStore.on('update', updateWeb3State);
    }
  }, [account, networkId, fallbackRPCEndpoint, web3, onChangeAccount]);

  return (
    <Web3Context.Provider
      value={{
        web3IsLoading,
        account,
        networkId,
        providerName,
        hasWallet: !!Web3.givenProvider,
        isConnected,
        web3,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
