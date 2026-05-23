import { CONFIG } from '../config.js';

export class Gameplay extends Phaser.Scene {
    constructor() {
        super('Gameplay');
        this.lastHarvestTime = 0;
        this.activeCraftTarget = null;
        this.craftCharge = 0;
        this.saveInterval = 5000;
        this.lastSaveTime = 0;
        this.gameTime = 6;
        this.currentDay = 1;
        this.lastTimeUpdate = 0;
        this.currentPhase = 'day';
        this.isInvincible = false;
        this.lastHealTime = 0;
        this.builtBridges = [];
        this.playerPos = null;
        this.playerHp = 100;
        this.playerMaxHp = 100;
    }

    init(data) { 
        if (data && data.resetSave) {
            localStorage.removeItem('phaser_game_save');
        }
        this.isDead = false;
        this.loadGame(); 
    }

    loadGame() {
        const saved = localStorage.getItem('phaser_game_save');
        if (saved) {
            const data = JSON.parse(saved);
            this.resources = data.resources || { ...CONFIG.resources };
            this.tools = data.tools || { ...CONFIG.tools };
            this.buildingsBuilt = data.buildingsBuilt || { workbench: data.baseBuilt || false, armory: data.armoryBuilt || false, healer: data.healerBuilt || false };
            this.worldSeed = data.worldSeed || Math.random().toString(36).substring(7);
            this.harvestedNodes = data.harvestedNodes || [];
            this.gameTime = data.gameTime || 6;
            this.currentDay = data.currentDay || 1;
            this.builtBridges = data.builtBridges || [];
            this.damagedNodes = data.damagedNodes || {};
            this.playerPos = data.playerPos || null;
            this.playerHp = data.playerHp !== undefined ? data.playerHp : 100;
            this.playerMaxHp = data.playerMaxHp !== undefined ? data.playerMaxHp : 100;
        } else {
            this.resources = { ...CONFIG.resources };
            this.tools = { ...CONFIG.tools };
            this.buildingsBuilt = { workbench: false, armory: false, healer: false };
            this.worldSeed = Math.random().toString(36).substring(7);
            this.harvestedNodes = [];
            this.gameTime = 6;
            this.currentDay = 1;
            this.builtBridges = [];
            this.damagedNodes = {};
            this.playerPos = null;
            this.playerHp = 100;
            this.playerMaxHp = 100;
        }
    }

    saveGame() {
        if (!this.isDead && this.player) {
            this.playerPos = { x: this.player.x, y: this.player.y };
            this.playerHp = this.player.getData('hp');
            this.playerMaxHp = this.player.getData('maxHp');
        }
        const data = { resources: this.resources, tools: this.tools, buildingsBuilt: this.buildingsBuilt, worldSeed: this.worldSeed, harvestedNodes: this.harvestedNodes, gameTime: this.gameTime, builtBridges: this.builtBridges, damagedNodes: this.damagedNodes, playerPos: this.playerPos, playerHp: this.playerHp, playerMaxHp: this.playerMaxHp, currentDay: this.currentDay };
        localStorage.setItem('phaser_game_save', JSON.stringify(data));
    }

    create() {
        const { islandSizeInTiles, gridSize, tileSize } = CONFIG.world;
        const islandSize = islandSizeInTiles * tileSize;
        const worldSize = islandSize * gridSize;
        this.physics.world.setBounds(0, 0, worldSize, worldSize);
        this.seededRandom = new Phaser.Math.RandomDataGenerator([this.worldSeed]);

        this.islands = this.physics.add.staticGroup();
        this.bridges = this.physics.add.staticGroup();
        this.trees = this.physics.add.staticGroup();
        this.stones = this.physics.add.staticGroup();
        this.goldNodes = this.physics.add.staticGroup();
        this.enemies = this.physics.add.group();
        this.bridgeBuildZones = this.physics.add.staticGroup();
        this.waterGroup = this.physics.add.staticGroup();
        
        this.respawnTexts = new Map();
        this.harvestedNodes.forEach(nodeData => {
            if (nodeData && typeof nodeData === 'object' && nodeData.respawnAt) {
                const text = this.add.text(nodeData.x, nodeData.y, '', { fontSize: '14px', fontStyle: 'bold', fill: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(150);
                this.respawnTexts.set(nodeData.id, text);
            }
        });

        this.generateIslands(gridSize, islandSize);
        
        // Desenha a Grade (Grid) visual para Debug cobrindo todo o mapa
        this.add.grid(worldSize / 2, worldSize / 2, worldSize, worldSize, tileSize, tileSize, 0x000000, 0, 0xffffff, 0.15).setDepth(2).setVisible(false);
        
        const rawCenter = 2 * islandSize + islandSize / 2;
        const baseX = Math.floor(rawCenter / tileSize) * tileSize + tileSize / 2;
        const baseY = Math.floor(rawCenter / tileSize) * tileSize + tileSize / 2;

        const spawnX = this.playerPos ? this.playerPos.x : baseX;
        const spawnY = this.playerPos ? this.playerPos.y : baseY;
        this.player = this.physics.add.sprite(spawnX, spawnY, null);
        this.player.setVisible(false); // Esconde a textura vazia preta (o visual é gerenciado pelo playerGraphics)
        this.player.setCircle(15);
        this.player.setCollideWorldBounds(true);
        this.player.setData({ hp: this.playerHp, maxHp: this.playerMaxHp });
        this.player.setDepth(100);
        
        this.playerGraphics = this.add.container(0, 0).setDepth(101);
        this.playerGraphics.add([this.add.circle(0, 0, 15, 0x3498db), this.mace = this.add.container(20, 0)]);
        this.mace.add([this.add.rectangle(0, 0, 4, 20, 0x7e5109), this.add.circle(0, -10, 6, 0x95a5a6)]);
        
        this.interactionCircle = this.add.graphics().setDepth(99);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,K');

        this.cameras.main.setBounds(0, 0, worldSize, worldSize);
        this.cameras.main.startFollow(this.player, true);
        this.cameras.main.setBackgroundColor(0x2980b9); // Define a cor base da água de forma fixa
        
        this.buildingContainers = {};
        for (const [id, bConfig] of Object.entries(CONFIG.buildings)) {
            this.buildingContainers[id] = this.add.container(baseX + bConfig.offsetCol * tileSize, baseY + bConfig.offsetRow * tileSize).setDepth(10);
            this.refreshBuildingUI(id);
        }

        this.physics.add.collider(this.player, this.trees);
        this.physics.add.collider(this.player, this.stones);
        this.physics.add.collider(this.player, this.goldNodes);
        this.physics.add.collider(this.player, this.waterGroup);
        this.physics.add.collider(this.enemies, this.waterGroup);
        this.physics.add.overlap(this.player, this.enemies, this.handleEnemyPlayerCollision, null, this);

        const h = this.gameTime;
        if (h >= CONFIG.time.nightStart || h < CONFIG.time.dayStart) this.currentPhase = 'night';
        else if (h >= CONFIG.time.afternoonStart) this.currentPhase = 'afternoon';
        else this.currentPhase = 'day';

        this.ambientColor = 0x000000;
        this.ambientAlpha = 0;
        this.lightScale = 0;
        this.lightRadius = CONFIG.light.radius;
        this.pulseOffset = 0;

        // Gera dinamicamente a textura do gradiente radial que você descreveu no prompt!
        this.brushRadius = Math.max(200, this.lightRadius + 50);
        if (!this.textures.exists('lightBrush')) {
            const brushTex = this.textures.createCanvas('lightBrush', this.brushRadius * 2, this.brushRadius * 2);
            const ctx = brushTex.getContext();
            const grd = ctx.createRadialGradient(this.brushRadius, this.brushRadius, 0, this.brushRadius, this.brushRadius, this.brushRadius);
            grd.addColorStop(0, 'rgba(255,255,255,1)');      // Luz forte no centro
            grd.addColorStop(0.4, 'rgba(255,255,255,0.8)');  // Começa a perder força
            grd.addColorStop(1, 'rgba(255,255,255,0)');      // Escuridão total nas bordas
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, this.brushRadius * 2, this.brushRadius * 2);
            brushTex.refresh();
        }

        // O pincel (alpha mask) e o RenderTexture para mesclagem perfeita
        this.lightBrush = this.make.image({ key: 'lightBrush', add: false }).setOrigin(0.5, 0.5);
        this.ambientOverlay = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setScrollFactor(0).setDepth(900);

        this.tweens.add({ targets: this, pulseOffset: CONFIG.light.pulseIntensity, duration: CONFIG.light.pulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.applyAtmosphere(this.currentPhase, true);

        this.createCanvasHUD();
        this.createClock();
        
        this.createVirtualJoystick();

        this.deathParticles = this.add.particles(0, 0, null, { speed: { min: 50, max: 150 }, scale: { start: 0.2, end: 0 }, lifespan: 500, blendMode: 'ADD', emitting: false });
        this.spawnParticles = this.add.particles(0, 0, null, { speed: { min: 20, max: 80 }, scale: { start: 0.3, end: 0 }, lifespan: 600, tint: 0x9b59b6, blendMode: 'ADD', emitting: false });

        this.time.addEvent({ delay: CONFIG.enemies.spawnRate, callback: this.spawnEnemy, callbackScope: this, loop: true });
        document.getElementById('restart-btn').onclick = () => this.restartGame();

        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
        this.resize(this.scale.gameSize);
    }

    createCanvasHUD() {
        this.hudContainer = this.add.container(this.scale.width / 2, 40).setScrollFactor(0).setDepth(1000);
        
        // Background do HUD
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.6);
        bg.fillRoundedRect(-200, -25, 400, 50, 10);
        bg.lineStyle(2, 0xffffff, 0.2);
        bg.strokeRoundedRect(-200, -25, 400, 50, 10);
        this.hudContainer.add(bg);

        // HP Bar no HUD
        this.hudHPBar = this.add.graphics();
        this.hudHPText = this.add.text(-180, 0, '100/100', { fontSize: '14px', fontStyle: 'bold' }).setOrigin(0, 0.5);
        this.hudContainer.add([this.hudHPBar, this.hudHPText]);

        // Recursos
        const startX = -60;
        const spacing = 85;
        this.hudWood = this.add.text(startX, 0, '🪵 0', { fontSize: '18px' }).setOrigin(0, 0.5);
        this.hudStone = this.add.text(startX + spacing, 0, '🪨 0', { fontSize: '18px' }).setOrigin(0, 0.5);
        this.hudGold = this.add.text(startX + spacing * 2, 0, '💰 0', { fontSize: '18px' }).setOrigin(0, 0.5);
        this.hudContainer.add([this.hudWood, this.hudStone, this.hudGold]);

        this.updateHUD();

        // Botão de Reset (Debug) - Posicionado no canto inferior esquerdo
        this.createResetButton();
        
        this.createFullscreenButton();

        // Contador de FPS (Canto superior direito)
        this.fpsText = this.add.text(this.scale.width - 10, 10, 'FPS: --', { fontSize: '16px', fontStyle: 'bold', fill: '#00ff00', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setScrollFactor(0).setDepth(2000);
    }

    createResetButton() {
        this.resetBtn = this.add.text(10, 60, 'New Game...', { 
            fontSize: '14px', fontStyle: 'bold', color: '#ffffff', 
            backgroundColor: '#c0392b', padding: { x: 10, y: 5 } 
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });

        this.resetBtn.on('pointerover', () => this.resetBtn.setStyle({ backgroundColor: '#e74c3c' }));
        this.resetBtn.on('pointerout', () => this.resetBtn.setStyle({ backgroundColor: '#c0392b' }));
        this.resetBtn.on('pointerdown', () => this.resetBtn.setScale(0.9));
        this.resetBtn.on('pointerup', () => {
            this.resetBtn.setScale(1);
            if (window.confirm("Tem certeza que deseja começar um novo jogo? Todo o seu progresso será perdido.")) {
                console.log("[DEBUG] Botão New Game clicado!");
                localStorage.removeItem('phaser_game_save');
                this.isDead = true;
                const gameOverScreen = document.getElementById('game-over');
                if (gameOverScreen) gameOverScreen.style.display = 'none';
                this.scene.restart({ resetSave: true });
            }
        });
    }

    createFullscreenButton() {
        // Ícone de tela cheia no canto superior esquerdo
        this.fullscreenBtn = this.add.text(10, 10, '⛶', { 
            fontSize: '24px', fontStyle: 'bold', color: '#ffffff', 
            backgroundColor: '#34495e', padding: { x: 8, y: 5 } 
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });

        this.fullscreenBtn.on('pointerover', () => this.fullscreenBtn.setStyle({ backgroundColor: '#2c3e50' }));
        this.fullscreenBtn.on('pointerout', () => this.fullscreenBtn.setStyle({ backgroundColor: '#34495e' }));
        this.fullscreenBtn.on('pointerdown', () => this.fullscreenBtn.setScale(0.9));
        this.fullscreenBtn.on('pointerup', () => {
            this.fullscreenBtn.setScale(1);
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });
    }

    updateHUD() {
        if (!this.hudContainer) return;
        
        this.hudWood.setText(`🪵 ${this.resources.wood}`);
        this.hudStone.setText(`🪨 ${this.resources.stone}`);
        this.hudGold.setText(`💰 ${this.resources.gold}`);

        if (this.player) {
            const hp = Math.max(0, this.player.getData('hp'));
            const maxHp = this.player.getData('maxHp');
            this.hudHPText.setText(`${Math.ceil(hp)}/${maxHp}`);
            
            this.hudHPBar.clear();
            this.hudHPBar.fillStyle(0x444444, 1);
            this.hudHPBar.fillRect(-185, -10, 100, 20);
            this.hudHPBar.fillStyle(0xe74c3c, 1);
            this.hudHPBar.fillRect(-185, -10, (hp / maxHp) * 100, 20);
        }
    }

    resize(gameSize) {
        if (!this.cameras || !this.cameras.main) return;
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setSize(width, height);
        
        if (this.ambientOverlay) this.ambientOverlay.setSize(width, height);
        
        const isNarrow = width < 550;
        const hudScale = isNarrow ? Math.min(width / 420, 1) : 1;
        
        // Margem de segurança no topo (afasta da barra de endereço/notch no mobile)
        const safeTopPadding = isNarrow ? 45 : 10;

        if (this.hudContainer) {
            this.hudContainer.setPosition(width / 2, safeTopPadding + 25);
            this.hudContainer.setScale(hudScale);
        }
        
        // Desce os botões laterais respeitando a margem de segurança
        const sideUiY = isNarrow ? safeTopPadding + 65 : safeTopPadding;

        if (this.fullscreenBtn) this.fullscreenBtn.setPosition(10, sideUiY);
        if (this.resetBtn) this.resetBtn.setPosition(10, sideUiY + 45);
        if (this.fpsText) this.fpsText.setPosition(width - 10, sideUiY);

        if (this.clockContainer) {
            const clockScale = isNarrow ? 0.75 : 1;
            this.clockContainer.setScale(clockScale);
            this.clockContainer.setPosition(width - (55 * clockScale), sideUiY + 25 + (50 * clockScale));
        }
    }

    generateIslands(gridSize, islandSize) {
        const tile = CONFIG.world.tileSize;
        const padding = tile * 2; // Exatos 2 blocos de vão de água
        const realIslandSize = islandSize - padding;
        const bridgeThickness = tile * 3; // 3 tiles para alinhar no centro perfeitamente
        const sideLength = (realIslandSize - bridgeThickness) / 2;

        // Gerar blocos físicos de água nas quinas (cruzamentos entre 4 ilhas)
        for (let gx = 0; gx < gridSize - 1; gx++) {
            for (let gy = 0; gy < gridSize - 1; gy++) {
                const cx = (gx + 1) * islandSize;
                const cy = (gy + 1) * islandSize;
                this.createWaterBlock(cx, cy, padding, padding);
            }
        }

        for (let gx = 0; gx < gridSize; gx++) {
            for (let gy = 0; gy < gridSize; gy++) {
                const x = gx * islandSize + islandSize / 2, y = gy * islandSize + islandSize / 2;
                this.add.rectangle(x, y, realIslandSize, realIslandSize, 0x2ecc71);
                this.generateResourcesOnIsland(x, y, realIslandSize, gx, gy);
                
                if (gx < gridSize - 1) this.createBridgeTrigger(x + islandSize/2, y, 'h', gx, gy, gx + 1, gy, padding, bridgeThickness, sideLength);
                if (gy < gridSize - 1) this.createBridgeTrigger(x, y + islandSize/2, 'v', gx, gy, gx, gy + 1, padding, bridgeThickness, sideLength);
            }
        }
    }

    createWaterBlock(x, y, w, h) {
        const block = this.add.zone(x, y, w, h);
        this.physics.add.existing(block, true);
        this.waterGroup.add(block);
        return block;
    }

    createBridgeTrigger(x, y, type, x1, y1, x2, y2, padding, bridgeThickness, sideLength) {
        const id = `b_${x1}_${y1}_${x2}_${y2}`;
        const tile = CONFIG.world.tileSize;
        
        // Criar a água das bordas (onde a ponte não chega e o jogador cai se tentar pular a ponte)
        if (type === 'h') {
            this.createWaterBlock(x, y - bridgeThickness/2 - sideLength/2, padding, sideLength);
            this.createWaterBlock(x, y + bridgeThickness/2 + sideLength/2, padding, sideLength);
        } else {
            this.createWaterBlock(x - bridgeThickness/2 - sideLength/2, y, sideLength, padding);
            this.createWaterBlock(x + bridgeThickness/2 + sideLength/2, y, sideLength, padding);
        }

        if (this.builtBridges.includes(id)) { 
            this.drawBridge(x, y, type, padding, bridgeThickness); 
            return; 
        }

        // Criar a água do meio (que bloqueia inicialmente e será destruída quando a ponte for construída)
        const middleW = type === 'h' ? padding : bridgeThickness;
        const middleH = type === 'h' ? bridgeThickness : padding;
        const middleWater = this.createWaterBlock(x, y, middleW, middleH);
        
        // Pega a menor distância entre as duas ilhas conectadas para manter os custos simétricos
        const centerG = Math.floor(CONFIG.world.gridSize / 2);
        const dist1 = Math.abs(x1 - centerG) + Math.abs(y1 - centerG);
        const dist2 = Math.abs(x2 - centerG) + Math.abs(y2 - centerG);
        const dist = Math.min(dist1, dist2);
        const cost = Math.floor(CONFIG.world.bridgeBaseCost * Math.pow(CONFIG.world.bridgeDistanceMultiplier, dist));
        const costObj = { wood: cost };
        
        const offset = padding / 2 + tile / 2; // Coloca a área de compra perfeitamente centralizada no 1º tile da borda
        let pos1 = type === 'h' ? { px: x - offset, py: y } : { px: x, py: y - offset };
        let pos2 = type === 'h' ? { px: x + offset, py: y } : { px: x, py: y + offset };
        
        // Snap perfeitamente na grade de Tiles para as pontes
        pos1.px = Math.floor(pos1.px / tile) * tile + tile / 2;
        pos1.py = Math.floor(pos1.py / tile) * tile + tile / 2;
        pos2.px = Math.floor(pos2.px / tile) * tile + tile / 2;
        pos2.py = Math.floor(pos2.py / tile) * tile + tile / 2;

        const zones = [];
        [pos1, pos2].forEach(pos => {
            const box = this.createCraftBox(pos.px, pos.py, costObj, '🌉').setDepth(10);
            this.physics.add.existing(box, true);
            box.body.setSize(tile, tile);
            box.setData({ action: 'build_bridge', id, type, middleWater, padding, bridgeThickness, bridgeX: x, bridgeY: y });
            this.bridgeBuildZones.add(box);
            zones.push(box);
        });
        
        zones[0].setData('sibling', zones[1]);
        zones[1].setData('sibling', zones[0]);
    }

    drawBridge(x, y, type, padding, bridgeThickness) {
        const w = type === 'h' ? padding : bridgeThickness;
        const h = type === 'h' ? bridgeThickness : padding;
        const bridge = this.add.rectangle(x, y, w, h, 0x7e5109).setDepth(5);
        this.bridges.add(bridge);
    }

    isValidSpawnPosition(x, y, otherPositions = []) {
        const tile = CONFIG.world.tileSize;
        const { islandSizeInTiles } = CONFIG.world;
        const islandSize = islandSizeInTiles * tile;
        
        const rawCenter = 2 * islandSize + islandSize / 2;
        const baseX = Math.floor(rawCenter / tile) * tile + tile / 2;
        const baseY = Math.floor(rawCenter / tile) * tile + tile / 2;
        
        let isOverlapping = Phaser.Math.Distance.Between(x, y, baseX, baseY) < 100; // Protege o spawn central do jogador
        
        if (!isOverlapping) {
            for (const bConfig of Object.values(CONFIG.buildings)) {
                const bX = baseX + bConfig.offsetCol * tile;
                const bY = baseY + bConfig.offsetRow * tile;
                // Bloqueia exatamente uma área de 5x5 tiles ao redor do centro da base (o tapete é 3x3)
                if (Math.abs(x - bX) <= 2 * tile && Math.abs(y - bY) <= 2 * tile) { isOverlapping = true; break; }
            }
        }
        
        if (!isOverlapping && otherPositions.length > 0) {
            isOverlapping = otherPositions.some(pos => pos.x === x && pos.y === y);
        }
        
        return !isOverlapping;
    }

    generateResourcesOnIsland(ix, iy, size, gx, gy) {
        const tile = CONFIG.world.tileSize;
        const halfSize = size / 2 - tile; // Respeita exatamente 1 bloco de margem até a beirada da água
        const idOffset = (gx * 1000) + (gy * 100);
        
        const woodCount = this.seededRandom.between(12, 18);
        const stoneCount = this.seededRandom.between(4, 7);
        const goldCount = this.seededRandom.between(1, 2);
        
        const spawnedPositions = []; // Guarda as posições já geradas nesta ilha

        const getPos = () => {
            let cx, cy, attempts = 0, valid = false;
            do {
                const rx = ix + this.seededRandom.between(-halfSize, halfSize);
                const ry = iy + this.seededRandom.between(-halfSize, halfSize);
                
                // Snap to Grid (Pega o centro exato do Tile mais próximo)
                cx = Math.floor(rx / tile) * tile + tile / 2;
                cy = Math.floor(ry / tile) * tile + tile / 2;
                
                attempts++; // Impede loop infinito caso a ilha fique cheia
                
                valid = this.isValidSpawnPosition(cx, cy, spawnedPositions);
            } while (!valid && attempts < 100);
            
            if (!valid) return null; // Se a ilha estiver muito lotada (ex: na base), desiste e não cria o recurso
            
            spawnedPositions.push({ x: cx, y: cy }); // Trava e reserva o Tile
            
            // Adiciona um desvio aleatório para que visualmente as árvores não fiquem em linha reta
            const offset = Math.floor(tile * 0.35); // Limite de espalhamento em até 35% do tamanho do tile
            const px = cx + this.seededRandom.between(-offset, offset);
            const py = cy + this.seededRandom.between(-offset, offset);
            
            return { x: px, y: py };
        };
        
        let id = idOffset;
        for (let i = 0; i < woodCount; i++) { const p = getPos(); if (p) this.createNodeAt(this.trees, p.x, p.y, 0x27ae60, 'wood', id); id++; }
        for (let i = 0; i < stoneCount; i++) { const p = getPos(); if (p) this.createNodeAt(this.stones, p.x, p.y, 0x95a5a6, 'stone', id); id++; }
        for (let i = 0; i < goldCount; i++) { const p = getPos(); if (p) this.createNodeAt(this.goldNodes, p.x, p.y, 0xf1c40f, 'gold', id); id++; }
    }

    createNodeAt(group, x, y, color, type, id) {
        if (this.harvestedNodes.some(n => n && (n === id || n.id === id))) return;
        let visual = this.add.container(x, y);
        if (type === 'wood') {
            const tBody = this.add.rectangle(0, 10, 10, 20, 0x5c3a21).setStrokeStyle(2, 0x3e2723);
            const l1 = this.add.circle(0, -12, 16, 0x27ae60).setStrokeStyle(2, 0x1e8449);
            const l2 = this.add.circle(-12, 0, 14, 0x2ecc71).setStrokeStyle(2, 0x1e8449);
            const l3 = this.add.circle(12, 0, 14, 0x2ecc71).setStrokeStyle(2, 0x1e8449);
            const l4 = this.add.circle(0, 4, 16, 0x27ae60).setStrokeStyle(2, 0x1e8449);
            visual.add([tBody, l1, l2, l3, l4]);
        } else if (type === 'stone') {
            const s1 = this.add.circle(0, 0, 15, 0x7f8c8d).setStrokeStyle(2, 0x2c3e50);
            const s2 = this.add.circle(-10, 6, 12, 0x95a5a6).setStrokeStyle(2, 0x2c3e50);
            const s3 = this.add.circle(10, 4, 10, 0xbdc3c7).setStrokeStyle(2, 0x2c3e50);
            const s4 = this.add.circle(-2, -8, 8, 0xecf0f1).setStrokeStyle(2, 0x2c3e50);
            visual.add([s1, s2, s3, s4]);
        } else if (type === 'gold') {
            const g1 = this.add.rectangle(-6, -6, 10, 18, 0xffd700).setAngle(-25).setStrokeStyle(2, 0xc27c0e);
            const g2 = this.add.rectangle(6, -4, 12, 16, 0xffc300).setAngle(20).setStrokeStyle(2, 0xc27c0e);
            const g3 = this.add.circle(0, 6, 12, 0xf1c40f).setStrokeStyle(2, 0xc27c0e);
            const g4 = this.add.circle(-10, 6, 8, 0xf39c12).setStrokeStyle(2, 0xc27c0e);
            const g5 = this.add.circle(10, 8, 6, 0xffc300).setStrokeStyle(2, 0xc27c0e);
            visual.add([g1, g2, g3, g4, g5]);
        }
        const node = this.add.circle(x, y, type === 'gold' ? 12 : (type === 'wood' ? 20 : 18), color);
        node.setAlpha(0); // Esconde o círculo de colisão de TODOS os recursos, deixando apenas os desenhos visíveis
        
        const { islandSizeInTiles, gridSize, tileSize } = CONFIG.world;
        const islandSize = islandSizeInTiles * tileSize;
        const gx = Math.floor(x / islandSize);
        const gy = Math.floor(y / islandSize);
        const centerG = Math.floor(gridSize / 2);
        const dist = Math.abs(gx - centerG) + Math.abs(gy - centerG); // Distância da ilha central
        
        const baseMaxHp = type === 'gold' ? 10 : (type === 'wood' ? CONFIG.harvest.treeHealth : 7);
        const maxHp = Math.floor(baseMaxHp * (1 + (dist * 0.5))); // +50% de vida máxima por cada bloco de distância
        
        const hp = this.damagedNodes[id] !== undefined ? this.damagedNodes[id] : maxHp;
        node.setData({ id, hp, maxHp, type, healthBar: this.add.graphics().setDepth(800).setVisible(false), trunk: visual });
        group.add(node);
        if (hp < maxHp) this.updateHealthBar(node);
        return node;
    }


    createClock() {
        this.clockContainer = this.add.container(this.scale.width - 70, 80).setScrollFactor(0).setDepth(1001);
        this.clockBg = this.add.graphics();
        this.clockHand = this.add.graphics();
        
        this.dayText = this.add.text(-65, 0, `DIA ${this.currentDay}`, { 
            fontSize: '22px', fontStyle: 'bold', fill: '#ffffff', stroke: '#000000', strokeThickness: 4 
        }).setOrigin(1, 0.5);

        this.clockContainer.add([this.clockBg, this.clockHand, this.dayText]);
        this.drawClockBase();
    }

    drawClockBase() {
        const graphics = this.clockBg, radius = 50;
        graphics.clear().fillStyle(0x000000, 0.5).fillCircle(0, 0, radius + 5);
        const getAngle = (h) => (h / 24) * Math.PI * 2 + Math.PI; // Gira mais 90 graus (6h no Norte, 18h no Sul)
        graphics.fillStyle(0x2c3e50).slice(0, 0, radius, getAngle(CONFIG.time.nightStart), getAngle(CONFIG.time.dayStart), false).fillPath();
        graphics.fillStyle(0xf1c40f).slice(0, 0, radius, getAngle(CONFIG.time.dayStart), getAngle(CONFIG.time.afternoonStart), false).fillPath();
        graphics.fillStyle(0xe67e22).slice(0, 0, radius, getAngle(CONFIG.time.afternoonStart), getAngle(CONFIG.time.nightStart), false).fillPath();
        graphics.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, radius);
    }

    updateClockHand() {
        const angle = (this.gameTime / 24) * Math.PI * 2 + Math.PI;
        this.clockHand.clear().lineStyle(4, 0xffffff, 1).lineBetween(0, 0, Math.cos(angle) * 45, Math.sin(angle) * 45).fillStyle(0xffffff, 1).fillCircle(0, 0, 5);
    }

    spawnEnemy() {
        if (this.currentPhase !== 'night' || this.isDead) return;
        
        const tile = CONFIG.world.tileSize;
        const { islandSizeInTiles } = CONFIG.world;
        const islandSize = islandSizeInTiles * tile;
        const gx = Math.floor(this.player.x / islandSize);
        const gy = Math.floor(this.player.y / islandSize);
        
        // Conta quantos inimigos estão atualmente na MESMA ilha do jogador
        let enemiesOnIsland = 0;
        this.enemies.children.iterate(e => {
            if (e && e.active) {
                if (Math.floor(e.x / islandSize) === gx && Math.floor(e.y / islandSize) === gy) enemiesOnIsland++;
            }
        });

        if (enemiesOnIsland >= CONFIG.enemies.maxPerIsland) return;

        // Limites de geração dentro do "quadrado verde" da ilha (descontando o tamanho da água/padding)
        const minX = gx * islandSize + tile, maxX = (gx + 1) * islandSize - tile;
        const minY = gy * islandSize + tile, maxY = (gy + 1) * islandSize - tile;
        const rx = Phaser.Math.Between(minX, maxX - 1), ry = Phaser.Math.Between(minY, maxY - 1);
        
        // Snap to Grid lógico
        const cx = Math.floor(rx / tile) * tile + tile / 2;
        const cy = Math.floor(ry / tile) * tile + tile / 2;

        // Evita gerar exatamente onde o jogador está pisando no momento ou nas zonas seguras da base
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) < 100 || !this.isValidSpawnPosition(cx, cy)) return;
        
        // Desvio aleatório visual dentro do próprio tile
        const offset = Math.floor(tile * 0.35);
        const x = cx + Phaser.Math.Between(-offset, offset);
        const y = cy + Phaser.Math.Between(-offset, offset);
        
        this.spawnParticles.explode(20, x, y);
        
        // Atraso de 600ms para dar tempo da partícula explodir antes do inimigo pisar no mapa
        this.time.delayedCall(600, () => {
            if (this.isDead || this.currentPhase !== 'night') return;
            const enemy = this.add.circle(x, y, 12, 0xe74c3c).setDepth(90);
            this.physics.add.existing(enemy); enemy.body.setCircle(12);
            const maxHp = Math.floor(CONFIG.enemies.health * Math.pow(CONFIG.enemies.healthMultiplier, this.currentDay - 1));
            enemy.setData({ hp: maxHp, maxHp: maxHp, healthBar: this.add.graphics().setDepth(800).setVisible(false) });
            this.enemies.add(enemy);
        });
    }

    handleEnemyPlayerCollision(player, enemy) {
        if (this.isInvincible) return;
        const baseDmg = Math.floor(CONFIG.enemies.damage * Math.pow(CONFIG.enemies.damageMultiplier, this.currentDay - 1));
        const dmg = Math.max(2, baseDmg - (this.tools.defenseLvl - 1) * 2);
        let hp = player.getData('hp') - dmg; player.setData('hp', hp);
        this.updateHUD(); this.showFloatingText(player.x, player.y - 30, `-${dmg} HP`, '#ff0000');
        this.isInvincible = true;
        this.tweens.add({ targets: this.playerGraphics, alpha: 0.3, duration: 100, yoyo: true, repeat: (CONFIG.player.invincibilityDuration / 200) - 1, onComplete: () => { this.isInvincible = false; this.playerGraphics.setAlpha(1); } });
        if (hp <= 0) this.triggerDeath();
    }

    handleCombat(time) {
        if (time <= this.lastHarvestTime + CONFIG.harvest.cooldown) return false;
        let closest = null, minD = CONFIG.player.interactionRadius;
        this.enemies.children.iterate(enemy => {
            if (enemy && enemy.active) {
                const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                if (d < minD) { minD = d; closest = enemy; }
            }
        });
        if (closest) {
            this.attackEnemy(closest); this.playAttackAnimation(); this.lastHarvestTime = time; return true;
        }
        return false;
    }

    attackEnemy(enemy) {
        const dmg = CONFIG.player.damage + ((this.tools.weaponLvl - 1) * 5); // Escala +5 de dano por cada nível da arma
        let hp = enemy.getData('hp') - dmg; enemy.setData('hp', hp);
        this.updateHealthBar(enemy); this.showFloatingText(enemy.x, enemy.y - 20, `-${dmg} HP`, '#e74c3c');
        this.tweens.add({ targets: enemy, scale: 1.3, duration: 100, yoyo: true });
        if (hp <= 0) this.killEnemy(enemy);
    }

    killEnemy(enemy) {
        this.deathParticles.explode(15, enemy.x, enemy.y);
        if (enemy.getData('healthBar')) enemy.getData('healthBar').destroy();
        this.gainResource('gold', 1);
        enemy.destroy();
    }

    update(time, delta) {
        if (this.isDead) return;
        this.handleRespawns();
        this.cullObjects(); // Sistema de otimização de renderização (Chunks visuais)
        
        const previousTime = this.gameTime;
        this.gameTime = (this.gameTime + delta / CONFIG.time.hourDuration) % 24;
        if (previousTime < CONFIG.time.dayStart && this.gameTime >= CONFIG.time.dayStart) { // Amanheceu
            this.currentDay++;
            if (this.dayText) this.dayText.setText(`DIA ${this.currentDay}`);
        }
        
        const h = this.gameTime;
        
        let nextPhase = 'day';
        if (h >= CONFIG.time.nightStart || h < CONFIG.time.dayStart) nextPhase = 'night';
        else if (h >= CONFIG.time.afternoonStart) nextPhase = 'afternoon';

        if (this.currentPhase !== nextPhase) {
            if (nextPhase === 'day' && this.currentPhase === 'night') {
                const list = []; this.enemies.children.iterate(e => { if(e) list.push(e); });
                list.forEach(e => this.killEnemy(e));
            }
            this.currentPhase = nextPhase;
            this.applyAtmosphere(this.currentPhase);
        }
        
        this.updateClockHand(); this.handleMovement(); this.drawPlayerExtras();
        this.enemies.children.iterate(e => { if(e && e.active) { this.physics.moveToObject(e, this.player, CONFIG.enemies.speed); this.updateHealthBar(e); }});
        [this.trees, this.stones, this.goldNodes].forEach(g => g.children.iterate(n => { if(n && n.active && n.getData('healthBar').visible) this.updateHealthBar(n); }));
        
        if (this.canPlayerInteract()) {
            if (!this.handleCombat(time))
                if (!this.handleCraftingInteraction(time, delta))
                    this.handleHarvesting(time);
        } else {
            this.cancelCrafting(delta);
        }
        if (this.keys.K.isDown) this.triggerDeath();
        if (time > this.lastSaveTime + this.saveInterval) { this.saveGame(); this.lastSaveTime = time; }
        
        // Lógica de cura constante caso o jogador esteja na zona do Santuário
        const tile = CONFIG.world.tileSize;
        const healerConfig = CONFIG.buildings.healer;
        if (this.buildingsBuilt.healer && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.buildingContainers.healer.x, this.buildingContainers.healer.y) < tile * 1.5) {
            if (time > this.lastHealTime + healerConfig.healInterval) {
                const hp = this.player.getData('hp');
                const maxHp = this.player.getData('maxHp');
                if (hp < maxHp) {
                    const healAmount = healerConfig.baseHealAmount * this.tools.healerLvl;
                    this.player.setData('hp', Math.min(maxHp, hp + healAmount));
                    this.updateHUD();
                    this.showFloatingText(this.player.x, this.player.y - 30, `+${healAmount} HP`, '#2ecc71');
                }
                this.lastHealTime = time;
            }
        }
        
        if (this.fpsText) {
            this.fpsText.setText('FPS: ' + Math.round(this.game.loop.actualFps));
        }
    }

    canPlayerInteract() {
        if (CONFIG.player.canInteractWhileMoving) return true;
        return Math.abs(this.player.body.velocity.x) < 0.1 && Math.abs(this.player.body.velocity.y) < 0.1;
    }

    cullObjects() {
        const cam = this.cameras.main;
        // Cria uma caixa de visão ao redor da tela atual, com 300 pixels de margem de segurança
        const viewBounds = new Phaser.Geom.Rectangle(cam.scrollX - 300, cam.scrollY - 300, cam.width + 600, cam.height + 600);

        const cullNode = (node) => {
            if (node && node.active) {
                const isVisible = viewBounds.contains(node.x, node.y);
                
                const visual = node.getData('trunk');
                if (visual && visual.visible !== isVisible) visual.setVisible(isVisible);
                
                const hBar = node.getData('healthBar');
                if (hBar) {
                    const shouldShow = isVisible && node.getData('hp') < node.getData('maxHp');
                    if (hBar.visible !== shouldShow) hBar.setVisible(shouldShow);
                }
            }
        };

        this.trees.children.iterate(cullNode);
        this.stones.children.iterate(cullNode);
        this.goldNodes.children.iterate(cullNode);
    }

    handleRespawns() {
        const now = Date.now();
        for (let i = this.harvestedNodes.length - 1; i >= 0; i--) {
            const data = this.harvestedNodes[i];
            if (!data || typeof data !== 'object') continue;
            
            const remaining = Math.ceil((data.respawnAt - now) / 1000);
            const textObj = this.respawnTexts.get(data.id);
            
            if (remaining <= 0) {
                const group = data.type === 'gold' ? this.goldNodes : (data.type === 'wood' ? this.trees : this.stones);
                this.harvestedNodes.splice(i, 1);
                const newNode = this.createNodeAt(group, data.x, data.y, data.color, data.type, data.id);
                if (newNode) {
                    newNode.setScale(0);
                    this.tweens.add({ targets: newNode, scale: 1, duration: 500, ease: 'Back.out' });
                    if (newNode.getData('trunk')) {
                        newNode.getData('trunk').setScale(0);
                        this.tweens.add({ targets: newNode.getData('trunk'), scale: 1, duration: 500, ease: 'Back.out' });
                    }
                }
                if (textObj) {
                    textObj.destroy();
                    this.respawnTexts.delete(data.id);
                }
            } else if (textObj) {
                textObj.setText(`${remaining}s`);
            }
        }
    }

    applyAtmosphere(phase, instant = false) {
        let targetColor, targetAlpha, targetLightScale;
        if (phase === 'day') {
            targetColor = 0x000000; targetAlpha = 0; targetLightScale = 0;
        } else if (phase === 'afternoon') {
            targetColor = 0xd35400; targetAlpha = 0.15; targetLightScale = 0; // Tintura alaranjada bem sutil
        } else if (phase === 'night') {
            targetColor = 0x000000; targetAlpha = 0.92; targetLightScale = 1; // Quase breu total com luz 100% ativada
        }
        
        this.ambientColor = targetColor;

        if (instant) {
            this.ambientAlpha = targetAlpha;
            this.lightScale = targetLightScale;
        } else {
            this.tweens.add({ targets: this, ambientAlpha: targetAlpha, lightScale: targetLightScale, duration: 4000 });
        }
    }

    triggerDeath() {
        if (this.isDead) return;
        this.isDead = true; 
        this.player.setVelocity(0); 
        
        if (this.joystickActive) {
            this.joystickActive = false;
            this.joystickBase.setVisible(false);
            this.joystickThumb.setVisible(false);
            this.joystickVector.set(0, 0);
        }

        const cam = this.cameras.main;
        this.deathContainer = this.add.container(cam.width / 2, cam.height / 2).setDepth(3000).setScrollFactor(0);
        
        const bg = this.add.rectangle(0, 0, cam.width * 2, cam.height * 2, 0x000000, 0.8);
        const text = this.add.text(0, 0, 'VOCÊ DESMAIOU...\nClique na tela para continuar', { 
            fontSize: '24px', fontStyle: 'bold', fill: '#e74c3c', align: 'center', stroke: '#000000', strokeThickness: 4 
        }).setOrigin(0.5);
        
        this.deathContainer.add([bg, text]);

        this.time.delayedCall(500, () => {
            this.input.once('pointerdown', this.respawnPlayer, this);
        });
    }

    respawnPlayer() {
        if (this.deathContainer) {
            this.deathContainer.destroy();
        }

        const tile = CONFIG.world.tileSize;
        const { islandSizeInTiles } = CONFIG.world;
        const islandSize = islandSizeInTiles * tile;
        const rawCenter = 2 * islandSize + islandSize / 2;
        const baseX = Math.floor(rawCenter / tile) * tile + tile / 2;
        const baseY = Math.floor(rawCenter / tile) * tile + tile / 2;

        this.player.setPosition(baseX, baseY);
        this.player.setData('hp', this.player.getData('maxHp'));
        this.updateHUD();
        this.isInvincible = false;
        this.playerGraphics.setAlpha(1);
        
        // Mata inimigos existentes silenciosamente para um renascimento seguro
        const enemiesToKill = [];
        this.enemies.children.iterate(e => { if(e) enemiesToKill.push(e); });
        enemiesToKill.forEach(e => {
            if (e.getData('healthBar')) e.getData('healthBar').destroy();
            e.destroy();
        });

        this.isDead = false;
    }

    restartGame() { document.getElementById('game-over').style.display = 'none'; this.isDead = false; this.scene.restart(); }

    createVirtualJoystick() {
        this.joystickBase = this.add.circle(0, 0, 50, 0x888888, 0.4).setDepth(2000).setScrollFactor(0).setVisible(false);
        this.joystickThumb = this.add.circle(0, 0, 25, 0xcccccc, 0.7).setDepth(2001).setScrollFactor(0).setVisible(false);
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickVector = new Phaser.Math.Vector2(0, 0);

        this.input.on('pointerdown', (pointer, gameObjects) => {
            if (this.isDead) return;
            // Impede a ativação do joystick caso você toque em um botão da HUD (ex: Reset)
            if (gameObjects.length > 0) return; 
            
            this.joystickActive = true;
            this.joystickPointerId = pointer.id;
            this.joystickBase.setPosition(pointer.x, pointer.y).setVisible(true);
            this.joystickThumb.setPosition(pointer.x, pointer.y).setVisible(true);
            this.joystickVector.set(0, 0);
        });

        this.input.on('pointermove', (pointer) => {
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                const dist = Phaser.Math.Distance.Between(this.joystickBase.x, this.joystickBase.y, pointer.x, pointer.y);
                const angle = Phaser.Math.Angle.Between(this.joystickBase.x, this.joystickBase.y, pointer.x, pointer.y);
                const maxDist = 50;
                
                let thumbX = pointer.x;
                let thumbY = pointer.y;

                if (dist > maxDist) {
                    thumbX = this.joystickBase.x + Math.cos(angle) * maxDist;
                    thumbY = this.joystickBase.y + Math.sin(angle) * maxDist;
                }

                this.joystickThumb.setPosition(thumbX, thumbY);
                this.joystickVector.x = (thumbX - this.joystickBase.x) / maxDist;
                this.joystickVector.y = (thumbY - this.joystickBase.y) / maxDist;
            }
        });

        const stopJoystick = (pointer) => {
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.joystickActive = false;
                this.joystickPointerId = null;
                this.joystickBase.setVisible(false);
                this.joystickThumb.setVisible(false);
                this.joystickVector.set(0, 0);
            }
        };

        this.input.on('pointerup', stopJoystick);
        this.input.on('pointerupoutside', stopJoystick);
    }

    handleHarvesting(time) {
        if (this.currentPhase === 'night') return false; // Impede coleta de recursos durante a noite
        if (time <= this.lastHarvestTime + CONFIG.harvest.cooldown) return false;
        let closest = null, minD = CONFIG.player.interactionRadius;
        [this.trees, this.stones, this.goldNodes].forEach(group => {
            group.children.iterate(node => {
                if (node && node.active) {
                    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
                    if (d < minD) { minD = d; closest = node; }
                }
            });
        });
        if (closest) {
            this.harvestNode(closest); this.playAttackAnimation(); this.lastHarvestTime = time; return true;
        }
        return false;
    }

    harvestNode(node) {
        const type = node.getData('type');
        const id = node.getData('id');
        const toolLvl = type === 'wood' ? this.tools.axeLvl : this.tools.pickaxeLvl;
        
        const currentHp = node.getData('hp');
        const actualDamage = Math.min(currentHp, toolLvl);
        let hp = currentHp - actualDamage;
        node.setData('hp', hp);
        this.damagedNodes[id] = hp;
        this.updateHealthBar(node);
        
        const gain = CONFIG.harvest.amount * actualDamage;
        this.gainResource(type, gain);

        if (hp <= 0) {
            delete this.damagedNodes[id];
            if (node.getData('healthBar')) node.getData('healthBar').destroy();
            if (node.getData('trunk')) node.getData('trunk').destroy();
            
            const dataToSave = { id, x: node.x, y: node.y, type, color: node.fillColor, respawnAt: Date.now() + CONFIG.harvest.respawnTime };
            this.harvestedNodes.push(dataToSave);
            
            const textObj = this.add.text(node.x, node.y, Math.ceil(CONFIG.harvest.respawnTime/1000) + 's', { fontSize: '14px', fontStyle: 'bold', fill: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(150);
            this.respawnTexts.set(id, textObj);
            
            node.destroy();
        }
        this.updateHUD();
        this.tweens.add({ targets: node, scale: 1.2, duration: 100, yoyo: true });
        if (node.getData('trunk')) this.tweens.add({ targets: node.getData('trunk'), scale: 1.2, duration: 100, yoyo: true });
    }

    playAttackAnimation() { this.tweens.add({ targets: this.mace, angle: 360, duration: 300, onComplete: () => { if(this.mace) this.mace.angle = 0; } }); }
    showFloatingText(x, y, text, color = '#ffffff') {
        const ox = Phaser.Math.Between(-10, 10); // Offset aleatório para não sobrepor números
        const oy = Phaser.Math.Between(-10, 10);
        const txt = this.add.text(x + ox, y + oy, text, { fontSize: '18px', fontStyle: 'bold', fill: color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(160);
        this.tweens.add({ targets: txt, y: y + oy - 50, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
    }

    updateHealthBar(target) {
        const bar = target.getData('healthBar'); if (!bar) return;
        const hp = target.getData('hp'), maxHp = target.getData('maxHp');
        bar.clear().setVisible(true).fillStyle(0x000000, 0.5).fillRect(target.x - 20, target.y - 35, 40, 5).fillStyle(0xff0000, 1).fillRect(target.x - 20, target.y - 35, Math.max(0, (hp / maxHp) * 40), 5);
    }

    // --- GERENCIAMENTO DE RECURSOS E CRAFTING ---
    canAfford(cost) {
        const w = cost.wood || 0, s = cost.stone || 0, g = cost.gold || 0;
        return this.resources.wood >= w && this.resources.stone >= s && this.resources.gold >= g;
    }

    payCost(cost) {
        const w = cost.wood || 0, s = cost.stone || 0, g = cost.gold || 0;
        this.resources.wood -= w; this.resources.stone -= s; this.resources.gold -= g;
        this.updateHUD();
        let texts = [];
        if (w > 0) texts.push(`-${w}🪵`);
        if (s > 0) texts.push(`-${s}🪨`);
        if (g > 0) texts.push(`-${g}💰`);
        if (texts.length > 0) this.showFloatingText(this.player.x, this.player.y - 30, texts.join(' '), '#e74c3c');
    }

    gainResource(type, amount) {
        this.resources[type] += amount;
        this.updateHUD();
        const icon = type === 'wood' ? '🪵' : (type === 'stone' ? '🪨' : '💰');
        this.showFloatingText(this.player.x, this.player.y - 30, `+${amount} ${icon}`, '#2ecc71');
    }

    // Padronização da "Caixa de Construção/Craft" (Blueprint/Gift Box)
    // Uma caixa visual que exige recursos e executa uma ação (Pontes, Base, Upgrades)
    createCraftBox(x, y, cost, titleIcon) {
        const tile = CONFIG.world.tileSize;
        const boxSize = tile; // Ocupa exatamente 1 tile
        const container = this.add.container(x, y);
        const progressBar = this.add.rectangle(0, boxSize / 2, boxSize, boxSize, CONFIG.crafting.confirmationColor).setOrigin(0.5, 1).setScale(1, 0);
        const bg = this.add.rectangle(0, 0, boxSize, boxSize, 0x34495e, 0.9).setStrokeStyle(2, 0xbdc3c7);
        const flash = this.add.rectangle(0, 0, boxSize, boxSize, 0xe74c3c).setAlpha(0); // Quadrado de erro vermelho
        let costStr = [];
        if (cost.wood) costStr.push(`${cost.wood}🪵`);
        if (cost.stone) costStr.push(`${cost.stone}🪨`);
        if (cost.gold) costStr.push(`${cost.gold}💰`);
        const icon = this.add.text(0, -boxSize/4, titleIcon, { fontSize: `${Math.floor(boxSize * 0.35)}px` }).setOrigin(0.5);
        const txtCost = this.add.text(0, boxSize/4, costStr.join('\n'), { fontSize: `${Math.max(10, Math.floor(boxSize * 0.15))}px`, color: '#fff', stroke: '#000', strokeThickness: 3, align: 'center' }).setOrigin(0.5);
        container.add([bg, progressBar, flash, icon, txtCost]);
        container.setData('cost', cost);
        container.setData('flash', flash);
        container.setData('progressBar', progressBar);
        return container;
    }

    refreshBuildingUI(id) {
        const bConfig = CONFIG.buildings[id];
        const container = this.buildingContainers[id];
        container.removeAll(true);
        
        if (!this.buildingsBuilt[id]) {
            const box = this.createCraftBox(0, 0, bConfig.cost, bConfig.icon);
            box.setData('action', `build_${id}`);
            container.add(box);
        } else {
            const tile = CONFIG.world.tileSize;
            
            const floor = this.add.rectangle(0, 0, tile * 3, tile * 3, bConfig.floorColor).setStrokeStyle(4, bConfig.floorStroke);
            container.add(floor);
            
            // O retângulo central foi removido conforme solicitado
            
            bConfig.upgrades.forEach(slot => {
                const cost = this.calculateUpgradeCost(this.tools[`${slot.id}Lvl`]);
                const box = this.createCraftBox(slot.col * tile, slot.row * tile, cost, slot.icon);
                box.setData('action', `upgrade_${slot.id}`);
                box.setData('buildingId', id); // Usado para saber qual atualizar depois da compra
                container.add(box);
            });
        }
    }

    calculateUpgradeCost(lvl) {
        const m = Math.pow(CONFIG.upgrades.multiplier, lvl - 1);
        return { wood: Math.floor(CONFIG.upgrades.initialCost.wood * m), stone: Math.floor(CONFIG.upgrades.initialCost.stone * (lvl > 1 ? m : 0)), gold: Math.floor(CONFIG.upgrades.initialCost.gold * (lvl > 2 ? m : 0)) };
    }

    cancelCrafting(delta) {
        if (this.activeCraftTarget) {
            this.craftCharge = Math.max(0, this.craftCharge - (delta * CONFIG.crafting.cancelSpeedMultiplier));
            const progress = this.craftCharge / CONFIG.crafting.confirmationTime;
            const pb = this.activeCraftTarget.getData('progressBar');
            if (pb && pb.active) pb.scaleY = progress;
            if (this.craftCharge === 0) {
                this.activeCraftTarget = null;
            }
        }
    }

    handleCraftingInteraction(time, delta) {
        if (time < this.lastHarvestTime + 500) return false;

        const tile = CONFIG.world.tileSize;
        const interactionDist = tile * 0.8;

        const allCraftBoxes = [
            ...this.bridgeBuildZones.getChildren(),
            ...Object.values(this.buildingContainers).flatMap(c => c.list.filter(i => i.getData && i.getData('action')))
        ];

        let closest = null;
        let minD = interactionDist;

        allCraftBoxes.forEach(box => {
            if (!box.active) return;
            const bx = box.parentContainer ? box.parentContainer.x + box.x : box.x;
            const by = box.parentContainer ? box.parentContainer.y + box.y : box.y;
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by);
            if (d < minD) {
                minD = d;
                closest = box;
            }
        });

        if (closest) {
            if (this.canAfford(closest.getData('cost'))) {
                if (closest !== this.activeCraftTarget) {
                    if (this.activeCraftTarget) {
                        const oldPb = this.activeCraftTarget.getData('progressBar');
                        if (oldPb && oldPb.active) oldPb.scaleY = 0;
                    }
                    this.craftCharge = 0;
                    this.activeCraftTarget = closest;
                }

                this.craftCharge = Math.min(this.craftCharge + delta, CONFIG.crafting.confirmationTime);
                const pb = this.activeCraftTarget.getData('progressBar');
                if (pb && pb.active) pb.scaleY = this.craftCharge / CONFIG.crafting.confirmationTime;

                if (this.craftCharge >= CONFIG.crafting.confirmationTime) {
                    this.payCost(closest.getData('cost'));
                    const action = closest.getData('action');

                    if (action === 'build_bridge') {
                        this.builtBridges.push(closest.getData('id'));
                        this.drawBridge(closest.getData('bridgeX'), closest.getData('bridgeY'), closest.getData('type'), closest.getData('padding'), closest.getData('bridgeThickness'));
                        
                        const middleWater = closest.getData('middleWater');
                        if (middleWater) middleWater.destroy();
                        
                        const sibling = closest.getData('sibling');
                        if (sibling) sibling.destroy();
                        closest.destroy();
                    } else if (action.startsWith('build_')) {
                        const id = action.replace('build_', '');
                        this.buildingsBuilt[id] = true; this.refreshBuildingUI(id); this.showFloatingText(this.player.x, this.player.y - 50, CONFIG.buildings[id].name, '#2ecc71');
                    } else if (action.startsWith('upgrade_')) {
                        const type = action.replace('upgrade_', '');
                        this.tools[`${type}Lvl`]++; this.refreshBuildingUI(closest.getData('buildingId')); this.showFloatingText(this.player.x, this.player.y - 50, `UPGRADE!`, '#f1c40f');
                    }

                    this.craftCharge = 0;
                    this.activeCraftTarget = null;
                    this.lastHarvestTime = time;
                    return true;
                }
            } else {
                this.cancelCrafting(delta);
                const flash = closest.getData('flash');
                if (flash && flash.alpha === 0) {
                    flash.setAlpha(0.8);
                    this.tweens.add({ targets: flash, alpha: 0, duration: 400 });
                    this.lastHarvestTime = time;
                    return true;
                }
            }
        } else {
            this.cancelCrafting(delta);
        }

        return false;
    }

    handleMovement() {
        let vx = 0, vy = 0;
        if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
        if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
        if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
        if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
        
        if (this.joystickActive) {
            vx += this.joystickVector.x;
            vy += this.joystickVector.y;
        }

        if (vx !== 0 || vy !== 0) {
            const length = Math.sqrt(vx * vx + vy * vy);
            const normLength = Math.min(length, 1); // Garante que a combinação entre teclado + joystick não passe do multiplicador máximo (1)
            vx = (vx / length) * normLength * CONFIG.player.speed;
            vy = (vy / length) * normLength * CONFIG.player.speed;
        }
        this.player.setVelocity(vx, vy);
    }

    drawPlayerExtras() {
        this.playerGraphics.setPosition(this.player.x, this.player.y);
        this.interactionCircle.clear().lineStyle(2, 0xffffff, 0.3).fillStyle(0xffffff, 0.1).fillCircle(this.player.x, this.player.y, CONFIG.player.interactionRadius).strokeCircle(this.player.x, this.player.y, CONFIG.player.interactionRadius);
        
        const cam = this.cameras.main;
        this.ambientOverlay.clear();
        if (this.ambientAlpha > 0) {
            // Preenche a tela com a cor e opacidade atual (O Breu)
            this.ambientOverlay.fill(this.ambientColor, this.ambientAlpha);
            
            // "Apaga" a escuridão usando o nosso pincel com o gradiente suave (Vignette Mask)
            if (this.lightScale > 0) {
                const radius = (this.lightRadius + this.pulseOffset) * this.lightScale;
                this.lightBrush.setPosition(this.player.x - cam.scrollX, this.player.y - cam.scrollY);
                this.lightBrush.setScale(radius / this.brushRadius);
                this.ambientOverlay.erase(this.lightBrush);
            }
        }
    }
}
