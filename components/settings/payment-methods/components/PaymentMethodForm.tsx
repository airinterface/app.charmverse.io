import { yupResolver } from '@hookform/resolvers/yup';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import TextField from '@mui/material/TextField';
import Progress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { PaymentMethod, WalletType } from '@prisma/client';
import charmClient from 'charmClient';
import Button from 'components/common/Button';
import { InputBlockchainSearch } from 'components/common/form/InputBlockchains';
import { getCryptos, getChainById } from 'connectors';
import { useBounties } from 'hooks/useBounties';
import { useCurrentSpace } from 'hooks/useCurrentSpace';
import { usePaymentMethods } from 'hooks/usePaymentMethods';
import { useUser } from 'hooks/useUser';
import { ITokenMetadataRequest } from 'lib/tokens/tokenData';
import { isValidChainAddress } from 'lib/tokens/validation';
import { IUserError } from 'lib/utilities/errors';
import { CryptoCurrency } from 'models/Currency';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';

export type FormMode = 'create' | 'update';

interface Props {
  onSubmit: (paymentMethod: Partial<PaymentMethod>) => any,
  defaultChainId?: number
}

export const schema = yup.object({
  chainId: yup.number().required('Please select a chain'),
  contractAddress: yup.string().nullable(true).test('verifyContractFormat', 'Invalid contract address', (value) => {
    return !value || isValidChainAddress(value);
  }),
  gnosisSafeAddress: yup.string().test('verifyContractFormat', 'Invalid contract address', (value) => {
    return !value || isValidChainAddress(value);
  }),
  tokenSymbol: yup.string().nullable(true),
  tokenName: yup.string().nullable(true),
  tokenLogo: yup.string().nullable(true),
  tokenDecimals: yup.number().nullable(true),
  walletType: yup.mixed<WalletType>().required().oneOf(['metamask', 'gnosis'])
});

type FormValues = yup.InferType<typeof schema>

export default function PaymentForm ({ onSubmit, defaultChainId = 1 }: Props) {

  const [loadingToken, setLoadingToken] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      // TBC till we agree on Prisma migration
      chainId: defaultChainId,
      // Default for an ERC20 token
      tokenDecimals: 18
    },
    resolver: yupResolver(schema)
  });

  const [,, refreshPaymentMethods] = usePaymentMethods();
  const [space] = useCurrentSpace();

  const [allowManualInput, setAllowManualInput] = useState(false);
  const [formError, setFormError] = useState<IUserError | null>(null);
  // Checks if we could load the logo
  const [logoLoadSuccess, setLogoLoadSuccess] = useState(false);

  const values = watch();

  useEffect(() => {
    const newContractAddress = watch(({ contractAddress, chainId, walletType }, { value, name }) => {

      if (walletType === 'metamask') {
        if ((name === 'contractAddress' || name === 'chainId') && isValidChainAddress(contractAddress as string)) {
          loadToken({ chainId: chainId as number, contractAddress: contractAddress as string });
        }
        // Remove the current token as the contract address is being modified
        else if (name === 'contractAddress' && !isValidChainAddress(contractAddress as string)) {
          setValue('tokenSymbol', null);
          setValue('tokenLogo', null);
        }
      }
    });
    return () => newContractAddress.unsubscribe();
  }, [watch]);

  useEffect(() => {
    if (values.gnosisSafeAddress) {
      const chain = getChainById(values.chainId);
      if (chain) {
        setValue('tokenSymbol', chain.nativeCurrency.symbol);
        setValue('tokenName', chain.nativeCurrency.name);
        setValue('tokenDecimals', chain.nativeCurrency.decimals);
        setValue('tokenLogo', null);
        setValue('contractAddress', null);
      }
    }
  }, [values.chainId, values.gnosisSafeAddress]);

  async function loadToken (tokenInfo: ITokenMetadataRequest) {
    setLoadingToken(true);
    try {
      const tokenData = await charmClient.getTokenMetaData(tokenInfo);
      setValue('tokenSymbol', tokenData.symbol);
      trigger('tokenSymbol');
      setValue('tokenLogo', tokenData.logo ?? undefined);
      trigger('tokenLogo');
      setValue('tokenName', tokenData.name ?? undefined);
      trigger('tokenName');
      setValue('tokenDecimals', tokenData.decimals ?? undefined);
      trigger('tokenDecimals');
      setAllowManualInput(false);
      setLoadingToken(false);
    }
    catch (error) {
      setValue('tokenLogo', null);
      setValue('tokenSymbol', null);
      setValue('tokenName', null);
      setValue('tokenDecimals', null);
      setAllowManualInput(true);
      setLoadingToken(false);
    }
  }

  function setChainId (_chainId: number) {
    setValue('chainId', _chainId);
  }

  async function addPaymentMethod (paymentMethod: Partial<PaymentMethod>) {
    setFormError(null);
    paymentMethod.spaceId = space?.id;
    if (!logoLoadSuccess) {
      delete paymentMethod.tokenLogo;
    }

    try {
      const createdPaymentMethod = await charmClient.createPaymentMethod(paymentMethod);
      refreshPaymentMethods();
      onSubmit(createdPaymentMethod);
    }
    catch (error: any) {
      setFormError({
        message: error.message || error.error || (typeof error === 'object' ? JSON.stringify(error) : error),
        severity: error.severity ?? 'error'
      });
    }

  }

  // Only checks the format, not if we can load the logo
  const validTokenLogoAddressFormat = !!values.tokenLogo && !errors.tokenLogo;

  return (
    <div>
      {/* @ts-ignore */}
      <form onSubmit={handleSubmit(addPaymentMethod)} style={{ margin: 'auto', maxHeight: '80vh', overflowY: 'auto' }}>
        <Grid container direction='column' spacing={3}>

          <Grid item xs>
            <InputLabel>
              Wallet Type
            </InputLabel>
            <Select
              {...register('walletType')}
              displayEmpty
              fullWidth
              renderValue={(selected) => {
                if (!selected) {
                  return <Typography color='secondary'>Select a wallet type</Typography>;
                }
                return selected === 'metamask' ? 'Metamask' : 'Gnosis Safe';
              }}
            >
              <MenuItem value='metamask'>Metamask</MenuItem>
              <MenuItem value='gnosis'>Gnosis Safe</MenuItem>
            </Select>
          </Grid>

          <Grid item xs>
            <InputLabel>
              Blockchain
            </InputLabel>
            <InputBlockchainSearch
              defaultChainId={defaultChainId}
              onChange={setChainId}
            />
          </Grid>

          {values.walletType === 'gnosis' && (
            <Grid item xs>
              <TextField
                {...register('gnosisSafeAddress')}
                fullWidth
                placeholder='Enter Gnosis Safe address'
                error={!!errors.gnosisSafeAddress?.message}
                helperText={errors.gnosisSafeAddress?.message}
              />
            </Grid>
          )}

          {values.walletType === 'metamask' && (
            <Grid item xs>
              <InputLabel>
                Contract address
              </InputLabel>
              <TextField
                {...register('contractAddress')}
                type='text'
                fullWidth
                error={!!errors.contractAddress?.message}
                helperText={errors.contractAddress?.message}
                InputProps={{
                  endAdornment: loadingToken && <Progress color='inherit' size='1em' />
                }}
              />
              {
                !(errors?.contractAddress) && allowManualInput && !loadingToken && (
                  <Alert severity='info'>
                    We couldn't find data about this token. Enter its details below, or select a different blockchain.
                  </Alert>
                )
              }
            </Grid>
          )}

          {
            values.contractAddress && !errors.contractAddress && !loadingToken && (
              <>
                <Grid item container xs>
                  <Grid item xs={6} sx={{ pr: 2 }}>
                    <InputLabel>
                      Token symbol
                    </InputLabel>
                    <TextField
                      InputProps={{
                        readOnly: !allowManualInput
                      }}
                      {...register('tokenSymbol')}
                      type='text'
                      error={!!errors.tokenSymbol?.message}
                      helperText={errors.tokenSymbol?.message}
                    />
                  </Grid>

                  <Grid item xs={6} sx={{ pl: 2 }}>
                    <InputLabel>
                      Token decimals
                    </InputLabel>
                    <TextField
                      {...register('tokenDecimals')}
                      type='number'
                      inputMode='numeric'
                      inputProps={{
                        step: 1,
                        min: 1,
                        max: 18,
                        disabled: !allowManualInput
                      }}
                    />
                  </Grid>
                </Grid>
                <Grid item xs>
                  <InputLabel>
                    Token name
                  </InputLabel>
                  <TextField
                    {...register('tokenName')}
                    type='text'
                    fullWidth
                    InputProps={{
                      readOnly: !allowManualInput
                    }}
                    error={!!errors.tokenName?.message}
                    helperText={errors.tokenName?.message}
                  />
                </Grid>

                <Grid item container xs>
                  <Grid item xs={validTokenLogoAddressFormat ? 8 : 12}>
                    <InputLabel>
                      Token logo URL
                    </InputLabel>
                    <TextField
                      {...register('tokenLogo')}
                      type='text'
                      fullWidth
                      error={!!errors.tokenLogo?.message}
                      helperText={errors.tokenLogo?.message}
                      placeholder='https://app.charmverse.io/favicon.png'
                    />
                    {
                      (errors?.tokenLogo || (validTokenLogoAddressFormat && !logoLoadSuccess)) && (
                      <Alert severity='error'>
                        Invalid token logo url
                      </Alert>
                      )
                    }
                  </Grid>
                  {
                    validTokenLogoAddressFormat && (
                      <Grid item xs={4} sx={{ display: 'flex', justifyContent: 'center', alignContent: 'center', verticalAlign: 'center' }}>
                        <img
                          alt=''
                          style={{ maxHeight: '50px' }}
                          src={values.tokenLogo!}
                          onError={(error) => {
                            setLogoLoadSuccess(false);
                          }}
                          onLoad={() => {
                            setLogoLoadSuccess(true);
                          }}
                        />
                      </Grid>
                    )
                  }
                </Grid>
              </>
            )
          }
          {
            formError && (
              <Grid item xs>
                <Alert severity={formError.severity}>
                  {formError.message}
                </Alert>
              </Grid>
            )
          }
          <Grid item>
            <Button type='submit' disabled={!isValid || (values.contractAddress === '' && values.gnosisSafeAddress === '')}>Create payment method</Button>
          </Grid>
        </Grid>
      </form>
    </div>
  );
}
