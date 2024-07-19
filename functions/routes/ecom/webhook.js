// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')
const createTag = require('../../lib/kangu/create-tag')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

exports.post = ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body

  const parseStatus = (status) => {
    if (status) {
      switch (status.toLowerCase()) {
        case 'pago':
          return 'paid'
          break;
        case 'em produção':
          return 'in_production'
          break;
        case 'em separação':
          return 'in_separation'
          break;
        case 'pronto para envio':
          return 'ready_for_shipping'
          break;
        case 'nf emitida':
          return 'invoice_issued'
          break;
        case 'enviado':
          return 'shipped'
          break;
        default: 
          return 'ready_for_shipping'
          break;
      }
    }
    return 'ready_for_shipping'
  }

  // get app configured options
  let auth
  appSdk.getAuth(storeId).then(_auth => {
    auth = _auth
    return getAppData({ appSdk, storeId, auth })

    .then(appData => {
      if (
        Array.isArray(appData.ignore_triggers) &&
        appData.ignore_triggers.indexOf(trigger.resource) > -1
      ) {
        // ignore current trigger
        const err = new Error()
        err.name = SKIP_TRIGGER_NAME
        throw err
      }

      /* DO YOUR CUSTOM STUFF HERE */
      const { kangu_token, send_tag_status, send_tag_status_returned } = appData
      const sendStatus = parseStatus(send_tag_status)
      // const isReturn = send_tag_status_returned && order.fulfillment_status.current === 'returned_for_exchange'
      // console.log(isReturn)
      if (appData.enable_auto_tag && kangu_token && trigger.resource === 'orders') {
        // handle order fulfillment status changes
        const order = trigger.body
        if (
          order &&
          order.fulfillment_status &&
          (!sendStatus && order.fulfillment_status.current === 'ready_for_shipping') || (sendStatus === order.fulfillment_status.current)
        ) {
          // read full order body
          const resourceId = trigger.resource_id
          console.log('Trigger disparado para enviar tag com id:', resourceId)
          return appSdk.apiRequest(storeId, `/orders/${resourceId}.json`, 'GET', null, auth)
            .then(({ response }) => {
              const order = response.data
              const shippingLine = order && order.shipping_lines && order.shipping_lines.length && order.shipping_lines[0]
              if (shippingLine.flags && shippingLine.flags.length && shippingLine.flags.indexOf('kangu-ws') === -1) {
                return res.send(ECHO_SKIP)
              }
              console.log(`Shipping tag for #${storeId} ${order._id}`)
              return createTag(order, kangu_token, storeId, appData, appSdk)
                .then(data => {
                  console.log(`>> Etiqueta Criada Com Sucesso #${storeId} ${resourceId}`, JSON.stringify(data))
                  // updates hidden_metafields with the generated tag id
                  const custom_fields = shippingLine.custom_fields || []
                  custom_fields.push({
                    field: 'rastreio',
                    value: data.codigo
                  })
                  if (data.etiquetas && data.etiquetas.length) {
                    if (shippingLine) {
                      const trackingCodes = shippingLine.tracking_codes || []
                      trackingCodes.push({
                        code: tag.etiquetas[0].numeroTransp,
                        link: `https://www.melhorrastreio.com.br/rastreio/${tag.etiquetas[0].numeroTransp}`
                      })
                      return appSdk.apiRequest(
                        storeId,
                        `/orders/${resourceId}/shipping_lines/${shippingLine._id}.json`,
                        'PATCH',
                        { 
                          tracking_codes: trackingCodes,
                          custom_fields 
                         },
                        auth
                      )
                    }
                  }
                })
                .then(() => {
                  console.log(`>> Pedido ${order._id} atualizado com sucesso!`)
                  // done
                  res.send(ECHO_SUCCESS)
                })
                .catch(err => {
                  console.log('deu error após gerar', err.message)
                })
            })
        }
      }
    })
    .then(() => {
      // all done
      res.send(ECHO_SUCCESS)
    })
  })


    .catch(err => {
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else if (err.appWithoutAuth === true) {
        const msg = `Webhook for ${storeId} unhandled with no authentication found`
        const error = new Error(msg)
        error.trigger = JSON.stringify(trigger)
        console.error(error)
        res.status(412).send(msg)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
