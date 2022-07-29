const axios = require('axios')
const ecomUtils = require('@ecomplus/utils')

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

  const kanguCustom = (order, field) => {
    const shippingCustom = order.shipping_lines[0] && order.shipping_lines[0].custom_fields
    const customField = shippingCustom.find(custom => custom.field === field); console.log(customField)
    if (customField !== undefined && customField !== 'false') {
      return customField.value
    } else {
      return false
    }
  }

  const getEcomProduct = (appSdk, storeId, productId) => {
    const resource = `/products/${productId}.json`
    return new Promise((resolve, reject) => {
      appSdk.apiRequest(storeId, resource, 'GET', null, null, noAuth = true)
        .then(({ response }) => {
          resolve({ response })
        })
        .catch((err) => {
          console.log(err.message)
          console.log('erro na request api')
          reject(err)
        })
    })     
  }

  const hasInvoice = (order) => {
    return Boolean(order.shipping_lines.find(({ invoices }) => {
      return invoices && invoices[0] && invoices[0].number
    }))
  }

  const sendType = hasInvoice(order) ? 'N' : 'D'
  const { items } = order

  // start parsing order body
  data.produtos = []
  if (items) {
    for (let i = 0; i < items.length; i++) {
      let produto = {}
      produto.valor = items[i].final_price
      produto.quantidade = items[i].quantity
      produto.produto = items[i].name
      await getEcomProduct(appSdk, storeId, items[i].product_id)
      .then(({ response }) => {
        const product = response.data
          console.log('Busca produto')
          console.log(JSON.stringify(product))
          const { name, dimensions, weight } = product
        // parse cart items to kangu schema
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
        produto.altura = cmDimensions.height || 0,
        produto.largura = cmDimensions.width || 0,
        produto.comprimento = cmDimensions.length || 0
        data.produtos.push(produto)
      })
      .catch(err => {
        console.log(err.message)
        console.error('deu erro ao buscar produto')
      })
    }
  }
  // config source
  data.origem = 'E-Com Plus'
  // config order info
  data.pedido = {
    numeroCli: order._id,
    vlrMerc: (order.amount && order.amount.total) || 0,
    tipo: sendType
  }

  if (hasInvoice(order)) {
    const invoice = order.shipping_lines[0].invoices[0]
    data.pedido.numero = invoice.number
    data.pedido.serie = invoice.serial_number
    data.pedido.chave = invoice.access_key
  }
  // config buyer information
  const buyer = order.buyers && order.buyers[0]
  if (buyer && buyer.doc_number) {
    data.destinatario.cnpjCpf = buyer.doc_number.replace(/\D/g, '')
    data.destinatario.contato = buyer.display_name
  }

  const requests = []
  if (order.shipping_lines) {
    order.shipping_lines.forEach(shippingLine => {
      if (shippingLine.app) {
        data.servicos = [shippingLine.app.service_code]
        // parse addresses and package info from shipping line object
        if (shippingLine.from) {
          data.remetente = {}
          if (appData.seller) {
            data.remetente.nome = appData.seller.name
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
        if (shippingLine.package && shippingLine.package.weight) {
          const { value, unit } = shippingLine.package.weight
          data.pedido.pesoMerc = !unit || unit === 'kg' ? value
            : unit === 'g' ? value * 1000
              : value * 1000000
        }
        data.referencia = kanguCustom(order, 'kangu_reference')
        console.log('Estou criando a tag')
        console.log(`> Create tag for #${order._id}: ` + JSON.stringify(data))
        // send POST to generate Kangu tag
        requests.push(axios.post(
          'https://portal.kangu.com.br/tms/transporte/solicitar',
          data,
          {
            headers
          }
        ).then(response => {
          console.log('> Kangu create tag')
          return response.data
        }).catch(err => {
          console.log('deu erro na etiqueta', err.message)
        }))
      }
    })
  }
    
  return Promise.all(requests)
}
