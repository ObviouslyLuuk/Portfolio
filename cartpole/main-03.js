window.addEventListener("load", function(event) {

  "use strict";

    ///////////////////
   //// FUNCTIONS ////
  ///////////////////

  var keyDownUp = function(event) {

    controller.keyDownUp(event.type, event.keyCode);

  }

  var resize = function(event) {

    display.resize(document.documentElement.clientWidth - 32, document.documentElement.clientHeight - 32, game.world.height / game.world.width);
    display.render();

  }

  var render = function() {

    display.updateStats(game, netController)
    display.updateGraph(game)

    game.get_weights(netController)
    display.drawWeights(game.weights)
    display.drawActivations(
      activations,
      ["Left", "Right"],
    )

    display.drawWorld(game.world) 
    display.render()      

  }

  var update = function() {

    switch(game.state) {
      case "drive": drive_update(); break
      case "train": train_update(); break
    }

  }

  function train_update() {
    if (game.world.done) {    

      netController.update()

      game.finish_episode()
    }

    netController.update_target_network()
    let action = netController.get_policy(state)
    activations = netController.get_activations()
    
    let res = game.world.update(actions[action])
    state = Object.values(res.state)

    netController.store_in_memory(res.reward, state, game.world.done)
    netController.SGD()
  }

  function drive_update() {
    // Just for visualization purposes
    netController.get_policy(state)
    activations = netController.get_activations()
    
    if (game.world.done) {    
      game.reset()
    }
    let res = game.world.update("") // empty action to just update
    state = Object.values(res.state)

    // Manual controls --------------------------------------------------
    if (controller.right) { game.world.update("moveRight"); }
    if (controller.left)  { game.world.update("moveLeft"); }
    // ------------------------------------------------------------------
  }

  function fill_replay_memory() {
    console.log("Filling replay memory:")

    for (let i = 0; i < netController.max_memory; i++) {
      if (game.world.done) {
        game.world.reset()
      }

      let action = netController.get_policy(state)

      let res = game.world.update(actions[action])
      state = Object.values(res.state)

      netController.store_in_memory(res.reward, state, game.world.done) 
    }
  }

    /////////////////
   //// OBJECTS ////
  /////////////////

  var controller = new Controller()
  var game       = new Game()
  var display    = new Display(game.world)
  var engine     = new Engine(1000/60, render, update)

  var actions = [
    "moveRight",
    "moveLeft",
  ]
  var state = Object.values(game.world.state)

  var netController = new NetController(
    [{x: state, y: actions}], // io shape
    [{type: "Dense", size:16}], // layers
    .001,  // eta
    1, // gamma .99
    64,    // batch_size
    50000, // max_memory
    1,     // epsilon
    .01,   // epsilon_end
    .995, // epsilon_decay
    true, // double_dqn
    500 // target_update_time (maybe start low like at 100 and then build it up for stability?)
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

  display.buffer.cart.canvas.height = game.world.height
  display.buffer.cart.canvas.width  = game.world.width

  resize()

  display.init(game.world)

  controller.init_buttons(game)
  controller.init_settings()
  controller.adjust_speed_slider(1000/engine.time_step)
  display.graph = display.initGraph()
  fill_replay_memory()

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