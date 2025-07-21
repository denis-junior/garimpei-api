import { MercadoPagoConfig } from 'mercadopago';

// Configuração principal da aplicação (seu token)
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // Seu token principal
  options: {
    timeout: 5000,
  },
});

// Função para criar instância com token do vendedor
export const createSellerMercadoPago = (sellerAccessToken: string) => {
  return new MercadoPagoConfig({
    accessToken: sellerAccessToken,
    options: {
      timeout: 5000,
    },
  });
};

export default mercadopago;
