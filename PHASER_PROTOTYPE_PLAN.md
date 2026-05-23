# Phaser Top-Down Prototype Plan (Modular)

## Overview
A 2D top-down gameplay prototype with a modular file structure for better organization.

## Tech Stack
- **Engine:** Phaser 3 (via CDN)
- **Architecture:** ES6 Modules

## Directory Structure
```
/
├── index.html          # Entry point
├── style.css           # Styling for HUD and Game Container
├── js/
│   ├── main.js         # Phaser Game initialization
│   ├── config.js       # Game constants and configuration
│   └── scenes/
│       └── Gameplay.js # Main gameplay logic
└── assets/             # (Placeholder for future assets)
```

## Core Features
1.  **Movement:** WASD + Arrow keys.
2.  **Interaction Circle:** Semi-transparent melee/interaction range.
3.  **Harvesting:** Automatic wood cutting when near trees (proximity-based).
4.  **HUD:** Displays Wood, Stone, and Gold with icons.
5.  **Configuration (`js/config.js`):**
    - `PLAYER_SPEED`: Pixels per second.
    - `INTERACTION_RADIUS`: Range of the circle.
    - `HARVEST_COOLDOWN`: Time between harvest ticks.
    - `HARVEST_AMOUNT`: Wood gained per tick.

## Visual Implementation
- **Procedural Graphics:** Use Phaser's Graphics object to draw the player (blue), trees (green), and interaction circle.
- **HUD:** HTML/CSS overlay for a clean look.

## Validation Strategy
- Confirm all modules load correctly via `index.html`.
- Test movement and collision logic.
- Verify harvest timing and resource updates in the HUD.
