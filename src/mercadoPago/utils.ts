export function calcularFeesJustos(
  valorVenda: number,
  percentualComissao: number = 10,
) {
  const taxaMercadoPago = valorVenda * 0.05; // ~5%
  const valorLiquido = valorVenda - taxaMercadoPago;
  const applicationFee = valorVenda * (percentualComissao / 100);
  const vendedorRecebe = valorLiquido - applicationFee;

  return {
    valorVenda,
    taxaMercadoPago: Number(taxaMercadoPago.toFixed(2)),
    applicationFee: Number(applicationFee.toFixed(2)),
    vendedorRecebe: Number(vendedorRecebe.toFixed(2)),
    percentualVendedor: Number(
      ((vendedorRecebe / valorVenda) * 100).toFixed(1),
    ),
  };
}
