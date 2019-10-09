/**
 * Deliver more ore to hq (left side of the map) than your opponent. Use radars to find ore but beware of traps!
 **/
let inputs = readline().split(' ');
const MAP_WIDTH = parseInt(inputs[0]);
const MAP_HEIGHT = parseInt(inputs[1]); // size of the map

const NONE = -1;
const ROBOT_ALLY = 0;
const ROBOT_ENEMY = 1;
const HOLE = 1;
const RADAR = 2;
const TRAP = 3;
const ORE = 4;

const ACTION = {
    WAIT: 'WAIT',
    MOVE: 'MOVE',
    DIG: 'DIG',
    REQUEST: 'REQUEST'
};

const USELESS_ZONE_X = 2;
const MAX_MOVE_IN_STEP = 4;
const ITEM_TAKER = 0;
const TRAP_RADAR_THRES = 3;
const TRAP_ORE_THRES = 8;
const FIXED_NB_TRAPS = 3;
const MIN_ORE_AT_RADAR = 10;

class Pos {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distance(pos) {
        return this.isAdjacent(pos) ? 0 : Math.abs(this.x - pos.x) + Math.abs(this.y - pos.y);
    }
    isSame(pos) {
        return this.x == pos.x && this.y == pos.y;
    }
    isAdjacent(pos) {
        return (this.x === pos.x && this.y == pos.y + 1) ||
        (this.x === pos.x && this.y == pos.y - 1) ||
        (this.x === pos.x - 1 && this.y == pos.y) ||
        (this.x === pos.x + 1 && this.y == pos.y);
    }
    getSteps(pos) {
        const dist = this.distance(pos);
        return parseInt(dist / 4) + (dist % 4 > 0 ? 1 : 0);
    }

}

class Entity extends Pos {
    constructor(x, y, type, id) {
        super(x, y);
        this.id = id;
        this.type = type;
    }
}

class Robot extends Entity {
    constructor(x, y, type, id, item) {
        super(x, y, type, id);
        this.item = item;
    }

    isDead() {
        return this.x === -1 && this.y === -1;
    }

    isAtHome() {
        return this.x == 0;
    }

    move(x, y, message = "") {
        console.log(`MOVE ${x} ${y} ${message}`);
    }

    wait(message = "") {
        console.log(`WAIT ${message}`);
    }

    dig(x, y, message = "") {
        console.log(`DIG ${x} ${y} ${message}`);
    }

    request(item, message = "") {
        if(item === RADAR){
            console.log(`REQUEST RADAR ${message}`);
        }
        else if(item === TRAP){
            console.log(`REQUEST TRAP ${message}`);
        }
        else{
            throw Error(`unrecognized item: ${item}`);
        }

    }

    performTask(task) {
        console.error(`Perform task ${task.action} for robot ${this.id}`);
        switch (task.action) {
            case ACTION.WAIT:
                this.wait(task.message);
                break;
        
            case ACTION.MOVE:
                this.move(task.target.x, task.target.y, task.message);
                break;
            case ACTION.REQUEST:
                this.request(task.item, task.message);
                break;
            case ACTION.DIG:
                this.dig(task.target.x, task.target.y, task.message);
                break;
            default:
                throw Error('Unknown task to perform: ' + task);
        }
    }

}

class Cell extends Pos {
    constructor(ore, hole, x, y) {
        super(x, y);
        this.update(ore, hole);
    }

    hasHole() {
        return this.hole === HOLE;
    }

    getOre() {
        return this.ore !== '?' ? parseInt(this.ore) : -1;
    }

    update(ore, hole) {
        this.ore = ore;
        this.hole = hole;
    }
}

class Grid {
    constructor() {
        this.cells = [];
    }

    init() {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                let index = x + MAP_WIDTH * y;
                this.cells[index] = new Cell(0, 0, x, y);
            }
        }
    }

    getCell(x, y) {
        if (x < MAP_WIDTH && y < MAP_HEIGHT && x >= 0 && y >= 0) {
            return this.cells[x + MAP_WIDTH * y];
        }
        return null;
    }

}
class Task {
    constructor(robotId, item, target, action = ACTION.WAIT, message = '') {
        this.robotId = robotId;
        this.item = item;
        this.action = action;
        this.target = target;
        this.message = message;
    }
}

class Radar extends Entity {
    constructor(x, y, id, grid) {
        super(x,y,RADAR,id);
        this.visibleZone = [];
        for (var i = -4; i<= 4; i++) {
            for(var j = Math.abs(i) - 4; j <= 4 - Math.abs(i); j++) {
                const cell = grid.getCell(x+i, y+j);
                if (cell) {
                    this.visibleZone.push(cell);
                }
            }
        }
        this.oresCount = this.getVisibleOreCount();
        console.error('Count ore at radar ', this.id, ': ', this.oresCount);
    }
    getVisibleOreCount() {
        return this.visibleZone.reduce((count, next) => {
            // console.error('(', next.x, '-', next.y, ') - ore: ', next.getOre());
            return count + (next.getOre() > 0 ? next.getOre() : 0);
        }, 0);
    }

    // isUnexploredRadarZone() {
    //     let countOreCell = 0, countUnexploredOreCell = 0;
    //     this.visibleZone.forEach(cell => {
    //         if (cell.getOre() > 0) {
    //             countOreCell++;
    //             if(!cell.hasHole()) {
    //                 countUnexploredOreCell++;
    //             }
    //         }
    //     });
    //     return (countUnexploredOreCell / countOreCell) > 0.5;
    // }

}

class Game {
    constructor() {
        this.turn = 0;
        this.grid = new Grid();
        this.grid.init();
        this.myScore = 0;
        this.enemyScore = 0;
        this.radarCooldown = 0;
        this.trapCooldown = 0;
        this.tasks = [];
        this.unexploredRadarsPos = [];
        this.posDigByEnemy = [];
        this.workingOreCells = [];
        this.dangerousOreCells = [];
        this.maintainedRadarPos = [
            // {x: 4, y: 2, isTaken: false},
            // {x: 4, y: 7, isTaken: false},
            {x: 9, y: 7, isTaken: false},
            {x: 5, y: 3, isTaken: false},
            {x: 5, y: 11, isTaken: false},
            {x: 12, y: 2, isTaken: false},
            {x: 12, y: 12, isTaken: false},
            {x: 16, y: 7, isTaken: false},
            {x: 20, y: 2, isTaken: false},
            {x: 20, y: 12, isTaken: false},
            {x: 24, y: 7, isTaken: false},
            // {x: 28, y: 2},
            // {x: 28, y: 12},
        ];
        this.fixedNbTraps = FIXED_NB_TRAPS;
        this.reset();
    }

    checkEnemyPos(robotEnemy) {
        const cell = this.grid.getCell(robotEnemy.x, robotEnemy.y);
        if (cell.hasHole() && cell.getOre() > 0) {

        }
    }

    incrementTurn() {
        this.turn++;
    }

    reset() {
        this.radars = [];
        this.traps = [];
        this.myRobots = [];
        this.enemyRobots = [];
    }

    updateTask(robot, task = null) {
        let foundTask = false;
        let i;
        for(i = 0; i < this.tasks.length; i++) {
            if (robot.id === this.tasks[i].robotId) {
                foundTask = true;
                break;
            }
        }
        let taskToBePerformed;
        if (foundTask) {
            if (task) {
                this.tasks[i] = task; // update task
            }
            taskToBePerformed = this.tasks[i];
        } else if (task){
            this.tasks.push(task);
            taskToBePerformed = task;
        }
        if (taskToBePerformed) {
            if (taskToBePerformed.action === ACTION.DIG && taskToBePerformed.item === TRAP) {
                this.traps.push(new Entity(taskToBePerformed.target.x, taskToBePerformed.target.y, TRAP, 'newTrap'));
            } else if(taskToBePerformed.action === ACTION.DIG && taskToBePerformed.item === RADAR) {
                const foundRadar = this.maintainedRadarPos.filter(r => taskToBePerformed.target.isSame(r)).shift();
                if (foundRadar) {
                    foundRadar.isTaken = true;
                }
            }
            // perform old or new task;
            robot.performTask(taskToBePerformed);
            return true;
        }
        return false; // no in progress task performed
    }

    getCurrentTask(robot) {
        return this.tasks.filter(t => t.robotId === robot.id && t.action !== ACTION.REQUEST).shift();
    }

    removeCurrentTask(robot) {
        var currentTask = this.tasks.filter(t => t.robotId === robot.id).shift();
        if (currentTask) {
            const ind = this.tasks.indexOf(currentTask);
            this.tasks.splice(ind, 1);
        }
        // console.error(`Task ${currentTask.action} of robot ${robot.id} has finished, tasks remaining: ${this.tasks}`);
    }

    getRobotClosestHome() {
        let minDist = 1000, robot;
        this.myRobots.filter(r => r.item === NONE)
        .forEach(r => {
            const dist = r.distance(new Pos(0, r.y));
            if (dist < minDist) {
                minDist = dist;
                robot = r;
            }
        });
        return robot;
    }

    countCellTargeted(cell) {
        return this.tasks.filter(t => t.target && t.target.isSame(cell)).length;
    }

    countAliveRobot() {
        return this.myRobots.filter(r => !r.isDead()).length;
    }

    isTrapCell(cell){
        return this.traps.some(trap => trap.isSame(cell));
    }

    isRadalCell(cell){
        return this.radars.some(r => r.isSame(cell));
    }
    getClosestSafeOreCells(robot) {
        let safeOreCells, minStep = 0;
        this.radars.forEach(r => {
            const step = robot.getSteps(r);
            const currSafeOreCells = r.visibleZone.filter(c => c.getOre() > 0 && !this.isDangerousCell(c));
            if(currSafeOreCells.length > 0 && minStep > step) {
                safeOreCells = currSafeOreCells;
                minStep = step;
            }
        });
        return safeOreCells;
    }
    // getMediumEnnemyPos() {
    //     let x,y;
    //     const aliveEnemyRobots = this.enemyRobots.filter(r => !r.isDead());
    //     aliveEnemyRobots.forEach(r => {
    //         x+= r.x;
    //         y+= r.y;
    //     })
    //     return new Pos(parseInt(x/aliveEnemyRobots.length), parseInt(y/aliveEnemyRobots.length));
    // }

    isDangerousCell(cell) {
        return this.dangerousOreCells.some(c => c.isSame(cell));
    }

    updateDangerousOreCell(radar) {
        const newDangerousCells = radar.visibleZone
        .filter(cell => cell.hasHole() && cell.getOre() == 1
            && !this.workingOreCells.some(woc => woc.isSame(cell))
        );
        newDangerousCells.forEach(c => console.error("Dangerous cell: (", c.x, ', ', c.y, ')'));
        this.dangerousOreCells = this.dangerousOreCells.concat(newDangerousCells);
        
    }

    updateWorkingOreCells(x, y) {
        const pos = new Pos(x, y);
        console.error("update working cell: (", x, ', ', y, ')');
        if (this.workingOreCells.some(c => c.isSame(pos))) {
            return;
        }
        this.workingOreCells.push(pos);
    }
}

let game = new Game();


// game loop
while (true) {
    game.incrementTurn();
    let inputsScore = readline().split(' ');
    game.myScore = parseInt(inputsScore[0]); // Players score
    game.enemyScore = parseInt(inputsScore[1]);
    for (let i = 0; i < MAP_HEIGHT; i++) {
        let inputs = readline().split(' ');
        let temps = '';
        for (let j = 0; j < MAP_WIDTH; j++) {
            const ore = inputs[2 * j];// amount of ore or "?" if unknown
            const hole = parseInt(inputs[2 * j + 1]);// 1 if cell has a hole
            game.grid.getCell(j, i).update(ore, hole);
            temps += inputs[2*j] + ' ';
        }
        if (game.turn === 188) {
            console.error(temps);
        }
    }

    let inputsStatus = readline().split(' ');
    const entityCount = parseInt(inputsStatus[0]); // number of visible entities
    game.radarCooldown = parseInt(inputsStatus[1]); // turns left until a new radar can be requested
    game.trapCooldown = parseInt(inputsStatus[2]); // turns left until a new trap can be requested

    game.reset();

    for (let i = 0; i < entityCount; i++) {
        let inputsEntities = readline().split(' ');
        const id = parseInt(inputsEntities[0]); // unique id of the entity
        const type = parseInt(inputsEntities[1]); // 0 for your robot, 1 for other robot, 2 for radar, 3 for trap
        const x = parseInt(inputsEntities[2]);
        const y = parseInt(inputsEntities[3]); // position of the entity
        const item = parseInt(inputsEntities[4]); // if this entity is a robot, the item it is carrying (-1 for NONE, 2 for RADAR, 3 for TRAP, 4 for ORE)
        if (type === ROBOT_ALLY) {
            game.myRobots.push(new Robot(x, y, type, id, item));
        } else if (type === ROBOT_ENEMY) {
            game.enemyRobots.push(new Robot(x, y, type, id, item));
        } else if (type === RADAR) {
            game.radars.push(new Radar(x, y, id, game.grid));
        } else if (type === TRAP) {
            game.traps.push(new Entity(x, y, type, id));
        }
    }
    
    
    for (let i = 0; i < game.myRobots.length; i++) {
        const robot = game.myRobots[i];
        const currentTask = game.getCurrentTask(robot);
        const trapInProgress = game.tasks
            .filter(t => t.action === ACTION.DIG && t.item === TRAP)
            .map(t => new Entity(t.target.x, t.target.y, TRAP, 'in progress trap'));
        const allTraps = trapInProgress.concat(game.traps);
        const oreCells = game.grid.cells.filter(cell => cell.x !== 0 && cell.ore !== '?' && parseInt(cell.ore) > 0 && !allTraps.some(t => t.isSame(cell)));

        if (currentTask) { // if robot has in progress task
            if (isTaskDone(game, robot, currentTask, oreCells)) {
                if (currentTask.item === RADAR && currentTask.action === ACTION.DIG) {
                    // update dangerous ore cells
                    game.updateDangerousOreCell(new Radar(currentTask.target.x, currentTask.target.y, 'new radar', game.grid));
                }
                if (robot.item === ORE && currentTask.action === ACTION.DIG && currentTask.target) {
                    // By chance or by radar visibility, robot digged into ore cell
                    game.updateWorkingOreCells(currentTask.target.x, currentTask.target.y);
                }
                // remove current Task
                game.removeCurrentTask(robot);
            } else {
                // task in progress, just perform it
                game.updateTask(robot);
                continue;
            }
        }
         // Check if any explored cell
        const hiddenCells = game.grid.cells.filter(cell => cell.x > USELESS_ZONE_X && cell.ore == '?' && !cell.hasHole()); // avoid first column as possibility to have trap
        if (game.turn === 188) {
            console.error('hidden cells length: ', hiddenCells.length);
            console.error('HOLES');
            game.grid.cells.forEach(cell => console.error(cell.hole));
            console.error('ORE');
            game.grid.cells.forEach(cell => console.error(cell.ore));
        }
        if (robot.item == NONE) {
            if (processNone(robot, oreCells, hiddenCells)) { continue; }
        }
        // if robot has digged new ore
        if (robot.item === ORE) {
            game.updateTask(robot, new Task(robot.id, robot.item, new Pos(0, robot.y), ACTION.MOVE, 'transport ore'));
            continue;
        }
        if (robot.item === RADAR) {
            if (processRadar(game, robot)) {
                continue;
            } else if (processNone(robot, oreCells, hiddenCells)){
                // As if no item taken, processNone to take next task
                continue;
            }
        }
        if (robot.item === TRAP) {
            const cellsForTrap = oreCells.filter(c => c.getOre() >= 2 && c.x >= 4 && c.y <= 20);
            processTrap(game, robot, cellsForTrap, hiddenCells);
            continue;
        }

        robot.wait(`Starter AI ${i}`);
    }
}

function isTaskDone(game, robot, task, oreCells) {
    switch (task.action) {
        case ACTION.MOVE:
            return task.target.isSame(robot);
        case ACTION.DIG:
            return robot.item === ORE
            || (task.item === RADAR && robot.item === NONE)
            || (task.item === TRAP && robot.item === NONE)
            || (task.item === NONE && game.grid.getCell(task.target.x, task.target.y).hasHole())
            || (task.item === NONE && oreCells.length > 3 && game.grid.getCell(task.target.x, task.target.y).getOre() <= 0);
        case ACTION.WAIT:
            return true;
        case ACTION.REQUEST:
            return robot.item === task.item;
        default:
            return false;
    }
}

function processNone(robot, oreCells, hiddenCells) {
    hasRobotAtHome = game.myRobots.some(r => r.isAtHome());
    robotClosestHome = game.getRobotClosestHome();
    if (robot.isAtHome()) {
        const nbRadars = game.radars.length + game.tasks.filter(t => t.item === RADAR && t.action === ACTION.DIG);
        const nbTraps = game.traps.length + game.tasks.filter(t => t.item === TRAP && t.action === ACTION.DIG);
        if (game.radarCooldown === 0 && nbRadars < game.maintainedRadarPos.length) {
            game.updateTask(robot, new Task(robot.id, RADAR, new Pos(0, robot.y), ACTION.REQUEST, 'request radar'));
            game.radarCooldown = 5;
            return true;
        } else if (game.trapCooldown === 0 && game.countAliveRobot() > 3
                    && nbTraps < game.fixedNbTraps &&
                    (oreCells.length >= TRAP_ORE_THRES|| game.radars.length >= TRAP_RADAR_THRES)) {
            game.updateTask(robot, new Task(robot.id, TRAP, new Pos(0, robot.y), ACTION.REQUEST, 'request trap'));
            game.trapCooldown = 5;
            return true;
        }
    }
    let target;
    if (oreCells.length && (target = getMoveOre(robot, oreCells))) {
      game.updateTask(robot, new Task(robot.id, NONE, target, ACTION.DIG, 'go to mine'));
    } else if (robot.id === robotClosestHome.id && game.radarCooldown <= 1) {
      game.updateTask(robot, new Task(robot.id, NONE, new Pos(0, robot.y), ACTION.MOVE, 'back home - item'));  
    } else {
      processExplore(game, robot, hiddenCells);
    }
    return true;
}

function processExplore(game, robot, cells) {
    let hiddenC;
    if (game.turn === 1) {
        hiddenC = game.grid.getCell(robot.x + 8, robot.y);
    } else {
        hiddenC = getPossibleMoveExplore(game, robot, cells);
    }
    // game.updateTask(robot, new Task(robot.id, NONE, hiddenC, ACTION.MOVE, 'just move'));
    if (robot.id === 1 && game.turn === 188) {
        console.error('NOOOOO ', hiddenC.x, ', ', hiddenC.y);
    }
    game.updateTask(robot, new Task(robot.id, NONE, hiddenC, ACTION.DIG, 'go to explore'));
}

function processRadar(game, robot) {
    let target = getMoveRadar(game, robot);
    if (target) {
        game.updateTask(robot, new Task(robot.id, RADAR, target, ACTION.DIG, 'put radar'));
        return true;
    }
    return false;
}

function getMoveRadar(game, robot) {
    if (game.radars.length === 0) {
        return new Pos(game.maintainedRadarPos[0].x, game.maintainedRadarPos[0].y)
    }
    let cell, minDist = 1000;
    let index;
    for(let i = 0; i < game.maintainedRadarPos.length; i++) {
        const r = game.maintainedRadarPos[i];
        if (r.isTaken || game.isRadalCell(r) || game.isTrapCell(r)) {
            continue;
        }
        const dist = robot.distance(r);
        if (dist < minDist) {
            minDist = dist;
            cell = r;
            index = i;
        }
    }
    if (!cell) {
        return null;
    }
    cell = optimizeRadarPos(new Pos(cell.x, cell.y), game, robot);
    game.maintainedRadarPos[index] = { ...game.maintainedRadarPos[index], x: cell.x, y: cell.y};
    return cell;
}

/**
 * calculate approximavive pos for minimizing step
 */
function optimizeRadarPos(cell, game, robot) {
    // console.error(`Optimize robot radar ${robot.id} at ${robot.x} - ${robot.y}`);
    let mod = robot.distance(cell) % MAX_MOVE_IN_STEP;
    let toggle = true;
    const deltaY = cell.y < robot.y ? -1 : 1;
    while(mod > 0) {
        // console.error(`Mod ${robot.distance(cell)} is ${mod}`);
        // console.error('optimize radar pos', cell.x, '-', cell.y);
        if (toggle) {
            cell = game.grid.getCell(cell.x - 1, cell.y);
        } else {
            cell = game.grid.getCell(cell.x, cell.y - deltaY);
        }
        mod = robot.distance(cell) % MAX_MOVE_IN_STEP;
        toggle = !toggle;
    }
    return cell;
}

function processTrap(game, robot, oreCells, hiddenCells) {
    let posToTrap;
    if (oreCells.length) {
        posToTrap = getMoveFromOreCell(game, oreCells);
    }
    if (!posToTrap) {
        posToTrap = getPossibleMoveExplore(game, robot, hiddenCells);
    }
    game.updateTask(robot, new Task(robot.id, robot.item, posToTrap, ACTION.DIG, 'put trap'));
}

/**
 * Used only for get trap target
 */
function getMoveFromOreCell(game, oreCells) {
    let cell, maxDist = 0;
    oreCells.forEach(c => {
        const dist = c.x;
        const countTargeting = game.countCellTargeted(c);
        // const step = c.getSteps(new Pos(0, c.y));
        if ( dist > maxDist && countTargeting === 0) {
            cell = c;
            maxDist = dist;
        }
    });
    return cell;
}



function getPossibleMoveExplore(game, robot, cells) {
    let cell, minDist = 1000;
    if(robot.id === 1 && game.turn === 188) {
        console.error('CELLS COUNT: ', cells.length);
    }
    cells.forEach(c => {
        const dist = robot.distance(c);
        const countTargeting = game.countCellTargeted(c);
        if(robot.id === 1 && game.turn === 188) {
            console.error('TARGETING COUNT: ', countTargeting);
        }
        if ( dist < minDist && countTargeting === 0 && !game.isTrapCell(c)) {
            cell = c;
            minDist = dist;
        }
    });
    // console.error(`robot ${robot.id} at pos(${robot.x}, ${robot.y}) explore (${cell.x}, ${cell.y}) with dist ${minDist}`);
    return cell;
}

function getMoveOre(robot, oreCells) {
    let cell, minStep = 1000;
    const safeOreCells = game.getClosestSafeOreCells(robot) || [];
    safeOreCells.forEach(c => {
        const step = robot.getSteps(c);
        const nbOre = c.getOre();
        // see if our robot targeting this cell with store enough
        const countTargeting = game.countCellTargeted(c);
        if (step < minStep && countTargeting < nbOre && !game.isTrapCell(c)) {
            cell = c;
            minStep = step;
        }
    });
    return cell;
}