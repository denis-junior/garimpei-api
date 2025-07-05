# Garimpei API

## Tecnologias Utilizadas

- **Node.js** & **NestJS**: Framework principal para construção da API.
- **TypeORM**: ORM para integração com banco de dados PostgreSQL.
- **PostgreSQL**: Banco de dados relacional.
- **JWT (JSON Web Token)**: Autenticação e autorização.
- **RxJS**: Utilizado para SSE (Server-Sent Events) e notificações em tempo real.
- **Class-validator & class-transformer**: Validação e transformação de DTOs.
- **Multer**: Upload de arquivos (imagens).
- **Vercel Blob**: Armazenamento de imagens.

## Estrutura de Módulos

- **auth/**: Autenticação e autorização.
- **buyer/**: CRUD e lógica de compradores.
- **seller/**: CRUD e lógica de vendedores.
- **store/**: CRUD e lógica de lojas.
- **clothing/**: CRUD e lógica de produtos.
- **bid/**: CRUD e lógica de lances, SSE.
- **image/**: Upload e gerenciamento de imagens.
- **dashboard/**: Relatórios e análises (recomendado para expansão).

## Principais Features

- Cadastro e login de compradores e vendedores.
- Autenticação via JWT e proteção de rotas sensíveis.
- Gerenciamento de lojas e produtos.
- Sistema de leilão: lances em produtos, restrições de tempo, notificações em tempo real.
- Upload e associação de imagens a produtos.
- Relatórios e dashboards analíticos (em expansão).

## Configuração do Banco de Dados

A aplicação utiliza PostgreSQL, configurado em `app.module.ts`:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 7000,
  username: 'postgres',
  password: 'root',
  database: 'garimpeidb',
  entities: [Buyer, Seller, Clothing, Bid, Store, Image],
  synchronize: true, // true só para desenvolvimento!
}),
```

> **Atenção:**  
> O parâmetro `synchronize: true` é recomendado apenas para desenvolvimento.  
> Para produção, utilize migrações para manter o schema do banco de dados.

---

**Resumo:**  
Esta API é robusta, modular e pronta para operações de marketplace de leilão de roupas, com autenticação segura, notificações em tempo real e suporte a relatórios
