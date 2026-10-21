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

**Atualizando da 1.6.0 ou 1.6.1:** o atualizador dessas versões pode parar após fechar o Astria no Windows. Use as instruções de substituição pelo ZIP acima nesta primeira atualização. A 1.6.2 corrige o auxiliar para as próximas atualizações dentro do programa. A pasta Save fica separada dos arquivos do aplicativo.

## Idioma

Abra **☰ → Idioma → English / Português (Brasil)**. A escolha fica salva e altera imediatamente a interface, os menus e os diálogos do Astria. O idioma dos jogos e sites continua sendo definido por eles. Instalações novas começam em inglês; perfis existentes continuam em português até você escolher outro idioma.

## Contas, layouts e atividade

- Use **+** para criar um espaço ou uma conta. Informe o endereço HTTP/HTTPS do jogo de navegador e entre pela página.
- Cada conta tem cookies, localStorage, IndexedDB, CacheStorage e service workers separados.
- Selecionar uma conta ou espaço transfere o foco do teclado ao jogo visível. Você pode usar os controles sem clicar novamente na página; diálogos e campos de chat mantêm seu próprio foco.
- Ctrl+W, Ctrl+Shift+W e Alt+W não fecham o Astria nem suas janelas de jogos. Use o botão Fechar da janela para sair.
- Clique com o botão direito para renomear, escolher cor, ajustar som/zoom ou mudar a atividade.
- Clique no alto-falante ao lado do indicador de RAM/CPU do painel para ativar ou silenciar o áudio daquela conta, incluindo seus popups. O alto-falante riscado indica áudio silenciado. Cada conta mantém essa escolha após reiniciar.
- Arraste a borda da lateral para mudar a largura. A barra de cada painel tem layout, tema e uso aproximado de RAM/CPU.

| Modo | Comportamento |
| --- | --- |
| Sempre ativa | Mantém a página carregada e os timers ativos em outras contas e espaços. Usa mais recursos. Veja abaixo as limitações de renderização. |
| Ativa quando visível | Reduz atividade em segundo plano e descarrega uma página oculta após um minuto. Ao voltar, reconecta o jogo. |
| Suspensa | Descarrega imediatamente. Retomar reabre o mesmo perfil salvo. |

Descarregar pode desconectar o personagem. A progressão offline depende do jogo. As métricas não incluem o custo compartilhado do aplicativo/GPU. A compatibilidade depende do site e de sua autenticação.

## Dados portáteis

Páginas abertas em segundo plano começam com uma área de tamanho adequado, baseada no painel visível, em vez de uma superfície de 1×1 pixel. Assim, os jogos podem calcular o Canvas, a câmera e a interface iniciais em um tamanho normal. Trocar entre contas Sempre ativas mantém a mesma página e seu estado em memória; não recarrega nem copia dados de outra conta.

O Astria cria **Save** ao lado do executável ao abrir pela primeira vez:

| Pasta | Conteúdo |
| --- | --- |
| Profile | Configurações e perfis Chromium separados das contas |
| Games | Arquivos/saves baixados ou exportados dos jogos |
| Backups | Exportações e programas anteriores das atualizações |
| Updates | Preparação de atualizações verificadas e registros locais |
| Temp, Logs, CrashDumps | Arquivos temporários e de diagnóstico |

Use **☰ → Abrir pasta Save**. `Save/LEIA-ME.txt` relaciona os nomes das contas às suas pastas. Para transferir ou fazer backup, feche o Astria e copie a **pasta inteira, incluindo Save**. Não abra duas cópias usando o mesmo Save.

O progresso online normalmente fica no servidor. Cookies protegidos pelo Windows podem exigir novo login em outro PC ou usuário. Exportar configuração inclui nomes, endereços e preferências, mas não cookies nem senhas. **Nunca compartilhe seu Save preenchido.** Distribua o ZIP limpo.

Cada conta usa o cache HTTP nativo do Chromium dentro de seu próprio perfil. Os arquivos dos jogos não são interceptados nem transferidos pelo processo principal do Astria. Isso pode usar mais disco que um cache compartilhado, mas evita essa etapa extra no carregamento. Pastas `Save/SharedAssets` de versões anteriores são preservadas, mas não são mais utilizadas. Todos os caches vão junto com Save.

Sempre ativa mantém as páginas carregadas, com timers e animações funcionando ao trocar de conta ou espaço e ao abrir diálogos do Astria. Cada jogo ativo continua usando sua própria CPU, RAM e GPU; várias contas podem reduzir o FPS disponível para a conta selecionada. Use Ativa quando visível ou Suspensa nas contas que não precisam continuar funcionando. Minimizar ou ocultar o aplicativo aplica o comportamento normal de página oculta do Chromium, permitindo que os jogos usem seus próprios mecanismos de atualização em segundo plano. A progressão online depende do jogo.

Fechar o Astria ou reiniciá-lo para atualizar permite que as páginas executem seus eventos normais de saída antes do encerramento do navegador e depois grava seus dados locais pendentes. Assim, os jogos podem enviar suas últimas mensagens de conexão/salvamento. Uma página que não termina de fechar tem um limite de cinco segundos. Isso não garante recuperar um estado já perdido no servidor do jogo.

Ao abrir o Astria, a conta visível selecionada inicia primeiro. As outras páginas visíveis usam uma pequena fila de carregamento; as contas Sempre ativas ocultas abrem uma por vez após terminar a navegação visível. Uma página lenta libera sua posição inicial na fila após dez segundos para não bloquear as demais indefinidamente. Selecionar uma conta na fila dá prioridade a ela. Os modos de atividade e as sessões salvas são preservados.

Para abrir mais rápido após ligar o PC, mantenha a pasta portátil Astria inteira, incluindo Save, em um SSD. Um HD mecânico pode demorar mais enquanto o Windows ainda não tem os arquivos do programa e dos perfis em cache. Feche o Astria antes de mudar de local; não é necessário apagar caches ou perfis.

## Política do projeto e segurança

O projeto oficial é mantido pelo proprietário. Pull requests, issues e discussões externas estão desativados. Outras pessoas podem baixar versões e ler o código público, mas não enviar alterações diretamente ao repositório oficial. O material público continua copiável conforme a licença incluída.

Veja [SECURITY.md](SECURITY.md) para relatos privados de vulnerabilidades e limites de segurança. Instruções de compilação do proprietário: [CONTRIBUTING.md](CONTRIBUTING.md). Licença MIT.
