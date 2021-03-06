class Controller {
  constructor() {
    this.left  = false
    this.right = false
    this.up    = false
    this.down  = false

    this.del   = false

    this.draw_type = "wall"
    this.position = {x: null, y: null}
  }

  init_buttons() {
    document.getElementById("speed_slider").oninput = function() {
      let time_step = this.value*this.value*2
      document.value.engine.changeTimeStep(1000/time_step)
      document.value.controller.adjust_speed_slider(time_step, false)
    }

    document.getElementById("info_btn").onclick = function() {
      let div = document.getElementById("info_div")
      let display = div.style.display
      if (display == 'none') {
        div.style.display = 'block'
      } else {
        div.style.display = 'none'
      }
    }
    document.getElementById("close_info_btn").onclick = function() {
      document.getElementById("info_div").style.display = 'none'
    }

    document.getElementById("reset_btn").onclick = function() {
      document.value.net_controller.reset()
    }

    document.getElementById("save_btn").onclick = function() {
      let params = document.value.net_controller.get_params()
      let layer_design = JSON.stringify(params.layer_design)
      let score = document.value.game.world.score
      let episode_nr = document.value.game.episode_nr
      document.value.controller.download(params, `ai_racer_params_ld${layer_design}_s${score}_e${episode_nr}`)
    }
    
    document.getElementById("load_btn").oninput = function(input_event) {
      console.log("loading brain...")

      if(!window.FileReader) return // Browser is not compatible

      let reader = new FileReader()
  
      reader.onload = function(load_event) {
        if(load_event.target.readyState != 2) return
          if(load_event.target.error) {
              alert('Error while reading file')
              return
          }  
          let result = JSON.parse(load_event.target.result)

          document.value.net_controller.set_params(result.layer_design, result.parameters)
          document.value.game.reset()
      }
  
      reader.readAsText(input_event.target.files[0])

      this.value = null // Changes file to null so you can upload the same file again
    }

    document.getElementById("save_map_btn").onclick = function() {
      let object = document.value.game.world.get_map()
      document.value.controller.download(object, "ai_racer_map")
    }

    document.getElementById("load_map_btn").oninput = function(input_event) {
      if(!window.FileReader) return // Browser is not compatible

      let reader = new FileReader()
  
      reader.onload = function(load_event) {
        if(load_event.target.readyState != 2) return
          if(load_event.target.error) {
              alert('Error while reading file')
              return
          }  
          let map = JSON.parse(load_event.target.result)

          document.value.game.world.set_map(map)
      }
  
      reader.readAsText(input_event.target.files[0])

      this.value = null // Changes file to null so you can upload the same file again
    }    

    document.getElementById("drive_btn").onclick = function() {
      let time_step
      if (document.value.game.state == "drive") {
        document.value.game.state = "train"
        document.value.controller.buttons_pressed([])
        document.value.engine.changeTimeStep(null, true, false)
        time_step = 1000/document.value.engine.time_step
      } else {
        document.value.game.state = "drive"
        document.value.controller.buttons_pressed(["drive_btn"])
        time_step = 50
        document.value.engine.changeTimeStep(1000/time_step, false, true)
      }
      document.value.controller.adjust_speed_slider(time_step, false)
    }

    document.getElementById("draw_btn").onclick = function() {
      document.value.controller.buttons_pressed([])
      if (document.value.game.state == "draw") {
        document.value.game.state = "train"
        document.value.controller.toggle_draw(false)
      } else {
        document.value.game.state = "draw"
        document.value.controller.toggle_draw(true)
      }
    }

    for (let type of ["wall", "target", "car"]) {
      document.getElementById(`draw_${type}_btn`).onclick = function() {
        document.value.game.state = "draw"
        document.value.controller.draw_type = type
        document.value.controller.buttons_pressed([])
        document.value.controller.toggle_draw(true)
      }
    }

    document.getElementById("draw_dropdown").addEventListener('mouseover', function() {
      document.getElementById("draw_hover_div").style.display = "grid"
    })
    document.getElementById("draw_dropdown").addEventListener('mouseout', function() {
      document.getElementById("draw_hover_div").style.display = "none"      
    })

    document.getElementById("tracks_dropdown").addEventListener('mouseover', function() {
      document.getElementById("tracks_hover_div").style.display = "grid"
    })
    document.getElementById("tracks_dropdown").addEventListener('mouseout', function() {
      document.getElementById("tracks_hover_div").style.display = "none"      
    })
    document.getElementById("default_track_btn").onclick = function() {
      document.value.game.world.set_default_map()
    }

    for (let i of [1,2,3,4]) {
      document.getElementById(`track${i}_btn`).onclick = function() {
        let track = JSON.parse(document.value.game.tracks[i-1])
        document.value.game.world.set_map(track)
      }
    }

    document.getElementById("clear_btn").onclick = function() {
      if (document.value.game.state == "draw") {
        document.value.game.world.map = {walls: [], targets: []}
      } else {
        console.log("To clear map drawing must be enabled")
      }
    }

    document.getElementById("epsilon").oninput = function() {
      document.value.net_controller.epsilon = parseFloat(this.value)
    }
    document.getElementById("eta").oninput = function() {
      document.value.net_controller.eta = parseFloat(this.value)
      let checkbox = document.getElementById("learn_checkbox")
      if (this.value == 0) {
        checkbox.checked = false
      } else {
        checkbox.checked = true
      }
    }
    document.getElementById("learn_checkbox").onchange = function() {
      if (this.checked) {
        document.value.net_controller.eta = this.value
      } else {
        this.value = document.value.net_controller.eta
        document.value.net_controller.eta = 0
      }
    }    
  }

  adjust_speed_slider(time_step, lock) {
    let slider = document.getElementById("speed_slider")
    slider.value = Math.sqrt(time_step*.5)
    if (lock) { slider.disabled = true }
    else      { slider.disabled = false }
    document.getElementById("fps").innerHTML = time_step.toFixed(0)
  }

  init_settings() {
    this.settings_update_values()

    document.getElementById("set_default_btn").onclick = function() {
      document.value.game.set_default_settings()
    }

    document.getElementById("epsilon_decay").onchange = function() {
      document.value.net_controller.epsilon_decay = this.value
    }
    document.getElementById("gamma").onchange = function() {
      document.value.net_controller.gamma = this.value
    }
    document.getElementById("replay_buffer_size").onchange = function() {
      document.value.net_controller.change_buffer_size(parseInt(this.value))
    }
    document.getElementById("batch_size").onchange = function() {
      document.value.net_controller.batch_size = this.value
    }
    document.getElementById("double_dqn").onchange = function() {
      document.value.net_controller.double_dqn = this.checked
    }
    document.getElementById("target_net_timer").onchange = function() {
      document.value.net_controller.target_update_time = this.value
    }

    document.getElementById("episode_limit").onchange = function() {
      document.value.game.max_steps = this.value
    }
    document.getElementById("target_score").onchange = function() {
      document.value.game.score_at_target = parseInt(this.value)
    }
    document.getElementById("collision_score").onchange = function() {
      document.value.game.score_at_wall = parseInt(this.value)
    }        
    document.getElementById("friction").onchange = function() {
      document.value.game.world.friction = this.value
    }
    document.getElementById("lap_length").onchange = function() {
      document.value.game.world.lap_length = this.value
      document.value.game.world.set_default_map()
    }
    document.getElementById("load_best_btn").onclick = function() {
      document.value.game.load_best()
    }

    document.getElementById("invert_speed").onchange = function() {
      document.value.game.invert_speed = this.checked
    }
    document.getElementById("target_timeout").onchange = function() {
      document.value.game.no_target_time = this.value
    }    
    document.getElementById("force_forward").onchange = function() {
      document.value.game.force_forward = this.value
    }
    document.getElementById("force_forward_player").onchange = function() {
      document.value.game.force_forward_player = this.checked
    }
    document.getElementById("forward_bias").onchange = function() {
      document.value.game.forward_bias = this.value
    }
    document.getElementById("auto_set_best").onchange = function() {
      document.value.game.auto_set_best = this.value
    }
    document.getElementById("auto_adjust_eta").onchange = function() {
      document.value.game.auto_adjust_eta = this.value
    }
    document.getElementById("auto_adjust_epsilon").onchange = function() {
      document.value.game.auto_adjust_epsilon = this.value
    }
    document.getElementById("printing").onchange = function() {
      document.value.game.printing = this.checked
    }

  }

  settings_update_values() {
    document.getElementById("epsilon_decay").value = document.value.net_controller.epsilon_decay
    document.getElementById("gamma").value = document.value.net_controller.gamma
    document.getElementById("replay_buffer_size").value = document.value.net_controller.max_memory
    document.getElementById("batch_size").value = document.value.net_controller.batch_size
    document.getElementById("double_dqn").checked = document.value.net_controller.double_dqn
    document.getElementById("target_net_timer").value = document.value.net_controller.target_update_time

    document.getElementById("episode_limit").value = document.value.game.max_steps
    document.getElementById("target_score").value = document.value.game.score_at_target
    document.getElementById("collision_score").value = document.value.game.score_at_wall
    document.getElementById("friction").value = document.value.game.world.friction
    document.getElementById("lap_length").value = document.value.game.world.lap_length

    document.getElementById("invert_speed").checked = document.value.game.invert_speed
    document.getElementById("target_timeout").value = document.value.game.no_target_time
    document.getElementById("force_forward").value = document.value.game.force_forward
    document.getElementById("force_forward_player").checked = document.value.game.force_forward_player
    document.getElementById("forward_bias").value = document.value.game.forward_bias
    document.getElementById("auto_set_best").value = document.value.game.auto_set_best
    document.getElementById("auto_adjust_eta").value = document.value.game.auto_adjust_eta
    document.getElementById("auto_adjust_epsilon").value = document.value.game.auto_adjust_epsilon
    document.getElementById("printing").checked = document.value.game.printing
  }

  toggle_draw(turn_on) {
    let draw_type = document.value.controller.draw_type
    document.getElementById(`draw_${draw_type}_btn`).setAttribute('class', "btn btn-primary")
    if (turn_on) {
      document.getElementById(`draw_btn`).setAttribute('class', "btn btn-primary")
      document.getElementById("draw_buttons_div").style.display = "grid"
      document.getElementById("content_top_right_bar_div").style["grid-template-columns"] = "auto auto auto auto"

      let time_step = 25
      document.value.engine.changeTimeStep(1000/time_step, false, true)
      document.value.controller.adjust_speed_slider(time_step, true)
    } else {
      document.getElementById("draw_buttons_div").style.display = "none"
      document.getElementById("content_top_right_bar_div").style["grid-template-columns"] = "auto auto auto"

      document.value.engine.changeTimeStep(null, true, false)
      let time_step = 1000/document.value.engine.time_step
      document.value.controller.adjust_speed_slider(time_step, false)      
    }
    document.value.game.reset()
  }

  buttons_pressed(buttons) {
    let pressable_buttons = [
      "drive_btn", "draw_btn", "draw_wall_btn", "draw_target_btn", "draw_car_btn",
    ]
    for (let button_id of pressable_buttons) {
      document.getElementById(button_id).setAttribute('class', "btn")
    }      
    for (let button_id of buttons) {
      document.getElementById(button_id).setAttribute('class', "btn btn-primary")
    }
    document.value.controller.toggle_draw(false) // The draw button uses a different function
  }  

  init_draw() {
    // Prevent context menu on canvas because right mouse click has another purpose
    document.getElementById("map_canvas").addEventListener('contextmenu', function(event) {
      event.preventDefault()
      return false
    })
    // Right-click to cancel the wall segment you started
    document.getElementById("map_canvas").addEventListener('mousedown', function(event) { 
      if (event.button != 2) return
      document.value.game.world.reset()
    })
    // Add wall segment when clicking
    document.getElementById("map_canvas").onclick = function() {
      let position = document.value.controller.position
      let draw_type = document.value.controller.draw_type
      if (draw_type == "car") {
        document.value.game.world.set_starting_pos(position, 0)
        document.value.game.world.reset()
      } else {
        document.value.game.world.add_to_map(position, draw_type)
      }
    }
    // Set position of controller when moving mouse over the canvas
    document.getElementById("map_canvas").addEventListener('mousemove', function(event) {
      let game = document.value.game
      let display = document.value.display
      document.value.controller.position = {
        x: event.offsetX * game.world.width  / display.context.map.canvas.offsetWidth,
        y: event.offsetY * game.world.height / display.context.map.canvas.offsetHeight,
      }
    })

  }

  download(object, filename) {
    let string = JSON.stringify(object)
    let hidden_element = document.createElement('a')
  
    hidden_element.href = "data:attachment/text," + encodeURI(string)
    hidden_element.target = '_blank'
    hidden_element.download = `${filename}.txt`
    hidden_element.click()
  }

  keyDownUp(type, key_code) {

    let down = (type == "keydown")
    
    switch(key_code) {

      case 37: this.left = down;  break;
      case 38: this.up = down;    break;
      case 39: this.right = down; break;
      case 40: this.down = down;  break;

      case 46: this.del = down; break;
      
      case 66: this.B = down;     break;
      case 84: this.T = down;     break;

    }

  }  
}