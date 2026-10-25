# Astria 1.7.0 — Adaptive performance

## English

- Adaptive Eco: the battery button gives the active account up to 60 FPS. Secondary accounts use up to 15 FPS, 10 FPS with four loaded accounts, or 5 FPS with eight. Existing fixed-FPS Eco settings remain available.
- Visual rest: hidden loaded accounts stay connected, run at up to 2 FPS and are muted. Newly decoded image animations are disabled; previously loaded images may continue animating.
- Fixed per-account virtual resolution: 720p, 768p, 900p and 1080p, scaled to fit the panel. Pointer input remains aligned.
- Ultra: one game fullscreen, other loaded accounts at up to 1 FPS. Exit with the same expand button.
- Manual unused-JavaScript memory cleanup, without clearing saves, caches, sessions or live game resources.
- Expanding-star logo, regenerated Windows icons and reduced-motion support.

Open the sliders beside the page RAM/CPU indicator, or **Menu → Performance → About activity modes**. Account context menus include resolution and Ultra. Very narrow panels keep these settings in menus to save space.

Economy modes preserve live sessions. Active when visible normally unloads after five minutes hidden; Visual rest and Ultra temporarily keep already loaded pages alive. Explicit Suspend still disconnects immediately. Frame-based game logic can slow at very low FPS; choose a higher limit if needed. Actual RAM savings depend on the game's live assets and data.

Update through **Menu → Check for updates**, or close Astria and replace program files using the portable ZIP while keeping your **Save** folder. Never distribute your populated Save folder.

## Português (Brasil)

- Eco adaptativo: o botão de bateria oferece até 60 FPS na conta em uso. As secundárias usam até 15 FPS, 10 FPS com quatro contas carregadas ou 5 FPS com oito. A economia com FPS fixo continua disponível.
- Descanso visual: contas ocultas já carregadas continuam conectadas em até 2 FPS e sem áudio. Desativa animações de imagens novas; imagens anteriores podem continuar animadas.
- Resolução virtual fixa por conta: 720p, 768p, 900p e 1080p, ajustada ao painel. Os cliques continuam alinhados à imagem.
- Ultra: uma conta em tela cheia e demais carregadas em até 1 FPS. Saia pelo mesmo botão de expandir.
- Limpeza manual de objetos JavaScript sem uso, sem apagar saves, caches, sessões ou recursos ainda usados pelo jogo.
- Logo de estrela em expansão, ícones do Windows regenerados e suporte a movimento reduzido.

Abra os ajustes ao lado do indicador de RAM/CPU ou **Menu → Desempenho → Sobre os modos**. O menu da conta inclui resolução e Ultra. Em painéis estreitos, alguns controles ficam nos menus para economizar espaço.

Os modos de economia preservam sessões abertas. Ativa quando visível normalmente descarrega após cinco minutos oculta; Descanso visual e Ultra mantêm temporariamente as páginas já carregadas. Suspender continua desconectando imediatamente. Jogos que calculam atividade por quadro podem ficar mais lentos com FPS muito baixo; aumente o limite se necessário. O ganho real de RAM depende dos recursos e dados vivos do jogo.

Atualize em **Menu → Verificar atualizações** ou feche o Astria e substitua os arquivos do programa com o ZIP portátil, preservando sua pasta **Save**. Nunca distribua sua pasta Save preenchida.
