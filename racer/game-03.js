// Frank Poth 03/23/2018

class Game {
  constructor() {
    this.only_forward_targets = false
    this.score_at_wall = -10
    this.score_at_target = 1
    this.no_target_time = 150 // Infinity or 150 for example

    this.state = 'train' // can be train, draw, drive

    this.world = new Game.World(this)

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
  }

  set_best() {
    document.value.net_controller.set_params(this.best_params.layer_design, this.best_params.parameters)
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
  }

  reset() {
    this.world.reset()
    this.params = document.value.net_controller.get_params()
  }
}

Game.World = class {
  constructor(game, friction = 0.94, lap_length=40, speed_multiplier=.7) {
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
    if (this.lap_steps < this.game.best_lap_time) {
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
          // object.sensors[corner_name][direction] = {x: intersect_x, y: a*intersect_x + b, distance: distance}

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
          // object.sensors[corner_name][direction] = {x: intersect_x, y: a*intersect_x + b, distance: distance}

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

    // this.direction  = -Math.PI/2;
    // this.x          = track_width;
    // this.y          = world_height/2 - this.width;
 
    this.turn_speed = -.1 * speed_multiplier
    this.acceleration = 2 * speed_multiplier
    // this.steering = 0

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

  moveForward(factor=1) {   
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
    //  * vector_sign(this.velocity, this.direction)
    this.direction += turn_speed
  }
  turnRight() { 
    let turn_speed = this.turn_speed * Math.min(vector_length(this.velocity)/5, 1)
    //  * vector_sign(this.velocity, this.direction)
    this.direction -= turn_speed
  }  

  // turnLeft()  {
  //   this.steering += this.turn_speed/10
  // }
  // turnRight() { 
  //   this.steering -= this.turn_speed/10
  // }

  update() {

    this.moveForward(.005)

    this.x += this.velocity.x;
    this.y += this.velocity.y;
    // this.direction += this.steering;

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
  // I don't really understand how I did this but it's given me a lot of trouble so I gave up trying to simplify and just accepted that it worked
  // Basically it checks whether the direction angle is on the same side of the unit circle as the velocity angle
  direction = -direction

  let x = vector.x
  let y = vector.y

  let velocity_angle = Math.sign(y) * Math.PI
  if (x != 0)
    velocity_angle = Math.atan(-y/x) + Math.PI*(x < 0)
  if (velocity_angle < 0) velocity_angle = 2*Math.PI + velocity_angle

  let res = Math.abs( (direction - velocity_angle + Math.PI) % (2*Math.PI) )
  // console.log("direction", direction % (2*Math.PI))
  // console.log("angle", velocity_angle)
  // console.log(res)
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