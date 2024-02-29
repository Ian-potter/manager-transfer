"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Accounts,
  ChainIds,
  IAElfChain,
  IPortkeyProvider,
  MethodsBase,
  MethodsWallet,
  NetworkType,
  NotificationEvents,
  ChainId,
  ProviderErrorType,
} from "@portkey/provider-types";
import { IContract } from "@portkey/types";
import detectProvider, { TProviderName } from "@portkey/detect-provider";
import { useExampleState, Actions, State } from "@/hooks/hooks";
import { getTxResult } from "@portkey/contracts";
import { getRawByEOA } from "@/utils/getRawByEOA";
import { sleep } from "@portkey/utils";
import AElf from "aelf-sdk";
import "./index.css";

const TokenContractAddressMap = {
  AELF: "JRmBduh4nXWi1aXgdUsj5gJrzeZb2LxmrAbf7W99faZSvoAaE",
  tDVV: "7RzVGiuVWkvL4VfVHdZfQF2Tri3sgLe9U991bohHFfSRZXuGX",
  tDVW: "ASh2Wt7nSEmYqnGxPPzp4pnVDU4uhj1XW9Se5VeZcX2UDdyjx",
};

export default function TransferManager({
  providerName,
}: {
  providerName?: TProviderName;
}) {
  const [provider, setProvider] = useState<IPortkeyProvider>();

  const [state, dispatch] = useExampleState();

  const setState = useCallback(
    (payload: State, actions: Actions = Actions.setState) => {
      dispatch({ type: actions, payload });
    },
    [dispatch]
  );

  const [chain, setChain] = useState<IAElfChain>();
  const [tokenContract, setTokenContract] = useState<IContract>();

  const connectEagerly = useCallback(async () => {
    if (!provider) return;
    const accounts = await provider.request({ method: MethodsBase.ACCOUNTS });
    setState({ accounts });
  }, [provider, setState]);

  const initProvider = useCallback(async () => {
    try {
      const provider = await detectProvider({ providerName });
      provider && setProvider(provider);
      return provider;
    } catch (error) {
      console.log(error, "=====error");
    }
  }, []);
  const accountsChanged = (accounts: Accounts) => {
    setState({ accounts });
  };
  const chainChanged = (chainIds: ChainIds) => {
    setState({ chainIds });
  };
  const networkChanged = async (networkType: NetworkType) => {
    if (!provider) return;
    setState({ network: networkType });
    const _chain = await provider.getChain("AELF");
    setChain(_chain);
  };
  const connected = async (connectInfo: NetworkType) => {
    if (!provider) return;
    const result = await provider.request({
      method: MethodsBase.ACCOUNTS,
    });
    setState({ accounts: result });
  };
  const disconnected = (error: ProviderErrorType) => {
    console.log(error, "=====disconnected");
    connectEagerly();
  };
  const initListener = () => {
    if (!provider) return;
    provider.on(NotificationEvents.ACCOUNTS_CHANGED, accountsChanged);
    provider.on(NotificationEvents.CHAIN_CHANGED, chainChanged);
    provider.on(NotificationEvents.NETWORK_CHANGED, networkChanged);
    provider.on(NotificationEvents.CONNECTED, connected);
    provider.on(NotificationEvents.DISCONNECTED, disconnected);
  };
  const removeListener = () => {
    if (!provider) return;

    provider.removeListener(
      NotificationEvents.ACCOUNTS_CHANGED,
      accountsChanged
    );
    provider.removeListener(NotificationEvents.CHAIN_CHANGED, chainChanged);
    provider.removeListener(NotificationEvents.NETWORK_CHANGED, networkChanged);
    provider.removeListener(NotificationEvents.CONNECTED, connected);
    provider.removeListener(NotificationEvents.DISCONNECTED, disconnected);
  };
  useEffect(() => {
    if (!provider) return;
    initListener();
    connectEagerly();
    return () => {
      removeListener();
    };
  }, [provider]);

  const getWalletInfo = useCallback(async () => {
    try {
      const provider = await initProvider();
      const result = await provider?.request({
        method: MethodsBase.REQUEST_ACCOUNTS,
      });
      const managerAddress = await provider?.request({
        method: MethodsWallet.GET_WALLET_CURRENT_MANAGER_ADDRESS,
      });

      setState({ accounts: result, managerAddress });
    } catch (error: any) {
      alert(error.message);
    }
  }, [initProvider, setState]);

  const getBalance = useCallback(
    async ({ symbol, chainId }: { symbol: string; chainId: ChainId }) => {
      try {
        console.log(provider, symbol, chainId, "tokenContract==");

        if (!provider) return;
        const _chain = await provider.getChain(chainId);
        setChain(_chain);
        const tokenContract = _chain.getContract(
          TokenContractAddressMap[chainId]
        );
        setTokenContract(tokenContract);

        console.log(state, "state.managerAddress==");

        const result = await tokenContract.callViewMethod("GetBalance", {
          symbol,
          owner: state.managerAddress,
        });
        const balance = result.data?.balance;
        if (typeof balance !== "undefined") {
          const _balance = { ...state.balance };
          setState({
            balance: {
              ..._balance,
              [chainId]: balance,
            },
          });
        }

        console.log(result, "result==");
      } catch (error) {
        console.log(error, "=====getChain");
      }
    },
    [provider, setState, state]
  );

  const transfer = useCallback(
    async ({
      from,
      to,
      chainId,
      symbol,
      amount,
    }: {
      from: string;
      to: string;
      chainId: ChainId;
      symbol: string;
      amount: string;
    }) => {
      //

      console.log(from, to, chainId, symbol, amount, state.managerAddress);
      const _chain = await provider?.getChain(chainId);
      console.log(_chain, chainId, "_chain==");
      if (!_chain?.rpcUrl) throw Error("Error rpcUrl");

      const result = await getRawByEOA({
        contractAddress: TokenContractAddressMap[chainId],
        args: {
          symbol,
          amount,
          to,
        },
        fromManagerAddress: from,
        methodName: "Transfer",
        rpcUrl: _chain!.rpcUrl,
        provider,
      });
      console.log(result, "result==");

      const postResult = await _chain.sendTransaction(result);
      console.log(postResult, "postResult==");
      alert(`TransactionId: ${postResult.TransactionId}`);
      await sleep(2000);
      try {
        const chain = new AElf(new AElf.providers.HttpProvider(_chain.rpcUrl))
          .chain;
        let rxResult = await getTxResult(chain, postResult.TransactionId);
        console.log(rxResult);
        if (rxResult.Status === "PENDING") {
          await sleep(2000);
          rxResult = await getTxResult(chain, postResult.TransactionId);
        }
        console.log(rxResult, "rxResult==");
        if (rxResult.Status === "MINED") alert("success");
        else alert(rxResult.TransactionId);
      } catch (error: any) {
        if (error.Error) alert(error.Error);
      }
    },
    [provider, state.managerAddress]
  );

  return (
    <main className="flex min-h-screen  p-10rem">
      <div>
        <div>
          {Object.entries(state).map(([key, value]) => {
            return (
              <p key={key}>
                <a>{key}</a>
                <br />
                {JSON.stringify(value)}
              </p>
            );
          })}

          <button onClick={getWalletInfo}>Login with Portkey</button>

          {provider && (
            <>
              {" "}
              <button
                onClick={async () => {
                  const result = await provider.request({
                    method: MethodsBase.CHAIN_ID,
                  });
                  setState({ chainIds: result });
                }}>
                CHAIN_ID
              </button>
              <button
                onClick={async () => {
                  const result = await provider.request({
                    method: MethodsBase.CHAINS_INFO,
                  });
                  setState({ chainsInfo: result });
                }}>
                CHAINS_INFO
              </button>
              <button
                onClick={async () => {
                  try {
                    const managerAddress = await provider.request({
                      method: MethodsWallet.GET_WALLET_CURRENT_MANAGER_ADDRESS,
                    });
                    setState({ managerAddress });
                  } catch (error: any) {
                    alert(error.message);
                  }
                }}>
                GET_WALLET_CURRENT_MANAGER_ADDRESS
              </button>
              <button onClick={removeListener}>removeListener</button>
              <div style={{ margin: "20px 0" }}>
                Get Manager Balance
                ----------------------------------------------
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  var formData = new FormData(e.target as any);
                  try {
                    const symbol = formData.get("symbol") as string;
                    const chainId = formData.get("chainId") as ChainId;
                    // const owner = formData.get("owner") as string;

                    console.log(symbol, chainId, "chainId==");
                    if (!symbol) throw Error("Missing token");
                    if (!chainId) throw Error("Missing chainId");
                    // if (!owner) throw Error("Missing owner");

                    await getBalance({
                      symbol,
                      chainId,
                      // owner,
                    });
                  } catch (error: any) {
                    alert(JSON.stringify(error));
                  }
                }}>
                <label>
                  owner:
                  <input
                    type="text"
                    name="owner"
                    disabled
                    value={state.managerAddress}
                  />
                </label>
                <label>
                  ChainId:
                  <input type="text" name="chainId" />
                </label>
                <label>
                  symbol:
                  <input type="text" name="symbol" />
                </label>
                <button type="submit">GetBalance</button>
              </form>
              <div style={{ color: "red" }}>
                {state.balance ? (
                  <>
                    <div>-------</div>
                    {"Balance:" + "   " + JSON.stringify(state.balance)}
                    <div>-------</div>
                  </>
                ) : (
                  ""
                )}
              </div>
              <div style={{ margin: "20px 0" }}>
                Same chain transfer, no cross chain transfer
                ----------------------------------------------
              </div>
              <div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    var formData = new FormData(e.target as any);
                    try {
                      const from = (formData.get("from") ||
                        state.managerAddress) as string;
                      const to = formData.get("to") as string;
                      const chainId = formData.get("chainId") as ChainId;
                      const symbol = formData.get("symbol") as string;
                      const amount = formData.get("amount") as string;

                      console.log(symbol, chainId, "chainId==");
                      if (!symbol) throw Error("Missing token");
                      if (!chainId) throw Error("Missing chainId");

                      await transfer({
                        from,
                        to,
                        chainId,
                        symbol,
                        amount,
                      });
                    } catch (error: any) {
                      alert(JSON.stringify(error));
                    }
                  }}>
                  <label>
                    FROM:
                    <input
                      type="text"
                      disabled
                      name="from"
                      value={state.managerAddress}
                    />
                  </label>
                  <div></div>

                  <label>
                    TO:
                    <input type="text" name="to" />
                  </label>
                  <div></div>
                  <label>
                    ChainId:
                    <input type="text" name="chainId" />
                  </label>
                  <div></div>

                  <label>
                    symbol:
                    <input type="text" name="symbol" />
                  </label>
                  <div></div>

                  <label>
                    amount:
                    <input type="text" name="amount" />
                  </label>
                  <div></div>

                  <button type="submit">Transfer</button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
