class Controller {
  constructor() {

    this.lineWidth = 2
    this.pos = {x: null, y: null}
    this.mousedown = false
    this.erase = false
    this.move = false
    this.moved = {x: 0, y: 0} // to track incomplete pixels

    this.buttons = {
      epoch: document.getElementById("epoch_btn"),
      batch: document.getElementById("batch_btn"),
      example: document.getElementById("example_btn"),
      draw: document.getElementById("draw_btn"),
      clear: document.getElementById("clear_btn"),
      eraser: document.getElementById("eraser_btn"),
      move: document.getElementById("move_btn"),
      reset: document.getElementById("reset_btn"),
    }
  }

  init_buttons(game) {
    if (["epoch", "batch", "example"].includes(game.state)) {
      this.buttons[game.state].checked = true
    }

    for (let mode of ["epoch", "batch", "example"]) {
      this.buttons[mode].oninput = function() {
        let game = document.value.game
        if (game.state == "draw") {
          document.value.engine.changeTimeStep(0, true)
        }
        game.state = mode
        document.getElementById("speed_slider").disabled = false
        
        document.value.controller.buttons.draw.setAttribute('class', "btn")
        document.value.controller.erase = false
        document.value.controller.buttons.eraser.setAttribute('class', "btn")
        document.value.controller.move = false
        document.value.controller.buttons.move.setAttribute('class', "btn")
      }
    }
    document.getElementById("speed_slider").oninput = function() {
      document.value.engine.setSlowMo(false);
      let time_step = this.value*this.value;
      document.value.engine.changeTimeStep(1000/time_step)      
    }

    this.buttons.reset.onclick = function() { document.value.nn.reset() }

    this.buttons.draw.onclick = function() {
      let controller = document.value.controller;

      controller.buttons.draw.setAttribute('class', "btn btn-primary");

      document.value.game.state = "draw";

      controller.erase = false;
      controller.buttons.eraser.setAttribute('class', "btn");

      document.value.engine.setSlowMo(false);
      document.value.engine.changeTimeStep(1000/16, false, false);
      document.getElementById("speed_slider").disabled = true;

      for (let mode of ["epoch", "batch", "example"]) {
        controller.buttons[mode].checked = false
      }
    }
    
    this.buttons.eraser.onclick = function() {
      let controller = document.value.controller;
      if (controller.erase) {
        document.value.controller.erase = false;
        document.value.controller.buttons.eraser.setAttribute('class', "btn");
      } else {
        document.value.controller.erase = true;
        document.value.controller.buttons.eraser.setAttribute('class', "btn btn-primary");
        document.value.controller.move = false;
        document.value.controller.buttons.move.setAttribute('class', "btn");
      }      
    }

    this.buttons.move.onclick = function() {
      let controller = document.value.controller;
      if (controller.move) {
        document.value.controller.move = false;
        document.value.controller.buttons.move.setAttribute('class', "btn");
      } else {
        document.value.controller.move = true;
        document.value.controller.buttons.move.setAttribute('class', "btn btn-primary");
        document.value.controller.erase = false;
        document.value.controller.buttons.eraser.setAttribute('class', "btn");      
      }      
    }

    this.buttons.clear.onclick = document.value.controller.clear_grid
  }

  // inspo from: https://stackoverflow.com/questions/2368784/draw-on-html5-canvas-using-a-mouse
  init_draw(canvas) {
    // Adding it to canvas means it only listens when the mouse is over the canvas element, and in the functions 'this' will be the canvas
    canvas.addEventListener('mousedown', this.begin_draw)
    canvas.addEventListener('mousemove', this.draw)
    window.addEventListener('mouseup', function() {document.value.controller.mousedown = false})

    // This prevents a line being drawn from the point where you exited the canvas to where you enter again, if you held down the mousebutton
    canvas.addEventListener('mouseenter', function(event) {
      let pos = document.value.controller.pos
      pos.x = event.offsetX / 7
      pos.y = event.offsetY / 7
    })
  }

  begin_draw(event) {
    if (document.value.game.state != "draw") return

    let controller = document.value.controller
    controller.mousedown = true

    let pos = controller.pos
    let lineWidth = controller.lineWidth

    let ctx = document.value.display.buffer.input
    pos.x = event.offsetX
    pos.y = event.offsetY

    // Draw Canvas/Buffer ratio
    let ratio = document.value.display.canvas.input.offsetWidth / document.value.display.buffer.input.canvas.width

    if (controller.move) {
      // nothing
    } else if (controller.erase) {
      ctx.clearRect(pos.x/ratio-lineWidth*.5, pos.y/ratio-lineWidth*.5, lineWidth, lineWidth)
    } else {
      ctx.fillStyle = 'rgb(255,255,255,.7)'
      ctx.beginPath()
      lineWidth *= .5
      ctx.ellipse(pos.x/ratio, pos.y/ratio, lineWidth, lineWidth, 0, 0, 7)
      ctx.fill()      
    }
  }

  draw(event) {
    if (!document.value.controller.mousedown) return
    if (document.value.game.state != "draw") return

    let controller = document.value.controller

    let pos = controller.pos
    let lineWidth = controller.lineWidth

    let ctx = document.value.display.buffer.input

    // Draw Canvas/Buffer ratio
    let ratio = document.value.display.canvas.input.offsetWidth / document.value.display.buffer.input.canvas.width

    if (controller.move) {
      let image_data = ctx.getImageData(0,0,28,28)
      ctx.clearRect(0,0,28,28)
      let x = pos.x
      let y = pos.y
      pos.x = event.offsetX
      pos.y = event.offsetY

      // This bit is to keep track of incomplete pixels because otherwise small movements get rounded down and ignored
      controller.moved.x += pos.x - x
      controller.moved.y += pos.y - y
      x = controller.moved.x / ratio
      y = controller.moved.y / ratio
      controller.moved.x %= ratio
      controller.moved.y %= ratio

      ctx.putImageData(image_data, x, y)
    } else if (controller.erase) {
      lineWidth *= 2 // Just make the eraser a bit larger when moving
      pos.x = event.offsetX
      pos.y = event.offsetY   
      ctx.clearRect(pos.x/ratio-lineWidth*.5, pos.y/ratio-lineWidth*.5, lineWidth, lineWidth)
    } else {
      ctx.strokeStyle = 'white'
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(pos.x/ratio, pos.y/ratio)
      pos.x = event.offsetX
      pos.y = event.offsetY
      ctx.lineTo(pos.x/ratio, pos.y/ratio)
      ctx.stroke()
    }

  }

  clear_grid() {
    if (document.value.game.state != "draw") return

    document.value.display.context.input.clearRect(0, 0, 10000, 10000)
    document.value.display.buffer.input.clearRect(0, 0, 10000, 10000)
  }
}