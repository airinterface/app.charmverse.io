import { log } from '@charmverse/core/log';
import type { UserGnosisSafe } from '@charmverse/core/prisma';
import { BigNumber } from '@ethersproject/bignumber';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Divider, Menu, MenuItem, Tooltip } from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ERC20ABI from 'abis/ERC20.json';
import { getChainById } from 'connectors/chains';
import { ethers } from 'ethers';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import useSWR from 'swr';
import { parseEther, parseUnits } from 'viem';

import charmClient from 'charmClient';
import { OpenWalletSelectorButton } from 'components/_app/Web3ConnectionManager/components/WalletSelectorModal/OpenWalletSelectorButton';
import { getPaymentErrorMessage, useGnosisPayment } from 'hooks/useGnosisPayment';
import { useMultiBountyPayment } from 'hooks/useMultiBountyPayment';
import useMultiWalletSigs from 'hooks/useMultiWalletSigs';
import { usePaymentMethods } from 'hooks/usePaymentMethods';
import { useWeb3Account } from 'hooks/useWeb3Account';
import type { SupportedChainId } from 'lib/blockchain/provider/alchemy/config';
import { switchActiveNetwork } from 'lib/blockchain/switchNetwork';
import { getSafesForAddress } from 'lib/gnosis';
import type { RewardWithUsers } from 'lib/rewards/interfaces';
import { isValidChainAddress } from 'lib/tokens/validation';
import { shortenHex } from 'lib/utilities/blockchain';

interface Props {
  receiver: string;
  amount: string;
  tokenSymbolOrAddress: string;
  chainIdToUse: number;
  onSuccess?: (txId: string, chainId: number) => void;
  onError?: (err: string, severity?: AlertColor) => void;
  reward: RewardWithUsers;
}

function SafeMenuItem({
  label,
  safeInfo,
  reward,
  onClick,
  onError = () => {}
}: {
  safeInfo: UserGnosisSafe;
  label: string;
  reward: RewardWithUsers;
  onClick: () => void;
  onError: (err: string, severity?: AlertColor) => void;
}) {
  const { onPaymentSuccess, getTransactions } = useMultiBountyPayment({ rewards: [reward] });

  const { makePayment } = useGnosisPayment({
    chainId: safeInfo.chainId,
    onSuccess: onPaymentSuccess,
    safeAddress: safeInfo.address,
    transactions: getTransactions(safeInfo.address)
  });

  return (
    <MenuItem
      dense
      onClick={async () => {
        onClick();
        try {
          await makePayment();
        } catch (error: any) {
          const { message, level } = getPaymentErrorMessage(error);
          onError(message, level);
        }
      }}
    >
      {label}
    </MenuItem>
  );
}

export function RewardPaymentButton({
  receiver,
  reward,
  amount,
  chainIdToUse,
  tokenSymbolOrAddress,
  onSuccess = () => {},
  onError = () => {}
}: Props) {
  const { data: safesData } = useMultiWalletSigs();
  const { account, chainId, signer } = useWeb3Account();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const { data: safeInfos } = useSWR(
    signer && account ? `/connected-gnosis-safes/${account}/${chainIdToUse}` : null,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    () => getSafesForAddress({ signer: signer!, chainId: chainIdToUse, address: account! })
  );

  const safeDataRecord =
    safesData?.reduce<Record<string, UserGnosisSafe>>((record, userGnosisSafe) => {
      if (!record[userGnosisSafe.address]) {
        record[userGnosisSafe.address] = userGnosisSafe;
      }
      return record;
    }, {}) ?? {};

  const [paymentMethods] = usePaymentMethods();

  const makePayment = async () => {
    if (!chainIdToUse) {
      onError('Please set up a chain for this payment.');
      return;
    }

    const chainToUse = getChainById(chainIdToUse);

    if (!signer) {
      onError('Please make sure you are connected to a supported network and your wallet is unlocked.');
      return;
    }

    try {
      if (chainIdToUse !== chainId) {
        await switchActiveNetwork(chainIdToUse);
      }

      if (isValidChainAddress(tokenSymbolOrAddress)) {
        const tokenContract = new ethers.Contract(tokenSymbolOrAddress, ERC20ABI, signer);

        const paymentMethod = paymentMethods.find(
          (method) => method.contractAddress === tokenSymbolOrAddress || method.id === tokenSymbolOrAddress
        );
        let tokenDecimals = paymentMethod?.tokenDecimals;

        if (typeof tokenDecimals !== 'number') {
          try {
            const tokenInfo = await charmClient.getTokenMetaData({
              chainId: chainIdToUse as SupportedChainId,
              contractAddress: tokenSymbolOrAddress
            });
            tokenDecimals = tokenInfo.decimals;
          } catch (error) {
            onError(
              `Token information is missing. Please go to payment methods to configure this payment method using contract address ${tokenSymbolOrAddress} on chain: ${chainIdToUse}`
            );
            return;
          }
        }

        const parsedTokenAmount = parseUnits(amount, tokenDecimals);

        // get allowance
        const allowance = await tokenContract.allowance(account, receiver);

        if (BigNumber.from(allowance).lt(parsedTokenAmount)) {
          // approve if the allowance is small
          await tokenContract.approve(receiver, parsedTokenAmount);
        }

        // transfer token
        const tx = await tokenContract.transfer(receiver, parsedTokenAmount);
        onSuccess(tx.hash, chainToUse!.chainId);
      } else {
        const tx = await signer.sendTransaction({
          to: receiver,
          value: parseEther(amount)
        });

        onSuccess(tx.hash, chainIdToUse);
      }
    } catch (error: any) {
      const { message, level } = getPaymentErrorMessage(error);
      log.warn(`Error sending payment on blockchain: ${message}`, { amount, chainId, error });
      onError(message, level);
    }
  };

  const hasSafes = Boolean(safeInfos?.length);

  if (!account || !chainId || !signer) {
    return (
      <div>
        <Tooltip title='Your wallet must be unlocked to pay for this reward'>
          <OpenWalletSelectorButton label='Unlock Wallet' />
        </Tooltip>
      </div>
    );
  }

  return (
    <>
      <Button
        color='primary'
        endIcon={hasSafes ? <KeyboardArrowDownIcon /> : null}
        size='small'
        onClick={(e) => {
          if (!hasSafes) {
            makePayment();
          } else {
            handleClick(e);
          }
        }}
      >
        Send Payment
      </Button>
      {hasSafes && (
        <Menu id='bounty-payment' anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MenuItem dense sx={{ pointerEvents: 'none', color: 'secondary.main' }}>
            Connected wallet
          </MenuItem>
          <MenuItem
            dense
            onClick={async () => {
              await makePayment();
              handleClose();
            }}
          >
            {shortenHex(account ?? '')}
          </MenuItem>
          <Divider />
          <MenuItem dense sx={{ pointerEvents: 'none', color: 'secondary.main' }}>
            Gnosis wallets
          </MenuItem>
          {safesData
            ?.filter((s) => !s.isHidden && chainIdToUse === s.chainId)
            .map((safeInfo) => (
              <SafeMenuItem
                key={safeInfo.address}
                reward={reward}
                label={safeDataRecord[safeInfo.address]?.name || shortenHex(safeInfo.address)}
                onClick={() => {
                  handleClose();
                }}
                onError={onError}
                safeInfo={safeInfo}
              />
            ))}
        </Menu>
      )}
    </>
  );
}