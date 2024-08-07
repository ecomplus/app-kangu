const logger = require('firebase-functions/logger')
const axios = require('axios')

const parseKanguStatus = ({ shipmentStatus }) => {
  switch (shipmentStatus) {
    case 'DELIVERED':
      return 'delivered'
    case 'SHIPPED':
    case 'DROPPED_OFF':
      return 'shipped'
  }
  return null
}

module.exports = async (
  { appSdk, storeId, auth },
  { order, token }
) => {
  const { number } = order
  // const shippingLine = order.shipping_lines?.find(({ app }) => app?.carrier === 'kangu')
  const shippingLine = order.shipping_lines?.find(({ custom_fields }) => custom_fields && custom_fields?.some(({ field }) => field === 'kangu_reference'))
  if (!shippingLine?.to) return
  const customTracking = shippingLine?.custom_fields.find(custom => custom.field === 'rastreio')
  let trackingId = null
  if (customTracking && customTracking.value) {
    trackingId = customTracking.value
  }
  logger.info(`Tracking #${storeId} ${number} with ID ${trackingId}`)
  if (trackingId) {
    const { data } = await axios.get(`https://portal.kangu.com.br/tms/transporte/rastrear/${trackingId}`, {
      headers: {
        'content-type': 'application/json',
        token,
        accept: 'application/json'
      },
      timeout: 7000
    })
    const trackingResult = data?.situacao
    if (!trackingResult) return
    const status = parseKanguStatus(trackingResult)
    if (!status) {
      logger.warn(`No parsed fulfillment status for #${storeId} ${number}`, {
        trackingId,
        trackingResult
      })
      return
    }
  
    if (status !== order.fulfillment_status.current) {
      await appSdk.apiRequest(
        storeId,
        `/orders/${order._id}/fulfillments.json`,
        'POST',
        {
          shipping_line_id: shippingLine._id,
          date_time: new Date().toISOString(),
          status,
          notification_code: `kangu:${trackingResult.dataHora}:${trackingResult.ocorrencia}`,
          flags: ['kangu']
        },
        auth
      )
      logger.info(`#${storeId} ${number} updated to ${status}`)
    }
  } else {
    logger.info(`#${storeId} ${number} doenst have tracking code`)
  }
  
}
