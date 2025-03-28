# Verificador de Domínios

Uma aplicação web para verificar a disponibilidade de domínios em lote através de arquivos Excel.

## Funcionalidades

- Upload de arquivos Excel (.xlsx, .xls)
- Verificação de disponibilidade de domínios em lote
- Interface moderna e responsiva
- Monitoramento em tempo real do progresso
- Cache de resultados para otimização
- Download dos domínios disponíveis
- Tratamento robusto de erros

## Requisitos

- Node.js >= 14.0.0
- NPM ou Yarn

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/lucioSADeve/verificador1.git
cd verificador1
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (opcional):
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o servidor:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Uso

1. Acesse a aplicação em `http://localhost:3000`
2. Faça upload de um arquivo Excel contendo domínios na coluna B
3. Aguarde o processamento
4. Visualize os resultados e faça download dos domínios disponíveis

## Formato do Arquivo Excel

O arquivo Excel deve conter:
- Coluna A: Dados originais (opcional)
- Coluna B: Domínios a serem verificados

Exemplo:
```
A           | B
Dados       | dominio.com.br
Originais   | exemplo.com.br
```

## Configurações

As configurações podem ser ajustadas no arquivo `config.js`:

- Timeouts para diferentes serviços
- Limites de concorrência
- Configurações de cache
- Servidores DNS
- Pesos de confiança

## Tecnologias Utilizadas

- Node.js
- Express
- WebSocket
- XLSX
- Axios
- Bootstrap 5

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Autor

Lucio Campos - [luciocamposmarcio@gmail.com](mailto:luciocamposmarcio@gmail.com)
