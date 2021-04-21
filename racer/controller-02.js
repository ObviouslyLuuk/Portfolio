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
      document.getElementById("fps").innerHTML = time_step
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
      document.value.controller.download(params, `ai_racer_params_ld${layer_design}_s${score}`)
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
      if (document.value.game.state == "drive") {
        document.value.game.state = "train"
        document.value.controller.buttons_pressed([])
      } else {
        document.value.game.state = "drive"
        document.value.controller.buttons_pressed(["drive_btn"])
      }
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
      document.value.game.world.map = {walls:[],targets:[]}
      document.value.game.world.init_map()
      document.value.game.reset()
    }

    for (let i of [1,2,3]) {
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

  toggle_draw(turn_on) {
    // TODO: Set a decent engine timestep?
    
    let draw_type = document.value.controller.draw_type
    document.getElementById(`draw_${draw_type}_btn`).setAttribute('class', "btn btn-primary")
    if (turn_on) {
      document.getElementById(`draw_btn`).setAttribute('class', "btn btn-primary")
      document.getElementById("draw_buttons_div").style.display = "grid"
      document.getElementById("content_top_right_bar_div").style["grid-template-columns"] = "auto auto auto auto"
    } else {
      document.getElementById("draw_buttons_div").style.display = "none"
      document.getElementById("content_top_right_bar_div").style["grid-template-columns"] = "auto auto auto"
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