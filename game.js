// ==========================================
// 1. VARIABILI GLOBALI E SETUP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// Variabili Ondate
let enemiesToSpawn = 10;
let spawnTimer = 0;
let waveActive = true;

// Variabili UI e Pausa
let selectedTowerType = 1; 
let isPaused = false;
let animationId; // Serve per fermare il ciclo di animazione

// Coordinate del mouse per il Range
let mouseX = 0;
let mouseY = 0;

// ==========================================
// 2. CONFIGURAZIONI TORRI E MAPPE
// ==========================================
const TOWER_STATS = {
    1: { name: "Soldato Semplice", cost: 100, range: 150, damage: 20, fireRate: 60, color: "blue", type: "normal" },
    2: { name: "Cecchino", cost: 250, range: 300, damage: 40, fireRate: 120, color: "black", type: "pierce" },
    3: { name: "Soldato RPG", cost: 500, range: 200, damage: 50, fireRate: 150, color: "orange", type: "splash", splashRadius: 80 }
};

const MAPS = {
    'Pianura': [ {x: 0, y: 100}, {x: 600, y: 100}, {x: 600, y: 500}, {x: 200, y: 500}, {x: 200, y: 300}, {x: 800, y: 300} ],
    'Città': [ {x: 400, y: 0}, {x: 400, y: 200}, {x: 100, y: 200}, {x: 100, y: 400}, {x: 700, y: 400}, {x: 700, y: 600} ],
    'Cimitero': [ {x: 0, y: 500}, {x: 300, y: 500}, {x: 300, y: 100}, {x: 500, y: 100}, {x: 500, y: 450}, {x: 800, y: 450} ]
};

// ==========================================
// 3. FUNZIONI DI GESTIONE STATO (Avvio, Pausa, Menu)
// ==========================================
function startGame(mapName) {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // Resetta tutte le variabili in caso stiamo ricominciando
    money = 200;
    round = 1;
    enemies = [];
    towers = [];
    projectiles = [];
    enemiesToSpawn = 10;
    spawnTimer = 0;
    waveActive = true;
    isPaused = false;
    
    uiMapName.innerText = `Mappa: ${mapName}`;
    waypoints = MAPS[mapName];
    updateUI();
    
    // Avvia il loop
    animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
    // Evita di mettere in pausa se siamo nel menu principale
    if (document.getElementById('game-container').style.display === 'none') return;
    
    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    
    if (isPaused) {
        pauseMenu.style.display = 'flex'; // Mostra il menu
    } else {
        pauseMenu.style.display = 'none'; // Nascondi il menu
        gameLoop(); // Riavvia il loop
    }
}

function returnToMenu() {
    isPaused = false;
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    cancelAnimationFrame(animationId); // Ferma definitivamente il loop
}

function updateUI() {
    uiMoney.innerText = `Monete: ${money}`;
    uiRound.innerText = `Round: ${round}`;
}

// ==========================================
// 4. CLASSI (Nemici, Torri, Proiettili)
// ==========================================
class Enemy {
    constructor() {
        this.x = waypoints[0].x;
        this.y = waypoints[0].y;
        this.waypointIndex = 1;
        this.speed = 1.5 + (round * 0.1);
        this.hp = 50 + (round * 20);
        this.maxHp = this.hp;
        this.radius = 15;
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
        ctx.fillStyle = "green";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

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
        this.size = 30;
    }
    update() {
        if (this.cooldown > 0) this.cooldown--;
        if (this.cooldown === 0) {
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
        ctx.fillStyle = this.stats.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
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
        this.hitEnemies = [];
    }
    move() {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);
        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
    }
    draw() {
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// 5. INPUT E CONTROLLI
// ==========================================

// Cambia torre (1, 2, 3) e Mette in Pausa (Esc)
document.addEventListener('keydown', (e) => {
    if (e.key === '1') selectedTowerType = 1;
    if (e.key === '2') selectedTowerType = 2;
    if (e.key === '3') selectedTowerType = 3;
    if (e.key === 'Escape') togglePause();
});

// Traccia la posizione del cursore per il Range
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Piazza la torre cliccando sul Canvas (se non in pausa)
canvas.addEventListener('click', (e) => {
    if (isPaused) return;

    const cost = TOWER_STATS[selectedTowerType].cost;
    if (money >= cost) {
        towers.push(new Tower(mouseX, mouseY, selectedTowerType));
        money -= cost;
        updateUI();
    }
});

// ==========================================
// 6. GESTIONE ONDATE
// ==========================================
function handleWaves() {
    if (waveActive) {
        spawnTimer++;
        if (spawnTimer > 100 && enemiesToSpawn > 0) {
            enemies.push(new Enemy());
            enemiesToSpawn--;
            spawnTimer = 0;
        }

        if (enemiesToSpawn === 0 && enemies.length === 0) {
            waveActive = false;
            money += 100; 
            round++;
            enemiesToSpawn = 10 + (round * 5); 
            updateUI();
            setTimeout(() => { if (!isPaused) waveActive = true; }, 3000);
        }
    }
}

// ==========================================
// 7. LOOP PRINCIPALE DEL GIOCO
// ==========================================
function gameLoop() {
    // Se il gioco è in pausa, interrompi l'aggiornamento
    if (isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disegna percorso
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

    handleWaves();

    // Aggiorna e disegna Torri
    towers.forEach(tower => {
        tower.update();
        tower.draw();
    });

    // Aggiorna e disegna Nemici
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.move();
        e.draw();
        if (e.waypointIndex >= waypoints.length) {
            enemies.splice(i, 1);
        }
    }

    // Aggiorna e disegna Proiettili e Collisioni
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.move();
        p.draw();

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            let dist = Math.hypot(p.x - e.x, p.y - e.y);

            if (dist < e.radius + 4 && !p.hitEnemies.includes(e)) {
                if (p.stats.type === "splash") {
                    enemies.forEach((splashEnemy) => {
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
                    projectiles.splice(i, 1);
                    break;
                }

                if (p.stats.type === "pierce") {
                    e.hp -= p.stats.damage;
                    p.hitEnemies.push(e);
                    if (e.hp <= 0) {
                        money += 1;
                        updateUI();
                        enemies.splice(j, 1);
                    }
                    if (p.hitEnemies.length >= 2) {
                        projectiles.splice(i, 1);
                        break;
                    }
                }

                if (p.stats.type === "normal") {
                    e.hp -= p.stats.damage;
                    if (e.hp <= 0) {
                        money += 1;
                        updateUI();
                        enemies.splice(j, 1);
                    }
                    projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    // DISGNA IL RANGE DELLA TORRE SUL CURSORE
    const currentTower = TOWER_STATS[selectedTowerType];
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; // Cerchio bianco semitrasparente
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, currentTower.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mostra info torre selezionata
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(`Torre Selezionata: ${currentTower.name} (Costo: ${currentTower.cost}) - Premi 1, 2 o 3 per cambiare`, 10, 25);

    animationId = requestAnimationFrame(gameLoop);
}
