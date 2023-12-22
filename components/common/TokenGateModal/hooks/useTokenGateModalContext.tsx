import type { AuthSig, JsonSigningResourceId, JsonStoreSigningRequest } from '@lit-protocol/types';
import type { PopupState } from 'material-ui-popup-state/hooks';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import useLitProtocol from 'adapters/litProtocol/hooks/useLitProtocol';
import { useSaveSigningCondition, useCreateTokenGate } from 'charmClient/hooks/tokenGates';
import { useCurrentSpace } from 'hooks/useCurrentSpace';
import { useWeb3Account } from 'hooks/useWeb3Account';
import type { TokenGateConditions } from 'lib/tokenGates/interfaces';
import { isTruthy } from 'lib/utilities/types';

import { createAuthSigs, getAllChains } from '../utils/helpers';

export type DisplayedPage = 'tokens' | 'collectables' | 'home' | 'review' | 'wallet' | 'dao' | 'unlock';
export type Flow = 'single' | 'multiple_all' | 'multiple_one';

export type ConditionsModalResult = Pick<JsonStoreSigningRequest, 'unifiedAccessControlConditions'> & {
  authSigTypes: string[];
  chains: string[];
  permanent: true;
};

type IContext = {
  flow: Flow;
  tokenGate?: TokenGateConditions;
  displayedPage: DisplayedPage;
  popupState: PopupState;
  setFlow: (flow: Flow) => void;
  onSubmit: () => Promise<void>;
  resetModal: () => void;
  handleTokenGate: (tokenGate: TokenGateConditions) => void;
  setDisplayedPage: (page: DisplayedPage) => void;
  loadingToken: boolean;
  error?: string;
};

export const TokenGateModalContext = createContext<Readonly<IContext>>({
  handleTokenGate: () => undefined,
  onSubmit: async () => undefined,
  popupState: {} as PopupState,
  flow: 'single',
  setFlow: () => undefined,
  resetModal: () => undefined,
  displayedPage: 'home',
  setDisplayedPage: () => undefined,
  loadingToken: false,
  tokenGate: undefined,
  error: undefined
});

export function TokenGateModalProvider({
  children,
  popupState,
  refreshTokenGates
}: {
  children: ReactNode;
  popupState: PopupState;
  refreshTokenGates: () => void;
}) {
  const [displayedPage, setDisplayedPage] = useState<DisplayedPage>('home');
  const [tokenGate, setTokenGate] = useState<TokenGateConditions>();
  const litClient = useLitProtocol();
  const { error: tokenError, isMutating: tokenLoading, trigger: createTokenGate } = useCreateTokenGate();
  const { error: litError, isMutating: litLoading, trigger: saveSigningCondition } = useSaveSigningCondition(litClient);
  const [flow, setFlow] = useState<Flow>('single');
  const { walletAuthSignature, requestSignature } = useWeb3Account();
  const { space } = useCurrentSpace();
  const spaceId = space?.id || '';

  const handleTokenGate = (_tokenGate: TokenGateConditions) => {
    setTokenGate((prevState) => {
      if (_tokenGate.type === 'lit' && (!prevState || prevState.type === 'lit')) {
        const andOperator = { operator: 'and' };
        const orOperator = { operator: 'or' };
        const operator = flow === 'multiple_all' ? andOperator : flow === 'multiple_one' ? orOperator : undefined;

        return {
          type: _tokenGate.type,
          conditions: {
            unifiedAccessControlConditions: [
              ...(prevState?.conditions?.unifiedAccessControlConditions || []),
              operator,
              ...(_tokenGate.conditions.unifiedAccessControlConditions || [])
            ].filter(isTruthy)
          }
        };
      } else {
        return _tokenGate;
      }
    });
  };

  const resetModal = () => {
    setFlow('single');
    setDisplayedPage('home');
    setTokenGate(undefined);
  };

  const createUnifiedAccessControlConditions = async () => {
    if (tokenGate?.type === 'lit' && tokenGate?.conditions?.unifiedAccessControlConditions) {
      const unifiedAccessControlConditions = tokenGate.conditions.unifiedAccessControlConditions;
      const authSigTypes = createAuthSigs(unifiedAccessControlConditions);
      const chains = getAllChains(unifiedAccessControlConditions);

      const conditions: ConditionsModalResult = {
        unifiedAccessControlConditions,
        permanent: true,
        chains,
        authSigTypes
      };

      const tokenGateId = uuid();
      const resourceId: JsonSigningResourceId = {
        baseUrl: 'https://app.charmverse.io',
        path: `${Math.random()}`,
        orgId: spaceId,
        role: 'member',
        extraData: JSON.stringify({
          tokenGateId
        })
      };

      const authSig: AuthSig = walletAuthSignature ?? (await requestSignature());

      if (!authSig || !authSigTypes[0]) {
        return;
      }

      const litSuccess = await saveSigningCondition({
        unifiedAccessControlConditions: conditions.unifiedAccessControlConditions,
        chain: authSigTypes[0], // ethereum or solana
        authSig,
        resourceId
      });

      if (litSuccess) {
        await createTokenGate({
          conditions,
          resourceId,
          spaceId,
          type: 'lit',
          id: tokenGateId
        });

        refreshTokenGates();
      }

      resetModal();
      popupState.close();
    }
  };

  const createUnlockProtocolGate = async () => {
    if (tokenGate?.type === 'unlock' && tokenGate.conditions) {
      const id = uuid();

      await createTokenGate({
        conditions: {
          contract: tokenGate.conditions.contract,
          chainId: tokenGate.conditions.chainId,
          name: tokenGate.conditions.name || ''
        },
        type: 'unlock',
        resourceId: {},
        spaceId,
        id
      });

      refreshTokenGates();
      resetModal();
      popupState.close();
    }
  };

  const onSubmit = async () => {
    if (tokenGate?.type === 'unlock') {
      await createUnlockProtocolGate();
    } else if (tokenGate?.type === 'lit') {
      await createUnifiedAccessControlConditions();
    }
  };

  const value: IContext = useMemo(
    () => ({
      onSubmit,
      resetModal,
      setDisplayedPage,
      handleTokenGate,
      setFlow,
      popupState,
      displayedPage,
      tokenGate,
      flow,
      loadingToken: tokenLoading || litLoading,
      error: tokenError?.message || typeof litError?.message === 'string' ? litError?.message : undefined
    }),
    [
      flow,
      displayedPage,
      tokenLoading,
      litLoading,
      tokenGate,
      popupState,
      tokenError?.message,
      litError?.message,
      resetModal,
      handleTokenGate
    ]
  );

  return <TokenGateModalContext.Provider value={value}>{children}</TokenGateModalContext.Provider>;
}

export const useTokenGateModal = () => useContext(TokenGateModalContext);
