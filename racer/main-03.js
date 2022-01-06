window.addEventListener("load", function(event) {

  "use strict";

    ///////////////////
   //// FUNCTIONS ////
  ///////////////////

  var keyDownUp = function(event) {
    controller.keyDownUp(event.type, event.keyCode)
  }

  var resize = function(event) {
    display.resize(document.documentElement.clientWidth - 32, document.documentElement.clientHeight - 32, game.world.height / game.world.width)
    display.render()
  }

  var render = function() {

    display.updateStats(game, netController)
    display.updateGraph(game)

    game.get_weights(netController)
    display.drawWeights(game.weights)
    display.drawActivations(
      activations,
      ["Left", "Right", "Forward"],
    )

    display.drawMap(game.world.map)
    display.drawPlayer(game.world.player, game.world.player.color)

    display.render()
 
  }

  var update = function() {

    if (game.state == "drive") {
      drive_update()
    }
    else if (game.state == "train") {
      train_update()
    }
    else if (game.state == "draw") {
      draw_update()
    }

  }

  function draw_update() {
    if (controller.del) { game.world.remove_from_map(controller.position) }
  }

  function train_update() {
    if (game.world.switched_map) {
      // netController.replay_memory = []
      fill_replay_memory(.2)
      game.world.switched_map = false
    }

    score = game.world.score

    if (game.world.player.collided || last_score_increase > game.no_target_time || game.ep_timesteps > game.max_steps) {
      last_score_increase = 0

      netController.update()

      game.finish_episode()

      // If there's no improvement, give it a little push
      if (netController.eta != 0) {
        let stagnation = check_stagnation(game.scores, 10)

        if (game.printing) {
          console.log("Episode: "+game.episode_nr)
          if (stagnation) { console.log(`stagnated: ${stagnation} episodes`) }
        }

        if (stagnation >= game.auto_adjust_eta && netController.eta < netController.eta_begin*.5) {
          netController.eta = netController.eta_begin*.5
          if (game.printing) console.log(`stagnation: learning rate ajusted; eta = ${netController.eta}`)
        }

        if (stagnation >= game.auto_adjust_epsilon && netController.epsilon < .5) {
          netController.epsilon += .05
          if (game.printing) console.log(`stagnation: epsilon increased; epsilon+=.03`)
        }

        if (game.episodes_since_best > game.auto_set_best && game.last_set_to_best > game.auto_set_best) {
          let avg = mean(game.scores, 0, game.auto_set_best)
          if (avg < game.world.map.targets.length*.5 && game.best_lap_time != Infinity) { // If the recent avg fell below half a lap
            // Maybe do this after the high score hasn't improved for a while?
            // Or if it's just consistently worse than the high score or even highest average score?
            game.set_best()
            netController.epsilon = 0.01
            netController.eta = netController.eta_begin*.5
            if (game.printing) console.log("avg fell: reset to best parameters. epsilon=.01, eta="+netController.eta)
          }                
        }

      }
    }

    netController.update_target_network()
    let action = netController.get_policy(get_net_input())
    activations = netController.get_activations() // for visualization
    do_action(action)

    if (game.forward_bias && action == 2) {game.world.score+=game.forward_bias}
    
    game.update()

    let done = game.world.player.collided
    let reward = game.world.score - score

    netController.store_in_memory(reward, get_net_input(), done)
    netController.SGD()

    if (reward > 0) {
      last_score_increase = 0
    } else {
      last_score_increase++
    }

    // Auto adjust eta and epsilon
    if (netController.eta != 0 && game.world.lap_steps == 1) {
      let lap = game.world.lap

      if (game.auto_adjust_epsilon != Infinity) {
        // Decrease randomness for every completed lap past two
        if (lap > 2 && netController.epsilon > netController.epsilon_end) {
          netController.epsilon*=.95
          if (game.printing) console.log("lap > 2: randomness decreased; epsilon *=.95")
        }      
      }

      if (game.auto_adjust_eta != Infinity) {
        // Make the learning rate more precise when it's completing laps
        if (lap == 2) {
          netController.eta = netController.eta_begin/10
          if (game.printing) console.log("lap == 2: learning rate adjusted; eta = " + netController.eta)
        } else if (lap == 1) {
          netController.eta = netController.eta_begin/2
          if (game.printing) console.log("lap == 1: learning rate adjusted; eta = " + netController.eta)
        }        
      }

    }    
  }

  // Manual control
  function drive_update() {
    // Just for visualization purposes
    netController.get_policy(get_net_input())
    activations = netController.get_activations()    

    if (controller.left)  { game.world.player.turnLeft();  }
    if (controller.right) { game.world.player.turnRight(); }
    if (controller.up)    { game.world.player.moveForward(); }
    if (controller.down)  { game.world.player.moveBackward(); }

    game.update()
  }

  function fill_replay_memory(portion=.2) {
    console.log("Filling replay memory:")

    let pre_episodes = 0
    for (let i = 0; i < netController.max_memory*portion; i++) {
      if (game.world.player.collided) {
        game.reset()     

        pre_episodes++
      }

      let action = netController.get_policy(get_net_input())
      do_action(action)

      let score = game.world.score
      game.update()
      let done = game.world.player.collided
      let reward = game.world.score - score
  
      netController.store_in_memory(reward, get_net_input(), done) 
    }
    console.log("Pre Episodes: ", pre_episodes)
  }

  function do_action(a) {
    for (let action of actions[a]) {
      game.world.player[action]()
    }      
    return
  }

  function get_net_input() {
    let speed = Math.sqrt(Math.pow(game.world.player.velocity.x, 2) + Math.pow(game.world.player.velocity.y, 2))
    let norm_speed = speed/15
    if (game.invert_speed) norm_speed = 1 - norm_speed
    let net_input = [norm_speed]

    for (let sensor of sensors) {
      for (let dir of sensor.dirs) {
        let dir_sensor = game.world.player.sensors[sensor.corner][dir]
        if (!dir_sensor.enabled) continue

        net_input.push(dir_sensor.distance/1000)
      }
    }
    return net_input
  }

    /////////////////
   //// OBJECTS ////
  /////////////////

  var display    = new Display()
  var controller = new Controller()
  var game       = new Game()
  var engine     = new Engine(1000/128, render, update)

  var sensors = [ // in order
    {corner: "frontLeft", dirs: ["straight"]}, 
    {corner: "frontRight", dirs: ["straight"]},
    {corner: "frontLeft", dirs: ["side"]},
    {corner: "frontRight", dirs: ["side"]},
    {corner: "frontLeft", dirs: ["diag"]},
    {corner: "frontRight", dirs: ["diag"]},
  ]

  game.world.player.set_sensors(sensors)

  var actions = [    
    ["turnLeft"],
    ["turnRight"],
    ["moveForward"],
  ]

  var netController = new NetController(
    [{x: get_net_input(), y: actions}],                   // io shape
    [{type: "Dense", size:16}], // layers
    .01,                                                 // eta
    .99, // gamma
    1000,                                                   // batch_size 32
    30000,                                                // max_memory
    1,                                                    // epsilon
    .01,                                                   // epsilon_end
    .95,                                                // epsilon_decay
    true,                                                 // double_dqn
    500                                                  // target_update_time
  )

  document.value = {
    display: display,
    controller: controller,
    game: game,
    engine: engine,
    net_controller: netController,
  }  

    ////////////////////
   //// INITIALIZE ////
  ////////////////////

  document.title = "Luuk's Racer"

  display.buffer.map.canvas.height = game.world.height
  display.buffer.map.canvas.width = game.world.width
  display.buffer.car.canvas.height = game.world.height
  display.buffer.car.canvas.width = game.world.width
  display.context.map.canvas.height = game.world.height
  display.context.map.canvas.width = game.world.width
  display.context.car.canvas.height = game.world.height
  display.context.car.canvas.width = game.world.width


  resize()

  controller.init_buttons(game)
  controller.init_settings()
  controller.init_draw()
  controller.adjust_speed_slider(1000/engine.time_step, false)
  display.graph = display.initGraph()
  fill_replay_memory()

  var score = 0 // For tracking score difference
  var last_score_increase = 0 // For tracking whether the car is still moving forward
  var activations = null

  engine.start()


  window.addEventListener("keydown", keyDownUp)
  window.addEventListener("keyup",   keyDownUp)
  window.addEventListener("resize",  resize)

})



function mean(array, begin=0, end=Infinity) {
  if (end == Infinity) end = array.length
  let sum = 0
  for (let i = begin; i < end; i++) { sum += array[i] }
  return sum / (end-begin)
}

function check_stagnation(array, end=Infinity) {
  if (end == Infinity) end = array.length-1
  let score = array[0] // score of recent round
  let stagnated
  for (stagnated = 0; stagnated < end; stagnated++) {
    // array goes from recent to old so array[stagnated+1] is the previous
    if (Math.abs(array[stagnated+1] - score) > 2 || array[stagnated+1]==undefined) { // If difference in score > 1
      break
    }
  }
  return stagnated
}