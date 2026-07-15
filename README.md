# 🎵 Spotify Album Finder

Aplicação web open source que permite pesquisar qualquer artista e visualizar toda a sua discografia através da Spotify Web API.

Projeto pessoal criado para demonstrar consumo de APIs REST, manipulação do DOM e boas práticas de JavaScript moderno (ES6+), sem frameworks nem build tools.

## Demonstração

> 🔗 _Link para a versão live (GitHub Pages / Netlify / Vercel) — adicionar aqui assim que estiver publicado._

## Screenshots

> 📸 _Adicionar aqui screenshots da aplicação (pesquisa, cartão do artista, grelha de álbuns) assim que a interface estiver pronta._

## Funcionalidades

- Pesquisa de artista pelo nome
- Listagem de todos os álbuns, singles e compilações
- Para cada álbum: capa, nome, data de lançamento, número de faixas, tipo e link direto para o Spotify
- Interface responsiva com tema escuro
- Estados de loading e tratamento de erros

### Extras planeados

- Pesquisa em tempo real
- Ordenação por data e filtro por tipo de álbum
- Histórico de pesquisas (localStorage) e favoritos

## Tecnologias

- HTML5
- CSS3
- JavaScript (ES6+, módulos nativos, sem bundler)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Git & GitHub

## Estrutura do projeto

```
spotify-album-finder/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js              # chamadas à Spotify API + autenticação
│   ├── ui.js                # renderização no DOM
│   ├── app.js                # ligação entre api.js e ui.js
│   ├── config.js             # credenciais reais (não commitado)
│   └── config.example.js     # template de configuração
├── assets/
├── README.md
└── LICENSE
```

## Como executar

Este projeto não tem build step, mas os módulos ES6 e o pedido de token à Spotify só funcionam servidos por HTTP (não abrir `index.html` diretamente com `file://`).

```bash
git clone https://github.com/<o-teu-user>/spotify-album-finder.git
cd spotify-album-finder
npx serve
```

Ou usa a extensão **Live Server** do VS Code.

## Como configurar a Spotify API

1. Cria uma app em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e obtém o **Client ID** e o **Client Secret**.
2. Copia o template de configuração:
   ```bash
   cp js/config.example.js js/config.js
   ```
3. Preenche `js/config.js` com as tuas credenciais:
   ```js
   export const CLIENT_ID = "o-teu-client-id";
   export const CLIENT_SECRET = "o-teu-client-secret";
   ```
4. `js/config.js` está no `.gitignore` — nunca commites as tuas credenciais.

> ⚠️ Este projeto usa o **Client Credentials Flow** diretamente no browser (sem backend), pelo que o Client Secret fica exposto no código do lado do cliente. Aceitável para um projeto de demonstração com dados públicos e sem login de utilizador; não é o padrão recomendado para uma aplicação em produção com dados sensíveis.

## Licença

Distribuído sob licença MIT. Consulta o ficheiro [LICENSE](LICENSE) para mais detalhes.

## Contribuições

Contribuições são bem-vindas! Para propor uma alteração:

1. Faz um fork do repositório
2. Cria um branch (`git checkout -b feature/nome-da-feature`)
3. Faz commit das alterações
4. Abre um Pull Request a descrever a alteração

Sugestões e reports de bugs podem ser abertos em [Issues](../../issues).
