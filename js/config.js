// Helper para converter "Frames" em Milissegundos (Assumindo base de 60 FPS)
// Exemplo: f(60) = 1 segundo | f(30) = meio segundo
const f = (frames) => Math.floor(frames * (1000 / 60));

export const CONFIG = {
    player: {
        speed: 220,
        interactionRadius: 100,
        damage: 10, // Dano base da arma
        invincibilityDuration: f(60), // 60 frames = 1 segundo
        canInteractWhileMoving: true // Permite atacar/interagir em movimento
    },
    light: {
        radius: 220,
        pulseIntensity: 5,
        pulseDuration: f(9) // 9 frames = ~150ms
    },
    harvest: {
        cooldown: f(45), // 60 frames = 1 segundo
        amount: 1,
        treeHealth: 5,
        maceRotationSpeed: 200,
        respawnTime: f(1800), // 1800 frames = 30 segundos
    },
    resources: {
        wood: 0,
        stone: 0,
        gold: 0
    },
    tools: {
        axeLvl: 1,
        pickaxeLvl: 1,
        weaponLvl: 1,
        defenseLvl: 1,
        healerLvl: 1 // Nível da barraca de cura
    },
    buildings: {
        workbench: {
            cost: { wood: 10, stone: 0, gold: 0 },
            offsetCol: -2, offsetRow: -2,
            icon: '🪚', name: 'WORKBENCH!',
            color: 0x7e5109, floorColor: 0x5D4037, floorStroke: 0x3E2723,
            upgrades: [
                { id: 'axe', col: -1, row: 0, icon: '🪓' },
                { id: 'pickaxe', col: 1, row: 0, icon: '⛏️' }
            ]
        },
        armory: {
            cost: { wood: 15, stone: 10, gold: 0 },
            offsetCol: 2, offsetRow: -2,
            icon: '🛡️', name: 'ARMORY!',
            color: 0x34495e, floorColor: 0x37474F, floorStroke: 0x263238,
            upgrades: [
                { id: 'weapon', col: -1, row: 0, icon: '⚔️' },
                { id: 'defense', col: 1, row: 0, icon: '🛡️' }
            ]
        },
        healer: {
            cost: { wood: 20, stone: 15, gold: 5 },
            offsetCol: 0, offsetRow: 1,
            icon: '❤️', name: 'SANTUÁRIO!',
            color: null, floorColor: 0x1e8449, floorStroke: 0x145a32,
            healInterval: f(180), // 180 frames = 3 segundos
            baseHealAmount: 1,
            healMultiplier: 1, // Multiplica a cura a cada nível
            upgrades: [
                { id: 'healer', col: 0, row: 0, icon: '💖' }
            ]
        }
    },
    upgrades: {
        initialCost: { wood: 5, stone: 2, gold: 0 },
        multiplier: 1.5
    },
    crafting: {
        confirmationTime: f(30), // 60 frames = 1 segundo
        confirmationColor: 0x2ecc71, // verde
        cancelSpeedMultiplier: 4 // O quão mais rápido a barra desce
    },
    world: {
        seed: 1,
        harvestedNodes: [], // IDs dos nós destruídos
        islandSizeInTiles: 13, // Ímpar, para ter um tile central perfeito
        gridSize: 5, // 5x5 ilhas
        tileSize: 96, // Tamanho base da grade para construções (Ocupa 1 Tile)
        bridgeBaseCost: 90,
        bridgeDistanceMultiplier: 5 // Multiplica o custo por 5 a cada ilha de distância
    },
    time: {
        // Cálculo: (Minutos desejados * 60 * 1000) / 24
        // Exemplo para 5 minutos: (5 * 60 * 1000) / 24 = 12500
        hourDuration: f(750), // 750 frames = 12.5 segundos
        dayStart: 6,
        afternoonStart: 10,
        nightStart: 12,
        totalHours: 24
    },
    enemies: {
        spawnRate: f(120), // 120 frames = 2 segundos
        maxPerIsland: 2, // Máximo de inimigos vivos por ilha simultaneamente
        damage: 50,
        damageMultiplier: 1.2, // Aumenta o dano em 20% a cada dia
        speed: 70,
        health: 20,
        healthMultiplier: 1.2, // Aumenta a vida em 50% a cada dia
        deathParticleColor: 0xe74c3c,
        heartDropChance: 0.3, // 30% de chance de dropar
        heartHealAmount: 20   // Quantidade de HP curado
    }
};
