// Modelo Nota Fiscal - 58mm

const { Printer, PrinterTypes } = require('node-thermal-printer');

class GeradorNotaFiscal {
  constructor(configuracaoImpressora) {
    this.impressora = new Printer({
      type: PrinterTypes.EPSON,
      interface: configuracaoImpressora.interface,
      characterSet: 'BRAZIL',
      removeSpecialCharacters: false,
      lineCharacter: "=",
      width: 48, // Caracteres por linha (impressora 58mm)
      options: {
        timeout: 5000
      }
    });
  }

  /* GERAR E IMPRIMIR A NOTA FISCAL */

  async imprimirPedido(pedido) {
    try {
      // LIMPAR BUFFER
      this.impressora.clear();
      
      // CABEÇALHO
      this.imprimirCabecalho();
      
      // DADOS DO PEDIDO
      this.imprimirDadosPedido(pedido);
      
      // ITENS
      this.imprimirItens(pedido.itens);
      
      // TOTAIS
      this.imprimirTotais(pedido);
      
      // ENTREGA
      this.imprimirDadosEntrega(pedido);
      
      // PAGAMENTO
      this.imprimirPagamento(pedido);
      
      // RODAPÉ
      this.imprimirRodape(pedido);
      
      // CORTA O PAPEL
      this.impressora.cut();
      
      // EXECUTA A IMPRESSÃO
      await this.impressora.execute();
      
      return { sucesso: true };
      
    } catch (erro) {
      console.error('Erro ao imprimir:', erro);
      return { sucesso: false, erro: erro.message };
    }
  }

  /* ESBOÇO CABEÇALHO DA LANCHONETE */

  imprimirCabecalho() {
    this.impressora.alignCenter();
    this.impressora.setTextSize(1, 1);
    this.impressora.bold(true);
    this.impressora.println('================================');
    this.impressora.setTextSize(2, 2);
    this.impressora.println('Chica-Tudo');
    this.impressora.setTextSize(1, 1);
    this.impressora.println('CARDAPIO');
    this.impressora.bold(false);
    this.impressora.println('================================');
    this.impressora.println('Tel: (18) 99811-9097');
    this.impressora.println('Delivery Disponivel');
    this.impressora.drawLine();
    this.impressora.newLine();
  }

  /* DADOS DO PEDIDO (número, data, cliente..) */

  imprimirDadosPedido(pedido) {
    this.impressora.alignLeft();
    this.impressora.bold(true);
    this.impressora.println(`PEDIDO: #${pedido.numero_pedido}`);
    this.impressora.bold(false);
    
    const dataFormatada = this.formatarData(pedido.criado_em);
    this.impressora.println(`Data: ${dataFormatada}`);
    
    if (pedido.cliente_nome) {
      this.impressora.println(`Cliente: ${pedido.cliente_nome}`);
    }
    
    this.impressora.drawLine();
    this.impressora.newLine();
  }

  /* LISTAGEM ITENS DO PEDIDO */

  imprimirItens(itens) {
    this.impressora.alignLeft();
    this.impressora.bold(true);
    this.impressora.println('ITENS DO PEDIDO');
    this.impressora.bold(false);
    this.impressora.drawLine();
    
    itens.forEach((item, index) => {
      // NOME DO ITEM
      this.impressora.bold(true);
      const linha1 = `${index + 1}. ${item.nome}`;
      this.impressora.println(linha1);
      this.impressora.bold(false);
      
      // PREÇO UNITÁRIO
      const precoFormatado = this.formatarMoeda(item.preco);
      this.impressora.println(`   R$ ${precoFormatado}`);
      
      // ADICIONAIS (CASO TENHA)
      if (item.adicionais && item.adicionais.length > 0) {
        this.impressora.println('   Adicionais:');
        item.adicionais.forEach(adicional => {
          const precoAd = this.formatarMoeda(adicional.preco);
          this.impressora.println(`   + ${adicional.nome} (R$ ${precoAd})`);
        });
      }
      
      // OBSERVAÇÕES
      if (item.observacao) {
        this.impressora.println(`   Obs: ${item.observacao}`);
      }
      
      // PREÇO TOTAL DO ITEM
      if (item.preco_total) {
        const totalItem = this.formatarMoeda(item.preco_total);
        this.impressora.bold(true);
        this.impressora.println(`   Total: R$ ${totalItem}`);
        this.impressora.bold(false);
      }
      
      this.impressora.newLine();
    });
    
    this.impressora.drawLine();
  }

  /* TOTAIS DO PEDIDO (subtotal, taxa, total) */

  imprimirTotais(pedido) {
    this.impressora.alignRight();
    
    const subtotal = this.formatarMoeda(pedido.subtotal);
    this.impressora.println(`Subtotal: R$ ${subtotal}`);
    
    if (pedido.taxa_entrega > 0) {
      const taxa = this.formatarMoeda(pedido.taxa_entrega);
      this.impressora.println(`Taxa Entrega: R$ ${taxa}`);
    }
    
    this.impressora.drawLine();
    
    this.impressora.setTextSize(2, 2);
    this.impressora.bold(true);
    const total = this.formatarMoeda(pedido.total);
    this.impressora.println(`TOTAL: R$ ${total}`);
    this.impressora.bold(false);
    this.impressora.setTextSize(1, 1);
    
    this.impressora.drawLine();
    this.impressora.newLine();
  }

  /* DADOS DE ENTREGA/RETIRADA */

  imprimirDadosEntrega(pedido) {
    this.impressora.alignLeft();
    this.impressora.bold(true);
    
    if (pedido.tipo_entrega === 'ENTREGAR') {
      this.impressora.println('** DELIVERY **');
      this.impressora.bold(false);
      this.impressora.println(pedido.endereco_entrega);
    } else {
      this.impressora.println('** RETIRAR NO LOCAL **');
      this.impressora.bold(false);
    }
    
    this.impressora.drawLine();
    this.impressora.newLine();
  }

  /* FORMA DE PAGAMENTO */

  imprimirPagamento(pedido) {
    this.impressora.alignLeft();
    this.impressora.bold(true);
    this.impressora.println('PAGAMENTO');
    this.impressora.bold(false);
    
    const formaPagamento = {
      'DINHEIRO': 'Dinheiro',
      'PIX': 'PIX',
      'CARTAO': 'Cartao Debito/Credito'
    };
    
    this.impressora.println(`Forma: ${formaPagamento[pedido.forma_pagamento]}`);
    
    if (pedido.forma_pagamento === 'DINHEIRO' && pedido.precisa_troco) {
      const valorTroco = this.formatarMoeda(pedido.valor_troco);
      const troco = this.formatarMoeda(pedido.valor_troco - pedido.total);
      
      this.impressora.println(`Pagar com: R$ ${valorTroco}`);
      this.impressora.bold(true);
      this.impressora.println(`TROCO: R$ ${troco}`);
      this.impressora.bold(false);
    }
    
    this.impressora.drawLine();
    this.impressora.newLine();
  }

  /* RODAPÉ */

  imprimirRodape(pedido) {
    this.impressora.alignCenter();
    
    this.impressora.bold(true);
    this.impressora.println('OBRIGADO PELA PREFERENCIA!');
    this.impressora.bold(false);
    this.impressora.println('Volte sempre!');
    this.impressora.newLine();
    
    // HORÁRIO DE IMPRESSÃO
    const agora = new Date();
    const horario = agora.toLocaleTimeString('pt-BR');
    this.impressora.setTextSize(0, 0);
    this.impressora.println(`Impresso em: ${horario}`);
    this.impressora.setTextSize(1, 1);
    
    this.impressora.newLine();
    this.impressora.drawLine();
  }

  /* FORMATA DATA PARA DD/MM/YYYY HH:MM */

  formatarData(dataString) {
    const data = new Date(dataString);
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  /* FORMATA VALOR MONETÁRIO (12.50 -> "12,50") */

  formatarMoeda(valor) {
    return valor.toFixed(2).replace('.', ',');
  }

  /* TESTE DE IMPRESSORA (imprime página de teste) */

  async testarImpressora() {
    try {
      this.impressora.clear();
      this.impressora.alignCenter();
      this.impressora.bold(true);
      this.impressora.println('TESTE DE IMPRESSORA');
      this.impressora.bold(false);
      this.impressora.drawLine();
      this.impressora.println('Se voce esta lendo isso,');
      this.impressora.println('a impressora esta funcionando!');
      this.impressora.drawLine();
      this.impressora.newLine();
      this.impressora.println(new Date().toLocaleString('pt-BR'));
      this.impressora.cut();
      
      await this.impressora.execute();
      return { sucesso: true };
    } catch (erro) {
      return { sucesso: false, erro: erro.message };
    }
  }
}

module.exports = GeradorNotaFiscal;

// ============================================
// EXEMPLO DE USO
// ============================================

/*
const pedidoExemplo = {
  numero_pedido: '0042',
  criado_em: new Date(),
  cliente_nome: 'João Silva',
  itens: [
    {
      nome: 'X-Bacon',
      preco: 23.00,
      adicionais: [
        { nome: 'Cheddar', preco: 4.00 }
      ],
      observacao: 'Sem cebola',
      preco_total: 27.00
    },
    {
      nome: 'Hot Tudo',
      preco: 20.00,
      adicionais: [],
      observacao: null,
      preco_total: 20.00
    },
    {
      nome: 'Coca-Cola Lata',
      preco: 5.00,
      adicionais: [],
      observacao: null,
      preco_total: 5.00
    }
  ],
  subtotal: 52.00,
  taxa_entrega: 5.00,
  total: 57.00,
  tipo_entrega: 'ENTREGAR',
  endereco_entrega: 'Rua das Flores, 123, Centro\nProx. a padaria',
  forma_pagamento: 'DINHEIRO',
  precisa_troco: true,
  valor_troco: 100.00,
  tempo_preparo: 30
};

const impressora = new GeradorNotaFiscal({
  interface: 'tcp://192.168.1.99'
});

await impressora.imprimirPedido(pedidoExemplo);
*/