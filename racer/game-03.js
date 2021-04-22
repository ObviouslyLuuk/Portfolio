class Game {
  constructor() {
    this.world = new Game.World(this)
    this.tracks = TRACKS

    this.state = 'train' // can be train, draw, drive

    // Settings
    this.printing = false
    this.max_steps = Infinity
    this.score_at_wall = -10
    this.score_at_target = 1
    this.no_target_time = 150 // Infinity or 150 for example
    this.only_forward_targets = false
    this.force_forward = .3
    this.force_forward_player = true
    this.forward_bias = 0
    this.auto_set_best = 15
    this.auto_adjust_eta = 5
    this.auto_adjust_epsilon = 2

    // Trackers
    this.episode_nr = 0
    this.best_score = -Infinity
    this.best_lap_time = Infinity
    this.scores = []
    this.avg_scores = []
    this.epsilons = []
    this.episodes_since_best = 0

    this.params = null
    this.best_params = null

    this.got_batch = null
    this.weights = [[[]]]

    this.last_set_to_best = 0
  }

  set_default_settings() {
    let net_controller = document.value.net_controller
    net_controller.eta = .01
    net_controller.epsilon = 1
    net_controller.epsilon_decay = .95
    net_controller.gamma = .99
    net_controller.batch_size = 32
    net_controller.change_buffer_size(100000)
    net_controller.double_dqn = true
    net_controller.target_update_time = 1000

    this.world.set_default_map()
    this.world.friction = .93

    this.state = 'train'

    this.printing = false
    this.max_steps = Infinity
    this.score_at_wall = -10
    this.score_at_target = 1
    this.no_target_time = 150
    this.only_forward_targets = false
    this.force_forward = .3
    this.force_forward_player = true
    this.forward_bias = 0
    this.auto_set_best = 15
    this.auto_adjust_eta = 5
    this.auto_adjust_epsilon = 2

    this.reset()
    document.value.controller.settings_update_values()
  }

  load_best() {
    let net_controller = document.value.net_controller
    net_controller.set_params(BEST_PARAMS.layer_design, BEST_PARAMS.parameters)
    net_controller.epsilon = 0
    net_controller.eta = 0

    this.world.friction = .93

    this.printing = false
    this.max_steps = Infinity
    this.force_forward = .3
    this.forward_bias = 0
    this.auto_set_best = Infinity
    this.auto_ajust_eta = Infinity
    this.auto_ajust_epsilon = Infinity    

    this.last_set_to_best = 0    
  }

  set_best() {
    document.value.net_controller.set_params(this.best_params.layer_design, this.best_params.parameters)
    this.last_set_to_best = 0
  }

  get_weights(nn) {
    if (this.got_batch == nn.target_update_timer) return

    this.weights = nn.get_weights()

    this.got_batch = nn.target_update_timer
  }

  update() {

    this.world.update()

  }

  finish_episode() {
    this.episode_nr++

    this.scores.unshift(this.world.score)

    this.episodes_since_best++
    if (this.world.score > this.best_score) {
      this.best_score = this.world.score
      this.episodes_since_best = 0
      if (this.best_lap_time == Infinity) this.best_params = this.params
    }

    // Get average score over the past 100 episodes
    let average = 0
    for (let s = 0; s < 100 && this.scores[s]; s++) {
      let score = this.scores[s]
      average += score
    }
    average /= Math.min(this.scores.length, 100)
    this.avg_scores.unshift(average)

    // Add current epsilon to list for graph display
    this.epsilons.unshift(document.value.net_controller.epsilon)

    this.reset()

    this.last_set_to_best++
  }

  reset() {
    this.world.reset()
    this.params = document.value.net_controller.get_params()
  }
}

Game.World = class {
  constructor(game, friction = 0.93, lap_length=40, speed_multiplier=.7) {
    this.game = game
    // .93 is a decent value for friction? .92 lately
    // friction at .9 is easier but less interesting to watch

    // TODO: play around with the speed multiplier

    this.height   = 1000
    this.width    = 1500

    this.lap_length = lap_length

    this.friction = friction 

    this.score = 0
    this.lap = 0
    this.lap_steps = 0

    this.map = {
      targets: [],
      walls: []
    }
    let track_width = this.init_map()
    this.player   = new Game.World.Player(this.width, this.height, track_width, speed_multiplier)

    this.added_segment = {
      wall: null,
      target: null,
    }

  }

  init_map(track_ratio=.3) {
    let outside_points = []
    let inside_points = []
    let center = {x: this.width/2, y: this.height/2}
    let ratio = this.width/this.height
    let outer_size = this.height/2
    let inner_size = outer_size*(1-track_ratio)

    // Make list of coordinates around an ellipse for outer and inner borders
    for (let angle = .001; angle < Math.PI*2; angle +=Math.PI*2/this.lap_length) {
      let size = outer_size
      // The add_coords function translates the coordinates so the center is actually the center
      let outside_point = add_coords({x: ratio * size*Math.cos(angle), y: size*Math.sin(angle)}, center)
      outside_points.push(outside_point)
      size = inner_size
      let inside_point = add_coords({x: ratio * size*Math.cos(angle), y: size*Math.sin(angle)}, center)
      inside_points.push(inside_point)
    }    

    // Add the walls and targets
    for (let p in outside_points) {
      p = parseInt(p)
      let point = outside_points[p]
      let next_point = outside_points[p+1]
      if (!next_point) {
        next_point = outside_points[0]
      }
      this.map.walls.push(new Game.World.Wall(point, next_point))

      let inside_point = inside_points[p]
      let next_inside_point = inside_points[p+1]
      if (!next_inside_point) {
        next_inside_point = inside_points[0]
      }
      this.map.walls.push(new Game.World.Wall(inside_point, next_inside_point))   

      this.map.targets.push(new Game.World.Target(point, inside_point))
    }

    return outer_size-inner_size
  }

  get_map() {
    let result = {
      walls: [], targets: [],
      player_pos: {
        x: this.player.starting_x,
        y: this.player.starting_y,
        dir: this.player.starting_direction,
      }
    }

    for (let type of ["walls", "targets"]) {
      for (let obj of this.map[type]) {
        result[type].push([
          {
            x: obj.start.x,
            y: obj.start.y,
          },
          {
            x: obj.end.x,
            y: obj.end.y,
          }
        ])
      }      
    }
    return result
  }

  set_map(map) {
    this.map = {walls: [], targets: []}

    for (let tuple of map.walls) {
      this.map.walls.push(
        new Game.World.Wall(tuple[0], tuple[1])
      )
    }
    for (let tuple of map.targets) {
      this.map.targets.push(
        new Game.World.Target(tuple[0], tuple[1])
      )
    }

    let pos = map.player_pos
    this.set_starting_pos(pos, pos.dir)

    this.game.reset()
    this.game.best_params = {layer_design: [], parameters: []}
    this.game.best_score = -Infinity
    this.game.best_lap_time = Infinity    
  }

  set_default_map() {
    this.map = {walls: [], targets: []}
    this.init_map()
    this.game.reset()
    this.game.best_params = {layer_design: [], parameters: []}
    this.game.best_score = -Infinity
    this.game.best_lap_time = Infinity   
  }

  update() {

    this.player.update()

    this.player.velocity.x *= this.friction
    this.player.velocity.y *= this.friction

    this.player.resetSensors()

    // Check wall collisions
    for (let wall of this.map.walls) {
      if (wall.collideObject(this.player)) {
        this.score += this.game.score_at_wall
        break
      }
    }

    // Check target collisions
    if (this.game.only_forward_targets) {
      for (let target of this.map.targets) {
        let collision = target.collideObject(this.player)
        switch(collision) {
          case false: break;
          case "back": this.score--; break;
          case "right" || "left" : break;
          case "front": this.score++; break;
        }
      }         
    } else {
      for (let target of this.map.targets) {
        if (target.collideObject(this.player)) {
          this.score += this.game.score_at_target
          break
        }
      }             
    }

    let lap = Math.floor(this.score / this.map.targets.length)
    if (lap > this.lap) {
      this.finish_lap(lap)
    }
    this.lap_steps++
  }

  finish_lap(lap) {
    this.lap = lap
    // We don't want to save parameters from a single lap if there was lots of randomness involved
    if (this.lap_steps < this.game.best_lap_time && document.value.net_controller.epsilon < .05) {
      this.game.best_lap_time = this.lap_steps
      this.game.best_params = this.game.params
    }
    this.game.params = document.value.net_controller.get_params()    
    this.lap_steps = 0
  }

  add_to_map(pos, type) {
    if (this.added_segment[type]) {
      // If there was already a start to a wall, finish that wall
      this.map[type+"s"].push(new Game.World[capitalize(type)](this.added_segment[type], pos))

      if (type == "target") this.added_segment[type] = null // We usually want to draw targets seperately
      else                  this.added_segment[type] = pos

    } else {
      this.added_segment[type] = pos
    }

    function capitalize(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
  }

  remove_from_map(pos) {
    let min_distance = 100 // This is the squared distance
    let min_type
    let min_counter

    for (let type of ["walls", "targets"]) {
      for (let counter in this.map[type]) {
        let segment = this.map[type][counter]
        let p0 = segment.start
        let p1 = segment.end

        // Special case if the line is exactly vertical
        if (p1.x == p0.x) {
          let x_dist_sq = Math.pow(Math.abs(pos.x-p0.x), 2)
          if (x_dist_sq > min_distance) {
            continue
          }
          // Step through the vertical line and check distance to the pos
          let max_y = Math.max(p0.y, p1.y)
          let min_y = Math.min(p0.y, p1.y)
          for (let y = min_y; y <= max_y; y++) {
            let y_dist_sq = Math.pow(Math.abs(pos.y-y), 2)
            let dist = x_dist_sq + y_dist_sq
            if (dist < min_distance) {
              min_distance  = dist
              min_type      = type
              min_counter   = counter
            }
          }
        } else {
          // Get slope and intersect
          let a = (p1.y-p0.y)/(p1.x-p0.x)
          let b = p0.y - a*p0.x

          // Step through the sloped line and check distance to pos
          let max_x = Math.max(p0.x, p1.x)
          let min_x = Math.min(p0.x, p1.x)
          for (let x = min_x; x <= max_x; x++) {
            let y = a*x + b
            let x_dist_sq = Math.pow(Math.abs(pos.x-x), 2)
            let y_dist_sq = Math.pow(Math.abs(pos.y-y), 2)
            let dist = x_dist_sq + y_dist_sq
            if (dist < min_distance) {
              min_distance  = dist
              min_type      = type
              min_counter   = counter
            }          
          }          
        }
      }
    }

    if (min_type && min_counter) {
      this.map[min_type].splice(min_counter, 1)
    }
  }

  set_starting_pos(pos, dir) {
    this.player.starting_x = pos.x
    this.player.starting_y = pos.y
    this.player.starting_direction = dir
  }

  reset() {
    this.score = 0
    this.lap = 0
    for (let target of this.map.targets) {
      // Reset timeouts for all targets so they reappear
      target.timeout = 0
    }
    this.player.reset()

    this.added_segment = {
      wall: null,
      target: null,
    }
  }

}

Game.World.Object = class {
  constructor(start, end) {
    this.start = start
    this.end =  end
  }

  collideObject(object) {

    let object_borders = object.getBorders()

    let p0 = this.start
    let p1 = this.end

    let left_bound = Math.min(p0.x, p1.x)
    let right_bound = Math.max(p0.x, p1.x)

    let a = (p1.y - p0.y)/(p1.x - p0.x)
    let b = p0.y - a * p0.x

    // Loop through all object borders
    for (let object_border of Object.entries(object_borders) ) {
      let border_name = object_border[0]
      let border_points = object_border[1]

      let q0 = border_points[0]
      let q1 = border_points[1]

      let left_bound_object = Math.min(q0.x, q1.x)
      let right_bound_object = Math.max(q0.x, q1.x)

      let c = (q1.y - q0.y)/(q1.x - q0.x)
      let d = q0.y - c * q0.x

      // Get x-value of the intersection with the following formula:
      // ax+b=cx+d -> (a-c)x=d-b -> x=(d-b)/(a-c) 
      let intersect_x = (d-b)/(a-c)
      let intersection = {x: intersect_x, y: a*intersect_x + b}

      // Add intersections for distance detection
      if (this.type == "wall" && intersect_x >= left_bound && intersect_x <= right_bound) {

        let distance0 = get_distance(intersection, q0)
        let distance1 = get_distance(intersection, q1)
        let side
        if (distance0 < distance1) {
          side = 0
        } else {
          side = 1
        }

        let direction
        let corner_name
        switch(border_name) {
          case "front":   direction = "side";     if(side == 0) corner_name = "frontLeft";  else corner_name = "frontRight";  break
          case "left":    direction = "straight"; if(side == 0) corner_name = "frontLeft";  else corner_name = "backLeft";    break
          case "right":   direction = "straight"; if(side == 0) corner_name = "frontRight"; else corner_name = "backRight";   break
          case "back":    direction = "side";     if(side == 0) corner_name = "backLeft";   else corner_name = "backRight";
        }

        // If there was already an intersection with another wall from this sensor
        let distance = Math.min(distance0, distance1)
        let former_distance = object.sensors[corner_name][direction].distance
        if(!former_distance || distance < former_distance) {
          object.sensors[corner_name][direction].x        = intersect_x
          object.sensors[corner_name][direction].y        = a*intersect_x + b
          object.sensors[corner_name][direction].distance = distance          
        }
      }

      // Check if there is a collision
      if (intersect_x >= left_bound && intersect_x <= right_bound && intersect_x >= left_bound_object && intersect_x <= right_bound_object) {
        object.collision(this.type)
        if ( this.collision() ) {
          return border_name          
        }
      }

    }

    // Loop through additional sensors
    for (let sensor of ["diagFrontLeft", "diagFrontRight"] ) {
      let border_points = object_borders.front

      let q0
      switch(sensor) {
        case "diagFrontLeft": 
          q0 = border_points[0]
          break
        case "diagFrontRight":
          q0 = border_points[1]
          break
      }
      let q1 = {x: object.getCx(), y: object.getCy()}

      let c = (q1.y - q0.y)/(q1.x - q0.x)
      let d = q0.y - c * q0.x

      /* ax+b=cx+d -> (a-c)x=d-b -> x=(d-b)/(a-c) */
      let intersect_x = (d-b)/(a-c)
      let intersection = {x: intersect_x, y: a*intersect_x + b}

      // Add intersections for distance detection
      if (this.type == "wall" && intersect_x >= left_bound && intersect_x <= right_bound) {

        let distance0 = get_distance(intersection, q0)
        let distance1 = get_distance(intersection, q1)
        let side
        if (distance0 < distance1) {
          side = 0
        } else {
          continue
        }

        let direction = "diag"
        let corner_name
        switch(sensor) {
          case "diagFrontLeft":   corner_name = "frontLeft";  break
          case "diagFrontRight":  corner_name = "frontRight";  break
        }

        // If there was already an intersection with another wall from this sensor
        let distance = distance0
        let former_distance = object.sensors[corner_name][direction].distance
        if(!former_distance || distance < former_distance) {
          object.sensors[corner_name][direction].x        = intersect_x
          object.sensors[corner_name][direction].y        = a*intersect_x + b
          object.sensors[corner_name][direction].distance = distance            
        }
      }
    }

    // Set object to normal if no collisions
    object.noCollision(this.type)
    this.noCollision()
    return false

  }

  collision() {return true}

  noCollision() {}
}

Game.World.Target = class extends Game.World.Object {
  constructor(start, end) {
    super(start, end)
    this.type = "target"
    this.timeout = 0
  }

  collision() {
    let res = (this.timeout == 0)
    this.timeout = 100 
    return res
  }

  noCollision() {
    if (this.timeout > 0) {
      this.timeout--
    }
  }
}

Game.World.Wall = class extends Game.World.Object {
  constructor(start, end) {
    super(start, end)
    this.type = "wall"
  }
}

Game.World.Player = class {
  constructor(world_width, world_height, track_width, speed_multiplier) {
    this.color1     = "#ff0000";
    this.color2     = "#f0f0f0";
    this.height     = world_height/20;
    this.width      = this.height/2;
    this.velocity   = {
      x: 0,
      y: 0,
    }

    this.starting_direction = 0;
    this.starting_x         = world_width/2 - this.height;
    if (Math.random() > 0) {
      this.starting_y       = track_width/2 - this.width;
    } else {
      this.starting_y       = world_height - track_width/2 - this.width/2;
    }

    this.direction  = this.starting_direction
    this.x          = this.starting_x
    this.y          = this.starting_y
 
    this.turn_speed = -.1 * speed_multiplier
    this.acceleration = 2 * speed_multiplier

    this.collided = false

    this.sensors = {
      frontLeft: {
        straight: {x: null, y: null, distance: 0, enabled: false},
        side:     {x: null, y: null, distance: 0, enabled: false},
        diag:     {x: null, y: null, distance: 0, enabled: false},
      },
      frontRight: {
        straight: {x: null, y: null, distance: 0, enabled: false},
        side:     {x: null, y: null, distance: 0, enabled: false},
        diag:     {x: null, y: null, distance: 0, enabled: false},
      },
      backLeft: {
        straight: {x: null, y: null, distance: 0, enabled: false},
        side:     {x: null, y: null, distance: 0, enabled: false},
      },
      backRight: {
        straight: {x: null, y: null, distance: 0, enabled: false},
        side:     {x: null, y: null, distance: 0, enabled: false},
      },
    }
  }

  reset() {
    this.velocity   = {
      x: 0,
      y: 0,
    }    

    this.direction  = this.starting_direction
    // if (Math.random() > .5) {this.direction = Math.PI}
    this.x          = this.starting_x
    this.y          = this.starting_y

    this.resetSensors()

    this.noCollision("wall")
  }

  set_sensors(sensors=[{corner: "frontLeft", dirs: ["straight", "side"]}, {corner: "frontRight", dirs: ["straight", "side"]}]) {
    for (let sensor of sensors) {
      for (let dir of sensor.dirs) {
        this.sensors[sensor.corner][dir].enabled = true
      }
    }
  }

  getCx() {
    return this.x + this.width / 2
  }

  getCy() {
    return this.y + this.height / 2
  }

  rotateToDirection(p) {
    // Simple rotation matrix
    return {
      x: p.x * Math.cos(this.direction) + -p.y * Math.sin(this.direction),
      y: p.x * Math.sin(this.direction) +  p.y * Math.cos(this.direction),
    }
  }

  getCorners() {
    // Height and width are swapped here because the car is facing the right at first so height is in the x direction
    let cx = this.getCx()
    let cy = this.getCy()
    let cp = {x: cx, y: cy}
    return {
      frontLeft:  add_coords( cp, this.rotateToDirection({x:  this.height/2, y: -this.width/2}) ),
      frontRight: add_coords( cp, this.rotateToDirection({x:  this.height/2, y:  this.width/2}) ),
      backLeft:   add_coords( cp, this.rotateToDirection({x: -this.height/2, y: -this.width/2}) ),
      backRight:  add_coords( cp, this.rotateToDirection({x: -this.height/2, y:  this.width/2}) ),
    }
  }

  getBorders() {
    let corners = this.getCorners()
    return {
      front: [ {x: corners.frontLeft.x,  y: corners.frontLeft.y},  {x: corners.frontRight.x, y: corners.frontRight.y} ],
      left:  [ {x: corners.frontLeft.x,  y: corners.frontLeft.y},  {x: corners.backLeft.x,   y: corners.backLeft.y} ],
      right: [ {x: corners.frontRight.x, y: corners.frontRight.y}, {x: corners.backRight.x,  y: corners.backRight.y} ],
      back:  [ {x: corners.backLeft.x,   y: corners.backLeft.y},   {x: corners.backRight.x,  y: corners.backRight.y} ],
    }
  }

  collision(collisionObject) {
    switch(collisionObject) {
      case "wall":
        this.collided = true
        this.color1 = "rgb(255,0,0,.2)"
        break
      case "target":

    }
  }

  noCollision(collisionObject) {
    switch(collisionObject) {
      case "wall":
        this.collided = false
        this.color1 = "#ff0000"
        break
      case "target":
    }   
  }  

  resetSensors() {
    // Reset the sensors
    for (let corner_sensors of Object.values(this.sensors) ) {
      for (let dir of Object.values(corner_sensors)) {
        dir.x = null
        dir.y = null
        dir.distance = 0
      }
    }      
  }

  moveForward(factor=1 - document.value.game.force_forward) {
    if (vector_signed_length(this.velocity, this.direction) < 50) {
      this.velocity = add_to_vector(this.velocity, this.direction, factor*this.acceleration)
    }
  }
  moveBackward() {    
    if (vector_signed_length(this.velocity, this.direction) > -10) {
      this.velocity = add_to_vector(this.velocity, this.direction, -this.acceleration)
    }
  }

  turnLeft()  {
    let turn_speed = this.turn_speed * Math.min(vector_length(this.velocity)/5, 1)
    this.direction += turn_speed
  }
  turnRight() { 
    let turn_speed = this.turn_speed * Math.min(vector_length(this.velocity)/5, 1)
    this.direction -= turn_speed
  }  

  update() {

    this.x += this.velocity.x;
    this.y += this.velocity.y;

    let game = document.value.game
    if (game.state == "drive" && !game.force_forward_player)  { return }
    else if (game.force_forward)                              { this.moveForward(game.force_forward) }
  }

};

function add_coords(p0, p1) {
  return {
    x: p0.x + p1.x,
    y: p0.y + p1.y
  }
}

function get_distance(p0, p1) {
  return vector_length({x: p0.x - p1.x, y: p0.y - p1.y})
}

function vector_length(vector) {
  let x = vector.x
  let y = vector.y
  return Math.sqrt( Math.pow(x, 2) + Math.pow(y, 2) )
}

function vector_sign(vector, direction) {
  // Basically it checks whether the direction angle is on the same side of the unit circle as the velocity angle
  direction = -direction

  let x = vector.x
  let y = vector.y

  let velocity_angle = Math.sign(y) * Math.PI
  if (x != 0)
    velocity_angle = Math.atan(-y/x) + Math.PI*(x < 0)
  if (velocity_angle < 0) velocity_angle = 2*Math.PI + velocity_angle

  let res = Math.abs( (direction - velocity_angle + Math.PI) % (2*Math.PI) )
  if (res > 2.2 && res < 4.1)
    return -1
  return 1
}

function vector_signed_length(vector, direction) {
  return vector_length(vector) * vector_sign(vector, direction)
}

function add_to_vector(vector, direction, strength) {
  return {
    x: vector.x + Math.cos(direction) * strength,
    y: vector.y + Math.sin(direction) * strength,
  }
}

const TRACKS = [
  `
{"walls":[[{"x":29.67032967032967,"y":459.63756177924216},{"x":82.41758241758242,"y":306.4250411861614}],[{"x":82.41758241758242,"y":306.4250411861614},{"x":181.3186813186813,"y":184.51400329489292}],[{"x":181.3186813186813,"y":184.51400329489292},{"x":316.4835164835165,"y":103.78912685337727}],[{"x":316.4835164835165,"y":103.78912685337727},{"x":466.4835164835165,"y":46.12850082372323}],[{"x":466.4835164835165,"y":46.12850082372323},{"x":634.6153846153846,"y":28.00658978583196}],[{"x":634.6153846153846,"y":28.00658978583196},{"x":771.4285714285714,"y":23.064250411861615}],[{"x":771.4285714285714,"y":23.064250411861615},{"x":964.2857142857143,"y":46.12850082372323}],[{"x":964.2857142857143,"y":46.12850082372323},{"x":1137.3626373626373,"y":93.90444810543657}],[{"x":1137.3626373626373,"y":93.90444810543657},{"x":1289.010989010989,"y":176.27677100494233}],[{"x":1289.010989010989,"y":176.27677100494233},{"x":1384.6153846153845,"y":283.36079077429986}],[{"x":1384.6153846153845,"y":283.36079077429986},{"x":1440.6593406593406,"y":401.97693574958816}],[{"x":1440.6593406593406,"y":401.97693574958816},{"x":1465.3846153846155,"y":515.6507413509061}],[{"x":1465.3846153846155,"y":515.6507413509061},{"x":1457.142857142857,"y":655.6836902800659}],[{"x":1457.142857142857,"y":655.6836902800659},{"x":1397.8021978021977,"y":807.2487644151565}],[{"x":1397.8021978021977,"y":807.2487644151565},{"x":1293.956043956044,"y":915.9802306425041}],[{"x":1293.956043956044,"y":915.9802306425041},{"x":1117.5824175824175,"y":963.7561779242175}],[{"x":1117.5824175824175,"y":963.7561779242175},{"x":908.2417582417582,"y":927.5123558484349}],[{"x":908.2417582417582,"y":927.5123558484349},{"x":774.7252747252747,"y":767.7100494233937}],[{"x":774.7252747252747,"y":767.7100494233937},{"x":705.4945054945055,"y":701.8121911037891}],[{"x":705.4945054945055,"y":701.8121911037891},{"x":606.5934065934066,"y":685.337726523888}],[{"x":606.5934065934066,"y":685.337726523888},{"x":545.6043956043956,"y":728.171334431631}],[{"x":545.6043956043956,"y":728.171334431631},{"x":448.35164835164835,"y":836.9028006589785}],[{"x":448.35164835164835,"y":836.9028006589785},{"x":300,"y":886.326194398682}],[{"x":300,"y":886.326194398682},{"x":130.21978021978023,"y":869.8517298187809}],[{"x":130.21978021978023,"y":869.8517298187809},{"x":16.483516483516482,"y":766.0626029654036}],[{"x":16.483516483516482,"y":766.0626029654036},{"x":3.2967032967032965,"y":640.8566721581549}],[{"x":3.2967032967032965,"y":640.8566721581549},{"x":11.538461538461538,"y":533.7726523887974}],[{"x":11.538461538461538,"y":533.7726523887974},{"x":29.67032967032967,"y":459.63756177924216}],[{"x":580.2197802197802,"y":163.09719934102142},{"x":754.945054945055,"y":158.15485996705107}],[{"x":754.945054945055,"y":158.15485996705107},{"x":919.7802197802198,"y":179.57166392092256}],[{"x":919.7802197802198,"y":179.57166392092256},{"x":1078.021978021978,"y":228.99505766062603}],[{"x":1078.021978021978,"y":228.99505766062603},{"x":1206.5934065934066,"y":314.66227347611203}],[{"x":1206.5934065934066,"y":314.66227347611203},{"x":1269.2307692307693,"y":436.57331136738054}],[{"x":1269.2307692307693,"y":436.57331136738054},{"x":1282.4175824175825,"y":561.7792421746293}],[{"x":1282.4175824175825,"y":561.7792421746293},{"x":1249.4505494505495,"y":685.337726523888}],[{"x":1249.4505494505495,"y":685.337726523888},{"x":1193.4065934065934,"y":736.4085667215816}],[{"x":1193.4065934065934,"y":736.4085667215816},{"x":1078.021978021978,"y":746.2932454695223}],[{"x":1078.021978021978,"y":746.2932454695223},{"x":1018.6813186813187,"y":716.6392092257001}],[{"x":1018.6813186813187,"y":716.6392092257001},{"x":929.6703296703297,"y":614.4975288303131}],[{"x":929.6703296703297,"y":614.4975288303131},{"x":839.010989010989,"y":532.1252059308073}],[{"x":839.010989010989,"y":532.1252059308073},{"x":715.3846153846154,"y":492.5864909390445}],[{"x":715.3846153846154,"y":492.5864909390445},{"x":570.3296703296703,"y":481.0543657331137}],[{"x":570.3296703296703,"y":481.0543657331137},{"x":436.8131868131868,"y":533.7726523887974}],[{"x":436.8131868131868,"y":533.7726523887974},{"x":365.9340659340659,"y":609.5551894563426}],[{"x":365.9340659340659,"y":609.5551894563426},{"x":298.35164835164835,"y":673.8056013179572}],[{"x":298.35164835164835,"y":673.8056013179572},{"x":229.12087912087912,"y":678.7479406919275}],[{"x":229.12087912087912,"y":678.7479406919275},{"x":194.5054945054945,"y":647.4464579901153}],[{"x":194.5054945054945,"y":647.4464579901153},{"x":181.3186813186813,"y":570.0164744645799}],[{"x":181.3186813186813,"y":570.0164744645799},{"x":222.52747252747253,"y":410.2141680395387}],[{"x":222.52747252747253,"y":410.2141680395387},{"x":288.46153846153845,"y":296.54036243822077}],[{"x":288.46153846153845,"y":296.54036243822077},{"x":403.84615384615387,"y":212.52059308072486}],[{"x":403.84615384615387,"y":212.52059308072486},{"x":583.5164835164835,"y":163.09719934102142}]],"targets":[[{"x":662.6373626373627,"y":39.53871499176277},{"x":664.2857142857143,"y":148.27018121911038}],[{"x":771.4285714285714,"y":39.53871499176277},{"x":763.1868131868132,"y":151.5650741350906}],[{"x":873.6263736263736,"y":52.71828665568369},{"x":857.1428571428571,"y":159.8023064250412}],[{"x":977.4725274725274,"y":72.48764415156508},{"x":952.7472527472528,"y":181.2191103789127}],[{"x":1089.5604395604396,"y":98.84678747940691},{"x":1053.2967032967033,"y":210.87314662273477}],[{"x":1196.7032967032967,"y":144.97528830313016},{"x":1135.7142857142858,"y":252.05930807248765}],[{"x":1289.010989010989,"y":214.168039538715},{"x":1213.1868131868132,"y":303.1301482701812}],[{"x":1256.043956043956,"y":378.91268533772654},{"x":1373.076923076923,"y":304.7775947281713}],[{"x":1282.4175824175825,"y":459.63756177924216},{"x":1417.5824175824175,"y":421.74629324546953}],[{"x":1290.6593406593406,"y":553.5420098846787},{"x":1442.3076923076924,"y":553.5420098846787}],[{"x":1279.1208791208792,"y":649.0939044481055},{"x":1419.2307692307693,"y":695.2224052718286}],[{"x":1221.4285714285713,"y":721.5815485996706},{"x":1345.0549450549452,"y":825.3706754530477}],[{"x":1167.032967032967,"y":757.8253706754531},{"x":1229.6703296703297,"y":914.332784184514}],[{"x":1101.098901098901,"y":757.8253706754531},{"x":1117.5824175824175,"y":945.6342668863261}],[{"x":1025.2747252747254,"y":731.4662273476112},{"x":979.1208791208791,"y":909.3904448105436}],[{"x":880.2197802197802,"y":850.0823723228995},{"x":985.7142857142857,"y":701.8121911037891}],[{"x":817.5824175824176,"y":792.4217462932455},{"x":954.3956043956044,"y":660.6260296540362}],[{"x":768.1318681318681,"y":738.0560131795717},{"x":893.4065934065934,"y":601.3179571663921}],[{"x":731.8681318681319,"y":706.7545304777594},{"x":817.5824175824176,"y":540.3624382207578}],[{"x":689.010989010989,"y":678.7479406919275},{"x":731.8681318681319,"y":512.3558484349259}],[{"x":634.6153846153846,"y":670.5107084019769},{"x":654.3956043956044,"y":499.17627677100495}],[{"x":595.054945054945,"y":668.8632619439868},{"x":563.7362637362637,"y":499.17627677100495}],[{"x":557.1428571428571,"y":695.2224052718286},{"x":496.15384615384613,"y":535.4200988467875}],[{"x":520.8791208791209,"y":719.9341021416803},{"x":420.3296703296703,"y":581.5485996705107}],[{"x":478.02197802197804,"y":779.2421746293245},{"x":374.1758241758242,"y":647.4464579901153}],[{"x":398.9010989010989,"y":825.3706754530477},{"x":334.61538461538464,"y":667.2158154859967}],[{"x":309.8901098901099,"y":855.0247116968699},{"x":281.86813186813185,"y":693.5749588138385}],[{"x":224.17582417582418,"y":845.1400329489292},{"x":237.36263736263737,"y":698.5172981878089}],[{"x":126.92307692307692,"y":823.7232289950576},{"x":207.69230769230768,"y":675.4530477759473}],[{"x":39.56043956043956,"y":749.5881383855025},{"x":174.72527472527472,"y":650.7413509060956}],[{"x":32.967032967032964,"y":594.7281713344316},{"x":168.13186813186815,"y":586.490939044481}],[{"x":56.043956043956044,"y":469.5222405271829},{"x":186.26373626373626,"y":497.52883031301485}],[{"x":93.95604395604396,"y":344.3163097199341},{"x":214.28571428571428,"y":390.44481054365735}],[{"x":159.8901098901099,"y":257.001647446458},{"x":257.14285714285717,"y":313.01482701812193}],[{"x":260.43956043956047,"y":168.03953871499175},{"x":329.6703296703297,"y":243.82207578253707}],[{"x":379.1208791208791,"y":107.0840197693575},{"x":412.0879120879121,"y":179.57166392092256}],[{"x":260.31294452347083,"y":697.8723404255319},{"x":266.7140825035562,"y":851.063829787234}],[{"x":217.63869132290185,"y":687.2340425531914},{"x":172.8307254623044,"y":838.2978723404256}],[{"x":187.76671408250357,"y":661.7021276595744},{"x":78.94736842105263,"y":787.2340425531914}],[{"x":174.96443812233287,"y":614.8936170212766},{"x":29.871977240398294,"y":663.8297872340426}]],"player_pos":{"x":600,"y":67.54530477759472,"dir":0}}
  `,`
{"walls":[[{"x":733.8551859099804,"y":35.08771929824562},{"x":918.7866927592955,"y":52.63157894736842}],[{"x":918.7866927592955,"y":52.63157894736842},{"x":1106.6536203522505,"y":105.26315789473684}],[{"x":1106.6536203522505,"y":105.26315789473684},{"x":1268.1017612524463,"y":187.1345029239766}],[{"x":1268.1017612524463,"y":187.1345029239766},{"x":1394.3248532289629,"y":321.6374269005848}],[{"x":1394.3248532289629,"y":321.6374269005848},{"x":1473.5812133072407,"y":426.90058479532166}],[{"x":1473.5812133072407,"y":426.90058479532166},{"x":1488.2583170254404,"y":573.0994152046784}],[{"x":1488.2583170254404,"y":573.0994152046784},{"x":1458.9041095890411,"y":801.1695906432749}],[{"x":1458.9041095890411,"y":801.1695906432749},{"x":1382.583170254403,"y":900.5847953216374}],[{"x":1382.583170254403,"y":900.5847953216374},{"x":1209.3933463796477,"y":976.6081871345029}],[{"x":1209.3933463796477,"y":976.6081871345029},{"x":995.1076320939335,"y":982.4561403508771}],[{"x":995.1076320939335,"y":982.4561403508771},{"x":851.2720156555773,"y":897.6608187134503}],[{"x":851.2720156555773,"y":897.6608187134503},{"x":772.0156555772994,"y":751.4619883040936}],[{"x":772.0156555772994,"y":751.4619883040936},{"x":733.8551859099804,"y":602.3391812865497}],[{"x":733.8551859099804,"y":602.3391812865497},{"x":645.7925636007827,"y":514.6198830409356}],[{"x":645.7925636007827,"y":514.6198830409356},{"x":493.1506849315069,"y":482.4561403508772}],[{"x":493.1506849315069,"y":482.4561403508772},{"x":337.573385518591,"y":479.53216374269005}],[{"x":337.573385518591,"y":479.53216374269005},{"x":152.64187866927594,"y":453.2163742690058}],[{"x":152.64187866927594,"y":453.2163742690058},{"x":35.22504892367906,"y":336.2573099415205}],[{"x":35.22504892367906,"y":336.2573099415205},{"x":20.54794520547945,"y":175.43859649122808}],[{"x":20.54794520547945,"y":175.43859649122808},{"x":96.86888454011742,"y":70.17543859649123}],[{"x":96.86888454011742,"y":70.17543859649123},{"x":208.41487279843443,"y":40.93567251461988}],[{"x":208.41487279843443,"y":40.93567251461988},{"x":346.37964774951075,"y":23.391812865497077}],[{"x":346.37964774951075,"y":23.391812865497077},{"x":733.8551859099804,"y":35.08771929824562}],[{"x":331.70254403131116,"y":163.74269005847952},{"x":642.8571428571429,"y":169.5906432748538}],[{"x":642.8571428571429,"y":169.5906432748538},{"x":904.1095890410959,"y":201.75438596491227}],[{"x":904.1095890410959,"y":201.75438596491227},{"x":1091.9765166340508,"y":292.39766081871346}],[{"x":1091.9765166340508,"y":292.39766081871346},{"x":1218.1996086105676,"y":406.4327485380117}],[{"x":1218.1996086105676,"y":406.4327485380117},{"x":1282.7788649706458,"y":482.4561403508772}],[{"x":1282.7788649706458,"y":482.4561403508772},{"x":1300.3913894324853,"y":587.719298245614}],[{"x":1300.3913894324853,"y":587.719298245614},{"x":1273.972602739726,"y":707.6023391812865}],[{"x":1273.972602739726,"y":707.6023391812865},{"x":1227.0058708414872,"y":783.625730994152}],[{"x":1227.0058708414872,"y":783.625730994152},{"x":1141.8786692759295,"y":818.7134502923976}],[{"x":1141.8786692759295,"y":818.7134502923976},{"x":1080.2348336594912,"y":818.7134502923976}],[{"x":1080.2348336594912,"y":818.7134502923976},{"x":1009.784735812133,"y":771.9298245614035}],[{"x":1009.784735812133,"y":771.9298245614035},{"x":980.4305283757338,"y":657.8947368421053}],[{"x":980.4305283757338,"y":657.8947368421053},{"x":968.6888454011741,"y":570.1754385964912}],[{"x":968.6888454011741,"y":570.1754385964912},{"x":942.2700587084149,"y":500}],[{"x":942.2700587084149,"y":500},{"x":874.7553816046967,"y":418.12865497076024}],[{"x":874.7553816046967,"y":418.12865497076024},{"x":786.6927592954991,"y":362.5730994152047}],[{"x":786.6927592954991,"y":362.5730994152047},{"x":681.0176125244618,"y":315.7894736842105}],[{"x":681.0176125244618,"y":315.7894736842105},{"x":484.3444227005871,"y":289.4736842105263}],[{"x":484.3444227005871,"y":289.4736842105263},{"x":322.89628180039136,"y":286.5497076023392}],[{"x":322.89628180039136,"y":286.5497076023392},{"x":252.44618395303326,"y":257.3099415204678}],[{"x":252.44618395303326,"y":257.3099415204678},{"x":240.7045009784736,"y":219.2982456140351}],[{"x":240.7045009784736,"y":219.2982456140351},{"x":264.18786692759295,"y":181.28654970760235}],[{"x":264.18786692759295,"y":181.28654970760235},{"x":299.41291585127203,"y":166.66666666666666}],[{"x":299.41291585127203,"y":166.66666666666666},{"x":334.63796477495106,"y":163.74269005847952}]],"targets":[[{"x":393.34637964774953,"y":32.16374269005848},{"x":384.54011741682973,"y":154.97076023391813}],[{"x":613.5029354207436,"y":38.01169590643275},{"x":601.7612524461839,"y":157.89473684210526}],[{"x":860.0782778864971,"y":61.40350877192982},{"x":842.4657534246576,"y":184.21052631578948}],[{"x":1097.8473581213307,"y":122.80701754385964},{"x":1047.945205479452,"y":263.1578947368421}],[{"x":1256.3600782778865,"y":210.52631578947367},{"x":1159.491193737769,"y":336.2573099415205}],[{"x":1379.647749510763,"y":339.1812865497076},{"x":1262.2309197651664,"y":444.44444444444446}],[{"x":1303.3268101761253,"y":549.7076023391813},{"x":1473.5812133072407,"y":520.46783625731}],[{"x":1285.7142857142858,"y":695.906432748538},{"x":1450.0978473581213,"y":739.766081871345}],[{"x":1215.2641878669276,"y":804.093567251462},{"x":1300.3913894324853,"y":918.1286549707602}],[{"x":1097.8473581213307,"y":833.3333333333334},{"x":1094.9119373776907,"y":959.0643274853801}],[{"x":909.9804305283757,"y":915.2046783625731},{"x":1006.8493150684932,"y":786.5497076023391}],[{"x":789.6281800391389,"y":733.9181286549708},{"x":971.6242661448141,"y":672.514619883041}],[{"x":733.8551859099804,"y":581.8713450292398},{"x":909.9804305283757,"y":476.60818713450294}],[{"x":628.1800391389432,"y":491.2280701754386},{"x":698.6301369863014,"y":342.10526315789474}],[{"x":487.279843444227,"y":464.9122807017544},{"x":519.5694716242662,"y":307.0175438596491}],[{"x":331.70254403131116,"y":447.36842105263156},{"x":355.18590998043055,"y":301.16959064327483}],[{"x":123.28767123287672,"y":397.6608187134503},{"x":255.38160469667318,"y":277.77777777777777}],[{"x":52.83757338551859,"y":304.093567251462},{"x":240.7045009784736,"y":239.76608187134502}],[{"x":44.031311154598825,"y":181.28654970760235},{"x":228.9628180039139,"y":201.75438596491227}],[{"x":143.83561643835617,"y":84.7953216374269},{"x":249.51076320939336,"y":175.43859649122808}],[{"x":499.45054945054943,"y":41.18616144975288},{"x":491.2087912087912,"y":151.5650741350906}],[{"x":751.6483516483516,"y":49.42339373970346},{"x":728.5714285714286,"y":158.15485996705107}],[{"x":985.7142857142857,"y":87.31466227347612},{"x":951.0989010989011,"y":205.9308072487644}],[{"x":1175.2747252747254,"y":161.4497528830313},{"x":1112.6373626373627,"y":285.00823723228996}],[{"x":1330.2197802197802,"y":276.77100494233935},{"x":1216.4835164835165,"y":383.85502471169684}],[{"x":1302.1978021978023,"y":489.29159802306424},{"x":1453.8461538461538,"y":415.1565074135091}],[{"x":1310.4395604395604,"y":619.4398682042834},{"x":1460.4395604395604,"y":640.8566721581549}],[{"x":1265.934065934066,"y":751.2355848434926},{"x":1399.4505494505495,"y":846.7874794069193}],[{"x":1163.7362637362637,"y":823.7232289950576},{"x":1190.10989010989,"y":953.8714991762768}],[{"x":1056.5934065934066,"y":812.1911037891268},{"x":998.9010989010989,"y":967.0510708401977}],[{"x":832.4175824175824,"y":823.7232289950576},{"x":979.1208791208791,"y":738.0560131795717}],[{"x":774.7252747252747,"y":649.0939044481055},{"x":956.0439560439561,"y":571.66392092257}],[{"x":695.6043956043956,"y":540.3624382207578},{"x":804.3956043956044,"y":395.38714991762765}],[{"x":570.3296703296703,"y":476.11202635914333},{"x":604.945054945055,"y":321.2520593080725}],[{"x":412.0879120879121,"y":449.7528830313015},{"x":436.8131868131868,"y":306.4250411861614}],[{"x":227.47252747252747,"y":443.163097199341},{"x":296.7032967032967,"y":291.5980230642504}],[{"x":754.945054945055,"y":367.38056013179573},{"x":665.934065934066,"y":510.70840197693576}],[{"x":649.4505494505495,"y":327.84184514003294},{"x":596.7032967032967,"y":481.0543657331137}],[{"x":560.4395604395604,"y":316.30971993410213},{"x":530.7692307692307,"y":461.28500823723226}],[{"x":240.65934065934067,"y":261.94398682042834},{"x":84.06593406593407,"y":354.2009884678748}],[{"x":42.857142857142854,"y":230.64250411861613},{"x":224.17582417582418,"y":219.11037891268535}],[{"x":92.3076923076923,"y":113.67380560131795},{"x":235.71428571428572,"y":192.7512355848435}],[{"x":194.5054945054945,"y":60.95551894563427},{"x":262.0879120879121,"y":169.68698517298188}],[{"x":271.97802197802196,"y":283.36079077429986},{"x":179.67032967032966,"y":434.92586490939044}],[{"x":323.0769230769231,"y":306.4250411861614},{"x":286.8131868131868,"y":461.28500823723226}],[{"x":390.65934065934067,"y":309.7199341021417},{"x":375.8241758241758,"y":456.34266886326196}],[{"x":479.6703296703297,"y":309.7199341021417},{"x":451.64835164835165,"y":451.4003294892916}],[{"x":855.4945054945055,"y":429.9835255354201},{"x":708.7912087912088,"y":551.8945634266886}],[{"x":725.2747252747253,"y":357.495881383855},{"x":651.0989010989011,"y":494.2339373970346}],[{"x":782.967032967033,"y":382.20757825370674},{"x":682.4175824175824,"y":522.2405271828666}],[{"x":675.8241758241758,"y":331.1367380560132},{"x":613.1868131868132,"y":484.3492586490939}],[{"x":827.4725274725274,"y":413.5090609555189},{"x":702.1978021978022,"y":543.6573311367381}],[{"x":619.7802197802198,"y":326.19439868204284},{"x":588.4615384615385,"y":472.8171334431631}]],"player_pos":{"x":302.3483365949119,"y":64.32748538011695,"dir":0}}
  `,`
{"walls":[[{"x":220.87912087912088,"y":79.07742998352553},{"x":293.4065934065934,"y":39.53871499176277}],[{"x":293.4065934065934,"y":39.53871499176277},{"x":385.7142857142857,"y":16.474464579901152}],[{"x":385.7142857142857,"y":16.474464579901152},{"x":529.1208791208791,"y":14.827018121911038}],[{"x":529.1208791208791,"y":14.827018121911038},{"x":674.1758241758242,"y":3.2948929159802307}],[{"x":674.1758241758242,"y":3.2948929159802307},{"x":819.2307692307693,"y":13.179571663920923}],[{"x":819.2307692307693,"y":13.179571663920923},{"x":956.0439560439561,"y":32.948929159802304}],[{"x":956.0439560439561,"y":32.948929159802304},{"x":1109.3406593406594,"y":56.01317957166392}],[{"x":1109.3406593406594,"y":56.01317957166392},{"x":1224.7252747252746,"y":79.07742998352553}],[{"x":1224.7252747252746,"y":79.07742998352553},{"x":1328.5714285714287,"y":131.79571663920922}],[{"x":1328.5714285714287,"y":131.79571663920922},{"x":1442.3076923076924,"y":196.04612850082373}],[{"x":1442.3076923076924,"y":196.04612850082373},{"x":1480.2197802197802,"y":288.30313014827016}],[{"x":1480.2197802197802,"y":288.30313014827016},{"x":1493.4065934065934,"y":439.8682042833608}],[{"x":1493.4065934065934,"y":439.8682042833608},{"x":1476.923076923077,"y":596.3756177924217}],[{"x":1476.923076923077,"y":596.3756177924217},{"x":1447.2527472527472,"y":695.2224052718286}],[{"x":1447.2527472527472,"y":695.2224052718286},{"x":1414.2857142857142,"y":780.8896210873147}],[{"x":1414.2857142857142,"y":780.8896210873147},{"x":1336.8131868131868,"y":891.2685337726524}],[{"x":1336.8131868131868,"y":891.2685337726524},{"x":1280.7692307692307,"y":922.5700164744645}],[{"x":1280.7692307692307,"y":922.5700164744645},{"x":1158.7912087912089,"y":965.4036243822076}],[{"x":1158.7912087912089,"y":965.4036243822076},{"x":1035.1648351648353,"y":955.5189456342669}],[{"x":1035.1648351648353,"y":955.5189456342669},{"x":959.3406593406594,"y":924.2174629324547}],[{"x":959.3406593406594,"y":924.2174629324547},{"x":857.1428571428571,"y":856.67215815486}],[{"x":857.1428571428571,"y":856.67215815486},{"x":807.6923076923077,"y":797.3640856672158}],[{"x":807.6923076923077,"y":797.3640856672158},{"x":778.021978021978,"y":723.2289950576607}],[{"x":778.021978021978,"y":723.2289950576607},{"x":743.4065934065934,"y":644.1515650741351}],[{"x":743.4065934065934,"y":644.1515650741351},{"x":702.1978021978022,"y":616.1449752883032}],[{"x":702.1978021978022,"y":616.1449752883032},{"x":619.7802197802198,"y":594.7281713344316}],[{"x":619.7802197802198,"y":594.7281713344316},{"x":514.2857142857143,"y":586.490939044481}],[{"x":514.2857142857143,"y":586.490939044481},{"x":441.75824175824175,"y":593.0807248764415}],[{"x":441.75824175824175,"y":593.0807248764415},{"x":384.0659340659341,"y":612.8500823723228}],[{"x":384.0659340659341,"y":612.8500823723228},{"x":291.75824175824175,"y":612.8500823723228}],[{"x":291.75824175824175,"y":612.8500823723228},{"x":168.13186813186815,"y":560.1317957166392}],[{"x":168.13186813186815,"y":560.1317957166392},{"x":77.47252747252747,"y":490.93904448105434}],[{"x":77.47252747252747,"y":490.93904448105434},{"x":52.747252747252745,"y":431.63097199341024}],[{"x":52.747252747252745,"y":431.63097199341024},{"x":23.076923076923077,"y":352.55354200988467}],[{"x":23.076923076923077,"y":352.55354200988467},{"x":29.67032967032967,"y":275.12355848434925}],[{"x":29.67032967032967,"y":275.12355848434925},{"x":75.82417582417582,"y":153.2125205930807}],[{"x":75.82417582417582,"y":153.2125205930807},{"x":220.87912087912088,"y":79.07742998352553}],[{"x":517.5824175824176,"y":112.02635914332784},{"x":649.4505494505495,"y":121.91103789126853}],[{"x":649.4505494505495,"y":121.91103789126853},{"x":761.5384615384615,"y":121.91103789126853}],[{"x":761.5384615384615,"y":121.91103789126853},{"x":886.8131868131868,"y":144.97528830313016}],[{"x":886.8131868131868,"y":144.97528830313016},{"x":1017.032967032967,"y":168.03953871499175}],[{"x":1017.032967032967,"y":168.03953871499175},{"x":1104.3956043956043,"y":196.04612850082373}],[{"x":1104.3956043956043,"y":196.04612850082373},{"x":1171.978021978022,"y":227.3476112026359}],[{"x":1171.978021978022,"y":227.3476112026359},{"x":1249.4505494505495,"y":261.94398682042834}],[{"x":1229.6703296703297,"y":752.8830313014827},{"x":1183.5164835164835,"y":785.831960461285}],[{"x":1183.5164835164835,"y":785.831960461285},{"x":1119.2307692307693,"y":785.831960461285}],[{"x":1119.2307692307693,"y":785.831960461285},{"x":1050,"y":766.0626029654036}],[{"x":1050,"y":766.0626029654036},{"x":975.8241758241758,"y":751.2355848434926}],[{"x":975.8241758241758,"y":751.2355848434926},{"x":932.967032967033,"y":701.8121911037891}],[{"x":932.967032967033,"y":701.8121911037891},{"x":896.7032967032967,"y":611.2026359143327}],[{"x":896.7032967032967,"y":611.2026359143327},{"x":868.6813186813187,"y":535.4200988467875}],[{"x":868.6813186813187,"y":535.4200988467875},{"x":801.0989010989011,"y":499.17627677100495}],[{"x":801.0989010989011,"y":499.17627677100495},{"x":670.8791208791209,"y":459.63756177924216}],[{"x":670.8791208791209,"y":459.63756177924216},{"x":593.4065934065934,"y":454.6952224052718}],[{"x":593.4065934065934,"y":454.6952224052718},{"x":481.31868131868134,"y":461.28500823723226}],[{"x":481.31868131868134,"y":461.28500823723226},{"x":405.4945054945055,"y":467.8747940691928}],[{"x":405.4945054945055,"y":467.8747940691928},{"x":336.2637362637363,"y":472.8171334431631}],[{"x":336.2637362637363,"y":472.8171334431631},{"x":268.68131868131866,"y":449.7528830313015}],[{"x":268.68131868131866,"y":449.7528830313015},{"x":201.0989010989011,"y":401.97693574958816}],[{"x":201.0989010989011,"y":401.97693574958816},{"x":168.13186813186815,"y":350.90609555189457}],[{"x":168.13186813186815,"y":350.90609555189457},{"x":173.07692307692307,"y":283.36079077429986}],[{"x":173.07692307692307,"y":283.36079077429986},{"x":229.12087912087912,"y":200.98846787479408}],[{"x":229.12087912087912,"y":200.98846787479408},{"x":306.5934065934066,"y":168.03953871499175}],[{"x":306.5934065934066,"y":168.03953871499175},{"x":398.9010989010989,"y":126.85337726523888}],[{"x":398.9010989010989,"y":126.85337726523888},{"x":524.1758241758242,"y":113.67380560131795}],[{"x":1250,"y":263.768115942029},{"x":1316.860465116279,"y":342.0289855072464}],[{"x":1316.860465116279,"y":342.0289855072464},{"x":1319.7674418604652,"y":478.2608695652174}],[{"x":1319.7674418604652,"y":478.2608695652174},{"x":1290.6976744186047,"y":631.8840579710145}],[{"x":1290.6976744186047,"y":631.8840579710145},{"x":1226.7441860465117,"y":756.5217391304348}]],"targets":[[{"x":591.7582417582418,"y":19.769357495881383},{"x":585.1648351648352,"y":107.0840197693575}],[{"x":677.4725274725274,"y":13.179571663920923},{"x":665.934065934066,"y":108.73146622734761}],[{"x":766.4835164835165,"y":26.359143327841846},{"x":754.945054945055,"y":110.37891268533772}],[{"x":885.1648351648352,"y":39.53871499176277},{"x":867.032967032967,"y":128.500823723229}],[{"x":990.6593406593406,"y":56.01317957166392},{"x":972.5274725274726,"y":149.91762767710048}],[{"x":1089.5604395604396,"y":70.84019769357496},{"x":1063.1868131868132,"y":171.334431630972}],[{"x":1190.10989010989,"y":87.31466227347612},{"x":1150.5494505494505,"y":204.2833607907743}],[{"x":1284.065934065934,"y":131.79571663920922},{"x":1223.076923076923,"y":240.52718286655684}],[{"x":1394.5054945054944,"y":184.51400329489292},{"x":1293.956043956044,"y":289.9505766062603}],[{"x":1340.10989010989,"y":336.0790774299835},{"x":1453.8461538461538,"y":278.4184514003295}],[{"x":1341.7582417582419,"y":421.74629324546953},{"x":1467.032967032967,"y":403.62438220757826}],[{"x":1335.1648351648353,"y":517.2981878088962},{"x":1467.032967032967,"y":527.1828665568369}],[{"x":1326.923076923077,"y":609.5551894563426},{"x":1440.6593406593406,"y":639.2092257001648}],[{"x":1300.5494505494505,"y":685.337726523888},{"x":1414.2857142857142,"y":744.6457990115322}],[{"x":1260.989010989011,"y":751.2355848434926},{"x":1356.5934065934066,"y":830.3130148270182}],[{"x":1200,"y":790.7742998352553},{"x":1257.6923076923076,"y":902.8006589785832}],[{"x":1119.2307692307693,"y":800.658978583196},{"x":1130.7692307692307,"y":948.9291598023065}],[{"x":1033.5164835164835,"y":779.2421746293245},{"x":995.6043956043956,"y":924.2174629324547}],[{"x":959.3406593406594,"y":752.8830313014827},{"x":883.5164835164835,"y":850.0823723228995}],[{"x":824.1758241758242,"y":775.9472817133443},{"x":918.1318681318681,"y":710.0494233937397}],[{"x":784.6153846153846,"y":691.9275123558484},{"x":891.7582417582418,"y":635.9143327841845}],[{"x":723.6263736263736,"y":609.5551894563426},{"x":789.5604395604396,"y":520.5930807248765}],[{"x":660.989010989011,"y":574.9588138385502},{"x":693.9560439560439,"y":487.64415156507414}],[{"x":761.5384615384615,"y":650.7413509060956},{"x":852.1978021978022,"y":560.1317957166392}],[{"x":590.1098901098901,"y":560.1317957166392},{"x":590.1098901098901,"y":459.63756177924216}],[{"x":520.8791208791209,"y":566.7215815485997},{"x":497.8021978021978,"y":469.5222405271829}],[{"x":464.83516483516485,"y":570.0164744645799},{"x":433.5164835164835,"y":479.4069192751236}],[{"x":385.7142857142857,"y":586.490939044481},{"x":374.1758241758242,"y":472.8171334431631}],[{"x":306.5934065934066,"y":593.0807248764415},{"x":316.4835164835165,"y":476.11202635914333}],[{"x":202.74725274725276,"y":553.5420098846787},{"x":263.7362637362637,"y":462.9324546952224}],[{"x":135.16483516483515,"y":505.7660626029654},{"x":206.04395604395606,"y":421.74629324546953}],[{"x":72.52747252747253,"y":421.74629324546953},{"x":161.53846153846155,"y":364.0856672158155}],[{"x":47.8021978021978,"y":303.1301482701812},{"x":153.2967032967033,"y":314.66227347611203}],[{"x":77.47252747252747,"y":210.87314662273477},{"x":174.72527472527472,"y":250.41186161449752}],[{"x":148.35164835164835,"y":144.97528830313016},{"x":206.04395604395606,"y":204.2833607907743}],[{"x":237.36263736263737,"y":93.90444810543657},{"x":273.6263736263736,"y":158.15485996705107}],[{"x":316.4835164835165,"y":49.42339373970346},{"x":346.15384615384613,"y":130.14827018121912}]],"player_pos":{"x":540.6593406593406,"y":39.53871499176277,"dir":0}}  
  `
]

const BEST_PARAMS = JSON.parse(`
{"layer_design":[7,16,3],"parameters":[{},{"biases":[-0.23960824375909517,0.9063600045673994,-0.23707181516667852,-0.10866352665480493,0.25869917057662295,0.42441947562384463,0.12945813760713365,0.21394429917077598,0.6944736816316428,0.05388793262857041,-0.23572465398031428,0.11903368289956481,-0.11951810785418149,-0.1352644080197527,0.29586896536731727,0.6317016796768116],"weights":[[0.22604349923283792,-0.12161635607778266,0.21297740431604748,-0.1633078159825398,-0.19858525328942028,-0.10400875141870995,0.2511154104088249],[-0.8109366761393928,0.37573646955935514,1.146152199835487,0.06578392687419797,-0.952199884384619,-0.07266540557905331,0.5716844541368162],[-0.1358550786428232,0.03163385526556639,0.08072602820890407,-0.04346195961081567,0.03767134706367303,0.18218351334658345,0.060471941011693064],[-0.21638658331277819,-0.01602621875489131,-0.08445595774496062,0.19740222731890159,-0.06507670665104424,0.14509483542004212,-0.234239559430526],[-0.2620168278605397,0.3341555111069204,0.2966317748287606,0.1689734653389448,-0.14094620685394565,0.3518419816351859,-0.3568698565964869],[1.39125095106571,-1.3498530823602901,-1.0446895018141609,-0.24016335007132456,1.9651452385535217,-0.4867536969828718,-0.07783121509737162],[-0.01840479365509175,-0.22193817394398574,0.16891576825551408,-0.09433375156530906,0.19732609966979603,0.15592913057657268,-0.26501700985869636],[0.546011490363733,-0.6812098219542739,-0.4704260476715641,-0.17035840694735002,1.1997203703810295,-0.47640214500443906,-0.2309121915452489],[-0.2916830767216082,0.6583307938215155,0.9333361188749276,-0.17350115108171413,-0.503540977359464,0.3120712586541257,0.2801693183787242],[-0.07844460585545417,0.30110288330717955,-0.15618903685358634,0.09872576477498962,0.18558831342603677,0.2459431592145935,-0.12700989622868797],[0.12048557086126577,0.24686546009691812,-0.22614429521161172,0.020875005258570778,0.011177182954011156,0.0892834446273556,-0.21762041919685837],[0.03960083338652318,-0.27124297884501436,-0.15614782080669162,0.10086345176351108,0.23699865113730018,-0.378426517571094,0.28475583037708946],[-0.07207973206341484,0.11243341017963825,0.014548194439562134,-0.22689478265480015,0.18693250163074243,0.1207647169804494,-0.22315798286698815],[-0.018169356970191175,0.058220559478177614,-0.2279387786488979,0.0433863999082692,-0.13208832565260276,0.028978117914647994,0.026582196140808145],[0.4357683136925345,-0.6943729469798265,-0.4825640316711214,-0.1846733585031166,0.9568753046976937,-0.3612366737575214,-0.0003351341253896772],[1.4997950690942503,-1.2231058598911735,-1.6156444900827696,-0.2208732267499747,2.2635007357989414,-0.10591733783772612,-0.6509134327100046],[]]},{"biases":[0.5289592665715805,0.4077670687828839,0.3961364755885307],"weights":[[0.02809679012379814,0.7848832405907775,0.2151184246448551,0.12706625520415732,0.6729871101667285,-1.8818870561702783,0.11840972666523744,-1.1365614699610778,0.9381714074357976,0.35835004927541625,-0.049023268551724786,-0.5028129450178149,0.16689363086042353,-0.034835294726803356,-1.0731093544426102,-2.1465933958882375],[-0.11372569380045215,1.3803542043870594,0.1060642090554259,-0.11149882826823662,-0.13314525317793074,-1.2425670395399553,-0.0971325397332847,-0.9070668399749978,0.8028523898457595,-0.30127304014628664,0.11084576329878804,0.2308165339256179,-0.04566879968104116,-0.031143073068952476,-0.5840631586706958,-2.0045538891197183],[-0.23350376901223843,1.2538698471818353,-0.23388964406170798,0.15820817116886354,0.3761565306625328,-1.972581015411874,-0.21563122825707423,-0.7077811865022903,0.7442825750354678,-0.11981986445018343,-0.10063012737512023,-0.23273100700585256,-0.17107714765748916,0.16932122688459816,-0.6851859299256566,-1.8722393680570113],[]]}]}
`)