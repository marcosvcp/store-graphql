import axios from 'axios'
import * as qs from 'qs'
import { keys } from 'ramda'

const TIMEOUT_MS = 7 * 1000
const MAX_AGE_S = 30
const STALE_IF_ERROR_S = 20 * 60

const isPlatformGC = account => account.indexOf('gc_') === 0 || account.indexOf('gc-') === 0

export const catalogProxy = async (ctx: ServiceContext) => {
  try {
    const {vtex: {account, authToken, production, route: {params: {path}}}, headers: {cookie}, query} = ctx

    const [host, basePath] = isPlatformGC(account)
      ? ['api.gocommerce.com', `${account}/search`]
      : [`${account}.vtexcommercestable.com.br`, 'api/catalog_system']

    const {data, headers} = await axios.request({
      baseURL: `http://${host}/${basePath}`,
      headers: {
        'Authorization': authToken,
        'Proxy-Authorization': authToken,
        'X-VTEX-Proxy-To': `https://${host}`,
        ...cookie && {cookie},
      },
      params: query,
      paramsSerializer: (params) => qs.stringify(params, {arrayFormat: 'repeat'}),
      timeout: TIMEOUT_MS,
      url: encodeURI(path.trim()),
    })

    keys(headers).forEach(headerKey => {
      ctx.set(headerKey, headers[headerKey])
    })

    ctx.set('cache-control', production ? `public, max-age=${MAX_AGE_S}, stale-if-error=${STALE_IF_ERROR_S}` : 'no-store, no-cache')
    ctx.body = data
  }
  catch (err) {
    console.log('Error in proxy catalog', err)
    const {data, status} = err.response
    ctx.body = data
    ctx.status = status
    ctx.set('Cache-Control', 'no-cache, no-store')
  }
}
