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

class Pos {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distance(pos) {
        return Math.abs(this.x - pos.x) + Math.abs(this.y - pos.y);
    }
    isSame(pos) {
        return this.x == pos.x && this.y == pos.y;
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
        this.grid = new Grid();
        this.grid.init();
        this.myScore = 0;
        this.enemyScore = 0;
        this.radarCooldown = 0;
        this.trapCooldown = 0;
        this.tasks = [];
        this.maintainedRadarPos = [
            {x: 3, y: 3},
            {x: 3, y: 11},
            {x: 11, y: 3},
            {x: 11, y: 11},
            {x: 19, y: 3},
            {x: 19, y: 11}
        ];
        this.reset();
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
        if (foundTask) {
            if (task) {
                this.tasks[i] = task; // update task
            }
            // perform old or new task;
            robot.performTask(this.tasks[i]);
            return true;
        } else if (task){
            this.tasks.push(task);
            // perform new task;
            robot.performTask(task);
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
        console.error(`Task ${currentTask.action} of robot ${robot.id} has finished, tasks remaining: ${this.tasks}`);
    }

}

let game = new Game();


// game loop
while (true) {
    let inputsScore = readline().split(' ');
    game.myScore = parseInt(inputsScore[0]); // Players score
    game.enemyScore = parseInt(inputsScore[1]);
    for (let i = 0; i < MAP_HEIGHT; i++) {
        let inputs = readline().split(' ');
        for (let j = 0; j < MAP_WIDTH; j++) {
            const ore = inputs[2 * j];// amount of ore or "?" if unknown
            const hole = parseInt(inputs[2 * j + 1]);// 1 if cell has a hole
            game.grid.getCell(j, i).update(ore, hole);
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
            game.radars.push(new Entity(x, y, type, id));
        } else if (type === TRAP) {
            game.traps.push(new Entity(x, y, type, id));
        }
    }
    
    
    // Check if any explored cell
    const oreCells = game.grid.cells.filter(cell => cell.x !== 0 && cell.ore !== '?' && parseInt(cell.ore) > 0);
    const hiddenCells = game.grid.cells.filter(cell => cell.x !== 0 && cell.ore == '?' && !cell.hasHole());
    for (let i = 0; i < game.myRobots.length; i++) {
        const robot = game.myRobots[i];
        const currentTask = game.getCurrentTask(robot);
        console.error(`robot ${robot.id} with item ${robot.item} has current task: ${currentTask ? currentTask.action : 'NO ACTION'}`);
        if (currentTask) { // if robot has in progress task
            if (isTaskDone(game, robot, currentTask)) {
                // arrived at target
                // game.updateTask(robot, new Task(robot.id, currentTask.item, currentTask.target, ACTION.DIG));
                // remove current Task
                game.removeCurrentTask(robot);
            } else {
                // task in progress, just perform it
                game.updateTask(robot);
                continue;
            }
        }
        console.error(`No current task, continue ${robot.id} with item ${robot.item}`);
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
        // if (robot.item === TRAP && hiddenCells.length) {
        //     const hiddenC = getPossibleMoveItem(game, hiddenCells, TRAP);
        //     if (hiddenC) {
        //         robot.dig(hiddenC.x, hiddenC.y, 'put trap');
        //         continue;
        //     }
            
        // }

        // if (game.trapCooldown === 0) {
        //     robot.request(TRAP, 'request trap');
        //     game.trapCooldown = 5;
        //     continue;
        // }

        robot.wait(`Starter AI ${i}`);
    }
}

function isTaskDone(game, robot, task) {
    switch (task.action) {
        case ACTION.MOVE:
            return task.target.isSame(robot);
        case ACTION.DIG:
            return robot.item === ORE || (task.item === RADAR && robot.item === NONE)
            || (task.item === NONE && game.grid.getCell(task.target.x, task.target.y).hasHole());
        case ACTION.WAIT:
            return true;
        case ACTION.REQUEST:
            return robot.item === task.item;
        default:
            return false;
    }
}

function processNone(game, robot, oreCells, hiddenCells) {
    if (robot.isAtHome() && game.radarCooldown === 0 && game.radars.length < game.maintainedRadarPos.length) {
        game.updateTask(robot, new Task(robot.id, RADAR, new Pos(0, robot.y), ACTION.REQUEST, 'request radar'));
        game.radarCooldown = 5;
    } else if (oreCells.length) {
        const target = getPossibleMoveExplore(game, robot, oreCells);
        game.updateTask(robot, new Task(robot.id, NONE, target, ACTION.DIG, 'go to mine'));
    } else {
        const hiddenC = getPossibleMoveExplore(game, robot, hiddenCells);
        // game.updateTask(robot, new Task(robot.id, NONE, hiddenC, ACTION.MOVE, 'go to explore'));
        game.updateTask(robot, new Task(robot.id, NONE, hiddenC, ACTION.DIG, 'go to explore'));
    }
    return true;
}


function processRadar(game, robot) {
    console.error(`start process radar for robot ${robot.id}`);
    let target = getPossibleMoveItem(game);
    if (target) {
        game.updateTask(robot, new Task(robot.id, RADAR, target, ACTION.DIG, 'put radar'));
        return true;
    }
    return false;
}

function getPossibleMoveItem(game) {
    // let cell, x = 4, y = 1, deltaY = 7, count = 0;
    let remainings = game.maintainedRadarPos.filter(pos => !game.radars.some(r => r.isSame(pos)));
    do {
        // if (count === 2) {
        //     x = (x + 8) % MAP_WIDTH;
        //     y = 1;
        //     count = 0;
        // } else {
        //     y = (y + deltaY) % MAP_HEIGHT;
        // }
        const pos = remainings.shift();
        if (!pos) {
            return null;
        }
        cell = game.grid.getCell(pos.x, pos.y);
        // count ++;
    } while (game.traps.some(trap => trap.isSame(cell)));
    console.error(`Cell for radar: ${cell.x} ${cell.y}`);
    return cell;
}

function getPossibleMoveExplore(game, robot, cells) {
    let cell, minDist = 1000;
    cells.forEach(c => {
        const dist = robot.distance(c);
        if (dist < minDist && !game.traps.some(trap => trap.isSame(c))) {
            cell = c;
            minDist = dist;
        }
    });
    return cell;
}