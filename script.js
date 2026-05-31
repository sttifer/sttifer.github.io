// Gestor de estado dos modos do sistema
let currentMode = "corporate"; // Opções: 'corporate', 'arcade'

// Variável de inicialização do contexto de áudio
let audioCtx = null;
let isMuted = true;

// Dados da arquitetura interativa
const architectureData = {
    domain: {
        title: "Núcleo do Domínio (Domain)",
        desc: "O coração inabalável do software. Esta camada é 100% independente de base de dados, frameworks ou interfaces web. Contém apenas regras puras de negócios, entidades, objetos de valor e interfaces de repositórios que espelham o negócio.",
        list: [
            "Domain Entities & Aggregate Roots",
            "Value Objects (Garante consistência)",
            "Interfaces dos Repositórios",
            "Exceptions personalizadas de negócios"
        ],
        colorClass: "pink"
    },
    app: {
        title: "Casos de Uso (Application)",
        desc: "Camada encarregada de coordenar o fluxo de dados para a realização de tarefas específicas de negócios. Não se importa com bases ou conexões diretas, apenas orquestra as regras puras do Domínio.",
        list: [
            "CQRS Handlers (Comando e Consulta apartados)",
            "DTOs (Data Transfer Objects)",
            "Mapeadores de Dados (AutoMapper/Mapster)",
            "Regras de Validação com FluentValidation"
        ],
        colorClass: "violet"
    },
    adapters: {
        title: "Adapters & Controller APIs",
        desc: "Mapeia os dados recebidos dos canais externos para a estrutura interna. É aqui que as requisições HTTP são desserializadas e transformadas em comandos executáveis de negócio.",
        list: [
            "Controllers de Web API RESTful",
            "Filtros Globais de Exceções",
            "Middlewares personalizados do pipeline do .NET Core",
            "Autenticação e Autorização baseada em Claims (JWT)"
        ],
        colorClass: "indigo"
    },
    infra: {
        title: "Infraestrutura & Apresentação",
        desc: "A camada mais periférica e mutável da solução. Aqui residem os pacotes de persistência específica de base de dados, integrações de nuvem do Azure, serviços de Log e configurações de alojamento.",
        list: [
            "Entity Framework Core (EF Core) & Dapper",
            "Scripts de Migrações e Stored Procedures Oracle / SQL Server",
            "Configurações de Dockerfile e Manifesto Kubernetes",
            "Provedores de Cache Distribuído (Redis e MongoDB)"
        ],
        colorClass: "cyan"
    }
};

// Inicializar a configuração do layout
window.onload = function() {
    selectArchLayer('domain');
    initGameCanvas();
}

// Alternar menu mobile
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

function togglePortfolioMode() {
    const corpEl = document.getElementById('corporateMode');
    const arcEl = document.getElementById('arcadeMode');
    const iconEl = document.getElementById('toggleIcon');
    const audioCont = document.getElementById('audioToggleContainer');

    if (currentMode === "corporate") {
        currentMode = "arcade";
        corpEl.classList.add('hidden');
        arcEl.classList.remove('hidden');
        audioCont.classList.remove('hidden');
        
        // Alterar ícones
        iconEl.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />`;
        
        // CORREÇÃO CRÍTICA: Forçar redimensionamento do Canvas agora que o ecrã está visível (display != none)
        resizeCanvas();
        drawCleanScreen();

        // Emitir som harmónico de alternância
        triggerSound(220, 'triangle', 0.1);
        setTimeout(() => triggerSound(440, 'triangle', 0.15), 100);
    } else {
        currentMode = "corporate";
        corpEl.classList.remove('hidden');
        arcEl.classList.add('hidden');
        audioCont.classList.add('hidden');
        iconEl.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11h.01M19 11h.01M17 9h.01M17 13h.01M5 11h4M7 9v4M4 18h16a2 2 0 002-2V8a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2z" />`;
        
        stopGame();
    }
}

// WEB AUDIO API - Sintetizador retro de 8-bits
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function toggleAudio() {
    initAudio();
    isMuted = !isMuted;
    
    const audioIcon = document.getElementById('audioIcon');

    if (isMuted) {
        audioIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        `;
    } else {
        audioIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        `;
        
        triggerSound(523.25, 'sine', 0.1); // Nota Dó (C5)
    }
}

function triggerSound(frequency, type = 'square', duration = 0.1) {
    if (isMuted || !audioCtx) return;
    
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Contexto de áudio indisponível: ", e);
    }
}

function selectArchLayer(layerKey) {
    const layerData = architectureData[layerKey];
    if (!layerData) return;

    // Resetar classes das camadas no diagrama circular
    document.getElementById('arch-layer-infra').className = "absolute inset-0 rounded-full border-4 border-dashed border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 cursor-pointer flex items-start justify-center pt-2 transition-all duration-300";
    document.getElementById('arch-layer-adapters').className = "absolute inset-8 rounded-full border-2 border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer flex items-start justify-center pt-2 transition-all duration-300";
    document.getElementById('arch-layer-application').className = "absolute inset-16 rounded-full border-2 border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/10 cursor-pointer flex items-start justify-center pt-2 transition-all duration-300";
    document.getElementById('arch-layer-domain').className = "absolute inset-24 rounded-full border-4 border-double border-pink-500 bg-pink-500/10 hover:bg-pink-500/20 cursor-pointer flex items-center justify-center text-center transition-all duration-300";

    // Aplicar estilos ativos
    let colorTheme = "pink";
    if (layerKey === 'infra') {
        document.getElementById('arch-layer-infra').classList.add('border-cyan-400', 'bg-cyan-500/15', 'ring-4', 'ring-cyan-500/20');
        colorTheme = "cyan";
    } else if (layerKey === 'adapters') {
        document.getElementById('arch-layer-adapters').classList.add('border-indigo-400', 'bg-indigo-500/15', 'ring-4', 'ring-indigo-500/20');
        colorTheme = "indigo";
    } else if (layerKey === 'app') {
        document.getElementById('arch-layer-application').classList.add('border-violet-400', 'bg-violet-500/15', 'ring-4', 'ring-violet-500/20');
        colorTheme = "violet";
    } else if (layerKey === 'domain') {
        document.getElementById('arch-layer-domain').classList.add('border-pink-300', 'bg-pink-500/25', 'ring-4', 'ring-pink-500/30');
        colorTheme = "pink";
    }

    // Renderização dos dados no painel informativo lateral
    const titleEl = document.getElementById('arch-info-title');
    const descEl = document.getElementById('arch-info-desc');
    const listEl = document.getElementById('arch-info-list');
    const panelEl = document.getElementById('arch-info-panel');

    titleEl.innerText = layerData.title;
    descEl.innerText = layerData.desc;
    
    titleEl.className = `text-xl font-bold font-code text-${colorTheme}-400`;
    panelEl.className = `p-6 sm:p-8 rounded-2xl bg-slate-900 border-2 border-${colorTheme}-500/30 shadow-2xl shadow-${colorTheme}-500/5 transition-all duration-300`;

    let listHtml = "";
    layerData.list.forEach(item => {
        listHtml += `<li class="hover:text-white transition-colors">&gt; ${item}</li>`;
    });
    listEl.innerHTML = listHtml;
}


let canvas, ctx;
let gameLoopId = null;
let isGameActive = false;
let score = 0;

// Configurações do Personagem / Nave do Dev
const player = {
    x: 100,
    y: 100,
    width: 44,
    height: 32,
    speed: 8,
    dx: 0
};

let goodItems = []; 
let obstacles = []; 

// Modelos de elementos bons (Moedas arquiteturais)
const goodTemplates = [
    { text: ".NET", color: "#512BD4", score: 100 },
    { text: "C#", color: "#239120", score: 150 },
    { text: "SOLID", color: "#f43f5e", score: 200 },
    { text: "REDIS", color: "#DC382D", score: 100 },
    { text: "CLEAN", color: "#10b981", score: 250 }
];

// Modelos de obstáculos perigosos
const badTemplates = [
    { text: "BUG", color: "#ef4444" },
    { text: "WCF", color: "#ef4444" },
    { text: "MONÓLITO", color: "#b45309" },
    { text: "LEGADO", color: "#ef4444" },
    { text: "SPILL", color: "#b91c1c" }
];

function initGameCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Adicionar eventos de toque ao Canvas para movimento no mobile
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
    canvas.addEventListener('touchmove', handleCanvasTouch, { passive: false });
    
    drawCleanScreen();
}

function handleCanvasTouch(e) {
    if (!isGameActive) return;
    e.preventDefault(); // Impede scroll indesejado do ecrã
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    // Calcular a escala X correta (caso o CSS distorça a largura nativa)
    const scaleX = canvas.width / rect.width;
    const touchX = (touch.clientX - rect.left) * scaleX;
    
    // Atualizar X diretamente (centralizando a nave no dedo)
    player.x = touchX - (player.width / 2);
}

function resizeCanvas() {
    if (!canvas) return;
    const parentWidth = canvas.parentElement.clientWidth;
    
    // Atribuir as dimensões reais de processamento baseadas no contentor visível
    if (parentWidth > 0) {
        canvas.width = parentWidth;
        canvas.height = parentWidth * 0.75; // Proporção clássica 4:3
    }
    
    player.y = canvas.height - 45;
    if (player.x > canvas.width || player.x === 100) {
        player.x = canvas.width / 2 - player.width / 2;
    }
}

function drawCleanScreen() {
    ctx.fillStyle = "#0c0a09"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grelhas retro verdes estilizadas
    ctx.strokeStyle = "rgba(16, 185, 129, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
    }
}

// Ouvintes de teclado para o PC
window.addEventListener('keydown', function(e) {
    if (!isGameActive) return;
    if (e.key === "ArrowLeft" || e.key === "a") {
        player.dx = -player.speed;
    } else if (e.key === "ArrowRight" || e.key === "d") {
        player.dx = player.speed;
    }
});

window.addEventListener('keyup', function(e) {
    if (!isGameActive) return;
    if (["ArrowLeft", "a", "ArrowRight", "d"].includes(e.key)) {
        player.dx = 0;
    }
});

function startGame() {
    initAudio();
    document.getElementById('gameMenuOverlay').classList.add('hidden');
    
    score = 0;
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 45;
    player.dx = 0;
    
    goodItems = [];
    obstacles = [];
    isGameActive = true;

    // Efeito sonoro de início
    triggerSound(440, 'sine', 0.1);
    setTimeout(() => triggerSound(554.37, 'sine', 0.1), 100);
    setTimeout(() => triggerSound(659.25, 'sine', 0.1), 200);
    setTimeout(() => triggerSound(880, 'sine', 0.25), 300);

    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameLoop);
}

function stopGame() {
    isGameActive = false;
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    document.getElementById('gameMenuOverlay').classList.remove('hidden');
}

function gameOver() {
    isGameActive = false;
    
    // Acorde sonoro descendente de falha
    triggerSound(293.66, 'sawtooth', 0.3);
    setTimeout(() => triggerSound(196, 'sawtooth', 0.5), 150);

    const overlay = document.getElementById('gameMenuOverlay');
    overlay.innerHTML = `
        <span class="text-rose-500 font-bold text-xs sm:text-sm tracking-widest animate-pulse">*** GAME OVER ***</span>
        <h3 class="text-base sm:text-lg text-emerald-400 font-bold">PROJETO IMPLEMENTADO!</h3>
        <p class="text-[11px] text-white">Sua pontuação de refatoração: <strong class="text-yellow-400 font-arcade text-xs">${score} PTS</strong></p>
        <p class="hidden sm:block text-[9px] text-slate-400 max-w-sm">Você conseguiu otimizar excelentes trechos de código e evitou gargalos legados monstruosos!</p>
        <button onclick="restartGameWithOriginalMenu()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold border rounded text-[10px] font-arcade mt-2">
            JOGAR DE NOVO
        </button>
    `;
    overlay.classList.remove('hidden');
}

function restartGameWithOriginalMenu() {
    const overlay = document.getElementById('gameMenuOverlay');
    overlay.innerHTML = `
        <span class="text-yellow-400 text-xs sm:text-sm tracking-widest animate-pulse">--- REFATORANDO JOGANDO ---</span>
        <h3 class="text-base sm:text-xl text-emerald-400 font-bold leading-normal">
            DOTNET DEFENDER <br> <span class="text-[10px] text-pink-500">v1.2 - REFACTORING EDITION</span>
        </h3>
        <p class="hidden sm:block text-slate-400 text-[9px] max-w-sm leading-relaxed">
            Controle o Dev Kit do Andrews! Colete moedas de <strong class="text-blue-400">.NET, SOLID e EF Core</strong> e desvie de monstros como <strong class="text-red-500">Bugs, Monólitos Legados e Código Espaguete</strong>!
        </p>
        <div class="bg-zinc-900/80 border border-zinc-800 p-2 sm:p-3 rounded text-[8px] sm:text-[9px] text-zinc-300 w-full max-w-xs space-y-1">
            <p class="text-emerald-400 uppercase">Controlos:</p>
            <p>PC: Seta Esquerda / Direita</p>
            <p>Telemóvel: Deslize o dedo sobre a tela do jogo</p>
        </div>
        <button onclick="startGame()" class="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold border-2 border-white rounded transform hover:scale-105 transition-all text-xs">
            INICIAR JOGO
        </button>
    `;
    startGame();
}

function gameLoop() {
    if (!isGameActive) return;

    updatePlayer();
    updateSpawningObjects();
    checkCollisions();

    drawCleanScreen();
    drawEntities();

    gameLoopId = requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    player.x += player.dx;
    
    // Limites do ecrã
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
}

function updateSpawningObjects() {
    // Criar bónus arquiteturais de forma aleatória
    if (Math.random() < 0.03) {
        const template = goodTemplates[Math.floor(Math.random() * goodTemplates.length)];
        goodItems.push({
            x: Math.random() * (canvas.width - 65),
            y: -20,
            width: 60,
            height: 22,
            speed: 2 + Math.random() * 3,
            text: template.text,
            color: template.color,
            scoreValue: template.score
        });
    }

    // Criar ameaças / obstáculos
    if (Math.random() < 0.025) {
        const template = badTemplates[Math.floor(Math.random() * badTemplates.length)];
        obstacles.push({
            x: Math.random() * (canvas.width - 75),
            y: -20,
            width: 72,
            height: 22,
            speed: 3 + Math.random() * 4,
            text: template.text,
            color: template.color
        });
    }

    goodItems.forEach(item => item.y += item.speed);
    obstacles.forEach(obs => obs.y += obs.speed);

    goodItems = goodItems.filter(item => item.y < canvas.height);
    obstacles = obstacles.filter(obs => obs.y < canvas.height);
}

function checkCollisions() {
    for (let i = goodItems.length - 1; i >= 0; i--) {
        const item = goodItems[i];
        if (isColliding(player, item)) {
            score += item.scoreValue;
            goodItems.splice(i, 1);
            
            // Som de moedas
            triggerSound(783.99, 'sine', 0.1); 
            setTimeout(() => triggerSound(1046.50, 'sine', 0.12), 60); 
        }
    }

    for (let j = obstacles.length - 1; j >= 0; j--) {
        const obs = obstacles[j];
        if (isColliding(player, obs)) {
            gameOver();
            break;
        }
    }
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y;
}

function drawEntities() {
    // Renderizar a nave C# de forma segura e responsiva
    ctx.fillStyle = "#512BD4"; 
    
    // Desenho seguro com cantos retos ou curvos caso o roundRect não seja compatível
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(player.x, player.y, player.width, player.height, 6);
        ctx.fill();
    } else {
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px 'Fira Code', monospace";
    ctx.fillText("C#", player.x + 14, player.y + 20);

    // Desenhar bónus
    goodItems.forEach(item => {
        ctx.fillStyle = item.color;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(item.x, item.y, item.width, item.height, 4);
            ctx.fill();
        } else {
            ctx.fillRect(item.x, item.y, item.width, item.height);
        }
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px 'Press Start 2P', monospace";
        ctx.fillText(item.text, item.x + 6, item.y + 14);
    });

    // Desenhar obstáculos
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
            ctx.fill();
        } else {
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.fillText(obs.text, obs.x + 6, obs.y + 15);
    });

    // Interface HUD de Jogo
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 9px 'Press Start 2P', monospace";
    ctx.fillText(`SCORE: ${score}`, 15, 25);
    ctx.fillText("LIVES: 1 (PROD)", canvas.width - 160, 25);
}