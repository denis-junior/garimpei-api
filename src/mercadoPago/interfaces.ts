export interface IPaymentData {
  comissao: number;
  descricao: string;
  email_comprador: string;
  installments: number;
  payment_method_id: string;
  produto_id: string;
  token: string;
  valor: number;
  vendedor_id: string;
}
