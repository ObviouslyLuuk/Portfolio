class Controller {
  constructor() {

    this.left  = false
    this.right = false

  }

  init_buttons() {
    document.getElementById("speed_slider").oninput = function() {
      let time_step = this.value*this.value*2
      document.value.engine.changeTimeStep(1000/time_step)
      document.value.controller.adjust_speed_slider(time_step)
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
      document.value.controller.download(params, `ai_cart_params_ld${layer_design}_s${score}_e${episode_nr}`)
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

    document.getElementById("drive_btn").onclick = function() {
      let time_step
      if (document.value.game.state == "drive") {
        document.value.game.state = "train"
        document.getElementById("drive_btn").setAttribute('class', "btn")
        
        document.value.engine.changeTimeStep(null, true, false)
        time_step = 1000/document.value.engine.time_step
      } else {
        document.value.game.state = "drive"
        document.getElementById("drive_btn").setAttribute('class', "btn btn-primary")
        
        time_step = 50
        document.value.engine.changeTimeStep(1000/time_step, false, true)
      }
      document.value.controller.adjust_speed_slider(time_step)
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
  
  adjust_speed_slider(time_step) {
    let slider = document.getElementById("speed_slider")
    slider.value = Math.sqrt(time_step*.5)
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

    document.getElementById("load_best_btn").onclick = function() {
      document.value.game.load_best()
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



    document.getElementById("auto_set_best").value = document.value.game.auto_set_best
    document.getElementById("auto_adjust_eta").value = document.value.game.auto_adjust_eta
    document.getElementById("auto_adjust_epsilon").value = document.value.game.auto_adjust_epsilon
    document.getElementById("printing").checked = document.value.game.printing
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

      case 37: this.left=down;  break;
      case 39: this.right=down; break;

    }

  }  
}
