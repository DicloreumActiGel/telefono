// ==========================================
// 1. VARIABILI GLOBALI E SETUP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variabili UI
const uiMapName = document.getElementById('map-name');
const uiMoney = document.getElementById('money-display');
const uiRound = document.getElementById('round-display');

// Stato del gioco
let money = 200;
let round = 1;
let enemies = [];
let towers = [];
let projectiles = [];
let waypoints = [];

// Variabili per le ondate
let enemiesToSpawn = 10;
let spawnTimer = 0;
let waveActive = true;

// Selezione della torre (1 = Soldato, 2 = Cecchino, 3 = RPG)
let selectedTowerType = 1; 

// ==========================================
// 2. CONFIGURAZIONI DELLE TORRI
// ==========================================
const TOWER_STATS = {
    1: { name: "Soldato Semplice", cost: 100, range: 150, damage: 20, fireRate: 60, color: "blue", type: "normal" },
    2: { name: "Cecchino", cost: 250, range: 300, damage: 40, fireRate: 120, color: "black", type: "pierce" },
    3: { name: "Soldato RPG", cost: 500, range: 200, damage: 50, fireRate: 150, color: "orange", type: "splash", splashRadius: 80 }
};

// ==========================================
// 3. MAPPE (Percorsi / Waypoints)
// ==========================================
const MAPS = {
    'Pianura': [ {x: 0, y: 100}, {x: 600, y: 100}, {x: 600, y: 500}, {x: 200, y: 500}, {x: 200, y: 300}, {x: 800, y: 300} ],
    'Città': [ {x: 400, y: 0}, {x: 400, y: 200}, {x: 100, y: 200}, {x: 100, y: 400}, {x: 700, y: 400}, {x: 700, y: 600} ],
    'Cimitero': [ {x: 0, y: 500}, {x: 300, y: 500}, {x: 300, y: 100}, {x: 500, y: 100}, {x: 500, y: 450}, {x: 800, y: 450} ]
};

// ==========================================
// 4. FUNZIONE DI AVVIO GIOCO (Chiamata dall'HTML)
// ==========================================
function startGame(mapName) {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    uiMapName.innerText = `Mappa: ${mapName}`;
    waypoints = MAPS[mapName];
    
    // Avvia il loop principale a 60 FPS
    requestAnimationFrame(gameLoop);
}

// ==========================================
// 5. CLASSI DEGLI OGGETTI (Nemici, Torri, Proiettili)
// ==========================================
class Enemy {
    constructor() {
        this.x = waypoints[0].x;
        this.y = waypoints[0].y;
        this.waypointIndex = 1;
        this.speed = 1.5 + (round * 0.1); // Diventano un po' più veloci ogni round
        this.hp = 50 + (round * 20);      // Più vita ogni round
        this.maxHp = this.hp;
        this.radius = 15; // Dimensione del placeholder
    }

    move() {
        const target = waypoints[this.waypointIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < this.speed) {
            this.x = target.x;
            this.y = target.y;
            this.waypointIndex++;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    draw() {
        // TODO: In futuro sostituisci questo blocco con ctx.drawImage(tuoZombieSprite, this.x, this.y, ...)
        ctx.fillStyle = "green"; // Placeholder Zombie
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Barra della vita
        ctx.fillStyle = "red";
        ctx.fillRect(this.x - 15, this.y - 25, 30, 5);
        ctx.fillStyle = "lime";
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp / this.maxHp), 5);
    }
}

class Tower {
    constructor(x, y, typeIndex) {
        this.x = x;
        this.y = y;
        this.stats = TOWER_STATS[typeIndex];
        this.cooldown = 0;
        this.size = 30; // Dimensione del placeholder
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;

        if (this.cooldown === 0) {
            // Trova il nemico più vicino nel raggio d'azione
            let target = null;
            let minDistance = Infinity;

            for (let enemy of enemies) {
                let dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist <= this.stats.range && dist < minDistance) {
                    minDistance = dist;
                    target = enemy;
                }
            }

            if (target) {
                this.shoot(target);
                this.cooldown = this.stats.fireRate;
            }
        }
    }

    shoot(target) {
        projectiles.push(new Projectile(this.x, this.y, target, this.stats));
    }

    draw() {
        // TODO: Qui metterai ctx.drawImage(spriteTorre...)
        ctx.fillStyle = this.stats.color; // Placeholder Torre
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        
        // Disegna una piccola canna del fucile
        ctx.fillStyle = "gray";
        ctx.fillRect(this.x, this.y - 5, 20, 10);
    }
}

class Projectile {
    constructor(x, y, target, towerStats) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.stats = towerStats;
        this.speed = 8;
        this.hitEnemies = []; // Per tenere traccia dei nemici già colpiti dal Cecchino
    }

    move() {
        // Se il bersaglio originale muore prima di essere colpito, il proiettile va dritto
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);

        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
    }

    draw() {
        // TODO: Sostituire con sprite del proiettile
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// 6. CONTROLLI DEL GIOCATORE
// ==========================================

// Cambia torre con i tasti 1, 2, 3
document.addEventListener('keydown', (e) => {
    if (e.key === '1') selectedTowerType = 1;
    if (e.key === '2') selectedTowerType = 2;
    if (e.key === '3') selectedTowerType = 3;
});

// Piazza la torre cliccando sul Canvas
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const cost = TOWER_STATS[selectedTowerType].cost;

    if (money >= cost) {
        towers.push(new Tower(mouseX, mouseY, selectedTowerType));
        money -= cost;
        updateUI();
    }
});

// ==========================================
// 7. GESTIONE COLLISIONI E LOGICA ONDATE
// ==========================================
function updateUI() {
    uiMoney.innerText = `Monete: ${money}`;
    uiRound.innerText = `Round: ${round}`;
}

function handleWaves() {
    if (waveActive) {
        spawnTimer++;
        if (spawnTimer > 100 && enemiesToSpawn > 0) {
            enemies.push(new Enemy());
            enemiesToSpawn--;
            spawnTimer = 0;
        }

        // Fine del round
        if (enemiesToSpawn === 0 && enemies.length === 0) {
            waveActive = false;
            money += 100; // Bonus fine round
            round++;
            enemiesToSpawn = 10 + (round * 5); // Aumenta il numero di nemici
            updateUI();
            
            // Pausa di 3 secondi prima del round successivo
            setTimeout(() => { waveActive = true; }, 3000);
        }
    }
}

// ==========================================
// 8. LOOP PRINCIPALE DEL GIOCO
// ==========================================
function gameLoop() {
    // 1. Pulisci lo schermo
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Disegna il percorso (Path)
    ctx.strokeStyle = "#5a4d41";
    ctx.lineWidth = 40;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();

    // Mostra la torre selezionata (UI In-Game)
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(`Torre Selezionata: ${TOWER_STATS[selectedTowerType].name} (Costo: ${TOWER_STATS[selectedTowerType].cost}) - Premi 1, 2 o 3 per cambiare`, 10, 25);

    handleWaves();

    // 3. Aggiorna e disegna Torri
    towers.forEach(tower => {
        tower.update();
        tower.draw();
    });

    // 4. Aggiorna e disegna Nemici
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.move();
        e.draw();

        // Se arriva alla fine del percorso, eliminalo (potresti togliere vite al giocatore in futuro)
        if (e.waypointIndex >= waypoints.length) {
            enemies.splice(i, 1);
        }
    }

    // 5. Aggiorna Proiettili e Collisioni
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.move();
        p.draw();

        // Controlla la collisione con i nemici
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            let dist = Math.hypot(p.x - e.x, p.y - e.y);

            if (dist < e.radius + 4 && !p.hitEnemies.includes(e)) {
                
                // DANNO AD AREA (RPG)
                if (p.stats.type === "splash") {
                    enemies.forEach((splashEnemy, splashIndex) => {
                        let splashDist = Math.hypot(e.x - splashEnemy.x, e.y - splashEnemy.y);
                        if (splashDist <= p.stats.splashRadius) {
                            splashEnemy.hp -= p.stats.damage;
                            if (splashEnemy.hp <= 0 && enemies.includes(splashEnemy)) {
                                money += 1;
                                updateUI();
                                enemies.splice(enemies.indexOf(splashEnemy), 1);
                            }
                        }
                    });
                    projectiles.splice(i, 1); // L'RPG esplode e sparisce
                    break;
                }

                // DANNO PIERCING (Cecchino - colpisce 2 nemici)
                if (p.stats.type === "pierce") {
                    e.hp -= p.stats.damage;
                    p.hitEnemies.push(e); // Registra che ha colpito questo nemico
                    if (e.hp <= 0) {
                        money += 1;
                        updateUI();
                        enemies.splice(j, 1);
                    }
                    if (p.hitEnemies.length >= 2) {
                        projectiles.splice(i, 1); // Sparisce dopo 2 colpi
                        break;
                    }
                }

                // DANNO NORMALE (Soldato Semplice)
                if (p.stats.type === "normal") {
                    e.hp -= p.stats.damage;
                    if (e.hp <= 0) {
                        money += 1;
                        updateUI();
                        enemies.splice(j, 1);
                    }
                    projectiles.splice(i, 1); // Sparisce al primo colpo
                    break;
                }
            }
        }
    }

    // Richiama il prossimo frame
    requestAnimationFrame(gameLoop);
}
