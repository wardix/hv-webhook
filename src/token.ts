import axios from 'axios'
import { COMPANY_CONFIG, TOKEN_REFRESH_MARGIN } from './config'

const companyConfig = JSON.parse(COMPANY_CONFIG)

let cachedToken: any = {}
let tokenExpiryTime: any = {}

export const retrieveBearerToken = async (companyId: string) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)
  const isTokenValid =
    cachedToken[companyId] &&
    tokenExpiryTime[companyId] &&
    currentTimeInSeconds <
      tokenExpiryTime[companyId] - Number(TOKEN_REFRESH_MARGIN)

  if (isTokenValid) {
    return cachedToken[companyId]
  }

  try {
    const response = await axios.post(companyConfig[companyId].token_api_url, {
      grant_type: companyConfig[companyId].grant_type,
      client_id: companyConfig[companyId].client_id,
      client_secret: companyConfig[companyId].client_secret,
    })
    cachedToken[companyId] = response.data.access_token
    tokenExpiryTime[companyId] =
      currentTimeInSeconds + Number(response.data.expires_in)

    return cachedToken[companyId]
  } catch (error) {
    console.error('Error fetching bearer token: ', error)
  }
}
