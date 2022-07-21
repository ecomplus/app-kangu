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

  // get app configured options
  let auth
  appSdk.getAuth(storeId)
    .then(_auth => {
      auth = _auth
      return getAppData({ appSdk, storeId, auth })
    })

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
      console.log(appData)
      const { kangu_token } = appData
      console.log('Auto tag is:', appData.enable_auto_tag)
      console.log('meu kangu_token é: ', kangu_token)
      console.log('meu triiger resource é: ', trigger.resource)
      if (appData.enable_auto_tag && kangu_token && trigger.resource === 'orders') {
        // handle order fulfillment status changes
        const order = trigger.body
        if (
          order &&
          order.fulfillment_status &&
          order.fulfillment_status.current === 'ready_for_shipping'
        ) {
          // read full order body
          const resourceId = trigger.resource_id
          console.log('Trigger disparado para enviar tag com id:', resourceId)
          return appSdk.apiRequest(storeId, `/orders/${resourceId}.json`, 'GET', null, auth)
            .then(({ response }) => {
              const order = response.data
              if (order && order.shipping_lines[0] && order.shipping_lines[0].app && order.shipping_lines[0].app.service_name.toLowerCase().indexOf('kangu') === -1) {
                return res.send(ECHO_SKIP)
              }
              console.log(`Shipping tag for #${storeId} ${order._id}`)
              return createTag(order, kangu_token, appData, appSdk, auth)
                .then(data => {
                  console.log(`>> Etiqueta Criada Com Sucesso #${storeId} ${resourceId}`)
                  // updates hidden_metafields with the generated tag id
                  return appSdk.apiRequest(
                    storeId,
                    `/orders/${resourceId}/hidden_metafields.json`,
                    'POST',
                    {
                      namespace: 'app-kangu',
                      field: 'rastreio',
                      value: data.codigo
                    }
                  ).then(() => data)
                })

                .then(data => {
                  if (data.etiquetas.length) {
                    const shippingLine = order.shipping_lines[0]
                    if (shippingLine) {
                      const trackingCodes = shippingLine.tracking_codes || []
                      trackingCodes.push({
                        code: data.etiquetas[0].numeroTransp,
                        link: `https://www.melhorrastreio.com.br/rastreio/${data.etiquetas[0].numeroTransp}`
                      })
                      return appSdk.apiRequest(
                        storeId,
                        `/orders/${resourceId}/shipping_lines/${shippingLine._id}.json`,
                        'PATCH',
                        { tracking_codes: trackingCodes }
                      )
                    }
                  }
                  return null
                })

                .then(() => {
                  console.log(`>> 'hidden_metafields' do pedido ${order._id} atualizado com sucesso!`)
                  // done
                  res.send(ECHO_SUCCESS)
                })
            })
        }
      }
    })


    .then(() => {
      // all done
      res.send(ECHO_SUCCESS)
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
