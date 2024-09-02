const axios = require('axios')
const logger = require('firebase-functions/logger')
const { getShippingCustomField, debugAxiosError } = require('./util')

const getEcomProduct = (appSdk, storeId, productId) => {
  const resource = `/products/${productId}.json`
  return new Promise((resolve, reject) => {
    appSdk.apiRequest(storeId, resource, 'GET', null, null, true)
      .then(({ response }) => {
        resolve({ response })
      })
      .catch((err) => {
        logger.error(err)
        reject(err)
      })
  })
}

module.exports = async (order, token, storeId, appData, appSdk) => {
// create new shipping tag with Kangu
// https://portal.kangu.com.br/docs/api/transporte/#/
  const headers = {
    token,
    accept: 'application/json',
    'Content-Type': 'application/json'
  }
  const data = {}
  data.destinatario = {}
  data.remetente = {}
  const hasInvoice = Boolean(order.shipping_lines.find(({ invoices }) => {
    return invoices && invoices[0] && invoices[0].number
  }))
  const { items } = order
  // start parsing order body
  data.produtos = []
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const produto = {
        valor: items[i].final_price,
        quantidade: items[i].quantity,
        produto: items[i].name
      }
      await getEcomProduct(appSdk, storeId, items[i].product_id)
        .then(({ response }) => {
          const product = response.data
          const { dimensions, weight } = product
          let kgWeight = 0
          if (weight && weight.value) {
            switch (weight.unit) {
              case 'g':
                kgWeight = weight.value / 1000
                break
              case 'mg':
                kgWeight = weight.value / 1000000
                break
              default:
                kgWeight = weight.value
            }
          }
          const cmDimensions = {}
          if (dimensions) {
            for (const side in dimensions) {
              const dimension = dimensions[side]
              if (dimension && dimension.value) {
                switch (dimension.unit) {
                  case 'm':
                    cmDimensions[side] = dimension.value * 100
                    break
                  case 'mm':
                    cmDimensions[side] = dimension.value / 10
                    break
                  default:
                    cmDimensions[side] = dimension.value
                }
              }
            }
          }
          produto.peso = kgWeight
          produto.altura = cmDimensions.height || 0
          produto.largura = cmDimensions.width || 0
          produto.comprimento = cmDimensions.length || 0
          data.produtos.push(produto)
        })
        .catch(logger.error)
    }
  }
  data.origem = 'E-Com Plus'
  data.pedido = {
    numeroCli: appData.send_number ? order.number : order._id,
    vlrMerc: (order.amount && order.amount.total) || 0,
    tipo: hasInvoice ? 'N' : 'D'
  }
  if (hasInvoice) {
    const invoice = order.shipping_lines[0].invoices[0]
    data.pedido.numero = invoice.number
    data.pedido.serie = invoice.serial_number || '1'
    data.pedido.chave = invoice.access_key
  }
  const buyer = order.buyers && order.buyers[0]
  if (buyer && buyer.doc_number) {
    data.destinatario.cnpjCpf = buyer.doc_number.replace(/\D/g, '')
    data.destinatario.contato = buyer.display_name
  }
  if (buyer && buyer.main_email) {
    data.destinatario.email = buyer.main_email
  }
  if (buyer && Array.isArray(buyer.phones) && buyer.phones.length) {
    data.destinatario.celular = buyer.phones[0].number
  }
  const requests = []
  if (order.shipping_lines) {
    order.shipping_lines.forEach(shippingLine => {
      if (shippingLine.app) {
        data.servicos = [shippingLine.app.service_name]
        // parse addresses and package info from shipping line object
        if (shippingLine.from) {
          data.remetente = {}
          if (appData.seller) {
            data.remetente.nome = appData.seller.name
            if (shippingLine.warehouse_code) {
              data.remetente.nome += ` [${shippingLine.warehouse_code}]`
            }
            data.remetente.cnpjCpf = appData.seller.doc_number
            data.remetente.contato = appData.seller.contact
          }
          data.remetente.endereco = {
            logradouro: shippingLine.from.street,
            numero: shippingLine.from.number || 'SN',
            bairro: shippingLine.from.borough,
            cep: shippingLine.from.zip.replace(/\D/g, ''),
            cidade: shippingLine.from.city,
            uf: shippingLine.from.province_code,
            complemento: shippingLine.from.complement || ''
          }
        }
        if (shippingLine.to) {
          data.destinatario.nome = shippingLine.to.name
          if (shippingLine.warehouse_code) {
            data.destinatario.nome += ` [${shippingLine.warehouse_code}]`
          }
          data.destinatario.endereco = {
            logradouro: shippingLine.to.street,
            numero: shippingLine.to.number || 'SN',
            bairro: shippingLine.to.borough,
            cep: shippingLine.to.zip.replace(/\D/g, ''),
            cidade: shippingLine.to.city,
            uf: shippingLine.to.province_code,
            complemento: shippingLine.to.complement || ''
          }
        }
        data.referencia = getShippingCustomField(order, 'kangu_reference')
        logger.info(`> Create tag for #${order._id}`, { data })
        // send POST to generate Kangu tag
        requests.push(axios.post(
          'https://portal.kangu.com.br/tms/transporte/solicitar',
          data,
          { headers }
        ).then(response => {
          logger.info('> Kangu tag created')
          return response.data
        }).catch(error => {
          debugAxiosError(error)
          throw error
        }))
      }
    })
  }
  return Promise.all(requests)
}
