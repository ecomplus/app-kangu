const logger = require('firebase-functions/logger')
const getAppData = require('./../../lib/store-api/get-app-data')
const createTag = require('../../lib/kangu/create-tag')

const parseStatus = (status) => {
  if (status) {
    switch (status.toLowerCase()) {
      case 'pago':
        return 'paid'
      case 'em produção':
        return 'in_production'
      case 'em separação':
        return 'in_separation'
      case 'pronto para envio':
        return 'ready_for_shipping'
      case 'nf emitida':
        return 'invoice_issued'
      case 'enviado':
        return 'shipped'
      default:
        return 'ready_for_shipping'
    }
  }
  return 'ready_for_shipping'
}

exports.post = ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body
  const order = trigger.body
  const orderId = trigger.resource_id
  if (
    trigger.resource !== 'orders' || !order ||
    (!order.fulfillment_status && !order.financial_status)
  ) {
    res.sendStatus(204)
    return
  }

  appSdk.getAuth(storeId).then(auth => {
    return getAppData({ appSdk, storeId, auth }).then(appData => {
      const { kangu_token: kanguToken } = appData
      if (!kanguToken) return
      if (!appData.enable_auto_tag) return
      const statusToSend = parseStatus(appData.send_tag_status)
      if (
        (statusToSend === order.fulfillment_status?.current) ||
        (statusToSend === order.financial_status?.current)
      ) {
        logger.info(`Handling webhook to tag ${orderId}`)
        return appSdk.apiRequest(storeId, `/orders/${orderId}.json`, 'GET', null, auth)
          .then(({ response }) => {
            const order = response.data
            const shippingLine = order.shipping_lines?.find(({ flags }) => {
              return flags?.find((flag) => flag.startsWith('kangu-'))
            })
            if (!shippingLine) {
              return
            }
            logger.info(`Shipping tag for #${storeId} ${orderId}`)
            return createTag(order, kanguToken, storeId, appData, appSdk)
              .then(data => {
                const customFields = shippingLine.custom_fields || []
                const tagData = data?.[0]
                if (!tagData?.codigo) {
                  logger.warn(`Unexpected create tag response for ${orderId}`, {
                    tagData,
                    data
                  })
                  return
                }
                customFields.push({
                  field: 'rastreio',
                  value: tagData.codigo.replaceAll(' ', '')
                })
                const orderPatch = {
                  custom_fields: customFields
                }
                const trackingCode = tagData.etiquetas?.[0]?.numeroTransp
                if (trackingCode) {
                  const trackingCodes = shippingLine.tracking_codes || []
                  trackingCodes.push({
                    code: trackingCode,
                    link: 'https://www.kangu.com.br/rastreio/',
                    tag: 'kangu'
                  })
                  orderPatch.tracking_codes = trackingCodes
                }
                logger.info(`Updating ${orderId}`, { orderPatch })
                return appSdk.apiRequest(
                  storeId,
                  `/orders/${orderId}/shipping_lines/${shippingLine._id}.json`,
                  'PATCH',
                  orderPatch,
                  auth
                )
              })
              .then(() => {
                if (!res.headersSent) res.sendStatus(201)
              })
              .catch(err => {
                logger.error(err)
                res.sendStatus(500)
              })
          })
      }
    })
  })
    .then(() => {
      if (!res.headersSent) res.sendStatus(200)
    })
    .catch(err => {
      if (err.appWithoutAuth === true) {
        const msg = `Webhook for ${storeId} unhandled with no authentication found`
        const error = new Error(msg)
        error.trigger = JSON.stringify(trigger)
        logger.error(error)
        res.status(412).send(msg)
      } else {
        res.status(500)
        const { message } = err
        res.send({ message })
      }
    })
}
