const AnalisadorMensagem = require('./AnalisadorMensagem');
const GerenciadorPedidos = require('./GerenciadorPedidos');
const cardapio = require('../config/cardapio.json');

/* ESTADOS DO FLUXO DE CONVERSA */

const ESTADOS = {
  OCIOSO: 'ocioso',                       // Aguardando primeiro contato
  SAUDACAO: 'saudacao',                   // Saudação enviada
  MENU_ENVIADO: 'menu_enviado',           // Cardápio de lanches mostrado
  SELECIONANDO_LANCHES: 'selecionando_lanches', // Coletando lanches
  PERGUNTANDO_OBSERVACAO: 'perguntando_observacao', // Observações do lanche
  ADICIONAR_MAIS_LANCHES: 'adicionar_mais_lanches', // Perguntar se quer mais
  PERGUNTANDO_BEBIDAS: 'perguntando_bebidas', // Quer bebida?
  MENU_BEBIDAS_ENVIADO: 'menu_bebidas_enviado', // Cardápio de bebidas
  SELECIONANDO_BEBIDAS: 'selecionando_bebidas', // Coletando bebidas
  TIPO_ENTREGA: 'tipo_entrega',           // Retirar ou entregar
  COLETANDO_ENDERECO: 'coletando_endereco', // Informar endereço
  FORMA_PAGAMENTO: 'forma_pagamento',     // Dinheiro/Pix/Cartão
  COLETANDO_TROCO: 'coletando_troco',     // Valor para troco
  CONFIRMACAO_FINAL: 'confirmacao_final', // Resumo + confirmar
  CONCLUIDO: 'concluido',                 // Pedido confirmado
  CANCELADO: 'cancelado',                 // Cliente cancelou
  ERRO: 'erro'                            // Erro crítico
};

class MaquinaEstados {
  constructor(whatsappService, servicoImpressao, database) {
    this.whatsapp = whatsappService;
    this.impressao = servicoImpressao;
    this.db = database;
    
    this.analisador = new AnalisadorMensagem(cardapio);
    this.gerenciadorPedidos = new GerenciadorPedidos(database);
    
    // Armazena sessões ativas em memória (telefone -> dados da sessão)
    this.sessoes = new Map();
    
    // Configurações
    this.maxTentativasErro = cardapio.configuracoes_pedido.max_tentativas_erro;
    this.timeoutSessaoMinutos = cardapio.configuracoes_pedido.timeout_sessao_minutos;
    
    // Iniciar limpeza de sessões expiradas
    this.iniciarLimpezaSessoes();
  }

  /*
   * Ponto de entrada: recebe mensagem do WhatsApp e roteia para handler correto
   */
  async processarMensagem(telefone, mensagem) {
    try {
      // Normaliza telefone (remove caracteres especiais)
      const telefoneLimpo = this.normalizarTelefone(telefone);
      
      // Verifica se está dentro do horário de funcionamento
      if (!this.verificarHorarioFuncionamento()) {
        return await this.enviarMensagemForaHorario(telefoneLimpo);
      }
      
      // Verifica comandos globais (funcionam em qualquer estado)
      if (this.ehComandoGlobal(mensagem)) {
        return await this.processarComandoGlobal(telefoneLimpo, mensagem);
      }
      
      // Recupera ou cria nova sessão
      const sessao = this.obterOuCriarSessao(telefoneLimpo);
      sessao.ultima_interacao = Date.now();
      
      // Roteia para o handler do estado atual
      const resposta = await this.rotearEstado(sessao, mensagem);
      
      // Salva sessão atualizada
      this.sessoes.set(telefoneLimpo, sessao);
      await this.salvarSessaoNoBanco(telefoneLimpo, sessao);
      
      return resposta;
      
    } catch (erro) {
      console.error('Erro ao processar mensagem:', erro);
      return await this.tratarErro(telefone, erro);
    }
  }

  /*
   * Roteia mensagem para o handler apropriado baseado no estado
   */
  async rotearEstado(sessao, mensagem) {
    const handlers = {
      [ESTADOS.OCIOSO]: this.handleOcioso,
      [ESTADOS.SAUDACAO]: this.handleSaudacao,
      [ESTADOS.MENU_ENVIADO]: this.handleMenuEnviado,
      [ESTADOS.SELECIONANDO_LANCHES]: this.handleSelecionandoLanches,
      [ESTADOS.PERGUNTANDO_OBSERVACAO]: this.handlePerguntandoObservacao,
      [ESTADOS.ADICIONAR_MAIS_LANCHES]: this.handleAdicionarMaisLanches,
      [ESTADOS.PERGUNTANDO_BEBIDAS]: this.handlePerguntandoBebidas,
      [ESTADOS.MENU_BEBIDAS_ENVIADO]: this.handleMenuBebidasEnviado,
      [ESTADOS.SELECIONANDO_BEBIDAS]: this.handleSelecionandoBebidas,
      [ESTADOS.TIPO_ENTREGA]: this.handleTipoEntrega,
      [ESTADOS.COLETANDO_ENDERECO]: this.handleColetandoEndereco,
      [ESTADOS.FORMA_PAGAMENTO]: this.handleFormaPagamento,
      [ESTADOS.COLETANDO_TROCO]: this.handleColetandoTroco,
      [ESTADOS.CONFIRMACAO_FINAL]: this.handleConfirmacaoFinal
    };

    const handler = handlers[sessao.estado];
    
    if (!handler) {
      throw new Error(`Estado desconhecido: ${sessao.estado}`);
    }

    return await handler.call(this, sessao, mensagem);
  }

  /*
   * HANDLERS DE CADA ESTADO
   */

  async handleOcioso(sessao, mensagem) {
    // Primeiro contato - envia saudação
    sessao.estado = ESTADOS.SAUDACAO;
    
    return {
      texto: cardapio.mensagens.boas_vindas,
      proximoEstado: ESTADOS.MENU_ENVIADO,
      acoes: ['ENVIAR_CARDAPIO']
    };
  }

  async handleSaudacao(sessao, mensagem) {
    // Transição automática para envio do cardápio
    return this.enviarCardapioLanches(sessao);
  }

  async handleMenuEnviado(sessao, mensagem) {
    // Cliente deve selecionar um lanche
    return this.handleSelecionandoLanches(sessao, mensagem);
  }

  async handleSelecionandoLanches(sessao, mensagem) {
    // Tenta identificar o lanche escolhido
    const resultado = this.analisador.analisarSelecaoLanche(mensagem);
    
    if (!resultado.sucesso) {
      // Incrementa contador de erros
      sessao.tentativas_erro = (sessao.tentativas_erro || 0) + 1;
      
      if (sessao.tentativas_erro >= this.maxTentativasErro) {
        return {
          texto: '😅 Estou com dificuldades para entender.\n\nVou chamar a Chica para te ajudar!',
          acoes: ['NOTIFICAR_HUMANO']
        };
      }
      
      return {
        texto: resultado.mensagemErro + '\n\n' + this.gerarMensagemAjudaContextual(sessao.estado),
        tentativa: sessao.tentativas_erro
      };
    }

    // Lanche identificado com sucesso
    sessao.tentativas_erro = 0;
    
    // Verifica se precisa confirmação (foi fuzzy match)
    if (resultado.precisaConfirmacao) {
      return {
        texto: `Você quis dizer *${resultado.lanche.nome}*?\n\nDigite *sim* para confirmar ou *não* para escolher outro.`,
        dados_temporarios: { lanche_aguardando_confirmacao: resultado.lanche }
      };
    }

    // Adiciona lanche temporário à sessão
    sessao.lanche_atual = resultado.lanche;
    sessao.estado = ESTADOS.PERGUNTANDO_OBSERVACAO;
    
    return {
      texto: cardapio.mensagens.observacao_lanche
    };
  }

  async handlePerguntandoObservacao(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    // Cliente não quer observação
    if (this.ehNegativo(mensagemLimpa)) {
      sessao.lanche_atual.observacao = null;
    } else {
      // Valida tamanho da observação
      if (mensagem.length > cardapio.configuracoes_pedido.max_caracteres_observacao) {
        return {
          texto: `⚠️ Observação muito longa! Use no máximo ${cardapio.configuracoes_pedido.max_caracteres_observacao} caracteres.`
        };
      }
      sessao.lanche_atual.observacao = mensagem;
    }

    // Adiciona lanche ao pedido
    if (!sessao.pedido) {
      sessao.pedido = { lanches: [], bebidas: [] };
    }
    sessao.pedido.lanches.push(sessao.lanche_atual);
    delete sessao.lanche_atual;

    // Verifica limite de itens
    if (sessao.pedido.lanches.length >= cardapio.configuracoes_pedido.max_itens_por_pedido) {
      // Pula para bebidas
      sessao.estado = ESTADOS.PERGUNTANDO_BEBIDAS;
      return {
        texto: '✅ Lanche adicionado!\n\n_Atingiu o limite de itens._\n\n' + cardapio.mensagens.bebidas
      };
    }

    // Pergunta se quer mais lanches
    sessao.estado = ESTADOS.ADICIONAR_MAIS_LANCHES;
    return {
      texto: cardapio.mensagens.adicionar_mais
    };
  }

  async handleAdicionarMaisLanches(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    if (this.ehPositivo(mensagemLimpa)) {
      // Volta para seleção de lanches
      sessao.estado = ESTADOS.SELECIONANDO_LANCHES;
      return {
        texto: '👍 Certo! Qual lanche deseja adicionar?\n\n' + cardapio.mensagens.selecao_lanches
      };
    }
    
    if (this.ehNegativo(mensagemLimpa)) {
      // Avança para bebidas
      sessao.estado = ESTADOS.PERGUNTANDO_BEBIDAS;
      return {
        texto: cardapio.mensagens.bebidas
      };
    }

    // Resposta ambígua
    return {
      texto: 'Digite *sim* para adicionar mais lanches ou *não* para continuar.'
    };
  }

  async handlePerguntandoBebidas(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    if (this.ehNegativo(mensagemLimpa)) {
      // Não quer bebida, avança para tipo de entrega
      sessao.estado = ESTADOS.TIPO_ENTREGA;
      return this.enviarOpcoesEntrega(sessao);
    }
    
    if (this.ehPositivo(mensagemLimpa)) {
      // Quer bebida, mostra cardápio
      sessao.estado = ESTADOS.MENU_BEBIDAS_ENVIADO;
      return this.enviarCardapioBebidas(sessao);
    }

    return {
      texto: 'Digite *sim* se quiser bebida ou *não* para pular.'
    };
  }

  async handleMenuBebidasEnviado(sessao, mensagem) {
    return this.handleSelecionandoBebidas(sessao, mensagem);
  }

  async handleSelecionandoBebidas(sessao, mensagem) {
    const resultado = this.analisador.analisarSelecaoBebida(mensagem);
    
    if (!resultado.sucesso) {
      return {
        texto: resultado.mensagemErro
      };
    }

    // Adiciona bebida ao pedido
    sessao.pedido.bebidas.push(resultado.bebida);

    // Pergunta se quer mais bebidas
    return {
      texto: '✅ Bebida adicionada!\n\nQuer adicionar outra bebida?\n\nDigite *sim* ou *não*.',
      dados_temporarios: { aguardando_mais_bebidas: true }
    };
  }

  async handleTipoEntrega(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    // Identifica tipo de entrega
    if (mensagemLimpa.includes('1') || mensagemLimpa.includes('retirar') || mensagemLimpa.includes('buscar')) {
      sessao.pedido.tipo_entrega = 'RETIRAR';
      sessao.pedido.endereco = null;
      sessao.pedido.taxa_entrega = 0;
      
      // Avança para forma de pagamento
      sessao.estado = ESTADOS.FORMA_PAGAMENTO;
      return {
        texto: cardapio.mensagens.forma_pagamento
      };
    }
    
    if (mensagemLimpa.includes('2') || mensagemLimpa.includes('entregar') || mensagemLimpa.includes('entrega')) {
      // Verifica pedido mínimo
      const subtotal = this.calcularSubtotal(sessao.pedido);
      if (subtotal < cardapio.entrega.pedido_minimo) {
        return {
          texto: `⚠️ Para entrega, o pedido mínimo é *R$ ${cardapio.entrega.pedido_minimo.toFixed(2)}*.\n\nSeu pedido está em *R$ ${subtotal.toFixed(2)}*.\n\nQuer adicionar mais itens ou prefere retirar?`
        };
      }
      
      sessao.pedido.tipo_entrega = 'ENTREGAR';
      sessao.pedido.taxa_entrega = cardapio.entrega.taxa_padrao;
      sessao.estado = ESTADOS.COLETANDO_ENDERECO;
      
      return {
        texto: cardapio.mensagens.endereco_entrega
      };
    }

    return {
      texto: 'Digite *1* para retirar ou *2* para entrega.'
    };
  }

  async handleColetandoEndereco(sessao, mensagem) {
    // Valida endereço básico (mínimo 10 caracteres)
    if (mensagem.trim().length < 10) {
      return {
        texto: '⚠️ Por favor, informe um endereço completo com rua, número e bairro.'
      };
    }

    sessao.pedido.endereco = mensagem.trim();
    sessao.estado = ESTADOS.FORMA_PAGAMENTO;
    
    return {
      texto: '✅ Endereço anotado!\n\n' + cardapio.mensagens.forma_pagamento
    };
  }

  async handleFormaPagamento(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    if (mensagemLimpa.includes('1') || mensagemLimpa.includes('dinheiro')) {
      sessao.pedido.forma_pagamento = 'DINHEIRO';
      sessao.estado = ESTADOS.COLETANDO_TROCO;
      return {
        texto: cardapio.mensagens.troco
      };
    }
    
    if (mensagemLimpa.includes('2') || mensagemLimpa.includes('pix')) {
      sessao.pedido.forma_pagamento = 'PIX';
      sessao.estado = ESTADOS.CONFIRMACAO_FINAL;
      return this.gerarConfirmacaoFinal(sessao);
    }
    
    if (mensagemLimpa.includes('3') || mensagemLimpa.includes('cartao') || mensagemLimpa.includes('cartão')) {
      sessao.pedido.forma_pagamento = 'CARTAO';
      sessao.estado = ESTADOS.CONFIRMACAO_FINAL;
      return this.gerarConfirmacaoFinal(sessao);
    }

    return {
      texto: 'Digite:\n*1* para Dinheiro\n*2* para PIX\n*3* para Cartão'
    };
  }

  async handleColetandoTroco(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    if (this.ehNegativo(mensagemLimpa)) {
      sessao.pedido.precisa_troco = false;
      sessao.pedido.valor_troco = null;
    } else {
      // Tenta extrair valor
      const valor = this.extrairValor(mensagem);
      if (!valor || valor <= 0) {
        return {
          texto: '⚠️ Valor inválido. Digite o valor que vai pagar (ex: 50) ou *não* se não precisar de troco.'
        };
      }
      
      const total = this.calcularTotal(sessao.pedido);
      if (valor < total) {
        return {
          texto: `⚠️ O valor deve ser maior ou igual ao total (R$ ${total.toFixed(2)}).`
        };
      }
      
      sessao.pedido.precisa_troco = true;
      sessao.pedido.valor_troco = valor;
    }

    sessao.estado = ESTADOS.CONFIRMACAO_FINAL;
    return this.gerarConfirmacaoFinal(sessao);
  }

  async handleConfirmacaoFinal(sessao, mensagem) {
    const mensagemLimpa = mensagem.trim().toLowerCase();
    
    if (mensagemLimpa.includes('ok') || mensagemLimpa.includes('sim') || mensagemLimpa.includes('confirmar')) {
      // Confirma pedido
      return await this.finalizarPedido(sessao);
    }
    
    if (mensagemLimpa.includes('cancelar') || mensagemLimpa.includes('não') || mensagemLimpa.includes('nao')) {
      // Cancela pedido
      sessao.estado = ESTADOS.CANCELADO;
      this.sessoes.delete(sessao.telefone);
      
      return {
        texto: '❌ Pedido cancelado.\n\nDigite *oi* para fazer um novo pedido!'
      };
    }

    return {
      texto: 'Digite *OK* para confirmar o pedido ou *CANCELAR* para desistir.'
    };
  }

  /*
   * MÉTODOS AUXILIARES
   */

  obterOuCriarSessao(telefone) {
    if (this.sessoes.has(telefone)) {
      return this.sessoes.get(telefone);
    }

    const novaSessao = {
      telefone,
      estado: ESTADOS.OCIOSO,
      pedido: null,
      lanche_atual: null,
      tentativas_erro: 0,
      criado_em: Date.now(),
      ultima_interacao: Date.now()
    };

    this.sessoes.set(telefone, novaSessao);
    return novaSessao;
  }

  normalizarTelefone(telefone) {
    // Remove tudo que não é número
    return telefone.replace(/\D/g, '');
  }

  ehComandoGlobal(mensagem) {
    const comandos = ['cancelar', 'recomecar', 'recomeçar', 'menu', 'ajuda', 'cardapio', 'cardápio'];
    const msg = mensagem.toLowerCase();
    return comandos.some(cmd => msg.includes(cmd));
  }

  ehPositivo(mensagem) {
    const positivos = ['sim', 's', 'yes', 'ok', 'quero', '1'];
    return positivos.some(p => mensagem.includes(p));
  }

  ehNegativo(mensagem) {
    const negativos = ['nao', 'não', 'no', 'n', 'nunca', 'nem', '0'];
    return negativos.some(n => mensagem.includes(n));
  }

  calcularSubtotal(pedido) {
    let total = 0;
    pedido.lanches.forEach(l => total += l.preco);
    pedido.bebidas.forEach(b => total += b.preco);
    return total;
  }

  calcularTotal(pedido) {
    return this.calcularSubtotal(pedido) + (pedido.taxa_entrega || 0);
  }

  verificarHorarioFuncionamento() {
    // TODO: Implementar verificação real
    return true;
  }

  iniciarLimpezaSessoes() {
    // Limpa sessões expiradas a cada 10 minutos
    setInterval(() => {
      const agora = Date.now();
      const timeout = this.timeoutSessaoMinutos * 60 * 1000;
      
      for (const [telefone, sessao] of this.sessoes.entries()) {
        if (agora - sessao.ultima_interacao > timeout) {
          console.log(`Limpando sessão expirada: ${telefone}`);
          this.sessoes.delete(telefone);
        }
      }
    }, 10 * 60 * 1000);
  }
  
  // Continua no próximo artefato...
}

module.exports = { MaquinaEstados, ESTADOS };