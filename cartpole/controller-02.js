class Controller {
  constructor() {

    this.left  = false
    this.right = false
    // this.B     = false
    // this.T     = false
  }


  init_buttons() {
    document.getElementById("speed_slider").oninput = function() {
      let time_step = this.value*this.value*2
      document.value.engine.changeTimeStep(1000/time_step)
      document.getElementById("fps").innerHTML = time_step
    }

    document.getElementById("reset_btn").onclick = function() {
      document.value.net_controller.reset()
    }

    document.getElementById("save_btn").onclick = function() {
      let params = document.value.net_controller.get_params()
      let layer_design = JSON.stringify(params.layer_design)
      let score = document.value.game.world.score
      document.value.controller.download(params, `ai_cart_params_ld${layer_design}_s${score}`)
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
      if (document.value.game.state == "drive") {
        document.value.game.state = "train"
        document.getElementById("drive_btn").setAttribute('class', "btn")        
      } else {
        document.value.game.state = "drive"
        document.getElementById("drive_btn").setAttribute('class', "btn btn-primary")        
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
      // case 66: this.B=down;     break;
      // case 84: this.T=down;     break;

    }

  }  
}
