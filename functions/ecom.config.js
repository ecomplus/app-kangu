/* eslint-disable comma-dangle, no-multi-spaces, key-spacing */

/**
 * Edit base E-Com Plus Application object here.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/applications/
 */

const app = {
  app_id: 102707,
  title: 'Kangu',
  slug: 'kangu',
  type: 'external',
  state: 'active',
  authentication: true,

  /**
   * Uncomment modules above to work with E-Com Plus Mods API on Storefront.
   * Ref.: https://developers.e-com.plus/modules-api/
   */
  modules: {
    /**
     * Triggered to calculate shipping options, must return values and deadlines.
     * Start editing `routes/ecom/modules/calculate-shipping.js`
     */
    calculate_shipping:   { enabled: true },

    /**
     * Triggered to validate and apply discount value, must return discount and conditions.
     * Start editing `routes/ecom/modules/apply-discount.js`
     */
    // apply_discount:       { enabled: true },

    /**
     * Triggered when listing payments, must return available payment methods.
     * Start editing `routes/ecom/modules/list-payments.js`
     */
    // list_payments:        { enabled: true },

    /**
     * Triggered when order is being closed, must create payment transaction and return info.
     * Start editing `routes/ecom/modules/create-transaction.js`
     */
    // create_transaction:   { enabled: true },
  },

  /**
   * Uncomment only the resources/methods your app may need to consume through Store API.
   */
  auth_scope: {
    'stores/me': [
      'GET'            // Read store info
    ],
    procedures: [
      'POST'           // Create procedures to receive webhooks
    ],
    products: [
      // 'GET',           // Read products with public and private fields
      // 'POST',          // Create products
      // 'PATCH',         // Edit products
      // 'PUT',           // Overwrite products
      // 'DELETE',        // Delete products
    ],
    brands: [
      // 'GET',           // List/read brands with public and private fields
      // 'POST',          // Create brands
      // 'PATCH',         // Edit brands
      // 'PUT',           // Overwrite brands
      // 'DELETE',        // Delete brands
    ],
    categories: [
      // 'GET',           // List/read categories with public and private fields
      // 'POST',          // Create categories
      // 'PATCH',         // Edit categories
      // 'PUT',           // Overwrite categories
      // 'DELETE',        // Delete categories
    ],
    customers: [
      // 'GET',           // List/read customers
      // 'POST',          // Create customers
      // 'PATCH',         // Edit customers
      // 'PUT',           // Overwrite customers
      // 'DELETE',        // Delete customers
    ],
    orders: [
      'GET',           // List/read orders with public and private fields
      // 'POST',          // Create orders
      'PATCH',         // Edit orders
      // 'PUT',           // Overwrite orders
      // 'DELETE',        // Delete orders
    ],
    carts: [
      // 'GET',           // List all carts (no auth needed to read specific cart only)
      // 'POST',          // Create carts
      // 'PATCH',         // Edit carts
      // 'PUT',           // Overwrite carts
      // 'DELETE',        // Delete carts
    ],

    /**
     * Prefer using 'fulfillments' and 'payment_history' subresources to manipulate update order status.
     */
     'orders/fulfillments': [
      'GET',           // List/read order fulfillment and tracking events
      'POST',             // Create fulfillment event with new status
      // 'DELETE',        // Delete fulfillment event
    ],
    'orders/shipping_lines': [
      'GET',              // List/read order shipping lines
      'PATCH',            // Edit order shipping line nested object
    ],
    'orders/payments_history': [
      // 'GET',           // List/read order payments history events
      // 'POST',          // Create payments history entry with new status
      // 'DELETE',        // Delete payments history entry
    ],

    /**
     * Set above 'quantity' and 'price' subresources if you don't need access for full product document.
     * Stock and price management only.
     */
    'products/quantity': [
      // 'GET',           // Read product available quantity
      // 'PUT',           // Set product stock quantity
    ],
    'products/variations/quantity': [
      // 'GET',           // Read variaton available quantity
      // 'PUT',           // Set variation stock quantity
    ],
    'products/price': [
      // 'GET',           // Read product current sale price
      // 'PUT',           // Set product sale price
    ],
    'products/variations/price': [
      // 'GET',           // Read variation current sale price
      // 'PUT',           // Set variation sale price
    ],

    /**
     * You can also set any other valid resource/subresource combination.
     * Ref.: https://developers.e-com.plus/docs/api/#/store/
     */
  },

  admin_settings: {
    kangu_token: {
      schema: {
        type: 'string',
        maxLength: 255,
        title: 'Kangu token',
        description: 'Solitite na kangu o token para REST API c??lculo frete'
      },
      hide: true
    },
    zip: {
      schema: {
        type: 'string',
        maxLength: 9,
        pattern: '^[0-9]{5}-?[0-9]{3}$',
        title: 'CEP de origem'
      },
      hide: true
    },
    additional_price: {
      schema: {
        type: 'number',
        minimum: -999999,
        maximum: 999999,
        title: 'Custo adicional',
        description: 'Valor a adicionar (negativo para descontar) no frete calculado em todas regras'
      },
      hide: false
    },
    seller: {
      schema: {
        type: 'object',
        title: 'Dados do remetente',
        description: 'Configure informa????es de remetente para etiqueta.',
        properties: {
          doc_number: {
            type: 'string',
            maxLength: 20,
            title: 'CPF/CNPJ sem pontua????o'
          },
          contact: {
            type: 'string',
            maxLength: 100,
            title: 'Nome do respons??vel'
          },
          name: {
            type: 'string',
            maxLength: 100,
            title: 'Nome da empresa ou loja'
          }
        }
      },
      hide: true
    },
    from: {
      schema: {
        type: 'object',
        title: 'Endere??o do remetente',
        description: 'Configure endere??o de remetente para etiqueta.',
        properties: {
          street: {
            type: 'string',
            maxLength: 200,
            title: 'Digite a rua'
          },
          number: {
            type: 'integer',
            min: 1,
            max: 9999999,
            title: 'Digite o n??mero da resid??ncia'
          },
          complement: {
            type: 'string',
            maxLength: 100,
            title: 'Complemento'
          },
          borough: {
            type: 'string',
            maxLength: 100,
            title: 'Bairro'
          },
          city: {
            type: 'string',
            maxLength: 100,
            title: 'Cidade'
          },
          province_code: {
            type: 'string',
            title: 'Sigla do Estado',
            enum: [
              'AC',
              'AL',
              'AP',
              'AM',
              'BA',
              'CE',
              'DF',
              'ES',
              'GO',
              'MA',
              'MT',
              'MS',
              'MG',
              'PA',
              'PB',
              'PR',
              'PE',
              'PI',
              'RR',
              'RO',
              'RJ',
              'RS',
              'SC',
              'SP',
              'SE',
              'TO'
            ]
          }
        }
      },
      hide: true
    },
    ordernar: {
      schema: {
        title: 'Ordenar formas de envio',
        type: 'string',
        description: 'Escolha a ordem que as formas de envio sejam mostradas na loja',
        enum: [
          'Opcional',
          'preco',
          'prazo'
        ],
        default: 'preco'

      },
      hide: false
    },
    free_shipping_rules: {
      schema: {
        title: 'Regras de frete gr??tis',
        description: 'Deve ser configurado em conformidade ao que foi configurado na Kangu',
        type: 'array',
        maxItems: 300,
        items: {
          title: 'Regra de frete gr??tis',
          type: 'object',
          minProperties: 1,
          properties: {
            zip_range: {
              title: 'Faixa de CEP',
              type: 'object',
              required: [
                'min',
                'max'
              ],
              properties: {
                min: {
                  type: 'integer',
                  minimum: 10000,
                  maximum: 999999999,
                  title: 'CEP inicial'
                },
                max: {
                  type: 'integer',
                  minimum: 10000,
                  maximum: 999999999,
                  title: 'CEP final'
                }
              }
            },
            min_amount: {
              type: 'number',
              minimum: 1,
              maximum: 999999999,
              title: 'Valor m??nimo da compra'
            }
          }
        }
      },
      hide: false
    },
    posting_deadline: {
      schema: {
        title: 'Prazo de postagem',
        type: 'object',
        required: ['days'],
        additionalProperties: false,
        properties: {
          days: {
            type: 'integer',
            minimum: 0,
            maximum: 999999,
            title: 'N??mero de dias',
            description: 'Dias de prazo para postar os produtos ap??s a compra'
          },
          working_days: {
            type: 'boolean',
            default: true,
            title: 'Dias ??teis'
          },
          after_approval: {
            type: 'boolean',
            default: true,
            title: 'Ap??s aprova????o do pagamento'
          }
        }
      },
      hide: false
    },
    shipping_rules: {
      schema: {
        title: 'Regras de envio',
        description: 'Aplicar descontos/adicionais condiciAtivar regi??es',
        type: 'array',
        maxItems: 300,
        items: {
          title: 'Regra de envio',
          type: 'object',
          minProperties: 1,
          properties: {
            service_name: {
              type: 'string',
              title: 'Nome do servi??o'
            },
            zip_range: {
              title: 'Faixa de CEP',
              type: 'object',
              required: [
                'min',
                'max'
              ],
              properties: {
                min: {
                  type: 'integer',
                  minimum: 10000,
                  maximum: 999999999,
                  title: 'CEP inicial'
                },
                max: {
                  type: 'integer',
                  minimum: 10000,
                  maximum: 999999999,
                  title: 'CEP final'
                }
              }
            },
            min_amount: {
              type: 'number',
              minimum: 1,
              maximum: 999999999,
              title: 'Valor m??nimo da compra'
            },
            discount: {
              title: 'Desconto',
              type: 'object',
              required: [
                'value'
              ],
              properties: {
                percentage: {
                  type: 'boolean',
                  default: false,
                  title: 'Desconto percentual'
                },
                value: {
                  type: 'number',
                  minimum: -99999999,
                  maximum: 99999999,
                  title: 'Valor do desconto',
                  description: 'Valor percentual/fixo do desconto ou acr??scimo (negativo)'
                }
              }
            }
          }
        }
      },
      hide: false
    },
    services: {
      schema: {
        title: 'R??tulo dos Servi??os',
        description: 'Para alterar o nome de exibi????o de algum servi??o basta infomar o c??digo do servi??o e um novo r??tulo de exibi????o. ',
        type: 'array',
        maxItems: 6,
        items: {
          title: 'Servi??o de entrega',
          type: 'object',
          required: [
            'service_name',
            'label'
          ],
          properties: {
            service_name: {
              type: 'string',
              title: 'Servi??o',
              default: 'PAC',
              description: 'Nome oficial do servi??o na transportadora'
            },
            label: {
              type: 'string',
              maxLength: 50,
              title: 'R??tulo',
              description: 'Nome do servi??o exibido aos clientes'
            }
          }
        }
      },
      hide: true
    },
    enable_auto_tag: {
      schema: {
        type: 'boolean',
        default: false,
        title: 'Ativar gera????o de envios a Kangu',
        description: 'Ativar a cria????o autom??tica de tags de envio para Kangu'
      },
      hide: false
    }
  }
}

/**
 * List of Procedures to be created on each store after app installation.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/procedures/
 */

const procedures = []

const { baseUri } = require('./__env')

procedures.push({
  title: app.title,

  triggers: [
    // Receive notifications when new order is created:
/*     {
      resource: 'orders',
      action: 'create',
    }, */

    // Receive notifications when order financial/fulfillment status are set or changed:
    // Obs.: you probably SHOULD NOT enable the orders triggers below and the one above (create) together.
    {
      resource: 'orders',
      field: 'fulfillment_status',
    }

    // Feel free to create custom combinations with any Store API resource, subresource, action and field.
  ],

  webhooks: [
    {
      api: {
        external_api: {
          uri: `${baseUri}/ecom/webhook`
        }
      },
      method: 'POST'
    }
  ]
})

exports.app = app

exports.procedures = procedures
