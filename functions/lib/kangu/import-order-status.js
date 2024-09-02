const logger = require('firebase-functions/logger')
const axios = require('axios')
const { getShippingCustomField } = require('./util')

const parseKanguStatus = ({ shipmentStatus }) => {
  switch (shipmentStatus) {
    case 'DELIVERED':
      return 'delivered'
    case 'SHIPPED':
    case 'DROPPED_OFF':
    case 'IN_HUB':
      return 'shipped'
  }
  return null
}

module.exports = async (
  { appSdk, storeId, auth },
  { order, token }
) => {
  const { number } = order
  const trackingId = getShippingCustomField(order, 'rastreio')
  if (!trackingId) {
    logger.warn(`No tracking ID for #${storeId} ${number}`)
    return
  }
  logger.info(`Tracking #${storeId} ${number} with ID ${trackingId}`)
  const { data } = await axios.get(`https://portal.kangu.com.br/tms/transporte/rastrear/${trackingId}`, {
    headers: {
      'content-type': 'application/json',
      token,
      accept: 'application/json'
    },
    timeout: 7000
  })
  const trackingResult = data?.situacao || {}
  const status = parseKanguStatus(trackingResult)
  if (!status) {
    logger.warn(`No parsed fulfillment status for #${storeId} ${number}`, {
      trackingId,
      trackingResult
    })
    return
  }
  if (status !== order.fulfillment_status?.current) {
    const shippingLine = order.shipping_lines?.find(({ flags }) => {
      return flags?.find((flag) => flag.startsWith('kangu-'))
    })
    await appSdk.apiRequest(
      storeId,
      `/orders/${order._id}/fulfillments.json`,
      'POST',
      {
        shipping_line_id: shippingLine?._id,
        date_time: new Date().toISOString(),
        status,
        notification_code: `${trackingResult.ocorrencia}`,
        flags: ['kangu']
      },
      auth
    )
    logger.info(`#${storeId} ${number} updated to ${status}`)
  }
}
