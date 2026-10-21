'use strict';
// Portuguese source phrases are retained for compatibility with the existing UI.
// Tagged templates translate static parts only; account/workspace names stay intact.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AstriaI18n = api;
})(typeof window === 'object' ? window : globalThis, () => {
  const strings = {
    'Sempre ativa mantém o desenho e as atualizações ao trocar de conta ou espaço. Quando a janela é minimizada, o jogo recebe o estado normal de página oculta do navegador.':'Always active keeps drawing and updates running when switching accounts or workspaces. When the window is minimized, the game receives the browser’s normal hidden-page state.',
    'Aguardando carregamento…':'Waiting to load…',
    'Cache nativo independente por conta':'Native cache, separate for each account',
    'O cache dos jogos é separado por conta e fica dentro de Save. Várias contas ativas dividem os recursos da CPU e da GPU.':'Game caches are separate per account and stay inside Save. Multiple active accounts compete for CPU and GPU resources.',
    'A renderização Canvas pode pausar em contas ocultas ou com a janela minimizada, mesmo com os timers ativos. Mantenha o jogo visível se ele exigir renderização contínua.':'Canvas rendering can pause in hidden accounts or while the window is minimized even though timers remain active. Keep the game visible if it requires continuous rendering.',
    'Meus jogos':'My games','Espaços e contas':'Workspaces and accounts','Espaços':'Workspaces','Espaço':'Workspace','Contas':'Accounts','Conta':'Account',
    'Novo espaço':'New workspace','Novo espaço…':'New workspace…','Nova conta':'New account','Nova conta…':'New account…',
    'Editar espaço':'Edit workspace','Editar espaço…':'Edit workspace…','Criar espaço':'Create workspace','Nome do jogo ou grupo':'Game or group name',
    'Tema escuro':'Dark mode','Alternar tema':'Toggle theme','Largura da lateral':'Sidebar width','Arraste para ajustar a lateral. Use as setas para ajuste fino.':'Drag to resize the sidebar. Use arrow keys for fine adjustments.',
    'Sempre ativa':'Always active','Ativa quando visível':'Active when visible','Suspensa · RAM liberada':'Suspended · memory released','Suspensa':'Suspended',
    'Ativa quando visível · descarrega após 1 minuto oculta':'Active when visible · unloads after one minute hidden','Suspender · liberar RAM':'Suspend · release memory',
    'Suspender agora · liberar RAM':'Suspend now · release memory','Quando oculta: descarrega após 1 minuto':'When hidden: unloads after one minute','Ao retomar, o jogo reconecta':'Resuming reconnects the game',
    'Atividade das contas':'Account activity','Atividade de ':'Activity for ','Atividade':'Activity','Retomar conta':'Resume account',' está suspensa':' is suspended',
    'A página foi descarregada para liberar RAM. Retomar abre o jogo com o perfil salvo.':'The page was unloaded to release memory. Resume reopens it with the saved profile.',
    'Mantém a página carregada e os timers ativos ao trocar de conta ou espaço. Usa mais recursos.':'Keeps the page loaded and timers active when switching accounts or workspaces. Uses more resources.',
    'Reduz a atividade quando oculta. Após um minuto, descarrega a página para liberar RAM. Ao voltar, o jogo reconecta.':'Reduces background activity. After one minute hidden, unloads the page to release memory. Showing it reconnects the game.',
    'Descarrega imediatamente. Use Retomar conta para abrir novamente com o perfil salvo.':'Unloads immediately. Use Resume account to reopen with the saved profile.',
    'Descarregar pode interromper a atividade online do jogo. A progressão offline depende de cada jogo. Escolha o modo no botão direito da conta.':'Unloading may interrupt online activity. Offline progress depends on the game. Right-click the account to choose its mode.',
    'Erro ao carregar':'Loading error','Carregando…':'Loading…','Abrindo ':'Opening ','Processo encerrado: ':'Process exited: ',
    'Crie sua primeira conta.':'Create your first account.','Seu próximo espaço.':'Your next workspace.',
    'Adicione um jogo. Cada conta tem seu próprio login e pode ter uma cor e um modo de atividade.':'Add a browser game. Each account has its own login, color and activity mode.',
    'Criar conta':'Create account','Renomear conta':'Rename account','Renomear conta…':'Rename account…','Editar endereço':'Edit address','Editar endereço…':'Edit address…',
    'Escolha um nome e o endereço do jogo. O login fica separado das outras contas.':'Choose a name and the game URL. Its login stays separate from the other accounts.',
    'Nome da conta':'Account name','Nome do personagem':'Character or account name','Nome':'Name','Endereço':'URL','Endereço inicial':'Home page',
    'https://site-do-jogo.com':'https://game.example.com','Nova conta neste espaço…':'New account in this workspace…','Remover painel…':'Remove panel…',
    'Escolher cor':'Choose color','Escolher cor…':'Choose color…','Cor de ':'Color for ','Arraste na roda para escolher o tom e ajuste o brilho.':'Drag on the wheel to choose a hue and adjust brightness.',
    'Matiz e saturação':'Hue and saturation','Matiz ':'Hue ',' graus, saturação ':' degrees, saturation ','Brilho':'Brightness','Cor hexadecimal':'Hex color','Salvar cor':'Save color',
    'Cancelar':'Cancel','Salvar':'Save','Excluir':'Delete','Remover':'Remove','Remover ':'Remove ','Fechar':'Close','Entendi':'Got it',
    'Os painéis deste espaço serão removidos.':'The panels in this workspace will be removed.','O painel será removido.':'The panel will be removed.',
    ' Os perfis e logins salvos no computador serão preservados.':' Saved profiles and logins will be kept.',
    'Atualizar':'Reload','Atualizar sem cache':'Reload without cache','Ativar áudio':'Unmute','Silenciar':'Mute','Áudio de ':'Audio for ','Aumentar':'Zoom in','Diminuir':'Zoom out','Restaurar 100%':'Reset to 100%',
    'Layout dos painéis':'Panel layout','Opções da conta':'Account options','Opções de ':'Options for ','Grade automática':'Auto grid','Colunas':'Columns','Linhas':'Rows','Uma conta por vez':'One account at a time',
    'Exportar configuração…':'Export configuration…','Importar configuração…':'Import configuration…','Importar configuração':'Import configuration',
    'Substitui a lista atual de espaços e contas. O arquivo não inclui cookies nem senhas.':'Replaces the current workspace and account list. The file contains no cookies or passwords.',
    'Escolher arquivo':'Choose file','Configuração importada.':'Configuration imported.','Exportar espaços e contas (não inclui cookies)':'Export workspaces and accounts (no cookies)',
    'Importar espaços e contas (substitui a configuração)':'Import workspaces and accounts (replaces configuration)','Logins e cookies não estão neste arquivo.':'Logins and cookies are not included in this file.',
    'Abrir pasta Save':'Open Save folder','Abrir pasta de dados':'Open data folder','Desempenho':'Performance','Sobre os modos…':'About activity modes…',
    ' painéis carregados · ~':' panels loaded · ~',' MB no aplicativo':' MB in the app','Cache público: ':'Public cache: ',' reutilizações · ':' reuses · ',' MB poupados nesta execução':' MB of content reused this run',
    'Ativa quando visível economiza RAM após 1 minuto':'Active when visible saves memory after one minute','Suspender descarrega o painel imediatamente':'Suspend unloads the panel immediately',' · Portátil':' · Portable',
    'RAM aproximada dos processos da página: ':'Approximate page process memory: ',' Processo compartilhado com outro painel.':' Process shared with another panel.',
    ' processo(s).':' process(es).',' Não inclui o custo compartilhado do aplicativo e da GPU.':' Excludes shared application and GPU overhead.','Aguardando medição dos processos da página.':'Waiting for page process measurements.',
    'Verificar atualizações…':'Check for updates…','Atualizar Astria':'Update Astria','Verificando a última versão no GitHub…':'Checking the latest version on GitHub…',
    'O download é verificado com a assinatura do Astria. Seus perfis e a pasta Save são preservados. Reiniciar desconecta temporariamente os jogos.':'The download is verified with Astria’s signature. Your profiles and Save folder are preserved. Restarting temporarily disconnects games.',
    'Verificando…':'Checking…','Tentar novamente':'Try again',' está atualizado.':' is up to date.','Versão ':'Version ',' disponível · ':' available · ',
    'Baixar atualização':'Download update','Baixando…':'Downloading…','Baixando e verificando os arquivos…':'Downloading and verifying files…',
    ' verificada. A versão anterior ficará em Save/Backups.':' verified. The previous program will be kept in Save/Backups.','Reiniciar e atualizar':'Restart and update',
    'Não foi possível concluir.':'Could not complete the action.','Não foi possível carregar a configuração.':'Could not load the configuration.',
    'Informe um endereço http/https válido.':'Enter a valid HTTP/HTTPS URL.','URL inválida.':'Invalid URL.','Apenas sites http/https são permitidos.':'Only HTTP/HTTPS websites are allowed.','URL inválida ou contém credenciais.':'Invalid URL or URL contains credentials.',
    'Arquivo de configuração inválido.':'Invalid configuration file.','Conta não encontrada.':'Account not found.','Espaço não encontrado.':'Workspace not found.','Origem não autorizada.':'Unauthorized origin.',
    'Mantenha pelo menos um espaço.':'Keep at least one workspace.','Layout desconhecido.':'Unknown layout.','Sessão salva no disco; dados do site não foram apagados.':'Session saved on disk; website data was not deleted.',
    'Conta fora deste espaço.':'Account is outside this workspace.','Informe o nome da conta.':'Enter the account name.','Cor inválida.':'Invalid color.','Modo de atividade inválido.':'Invalid activity mode.',
    'Retome a conta suspensa primeiro.':'Resume the suspended account first.','Zoom inválido.':'Invalid zoom.','Largura inválida.':'Invalid width.','Arquivo muito grande.':'File is too large.','Idioma inválido.':'Invalid language.',
    'Copiar':'Copy','Colar':'Paste','Selecionar tudo':'Select all','Idioma':'Language',
    'Assinatura da atualização inválida.':'Invalid update signature.','Atualização incompatível.':'Incompatible update.','Pacote inválido.':'Invalid package.','Lista de arquivos inválida.':'Invalid file list.',
    'Caminho ou arquivo não autorizado.':'Unauthorized path or file.','Pacote incompleto ou muito grande.':'Package is incomplete or too large.','Arquivos ausentes no ZIP.':'Files are missing from the ZIP.',
    'Entrada ZIP não autorizada.':'Unauthorized ZIP entry.','Pasta ZIP não autorizada.':'Unauthorized ZIP directory.','Arquivo ZIP não corresponde ao manifesto.':'ZIP file does not match the manifest.','Conteúdo extraído inválido.':'Invalid extracted content.',
    'Servidor de atualização não autorizado.':'Unauthorized update server.','GitHub indisponível (':'GitHub unavailable (','Redirecionamentos demais.':'Too many redirects.','Repositório de atualização não configurado.':'Update repository is not configured.',
    'Release inválida.':'Invalid release.','Versão assinada não corresponde à release.':'Signed version does not match the release.','Verifique as atualizações primeiro.':'Check for updates first.',
    'Use a edição portátil para atualizar dentro do Astria.':'Use the portable edition to update within Astria.','Tamanho do download inválido.':'Invalid download size.','A verificação do download falhou.':'Download verification failed.',
    'Pasta do programa não é regular.':'Program directory is not a regular directory.','Arquivo do programa não é regular.':'Program file is not a regular file.','Baixe e verifique a atualização primeiro.':'Download and verify the update first.',
    'A atualização já está sendo preparada.':'The update is already being prepared.','Não foi possível preparar a atualização. Consulte Save/Updates/apply.log.':'Could not prepare the update. See apply.log inside the update’s Save/Updates folder.',
    'A preparação da atualização demorou demais. Seus jogos continuam abertos.':'Update preparation timed out. Your games remain open.','Resposta muito grande.':'Response is too large.'
  };
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(Object.keys(strings).sort((a,b)=>b.length-a.length).map(escape).join('|'), 'g');
  function translate(value, language = 'en') {
    value = String(value);
    return language === 'pt-BR' ? value : value.replace(pattern, match => strings[match]);
  }
  function tag(parts, values, language) {
    return parts.map((part,index)=>translate(part,language)+(index<values.length?values[index]:'')).join('');
  }
  return { translate, tag, strings };
});
