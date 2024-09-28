const axios = require('axios')
const logger = require('firebase-functions/logger')
const {
  getBestPackage,
  getShippingCustomField,
  debugAxiosError
} = require('./util')

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

module.exports = async ({
  order,
  shippingLine,
  kanguToken,
  storeId,
  appData,
  appSdk
}) => {
  // create new shipping tag with Kangu
  // https://portal.kangu.com.br/docs/api/transporte/#/
  const headers = {
    token: kanguToken,
    accept: 'application/json',
    'Content-Type': 'application/json'
  }
  const data = {
    destinatario: {},
    remetente: {}
  }
  const isUsingCubicWeight = (appData.use_kubic_weight || appData.use_cubic_weight)
  const produtos = []
  let pkgKgWeight = 0
  let pkgM3Vol = 0
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i]
    const { quantity } = item
    const produto = {
      valor: item.final_price || item.price || 0.01,
      quantidade: quantity,
      produto: item.name
    }
    await getEcomProduct(appSdk, storeId, item.product_id)
      .then(({ response }) => {
        const product = response.data
        const { dimensions, weight } = product
        let kgWeight = 0
        let cubicWeight = 0
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
        let m3 = 1
        for (const side in cmDimensions) {
          if (cmDimensions[side]) {
            m3 *= (cmDimensions[side] / 100)
          }
        }
        if (m3 > 1) {
          pkgM3Vol += (quantity * m3)
          // 167 kg/m³
          cubicWeight = m3 * 167
        }
        if (kgWeight > 0) {
          const unitFinalWeight = cubicWeight < 0.5 || kgWeight > cubicWeight
            ? kgWeight
            : cubicWeight
          pkgKgWeight += (quantity * unitFinalWeight)
        }
        produto.peso = kgWeight
        produto.altura = cmDimensions.height || 0
        produto.largura = cmDimensions.width || 0
        produto.comprimento = cmDimensions.length || 0
        produtos.push(produto)
      })
      .catch(logger.error)
  }
  if (isUsingCubicWeight) {
    data.produtos = [{
      peso: pkgKgWeight,
      altura: 36,
      largura: 70,
      comprimento: 36,
      ...getBestPackage(pkgM3Vol),
      valor: order.amount?.subtotal || 0,
      quantidade: 1,
      produto: `Pedido #${order.number}`
    }]
  } else if (order.items) {
    data.produtos = produtos
  }
  const invoice = shippingLine.invoices?.find((invoice) => {
    return invoice.number && invoice.access_key
  })
  data.origem = 'E-Com Plus'
  data.pedido = {
    numeroCli: appData.send_number ? order.number : order._id,
    vlrMerc: order.amount?.subtotal || 0,
    tipo: invoice ? 'N' : 'D'
  }
  if (invoice) {
    data.pedido.numero = invoice.number
    data.pedido.serie = invoice.serial_number || '1'
    data.pedido.chave = invoice.access_key
  }
  const buyer = order.buyers?.[0]
  if (buyer?.doc_number) {
    data.destinatario.cnpjCpf = buyer.doc_number.replace(/\D/g, '')
    data.destinatario.contato = buyer.display_name
  }
  if (buyer?.main_email) {
    data.destinatario.email = buyer.main_email
  }
  if (buyer?.phones?.length) {
    data.destinatario.celular = buyer.phones[0].number
  }
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
  return axios.post(
    'https://portal.kangu.com.br/tms/transporte/solicitar',
    data,
    { headers }
  ).then(response => {
    logger.info('> Kangu tag created')
    return response.data
  }).catch(error => {
    debugAxiosError(error)
    throw error
  })
}
