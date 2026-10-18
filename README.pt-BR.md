# Astria

[English](README.md) · [Português (Brasil)](README.pt-BR.md)

Navegador compacto e portátil de múltiplas contas para **jogos de navegador** no Windows. Abra os jogos que escolher, mantenha sessões separadas, organize as janelas e controle quais páginas continuam ativas. Não inclui contas nem arquivos de jogos.

## Baixar e abrir

**[Baixe o ZIP portátil mais recente](https://github.com/IgorKugan/Astria/releases/latest)** em Releases. Escolha `Astria-Portable-x.y.z.zip`. Os arquivos automáticos “Source code” do GitHub são para desenvolvimento e não são o aplicativo pronto.

1. Extraia o ZIP inteiro para uma pasta curta com permissão de gravação, como `D:\Astria`.
2. Abra **Astria.exe** dentro da pasta extraída.
3. Mantenha todos os arquivos de suporte e `portable.flag` ao lado do executável.

Requer Windows x64. Não precisa de Node.js nem de instalador. O Windows pode mostrar SmartScreen ou Firewall porque o executável não tem certificado comercial de assinatura do Windows.

## Atualizar sua pasta copiando os arquivos

1. Feche o Astria e faça uma cópia de segurança da pasta atual.
2. Extraia o novo ZIP em outro local.
3. Copie **todos os arquivos e pastas de dentro de `Astria-Portable-x.y.z`** para sua pasta Astria atual, substituindo os arquivos do programa. `Astria.exe` deve ficar ao lado da sua pasta `Save`, não dentro de outra subpasta.
4. **Mantenha sua pasta Save atual.** O ZIP de distribuição não inclui Save e não substitui perfis, logins nem saves baixados.
5. Abra Astria.exe na pasta atual.

Também é possível usar **☰ → Verificar atualizações… → Baixar atualização → Reiniciar e atualizar**. O programa verifica a assinatura, preserva Save e guarda o programa anterior em Save/Backups. Não força um reinício durante o jogo.

## Idioma

Abra **☰ → Idioma → English / Português (Brasil)**. A escolha fica salva e altera imediatamente a interface, os menus e os diálogos do Astria. O idioma dos jogos e sites continua sendo definido por eles. Instalações novas começam em inglês; perfis existentes continuam em português até você escolher outro idioma.

## Contas, layouts e atividade

- Use **+** para criar um espaço ou uma conta. Informe o endereço HTTP/HTTPS do jogo de navegador e entre pela página.
- Cada conta tem cookies, localStorage, IndexedDB, CacheStorage e service workers separados.
- Clique com o botão direito para renomear, escolher cor, ajustar som/zoom ou mudar a atividade.
- Arraste a borda da lateral para mudar a largura. A barra de cada painel tem layout, tema e uso aproximado de RAM/CPU.

| Modo | Comportamento |
| --- | --- |
| Sempre ativa | Continua em outros espaços e com a janela minimizada. Usa mais recursos. |
| Ativa quando visível | Reduz atividade em segundo plano e descarrega uma página oculta após um minuto. Ao voltar, reconecta o jogo. |
| Suspensa | Descarrega imediatamente. Retomar reabre o mesmo perfil salvo. |

Descarregar pode desconectar o personagem. A progressão offline depende do jogo. As métricas não incluem o custo compartilhado do aplicativo/GPU. A compatibilidade depende do site e de sua autenticação.

## Dados portáteis

O Astria cria **Save** ao lado do executável ao abrir pela primeira vez:

| Pasta | Conteúdo |
| --- | --- |
| Profile | Configurações e perfis Chromium separados das contas |
| Games | Arquivos/saves baixados ou exportados dos jogos |
| SharedAssets | Recursos públicos anônimos reutilizáveis, até 2 GB no total e 16 MB por arquivo |
| Backups | Exportações e programas anteriores das atualizações |
| Updates | Preparação de atualizações verificadas e registros locais |
| Temp, Logs, CrashDumps | Arquivos temporários e de diagnóstico |

Use **☰ → Abrir pasta Save**. `Save/LEIA-ME.txt` relaciona os nomes das contas às suas pastas. Para transferir ou fazer backup, feche o Astria e copie a **pasta inteira, incluindo Save**. Não abra duas cópias usando o mesmo Save.

O progresso online normalmente fica no servidor. Cookies protegidos pelo Windows podem exigir novo login em outro PC ou usuário. Exportar configuração inclui nomes, endereços e preferências, mas não cookies nem senhas. **Nunca compartilhe seu Save preenchido.** Distribua o ZIP limpo.

Recursos estáticos públicos podem ser reutilizados quando o servidor permite cache. Downloads compartilhados são anônimos, exigem HTTPS público e usam o IPv4 público validado para impedir acesso à rede privada. APIs, credenciais, respostas privadas e armazenamento das contas não são compartilhados. Outras requisições, incluindo sites locais e exclusivos de IPv6, usam a rede nativa de cada perfil Chromium. O cache mantido pelo próprio jogo pode conter outros recursos.

## Política do projeto e segurança

O projeto oficial é mantido pelo proprietário. Pull requests, issues e discussões externas estão desativados. Outras pessoas podem baixar versões e ler o código público, mas não enviar alterações diretamente ao repositório oficial. O material público continua copiável conforme a licença incluída.

Veja [SECURITY.md](SECURITY.md) para relatos privados de vulnerabilidades e limites de segurança. Instruções de compilação do proprietário: [CONTRIBUTING.md](CONTRIBUTING.md). Licença MIT.
