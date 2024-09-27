const { logger } = require('firebase-functions')

const pkgCms = [
  { altura: 4, largura: 16, comprimento: 24 },
  { altura: 4, largura: 36, comprimento: 28 },
  { altura: 9, largura: 27, comprimento: 18 },
  { altura: 9, largura: 18, comprimento: 13.5 },
  { altura: 13.5, largura: 27, comprimento: 22.5 },
  { altura: 18, largura: 36, comprimento: 27 },
  { altura: 27, largura: 36, comprimento: 27 },
  { altura: 27, largura: 54, comprimento: 36 },
  { altura: 36, largura: 70, comprimento: 36 }
]
const getBestPackage = (pkgM3Vol) => {
  let smallestPkg
  let smallestPkgM3
  pkgCms.forEach((currentPkg) => {
    let currentPkgM3 = 1
    Object.values(currentPkg).forEach((cm) => {
      currentPkgM3 *= (cm / 100)
    })
    if (currentPkgM3 < pkgM3Vol) return
    if (!smallestPkgM3 || smallestPkgM3 > currentPkgM3) {
      smallestPkg = currentPkg
      smallestPkgM3 = currentPkgM3
    }
  })
  return smallestPkg
}

const getShippingCustomField = (order, field) => {
  if (order.shipping_lines) {
    for (let i = 0; i < order.shipping_lines.length; i++) {
      const shippingLineFields = order.shipping_lines[i].custom_fields
      const customField = shippingLineFields?.find(custom => custom.field === field)
      if (customField) {
        return customField.value
      }
    }
  }
  return false
}

const debugAxiosError = error => {
  const err = new Error(error.message)
  if (error.response) {
    err.status = error.response.status
    err.response = error.response.data
  }
  err.request = error.config
  logger.error(err)
}

module.exports = {
  getBestPackage,
  getShippingCustomField,
  debugAxiosError
}
