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
const FIXED_NB_TRAPS = 4;
const MAX_ORE_LIMIT = 10;

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
    isValid(x, y) {
        return this.x >= 0 && this.x <30 && this.y >= 0 && this.y <15;
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

class Radar extends Entity {
    constructor(x, y, type, id) {
        super(x, y, type, id);
        this.oreAmount = 0;
        this.arrayOfCells = [];
    }

    updateOreAmount(grid, allTraps) {
        this.oreAmount = this.countOreAround(grid, allTraps);
    }

    countOreAround(grid, allTraps) {
        this.arrayOfCells = [];
        let count = 0;
        for(var i = this.x - 2; i <= this.x + 2; i++) {
            for(var j = this.y - 1; j <= this.y + 1; j++) {
                const cell = grid.getCell(i,j);
                if (cell && !allTraps.some(t => t.isSame(cell)) && cell.getOre() > 0) {
                    count += cell.getOre();
                    this.arrayOfCells.push(cell);
                }
            }   
        }
    }

    getMaxOreCell() {
        let maxCell, maxCellOre = 0;
        for(var i = this.x - 2; i <= this.x + 2; i++) {
            for(var j = this.y - 1; j <= this.y + 1; j++) {
                const cell = grid.getCell(i,j);
                if (cell && cell.getOre() > maxCellOre){
                    maxCell = cell;
                    maxCellOre = cell.getOre();
                }
            }
        }
        return maxCell;
    }

    getArrayOfCells(){
        return this.arrayOfCells;
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
        this.maintainedRadarPos = [
            new Pos(9, 7),
            new Pos(5, 3),
            new Pos(5, 11),
            new Pos(12, 2),
            new Pos(12, 12),
            new Pos(16, 7),
            new Pos(20, 2),
            new Pos(20, 12),
            new Pos(24, 7),
        ];
        this.fixedNbTraps = FIXED_NB_TRAPS;
        this.reset();
    }

    incrementTurn() {
        this.turn++;
    }

    reset() {
        this.radars = [];
        this.traps = [];
        this.myRobots = [];
        this.enemyRobots = [];
        this.oreReservedRange = [];
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

    isCellInRestrictedRange(cell) {
        return this.oreReservedRange.some(o => r.isSame(cell));
    }
    updateRadarRangeMap(radar) {
        this.oreReservedRange = this.oreReservedRange.concat(radar.getArrayOfCells());
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
            // temps += inputs[2*j +1] + ' ';
        }
        // console.error(temps);
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
            game.radars.push(new Radar(x, y, type, id));
        } else if (type === TRAP) {
            game.traps.push(new Entity(x, y, type, id));
        }
    }    
    
    game.radars.forEach(r => r.updateOreAmount(game.grid, game.traps));

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
        if (robot.item == NONE) {
            if (processNone(game, robot, oreCells, hiddenCells)) { continue; }
        }
        // if robot has ore
        if (robot.item === ORE) {
            game.updateTask(robot, new Task(robot.id, robot.item, new Pos(0, robot.y), ACTION.MOVE, 'transport ore'));
            continue;
        }
        if (robot.item === RADAR) {
            if (processRadar(game, robot)) {
                continue;
            } else if (processNone(game, robot, oreCells, hiddenCells)){
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
            || (task.item === NONE && oreCells.length > 2 && game.grid.getCell(task.target.x, task.target.y).getOre() <= 0);
        case ACTION.WAIT:
            return true;
        case ACTION.REQUEST:
            return robot.item === task.item;
        default:
            return false;
    }
}

function processNone(game, robot, oreCells, hiddenCells) {
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
    if (oreCells.length && (target = getMoveOre(game, robot, oreCells))) {
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
        hiddenC = game.grid.getCell(robot.x + 4, robot.y);
    } else {
        hiddenC = getPossibleMoveExplore(game, robot, cells);
    }
    // game.updateTask(robot, new Task(robot.id, NONE, hiddenC, ACTION.MOVE, 'just move'));
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
    let remainings = game.maintainedRadarPos
            .filter(pos => !pos.isTaken && !game.isRadalCell(pos)
                    && !game.isTrapCell(pos));
    let cell, minDist = 1000;
    remainings.forEach(r => {
        const dist = robot.distance(r);
        if (dist < minDist) {
            minDist = dist;
            cell = r;
        }
    });
    return cell ? new Pos(cell.x, cell.y) : null;
}

// function processTrap(game, robot, oreCells, hiddenCells) {
//     let posToTrap;
//     if (oreCells.length) {
//         // find furthest ore cell
//         let furthestCell, maxDist = 0;
//         const muchOreCells = oreCells.filter(c => c.getOre() >= 2);
//         (muchOreCells.length ? muchOreCells : oreCells).forEach(c => {
//             if(c.x > maxDist) {
//                 furthestCell = c;
//                 maxDist = c.x;
//             }
//         });
//         posToTrap = furthestCell;
//     } else {
//         posToTrap = getPossibleMoveExplore(game, robot, hiddenCells);
//     }
//     game.updateTask(robot, new Task(robot.id, robot.item, posToTrap, ACTION.DIG, 'put trap'));
// }
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
	// find most ore cell within min distance
    let cell, minDist = 1000;
    oreCells.forEach(c => {
        const dist = c.x;
        const countTargeting = game.countCellTargeted(c);
        // const step = c.getSteps(new Pos(0, c.y));
        if ( dist < minDist && countTargeting === 0 && !game.isCellInRestrictedRange(c)) {
            cell = c;
            minDist = dist;
        }
    });
    return cell;
}



function getPossibleMoveExplore(game, robot, cells) {
    let cell, minDist = 1000;
    cells.forEach(c => {
        const dist = robot.distance(c);
        const countTargeting = game.countCellTargeted(c);
        if ( dist < minDist && countTargeting === 0 && !game.isTrapCell(c)) {
            cell = c;
            minDist = dist;
        }
    });
    console.error(`robot ${robot.id} at pos(${robot.x}, ${robot.y}) explore (${cell.x}, ${cell.y}) with dist ${minDist}`);
    return cell;
}

function getMoveOre(game, robot, oreCells) {
    let radar, maxOreAmount = 0;
    game.radars.forEach(r => {
        const oreAmount = r.oreAmount;
        if (oreAmount > maxOreAmount) {
            radar = r;
            maxOreAmount = oreAmount;
        }
    });
    if (radar && maxOreAmount > MAX_ORE_LIMIT) {
        game.updateRadarRangeMap(radar);
        // target one of radar neighbors
        cell = radar.getMaxOreCell();
    } else {
        let minStep = 1000;
        oreCells.forEach(c => {
            const step = robot.getSteps(c);
            const nbOre = c.getOre();
            // see if our robot targeting this cell with store enough
            const countTargeting = game.countCellTargeted(c);
            if (step < minStep && countTargeting < nbOre && !game.isTrapCell(c)) {
                cell = c;
                minStep = step;
            }
        });
    }
    return cell;
}