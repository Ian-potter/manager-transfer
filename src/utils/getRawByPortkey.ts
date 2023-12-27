import {
  ChainId,
  IPortkeyProvider,
  MethodsWallet,
} from "@portkey/provider-types";
import AElf from "aelf-sdk";
import {
  handleManagerForwardCall,
  getContractMethods,
} from "@portkey/contracts";
import BN, { isBN } from "bn.js";
import { aelf } from "@portkey/utils";

export function zeroFill(str: string | BN) {
  return isBN(str) ? str.toString(16, 64) : str.padStart(64, "0");
}

// const httpProviders: any = {};
export function getAElf(rpcUrl: string) {
  // const rpc = getNodeByChainId(chainId).rpcUrl;
  // if (!httpProviders[rpc]) httpProviders[rpc] = new AElf(new AElf.providers.HttpProvider(rpc));
  return new AElf(new AElf.providers.HttpProvider(rpcUrl));
}

type CreateHandleManagerForwardCall = {
  caContractAddress: string;
  contractAddress: string;
  args: any;
  methodName: string;
  caHash: string;
  chainId: ChainId;
  instance: any;
};

export const createManagerForwardCall = async ({
  caContractAddress,
  contractAddress,
  args,
  methodName,
  caHash,
  instance,
}: CreateHandleManagerForwardCall) => {
  const res = await handleManagerForwardCall({
    paramsOption: {
      contractAddress,
      methodName,
      args,
      caHash,
    },
    functionName: "ManagerForwardCall",
    instance,
  });
  res.args = Buffer.from(AElf.utils.uint8ArrayToHex(res.args), "hex").toString(
    "base64"
  );

  const methods = await getContractMethods(instance, caContractAddress);
  const protoInputType = methods["ManagerForwardCall"];

  let input = AElf.utils.transform.transformMapToArray(protoInputType, res);

  input = AElf.utils.transform.transform(
    protoInputType,
    input,
    AElf.utils.transform.INPUT_TRANSFORMERS
  );

  const message = protoInputType.fromObject(input);

  return protoInputType.encode(message).finish();
};

const getSignature = async ({
  provider,
  data,
}: {
  provider: IPortkeyProvider;
  data: string;
}) => {
  const signature = await provider.request({
    method: MethodsWallet.GET_WALLET_SIGNATURE,
    payload: { data },
  });
  if (!signature || signature.recoveryParam == null) return {}; // TODO
  const signatureStr = [
    zeroFill(signature.r),
    zeroFill(signature.s),
    `0${signature.recoveryParam.toString()}`,
  ].join("");
  return { signature, signatureStr };
};

export type GetRawTx = {
  blockHeightInput: string;
  blockHashInput: string;
  packedInput: string;
  address: string;
  contractAddress: string;
  functionName: string;
};

export const getRawTx = ({
  blockHeightInput,
  blockHashInput,
  packedInput,
  address,
  contractAddress,
  functionName,
}: GetRawTx) => {
  const rawTx = AElf.pbUtils.getTransaction(
    address,
    contractAddress,
    functionName,
    packedInput
  );
  rawTx.refBlockNumber = blockHeightInput;
  const blockHash = blockHashInput.match(/^0x/)
    ? blockHashInput.substring(2)
    : blockHashInput;
  rawTx.refBlockPrefix = Buffer.from(blockHash, "hex").slice(0, 4);
  return rawTx;
};

export const handleTransaction = async ({
  blockHeightInput,
  blockHashInput,
  packedInput,
  address,
  contractAddress,
  functionName,
  provider,
}: GetRawTx & { provider: IPortkeyProvider }) => {
  // Create transaction
  const rawTx = getRawTx({
    blockHeightInput,
    blockHashInput,
    packedInput,
    address,
    contractAddress,
    functionName,
  });
  rawTx.params = Buffer.from(rawTx.params, "hex");

  const ser = AElf.pbUtils.Transaction.encode(rawTx).finish();

  const m = AElf.utils.sha256(ser);
  // signature
  let signatureStr = "";
  const signatureRes = await getSignature({ provider, data: m });
  signatureStr = signatureRes.signatureStr || "";
  if (!signatureStr) return;

  let tx = {
    ...rawTx,
    signature: Buffer.from(signatureStr, "hex"),
  };

  tx = AElf.pbUtils.Transaction.encode(tx).finish();
  if (tx instanceof Buffer) {
    return tx.toString("hex");
  }
  return AElf.utils.uint8ArrayToHex(tx); // hex params
};

export interface CreateTransactionParams {
  caContractAddress: string;
  contractAddress: string;
  caHash: string;
  args: any;
  chainId: ChainId;
  methodName: string;
  rpcUrl: string;
  provider: IPortkeyProvider;
}

export const getRawByPortkey = async ({
  caContractAddress,
  contractAddress,
  caHash,
  args,
  chainId,
  methodName,
  rpcUrl,
  provider,
}: CreateTransactionParams) => {
  console.log(typeof Buffer);
  const instance = aelf.getAelfInstance(rpcUrl);

  const managerForwardCall = await createManagerForwardCall({
    caContractAddress,
    contractAddress,
    caHash,
    methodName,
    args,
    chainId,
    instance,
  });

  const transactionParams = AElf.utils.uint8ArrayToHex(managerForwardCall);

  const aelfInstance = getAElf(rpcUrl);
  const { BestChainHeight, BestChainHash } =
    await aelfInstance.chain.getChainStatus();

  const fromManagerAddress = await provider.request({
    method: MethodsWallet.GET_WALLET_CURRENT_MANAGER_ADDRESS,
  });
  const transaction = await handleTransaction({
    blockHeightInput: BestChainHeight,
    blockHashInput: BestChainHash,
    packedInput: transactionParams,
    address: fromManagerAddress,
    contractAddress: caContractAddress,
    functionName: "ManagerForwardCall",
    provider,
  });
  console.log("🌈 🌈 🌈 🌈 🌈 🌈 transaction", transaction);
  return transaction;
};
