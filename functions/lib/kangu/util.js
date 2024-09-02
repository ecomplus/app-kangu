const { logger } = require('firebase-functions')

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
  getShippingCustomField,
  debugAxiosError
}
